use ttrpg_map_desktop_lib::mapworld_native::service::{execute_save, snapshot_target};
use ttrpg_map_desktop_lib::mapworld_native::{ArtifactRole, FaultMode, FaultSpec, ObservationKind};

use super::support::*;

#[test]
fn named_os_errors_preserve_exact_immediate_state_and_context() {
    for (number, name, point, occurrence, primitive, role) in [
        (
            28,
            "ENOSPC",
            5_u8,
            2_usize,
            "write-authoritative-file",
            ArtifactRole::Temporary,
        ),
        (
            13,
            "EACCES",
            4,
            1,
            "mkdir-temporary",
            ArtifactRole::Temporary,
        ),
        (
            30,
            "EROFS",
            4,
            1,
            "mkdir-temporary",
            ArtifactRole::Temporary,
        ),
        (
            18,
            "EXDEV",
            10,
            1,
            "rename-no-replace",
            ArtifactRole::Target,
        ),
    ] {
        let directory = TestDirectory::new(&format!("errno-{name}"));
        let old = fixture_request(&directory.target(), "first-save", None);
        execute_save(&old, None).expect("prepare durable Vo");
        let opened =
            snapshot_target(directory.target().to_str().expect("UTF-8 target")).expect("open Vo");
        let new = replacement_request(&directory.target(), &opened, &old);
        let error = execute_save(
            &new,
            Some(FaultSpec {
                point,
                occurrence,
                mode: FaultMode::ErrorBefore,
                hard_terminate: false,
                os_error_number: Some(number),
            }),
        )
        .expect_err("named adapter error is injected");
        assert_eq!(error.code, "persistence.recovery.io-failed");
        assert_eq!(error.primitive, primitive);
        assert_eq!(error.role, Some(role));
        assert_eq!(error.os_error_number, Some(number));
        assert_eq!(error.os_error_name.as_deref(), Some(name));
        let immediate = snapshot_target(directory.target().to_str().expect("UTF-8 target"))
            .expect("enumerate exact immediate state");
        assert!(observation_matches(&immediate.target, &old));
        assert!(matches!(immediate.backup.kind, ObservationKind::Absent));
        assert!(matches!(
            immediate.marker.kind,
            ObservationKind::RegularFile(_)
        ));
        match point {
            4 => assert!(matches!(immediate.temporary.kind, ObservationKind::Absent)),
            5 => match &immediate.temporary.kind {
                ObservationKind::InvalidDirectory {
                    entries,
                    directories,
                } => {
                    assert_eq!(directories.len(), 1);
                    assert_eq!(directories[0], "maps");
                    assert_eq!(entries.len(), 1);
                    assert_eq!(entries[0].path, "manifest.json");
                    assert!(entries[0].bytes.is_empty());
                }
                kind => panic!("{name} left unexpected temporary state: {kind:?}"),
            },
            10 => assert!(observation_matches(&immediate.temporary, &new)),
            _ => unreachable!("named error point is fixed by the test table"),
        }
    }
}

#[test]
fn sync_and_unsupported_capability_failures_use_durability_codes() {
    let directory = TestDirectory::new("sync-eio");
    let request = fixture_request(&directory.target(), "first-save", None);
    let error = execute_save(
        &request,
        Some(FaultSpec {
            point: 2,
            occurrence: 1,
            mode: FaultMode::ErrorBefore,
            hard_terminate: false,
            os_error_number: Some(5),
        }),
    )
    .expect_err("sync EIO is injected");
    assert_eq!(error.code, "persistence.recovery.durability-failed");
    assert_eq!(error.primitive, "sync-marker");
    assert_eq!(error.role, Some(ArtifactRole::Marker));
    assert_eq!(error.os_error_number, Some(5));
    assert_eq!(error.os_error_name.as_deref(), Some("EIO"));
    let failed_sync = snapshot_target(directory.target().to_str().expect("UTF-8 target"))
        .expect("enumerate failed sync");
    assert!(matches!(failed_sync.target.kind, ObservationKind::Absent));
    assert!(matches!(
        failed_sync.temporary.kind,
        ObservationKind::Absent
    ));
    assert!(matches!(failed_sync.backup.kind, ObservationKind::Absent));
    assert!(matches!(
        failed_sync.marker.kind,
        ObservationKind::RegularFile(_)
    ));

    let unsupported_number = if cfg!(target_os = "macos") { 45 } else { 95 };
    let unsupported_name = if cfg!(target_os = "macos") {
        "ENOTSUP"
    } else {
        "EOPNOTSUPP"
    };
    let preflight = TestDirectory::new("unsupported-preflight");
    let first = fixture_request(&preflight.target(), "first-save", None);
    let error = execute_save(
        &first,
        Some(FaultSpec {
            point: 0,
            occurrence: 1,
            mode: FaultMode::ErrorBefore,
            hard_terminate: false,
            os_error_number: Some(unsupported_number),
        }),
    )
    .expect_err("unsupported preflight fails closed");
    assert_eq!(error.code, "persistence.recovery.durability-unsupported");
    assert_eq!(error.primitive, "probe-parent-sync");
    assert_eq!(error.role, None);
    assert_eq!(error.os_error_number, Some(unsupported_number));
    assert_eq!(error.os_error_name.as_deref(), Some(unsupported_name));
    let unchanged = snapshot_target(preflight.target().to_str().expect("UTF-8 target"))
        .expect("unsupported preflight leaves no artifacts");
    assert!(matches!(unchanged.target.kind, ObservationKind::Absent));
    assert!(matches!(unchanged.temporary.kind, ObservationKind::Absent));
    assert!(matches!(unchanged.backup.kind, ObservationKind::Absent));
    assert!(matches!(unchanged.marker.kind, ObservationKind::Absent));

    let no_replace = TestDirectory::new("unsupported-no-replace-probe");
    let first = fixture_request(&no_replace.target(), "first-save", None);
    let error = execute_save(
        &first,
        Some(FaultSpec {
            point: 0,
            occurrence: 2,
            mode: FaultMode::ErrorBefore,
            hard_terminate: false,
            os_error_number: Some(unsupported_number),
        }),
    )
    .expect_err("unsupported no-replace probe fails closed");
    assert_eq!(error.code, "persistence.recovery.durability-unsupported");
    assert_eq!(error.primitive, "rename-no-replace");
    assert_eq!(error.role, Some(ArtifactRole::Target));
    assert_eq!(error.os_error_number, Some(unsupported_number));
    assert_eq!(error.os_error_name.as_deref(), Some(unsupported_name));
    let unchanged = snapshot_target(no_replace.target().to_str().expect("UTF-8 target"))
        .expect("unsupported no-replace leaves no artifacts");
    assert!(matches!(unchanged.target.kind, ObservationKind::Absent));
    assert!(matches!(unchanged.temporary.kind, ObservationKind::Absent));
    assert!(matches!(unchanged.backup.kind, ObservationKind::Absent));
    assert!(matches!(unchanged.marker.kind, ObservationKind::Absent));

    let replacement = TestDirectory::new("unsupported-rename");
    let old = fixture_request(&replacement.target(), "first-save", None);
    execute_save(&old, None).expect("prepare old package");
    let opened = snapshot_target(replacement.target().to_str().expect("UTF-8 target"))
        .expect("open old package");
    let new = replacement_request(&replacement.target(), &opened, &old);
    let error = execute_save(
        &new,
        Some(FaultSpec {
            point: 10,
            occurrence: 1,
            mode: FaultMode::ErrorBefore,
            hard_terminate: false,
            os_error_number: Some(unsupported_number),
        }),
    )
    .expect_err("unsupported no-replace fails before rename");
    assert_eq!(error.code, "persistence.recovery.durability-unsupported");
    assert_eq!(error.primitive, "rename-no-replace");
    assert_eq!(error.role, Some(ArtifactRole::Target));
    assert_eq!(error.os_error_number, Some(unsupported_number));
    assert_eq!(error.os_error_name.as_deref(), Some(unsupported_name));
    let preserved = snapshot_target(replacement.target().to_str().expect("UTF-8 target"))
        .expect("unsupported rename preserves both versions");
    assert!(observation_matches(&preserved.target, &old));
    assert!(observation_matches(&preserved.temporary, &new));
    assert!(matches!(preserved.backup.kind, ObservationKind::Absent));
}

#[test]
fn injected_eintr_retries_the_real_write_seam() {
    let directory = TestDirectory::new("write-eintr");
    let request = fixture_request(&directory.target(), "first-save", None);
    let saved = execute_save(
        &request,
        Some(FaultSpec {
            point: 5,
            occurrence: 2,
            mode: FaultMode::ErrorBefore,
            hard_terminate: false,
            os_error_number: Some(4),
        }),
    )
    .expect("EINTR is retried at the authoritative write seam");
    assert_clean_target(&saved, &request);
}
