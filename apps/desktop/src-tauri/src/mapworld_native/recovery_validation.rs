use super::adapter_error::{artifact_conflict, fingerprint_error};
use super::model::{
    ArtifactObservation, ArtifactRole, NativeError, NativeSelectedCandidate, NativeSnapshot,
    ObservationKind,
};
use super::recovery_input::is_sha256;
use super::save_plan::manifest_fingerprint;

pub(crate) fn validate_selected_candidate(
    snapshot: &NativeSnapshot,
    selected: Option<&NativeSelectedCandidate>,
) -> Result<(), NativeError> {
    let Some(selected) = selected else {
        return Ok(());
    };
    let Some(role) = ArtifactRole::parse(&selected.role) else {
        return Err(artifact_conflict(
            "validate-selected-candidate",
            ArtifactRole::Target,
            "selected candidate role is not recognized",
        ));
    };
    if role == ArtifactRole::Marker
        || !is_sha256(&selected.observation_token)
        || !is_sha256(&selected.manifest_sha256)
    {
        return Err(artifact_conflict(
            "validate-selected-candidate",
            role,
            "selected candidate identity is malformed",
        ));
    }
    let observation = snapshot.observation(role);
    if observation.observation_token != selected.observation_token
        || manifest_fingerprint_for(observation).as_deref()
            != Some(selected.manifest_sha256.as_str())
    {
        return Err(fingerprint_error(
            "validate-selected-candidate",
            role,
            "selected candidate does not match the immutable native snapshot",
        ));
    }
    Ok(())
}

pub(crate) fn require_selected_survivor(
    snapshot: &NativeSnapshot,
    removed: ArtifactRole,
    selected: Option<&NativeSelectedCandidate>,
) -> Result<(), NativeError> {
    let Some(selected) = selected else {
        return Err(NativeError::new(
            "persistence.recovery.confirmation-required",
            "require-selected-survivor",
            Some(removed),
            "non-empty package cleanup requires an exact selected survivor",
        ));
    };
    let survives = [
        ArtifactRole::Target,
        ArtifactRole::Temporary,
        ArtifactRole::Backup,
    ]
    .into_iter()
    .filter(|role| *role != removed)
    .any(|role| {
        let observation = snapshot.observation(role);
        observation.observation_token == selected.observation_token
            && manifest_fingerprint_for(observation).as_deref()
                == Some(selected.manifest_sha256.as_str())
    });
    if survives {
        Ok(())
    } else {
        Err(fingerprint_error(
            "require-selected-survivor",
            removed,
            "the persistence-selected survivor is absent or changed",
        ))
    }
}

fn manifest_fingerprint_for(observation: &ArtifactObservation) -> Option<String> {
    match &observation.kind {
        ObservationKind::Directory(entries) if !entries.is_empty() => manifest_fingerprint(entries),
        _ => None,
    }
}

pub(crate) fn require_exact_target_duplicate(
    current: &NativeSnapshot,
    expected: &ArtifactObservation,
) -> Result<(), NativeError> {
    if current.target == *expected && is_nonempty_directory(&current.target) {
        Ok(())
    } else {
        Err(fingerprint_error(
            "revalidate-temporary-duplicate-target",
            ArtifactRole::Target,
            "temporary cleanup requires a byte-identical committed target",
        ))
    }
}

pub(crate) fn require_committed_candidate(
    initial: &NativeSnapshot,
    current: &NativeSnapshot,
) -> Result<(), NativeError> {
    let target = &current.target;
    let expected = if is_nonempty_directory(&initial.temporary) {
        &initial.temporary
    } else {
        &initial.target
    };
    if is_nonempty_directory(target) && target == expected {
        Ok(())
    } else {
        Err(fingerprint_error(
            "revalidate-committed-target",
            ArtifactRole::Target,
            "backup cleanup requires the exact committed candidate at the target role",
        ))
    }
}

pub(crate) fn validate_step_postcondition(
    step: &str,
    before: &NativeSnapshot,
    after: &NativeSnapshot,
) -> Result<(), NativeError> {
    let effect = step_effect(step);
    for role in ArtifactRole::ALL {
        let valid = match effect {
            StepEffect::NoChange => after.observation(role) == before.observation(role),
            StepEffect::Rename { from, to: _ } if role == from => {
                matches!(after.observation(role).kind, ObservationKind::Absent)
            }
            StepEffect::Rename { from, to } if role == to => {
                after.observation(role) == before.observation(from)
            }
            StepEffect::Remove(removed) if role == removed => {
                matches!(after.observation(role).kind, ObservationKind::Absent)
            }
            StepEffect::Rename { .. } | StepEffect::Remove(_) => {
                after.observation(role) == before.observation(role)
            }
        };
        if !valid {
            return Err(NativeError::new(
                "persistence.recovery.target-changed",
                "revalidate-step-postcondition",
                Some(role),
                "filesystem state changed beyond the exact planned recovery operation",
            ));
        }
    }
    Ok(())
}

fn is_nonempty_directory(observation: &ArtifactObservation) -> bool {
    matches!(&observation.kind, ObservationKind::Directory(entries) if !entries.is_empty())
}

#[derive(Clone, Copy)]
enum StepEffect {
    NoChange,
    Rename {
        from: ArtifactRole,
        to: ArtifactRole,
    },
    Remove(ArtifactRole),
}

fn step_effect(step: &str) -> StepEffect {
    match step {
        "rename-temporary-to-target" => StepEffect::Rename {
            from: ArtifactRole::Temporary,
            to: ArtifactRole::Target,
        },
        "rename-target-to-backup" => StepEffect::Rename {
            from: ArtifactRole::Target,
            to: ArtifactRole::Backup,
        },
        "rename-backup-to-target" => StepEffect::Rename {
            from: ArtifactRole::Backup,
            to: ArtifactRole::Target,
        },
        "remove-temporary-exact-candidate"
        | "remove-temporary-empty"
        | "remove-confirmed-temporary" => StepEffect::Remove(ArtifactRole::Temporary),
        "remove-backup-exact-previous" | "remove-backup-empty" | "remove-confirmed-backup" => {
            StepEffect::Remove(ArtifactRole::Backup)
        }
        "remove-confirmed-target" => StepEffect::Remove(ArtifactRole::Target),
        "remove-marker" | "remove-confirmed-marker" => StepEffect::Remove(ArtifactRole::Marker),
        _ => StepEffect::NoChange,
    }
}
