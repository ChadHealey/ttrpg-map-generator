use std::fs;

use ttrpg_map_desktop_lib::mapworld_native::service::snapshot_target;
use ttrpg_map_desktop_lib::mapworld_native::{ArtifactRole, ObservationKind};

use super::support::*;

#[test]
fn case_colliding_role_names_are_conflicts_only_when_the_filesystem_aliases_them() {
    let mut aliased_roles = 0;
    for role in ArtifactRole::ALL {
        let directory = TestDirectory::new(&format!("case-collision-{}", role.as_str()));
        if cfg!(target_os = "macos") {
            assert_eq!(filesystem_type(&directory.0), "apfs");
        }
        let exact = exact_role_path(&directory, role);
        let colliding = colliding_role_path(&directory, role);
        if role == ArtifactRole::Marker {
            fs::write(&colliding, b"case-colliding-marker").expect("create marker alias");
        } else {
            fs::create_dir(&colliding).expect("create package alias");
            fs::write(colliding.join("sentinel"), b"preserve-me")
                .expect("write package alias sentinel");
        }

        let filesystem_aliases_name = exact.exists();
        aliased_roles += usize::from(filesystem_aliases_name);
        let target = directory.target();
        let snapshot = snapshot_target(target.to_str().expect("UTF-8 target"))
            .expect("observe case-colliding role");
        let observed = snapshot.observation(role);
        if filesystem_aliases_name {
            match &observed.kind {
                ObservationKind::Unreadable(context) => {
                    assert_eq!(context.primitive, "verify-exact-artifact-name");
                    assert_eq!(context.os_error_number, None);
                    assert_eq!(context.os_error_name, None);
                }
                kind => panic!("aliased role was not an unreadable name conflict: {kind:?}"),
            }
        } else {
            assert!(matches!(observed.kind, ObservationKind::Absent));
        }

        let confirmation = format!("{}|{}", role.as_str(), observed.observation_token);
        let error = apply_recovery_plan(
            target.to_str().expect("UTF-8 target"),
            &snapshot.snapshot_id,
            &[confirmed_removal_step(role).to_owned()],
            &[confirmation],
        )
        .expect_err("a case-colliding or absent role is never protocol-removable");
        assert_eq!(error.code, "persistence.recovery.artifact-conflict");
        assert_eq!(
            snapshot,
            snapshot_target(target.to_str().expect("UTF-8 target"))
                .expect("case-colliding state remains stable")
        );
        if role == ArtifactRole::Marker {
            assert_eq!(
                fs::read(&colliding).expect("marker alias remains"),
                b"case-colliding-marker"
            );
        } else {
            assert_eq!(
                fs::read(colliding.join("sentinel")).expect("package alias remains"),
                b"preserve-me"
            );
        }
    }
    println!("mapworld-native-case-aliased-roles={aliased_roles}");
}

#[test]
fn exact_name_verification_fails_closed_when_the_parent_scan_exceeds_its_bound() {
    let directory = TestDirectory::new("parent-name-bound");
    let temporary = exact_role_path(&directory, ArtifactRole::Temporary);
    fs::create_dir(&temporary).expect("create exact temporary role");
    fs::write(temporary.join("sentinel"), b"preserve-me").expect("write role sentinel");
    for index in 0..4_096 {
        fs::write(directory.0.join(format!("unrelated-{index:04}")), [])
            .expect("create bounded parent entry");
    }

    let snapshot = snapshot_target(directory.target().to_str().expect("UTF-8 target"))
        .expect("bounded parent enumeration returns a stable snapshot");
    match &snapshot.temporary.kind {
        ObservationKind::Unreadable(context) => {
            assert_eq!(context.primitive, "enumerate-parent-artifact-names");
            assert_eq!(context.os_error_number, None);
            assert_eq!(context.os_error_name, None);
        }
        kind => panic!("over-bound parent was not preserved as unreadable: {kind:?}"),
    }
    assert_eq!(
        fs::read(temporary.join("sentinel")).expect("exact role remains"),
        b"preserve-me"
    );
}

fn exact_role_path(directory: &TestDirectory, role: ArtifactRole) -> std::path::PathBuf {
    directory.0.join(match role {
        ArtifactRole::Target => "World.mapworld",
        ArtifactRole::Temporary => ".World.mapworld.commit-v1.temporary",
        ArtifactRole::Backup => ".World.mapworld.commit-v1.backup",
        ArtifactRole::Marker => ".World.mapworld.commit-v1.json",
    })
}

fn colliding_role_path(directory: &TestDirectory, role: ArtifactRole) -> std::path::PathBuf {
    let exact = exact_role_path(directory, role);
    let name = exact
        .file_name()
        .and_then(|value| value.to_str())
        .expect("test role name is UTF-8")
        .replacen("World", "world", 1);
    directory.0.join(name)
}

fn confirmed_removal_step(role: ArtifactRole) -> &'static str {
    match role {
        ArtifactRole::Target => "remove-confirmed-target",
        ArtifactRole::Temporary => "remove-confirmed-temporary",
        ArtifactRole::Backup => "remove-confirmed-backup",
        ArtifactRole::Marker => "remove-confirmed-marker",
    }
}
