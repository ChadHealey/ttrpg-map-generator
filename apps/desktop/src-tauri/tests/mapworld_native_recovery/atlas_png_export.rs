use std::fs;
use std::path::{Path, PathBuf};

use ttrpg_map_desktop_lib::mapworld_native::atlas_png::atlas_png_write_base64;
use ttrpg_map_desktop_lib::mapworld_native::service::manifest_fingerprint_bytes;

use super::support::TestDirectory;

const BASE64_ALPHABET: &[u8; 64] =
    b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const FIRST_PNG: &[u8] = include_bytes!("../../icons/32x32.png");
const SECOND_PNG: &[u8] = include_bytes!("../../icons/128x128.png");

#[test]
fn public_command_atomically_writes_replaces_and_reads_back_png_bytes() {
    let directory = TestDirectory::new("atlas-png-public-replace");
    let target = directory.0.join("atlas.png");

    let first = invoke(&target, FIRST_PNG, &digest(FIRST_PNG));
    assert_success(&first, &target, FIRST_PNG);
    assert_eq!(fs::read(&target).expect("read first PNG"), FIRST_PNG);
    assert!(!temporary_path(&target).exists());

    let second = invoke(&target, SECOND_PNG, &digest(SECOND_PNG));
    assert_success(&second, &target, SECOND_PNG);
    assert_eq!(fs::read(&target).expect("read replacement PNG"), SECOND_PNG);
    assert!(!temporary_path(&target).exists());
}

#[test]
fn public_command_preserves_target_for_fingerprint_and_invalid_requests() {
    let directory = TestDirectory::new("atlas-png-public-invalid");
    let target = directory.0.join("atlas.png");
    assert_success(
        &invoke(&target, FIRST_PNG, &digest(FIRST_PNG)),
        &target,
        FIRST_PNG,
    );

    let fingerprint_error = invoke(&target, SECOND_PNG, &"0".repeat(64));
    assert_error(
        &fingerprint_error,
        "atlas-png.native.fingerprint-mismatch",
        "validate-atlas-png-fingerprint",
    );
    assert_eq!(fs::read(&target).expect("read preserved PNG"), FIRST_PNG);
    assert!(!temporary_path(&target).exists());

    let invalid_error = atlas_png_write_base64(
        path_text(&target).to_owned(),
        "not-canonical-base64".to_owned(),
        digest(SECOND_PNG),
    );
    assert_error(
        &invalid_error,
        "atlas-png.native.invalid-request",
        "decode-atlas-png-base64",
    );
    assert_eq!(fs::read(&target).expect("read preserved PNG"), FIRST_PNG);
    assert!(!temporary_path(&target).exists());
}

#[test]
fn public_command_rejects_directory_and_symlink_conflicts() {
    let directory = TestDirectory::new("atlas-png-public-conflicts");
    let directory_target = directory.0.join("directory.png");
    fs::create_dir(&directory_target).expect("create directory conflict");

    let directory_error = invoke(&directory_target, FIRST_PNG, &digest(FIRST_PNG));
    assert_error(
        &directory_error,
        "atlas-png.native.artifact-conflict",
        "validate-atlas-png-target",
    );
    assert!(directory_target.is_dir());
    assert!(!temporary_path(&directory_target).exists());

    let accepted = directory.0.join("accepted.bin");
    fs::write(&accepted, b"accepted bytes").expect("write symlink source");
    let symlink_target = directory.0.join("symlink.png");
    std::os::unix::fs::symlink(&accepted, &symlink_target).expect("create symlink conflict");

    let symlink_error = invoke(&symlink_target, SECOND_PNG, &digest(SECOND_PNG));
    assert_error(
        &symlink_error,
        "atlas-png.native.artifact-conflict",
        "validate-atlas-png-target",
    );
    assert!(
        fs::symlink_metadata(&symlink_target)
            .expect("inspect symlink")
            .file_type()
            .is_symlink()
    );
    assert_eq!(
        fs::read(&accepted).expect("read symlink source"),
        b"accepted bytes"
    );
    assert!(!temporary_path(&symlink_target).exists());
}

#[test]
fn recognizable_interrupted_temporary_requires_safe_cleanup_before_retry() {
    let directory = TestDirectory::new("atlas-png-public-retry");
    let target = directory.0.join("atlas.png");
    assert_success(
        &invoke(&target, FIRST_PNG, &digest(FIRST_PNG)),
        &target,
        FIRST_PNG,
    );
    let temporary = temporary_path(&target);
    let interrupted = b"\x89PNG\r\n\x1a\ninterrupted-before-replace";
    fs::write(&temporary, interrupted).expect("materialize interrupted temporary");

    let conflict = invoke(&target, SECOND_PNG, &digest(SECOND_PNG));
    assert_error(
        &conflict,
        "atlas-png.native.artifact-conflict",
        "validate-atlas-png-temporary",
    );
    assert_eq!(fs::read(&target).expect("read old target"), FIRST_PNG);
    assert_eq!(
        fs::read(&temporary).expect("read stale temporary"),
        interrupted
    );

    let stale_metadata = fs::symlink_metadata(&temporary).expect("inspect stale temporary");
    assert!(stale_metadata.is_file() && !stale_metadata.file_type().is_symlink());
    fs::remove_file(&temporary).expect("remove exact recognizable regular-file temporary");

    let retry = invoke(&target, SECOND_PNG, &digest(SECOND_PNG));
    assert_success(&retry, &target, SECOND_PNG);
    assert_eq!(fs::read(&target).expect("read retried target"), SECOND_PNG);
    assert!(!temporary.exists());
}

fn invoke(target: &Path, png: &[u8], expected_sha256: &str) -> String {
    atlas_png_write_base64(
        path_text(target).to_owned(),
        encode_base64(png),
        expected_sha256.to_owned(),
    )
}

fn assert_success(response: &str, target: &Path, png: &[u8]) {
    assert!(
        response.contains("\"ok\":true"),
        "unexpected response: {response}"
    );
    assert!(
        response.contains("\"kind\":\"atlas-png-written\""),
        "unexpected response: {response}"
    );
    assert!(response.contains(&format!("\"sha256\":\"{}\"", digest(png))));
    assert!(response.contains(&format!("\"byteLength\":{}", png.len())));
    assert!(response.contains(path_text(target)));
}

fn assert_error(response: &str, code: &str, primitive: &str) {
    assert!(
        response.contains("\"ok\":false"),
        "unexpected response: {response}"
    );
    assert!(response.contains(&format!("\"code\":\"{code}\"")));
    assert!(response.contains(&format!("\"primitive\":\"{primitive}\"")));
}

fn temporary_path(target: &Path) -> PathBuf {
    let name = target
        .file_name()
        .expect("target filename")
        .to_string_lossy();
    target.with_file_name(format!(".{name}.atlas-png-v1.temporary"))
}

fn digest(bytes: &[u8]) -> String {
    manifest_fingerprint_bytes(bytes)
}

fn path_text(path: &Path) -> &str {
    path.to_str().expect("test path is UTF-8")
}

fn encode_base64(bytes: &[u8]) -> String {
    let mut encoded = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let first = chunk[0];
        let second = chunk.get(1).copied().unwrap_or(0);
        let third = chunk.get(2).copied().unwrap_or(0);
        encoded.push(char::from(BASE64_ALPHABET[usize::from(first >> 2)]));
        encoded.push(char::from(
            BASE64_ALPHABET[usize::from(((first & 3) << 4) | (second >> 4))],
        ));
        encoded.push(if chunk.len() > 1 {
            char::from(BASE64_ALPHABET[usize::from(((second & 15) << 2) | (third >> 6))])
        } else {
            '='
        });
        encoded.push(if chunk.len() > 2 {
            char::from(BASE64_ALPHABET[usize::from(third & 63)])
        } else {
            '='
        });
    }
    encoded
}
