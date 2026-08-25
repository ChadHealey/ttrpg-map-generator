#![cfg(all(feature = "observer-command-channel", target_os = "macos"))]

#[path = "../src/observer_command_channel/error.rs"]
mod error;
#[allow(dead_code)]
#[path = "../src/observer_command_channel/platform_macos.rs"]
mod platform_macos;
#[path = "../src/observer_command_channel/protocol.rs"]
mod protocol;

use std::fs::{self, Permissions};
use std::os::unix::fs::PermissionsExt as _;
use std::os::unix::net::UnixListener;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use protocol::{Frame, Kind, Session, decode, encode};

const SESSION: [u8; 16] = [0x51; 16];
const CAPABILITY: [u8; 32] = [0xa7; 32];

struct PrivateDirectory(PathBuf);

impl PrivateDirectory {
    fn create() -> Self {
        let path = PathBuf::from(format!(
            "/private/tmp/ttrpg-observer-121-interop-{}",
            std::process::id()
        ));
        fs::create_dir(&path).expect("fresh private interop directory");
        fs::set_permissions(&path, Permissions::from_mode(0o700)).expect("private mode");
        Self(path)
    }

    fn socket(&self) -> PathBuf {
        self.0.join("observer.sock")
    }
}

impl Drop for PrivateDirectory {
    fn drop(&mut self) {
        let _ = fs::remove_file(self.socket());
        let _ = fs::remove_dir(&self.0);
    }
}

#[test]
#[ignore = "run through the issue #121 no-launch Swift/Rust interoperability gate"]
fn rust_swift_production_authority_fragmented_round_trip() {
    let swift_client = std::env::var_os("ISSUE121_SWIFT_CLIENT")
        .map(PathBuf::from)
        .expect("ISSUE121_SWIFT_CLIENT must name the freshly compiled Swift client");
    let private_directory = PrivateDirectory::create();
    let socket_path = private_directory.socket();
    let listener = UnixListener::bind(&socket_path).expect("bind no-launch harness");
    fs::set_permissions(&socket_path, Permissions::from_mode(0o600)).expect("socket mode");

    let candidate_executable = std::fs::canonicalize(std::env::current_exe().expect("test path"))
        .expect("canonical test path");
    let candidate_digest = sha256(&candidate_executable);
    let candidate_bundle = private_directory.0.join("RustHarness.app");
    let child = Command::new(&swift_client)
        .arg("interop-client")
        .env("ISSUE121_INTEROP_SOCKET_PATH", &socket_path)
        .env("ISSUE121_INTEROP_SESSION", hex(&SESSION))
        .env("ISSUE121_INTEROP_CAPABILITY", hex(&CAPABILITY))
        .env(
            "ISSUE121_INTEROP_CANDIDATE_PID",
            std::process::id().to_string(),
        )
        .env(
            "ISSUE121_INTEROP_CANDIDATE_EXECUTABLE",
            &candidate_executable,
        )
        .env("ISSUE121_INTEROP_CANDIDATE_BUNDLE", &candidate_bundle)
        .env(
            "ISSUE121_INTEROP_CANDIDATE_BUNDLE_ID",
            "issue121.rust.interop-harness",
        )
        .env("ISSUE121_INTEROP_CANDIDATE_SHA256", &candidate_digest)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn standalone Swift client only");

    let (mut stream, _) = listener.accept().expect("accept Swift client");
    let peer = platform_macos::peer_identity(&stream).expect("Swift peer identity");
    assert_eq!(peer.effective_uid, platform_macos::effective_uid());
    assert_eq!(peer.pid, child.id() as i32);

    let mut authority = Session::new(SESSION, CAPABILITY);
    let (hello, hello_bytes) = read_recorded(&mut stream);
    assert_eq!(hello.kind, Kind::Hello);
    assert_eq!(hello.sequence, 0);
    assert_eq!(hello.body, CAPABILITY);
    assert_eq!(
        hello_bytes,
        encode(&Frame {
            kind: Kind::Hello,
            session: SESSION,
            sequence: 0,
            body: CAPABILITY.to_vec(),
        })
        .expect("production HELLO golden")
    );
    authority
        .authenticate(hello)
        .expect("production authentication");
    fs::remove_file(&socket_path).expect("post-auth endpoint unlink");

    let ready = authority.frontend_ready().expect("production READY");
    write_fragmented(&mut stream, &encode(&ready).expect("READY bytes"));
    let (command_frame, command_bytes) = read_recorded(&mut stream);
    assert_eq!(
        command_bytes,
        encode(&Frame {
            kind: Kind::Command,
            session: SESSION,
            sequence: 1,
            body: vec![0x11],
        })
        .expect("production COMMAND golden")
    );
    let command = authority
        .receive_command(command_frame)
        .expect("production command validation");
    assert_eq!(command.sequence, 1);
    assert_eq!(command.opcode, 0x11);
    assert!(command.body.is_empty());

    let started = authority.command_started(1).expect("production STARTED");
    write_fragmented(&mut stream, &encode(&started).expect("STARTED bytes"));
    let complete = authority
        .command_completed(1, 0, r#"{"interop":"production-rust-authority"}"#)
        .expect("production COMPLETE");
    write_fragmented(&mut stream, &encode(&complete).expect("COMPLETE bytes"));
    authority.close();
    drop(stream);

    let output = child.wait_with_output().expect("Swift client result");
    assert!(
        output.status.success(),
        "Swift client failed with sanitized output"
    );
    assert!(output.stderr.is_empty());
    let public_result = String::from_utf8(output.stdout).expect("UTF-8 public result");
    assert!(public_result.contains(r#""status":"valid""#));
    assert!(public_result.contains(r#""commandCount":1"#));
    for private_value in [
        socket_path.to_string_lossy().as_ref(),
        &hex(&SESSION),
        &hex(&CAPABILITY),
        &std::process::id().to_string(),
        candidate_executable.to_string_lossy().as_ref(),
        candidate_bundle.to_string_lossy().as_ref(),
        &candidate_digest,
    ] {
        assert!(!public_result.contains(private_value));
    }
}

fn write_fragmented(stream: &mut impl std::io::Write, bytes: &[u8]) {
    for byte in bytes {
        stream.write_all(&[*byte]).expect("one-byte Rust fragment");
    }
}

fn read_recorded(stream: &mut std::os::unix::net::UnixStream) -> (Frame, Vec<u8>) {
    struct RecordingReader<'a> {
        stream: &'a mut std::os::unix::net::UnixStream,
        bytes: Vec<u8>,
    }

    impl std::io::Read for RecordingReader<'_> {
        fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
            let count = std::io::Read::read(self.stream, buffer)?;
            self.bytes.extend_from_slice(&buffer[..count]);
            Ok(count)
        }
    }

    let mut reader = RecordingReader {
        stream,
        bytes: Vec::new(),
    };
    let frame = decode(&mut reader).expect("fragmented Swift frame");
    (frame, reader.bytes)
}

fn sha256(path: &Path) -> String {
    let output = Command::new("/usr/bin/shasum")
        .args(["-a", "256"])
        .arg(path)
        .output()
        .expect("system SHA-256 tool");
    assert!(output.status.success());
    String::from_utf8(output.stdout)
        .expect("SHA-256 output")
        .split_ascii_whitespace()
        .next()
        .expect("SHA-256 digest")
        .to_owned()
}

fn hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(char::from(DIGITS[usize::from(byte >> 4)]));
        output.push(char::from(DIGITS[usize::from(byte & 0x0f)]));
    }
    output
}
