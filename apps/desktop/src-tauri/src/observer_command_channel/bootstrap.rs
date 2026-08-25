use std::ffi::{OsStr, OsString};
use std::fs;
use std::os::unix::ffi::OsStrExt as _;
use std::os::unix::fs::MetadataExt as _;
use std::path::{Component, Path, PathBuf};

use crate::mapworld_native::sha256::sha256_hex;

use super::error::ObserverError;
use super::platform_macos;

const SOCKET_PATH: &str = "TTRPG_OBSERVER_SOCKET_PATH";
const SESSION: &str = "TTRPG_OBSERVER_SESSION";
const CAPABILITY: &str = "TTRPG_OBSERVER_CAPABILITY";
const CONTROLLER_PID: &str = "TTRPG_OBSERVER_CONTROLLER_PID";
const CANDIDATE_SHA256: &str = "TTRPG_OBSERVER_CANDIDATE_SHA256";
const PRIVATE_TMP: &str = "/private/tmp";
const DARWIN_SUN_PATH_BYTES: usize = 104;

pub(crate) struct Bootstrap {
    pub(crate) socket_path: PathBuf,
    pub(crate) session: [u8; 16],
    pub(crate) capability: [u8; 32],
    pub(crate) controller_pid: i32,
    pub(crate) effective_uid: u32,
    pub(crate) privacy_values: Vec<String>,
}

pub(crate) fn load() -> Result<Bootstrap, ObserverError> {
    let values = platform_macos::take_private_environment([
        SOCKET_PATH,
        SESSION,
        CAPABILITY,
        CONTROLLER_PID,
        CANDIDATE_SHA256,
    ]);
    let executable = std::env::current_exe().map_err(|_| ObserverError::CandidateMismatch)?;
    let bytes = fs::read(&executable).map_err(|_| ObserverError::CandidateMismatch)?;
    parse(
        values,
        &sha256_hex(&bytes),
        &executable,
        platform_macos::effective_uid(),
    )
}

fn parse(
    values: [Option<OsString>; 5],
    actual_digest: &str,
    executable: &Path,
    effective_uid: u32,
) -> Result<Bootstrap, ObserverError> {
    if values.iter().any(Option::is_none) {
        return Err(ObserverError::BootstrapMissing);
    }
    let mut values = values.into_iter().map(|value| {
        value
            .expect("presence checked")
            .into_string()
            .map_err(|_| ObserverError::BootstrapInvalid)
    });
    let socket_value = values.next().expect("five bootstrap values")?;
    let session_value = values.next().expect("five bootstrap values")?;
    let capability_value = values.next().expect("five bootstrap values")?;
    let pid_value = values.next().expect("five bootstrap values")?;
    let digest_value = values.next().expect("five bootstrap values")?;

    let socket_path = PathBuf::from(&socket_value);
    validate_socket_path(&socket_path, effective_uid)?;
    let session = decode_hex::<16>(&session_value)?;
    let capability = decode_hex::<32>(&capability_value)?;
    let controller_pid = parse_pid(&pid_value)?;
    let _: [u8; 32] = decode_hex(&digest_value)?;
    if !constant_time_equal(digest_value.as_bytes(), actual_digest.as_bytes()) {
        return Err(ObserverError::CandidateMismatch);
    }
    Ok(Bootstrap {
        socket_path,
        session,
        capability,
        controller_pid,
        effective_uid,
        privacy_values: vec![
            socket_value,
            session_value,
            capability_value,
            digest_value,
            executable.to_string_lossy().into_owned(),
            format!("\"pid\":{controller_pid}"),
            format!("pid={controller_pid}"),
            format!("pid:{controller_pid}"),
            format!("PID {controller_pid}"),
        ],
    })
}

pub(crate) fn validate_socket_path(path: &Path, effective_uid: u32) -> Result<(), ObserverError> {
    if !path.is_absolute()
        || path.as_os_str().as_bytes().contains(&0)
        || path.as_os_str().as_bytes().len() >= DARWIN_SUN_PATH_BYTES
        || path.components().any(|component| {
            matches!(
                component,
                Component::CurDir | Component::ParentDir | Component::Prefix(_)
            )
        })
    {
        return Err(ObserverError::PathPolicy);
    }
    let parent = path.parent().ok_or(ObserverError::PathPolicy)?;
    if parent.parent() != Some(Path::new(PRIVATE_TMP))
        || path.file_name().is_none_or(OsStr::is_empty)
    {
        return Err(ObserverError::PathPolicy);
    }
    validate_private_directory(parent, effective_uid)?;
    match fs::symlink_metadata(path) {
        Ok(_) => Err(ObserverError::PathCollision),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err(ObserverError::PathPolicy),
    }
}

fn validate_private_directory(path: &Path, effective_uid: u32) -> Result<(), ObserverError> {
    let metadata = fs::symlink_metadata(path).map_err(|_| ObserverError::PathPolicy)?;
    if !metadata.file_type().is_dir() || metadata.file_type().is_symlink() {
        return Err(ObserverError::PathPolicy);
    }
    if metadata.uid() != effective_uid || metadata.mode() & 0o7777 != 0o700 {
        return Err(ObserverError::Permission);
    }
    Ok(())
}

fn decode_hex<const N: usize>(value: &str) -> Result<[u8; N], ObserverError> {
    if value.len() != N * 2
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        return Err(ObserverError::BootstrapInvalid);
    }
    let mut decoded = [0_u8; N];
    for (slot, pair) in decoded.iter_mut().zip(value.as_bytes().chunks_exact(2)) {
        *slot = (hex_nibble(pair[0])? << 4) | hex_nibble(pair[1])?;
    }
    Ok(decoded)
}

fn hex_nibble(byte: u8) -> Result<u8, ObserverError> {
    match byte {
        b'0'..=b'9' => Ok(byte - b'0'),
        b'a'..=b'f' => Ok(byte - b'a' + 10),
        _ => Err(ObserverError::BootstrapInvalid),
    }
}

fn parse_pid(value: &str) -> Result<i32, ObserverError> {
    if value.is_empty()
        || !value.bytes().all(|byte| byte.is_ascii_digit())
        || value.starts_with('0')
    {
        return Err(ObserverError::BootstrapInvalid);
    }
    value
        .parse::<i32>()
        .ok()
        .filter(|pid| *pid > 0)
        .ok_or(ObserverError::BootstrapInvalid)
}

fn constant_time_equal(left: &[u8], right: &[u8]) -> bool {
    let mut difference = left.len() ^ right.len();
    let maximum = left.len().max(right.len());
    for index in 0..maximum {
        difference |= usize::from(
            left.get(index).copied().unwrap_or(0) ^ right.get(index).copied().unwrap_or(0),
        );
    }
    difference == 0
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, Permissions};
    use std::os::unix::fs::{PermissionsExt as _, symlink};
    use std::sync::atomic::{AtomicU64, Ordering};

    static NEXT_DIRECTORY: AtomicU64 = AtomicU64::new(1);

    struct PrivateDirectory(PathBuf);

    impl PrivateDirectory {
        fn new() -> Self {
            let path = PathBuf::from(format!(
                "/private/tmp/ttrpg-observer-bootstrap-test-{}-{}",
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
            let _ = fs::remove_dir(self.0.join("target"));
            let _ = fs::remove_dir(&self.0);
        }
    }

    fn valid_values(path: &Path, digest: &str) -> [Option<OsString>; 5] {
        [
            Some(path.as_os_str().to_owned()),
            Some(OsString::from("51".repeat(16))),
            Some(OsString::from("a7".repeat(32))),
            Some(OsString::from("1234")),
            Some(OsString::from(digest)),
        ]
    }

    #[test]
    fn requires_every_bootstrap_value_and_exact_candidate_digest() {
        let directory = PrivateDirectory::new();
        let digest = "b4".repeat(32);
        let executable = Path::new("/private/candidate");
        assert!(
            parse(
                valid_values(&directory.socket(), &digest),
                &digest,
                executable,
                platform_macos::effective_uid(),
            )
            .is_ok()
        );
        let mut missing = valid_values(&directory.socket(), &digest);
        missing[2] = None;
        assert!(matches!(
            parse(
                missing,
                &digest,
                executable,
                platform_macos::effective_uid()
            ),
            Err(ObserverError::BootstrapMissing)
        ));
        assert!(matches!(
            parse(
                valid_values(&directory.socket(), &"00".repeat(32)),
                &digest,
                executable,
                platform_macos::effective_uid()
            ),
            Err(ObserverError::CandidateMismatch)
        ));
    }

    #[test]
    fn rejects_uppercase_hex_noncanonical_pid_and_malformed_lengths() {
        assert_eq!(
            decode_hex::<16>(&"AA".repeat(16)),
            Err(ObserverError::BootstrapInvalid)
        );
        assert_eq!(decode_hex::<16>("aa"), Err(ObserverError::BootstrapInvalid));
        for pid in ["", "0", "012", "+12", "-1", "2147483648"] {
            assert_eq!(parse_pid(pid), Err(ObserverError::BootstrapInvalid));
        }
    }

    #[test]
    fn enforces_direct_private_tmp_owner_mode_and_collision_policy() {
        let directory = PrivateDirectory::new();
        let socket = directory.socket();
        assert_eq!(
            validate_socket_path(&socket, platform_macos::effective_uid()),
            Ok(())
        );
        fs::write(&socket, b"collision").expect("collision");
        assert_eq!(
            validate_socket_path(&socket, platform_macos::effective_uid()),
            Err(ObserverError::PathCollision)
        );
        fs::remove_file(&socket).expect("remove collision");
        fs::set_permissions(&directory.0, Permissions::from_mode(0o755)).expect("wrong mode");
        assert_eq!(
            validate_socket_path(&socket, platform_macos::effective_uid()),
            Err(ObserverError::Permission)
        );
    }

    #[test]
    fn rejects_symlink_directory_relative_nested_and_overlong_paths() {
        let directory = PrivateDirectory::new();
        let target = directory.0.join("target");
        fs::create_dir(&target).expect("target");
        fs::set_permissions(&target, Permissions::from_mode(0o700)).expect("target mode");
        let link = PathBuf::from(format!(
            "/private/tmp/ttrpg-observer-bootstrap-link-{}-{}",
            std::process::id(),
            NEXT_DIRECTORY.fetch_add(1, Ordering::Relaxed)
        ));
        symlink(&target, &link).expect("symlink");
        assert_eq!(
            validate_socket_path(&link.join("observer.sock"), platform_macos::effective_uid()),
            Err(ObserverError::PathPolicy)
        );
        fs::remove_file(&link).expect("remove link");
        assert_eq!(
            validate_socket_path(Path::new("relative.sock"), platform_macos::effective_uid()),
            Err(ObserverError::PathPolicy)
        );
        assert_eq!(
            validate_socket_path(
                Path::new("/private/tmp/private/invalid\0.sock"),
                platform_macos::effective_uid()
            ),
            Err(ObserverError::PathPolicy)
        );
        assert_eq!(
            validate_socket_path(
                &directory.0.join("nested").join("observer.sock"),
                platform_macos::effective_uid()
            ),
            Err(ObserverError::PathPolicy)
        );
        let overlong = directory.0.join("x".repeat(104));
        assert_eq!(
            validate_socket_path(&overlong, platform_macos::effective_uid()),
            Err(ObserverError::PathPolicy)
        );
    }
}
