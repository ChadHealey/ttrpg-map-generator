use std::ffi::{OsStr, OsString};
use std::fs::{File, TryLockError};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use super::NATIVE_MAX_BASENAME_BYTES;
use super::base64::decode_canonical_base64;
use super::filesystem::read_bounded;
use super::model::{NativeError, quoted};
use super::platform_ffi;
use super::sha256::sha256_hex;

pub const ATLAS_PNG_MAXIMUM_BYTES: usize = 64 * 1_024 * 1_024;
const MAXIMUM_TARGET_PATH_BYTES: usize = 4_096;

struct AtlasPngNames {
    target_path: String,
    parent_path: PathBuf,
    target: OsString,
    temporary: OsString,
}

#[derive(Clone, Copy, Eq, PartialEq)]
enum AtlasPngCommitPoint {
    BeforeRename,
    AfterRename,
}

#[tauri::command]
pub fn atlas_png_write_base64(
    target_path: String,
    png_base64: String,
    expected_sha256: String,
) -> String {
    let bytes = match decode_canonical_base64(&png_base64, ATLAS_PNG_MAXIMUM_BYTES) {
        Ok(bytes) if !bytes.is_empty() => bytes,
        _ => return invalid_request("decode-atlas-png-base64").to_json(),
    };
    if !valid_sha256(&expected_sha256) || sha256_hex(&bytes) != expected_sha256 {
        return NativeError::new(
            "atlas-png.native.fingerprint-mismatch",
            "validate-atlas-png-fingerprint",
            None,
            "canonical PNG bytes do not match the expected SHA-256",
        )
        .to_json();
    }
    match write_atlas_png(&target_path, &bytes, &expected_sha256) {
        Ok(receipt) => receipt,
        Err(error) => error.to_json(),
    }
}

fn write_atlas_png(
    target_path: &str,
    bytes: &[u8],
    expected_sha256: &str,
) -> Result<String, NativeError> {
    write_atlas_png_with_commit_hook(target_path, bytes, expected_sha256, |_| Ok(()))
}

fn write_atlas_png_with_commit_hook<F>(
    target_path: &str,
    bytes: &[u8],
    expected_sha256: &str,
    mut commit_hook: F,
) -> Result<String, NativeError>
where
    F: FnMut(AtlasPngCommitPoint) -> Result<(), NativeError>,
{
    if bytes.is_empty() || bytes.len() > ATLAS_PNG_MAXIMUM_BYTES || !valid_sha256(expected_sha256) {
        return Err(invalid_request("validate-atlas-png-request"));
    }
    let names = AtlasPngNames::derive(target_path)?;
    let parent = platform_ffi::open_parent(names.parent_path.as_os_str())
        .map_err(|error| native_io_error("open-atlas-png-parent", error))?;
    match parent.try_lock() {
        Ok(()) => {}
        Err(TryLockError::WouldBlock) => {
            return Err(NativeError::new(
                "atlas-png.native.artifact-conflict",
                "lock-atlas-png-parent",
                None,
                "another cooperating filesystem operation holds the destination directory lock",
            ));
        }
        Err(TryLockError::Error(error)) => {
            return Err(native_io_error("lock-atlas-png-parent", error));
        }
    }
    validate_target(&parent, &names.target)?;
    require_absent(&parent, &names.temporary)?;
    platform_ffi::sync_descriptor(&parent)
        .map_err(|error| native_io_error("probe-atlas-png-parent-sync", error))?;

    let result = prepare_and_commit(&parent, &names, bytes, expected_sha256, &mut commit_hook);
    if result.is_err() {
        let _ = platform_ffi::unlink_file_at(&parent, &names.temporary);
        let _ = platform_ffi::sync_descriptor(&parent);
    }
    result
}

fn prepare_and_commit<F>(
    parent: &File,
    names: &AtlasPngNames,
    bytes: &[u8],
    expected_sha256: &str,
    commit_hook: &mut F,
) -> Result<String, NativeError>
where
    F: FnMut(AtlasPngCommitPoint) -> Result<(), NativeError>,
{
    let mut temporary = platform_ffi::create_regular_at(parent, &names.temporary)
        .map_err(|error| native_io_error("create-atlas-png-temporary", error))?;
    temporary
        .write_all(bytes)
        .map_err(|error| native_io_error("write-atlas-png-temporary", error))?;
    platform_ffi::sync_descriptor(&temporary)
        .and_then(|()| platform_ffi::full_sync(&temporary))
        .map_err(|error| native_io_error("sync-atlas-png-temporary", error))?;
    drop(temporary);
    verify_file(
        parent,
        &names.temporary,
        bytes.len(),
        expected_sha256,
        "temporary",
    )?;
    platform_ffi::sync_descriptor(parent)
        .map_err(|error| native_io_error("sync-atlas-png-prepared-entry", error))?;
    commit_hook(AtlasPngCommitPoint::BeforeRename)?;
    platform_ffi::rename_replace(parent, &names.temporary, &names.target)
        .map_err(|error| native_io_error("rename-atlas-png-into-place", error))?;
    commit_hook(AtlasPngCommitPoint::AfterRename)?;
    platform_ffi::sync_descriptor(parent)
        .map_err(|error| native_io_error("sync-atlas-png-committed-entry", error))?;
    verify_file(
        parent,
        &names.target,
        bytes.len(),
        expected_sha256,
        "target",
    )?;
    Ok(format!(
        "{{\"ok\":true,\"result\":{{\"kind\":\"atlas-png-written\",\"targetPath\":{},\"sha256\":{},\"byteLength\":{},\"platform\":{}}}}}",
        quoted(&names.target_path),
        quoted(expected_sha256),
        bytes.len(),
        quoted(platform_ffi::platform_name()),
    ))
}

fn verify_file(
    parent: &File,
    name: &OsStr,
    expected_length: usize,
    expected_sha256: &str,
    label: &str,
) -> Result<(), NativeError> {
    let mut file = platform_ffi::open_regular_at(parent, name)
        .map_err(|error| native_io_error(format!("reopen-atlas-png-{label}"), error))?;
    let metadata = file
        .metadata()
        .map_err(|error| native_io_error(format!("metadata-atlas-png-{label}"), error))?;
    if !metadata.is_file() {
        return Err(NativeError::new(
            "atlas-png.native.artifact-conflict",
            format!("metadata-atlas-png-{label}"),
            None,
            "atlas PNG readback is not a regular file",
        ));
    }
    let bytes = read_bounded(&mut file, ATLAS_PNG_MAXIMUM_BYTES)
        .map_err(|error| native_io_error(format!("readback-atlas-png-{label}"), error))?;
    if bytes.len() != expected_length || sha256_hex(&bytes) != expected_sha256 {
        return Err(NativeError::new(
            "atlas-png.native.fingerprint-mismatch",
            format!("verify-atlas-png-{label}"),
            None,
            "atlas PNG readback differs from the validated canonical bytes",
        ));
    }
    Ok(())
}

fn validate_target(parent: &File, target: &OsStr) -> Result<(), NativeError> {
    match platform_ffi::is_symlink_at(parent, target) {
        Ok(true) => Err(artifact_conflict(
            "validate-atlas-png-target",
            "the PNG destination is a symbolic link",
        )),
        Ok(false) => {
            let file = platform_ffi::open_regular_at(parent, target).map_err(|_| {
                artifact_conflict(
                    "validate-atlas-png-target",
                    "the existing PNG destination is not a readable regular file",
                )
            })?;
            let metadata = file
                .metadata()
                .map_err(|error| native_io_error("metadata-atlas-png-target", error))?;
            if metadata.is_file() {
                Ok(())
            } else {
                Err(artifact_conflict(
                    "validate-atlas-png-target",
                    "the existing PNG destination is not a regular file",
                ))
            }
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(native_io_error("inspect-atlas-png-target", error)),
    }
}

fn require_absent(parent: &File, name: &OsStr) -> Result<(), NativeError> {
    match platform_ffi::is_symlink_at(parent, name) {
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Ok(_) => Err(artifact_conflict(
            "validate-atlas-png-temporary",
            "a previous atlas PNG temporary artifact requires cleanup before retrying",
        )),
        Err(error) => Err(native_io_error("inspect-atlas-png-temporary", error)),
    }
}

impl AtlasPngNames {
    fn derive(target_path: &str) -> Result<Self, NativeError> {
        if target_path.is_empty()
            || target_path.contains('\0')
            || target_path.len() > MAXIMUM_TARGET_PATH_BYTES
        {
            return Err(invalid_request("validate-atlas-png-target-path"));
        }
        let path = Path::new(target_path);
        let target = path
            .file_name()
            .ok_or_else(|| invalid_request("validate-atlas-png-target-name"))?;
        let target_text = target
            .to_str()
            .ok_or_else(|| invalid_request("validate-atlas-png-target-name"))?;
        if target_text == "."
            || target_text == ".."
            || !target_text.ends_with(".png")
            || target_text.len() > NATIVE_MAX_BASENAME_BYTES
        {
            return Err(invalid_request("validate-atlas-png-target-name"));
        }
        let temporary_text = format!(".{target_text}.atlas-png-v1.temporary");
        if temporary_text.len() > NATIVE_MAX_BASENAME_BYTES {
            return Err(invalid_request("validate-atlas-png-temporary-name"));
        }
        let parent_path = path
            .parent()
            .filter(|parent| !parent.as_os_str().is_empty())
            .unwrap_or_else(|| Path::new("."))
            .to_path_buf();
        Ok(Self {
            target_path: target_path.to_owned(),
            parent_path,
            target: target.to_os_string(),
            temporary: temporary_text.into(),
        })
    }
}

fn valid_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn invalid_request(primitive: &'static str) -> NativeError {
    NativeError::new(
        "atlas-png.native.invalid-request",
        primitive,
        None,
        "choose a valid lowercase .png destination and canonical bytes within the 64 MiB limit",
    )
}

fn artifact_conflict(primitive: &'static str, message: &'static str) -> NativeError {
    NativeError::new(
        "atlas-png.native.artifact-conflict",
        primitive,
        None,
        message,
    )
}

fn native_io_error(primitive: impl Into<String>, error: io::Error) -> NativeError {
    NativeError::from_io("atlas-png.native.io-failed", primitive, None, error)
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::sync::atomic::{AtomicUsize, Ordering};

    use super::*;

    static NEXT_TEST: AtomicUsize = AtomicUsize::new(0);

    #[test]
    fn atomically_writes_replaces_and_verifies_png_bytes() {
        let root = test_root("replace");
        fs::create_dir(&root).expect("create test root");
        let target = root.join("atlas.png");
        let first = b"first canonical PNG";
        let second = b"second canonical PNG";

        write_atlas_png(path_text(&target), first, &sha256_hex(first)).expect("first write");
        write_atlas_png(path_text(&target), second, &sha256_hex(second)).expect("replacement");

        assert_eq!(fs::read(&target).expect("read target"), second);
        assert!(!root.join(".atlas.png.atlas-png-v1.temporary").exists());
        fs::remove_dir_all(root).expect("remove test root");
    }

    #[test]
    fn rejects_a_mismatched_fingerprint_without_replacing_the_target() {
        let root = test_root("fingerprint");
        fs::create_dir(&root).expect("create test root");
        let target = root.join("atlas.png");
        fs::write(&target, b"accepted").expect("write accepted target");

        let error = write_atlas_png(path_text(&target), b"replacement", &"0".repeat(64))
            .expect_err("fingerprint mismatch");

        assert_eq!(error.code, "atlas-png.native.fingerprint-mismatch");
        assert_eq!(fs::read(&target).expect("read target"), b"accepted");
        assert!(!root.join(".atlas.png.atlas-png-v1.temporary").exists());
        fs::remove_dir_all(root).expect("remove test root");
    }

    #[test]
    fn rejects_directory_and_symlink_destinations_without_replacing_them() {
        let root = test_root("special-targets");
        fs::create_dir(&root).expect("create test root");
        let bytes = b"canonical PNG";
        let digest = sha256_hex(bytes);

        let directory_target = root.join("directory.png");
        fs::create_dir(&directory_target).expect("create directory target");
        let directory_error = write_atlas_png(path_text(&directory_target), bytes, &digest)
            .expect_err("directory destination");
        assert_eq!(directory_error.code, "atlas-png.native.artifact-conflict");
        assert!(directory_target.is_dir());

        let accepted = root.join("accepted.txt");
        fs::write(&accepted, b"accepted").expect("write symlink source");
        let symlink_target = root.join("symlink.png");
        std::os::unix::fs::symlink(&accepted, &symlink_target).expect("create symlink target");
        let symlink_error = write_atlas_png(path_text(&symlink_target), bytes, &digest)
            .expect_err("symlink destination");
        assert_eq!(symlink_error.code, "atlas-png.native.artifact-conflict");
        assert_eq!(
            fs::read(&accepted).expect("read symlink source"),
            b"accepted"
        );

        fs::remove_dir_all(root).expect("remove test root");
    }

    #[test]
    fn rejects_a_stale_recognizable_temporary_without_replacing_either_file() {
        let root = test_root("stale-temporary");
        fs::create_dir(&root).expect("create test root");
        let target = root.join("atlas.png");
        let temporary = root.join(".atlas.png.atlas-png-v1.temporary");
        fs::write(&target, b"accepted").expect("write accepted target");
        fs::write(&temporary, b"interrupted").expect("write stale temporary");
        let bytes = b"replacement";

        let error = write_atlas_png(path_text(&target), bytes, &sha256_hex(bytes))
            .expect_err("stale temporary");

        assert_eq!(error.code, "atlas-png.native.artifact-conflict");
        assert_eq!(error.primitive, "validate-atlas-png-temporary");
        assert_eq!(fs::read(&target).expect("read target"), b"accepted");
        assert_eq!(
            fs::read(&temporary).expect("read temporary"),
            b"interrupted"
        );
        fs::remove_dir_all(root).expect("remove test root");
    }

    #[test]
    fn failure_immediately_before_rename_preserves_old_target_and_cleans_temporary() {
        let root = test_root("before-rename-fault");
        fs::create_dir(&root).expect("create test root");
        let target = root.join("atlas.png");
        fs::write(&target, b"accepted").expect("write accepted target");
        let replacement = b"complete replacement";

        let error = write_atlas_png_with_commit_hook(
            path_text(&target),
            replacement,
            &sha256_hex(replacement),
            |point| inject_at(point, AtlasPngCommitPoint::BeforeRename),
        )
        .expect_err("inject failure before rename");

        assert_eq!(error.primitive, "test-atlas-png-before-rename");
        assert_eq!(fs::read(&target).expect("read target"), b"accepted");
        assert!(!root.join(".atlas.png.atlas-png-v1.temporary").exists());
        fs::remove_dir_all(root).expect("remove test root");
    }

    #[test]
    fn failure_immediately_after_rename_leaves_only_the_complete_new_target() {
        let root = test_root("after-rename-fault");
        fs::create_dir(&root).expect("create test root");
        let target = root.join("atlas.png");
        fs::write(&target, b"accepted").expect("write accepted target");
        let replacement = b"complete replacement";

        let error = write_atlas_png_with_commit_hook(
            path_text(&target),
            replacement,
            &sha256_hex(replacement),
            |point| inject_at(point, AtlasPngCommitPoint::AfterRename),
        )
        .expect_err("inject failure after rename");

        assert_eq!(error.primitive, "test-atlas-png-after-rename");
        assert_eq!(fs::read(&target).expect("read target"), replacement);
        assert!(!root.join(".atlas.png.atlas-png-v1.temporary").exists());
        fs::remove_dir_all(root).expect("remove test root");
    }

    fn inject_at(
        actual: AtlasPngCommitPoint,
        requested: AtlasPngCommitPoint,
    ) -> Result<(), NativeError> {
        if actual != requested {
            return Ok(());
        }
        let primitive = match actual {
            AtlasPngCommitPoint::BeforeRename => "test-atlas-png-before-rename",
            AtlasPngCommitPoint::AfterRename => "test-atlas-png-after-rename",
        };
        Err(native_io_error(
            primitive,
            io::Error::other("injected test fault"),
        ))
    }

    fn test_root(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "ttrpg-atlas-png-{label}-{}-{}",
            std::process::id(),
            NEXT_TEST.fetch_add(1, Ordering::Relaxed)
        ))
    }

    fn path_text(path: &Path) -> &str {
        path.to_str().expect("test path is Unicode")
    }
}
