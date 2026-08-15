use super::NATIVE_MAX_RECOVERY_STEP_BYTES;
use super::identity::observation;
use super::model::{NativeFileEntry, NativeSnapshot, ObservationKind};
use super::recovery_input::validate_recovery_inputs;
use super::recovery_validation::{require_committed_candidate, validate_step_postcondition};

#[test]
fn rejects_unbounded_or_malformed_recovery_arguments_before_io() {
    let oversized = "x".repeat(NATIVE_MAX_RECOVERY_STEP_BYTES + 1);
    assert_eq!(
        validate_recovery_inputs(&[oversized], &[])
            .expect_err("oversized step")
            .primitive,
        "validate-recovery-plan"
    );
    assert_eq!(
        validate_recovery_inputs(&[], &[format!("temporary|{}|extra", "0".repeat(64))],)
            .expect_err("malformed confirmation")
            .primitive,
        "validate-confirmation-tokens"
    );
    assert!(
        validate_recovery_inputs(
            &["remove-confirmed-temporary".to_owned()],
            &[format!("temporary|{}|{}", "a".repeat(64), "b".repeat(64))],
        )
        .is_ok()
    );
    assert_eq!(
        validate_recovery_inputs(
            &[],
            &[format!("marker|{}|{}", "a".repeat(64), "b".repeat(64))],
        )
        .expect_err("marker tokens cannot carry package fingerprints")
        .primitive,
        "validate-confirmation-tokens"
    );
}

#[test]
fn validates_exact_post_step_transitions_without_adopting_drift() {
    let before = snapshot(package(b"old"), package(b"new"), absent(), marker());
    let after = snapshot(
        absent(),
        before.temporary.clone(),
        before.target.clone(),
        marker(),
    );
    validate_step_postcondition("rename-target-to-backup", &before, &after)
        .expect("exact rename transition");

    let drifted = snapshot(
        absent(),
        package(b"externally changed"),
        before.target.clone(),
        marker(),
    );
    let error = validate_step_postcondition("rename-target-to-backup", &before, &drifted)
        .expect_err("unplanned temporary mutation must not become trusted state");
    assert_eq!(error.code, "persistence.recovery.target-changed");
    assert_eq!(error.role.map(|role| role.as_str()), Some("temporary"));
}

#[test]
fn backup_cleanup_requires_the_exact_prepared_candidate_at_target() {
    let initial = snapshot(package(b"old"), package(b"new"), absent(), marker());
    let committed = snapshot(
        initial.temporary.clone(),
        absent(),
        initial.target.clone(),
        marker(),
    );
    require_committed_candidate(&initial, &committed).expect("exact Vn protects Vo cleanup");

    let stale_old = snapshot(
        initial.target.clone(),
        absent(),
        initial.target.clone(),
        marker(),
    );
    assert_eq!(
        require_committed_candidate(&initial, &stale_old)
            .expect_err("old or drifted target cannot authorize backup deletion")
            .code,
        "persistence.recovery.fingerprint-mismatch"
    );
}

fn snapshot(
    target: super::ArtifactObservation,
    temporary: super::ArtifactObservation,
    backup: super::ArtifactObservation,
    marker: super::ArtifactObservation,
) -> NativeSnapshot {
    NativeSnapshot {
        target_name: "World.mapworld".to_owned(),
        snapshot_id: "0".repeat(64),
        target,
        temporary,
        backup,
        marker,
    }
}

fn package(bytes: &[u8]) -> super::ArtifactObservation {
    observation(ObservationKind::Directory(vec![NativeFileEntry {
        path: "manifest.json".to_owned(),
        bytes: bytes.to_vec(),
    }]))
}

fn absent() -> super::ArtifactObservation {
    observation(ObservationKind::Absent)
}

fn marker() -> super::ArtifactObservation {
    observation(ObservationKind::RegularFile(b"marker".to_vec()))
}
