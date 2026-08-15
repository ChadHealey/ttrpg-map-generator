use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;

use ttrpg_map_desktop_lib::mapworld_native::service::{execute_save, snapshot_target};
use ttrpg_map_desktop_lib::mapworld_native::{FaultMode, FaultSpec, ObservationKind};

use super::support::*;

#[test]
fn p14_partial_cleanup_is_preserved_until_exact_confirmation() {
    for occurrence in 1..=9 {
        let directory = TestDirectory::new(&format!("p14-partial-{occurrence}"));
        let target_path = directory.target();
        let old = fixture_request(&target_path, "first-save", None);
        execute_save(&old, None).expect("prepare old target");
        let opened =
            snapshot_target(target_path.to_str().expect("UTF-8 target")).expect("open old target");
        let new = replacement_request(&target_path, &opened, &old);
        let error = execute_save(
            &new,
            Some(FaultSpec {
                point: 14,
                occurrence,
                mode: FaultMode::TerminateAfter,
                hard_terminate: false,
                os_error_number: None,
            }),
        )
        .expect_err("interrupt after one backup cleanup operation");
        assert!(error.primitive.contains("P14"));

        let interrupted = snapshot_target(target_path.to_str().expect("UTF-8 target"))
            .expect("partial cleanup snapshot");
        assert!(observation_matches(&interrupted.target, &new));
        assert!(matches!(
            interrupted.marker.kind,
            ObservationKind::RegularFile(_)
        ));
        assert_eq!(
            interrupted,
            snapshot_target(target_path.to_str().expect("UTF-8 target"))
                .expect("attention state is idempotent")
        );

        let target = target_path.to_str().expect("UTF-8 target");
        let cleaned = match &interrupted.backup.kind {
            ObservationKind::Absent => interrupted,
            ObservationKind::Directory(_) if observation_matches(&interrupted.backup, &old) => {
                let selected = selected_candidate(
                    &interrupted,
                    ttrpg_map_desktop_lib::mapworld_native::ArtifactRole::Target,
                    &new.candidate_manifest_sha256,
                );
                apply_recovery_plan_with_selected(
                    target,
                    &interrupted.snapshot_id,
                    &["remove-backup-exact-previous".to_owned()],
                    &[],
                    &selected,
                )
                .expect("exact Vo cleanup succeeds")
            }
            ObservationKind::Directory(_)
            | ObservationKind::InvalidDirectory { .. }
            | ObservationKind::RegularFile(_) => {
                let confirmation = format!("backup|{}", interrupted.backup.observation_token);
                let selected = selected_candidate(
                    &interrupted,
                    ttrpg_map_desktop_lib::mapworld_native::ArtifactRole::Target,
                    &new.candidate_manifest_sha256,
                );
                apply_recovery_plan_with_selected(
                    target,
                    &interrupted.snapshot_id,
                    &["remove-confirmed-backup".to_owned()],
                    &[confirmation],
                    &selected,
                )
                .expect("candidate-specific partial cleanup succeeds")
            }
            kind => panic!("protocol-created P14 state cannot be resolved: {kind:?}"),
        };
        let finalized = apply_recovery_plan(
            target,
            &cleaned.snapshot_id,
            &["remove-marker".to_owned()],
            &[],
        )
        .expect("marker is removed last");
        assert_clean_target(&finalized, &new);
    }
}

#[test]
fn interrupted_first_and_replacement_plans_recover_idempotently() {
    let first_directory = TestDirectory::new("recover-first");
    let first = fixture_request(&first_directory.target(), "first-save", None);
    execute_save(
        &first,
        Some(FaultSpec {
            point: 10,
            occurrence: 1,
            mode: FaultMode::TerminateAfter,
            hard_terminate: false,
            os_error_number: None,
        }),
    )
    .expect_err("interrupt after W to T");
    let interrupted = snapshot_target(first_directory.target().to_str().expect("UTF-8 target"))
        .expect("discover interrupted first save");
    let recovered = apply_recovery_plan(
        first_directory.target().to_str().expect("UTF-8 target"),
        &interrupted.snapshot_id,
        &["sync-target-commit".to_owned(), "remove-marker".to_owned()],
        &[],
    )
    .expect("recover first save");
    assert_clean_target(&recovered, &first);
    let repeated = apply_recovery_plan(
        first_directory.target().to_str().expect("UTF-8 target"),
        &recovered.snapshot_id,
        &[],
        &[],
    )
    .expect("second first-save recovery is a no-op");
    assert_eq!(recovered, repeated);

    let replacement_directory = TestDirectory::new("recover-replacement");
    let old = fixture_request(&replacement_directory.target(), "first-save", None);
    execute_save(&old, None).expect("prepare replacement old target");
    let opened = snapshot_target(
        replacement_directory
            .target()
            .to_str()
            .expect("UTF-8 target"),
    )
    .expect("open old target");
    let new = replacement_request(&replacement_directory.target(), &opened, &old);
    execute_save(
        &new,
        Some(FaultSpec {
            point: 12,
            occurrence: 1,
            mode: FaultMode::TerminateAfter,
            hard_terminate: false,
            os_error_number: None,
        }),
    )
    .expect_err("interrupt after W to T replacement rename");
    let interrupted = snapshot_target(
        replacement_directory
            .target()
            .to_str()
            .expect("UTF-8 target"),
    )
    .expect("discover interrupted replacement");
    let selected = selected_candidate(
        &interrupted,
        ttrpg_map_desktop_lib::mapworld_native::ArtifactRole::Target,
        &new.candidate_manifest_sha256,
    );
    let recovered = apply_recovery_plan_with_selected(
        replacement_directory
            .target()
            .to_str()
            .expect("UTF-8 target"),
        &interrupted.snapshot_id,
        &[
            "sync-target-commit".to_owned(),
            "remove-backup-exact-previous".to_owned(),
            "remove-marker".to_owned(),
        ],
        &[],
        &selected,
    )
    .expect("recover replacement");
    assert_clean_target(&recovered, &new);
    let repeated = apply_recovery_plan(
        replacement_directory
            .target()
            .to_str()
            .expect("UTF-8 target"),
        &recovered.snapshot_id,
        &[],
        &[],
    )
    .expect("second replacement recovery is a no-op");
    assert_eq!(recovered, repeated);
}

#[test]
fn child_process_lock_contention_and_hard_termination_reopen_smoke() {
    let directory = TestDirectory::new("child-process");
    let sentinel = directory.0.join("lock-ready");
    let executable = std::env::current_exe().expect("test executable");
    let mut holder = Command::new(&executable)
        .args([
            "--exact",
            "recovery_cases::child_process_entry",
            "--nocapture",
        ])
        .env("MAPWORLD_NATIVE_CHILD_MODE", "hold-lock")
        .env("MAPWORLD_NATIVE_TARGET", directory.target())
        .env("MAPWORLD_NATIVE_SENTINEL", &sentinel)
        .stdout(Stdio::null())
        .spawn()
        .expect("spawn lock holder");
    wait_for_path(&sentinel);
    let error = snapshot_target(directory.target().to_str().expect("UTF-8 target"))
        .expect_err("other process holds parent lock");
    assert_eq!(error.code, "persistence.recovery.operation-in-progress");
    holder.kill().expect("kill lock holder");
    holder.wait().expect("reap lock holder");

    let status = Command::new(&executable)
        .args([
            "--exact",
            "recovery_cases::child_process_entry",
            "--nocapture",
        ])
        .env("MAPWORLD_NATIVE_CHILD_MODE", "terminate-save")
        .env("MAPWORLD_NATIVE_TARGET", directory.target())
        .status()
        .expect("spawn terminating saver");
    assert_eq!(status.code(), Some(86));
    let snapshot = snapshot_target(directory.target().to_str().expect("UTF-8 target"))
        .expect("new process reopens after hard termination");
    let candidate = fixture_request(&directory.target(), "first-save", None);
    assert_first_save_invariant(&snapshot, &candidate, 10);
}

#[test]
fn child_process_entry() {
    let Ok(mode) = std::env::var("MAPWORLD_NATIVE_CHILD_MODE") else {
        return;
    };
    let target = PathBuf::from(std::env::var_os("MAPWORLD_NATIVE_TARGET").expect("target env"));
    match mode.as_str() {
        "hold-lock" => {
            let parent = File::open(target.parent().expect("target parent")).expect("open parent");
            parent.try_lock().expect("child acquires lock");
            let sentinel =
                PathBuf::from(std::env::var_os("MAPWORLD_NATIVE_SENTINEL").expect("sentinel env"));
            fs::write(sentinel, b"ready").expect("signal lock readiness");
            thread::sleep(Duration::from_secs(30));
        }
        "terminate-save" => {
            let request = fixture_request(&target, "first-save", None);
            let _ = execute_save(
                &request,
                Some(FaultSpec {
                    point: 10,
                    occurrence: 1,
                    mode: FaultMode::TerminateAfter,
                    hard_terminate: true,
                    os_error_number: None,
                }),
            );
            panic!("hard termination was not injected");
        }
        "matrix-first" => {
            let point = child_number("MAPWORLD_NATIVE_POINT");
            let occurrence = usize::from(child_number("MAPWORLD_NATIVE_OCCURRENCE"));
            let request = fixture_request(&target, "first-save", None);
            execute_save(
                &request,
                Some(FaultSpec {
                    point,
                    occurrence,
                    mode: FaultMode::TerminateAfter,
                    hard_terminate: true,
                    os_error_number: None,
                }),
            )
            .expect("uninjected first-save matrix child completes");
        }
        "matrix-replacement" => {
            let point = child_number("MAPWORLD_NATIVE_POINT");
            let occurrence = usize::from(child_number("MAPWORLD_NATIVE_OCCURRENCE"));
            let old = fixture_request(&target, "first-save", None);
            let opened = snapshot_target(target.to_str().expect("UTF-8 target"))
                .expect("matrix child opens previous target");
            let new = replacement_request(&target, &opened, &old);
            execute_save(
                &new,
                Some(FaultSpec {
                    point,
                    occurrence,
                    mode: FaultMode::TerminateAfter,
                    hard_terminate: true,
                    os_error_number: None,
                }),
            )
            .expect("uninjected replacement matrix child completes");
        }
        _ => panic!("unknown child mode"),
    }
}

pub(crate) fn hard_termination_child(
    target: &Path,
    mode: &str,
    point: u8,
    occurrence: usize,
) -> bool {
    let status = Command::new(std::env::current_exe().expect("test executable"))
        .args([
            "--exact",
            "recovery_cases::child_process_entry",
            "--nocapture",
        ])
        .env("MAPWORLD_NATIVE_CHILD_MODE", mode)
        .env("MAPWORLD_NATIVE_TARGET", target)
        .env("MAPWORLD_NATIVE_POINT", point.to_string())
        .env("MAPWORLD_NATIVE_OCCURRENCE", occurrence.to_string())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .expect("spawn hard-termination matrix child");
    match status.code() {
        Some(86) => true,
        Some(0) => false,
        code => panic!("matrix child exited unexpectedly: {code:?}"),
    }
}

fn child_number(name: &str) -> u8 {
    std::env::var(name)
        .unwrap_or_else(|_| panic!("missing {name}"))
        .parse::<u8>()
        .unwrap_or_else(|_| panic!("invalid {name}"))
}
