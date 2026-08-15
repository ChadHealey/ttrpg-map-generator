use std::fs;

use ttrpg_map_desktop_lib::mapworld_native::service::{execute_save, snapshot_target};
use ttrpg_map_desktop_lib::mapworld_native::{ArtifactRole, ObservationKind};

use super::policy_bridge::PolicyBridge;
use super::support::*;

#[test]
fn every_recovery_operation_family_runs_against_real_roles_and_persistence_policy() {
    let mut policy = PolicyBridge::spawn();

    let duplicate = TestDirectory::new("recognized-exact-temporary");
    let first = fixture_request(&duplicate.target(), "first-save", None);
    execute_save(&first, None).expect("save committed target");
    materialize_package(
        &duplicate.0.join(".World.mapworld.commit-v1.temporary"),
        &first,
    );
    fs::write(
        duplicate.0.join(".World.mapworld.commit-v1.json"),
        &first.marker_bytes,
    )
    .expect("restore first-save marker");
    let recovered = policy.recover_with_policy(&duplicate.target(), None, &first, 80);
    assert_eq!(recovered.kind, "clean");
    assert_clean_target(&recovered.snapshot, &first);

    let rollback = TestDirectory::new("recognized-backup-rollback");
    let old = fixture_request(&rollback.target(), "first-save", None);
    execute_save(&old, None).expect("save rollback source");
    let opened = snapshot_target(rollback.target().to_str().expect("UTF-8 target"))
        .expect("open rollback source");
    let new = replacement_request(&rollback.target(), &opened, &old);
    fs::rename(
        rollback.target(),
        rollback.0.join(".World.mapworld.commit-v1.backup"),
    )
    .expect("model durable T to B rename");
    fs::write(
        rollback.0.join(".World.mapworld.commit-v1.json"),
        &new.marker_bytes,
    )
    .expect("write replacement marker");
    let recovered = policy.recover_with_policy(&rollback.target(), Some(&old), &new, 81);
    assert_eq!(recovered.kind, "clean");
    assert_clean_target(&recovered.snapshot, &old);

    let resume = TestDirectory::new("recognized-r2-resume");
    let old = fixture_request(&resume.target(), "first-save", None);
    execute_save(&old, None).expect("save old R2 target");
    let opened = snapshot_target(resume.target().to_str().expect("UTF-8 target"))
        .expect("open old R2 target");
    let new = replacement_request(&resume.target(), &opened, &old);
    materialize_package(&resume.0.join(".World.mapworld.commit-v1.temporary"), &new);
    fs::write(
        resume.0.join(".World.mapworld.commit-v1.json"),
        &new.marker_bytes,
    )
    .expect("write R2 marker");
    let recovered = policy.recover_with_policy(&resume.target(), Some(&old), &new, 82);
    assert_eq!(recovered.kind, "clean");
    assert_clean_target(&recovered.snapshot, &new);

    let empty_backup = TestDirectory::new("recognized-empty-backup");
    let old = fixture_request(&empty_backup.target(), "first-save", None);
    execute_save(&old, None).expect("save old empty-backup target");
    let opened = snapshot_target(empty_backup.target().to_str().expect("UTF-8 target"))
        .expect("open old empty-backup target");
    let new = replacement_request(&empty_backup.target(), &opened, &old);
    execute_save(&new, None).expect("commit new empty-backup target");
    fs::create_dir(empty_backup.0.join(".World.mapworld.commit-v1.backup"))
        .expect("create proven-empty backup");
    fs::write(
        empty_backup.0.join(".World.mapworld.commit-v1.json"),
        &new.marker_bytes,
    )
    .expect("restore replacement marker");
    let recovered = policy.recover_with_policy(&empty_backup.target(), Some(&old), &new, 83);
    assert_eq!(recovered.kind, "clean");
    assert_clean_target(&recovered.snapshot, &new);
}

#[test]
fn confirmed_invalid_target_promotion_is_bound_to_the_exact_selected_survivor() {
    let directory = TestDirectory::new("confirmed-target-promotion");
    let target = directory.target();
    fs::create_dir(&target).expect("create invalid target");
    fs::write(target.join("partial"), b"invalid target").expect("write invalid target");
    let candidate = fixture_request(&target, "first-save", None);
    materialize_package(
        &directory.0.join(".World.mapworld.commit-v1.temporary"),
        &candidate,
    );
    fs::write(
        directory.0.join(".World.mapworld.commit-v1.json"),
        &candidate.marker_bytes,
    )
    .expect("write durability marker");
    let snapshot = snapshot_target(target.to_str().expect("UTF-8 target"))
        .expect("observe confirmation candidates");
    let selected = selected_candidate(
        &snapshot,
        ArtifactRole::Temporary,
        &candidate.candidate_manifest_sha256,
    );
    let confirmation = format!("target|{}", snapshot.target.observation_token);
    let recovered = apply_recovery_plan_with_selected(
        target.to_str().expect("UTF-8 target"),
        &snapshot.snapshot_id,
        &[
            "remove-confirmed-target".to_owned(),
            "rename-temporary-to-target".to_owned(),
            "sync-target-commit".to_owned(),
            "remove-marker".to_owned(),
        ],
        &[confirmation],
        &selected,
    )
    .expect("exact selected survivor authorizes promotion");
    assert_clean_target(&recovered, &candidate);
    assert!(matches!(recovered.backup.kind, ObservationKind::Absent));
}
