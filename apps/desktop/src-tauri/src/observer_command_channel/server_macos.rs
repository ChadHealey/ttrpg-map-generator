use std::fs::{self, Permissions};
use std::io::Write as _;
use std::os::unix::fs::{FileTypeExt as _, MetadataExt as _, PermissionsExt as _};
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use tauri::{Emitter as _, Manager as _};

use super::bootstrap::{self, Bootstrap};
use super::bridge::ObserverBridge;
use super::error::ObserverError;
use super::platform_macos;
use super::protocol::{Frame, FrameReader, Kind, ObserverCommand, decode, encode};

const AUTHENTICATION_DEADLINE: Duration = Duration::from_secs(5);
const FRONTEND_DEADLINE: Duration = Duration::from_secs(30);
const STARTED_DEADLINE: Duration = Duration::from_secs(2);
const COMPLETION_DEADLINE: Duration = Duration::from_secs(120);
const POLL_INTERVAL: Duration = Duration::from_millis(10);
const COMMAND_EVENT: &str = "observer://command";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct NodeIdentity {
    device: u64,
    inode: u64,
}

struct BoundEndpoint {
    listener: UnixListener,
    path: PathBuf,
    parent: PathBuf,
    parent_identity: NodeIdentity,
    socket_identity: NodeIdentity,
    unlinked: bool,
}

impl BoundEndpoint {
    fn bind(path: &Path, effective_uid: u32) -> Result<Self, ObserverError> {
        bootstrap::validate_socket_path(path, effective_uid)?;
        let parent = path
            .parent()
            .ok_or(ObserverError::PathPolicy)?
            .to_path_buf();
        let parent_metadata =
            fs::symlink_metadata(&parent).map_err(|_| ObserverError::PathPolicy)?;
        let parent_identity = identity(&parent_metadata);
        let listener = UnixListener::bind(path).map_err(|error| {
            if error.kind() == std::io::ErrorKind::AddrInUse {
                ObserverError::PathCollision
            } else {
                ObserverError::Io
            }
        })?;
        fs::set_permissions(path, Permissions::from_mode(0o600))
            .map_err(|_| ObserverError::Permission)?;
        let socket_metadata =
            fs::symlink_metadata(path).map_err(|_| ObserverError::PathReplaced)?;
        if !socket_metadata.file_type().is_socket()
            || socket_metadata.file_type().is_symlink()
            || socket_metadata.uid() != effective_uid
            || socket_metadata.mode() & 0o7777 != 0o600
        {
            return Err(ObserverError::Permission);
        }
        let endpoint = Self {
            listener,
            path: path.to_path_buf(),
            parent,
            parent_identity,
            socket_identity: identity(&socket_metadata),
            unlinked: false,
        };
        endpoint.verify_namespace()?;
        Ok(endpoint)
    }

    fn accept(&self, deadline: Instant) -> Result<UnixStream, ObserverError> {
        self.listener.set_nonblocking(true)?;
        loop {
            self.verify_namespace()?;
            match self.listener.accept() {
                Ok((stream, _)) => return Ok(stream),
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    if Instant::now() >= deadline {
                        return Err(ObserverError::Timeout);
                    }
                    std::thread::sleep(POLL_INTERVAL);
                }
                Err(_) => return Err(ObserverError::Io),
            }
        }
    }

    fn unlink_authenticated(&mut self) -> Result<(), ObserverError> {
        self.verify_namespace()?;
        fs::remove_file(&self.path).map_err(|_| ObserverError::PathReplaced)?;
        self.unlinked = true;
        Ok(())
    }

    fn verify_namespace(&self) -> Result<(), ObserverError> {
        let parent = fs::symlink_metadata(&self.parent).map_err(|_| ObserverError::PathReplaced)?;
        let socket = fs::symlink_metadata(&self.path).map_err(|_| ObserverError::PathReplaced)?;
        if identity(&parent) != self.parent_identity
            || identity(&socket) != self.socket_identity
            || !socket.file_type().is_socket()
        {
            return Err(ObserverError::PathReplaced);
        }
        Ok(())
    }
}

impl Drop for BoundEndpoint {
    fn drop(&mut self) {
        if !self.unlinked && self.verify_namespace().is_ok() && fs::remove_file(&self.path).is_ok()
        {
            self.unlinked = true;
        }
    }
}

pub(crate) fn install(app: &mut tauri::App, bootstrap: Bootstrap) -> Result<(), ObserverError> {
    let endpoint = BoundEndpoint::bind(&bootstrap.socket_path, bootstrap.effective_uid)?;
    let bridge = ObserverBridge::new(
        bootstrap.session,
        bootstrap.capability,
        bootstrap.privacy_values.clone(),
    );
    app.manage(bridge.clone());
    let app_handle = app.handle().clone();
    std::thread::Builder::new()
        .name("observer-command-channel".to_owned())
        .spawn(move || {
            let _ = run_server(app_handle, endpoint, bootstrap, bridge.clone());
            bridge.abort();
        })
        .map_err(|_| ObserverError::Lifecycle)?;
    Ok(())
}

fn run_server(
    app: tauri::AppHandle,
    mut endpoint: BoundEndpoint,
    bootstrap: Bootstrap,
    bridge: ObserverBridge,
) -> Result<(), ObserverError> {
    let authentication_deadline = Instant::now() + AUTHENTICATION_DEADLINE;
    let mut stream = endpoint.accept(authentication_deadline)?;
    endpoint.verify_namespace()?;
    validate_peer(
        platform_macos::peer_identity(&stream).map_err(|_| ObserverError::Unauthorized)?,
        bootstrap.effective_uid,
        bootstrap.controller_pid,
    )?;
    let remaining = authentication_deadline.saturating_duration_since(Instant::now());
    if remaining.is_zero() {
        return reject_and_close(&mut stream, &bridge, ObserverError::Timeout, 0);
    }
    stream.set_read_timeout(Some(remaining))?;
    let hello = match decode(&mut stream) {
        Ok(frame) => frame,
        Err(error) => return reject_and_close(&mut stream, &bridge, error, 0),
    };
    if let Err(error) = bridge.authenticate(hello) {
        return flush_reject(&mut stream, &bridge, error);
    }
    endpoint.unlink_authenticated()?;
    stream.set_read_timeout(None)?;
    stream.set_nonblocking(true)?;
    let mut reader = FrameReader::new();
    await_outgoing(
        &mut stream,
        &mut reader,
        &bridge,
        Kind::Ready,
        Instant::now() + FRONTEND_DEADLINE,
        0,
    )?;

    loop {
        let frame = await_controller_frame(&mut stream, &mut reader, &bridge)?;
        let sequence = frame.sequence;
        let command = match bridge.receive_command(frame) {
            Ok(command) => command,
            Err(error) => return flush_reject(&mut stream, &bridge, error),
        };
        if emit_command(&app, &command).is_err() {
            return reject_and_close(&mut stream, &bridge, ObserverError::Lifecycle, sequence);
        }
        await_outgoing(
            &mut stream,
            &mut reader,
            &bridge,
            Kind::Started,
            Instant::now() + STARTED_DEADLINE,
            sequence,
        )?;
        await_outgoing(
            &mut stream,
            &mut reader,
            &bridge,
            Kind::Complete,
            Instant::now() + COMPLETION_DEADLINE,
            sequence,
        )?;
    }
}

fn validate_peer(
    peer: platform_macos::PeerIdentity,
    expected_uid: u32,
    expected_pid: i32,
) -> Result<(), ObserverError> {
    if peer.effective_uid != expected_uid {
        return Err(ObserverError::PeerUid);
    }
    if peer.pid != expected_pid {
        return Err(ObserverError::PeerPid);
    }
    Ok(())
}

fn emit_command(app: &tauri::AppHandle, command: &ObserverCommand) -> Result<(), ObserverError> {
    let body_hex = hex(&command.body);
    let payload = format!(
        "{{\"sequence\":{},\"opcode\":{},\"bodyHex\":\"{}\"}}",
        command.sequence, command.opcode, body_hex
    );
    app.emit_str(COMMAND_EVENT, payload)
        .map_err(|_| ObserverError::Lifecycle)
}

fn await_controller_frame(
    stream: &mut UnixStream,
    reader: &mut FrameReader,
    bridge: &ObserverBridge,
) -> Result<Frame, ObserverError> {
    loop {
        match reader.poll(stream) {
            Ok(Some(frame)) => return Ok(frame),
            Ok(None) => {}
            Err(error) => {
                bridge.abort();
                return Err(error);
            }
        }
        if bridge.is_terminal() {
            return Err(ObserverError::Lifecycle);
        }
        bridge.wait_tick(POLL_INTERVAL);
    }
}

fn await_outgoing(
    stream: &mut UnixStream,
    reader: &mut FrameReader,
    bridge: &ObserverBridge,
    expected_kind: Kind,
    deadline: Instant,
    sequence: u64,
) -> Result<(), ObserverError> {
    loop {
        if let Some(frame) = bridge.take_outgoing() {
            if frame.kind != expected_kind || frame.sequence != sequence {
                return reject_and_close(stream, bridge, ObserverError::Lifecycle, sequence);
            }
            return write_frame(stream, &frame);
        }
        match reader.poll(stream) {
            Ok(Some(frame)) => {
                return reject_and_close(stream, bridge, ObserverError::Busy, frame.sequence);
            }
            Ok(None) => {}
            Err(error) => {
                bridge.abort();
                return Err(error);
            }
        }
        if Instant::now() >= deadline {
            return reject_and_close(stream, bridge, ObserverError::Timeout, sequence);
        }
        bridge.wait_tick(POLL_INTERVAL.min(deadline.saturating_duration_since(Instant::now())));
    }
}

fn reject_and_close(
    stream: &mut UnixStream,
    bridge: &ObserverBridge,
    error: ObserverError,
    sequence: u64,
) -> Result<(), ObserverError> {
    bridge.reject(error, sequence);
    flush_reject(stream, bridge, error)
}

fn flush_reject(
    stream: &mut UnixStream,
    bridge: &ObserverBridge,
    error: ObserverError,
) -> Result<(), ObserverError> {
    if let Some(reject) = bridge.take_outgoing() {
        let _ = write_frame(stream, &reject);
    }
    Err(error)
}

fn write_frame(stream: &mut UnixStream, frame: &Frame) -> Result<(), ObserverError> {
    let bytes = encode(frame)?;
    stream
        .write_all(&bytes)
        .map_err(|_| ObserverError::Disconnect)
}

fn identity(metadata: &fs::Metadata) -> NodeIdentity {
    NodeIdentity {
        device: metadata.dev(),
        inode: metadata.ino(),
    }
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    static NEXT_DIRECTORY: AtomicU64 = AtomicU64::new(1);

    struct PrivateDirectory(PathBuf);

    impl PrivateDirectory {
        fn new() -> Self {
            let path = PathBuf::from(format!(
                "/private/tmp/ttrpg-observer-server-test-{}-{}",
                std::process::id(),
                NEXT_DIRECTORY.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir(&path).expect("private directory");
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
            let _ = fs::remove_file(self.0.join("bound.sock"));
            let _ = fs::remove_file(self.0.join("replacement"));
            let _ = fs::remove_dir(&self.0);
        }
    }

    #[test]
    fn bind_creates_owner_only_socket_and_drop_removes_it() {
        let directory = PrivateDirectory::new();
        let path = directory.socket();
        {
            let endpoint = BoundEndpoint::bind(&path, platform_macos::effective_uid())
                .expect("bound endpoint");
            assert_eq!(
                fs::symlink_metadata(&path).expect("socket").mode() & 0o7777,
                0o600
            );
            endpoint.verify_namespace().expect("stable namespace");
        }
        assert!(!path.exists());
    }

    #[test]
    fn path_replacement_is_terminal_and_cleanup_preserves_replacement() {
        let directory = PrivateDirectory::new();
        let path = directory.socket();
        let endpoint =
            BoundEndpoint::bind(&path, platform_macos::effective_uid()).expect("bound endpoint");
        let original = directory.0.join("bound.sock");
        fs::rename(&path, &original).expect("move bound socket");
        fs::write(&path, b"replacement").expect("replacement");
        assert_eq!(
            endpoint.verify_namespace(),
            Err(ObserverError::PathReplaced)
        );
        drop(endpoint);
        assert_eq!(
            fs::read(&path).expect("preserved replacement"),
            b"replacement"
        );
        fs::remove_file(path).expect("remove replacement");
        fs::remove_file(original).expect("remove original socket");
    }

    #[test]
    fn accept_timeout_fails_closed_and_cleans_the_endpoint() {
        let directory = PrivateDirectory::new();
        let path = directory.socket();
        let endpoint =
            BoundEndpoint::bind(&path, platform_macos::effective_uid()).expect("bound endpoint");
        assert!(matches!(
            endpoint.accept(Instant::now() + Duration::from_millis(20)),
            Err(ObserverError::Timeout)
        ));
        drop(endpoint);
        assert!(!path.exists());
    }

    #[test]
    fn peer_uid_and_pid_must_both_match() {
        let valid = platform_macos::PeerIdentity {
            effective_uid: 501,
            pid: 1234,
        };
        assert_eq!(validate_peer(valid, 501, 1234), Ok(()));
        assert_eq!(validate_peer(valid, 502, 1234), Err(ObserverError::PeerUid));
        assert_eq!(validate_peer(valid, 501, 1235), Err(ObserverError::PeerPid));
    }

    #[test]
    fn authenticated_unlink_allows_no_second_connection() {
        let directory = PrivateDirectory::new();
        let path = directory.socket();
        let mut endpoint =
            BoundEndpoint::bind(&path, platform_macos::effective_uid()).expect("bound endpoint");
        let _controller = UnixStream::connect(&path).expect("first controller");
        let _accepted = endpoint
            .accept(Instant::now() + Duration::from_secs(1))
            .expect("accept");
        endpoint.unlink_authenticated().expect("unlink");
        assert!(!path.exists());
        assert!(UnixStream::connect(&path).is_err());
    }

    #[test]
    fn frontend_deadline_sends_only_a_terminal_timeout_reject() {
        let (mut controller, mut candidate) = UnixStream::pair().expect("stream pair");
        candidate.set_nonblocking(true).expect("nonblocking");
        let bridge = ObserverBridge::new([0x51; 16], [0xa7; 32], Vec::new());
        assert_eq!(
            await_outgoing(
                &mut candidate,
                &mut FrameReader::new(),
                &bridge,
                Kind::Ready,
                Instant::now(),
                0,
            ),
            Err(ObserverError::Timeout)
        );
        controller
            .set_read_timeout(Some(Duration::from_secs(1)))
            .expect("read timeout");
        let reject = decode(&mut controller).expect("timeout reject");
        assert_eq!(reject.kind, Kind::Reject);
        assert_eq!(reject.body, 7_u16.to_be_bytes());
        assert!(bridge.is_terminal());
    }

    #[test]
    fn controller_disconnect_while_waiting_for_frontend_closes_without_success() {
        let (controller, mut candidate) = UnixStream::pair().expect("stream pair");
        candidate.set_nonblocking(true).expect("nonblocking");
        drop(controller);
        let bridge = ObserverBridge::new([0x51; 16], [0xa7; 32], Vec::new());
        assert_eq!(
            await_outgoing(
                &mut candidate,
                &mut FrameReader::new(),
                &bridge,
                Kind::Ready,
                Instant::now() + Duration::from_secs(1),
                0,
            ),
            Err(ObserverError::Disconnect)
        );
        assert!(bridge.is_terminal());
        assert!(bridge.take_outgoing().is_none());
    }
}
