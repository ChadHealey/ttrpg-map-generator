use std::fs::{self, File};
use std::process::Command;

use ttrpg_map_desktop_lib::mapworld_native::service::{execute_save, snapshot_target};
use ttrpg_map_desktop_lib::mapworld_native::{ArtifactRole, ObservationKind};

use super::support::*;

#[test]
fn first_save_uses_real_durable_syscalls_and_reopens_exact_bytes() {
    println!(
        "mapworld-native-platform={}",
        if cfg!(target_os = "macos") {
            "macos"
        } else {
            "linux"
        }
    );
    let directory = TestDirectory::new("first-save");
    let filesystem = filesystem_type(&directory.0);
    println!("mapworld-native-filesystem={filesystem}");
    if cfg!(target_os = "macos") {
        assert_eq!(filesystem, "apfs", "macOS native gate requires local APFS");
    }
    let request = fixture_request(&directory.target(), "first-save", None);
    let saved = execute_save(&request, None).expect("first save succeeds");

    assert!(matches!(saved.target.kind, ObservationKind::Directory(_)));
    assert!(matches!(saved.temporary.kind, ObservationKind::Absent));
    assert!(matches!(saved.backup.kind, ObservationKind::Absent));
    assert!(matches!(saved.marker.kind, ObservationKind::Absent));
    let reopened = snapshot_target(directory.target().to_str().expect("UTF-8 target"))
        .expect("reopen succeeds");
    assert_eq!(saved, reopened);
    assert_eq!(package_entries(&reopened), {
        let mut entries = request
            .relative_paths
            .iter()
            .cloned()
            .zip(request.file_bytes.iter().cloned())
            .collect::<Vec<_>>();
        entries.sort_by(|left, right| left.0.cmp(&right.0));
        entries
    });
}

#[test]
fn replacement_preserves_new_package_and_cleans_protocol_artifacts() {
    let directory = TestDirectory::new("replacement");
    let old = fixture_request(&directory.target(), "first-save", None);
    execute_save(&old, None).expect("initial save succeeds");
    let previous = snapshot_target(directory.target().to_str().expect("UTF-8 target"))
        .expect("previous snapshot");
    let new = replacement_request(&directory.target(), &previous, &old);

    let saved = execute_save(&new, None).expect("replacement succeeds");
    assert!(observation_matches(&saved.target, &new));
    assert!(matches!(saved.temporary.kind, ObservationKind::Absent));
    assert!(matches!(saved.backup.kind, ObservationKind::Absent));
    assert!(matches!(saved.marker.kind, ObservationKind::Absent));
}

#[test]
fn snapshot_does_not_follow_role_symlinks_or_accept_wrong_kinds() {
    use std::os::unix::fs::symlink;

    let directory = TestDirectory::new("nofollow");
    fs::create_dir(directory.0.join("outside")).expect("create symlink target");
    symlink(
        directory.0.join("outside"),
        directory.0.join(".World.mapworld.commit-v1.temporary"),
    )
    .expect("create role symlink");
    fs::write(
        directory.0.join(".World.mapworld.commit-v1.backup"),
        b"wrong kind",
    )
    .expect("create wrong-kind file");

    let snapshot = snapshot_target(directory.target().to_str().expect("UTF-8 target"))
        .expect("snapshot succeeds");
    assert!(matches!(snapshot.temporary.kind, ObservationKind::Symlink));
    assert!(matches!(
        snapshot.backup.kind,
        ObservationKind::RegularFile(_)
    ));
}

#[test]
fn nested_symlink_special_fifo_and_no_replace_collision_fail_closed() {
    use std::os::unix::fs::symlink;

    let directory = TestDirectory::new("k");
    let temporary = directory.0.join(".World.mapworld.commit-v1.temporary");
    fs::create_dir(&temporary).expect("create temporary");
    fs::create_dir(temporary.join("maps")).expect("create maps");
    symlink(
        directory.0.join("outside"),
        temporary.join("maps/linked.json"),
    )
    .expect("create nested symlink");
    Command::new("mkfifo")
        .arg(directory.0.join(".World.mapworld.commit-v1.backup"))
        .status()
        .expect("run mkfifo")
        .success()
        .then_some(())
        .expect("mkfifo succeeds");
    fs::create_dir(directory.0.join(".World.mapworld.commit-v1.json"))
        .expect("create wrong-kind marker directory");

    let snapshot = snapshot_target(directory.target().to_str().expect("UTF-8 target"))
        .expect("snapshot adversarial roles");
    assert!(matches!(
        snapshot.temporary.kind,
        ObservationKind::Unreadable(_)
    ));
    assert!(matches!(snapshot.backup.kind, ObservationKind::Special));
    assert!(matches!(snapshot.marker.kind, ObservationKind::Special));

    for role in [ArtifactRole::Temporary, ArtifactRole::Backup] {
        let error = apply_recovery_plan(
            directory.target().to_str().expect("UTF-8 target"),
            &snapshot.snapshot_id,
            &[format!("remove-confirmed-{}", role.as_str())],
            &[format!(
                "{}|{}",
                role.as_str(),
                snapshot.observation(role).observation_token
            )],
        )
        .expect_err("protocol cleanup rejects unreadable and special artifacts");
        assert_eq!(error.code, "persistence.recovery.artifact-conflict");
    }
    assert!(temporary.join("maps/linked.json").is_symlink());
    assert!(
        directory
            .0
            .join(".World.mapworld.commit-v1.backup")
            .exists()
    );

    fs::remove_file(directory.0.join(".World.mapworld.commit-v1.backup"))
        .expect("remove test fifo");
    fs::remove_dir(directory.0.join(".World.mapworld.commit-v1.json"))
        .expect("remove test marker directory");
    fs::remove_dir_all(&temporary).expect("replace temporary test state");
    fs::create_dir(&temporary).expect("create rename source");
    fs::write(temporary.join("manifest.json"), b"source\n").expect("write source");
    fs::create_dir(directory.target()).expect("create occupied target");
    fs::write(directory.target().join("manifest.json"), b"destination\n")
        .expect("write destination");
    let collision = snapshot_target(directory.target().to_str().expect("UTF-8 target"))
        .expect("snapshot collision");
    let error = apply_recovery_plan(
        directory.target().to_str().expect("UTF-8 target"),
        &collision.snapshot_id,
        &["rename-temporary-to-target".to_owned()],
        &[],
    )
    .expect_err("occupied no-replace destination fails closed");
    assert_eq!(error.code, "persistence.recovery.artifact-conflict");
    assert_eq!(
        fs::read(directory.target().join("manifest.json")).expect("target preserved"),
        b"destination\n"
    );
    assert_eq!(
        fs::read(temporary.join("manifest.json")).expect("source preserved"),
        b"source\n"
    );
}

#[test]
fn undeclared_cache_directory_is_preserved_as_attention_state() {
    let directory = TestDirectory::new("cache-attention");
    let request = fixture_request(&directory.target(), "first-save", None);
    execute_save(&request, None).expect("create authoritative package");
    let temporary = directory.0.join(".World.mapworld.commit-v1.temporary");
    fs::create_dir(&temporary).expect("create temporary");
    fs::create_dir(temporary.join("cache")).expect("create undeclared cache directory");
    fs::write(
        temporary.join("cache/derived.bin"),
        b"disposable-but-undeclared",
    )
    .expect("write cache entry");

    let snapshot = snapshot_target(directory.target().to_str().expect("UTF-8 target"))
        .expect("snapshot cache artifact");
    assert!(matches!(
        snapshot.temporary.kind,
        ObservationKind::InvalidDirectory { .. }
    ));
    assert!(temporary.join("cache/derived.bin").exists());
    assert_eq!(
        snapshot,
        snapshot_target(directory.target().to_str().expect("UTF-8 target"))
            .expect("repeated attention snapshot")
    );
    let confirmation = format!("temporary|{}", snapshot.temporary.observation_token);
    let error = apply_recovery_plan(
        directory.target().to_str().expect("UTF-8 target"),
        &snapshot.snapshot_id,
        &["remove-confirmed-temporary".to_owned()],
        std::slice::from_ref(&confirmation),
    )
    .expect_err("confirmation alone cannot authorize non-empty cleanup");
    assert_eq!(error.code, "persistence.recovery.confirmation-required");
    assert!(temporary.join("cache/derived.bin").exists());
    let selected = selected_candidate(
        &snapshot,
        ArtifactRole::Target,
        &request.candidate_manifest_sha256,
    );
    let cleaned = apply_recovery_plan_with_selected(
        directory.target().to_str().expect("UTF-8 target"),
        &snapshot.snapshot_id,
        &["remove-confirmed-temporary".to_owned()],
        &[confirmation],
        &selected,
    )
    .expect("exact confirmation removes only the captured invalid cache tree");
    assert!(matches!(cleaned.temporary.kind, ObservationKind::Absent));
}

#[test]
fn oversized_directory_enumeration_and_cleanup_fail_bounded_before_mutation() {
    let directory = TestDirectory::new("bounded-enumeration");
    let temporary = directory.0.join(".World.mapworld.commit-v1.temporary");
    fs::create_dir(&temporary).expect("create temporary");
    fs::write(temporary.join("manifest.json"), b"{}\n").expect("write cleanup anchor");
    for index in 0..512 {
        fs::write(temporary.join(format!("entry-{index:03}")), []).expect("write bounded entry");
    }

    let snapshot = snapshot_target(directory.target().to_str().expect("UTF-8 target"))
        .expect("snapshot oversized directory");
    assert!(matches!(
        snapshot.temporary.kind,
        ObservationKind::Unreadable(_)
    ));
    let confirmation = format!("temporary|{}", snapshot.temporary.observation_token);
    let error = apply_recovery_plan(
        directory.target().to_str().expect("UTF-8 target"),
        &snapshot.snapshot_id,
        &["remove-confirmed-temporary".to_owned()],
        &[confirmation],
    )
    .expect_err("oversized cleanup must fail before mutation");
    assert_eq!(error.code, "persistence.recovery.artifact-conflict");
    assert_eq!(
        fs::read_dir(&temporary)
            .expect("temporary preserved")
            .count(),
        513
    );
}

#[test]
fn apply_revalidates_stale_snapshots_and_requires_exact_confirmation() {
    let directory = TestDirectory::new("apply");
    let request = fixture_request(&directory.target(), "first-save", None);
    execute_save(&request, None).expect("create authoritative package");
    let temporary = directory.0.join(".World.mapworld.commit-v1.temporary");
    fs::create_dir(&temporary).expect("create temporary");
    fs::write(temporary.join("partial"), b"partial").expect("create partial file");
    let snapshot = snapshot_target(directory.target().to_str().expect("UTF-8 target"))
        .expect("snapshot succeeds");

    let error = apply_recovery_plan(
        directory.target().to_str().expect("UTF-8 target"),
        &snapshot.snapshot_id,
        &["remove-confirmed-temporary".to_owned()],
        &[],
    )
    .expect_err("confirmation is required");
    assert_eq!(error.code, "persistence.recovery.confirmation-required");

    fs::write(temporary.join("changed"), b"changed").expect("mutate after snapshot");
    let error = apply_recovery_plan(
        directory.target().to_str().expect("UTF-8 target"),
        &snapshot.snapshot_id,
        &[],
        &[],
    )
    .expect_err("stale snapshot must fail");
    assert_eq!(error.code, "persistence.recovery.target-changed");

    fs::write(
        directory.0.join(".World.mapworld.commit-v1.json"),
        &request.marker_bytes,
    )
    .expect("create marker requiring candidate-specific confirmation");
    let current = snapshot_target(directory.target().to_str().expect("UTF-8 target"))
        .expect("current snapshot succeeds");
    let confirmation = format!(
        "temporary|{}",
        current
            .observation(ArtifactRole::Temporary)
            .observation_token
    );
    let selected = selected_candidate(
        &current,
        ArtifactRole::Target,
        &request.candidate_manifest_sha256,
    );
    let cleaned = apply_recovery_plan_with_selected(
        directory.target().to_str().expect("UTF-8 target"),
        &current.snapshot_id,
        &["remove-confirmed-temporary".to_owned()],
        &[confirmation],
        &selected,
    )
    .expect("confirmed cleanup succeeds");
    assert!(matches!(cleaned.temporary.kind, ObservationKind::Absent));
    let marker_confirmation = format!("marker|{}", cleaned.marker.observation_token);
    let finalized = apply_recovery_plan(
        directory.target().to_str().expect("UTF-8 target"),
        &cleaned.snapshot_id,
        &["remove-confirmed-marker".to_owned()],
        &[marker_confirmation],
    )
    .expect("confirmed marker cleanup succeeds");
    assert!(matches!(finalized.marker.kind, ObservationKind::Absent));
}

#[test]
fn empty_cleanup_requires_and_uses_an_ordinary_file_durability_anchor() {
    let directory = TestDirectory::new("empty-cleanup-anchor");
    let temporary = directory.0.join(".World.mapworld.commit-v1.temporary");
    fs::create_dir(&temporary).expect("create empty temporary");
    let without_anchor = snapshot_target(directory.target().to_str().expect("UTF-8 target"))
        .expect("snapshot empty temporary");
    #[cfg(target_os = "macos")]
    {
        let error = apply_recovery_plan(
            directory.target().to_str().expect("UTF-8 target"),
            &without_anchor.snapshot_id,
            &["remove-temporary-empty".to_owned()],
            &[],
        )
        .expect_err("macOS cleanup without a full-sync anchor fails closed");
        assert_eq!(error.code, "persistence.recovery.durability-unsupported");
        assert!(temporary.is_dir());
    }
    #[cfg(target_os = "linux")]
    {
        let cleaned = apply_recovery_plan(
            directory.target().to_str().expect("UTF-8 target"),
            &without_anchor.snapshot_id,
            &["remove-temporary-empty".to_owned()],
            &[],
        )
        .expect("Linux directory fsync needs no F_FULLFSYNC anchor");
        assert!(matches!(cleaned.temporary.kind, ObservationKind::Absent));
        fs::create_dir(&temporary).expect("recreate temporary for anchored path");
    }

    let request = fixture_request(&directory.target(), "first-save", None);
    fs::write(
        directory.0.join(".World.mapworld.commit-v1.json"),
        &request.marker_bytes,
    )
    .expect("create marker anchor");
    let anchored = snapshot_target(directory.target().to_str().expect("UTF-8 target"))
        .expect("snapshot anchored cleanup");
    let cleaned = apply_recovery_plan(
        directory.target().to_str().expect("UTF-8 target"),
        &anchored.snapshot_id,
        &[
            "remove-temporary-empty".to_owned(),
            "remove-marker".to_owned(),
        ],
        &[],
    )
    .expect("marker anchors durable empty cleanup");
    assert!(matches!(cleaned.temporary.kind, ObservationKind::Absent));
    assert!(matches!(cleaned.marker.kind, ObservationKind::Absent));
}

#[test]
fn confirmed_cleanup_never_removes_the_persistence_selected_package() {
    let directory = TestDirectory::new("only-package");
    let request = fixture_request(&directory.target(), "first-save", None);
    let saved = execute_save(&request, None).expect("create only valid package");
    let fingerprintless_confirmation = format!("target|{}", saved.target.observation_token);
    let error = apply_recovery_plan(
        directory.target().to_str().expect("UTF-8 target"),
        &saved.snapshot_id,
        &["remove-confirmed-target".to_owned()],
        &[fingerprintless_confirmation],
    )
    .expect_err("fingerprintless confirmation cannot remove a package-shaped directory");
    assert_eq!(error.code, "persistence.recovery.confirmation-required");
    assert!(observation_matches(
        &snapshot_target(directory.target().to_str().expect("UTF-8 target"))
            .expect("package remains after fingerprintless confirmation")
            .target,
        &request,
    ));
    let wrong_fingerprint = format!(
        "target|{}|{}",
        saved.target.observation_token,
        "0".repeat(64)
    );
    let error = apply_recovery_plan(
        directory.target().to_str().expect("UTF-8 target"),
        &saved.snapshot_id,
        &["remove-confirmed-target".to_owned()],
        &[wrong_fingerprint],
    )
    .expect_err("confirmation fingerprint must match current manifest bytes");
    assert_eq!(error.code, "persistence.recovery.confirmation-required");
    let confirmation = format!(
        "target|{}|{}",
        saved.target.observation_token, request.candidate_manifest_sha256
    );
    let selected = selected_candidate(
        &saved,
        ArtifactRole::Target,
        &request.candidate_manifest_sha256,
    );
    let error = apply_recovery_plan_with_selected(
        directory.target().to_str().expect("UTF-8 target"),
        &saved.snapshot_id,
        &["remove-confirmed-target".to_owned()],
        &[confirmation],
        &selected,
    )
    .expect_err("selected package cannot be deleted");
    assert_eq!(error.code, "persistence.recovery.fingerprint-mismatch");
    assert!(observation_matches(
        &snapshot_target(directory.target().to_str().expect("UTF-8 target"))
            .expect("package remains")
            .target,
        &request,
    ));
}

#[test]
fn cooperating_parent_lock_contention_has_the_stable_code() {
    let directory = TestDirectory::new("lock");
    let parent = File::open(&directory.0).expect("open parent");
    parent.try_lock().expect("hold parent lock");

    let error = snapshot_target(directory.target().to_str().expect("UTF-8 target"))
        .expect_err("second operation must not acquire lock");
    assert_eq!(error.code, "persistence.recovery.operation-in-progress");
}
