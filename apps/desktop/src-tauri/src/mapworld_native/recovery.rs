use std::ffi::OsStr;
use std::fs::File;
use std::io;

use super::adapter_error::{
    artifact_conflict, cleanup_error, durability_error, fingerprint_error, io_error, rename_error,
};
use super::filesystem::ParentSession;
use super::model::{
    ArtifactObservation, ArtifactRole, NativeError, NativeSelectedCandidate, NativeSnapshot,
    ObservationKind,
};
use super::platform_ffi;
use super::recovery_durability::durabilize_promotion_source;
use super::recovery_input::{is_sha256, validate_recovery_inputs};
use super::recovery_validation::{
    require_committed_candidate, require_exact_target_duplicate, require_selected_survivor,
    validate_selected_candidate, validate_step_postcondition,
};
use super::save_plan::manifest_fingerprint;

pub fn apply_recovery_plan(
    target_path: &str,
    expected_snapshot_id: &str,
    steps: &[String],
    confirmation_tokens: &[String],
    selected_candidate: Option<&NativeSelectedCandidate>,
) -> Result<NativeSnapshot, NativeError> {
    validate_recovery_inputs(steps, confirmation_tokens)?;
    if !is_sha256(expected_snapshot_id) {
        return Err(NativeError::new(
            "persistence.recovery.fingerprint-mismatch",
            "validate-snapshot-id",
            None,
            "expected snapshot ID is not lowercase SHA-256",
        ));
    }
    let session = ParentSession::open_locked(target_path)?;
    let initial = session.snapshot();
    if initial.snapshot_id != expected_snapshot_id {
        return Err(NativeError::new(
            "persistence.recovery.target-changed",
            "revalidate-snapshot",
            None,
            "filesystem artifacts changed after recovery planning",
        ));
    }
    validate_selected_candidate(&initial, selected_candidate)?;
    let mut tracked = initial.clone();
    for step in steps {
        let current = session.snapshot();
        if current.snapshot_id != tracked.snapshot_id {
            return Err(NativeError::new(
                "persistence.recovery.target-changed",
                "revalidate-plan-step",
                None,
                "filesystem artifacts changed while applying the recovery plan",
            ));
        }
        apply_step(
            &session,
            &initial,
            &current,
            step,
            confirmation_tokens,
            selected_candidate,
        )?;
        let after = session.snapshot();
        validate_step_postcondition(step, &current, &after)?;
        tracked = after;
    }
    Ok(tracked)
}

fn apply_step(
    session: &ParentSession,
    initial: &NativeSnapshot,
    current: &NativeSnapshot,
    step: &str,
    confirmations: &[String],
    selected_candidate: Option<&NativeSelectedCandidate>,
) -> Result<(), NativeError> {
    match step {
        "sync-target-commit" => parent_barrier(session, ArtifactRole::Target),
        "rename-temporary-to-target" => rename_revalidated(
            session,
            current,
            ArtifactRole::Temporary,
            ArtifactRole::Target,
            ArtifactRole::Target,
        ),
        "rename-target-to-backup" => rename_revalidated(
            session,
            current,
            ArtifactRole::Target,
            ArtifactRole::Backup,
            ArtifactRole::Temporary,
        ),
        "rename-backup-to-target" => rename_revalidated(
            session,
            current,
            ArtifactRole::Backup,
            ArtifactRole::Target,
            ArtifactRole::Target,
        ),
        "remove-temporary-exact-candidate" => {
            require_exact_target_duplicate(current, &initial.temporary)?;
            require_selected_survivor(current, ArtifactRole::Temporary, selected_candidate)?;
            remove_exact(
                session,
                current,
                &initial.temporary,
                ArtifactRole::Temporary,
                false,
            )
        }
        "remove-backup-exact-previous" => {
            require_committed_candidate(initial, current)?;
            require_selected_survivor(current, ArtifactRole::Backup, selected_candidate)?;
            remove_exact(
                session,
                current,
                if matches!(initial.backup.kind, ObservationKind::Directory(_)) {
                    &initial.backup
                } else {
                    &initial.target
                },
                ArtifactRole::Backup,
                false,
            )
        }
        "remove-temporary-empty" => remove_empty(session, current, ArtifactRole::Temporary),
        "remove-backup-empty" => {
            require_committed_candidate(initial, current)?;
            remove_empty(session, current, ArtifactRole::Backup)
        }
        "remove-marker" => remove_marker(session, current),
        "remove-confirmed-target" => remove_confirmed(
            session,
            current,
            ArtifactRole::Target,
            confirmations,
            selected_candidate,
        ),
        "remove-confirmed-temporary" => remove_confirmed(
            session,
            current,
            ArtifactRole::Temporary,
            confirmations,
            selected_candidate,
        ),
        "remove-confirmed-backup" => remove_confirmed(
            session,
            current,
            ArtifactRole::Backup,
            confirmations,
            selected_candidate,
        ),
        "remove-confirmed-marker" => remove_confirmed_marker(session, current, confirmations),
        _ => Err(NativeError::new(
            "persistence.recovery.artifact-conflict",
            "validate-recovery-step",
            None,
            format!("unsupported native recovery step: {step}"),
        )),
    }
}

fn remove_marker(session: &ParentSession, current: &NativeSnapshot) -> Result<(), NativeError> {
    let marker = current.observation(ArtifactRole::Marker);
    if !matches!(marker.kind, ObservationKind::RegularFile(_)) {
        return Err(artifact_conflict(
            "remove-marker",
            ArtifactRole::Marker,
            "marker is not a regular file",
        ));
    }
    if !matches!(current.temporary.kind, ObservationKind::Absent)
        || !matches!(current.backup.kind, ObservationKind::Absent)
    {
        return Err(artifact_conflict(
            "remove-marker-last",
            ArtifactRole::Marker,
            "marker cleanup requires temporary and backup artifacts to be absent",
        ));
    }
    let anchor = if matches!(current.target.kind, ObservationKind::Directory(_)) {
        open_role_anchor(session, ArtifactRole::Target).map_err(|error| {
            durability_error(
                "open-committed-target-anchor",
                Some(ArtifactRole::Target),
                error,
            )
        })?
    } else if matches!(current.target.kind, ObservationKind::Absent) {
        session
            .open_role_regular(ArtifactRole::Marker)
            .map_err(|error| io_error("open-marker-anchor", Some(ArtifactRole::Marker), error))?
    } else {
        return Err(NativeError::new(
            "persistence.recovery.durability-unsupported",
            "select-marker-removal-anchor",
            Some(ArtifactRole::Target),
            "marker removal requires a committed target manifest or an absent target with J open",
        ));
    };
    session
        .remove_marker()
        .map_err(|error| io_error("remove-marker", Some(ArtifactRole::Marker), error))?;
    session
        .sync_parent()
        .and_then(|()| platform_ffi::full_sync(&anchor))
        .map_err(|error| durability_error("sync-parent-after-marker", None, error))
}

fn parent_barrier(session: &ParentSession, anchor: ArtifactRole) -> Result<(), NativeError> {
    session
        .sync_parent()
        .and_then(|()| session.full_sync_role_anchor(anchor))
        .map_err(|error| durability_error("sync-parent-barrier", Some(anchor), error))
}

fn rename_revalidated(
    session: &ParentSession,
    current: &NativeSnapshot,
    from: ArtifactRole,
    to: ArtifactRole,
    barrier_anchor: ArtifactRole,
) -> Result<(), NativeError> {
    if !matches!(
        current.observation(from).kind,
        ObservationKind::Directory(_)
    ) || !matches!(current.observation(to).kind, ObservationKind::Absent)
    {
        return Err(artifact_conflict(
            "rename-no-replace",
            from,
            "rename source is not a package directory or destination is occupied",
        ));
    }
    if to == ArtifactRole::Target {
        durabilize_promotion_source(session, current, from)?;
    }
    session
        .rename(from, to)
        .map_err(|error| rename_error(from, error))?;
    parent_barrier(session, barrier_anchor)
}

fn remove_exact(
    session: &ParentSession,
    current: &NativeSnapshot,
    expected: &ArtifactObservation,
    role: ArtifactRole,
    allow_regular: bool,
) -> Result<(), NativeError> {
    let actual = current.observation(role);
    if actual.observation_token != expected.observation_token {
        return Err(fingerprint_error(
            "revalidate-cleanup",
            role,
            "artifact changed before cleanup",
        ));
    }
    match &actual.kind {
        ObservationKind::Directory(_) | ObservationKind::InvalidDirectory { .. } => {
            durable_cleanup(session, role, "remove-exact-directory", |anchor| {
                session.remove_role_tree(role, anchor)
            })
        }
        ObservationKind::RegularFile(_) if allow_regular => {
            durable_cleanup(session, role, "remove-confirmed-file", |_| {
                platform_ffi::unlink_file_at(&session.parent, session.names.role_name(role))
            })
        }
        _ => Err(artifact_conflict(
            "remove-exact-artifact",
            role,
            "artifact kind is not authorized for native cleanup",
        )),
    }
}

fn remove_empty(
    session: &ParentSession,
    current: &NativeSnapshot,
    role: ArtifactRole,
) -> Result<(), NativeError> {
    if !matches!(
        &current.observation(role).kind,
        ObservationKind::Directory(entries) if entries.is_empty()
    ) {
        return Err(artifact_conflict(
            "remove-empty-directory",
            role,
            "artifact is not a proven-empty directory",
        ));
    }
    durable_cleanup(session, role, "remove-empty-directory", |_| {
        session.remove_empty_role(role)
    })
}

fn remove_confirmed(
    session: &ParentSession,
    current: &NativeSnapshot,
    role: ArtifactRole,
    confirmations: &[String],
    selected_candidate: Option<&NativeSelectedCandidate>,
) -> Result<(), NativeError> {
    let observation = current.observation(role);
    if !confirmations
        .iter()
        .any(|value| confirmation_matches(value, role, observation))
    {
        return Err(NativeError::new(
            "persistence.recovery.confirmation-required",
            "remove-confirmed-artifact",
            Some(role),
            "candidate-specific confirmation token is missing",
        ));
    }
    if matches!(
        &observation.kind,
        ObservationKind::Directory(_)
            | ObservationKind::InvalidDirectory { .. }
            | ObservationKind::RegularFile(_)
    ) {
        require_selected_survivor(current, role, selected_candidate)?;
    }
    remove_exact(session, current, observation, role, true)
}

fn remove_confirmed_marker(
    session: &ParentSession,
    current: &NativeSnapshot,
    confirmations: &[String],
) -> Result<(), NativeError> {
    let observation = current.observation(ArtifactRole::Marker);
    if !matches!(observation.kind, ObservationKind::RegularFile(_)) {
        return Err(artifact_conflict(
            "remove-confirmed-marker",
            ArtifactRole::Marker,
            "marker is not an exact readable regular file",
        ));
    }
    if !confirmations
        .iter()
        .any(|value| confirmation_matches(value, ArtifactRole::Marker, observation))
    {
        return Err(NativeError::new(
            "persistence.recovery.confirmation-required",
            "remove-confirmed-marker",
            Some(ArtifactRole::Marker),
            "candidate-specific marker confirmation token is missing",
        ));
    }
    remove_marker(session, current)
}

fn confirmation_matches(
    value: &str,
    role: ArtifactRole,
    observation: &ArtifactObservation,
) -> bool {
    let mut fields = value.split('|');
    if fields.next() != Some(role.as_str())
        || fields.next() != Some(observation.observation_token.as_str())
    {
        return false;
    }
    let fingerprint = fields.next();
    if fields.next().is_some() {
        return false;
    }
    match fingerprint {
        None => true,
        Some(expected) => match &observation.kind {
            ObservationKind::Directory(entries) => {
                manifest_fingerprint(entries).as_deref() == Some(expected)
            }
            _ => false,
        },
    }
}

fn durable_cleanup(
    session: &ParentSession,
    role: ArtifactRole,
    primitive: &'static str,
    operation: impl FnOnce(Option<&File>) -> io::Result<()>,
) -> Result<(), NativeError> {
    let anchor = cleanup_anchor(session, role)?;
    operation(anchor.as_ref()).map_err(|error| cleanup_error(error, role, primitive))?;
    session
        .sync_parent()
        .and_then(|()| match anchor.as_ref() {
            Some(anchor) => platform_ffi::full_sync(anchor),
            None => Ok(()),
        })
        .map_err(|error| durability_error("sync-parent-after-cleanup", Some(role), error))
}

#[cfg(target_os = "linux")]
fn cleanup_anchor(
    session: &ParentSession,
    role: ArtifactRole,
) -> Result<Option<File>, NativeError> {
    let _ = (session, role);
    Ok(None)
}

#[cfg(target_os = "macos")]
fn cleanup_anchor(
    session: &ParentSession,
    role: ArtifactRole,
) -> Result<Option<File>, NativeError> {
    if role == ArtifactRole::Backup {
        return open_role_anchor(session, ArtifactRole::Target)
            .map(Some)
            .map_err(|error| {
                durability_error(
                    "open-committed-target-anchor",
                    Some(ArtifactRole::Target),
                    error,
                )
            });
    }
    for candidate in [
        role,
        ArtifactRole::Target,
        ArtifactRole::Temporary,
        ArtifactRole::Backup,
        ArtifactRole::Marker,
    ] {
        if let Ok(anchor) = open_role_anchor(session, candidate) {
            return Ok(Some(anchor));
        }
    }
    Err(NativeError::new(
        "persistence.recovery.durability-unsupported",
        "acquire-cleanup-anchor",
        Some(role),
        "cleanup requires an ordinary-file durability anchor before mutation",
    ))
}

fn open_role_anchor(session: &ParentSession, role: ArtifactRole) -> io::Result<File> {
    let anchor = if role == ArtifactRole::Marker {
        session.open_role_regular(role)?
    } else {
        let directory = session.open_role_directory(role)?;
        platform_ffi::open_regular_at(&directory, OsStr::new("manifest.json"))?
    };
    if anchor.metadata()?.is_file() {
        Ok(anchor)
    } else {
        Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "durability anchor is not an ordinary file",
        ))
    }
}
