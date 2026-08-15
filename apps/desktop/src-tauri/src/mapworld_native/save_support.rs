use std::ffi::OsStr;
use std::fs::File;
use std::io::{self, Write};

use super::adapter_error::{fingerprint_error, io_error, plan_error};
use super::fault::FaultController;
use super::filesystem::ParentSession;
use super::model::{
    ArtifactObservation, ArtifactRole, NativeError, NativeFileEntry, ObservationKind,
};
use super::platform_ffi;
use super::save_plan::manifest_fingerprint;

pub(crate) fn require_candidate_observation(
    observation: &ArtifactObservation,
    package: &[NativeFileEntry],
    expected_fingerprint: &str,
) -> Result<(), NativeError> {
    match &observation.kind {
        ObservationKind::Directory(entries)
            if entries == package
                && manifest_fingerprint(entries).as_deref() == Some(expected_fingerprint) =>
        {
            Ok(())
        }
        _ => Err(fingerprint_error(
            "revalidate-prepared-candidate",
            ArtifactRole::Temporary,
            "prepared candidate no longer matches the immutable save snapshot",
        )),
    }
}

pub(crate) fn revalidate_roles<const COUNT: usize>(
    session: &ParentSession,
    expected: [(ArtifactRole, &ArtifactObservation); COUNT],
    primitive: &'static str,
) -> Result<(), NativeError> {
    let current = session.snapshot();
    for (role, expected_observation) in expected {
        if current.observation(role) != expected_observation {
            return Err(NativeError::new(
                "persistence.recovery.target-changed",
                primitive,
                Some(role),
                "filesystem artifact changed after validation and before protocol mutation",
            ));
        }
    }
    Ok(())
}

pub(crate) fn open_parent_for_path<'a>(
    root: &File,
    path: &'a str,
) -> Result<(File, &'a str), NativeError> {
    let mut segments = path.split('/').collect::<Vec<_>>();
    let name = segments
        .pop()
        .ok_or_else(|| plan_error("relative path has no final component"))?;
    let directory = open_directory_segments(root, &segments).map_err(|error| {
        io_error(
            "open-candidate-parent",
            Some(ArtifactRole::Temporary),
            error,
        )
    })?;
    Ok((directory, name))
}

pub(crate) fn open_directory_path(root: &File, path: &str) -> io::Result<File> {
    let segments = path.split('/').collect::<Vec<_>>();
    open_directory_segments(root, &segments)
}

fn open_directory_segments(root: &File, segments: &[&str]) -> io::Result<File> {
    let mut directory = root.try_clone()?;
    for segment in segments {
        directory = platform_ffi::open_directory_at(&directory, OsStr::new(segment))?;
    }
    Ok(directory)
}

pub(crate) fn sync_directory_barrier(directory: &File, anchor: Option<&File>) -> io::Result<()> {
    platform_ffi::sync_descriptor(directory)?;
    match anchor {
        Some(anchor) => platform_ffi::full_sync(anchor),
        None => Ok(()),
    }
}

pub(crate) fn write_all_partial<W: Write>(
    file: &mut W,
    bytes: &[u8],
    point: u8,
    primitive: &'static str,
    role: ArtifactRole,
    fault: &mut FaultController,
) -> Result<(), NativeError> {
    let mut remaining = bytes;
    while !remaining.is_empty() {
        let chunk_length = remaining.len().min(64 * 1024);
        match fault
            .before(point)
            .and_then(|()| file.write(&remaining[..chunk_length]))
        {
            Ok(0) => {
                return Err(NativeError::new(
                    "persistence.recovery.io-failed",
                    primitive,
                    Some(role),
                    "write returned zero before all bytes were persisted",
                ));
            }
            Ok(count) => remaining = &remaining[count..],
            Err(error) if error.kind() == io::ErrorKind::Interrupted => continue,
            Err(error) => return Err(io_error(primitive, Some(role), error)),
        }
        fault.after(point, primitive)?;
    }
    Ok(())
}
