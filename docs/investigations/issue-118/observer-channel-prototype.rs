//! Isolated protocol prototype for ADR-0020. It is not linked into the desktop application.

use std::io::Read;

const MAGIC: [u8; 4] = *b"TMOC";
const VERSION: u16 = 1;
const FIXED_PAYLOAD_BYTES: usize = 32;
const MAX_FRAME_BYTES: usize = 65_536;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u8)]
enum Kind {
    Hello = 1,
    Ready = 2,
    Command = 3,
    Started = 4,
    Complete = 5,
    Reject = 6,
}

impl TryFrom<u8> for Kind {
    type Error = ProtocolError;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            1 => Ok(Self::Hello),
            2 => Ok(Self::Ready),
            3 => Ok(Self::Command),
            4 => Ok(Self::Started),
            5 => Ok(Self::Complete),
            6 => Ok(Self::Reject),
            _ => Err(ProtocolError::Malformed),
        }
    }
}

#[derive(Debug, Eq, PartialEq)]
struct Frame {
    kind: Kind,
    session: [u8; 16],
    sequence: u64,
    body: Vec<u8>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ProtocolError {
    Authentication,
    Busy,
    Closed,
    Framing,
    Malformed,
    Replay,
    Sequence,
    UnsupportedCommand,
}

#[derive(Debug, Eq, PartialEq)]
enum SessionState {
    AwaitingHello,
    AwaitingFrontend,
    Ready { next_sequence: u64 },
    InFlight { sequence: u64 },
    Closed,
}

struct Session {
    expected_session: [u8; 16],
    expected_capability: [u8; 32],
    state: SessionState,
}

impl Session {
    fn new(expected_session: [u8; 16], expected_capability: [u8; 32]) -> Self {
        Self {
            expected_session,
            expected_capability,
            state: SessionState::AwaitingHello,
        }
    }

    fn receive(&mut self, frame: Frame) -> Result<Option<Frame>, ProtocolError> {
        let result = match self.state {
            SessionState::AwaitingHello => self.authenticate(frame),
            SessionState::AwaitingFrontend => Err(ProtocolError::Busy),
            SessionState::Ready { next_sequence } => self.start(frame, next_sequence),
            SessionState::InFlight { .. } => Err(ProtocolError::Busy),
            SessionState::Closed => Err(ProtocolError::Closed),
        };
        if result.is_err() {
            self.state = SessionState::Closed;
        }
        result
    }

    fn frontend_ready(&mut self) -> Result<Frame, ProtocolError> {
        if self.state != SessionState::AwaitingFrontend {
            self.state = SessionState::Closed;
            return Err(ProtocolError::Sequence);
        }
        self.state = SessionState::Ready { next_sequence: 1 };
        Ok(Frame {
            kind: Kind::Ready,
            session: self.expected_session,
            sequence: 0,
            body: Vec::new(),
        })
    }

    fn complete(
        &mut self,
        sequence: u64,
        status: u16,
        receipt: &str,
    ) -> Result<Frame, ProtocolError> {
        let SessionState::InFlight {
            sequence: in_flight,
        } = self.state
        else {
            self.state = SessionState::Closed;
            return Err(ProtocolError::Sequence);
        };
        if sequence != in_flight {
            self.state = SessionState::Closed;
            return Err(ProtocolError::Sequence);
        }
        if status > 4 || FIXED_PAYLOAD_BYTES + 6 + receipt.len() > MAX_FRAME_BYTES {
            self.state = SessionState::Closed;
            return Err(ProtocolError::Framing);
        }
        self.state = SessionState::Ready {
            next_sequence: sequence + 1,
        };
        let receipt_length = u32::try_from(receipt.len()).map_err(|_| ProtocolError::Framing)?;
        let mut body = Vec::with_capacity(6 + receipt.len());
        body.extend_from_slice(&status.to_be_bytes());
        body.extend_from_slice(&receipt_length.to_be_bytes());
        body.extend_from_slice(receipt.as_bytes());
        Ok(Frame {
            kind: Kind::Complete,
            session: self.expected_session,
            sequence,
            body,
        })
    }

    fn authenticate(&mut self, frame: Frame) -> Result<Option<Frame>, ProtocolError> {
        if frame.kind != Kind::Hello
            || frame.sequence != 0
            || frame.session != self.expected_session
            || !constant_time_equal(&frame.body, &self.expected_capability)
        {
            return Err(ProtocolError::Authentication);
        }
        self.state = SessionState::AwaitingFrontend;
        Ok(None)
    }

    fn start(&mut self, frame: Frame, next_sequence: u64) -> Result<Option<Frame>, ProtocolError> {
        if frame.kind != Kind::Command || frame.session != self.expected_session {
            return Err(ProtocolError::Malformed);
        }
        if frame.sequence < next_sequence {
            return Err(ProtocolError::Replay);
        }
        if frame.sequence != next_sequence {
            return Err(ProtocolError::Sequence);
        }
        validate_command(&frame.body)?;
        self.state = SessionState::InFlight {
            sequence: frame.sequence,
        };
        Ok(Some(Frame {
            kind: Kind::Started,
            session: self.expected_session,
            sequence: frame.sequence,
            body: Vec::new(),
        }))
    }
}

fn constant_time_equal(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }
    left.iter()
        .zip(right)
        .fold(0_u8, |difference, (left, right)| {
            difference | (left ^ right)
        })
        == 0
}

fn validate_command(body: &[u8]) -> Result<(), ProtocolError> {
    let Some((&opcode, payload)) = body.split_first() else {
        return Err(ProtocolError::Malformed);
    };
    match opcode {
        0x10 if payload.len() == 1 && payload[0] <= 2 => Ok(()),
        0x11..=0x19 | 0x1b..=0x1c if payload.is_empty() => Ok(()),
        0x1a => {
            let path = std::str::from_utf8(payload).map_err(|_| ProtocolError::Malformed)?;
            if path.starts_with('/')
                && path.ends_with(".mapworld")
                && !path.contains('\0')
                && path.len() <= 1_024
            {
                Ok(())
            } else {
                Err(ProtocolError::Malformed)
            }
        }
        _ => Err(ProtocolError::UnsupportedCommand),
    }
}

fn encode(frame: &Frame) -> Vec<u8> {
    let payload_length = FIXED_PAYLOAD_BYTES + frame.body.len();
    let mut encoded = Vec::with_capacity(4 + payload_length);
    encoded.extend_from_slice(&(payload_length as u32).to_be_bytes());
    encoded.extend_from_slice(&MAGIC);
    encoded.extend_from_slice(&VERSION.to_be_bytes());
    encoded.push(frame.kind as u8);
    encoded.push(0);
    encoded.extend_from_slice(&frame.session);
    encoded.extend_from_slice(&frame.sequence.to_be_bytes());
    encoded.extend_from_slice(&frame.body);
    encoded
}

fn decode(reader: &mut impl Read) -> Result<Frame, ProtocolError> {
    let mut length_bytes = [0_u8; 4];
    reader
        .read_exact(&mut length_bytes)
        .map_err(|_| ProtocolError::Framing)?;
    let length = u32::from_be_bytes(length_bytes) as usize;
    if !(FIXED_PAYLOAD_BYTES..=MAX_FRAME_BYTES).contains(&length) {
        return Err(ProtocolError::Framing);
    }
    let mut payload = vec![0_u8; length];
    reader
        .read_exact(&mut payload)
        .map_err(|_| ProtocolError::Framing)?;
    if payload[0..4] != MAGIC || u16::from_be_bytes([payload[4], payload[5]]) != VERSION {
        return Err(ProtocolError::Malformed);
    }
    if payload[7] != 0 {
        return Err(ProtocolError::Malformed);
    }
    let kind = Kind::try_from(payload[6])?;
    let mut session = [0_u8; 16];
    session.copy_from_slice(&payload[8..24]);
    let mut sequence_bytes = [0_u8; 8];
    sequence_bytes.copy_from_slice(&payload[24..32]);
    Ok(Frame {
        kind,
        session,
        sequence: u64::from_be_bytes(sequence_bytes),
        body: payload[32..].to_vec(),
    })
}

fn main() {}

#[cfg(test)]
mod tests {
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

    #[test]
    fn unix_stream_framing_authentication_and_acknowledgements() {
        let (mut controller, mut candidate) = UnixStream::pair().expect("Unix stream pair");
        let hello = encode(&frame(Kind::Hello, 0, CAPABILITY.to_vec()));
        controller.write_all(&hello[..3]).expect("partial prefix");
        controller.write_all(&hello[3..]).expect("remaining frame");

        let mut session = Session::new(SESSION, CAPABILITY);
        assert_eq!(
            session
                .receive(decode(&mut candidate).expect("framed hello"))
                .expect("authenticated hello"),
            None
        );
        let ready = session.frontend_ready().expect("frontend handshake");
        assert_eq!(ready, frame(Kind::Ready, 0, Vec::new()));

        let started = session
            .receive(frame(Kind::Command, 1, vec![0x11]))
            .expect("allowlisted preview command")
            .expect("started acknowledgement");
        assert_eq!(started, frame(Kind::Started, 1, Vec::new()));
        assert_eq!(
            session.complete(1, 0, "ok").expect("matching completion"),
            frame(Kind::Complete, 1, vec![0, 0, 0, 0, 0, 2, b'o', b'k'])
        );
    }

    #[test]
    fn wrong_capability_closes_the_session_without_command_authority() {
        let mut session = Session::new(SESSION, CAPABILITY);
        assert_eq!(
            session.receive(frame(Kind::Hello, 0, vec![0; 32])),
            Err(ProtocolError::Authentication)
        );
        assert_eq!(
            session.receive(frame(Kind::Hello, 0, CAPABILITY.to_vec())),
            Err(ProtocolError::Closed)
        );
    }

    #[test]
    fn single_in_flight_and_replay_rules_fail_closed() {
        let mut busy = Session::new(SESSION, CAPABILITY);
        busy.receive(frame(Kind::Hello, 0, CAPABILITY.to_vec()))
            .expect("hello");
        busy.frontend_ready().expect("frontend handshake");
        busy.receive(frame(Kind::Command, 1, vec![0x12]))
            .expect("full command");
        assert_eq!(
            busy.receive(frame(Kind::Command, 2, vec![0x11])),
            Err(ProtocolError::Busy)
        );

        let mut replay = Session::new(SESSION, CAPABILITY);
        replay
            .receive(frame(Kind::Hello, 0, CAPABILITY.to_vec()))
            .expect("hello");
        replay.frontend_ready().expect("frontend handshake");
        replay
            .receive(frame(Kind::Command, 1, vec![0x11]))
            .expect("preview command");
        replay.complete(1, 0, "ok").expect("completion");
        assert_eq!(
            replay.receive(frame(Kind::Command, 1, vec![0x11])),
            Err(ProtocolError::Replay)
        );

        let mut gap = Session::new(SESSION, CAPABILITY);
        gap.receive(frame(Kind::Hello, 0, CAPABILITY.to_vec()))
            .expect("hello");
        gap.frontend_ready().expect("frontend handshake");
        assert_eq!(
            gap.receive(frame(Kind::Command, 2, vec![0x11])),
            Err(ProtocolError::Sequence)
        );
    }

    #[test]
    fn malformed_oversized_truncated_and_unknown_frames_are_rejected() {
        let mut oversized = Cursor::new(((MAX_FRAME_BYTES + 1) as u32).to_be_bytes());
        assert_eq!(decode(&mut oversized), Err(ProtocolError::Framing));

        let mut truncated = Cursor::new([0, 0, 0, FIXED_PAYLOAD_BYTES as u8, b'T']);
        assert_eq!(decode(&mut truncated), Err(ProtocolError::Framing));

        let mut session = Session::new(SESSION, CAPABILITY);
        session
            .receive(frame(Kind::Hello, 0, CAPABILITY.to_vec()))
            .expect("hello");
        session.frontend_ready().expect("frontend handshake");
        assert_eq!(
            session.receive(frame(Kind::Command, 1, vec![0xff])),
            Err(ProtocolError::UnsupportedCommand)
        );
    }

    #[test]
    fn prepare_reopen_requires_a_bounded_absolute_mapworld_path() {
        let mut command = vec![0x1a];
        command.extend_from_slice(b"/private/observer/atlas.mapworld");
        assert_eq!(validate_command(&command), Ok(()));
        assert_eq!(
            validate_command(&[0x1a, b'r', b'e', b'l']),
            Err(ProtocolError::Malformed)
        );
    }
}
