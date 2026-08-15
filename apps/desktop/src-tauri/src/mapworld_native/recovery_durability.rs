use std::collections::BTreeSet;
use std::ffi::OsStr;
use std::fs::File;

use super::adapter_error::{durability_error, fingerprint_error, io_error};
use super::filesystem::ParentSession;
use super::model::{ArtifactRole, NativeError, NativeSnapshot, ObservationKind};
use super::platform_ffi;
use super::save_support::{open_directory_path, sync_directory_barrier};

/// Re-establish file and directory durability before promoting a reopened package.
///
/// A byte-valid W can have been observed after its last write but before the original P06/P08
/// barriers. Recovery therefore cannot infer durability from validation alone.
pub(crate) fn durabilize_promotion_source(
    session: &ParentSession,
    current: &NativeSnapshot,
    role: ArtifactRole,
) -> Result<(), NativeError> {
    let entries = match &current.observation(role).kind {
        ObservationKind::Directory(entries) if !entries.is_empty() => entries,
        _ => {
            return Err(fingerprint_error(
                "durabilize-promotion-source",
                role,
                "promotion source is not a complete readable package directory",
            ));
        }
    };
    let root = session
        .open_role_directory(role)
        .map_err(|error| io_error("open-promotion-source", Some(role), error))?;
    let mut directories = BTreeSet::new();
    for entry in entries {
        let (parent, name) = open_entry_parent(&root, &entry.path, role)?;
        let file = platform_ffi::open_regular_at(&parent, OsStr::new(name))
            .map_err(|error| io_error("open-promotion-file", Some(role), error))?;
        if !file
            .metadata()
            .map_err(|error| io_error("metadata-promotion-file", Some(role), error))?
            .is_file()
        {
            return Err(fingerprint_error(
                "metadata-promotion-file",
                role,
                "promotion entry changed to a non-regular file",
            ));
        }
        platform_ffi::sync_descriptor(&file)
            .and_then(|()| platform_ffi::full_sync(&file))
            .map_err(|error| durability_error("sync-promotion-file", Some(role), error))?;
        collect_parent_directories(&entry.path, &mut directories);
    }

    #[cfg(target_os = "macos")]
    let anchor = Some(
        platform_ffi::open_regular_at(&root, OsStr::new("manifest.json")).map_err(|error| {
            durability_error("open-promotion-directory-anchor", Some(role), error)
        })?,
    );
    #[cfg(target_os = "linux")]
    let anchor: Option<File> = None;
    let mut directories = directories.into_iter().collect::<Vec<_>>();
    directories.sort_by_key(|path| (std::cmp::Reverse(path.matches('/').count()), path.clone()));
    for path in directories {
        let directory = open_directory_path(&root, &path)
            .map_err(|error| io_error("open-promotion-directory", Some(role), error))?;
        sync_directory_barrier(&directory, anchor.as_ref())
            .map_err(|error| durability_error("sync-promotion-directory", Some(role), error))?;
    }
    sync_directory_barrier(&root, anchor.as_ref())
        .map_err(|error| durability_error("sync-promotion-root", Some(role), error))?;
    if session.snapshot().observation(role) != current.observation(role) {
        return Err(NativeError::new(
            "persistence.recovery.target-changed",
            "revalidate-durable-promotion-source",
            Some(role),
            "promotion source changed while recovery re-established durability",
        ));
    }
    Ok(())
}

fn open_entry_parent<'a>(
    root: &File,
    path: &'a str,
    role: ArtifactRole,
) -> Result<(File, &'a str), NativeError> {
    match path.rsplit_once('/') {
        Some((parent, name)) => open_directory_path(root, parent)
            .map(|directory| (directory, name))
            .map_err(|error| io_error("open-promotion-file-parent", Some(role), error)),
        None => root
            .try_clone()
            .map(|directory| (directory, path))
            .map_err(|error| io_error("clone-promotion-root", Some(role), error)),
    }
}

fn collect_parent_directories(path: &str, directories: &mut BTreeSet<String>) {
    let segments = path.split('/').collect::<Vec<_>>();
    for length in 1..segments.len() {
        directories.insert(segments[..length].join("/"));
    }
}
