use super::*;
use std::io::{Cursor, Write};
use std::os::unix::net::UnixStream;

const SESSION: [u8; 16] = [0x51; 16];
const CAPABILITY: [u8; 32] = [0xa7; 32];

fn frame(kind: Kind, sequence: u64, body: Vec<u8>) -> Frame {
    Frame {
        kind,
        session: SESSION,
        sequence,
        body,
    }
}

fn ready_session() -> Session {
    let mut session = Session::new(SESSION, CAPABILITY);
    session
        .authenticate(frame(Kind::Hello, 0, CAPABILITY.to_vec()))
        .expect("authenticate");
    session.frontend_ready().expect("frontend ready");
    session
}

#[test]
fn fragmented_stream_authenticates_and_completes_one_command() {
    let (mut controller, mut candidate) = UnixStream::pair().expect("stream pair");
    candidate.set_nonblocking(true).expect("nonblocking");
    let hello = encode(&frame(Kind::Hello, 0, CAPABILITY.to_vec())).expect("encode");
    controller.write_all(&hello[..3]).expect("prefix");
    let mut reader = FrameReader::new();
    assert_eq!(reader.poll(&mut candidate), Ok(None));
    controller.write_all(&hello[3..]).expect("body");
    let decoded = loop {
        if let Some(frame) = reader.poll(&mut candidate).expect("poll") {
            break frame;
        }
    };
    let mut session = Session::new(SESSION, CAPABILITY);
    session.authenticate(decoded).expect("hello");
    assert_eq!(
        session.frontend_ready().expect("ready"),
        frame(Kind::Ready, 0, Vec::new())
    );
    let command = session
        .receive_command(frame(Kind::Command, 1, vec![0x11]))
        .expect("command");
    assert_eq!(command.opcode, 0x11);
    assert_eq!(
        session.command_started(1).expect("started"),
        frame(Kind::Started, 1, Vec::new())
    );
    assert_eq!(
        session.command_completed(1, 0, "ok").expect("complete"),
        frame(Kind::Complete, 1, vec![0, 0, 0, 0, 0, 2, b'o', b'k'])
    );
}

#[test]
fn wrong_session_token_and_hello_shape_fail_closed() {
    for invalid in [
        frame(Kind::Hello, 0, vec![0; 32]),
        Frame {
            session: [0; 16],
            ..frame(Kind::Hello, 0, CAPABILITY.to_vec())
        },
        frame(Kind::Hello, 1, CAPABILITY.to_vec()),
        frame(Kind::Command, 0, CAPABILITY.to_vec()),
    ] {
        let mut session = Session::new(SESSION, CAPABILITY);
        assert_eq!(
            session.authenticate(invalid),
            Err(ObserverError::Unauthorized)
        );
        assert_eq!(
            session.authenticate(frame(Kind::Hello, 0, CAPABILITY.to_vec())),
            Err(ObserverError::Lifecycle)
        );
    }
}

#[test]
fn duplicate_busy_replay_and_sequence_gap_are_terminal() {
    let mut duplicate = ready_session();
    duplicate
        .receive_command(frame(Kind::Command, 1, vec![0x11]))
        .expect("first");
    assert_eq!(
        duplicate.receive_command(frame(Kind::Command, 1, vec![0x11])),
        Err(ObserverError::Busy)
    );

    let mut replay = ready_session();
    replay
        .receive_command(frame(Kind::Command, 1, vec![0x11]))
        .expect("first");
    replay.command_started(1).expect("started");
    replay.command_completed(1, 0, "ok").expect("complete");
    assert_eq!(
        replay.receive_command(frame(Kind::Command, 1, vec![0x11])),
        Err(ObserverError::Sequence)
    );

    let mut gap = ready_session();
    assert_eq!(
        gap.receive_command(frame(Kind::Command, 2, vec![0x11])),
        Err(ObserverError::Sequence)
    );
}

#[test]
fn malformed_oversized_truncated_version_kind_and_flags_fail_closed() {
    let mut oversized = Cursor::new(((MAX_PAYLOAD_BYTES + 1) as u32).to_be_bytes());
    assert_eq!(decode(&mut oversized), Err(ObserverError::Framing));

    let mut truncated = Cursor::new([0, 0, 0, FIXED_PAYLOAD_BYTES as u8, b'T']);
    assert_eq!(decode(&mut truncated), Err(ObserverError::Disconnect));

    let valid = encode(&frame(Kind::Ready, 0, Vec::new())).expect("encode");
    for (index, value, error) in [
        (4, b'X', ObserverError::Malformed),
        (9, 2, ObserverError::Version),
        (10, 0xff, ObserverError::Malformed),
        (11, 1, ObserverError::Malformed),
    ] {
        let mut invalid = valid.clone();
        invalid[index] = value;
        assert_eq!(decode(&mut Cursor::new(invalid)), Err(error));
    }
}

#[test]
fn allowlist_and_command_bodies_are_exact() {
    for opcode in 0x11..=0x19 {
        assert!(validate_command(&[opcode]).is_ok());
    }
    for opcode in 0x1b..=0x1c {
        assert!(validate_command(&[opcode]).is_ok());
    }
    for fixture in 0..=2 {
        assert!(validate_command(&[0x10, fixture]).is_ok());
    }
    assert_eq!(validate_command(&[0x10, 3]), Err(ObserverError::Malformed));
    assert_eq!(validate_command(&[0x11, 0]), Err(ObserverError::Malformed));
    assert_eq!(validate_command(&[0xff]), Err(ObserverError::Unsupported));
    assert_eq!(validate_command(&[]), Err(ObserverError::Malformed));
}

#[test]
fn prepare_path_is_absolute_utf8_bounded_and_mapworld_only() {
    let mut valid = vec![0x1a];
    valid.extend_from_slice(b"/private/tmp/observer/atlas.mapworld");
    assert!(validate_command(&valid).is_ok());
    for invalid in [
        vec![0x1a, b'r', b'e', b'l'],
        vec![0x1a, b'/', b't', b'm', b'p', 0],
        vec![0x1a, b'/', 0xff],
        vec![0x1a, b'/', b't', b'm', b'p'],
    ] {
        assert_eq!(validate_command(&invalid), Err(ObserverError::Malformed));
    }
    let mut oversized = vec![0x1a, b'/'];
    oversized.extend(std::iter::repeat_n(b'a', MAX_PREPARE_PATH_BYTES));
    oversized.extend_from_slice(b".mapworld");
    assert_eq!(validate_command(&oversized), Err(ObserverError::Malformed));
}

#[test]
fn completion_requires_started_sequence_status_bound_and_safe_error_code() {
    let mut before_started = ready_session();
    before_started
        .receive_command(frame(Kind::Command, 1, vec![0x11]))
        .expect("command");
    assert_eq!(
        before_started.command_completed(1, 0, "ok"),
        Err(ObserverError::Lifecycle)
    );

    let mut wrong_sequence = ready_session();
    wrong_sequence
        .receive_command(frame(Kind::Command, 1, vec![0x11]))
        .expect("command");
    assert_eq!(
        wrong_sequence.command_started(2),
        Err(ObserverError::Lifecycle)
    );

    let mut invalid_status = ready_session();
    invalid_status
        .receive_command(frame(Kind::Command, 1, vec![0x11]))
        .expect("command");
    invalid_status.command_started(1).expect("started");
    assert_eq!(
        invalid_status.command_completed(1, 5, "observer.failed"),
        Err(ObserverError::Framing)
    );

    let mut unsafe_error = ready_session();
    unsafe_error
        .receive_command(frame(Kind::Command, 1, vec![0x11]))
        .expect("command");
    unsafe_error.command_started(1).expect("started");
    assert_eq!(
        unsafe_error.command_completed(1, 2, "/private/tmp/private"),
        Err(ObserverError::Malformed)
    );
}

#[test]
fn reject_never_echoes_input() {
    let mut session = Session::new(SESSION, CAPABILITY);
    let reject = session.reject(ObserverError::Unauthorized, 0);
    assert_eq!(reject, frame(Kind::Reject, 0, vec![0, 1]));
    let encoded = encode(&reject).expect("encode");
    assert!(
        !encoded
            .windows(CAPABILITY.len())
            .any(|window| window == CAPABILITY)
    );
}

#[test]
fn controller_disconnect_is_terminal_without_a_partial_frame() {
    let (controller, mut candidate) = UnixStream::pair().expect("stream pair");
    candidate.set_nonblocking(true).expect("nonblocking");
    drop(controller);
    assert_eq!(
        FrameReader::new().poll(&mut candidate),
        Err(ObserverError::Disconnect)
    );
}
