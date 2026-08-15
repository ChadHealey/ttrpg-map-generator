use std::ffi::OsStr;
use std::fs::File;
use std::os::unix::ffi::OsStrExt;

use super::filesystem::ParentSession;
use super::identity::observation;
use super::model::{ArtifactObservation, ArtifactRole, ObservationKind, OsContext};
use super::platform_ffi;

/// Bind every resolved protocol role to the exact raw basename present in the open parent.
pub(crate) fn verified_artifact_observations(session: &ParentSession) -> [ArtifactObservation; 4] {
    verify_exact_artifact_names(
        &session.parent,
        ArtifactRole::ALL.map(|role| session.names.role_name(role)),
        ArtifactRole::ALL.map(|role| session.raw_observe(role)),
    )
}

fn verify_exact_artifact_names(
    parent: &File,
    expected_names: [&OsStr; 4],
    observations: [ArtifactObservation; 4],
) -> [ArtifactObservation; 4] {
    if observations
        .iter()
        .all(|observed| matches!(observed.kind, ObservationKind::Absent))
    {
        return observations;
    }
    let parent_names = match platform_ffi::list_parent_directory(parent) {
        Ok(names) => names,
        Err(error) => {
            let context = OsContext::from_io("enumerate-parent-artifact-names", &error);
            return observations.map(|observed| unreadable_if_present(observed, &context));
        }
    };
    let exact = expected_names.map(|expected| {
        parent_names
            .iter()
            .any(|actual| actual.as_slice() == expected.as_bytes())
    });
    let [target, temporary, backup, marker] = observations;
    [
        verify_one(target, exact[0]),
        verify_one(temporary, exact[1]),
        verify_one(backup, exact[2]),
        verify_one(marker, exact[3]),
    ]
}

fn verify_one(observed: ArtifactObservation, exact_name_present: bool) -> ArtifactObservation {
    if matches!(observed.kind, ObservationKind::Absent) || exact_name_present {
        observed
    } else {
        observation(ObservationKind::Unreadable(OsContext::synthetic(
            "verify-exact-artifact-name",
        )))
    }
}

fn unreadable_if_present(
    observed: ArtifactObservation,
    context: &OsContext,
) -> ArtifactObservation {
    if matches!(observed.kind, ObservationKind::Absent) {
        observed
    } else {
        observation(ObservationKind::Unreadable(context.clone()))
    }
}
