use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::thread;
use std::time::{Duration, Instant};

use ttrpg_map_desktop_lib::mapworld_native::service::{
    NativeSaveRequest, apply_recovery_plan as apply_native_recovery_plan,
    manifest_fingerprint_bytes,
};
use ttrpg_map_desktop_lib::mapworld_native::{
    ArtifactObservation, ArtifactRole, NativeError, NativeFileEntry, NativeSelectedCandidate,
    NativeSnapshot, ObservationKind,
};

static TEMP_SEQUENCE: AtomicUsize = AtomicUsize::new(0);

pub(crate) struct TestDirectory(pub(crate) PathBuf);

impl TestDirectory {
    pub(crate) fn new(label: &str) -> Self {
        let sequence = TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let repository = Path::new(env!("CARGO_MANIFEST_DIR"))
            .ancestors()
            .nth(3)
            .expect("src-tauri is nested under the repository root");
        let path = repository.join(format!(".native-{label}-{}-{sequence}", std::process::id()));
        fs::create_dir(&path).expect("create test parent");
        Self(path)
    }

    pub(crate) fn target(&self) -> PathBuf {
        self.0.join("World.mapworld")
    }
}

impl Drop for TestDirectory {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).expect("remove test parent");
    }
}

pub(crate) fn fixture_request(
    target: &Path,
    operation: &str,
    expected_previous_manifest_sha256: Option<String>,
) -> NativeSaveRequest {
    assert_eq!(operation, "first-save");
    assert!(expected_previous_manifest_sha256.is_none());
    build_request(target, fixture_files(false), "first-save", None, None)
}

pub(crate) fn replacement_request(
    target: &Path,
    previous: &NativeSnapshot,
    old: &NativeSaveRequest,
) -> NativeSaveRequest {
    build_request(
        target,
        fixture_files(true),
        "replacement-save",
        Some(old.candidate_manifest_sha256.clone()),
        Some(previous.target.observation_token.clone()),
    )
}

fn fixture_files(modified: bool) -> (Vec<String>, Vec<Vec<u8>>) {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../../fixtures/saved-projects/v1/milestone-1-kernel-proof/rerolled.mapworld");
    let relative_paths = vec![
        "manifest.json".to_owned(),
        "maps/a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7.json".to_owned(),
        "world.json".to_owned(),
    ];
    let mut file_bytes = relative_paths
        .iter()
        .map(|path| fs::read(root.join(path)).expect("read fixture file"))
        .collect::<Vec<_>>();
    if modified {
        let old_world = String::from_utf8(file_bytes[2].clone()).expect("world fixture is UTF-8");
        let new_world = old_world.replacen(
            "\"displayName\": \"Milestone 1 kernel proof\"",
            "\"displayName\": \"Milestone 1 kernel proof replacement\"",
            1,
        );
        assert_ne!(old_world, new_world, "fixture display name changed");
        let old_world_hash = manifest_fingerprint_bytes(&file_bytes[2]);
        let new_world_bytes = new_world.into_bytes();
        let new_world_hash = manifest_fingerprint_bytes(&new_world_bytes);
        let old_manifest = String::from_utf8(file_bytes[0].clone()).expect("manifest is UTF-8");
        let new_manifest = old_manifest.replacen(&old_world_hash, &new_world_hash, 1);
        assert_ne!(
            old_manifest, new_manifest,
            "world checksum changed in manifest"
        );
        file_bytes[0] = new_manifest.into_bytes();
        file_bytes[2] = new_world_bytes;
    }
    (relative_paths, file_bytes)
}

fn build_request(
    target: &Path,
    (relative_paths, file_bytes): (Vec<String>, Vec<Vec<u8>>),
    operation: &str,
    previous_fingerprint: Option<String>,
    previous_observation_token: Option<String>,
) -> NativeSaveRequest {
    let fingerprint = manifest_fingerprint_bytes(&file_bytes[0]);
    NativeSaveRequest {
        target_path: target.to_str().expect("UTF-8 target").to_owned(),
        operation: operation.to_owned(),
        expected_previous_manifest_sha256: previous_fingerprint.clone(),
        expected_previous_observation_token: previous_observation_token,
        candidate_manifest_sha256: fingerprint.clone(),
        marker_bytes: marker_bytes(operation, previous_fingerprint.as_deref(), &fingerprint),
        relative_paths,
        file_bytes,
    }
}

pub(crate) fn assert_first_save_invariant(
    snapshot: &NativeSnapshot,
    candidate: &NativeSaveRequest,
    point: u8,
) {
    assert!(
        matches!(snapshot.backup.kind, ObservationKind::Absent),
        "P{point:02} first save created a backup"
    );
    for role in [ArtifactRole::Target, ArtifactRole::Temporary] {
        let observation = snapshot.observation(role);
        if observation_matches(observation, candidate) {
            continue;
        }
        if role == ArtifactRole::Target {
            assert!(
                matches!(observation.kind, ObservationKind::Absent),
                "P{point:02} exposed non-candidate target bytes"
            );
        }
    }
    if point >= 9 {
        assert!(
            [ArtifactRole::Target, ArtifactRole::Temporary]
                .into_iter()
                .any(|role| observation_matches(snapshot.observation(role), candidate)),
            "P{point:02} lost the only fully prepared Vn"
        );
    }
}

pub(crate) fn assert_clean_target(snapshot: &NativeSnapshot, expected: &NativeSaveRequest) {
    assert!(observation_matches(&snapshot.target, expected));
    assert!(matches!(snapshot.temporary.kind, ObservationKind::Absent));
    assert!(matches!(snapshot.backup.kind, ObservationKind::Absent));
    assert!(matches!(snapshot.marker.kind, ObservationKind::Absent));
}

pub(crate) fn assert_replacement_invariant(
    snapshot: &NativeSnapshot,
    previous: &NativeSaveRequest,
    candidate: &NativeSaveRequest,
    point: u8,
) {
    let candidates = [
        ArtifactRole::Target,
        ArtifactRole::Temporary,
        ArtifactRole::Backup,
    ]
    .into_iter()
    .map(|role| {
        (
            role,
            observation_matches(snapshot.observation(role), previous),
            observation_matches(snapshot.observation(role), candidate),
        )
    })
    .collect::<Vec<_>>();
    assert!(
        candidates.iter().any(|(_, old, new)| *old || *new),
        "P{point:02} replacement lost both complete old and new packages: {candidates:?}"
    );
    if point < 14 {
        assert!(
            candidates.iter().any(|(_, old, _)| *old),
            "P{point:02} replacement lost complete Vo before R6: {candidates:?}"
        );
    }
}

pub(crate) fn observation_matches(
    observation: &ArtifactObservation,
    request: &NativeSaveRequest,
) -> bool {
    match &observation.kind {
        ObservationKind::Directory(entries) => *entries == request_entries(request),
        _ => false,
    }
}

pub(crate) fn request_entries(request: &NativeSaveRequest) -> Vec<NativeFileEntry> {
    let mut entries = request
        .relative_paths
        .iter()
        .cloned()
        .zip(request.file_bytes.iter().cloned())
        .map(|(path, bytes)| NativeFileEntry { path, bytes })
        .collect::<Vec<_>>();
    entries.sort_by(|left, right| left.path.cmp(&right.path));
    entries
}

pub(crate) fn materialize_package(path: &Path, request: &NativeSaveRequest) {
    fs::create_dir(path).expect("create package role");
    for entry in request_entries(request) {
        let destination = path.join(&entry.path);
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).expect("create package parents");
        }
        fs::write(destination, entry.bytes).expect("write exact package entry");
    }
}

pub(crate) fn apply_recovery_plan(
    target_path: &str,
    expected_snapshot_id: &str,
    steps: &[String],
    confirmation_tokens: &[String],
) -> Result<NativeSnapshot, NativeError> {
    apply_native_recovery_plan(
        target_path,
        expected_snapshot_id,
        steps,
        confirmation_tokens,
        None,
    )
}

pub(crate) fn selected_candidate(
    snapshot: &NativeSnapshot,
    role: ArtifactRole,
    manifest_sha256: &str,
) -> NativeSelectedCandidate {
    NativeSelectedCandidate {
        role: role.as_str().to_owned(),
        observation_token: snapshot.observation(role).observation_token.clone(),
        manifest_sha256: manifest_sha256.to_owned(),
    }
}

pub(crate) fn apply_recovery_plan_with_selected(
    target_path: &str,
    expected_snapshot_id: &str,
    steps: &[String],
    confirmation_tokens: &[String],
    selected: &NativeSelectedCandidate,
) -> Result<NativeSnapshot, NativeError> {
    apply_native_recovery_plan(
        target_path,
        expected_snapshot_id,
        steps,
        confirmation_tokens,
        Some(selected),
    )
}

pub(crate) fn wait_for_path(path: &Path) {
    let deadline = Instant::now() + Duration::from_secs(5);
    while !path.exists() {
        assert!(
            Instant::now() < deadline,
            "timed out waiting for child process"
        );
        thread::sleep(Duration::from_millis(10));
    }
}

pub(crate) fn filesystem_type(path: &Path) -> String {
    if cfg!(target_os = "macos") {
        let output = Command::new("mount")
            .output()
            .expect("run mount for filesystem evidence");
        assert!(output.status.success(), "mount succeeds");
        let text = String::from_utf8(output.stdout).expect("mount output is UTF-8");
        let target = path.to_string_lossy();
        return text
            .lines()
            .filter_map(|line| {
                let (_, after_device) = line.split_once(" on ")?;
                let (mountpoint, details) = after_device.split_once(" (")?;
                if target == mountpoint
                    || target
                        .strip_prefix(mountpoint)
                        .is_some_and(|suffix| mountpoint == "/" || suffix.starts_with('/'))
                {
                    Some((mountpoint.len(), details.split(',').next()?.to_owned()))
                } else {
                    None
                }
            })
            .max_by_key(|(length, _)| *length)
            .map(|(_, filesystem)| filesystem)
            .unwrap_or_else(|| "unknown".to_owned());
    }
    let output = Command::new("stat")
        .args(["-f", "-c", "%T"])
        .arg(path)
        .output()
        .expect("run stat for evidence");
    assert!(output.status.success(), "stat filesystem type succeeds");
    String::from_utf8(output.stdout)
        .expect("filesystem type is UTF-8")
        .trim()
        .to_owned()
}

pub(crate) fn marker_bytes(operation: &str, previous: Option<&str>, candidate: &str) -> Vec<u8> {
    let previous = previous.map_or_else(|| "null".to_owned(), |value| format!("\"{value}\""));
    format!(
        "{{\n  \"backupName\": \".World.mapworld.commit-v1.backup\",\n  \"candidateManifestSha256\": \"{candidate}\",\n  \"checksumAlgorithm\": \"sha256\",\n  \"operation\": \"{operation}\",\n  \"previousManifestSha256\": {previous},\n  \"protocol\": \"mapworld-directory-commit\",\n  \"protocolVersion\": 1,\n  \"targetName\": \"World.mapworld\",\n  \"temporaryName\": \".World.mapworld.commit-v1.temporary\"\n}}\n"
    )
    .into_bytes()
}

pub(crate) fn package_entries(
    snapshot: &ttrpg_map_desktop_lib::mapworld_native::NativeSnapshot,
) -> Vec<(String, Vec<u8>)> {
    match &snapshot.target.kind {
        ObservationKind::Directory(entries) => entries
            .iter()
            .map(|entry| (entry.path.clone(), entry.bytes.clone()))
            .collect(),
        _ => panic!("target must be a directory"),
    }
}
