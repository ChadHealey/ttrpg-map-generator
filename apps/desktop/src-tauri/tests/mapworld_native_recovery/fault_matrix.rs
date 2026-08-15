use ttrpg_map_desktop_lib::mapworld_native::service::{execute_save, snapshot_target};
use ttrpg_map_desktop_lib::mapworld_native::{FaultMode, FaultSpec};

use super::policy_bridge::PolicyBridge;
use super::recovery_cases::hard_termination_child;
use super::support::*;

#[test]
fn p00_through_p17_error_and_termination_matrix_uses_real_filesystem_operations() {
    let mut policy = PolicyBridge::spawn();
    let first_points = [0_u8, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 17];
    for point in first_points {
        for mode in [FaultMode::ErrorBefore, FaultMode::TerminateAfter] {
            for occurrence in 1_usize..=64 {
                let directory =
                    TestDirectory::new(&format!("first-p{point:02}-{mode:?}-{occurrence}"));
                let request = fixture_request(&directory.target(), "first-save", None);
                let injected = match mode {
                    FaultMode::ErrorBefore => error_before_was_injected(
                        execute_save(
                            &request,
                            Some(FaultSpec {
                                point,
                                occurrence,
                                mode,
                                hard_terminate: false,
                                os_error_number: None,
                            }),
                        ),
                        point,
                    ),
                    FaultMode::TerminateAfter => hard_termination_child(
                        &directory.target(),
                        "matrix-first",
                        point,
                        occurrence,
                    ),
                };
                if !injected {
                    assert!(occurrence > 1, "P{point:02} had no injectable operation");
                    break;
                }
                let snapshot = snapshot_target(directory.target().to_str().expect("UTF-8 target"))
                    .expect("interrupted first save remains enumerable");
                assert_first_save_invariant(&snapshot, &request, point);
                assert_eq!(
                    snapshot,
                    snapshot_target(directory.target().to_str().expect("UTF-8 target"))
                        .expect("repeated first-save discovery is idempotent"),
                    "P{point:02} {mode:?} occurrence {occurrence} discovery drifted"
                );
                let terminal =
                    policy.recover_with_policy(&directory.target(), None, &request, point);
                if point >= 9 {
                    assert_eq!(terminal.kind, "clean", "P{point:02} must auto-recover Vn");
                    assert_eq!(
                        terminal.selected_fingerprint.as_deref(),
                        Some(request.candidate_manifest_sha256.as_str())
                    );
                    assert_clean_target(&terminal.snapshot, &request);
                } else if terminal.kind == "clean"
                    && terminal.selected_fingerprint.as_deref()
                        == Some(request.candidate_manifest_sha256.as_str())
                {
                    assert_clean_target(&terminal.snapshot, &request);
                }
                assert!(
                    occurrence < 64,
                    "P{point:02} occurrence scan did not terminate"
                );
                println!("native-fault-matrix first P{point:02} {mode:?} occurrence={occurrence}");
            }
        }
    }

    for point in 0_u8..=17 {
        for mode in [FaultMode::ErrorBefore, FaultMode::TerminateAfter] {
            for occurrence in 1_usize..=64 {
                let directory =
                    TestDirectory::new(&format!("replace-p{point:02}-{mode:?}-{occurrence}"));
                let old = fixture_request(&directory.target(), "first-save", None);
                execute_save(&old, None).expect("prepare old target");
                let opened = snapshot_target(directory.target().to_str().expect("UTF-8 target"))
                    .expect("open old target");
                let new = replacement_request(&directory.target(), &opened, &old);
                let injected = match mode {
                    FaultMode::ErrorBefore => error_before_was_injected(
                        execute_save(
                            &new,
                            Some(FaultSpec {
                                point,
                                occurrence,
                                mode,
                                hard_terminate: false,
                                os_error_number: None,
                            }),
                        ),
                        point,
                    ),
                    FaultMode::TerminateAfter => hard_termination_child(
                        &directory.target(),
                        "matrix-replacement",
                        point,
                        occurrence,
                    ),
                };
                if !injected {
                    assert!(occurrence > 1, "P{point:02} had no injectable operation");
                    break;
                }
                let snapshot = snapshot_target(directory.target().to_str().expect("UTF-8 target"))
                    .expect("interrupted replacement remains enumerable");
                assert_replacement_invariant(&snapshot, &old, &new, point);
                assert_eq!(
                    snapshot,
                    snapshot_target(directory.target().to_str().expect("UTF-8 target"))
                        .expect("repeated replacement discovery is idempotent"),
                    "P{point:02} {mode:?} occurrence {occurrence} discovery drifted"
                );
                let terminal =
                    policy.recover_with_policy(&directory.target(), Some(&old), &new, point);
                if point >= 9 {
                    assert_eq!(
                        terminal.selected_fingerprint.as_deref(),
                        Some(new.candidate_manifest_sha256.as_str()),
                        "P{point:02} must retain the prepared Vn"
                    );
                    assert!(
                        observation_matches(&terminal.snapshot.target, &new),
                        "P{point:02} did not recover exact Vn at T"
                    );
                    if terminal.kind == "clean" {
                        assert_clean_target(&terminal.snapshot, &new);
                    } else {
                        assert_eq!(terminal.kind, "attention");
                    }
                } else if terminal.kind == "clean" {
                    match terminal.selected_fingerprint.as_deref() {
                        Some(fingerprint) if fingerprint == old.candidate_manifest_sha256 => {
                            assert_clean_target(&terminal.snapshot, &old);
                        }
                        Some(fingerprint) if fingerprint == new.candidate_manifest_sha256 => {
                            assert_clean_target(&terminal.snapshot, &new);
                        }
                        fingerprint => {
                            panic!("P{point:02} clean state selected unknown {fingerprint:?}")
                        }
                    }
                }
                assert!(
                    occurrence < 64,
                    "P{point:02} occurrence scan did not terminate"
                );
                println!(
                    "native-fault-matrix replacement P{point:02} {mode:?} occurrence={occurrence}"
                );
            }
        }
    }
}

fn error_before_was_injected(
    result: Result<
        ttrpg_map_desktop_lib::mapworld_native::NativeSnapshot,
        ttrpg_map_desktop_lib::mapworld_native::NativeError,
    >,
    point: u8,
) -> bool {
    match result {
        Ok(_) => false,
        Err(error) => {
            assert!(
                !error.primitive.is_empty(),
                "P{point:02} returned an error without its primitive: {error:?}"
            );
            assert_eq!(
                error.code,
                if error.primitive.starts_with("sync-") || error.primitive == "probe-parent-sync" {
                    "persistence.recovery.durability-failed"
                } else {
                    "persistence.recovery.io-failed"
                }
            );
            assert_eq!(error.os_error_number, Some(5));
            assert_eq!(error.os_error_name.as_deref(), Some("EIO"));
            true
        }
    }
}
