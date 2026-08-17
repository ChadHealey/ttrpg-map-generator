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

pub const ATLAS_SVG_MAXIMUM_BYTES: usize = 32 * 1_024 * 1_024;
const MAXIMUM_TARGET_PATH_BYTES: usize = 4_096;

struct AtlasSvgNames {
    target_path: String,
    parent_path: PathBuf,
    target: OsString,
    temporary: OsString,
}

#[tauri::command]
pub fn atlas_svg_write_base64(
    target_path: String,
    svg_base64: String,
    expected_sha256: String,
) -> String {
    let bytes = match decode_canonical_base64(&svg_base64, ATLAS_SVG_MAXIMUM_BYTES) {
        Ok(bytes) if !bytes.is_empty() => bytes,
        _ => return invalid_request("decode-atlas-svg-base64").to_json(),
    };
    if !valid_sha256(&expected_sha256) || sha256_hex(&bytes) != expected_sha256 {
        return NativeError::new(
            "atlas-svg.native.fingerprint-mismatch",
            "validate-atlas-svg-fingerprint",
            None,
            "canonical SVG bytes do not match the expected SHA-256",
        )
        .to_json();
    }
    match write_atlas_svg(&target_path, &bytes, &expected_sha256) {
        Ok(receipt) => receipt,
        Err(error) => error.to_json(),
    }
}

fn write_atlas_svg(
    target_path: &str,
    bytes: &[u8],
    expected_sha256: &str,
) -> Result<String, NativeError> {
    if bytes.is_empty() || bytes.len() > ATLAS_SVG_MAXIMUM_BYTES || !valid_sha256(expected_sha256) {
        return Err(invalid_request("validate-atlas-svg-request"));
    }
    let names = AtlasSvgNames::derive(target_path)?;
    let parent = platform_ffi::open_parent(names.parent_path.as_os_str())
        .map_err(|error| native_io_error("open-atlas-svg-parent", error))?;
    match parent.try_lock() {
        Ok(()) => {}
        Err(TryLockError::WouldBlock) => {
            return Err(NativeError::new(
                "atlas-svg.native.artifact-conflict",
                "lock-atlas-svg-parent",
                None,
                "another cooperating filesystem operation holds the destination directory lock",
            ));
        }
        Err(TryLockError::Error(error)) => {
            return Err(native_io_error("lock-atlas-svg-parent", error));
        }
    }
    validate_target(&parent, &names.target)?;
    require_absent(&parent, &names.temporary)?;
    platform_ffi::sync_descriptor(&parent)
        .map_err(|error| native_io_error("probe-atlas-svg-parent-sync", error))?;

    let result = prepare_and_commit(&parent, &names, bytes, expected_sha256);
    if result.is_err() {
        let _ = platform_ffi::unlink_file_at(&parent, &names.temporary);
        let _ = platform_ffi::sync_descriptor(&parent);
    }
    result
}

fn prepare_and_commit(
    parent: &File,
    names: &AtlasSvgNames,
    bytes: &[u8],
    expected_sha256: &str,
) -> Result<String, NativeError> {
    let mut temporary = platform_ffi::create_regular_at(parent, &names.temporary)
        .map_err(|error| native_io_error("create-atlas-svg-temporary", error))?;
    temporary
        .write_all(bytes)
        .map_err(|error| native_io_error("write-atlas-svg-temporary", error))?;
    platform_ffi::sync_descriptor(&temporary)
        .and_then(|()| platform_ffi::full_sync(&temporary))
        .map_err(|error| native_io_error("sync-atlas-svg-temporary", error))?;
    drop(temporary);
    verify_file(
        parent,
        &names.temporary,
        bytes.len(),
        expected_sha256,
        "temporary",
    )?;
    platform_ffi::sync_descriptor(parent)
        .map_err(|error| native_io_error("sync-atlas-svg-prepared-entry", error))?;
    platform_ffi::rename_replace(parent, &names.temporary, &names.target)
        .map_err(|error| native_io_error("rename-atlas-svg-into-place", error))?;
    platform_ffi::sync_descriptor(parent)
        .map_err(|error| native_io_error("sync-atlas-svg-committed-entry", error))?;
    verify_file(
        parent,
        &names.target,
        bytes.len(),
        expected_sha256,
        "target",
    )?;
    Ok(format!(
        "{{\"ok\":true,\"result\":{{\"kind\":\"atlas-svg-written\",\"targetPath\":{},\"sha256\":{},\"byteLength\":{},\"platform\":{}}}}}",
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
        .map_err(|error| native_io_error(format!("reopen-atlas-svg-{label}"), error))?;
    let metadata = file
        .metadata()
        .map_err(|error| native_io_error(format!("metadata-atlas-svg-{label}"), error))?;
    if !metadata.is_file() {
        return Err(NativeError::new(
            "atlas-svg.native.artifact-conflict",
            format!("metadata-atlas-svg-{label}"),
            None,
            "atlas SVG readback is not a regular file",
        ));
    }
    let bytes = read_bounded(&mut file, ATLAS_SVG_MAXIMUM_BYTES)
        .map_err(|error| native_io_error(format!("readback-atlas-svg-{label}"), error))?;
    if bytes.len() != expected_length || sha256_hex(&bytes) != expected_sha256 {
        return Err(NativeError::new(
            "atlas-svg.native.fingerprint-mismatch",
            format!("verify-atlas-svg-{label}"),
            None,
            "atlas SVG readback differs from the validated canonical bytes",
        ));
    }
    Ok(())
}

fn validate_target(parent: &File, target: &OsStr) -> Result<(), NativeError> {
    match platform_ffi::is_symlink_at(parent, target) {
        Ok(true) => Err(artifact_conflict(
            "validate-atlas-svg-target",
            "the SVG destination is a symbolic link",
        )),
        Ok(false) => {
            let file = platform_ffi::open_regular_at(parent, target).map_err(|_| {
                artifact_conflict(
                    "validate-atlas-svg-target",
                    "the existing SVG destination is not a readable regular file",
                )
            })?;
            let metadata = file
                .metadata()
                .map_err(|error| native_io_error("metadata-atlas-svg-target", error))?;
            if metadata.is_file() {
                Ok(())
            } else {
                Err(artifact_conflict(
                    "validate-atlas-svg-target",
                    "the existing SVG destination is not a regular file",
                ))
            }
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(native_io_error("inspect-atlas-svg-target", error)),
    }
}

fn require_absent(parent: &File, name: &OsStr) -> Result<(), NativeError> {
    match platform_ffi::is_symlink_at(parent, name) {
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Ok(_) => Err(artifact_conflict(
            "validate-atlas-svg-temporary",
            "a previous atlas SVG temporary artifact requires cleanup before retrying",
        )),
        Err(error) => Err(native_io_error("inspect-atlas-svg-temporary", error)),
    }
}

impl AtlasSvgNames {
    fn derive(target_path: &str) -> Result<Self, NativeError> {
        if target_path.is_empty()
            || target_path.contains('\0')
            || target_path.len() > MAXIMUM_TARGET_PATH_BYTES
        {
            return Err(invalid_request("validate-atlas-svg-target-path"));
        }
        let path = Path::new(target_path);
        let target = path
            .file_name()
            .ok_or_else(|| invalid_request("validate-atlas-svg-target-name"))?;
        let target_text = target
            .to_str()
            .ok_or_else(|| invalid_request("validate-atlas-svg-target-name"))?;
        if target_text == "."
            || target_text == ".."
            || !target_text.ends_with(".svg")
            || target_text.len() > NATIVE_MAX_BASENAME_BYTES
        {
            return Err(invalid_request("validate-atlas-svg-target-name"));
        }
        let temporary_text = format!(".{target_text}.atlas-svg-v1.temporary");
        if temporary_text.len() > NATIVE_MAX_BASENAME_BYTES {
            return Err(invalid_request("validate-atlas-svg-temporary-name"));
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
        "atlas-svg.native.invalid-request",
        primitive,
        None,
        "choose a valid lowercase .svg destination and canonical bytes within the 32 MiB limit",
    )
}

fn artifact_conflict(primitive: &'static str, message: &'static str) -> NativeError {
    NativeError::new(
        "atlas-svg.native.artifact-conflict",
        primitive,
        None,
        message,
    )
}

fn native_io_error(primitive: impl Into<String>, error: io::Error) -> NativeError {
    NativeError::from_io("atlas-svg.native.io-failed", primitive, None, error)
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::sync::atomic::{AtomicUsize, Ordering};

    use super::*;

    static NEXT_TEST: AtomicUsize = AtomicUsize::new(0);

    #[test]
    fn atomically_writes_replaces_and_verifies_svg_bytes() {
        let root = test_root("replace");
        fs::create_dir(&root).expect("create test root");
        let target = root.join("atlas.svg");
        let first = b"<svg>first</svg>\n";
        let second = b"<svg>second</svg>\n";

        write_atlas_svg(path_text(&target), first, &sha256_hex(first)).expect("first write");
        write_atlas_svg(path_text(&target), second, &sha256_hex(second)).expect("replacement");

        assert_eq!(fs::read(&target).expect("read target"), second);
        assert!(!root.join(".atlas.svg.atlas-svg-v1.temporary").exists());
        fs::remove_dir_all(root).expect("remove test root");
    }

    #[test]
    fn rejects_a_mismatched_fingerprint_without_replacing_the_target() {
        let root = test_root("fingerprint");
        fs::create_dir(&root).expect("create test root");
        let target = root.join("atlas.svg");
        fs::write(&target, b"accepted").expect("write accepted target");

        let error = write_atlas_svg(path_text(&target), b"replacement", &"0".repeat(64))
            .expect_err("fingerprint mismatch");

        assert_eq!(error.code, "atlas-svg.native.fingerprint-mismatch");
        assert_eq!(fs::read(&target).expect("read target"), b"accepted");
        fs::remove_dir_all(root).expect("remove test root");
    }

    #[test]
    fn rejects_directory_and_symlink_destinations_without_replacing_them() {
        let root = test_root("special-targets");
        fs::create_dir(&root).expect("create test root");
        let bytes = b"<svg/>\n";
        let digest = sha256_hex(bytes);

        let directory_target = root.join("directory.svg");
        fs::create_dir(&directory_target).expect("create directory target");
        let directory_error = write_atlas_svg(path_text(&directory_target), bytes, &digest)
            .expect_err("directory destination");
        assert_eq!(directory_error.code, "atlas-svg.native.artifact-conflict");
        assert!(directory_target.is_dir());

        let accepted = root.join("accepted.txt");
        fs::write(&accepted, b"accepted").expect("write symlink source");
        let symlink_target = root.join("symlink.svg");
        std::os::unix::fs::symlink(&accepted, &symlink_target).expect("create symlink target");
        let symlink_error = write_atlas_svg(path_text(&symlink_target), bytes, &digest)
            .expect_err("symlink destination");
        assert_eq!(symlink_error.code, "atlas-svg.native.artifact-conflict");
        assert_eq!(
            fs::read(&accepted).expect("read symlink source"),
            b"accepted"
        );

        fs::remove_dir_all(root).expect("remove test root");
    }

    fn test_root(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "ttrpg-atlas-svg-{label}-{}-{}",
            std::process::id(),
            NEXT_TEST.fetch_add(1, Ordering::Relaxed)
        ))
    }

    fn path_text(path: &Path) -> &str {
        path.to_str().expect("test path is Unicode")
    }
}
