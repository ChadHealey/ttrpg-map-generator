use std::collections::BTreeSet;
use std::ffi::OsStr;
use std::fs::File;

use super::adapter_error::{backup_cleanup_error, durability_error, fingerprint_error, io_error};
use super::fault::{
    FaultController, FaultSpec, durability_call, io_call, io_checkpoint, rename_call,
};
use super::filesystem::{ParentSession, read_bounded};
use super::model::{ArtifactRole, NativeError, NativeFileEntry, NativeSnapshot, ObservationKind};
use super::platform_ffi;
use super::save_plan::{manifest_fingerprint, preflight_save, validate_save_request};
use super::save_support::{
    open_directory_path, open_parent_for_path, require_candidate_observation, revalidate_roles,
    sync_directory_barrier, write_all_partial,
};
use super::service::NativeSaveRequest;
use super::{NATIVE_MAX_FILE_BYTES, NATIVE_MAX_MARKER_BYTES};

pub fn execute_save(
    request: &NativeSaveRequest,
    fault_spec: Option<FaultSpec>,
) -> Result<NativeSnapshot, NativeError> {
    let package = validate_save_request(request)?;
    let mut fault = FaultController::new(fault_spec);
    let session = ParentSession::open_locked(&request.target_path)?;
    let initial = session.snapshot();
    preflight_save(request, &initial)?;
    durability_call(&mut fault, 0, "probe-parent-sync", None, || {
        session.sync_parent()
    })?;
    rename_call(&mut fault, 0, ArtifactRole::Target, || {
        session.probe_no_replace()
    })?;

    let mut marker = io_call(
        &mut fault,
        1,
        "create-marker",
        Some(ArtifactRole::Marker),
        || platform_ffi::create_regular_at(&session.parent, &session.names.marker),
    )?;
    write_all_partial(
        &mut marker,
        &request.marker_bytes,
        1,
        "write-marker",
        ArtifactRole::Marker,
        &mut fault,
    )?;
    sync_regular(&marker, 2, "sync-marker", ArtifactRole::Marker, &mut fault)?;
    drop(marker);
    let mut marker_readback = session
        .open_role_regular(ArtifactRole::Marker)
        .map_err(|error| io_error("reopen-marker", Some(ArtifactRole::Marker), error))?;
    if read_bounded(&mut marker_readback, NATIVE_MAX_MARKER_BYTES)
        .map_err(|error| io_error("readback-marker", Some(ArtifactRole::Marker), error))?
        != request.marker_bytes
    {
        return Err(fingerprint_error(
            "readback-marker",
            ArtifactRole::Marker,
            "marker readback differs from the validated bytes",
        ));
    }
    parent_barrier(&session, ArtifactRole::Marker, 3, &mut fault)?;
    let marker_observation = session.snapshot().marker;

    io_call(
        &mut fault,
        4,
        "mkdir-temporary",
        Some(ArtifactRole::Temporary),
        || platform_ffi::create_directory_at(&session.parent, &session.names.temporary),
    )?;
    let temporary = session
        .open_role_directory(ArtifactRole::Temporary)
        .map_err(|error| io_error("open-temporary", Some(ArtifactRole::Temporary), error))?;
    let directories = create_candidate_directories(&temporary, &package, &mut fault)?;
    write_candidate_files(&temporary, &package, &mut fault)?;
    verify_candidate(
        &session,
        &package,
        &request.candidate_manifest_sha256,
        &mut fault,
    )?;
    sync_candidate_directories(&temporary, &directories, &mut fault)?;
    parent_barrier(&session, ArtifactRole::Temporary, 9, &mut fault)?;
    let prepared = session.snapshot().temporary;
    require_candidate_observation(&prepared, &package, &request.candidate_manifest_sha256)?;
    revalidate_roles(
        &session,
        [
            (ArtifactRole::Target, &initial.target),
            (ArtifactRole::Temporary, &prepared),
            (ArtifactRole::Backup, &initial.backup),
            (ArtifactRole::Marker, &marker_observation),
        ],
        "revalidate-before-first-rename",
    )?;

    if request.operation == "first-save" {
        rename_step(
            &session,
            ArtifactRole::Temporary,
            ArtifactRole::Target,
            10,
            &mut fault,
        )?;
        parent_barrier(&session, ArtifactRole::Target, 11, &mut fault)?;
    } else {
        rename_step(
            &session,
            ArtifactRole::Target,
            ArtifactRole::Backup,
            10,
            &mut fault,
        )?;
        parent_barrier(&session, ArtifactRole::Temporary, 11, &mut fault)?;
        revalidate_roles(
            &session,
            [
                (ArtifactRole::Target, &initial.temporary),
                (ArtifactRole::Temporary, &prepared),
                (ArtifactRole::Backup, &initial.target),
                (ArtifactRole::Marker, &marker_observation),
            ],
            "revalidate-before-candidate-rename",
        )?;
        rename_step(
            &session,
            ArtifactRole::Temporary,
            ArtifactRole::Target,
            12,
            &mut fault,
        )?;
        parent_barrier(&session, ArtifactRole::Target, 13, &mut fault)?;
        revalidate_roles(
            &session,
            [
                (ArtifactRole::Target, &prepared),
                (ArtifactRole::Temporary, &initial.temporary),
                (ArtifactRole::Backup, &initial.target),
                (ArtifactRole::Marker, &marker_observation),
            ],
            "revalidate-before-backup-cleanup",
        )?;
        #[cfg(target_os = "macos")]
        let cleanup_anchor = Some(session.open_role_manifest(ArtifactRole::Target).map_err(
            |error| {
                durability_error(
                    "open-committed-target-anchor",
                    Some(ArtifactRole::Target),
                    error,
                )
            },
        )?);
        #[cfg(target_os = "linux")]
        let cleanup_anchor: Option<File> = None;
        session
            .remove_role_tree_faulted(ArtifactRole::Backup, cleanup_anchor.as_ref(), &mut fault)
            .map_err(backup_cleanup_error)?;
        parent_barrier(&session, ArtifactRole::Target, 15, &mut fault)?;
    }

    revalidate_roles(
        &session,
        [
            (ArtifactRole::Target, &prepared),
            (ArtifactRole::Temporary, &initial.temporary),
            (ArtifactRole::Backup, &initial.backup),
            (ArtifactRole::Marker, &marker_observation),
        ],
        "revalidate-before-marker-unlink",
    )?;

    io_call(
        &mut fault,
        16,
        "unlink-marker",
        Some(ArtifactRole::Marker),
        || session.remove_marker(),
    )?;
    parent_barrier(&session, ArtifactRole::Target, 17, &mut fault)?;
    revalidate_roles(
        &session,
        [
            (ArtifactRole::Target, &prepared),
            (ArtifactRole::Temporary, &initial.temporary),
            (ArtifactRole::Backup, &initial.backup),
            (ArtifactRole::Marker, &initial.marker),
        ],
        "revalidate-final-save-state",
    )?;
    Ok(session.snapshot())
}

fn create_candidate_directories(
    root: &File,
    package: &[NativeFileEntry],
    fault: &mut FaultController,
) -> Result<Vec<String>, NativeError> {
    let mut directories = BTreeSet::new();
    for entry in package {
        let segments = entry.path.split('/').collect::<Vec<_>>();
        for length in 1..segments.len() {
            directories.insert(segments[..length].join("/"));
        }
    }
    let mut ordered = directories.into_iter().collect::<Vec<_>>();
    ordered.sort_by_key(|path| (path.matches('/').count(), path.clone()));
    for path in &ordered {
        let (parent, name) = open_parent_for_path(root, path)?;
        io_call(
            fault,
            4,
            "mkdir-candidate-child",
            Some(ArtifactRole::Temporary),
            || platform_ffi::create_directory_at(&parent, OsStr::new(name)),
        )?;
    }
    Ok(ordered)
}

fn write_candidate_files(
    root: &File,
    package: &[NativeFileEntry],
    fault: &mut FaultController,
) -> Result<(), NativeError> {
    for entry in package {
        let (parent, name) = open_parent_for_path(root, &entry.path)?;
        let mut file = io_call(
            fault,
            5,
            "create-authoritative-file",
            Some(ArtifactRole::Temporary),
            || platform_ffi::create_regular_at(&parent, OsStr::new(name)),
        )?;
        write_all_partial(
            &mut file,
            &entry.bytes,
            5,
            "write-authoritative-file",
            ArtifactRole::Temporary,
            fault,
        )?;
        sync_regular(
            &file,
            6,
            "sync-authoritative-file",
            ArtifactRole::Temporary,
            fault,
        )?;
    }
    Ok(())
}

fn verify_candidate(
    session: &ParentSession,
    package: &[NativeFileEntry],
    expected_fingerprint: &str,
    fault: &mut FaultController,
) -> Result<(), NativeError> {
    io_checkpoint(
        fault,
        7,
        "enumerate-candidate-readback",
        ArtifactRole::Temporary,
    )?;
    let observation = session.snapshot().temporary;
    let entries = match observation.kind {
        ObservationKind::Directory(entries) => entries,
        _ => {
            return Err(fingerprint_error(
                "verify-candidate-readback",
                ArtifactRole::Temporary,
                "temporary package is not a readable directory",
            ));
        }
    };
    fault.after(7, "enumerate-candidate-readback")?;

    io_checkpoint(
        fault,
        7,
        "verify-authoritative-file-count",
        ArtifactRole::Temporary,
    )?;
    if entries.len() != package.len() {
        return Err(fingerprint_error(
            "verify-authoritative-file-count",
            ArtifactRole::Temporary,
            "temporary package file count differs from the save plan",
        ));
    }
    fault.after(7, "verify-authoritative-file-count")?;

    let temporary = session
        .open_role_directory(ArtifactRole::Temporary)
        .map_err(|error| {
            io_error(
                "open-temporary-readback",
                Some(ArtifactRole::Temporary),
                error,
            )
        })?;
    for (expected, enumerated) in package.iter().zip(&entries) {
        io_checkpoint(
            fault,
            7,
            "verify-authoritative-path",
            ArtifactRole::Temporary,
        )?;
        if enumerated.path != expected.path {
            return Err(fingerprint_error(
                "verify-authoritative-path",
                ArtifactRole::Temporary,
                "temporary package path differs from the save plan",
            ));
        }
        fault.after(7, "verify-authoritative-path")?;

        io_checkpoint(
            fault,
            7,
            "readback-authoritative-file",
            ArtifactRole::Temporary,
        )?;
        let (parent, name) = open_parent_for_path(&temporary, &expected.path)?;
        let mut file =
            platform_ffi::open_regular_at(&parent, OsStr::new(name)).map_err(|error| {
                io_error(
                    "open-authoritative-readback",
                    Some(ArtifactRole::Temporary),
                    error,
                )
            })?;
        if !file
            .metadata()
            .map_err(|error| {
                io_error(
                    "metadata-authoritative-readback",
                    Some(ArtifactRole::Temporary),
                    error,
                )
            })?
            .is_file()
        {
            return Err(fingerprint_error(
                "metadata-authoritative-readback",
                ArtifactRole::Temporary,
                "temporary package entry is not an ordinary file",
            ));
        }
        let bytes = read_bounded(&mut file, NATIVE_MAX_FILE_BYTES).map_err(|error| {
            io_error(
                "read-authoritative-readback",
                Some(ArtifactRole::Temporary),
                error,
            )
        })?;
        fault.after(7, "readback-authoritative-file")?;

        io_checkpoint(
            fault,
            7,
            "verify-authoritative-length",
            ArtifactRole::Temporary,
        )?;
        if bytes.len() != expected.bytes.len() {
            return Err(fingerprint_error(
                "verify-authoritative-length",
                ArtifactRole::Temporary,
                "temporary package file length differs from the save plan",
            ));
        }
        fault.after(7, "verify-authoritative-length")?;

        io_checkpoint(
            fault,
            7,
            "verify-authoritative-bytes",
            ArtifactRole::Temporary,
        )?;
        if bytes != expected.bytes || enumerated.bytes != expected.bytes {
            return Err(fingerprint_error(
                "verify-authoritative-bytes",
                ArtifactRole::Temporary,
                "temporary package file bytes differ from the save plan",
            ));
        }
        fault.after(7, "verify-authoritative-bytes")?;
    }

    io_checkpoint(
        fault,
        7,
        "verify-manifest-fingerprint",
        ArtifactRole::Temporary,
    )?;
    if manifest_fingerprint(&entries).as_deref() != Some(expected_fingerprint) {
        return Err(fingerprint_error(
            "verify-candidate-fingerprint",
            ArtifactRole::Temporary,
            "temporary manifest fingerprint differs from the save plan",
        ));
    }
    fault.after(7, "verify-manifest-fingerprint")
}

fn sync_candidate_directories(
    root: &File,
    directories: &[String],
    fault: &mut FaultController,
) -> Result<(), NativeError> {
    #[cfg(target_os = "macos")]
    let anchor = Some(
        platform_ffi::open_regular_at(root, OsStr::new("manifest.json")).map_err(|error| {
            durability_error(
                "open-candidate-directory-anchor",
                Some(ArtifactRole::Temporary),
                error,
            )
        })?,
    );
    #[cfg(target_os = "linux")]
    let anchor: Option<File> = None;
    for path in directories.iter().rev() {
        let directory = open_directory_path(root, path).map_err(|error| {
            io_error(
                "open-candidate-directory-for-sync",
                Some(ArtifactRole::Temporary),
                error,
            )
        })?;
        durability_call(
            fault,
            8,
            "sync-candidate-directory",
            Some(ArtifactRole::Temporary),
            || sync_directory_barrier(&directory, anchor.as_ref()),
        )?;
    }
    durability_call(
        fault,
        8,
        "sync-temporary-root",
        Some(ArtifactRole::Temporary),
        || sync_directory_barrier(root, anchor.as_ref()),
    )
}

fn sync_regular(
    file: &File,
    point: u8,
    primitive: &'static str,
    role: ArtifactRole,
    fault: &mut FaultController,
) -> Result<(), NativeError> {
    durability_call(fault, point, primitive, Some(role), || {
        platform_ffi::sync_descriptor(file).and_then(|()| platform_ffi::full_sync(file))
    })
}

fn parent_barrier(
    session: &ParentSession,
    anchor: ArtifactRole,
    point: u8,
    fault: &mut FaultController,
) -> Result<(), NativeError> {
    durability_call(fault, point, "sync-parent-barrier", Some(anchor), || {
        session
            .sync_parent()
            .and_then(|()| session.full_sync_role_anchor(anchor))
    })
}

fn rename_step(
    session: &ParentSession,
    from: ArtifactRole,
    to: ArtifactRole,
    point: u8,
    fault: &mut FaultController,
) -> Result<(), NativeError> {
    rename_call(fault, point, from, || session.rename(from, to))
}
