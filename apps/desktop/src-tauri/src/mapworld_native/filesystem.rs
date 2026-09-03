use std::ffi::{OsStr, OsString};
use std::fs::{File, TryLockError};
use std::io::{self, Read, Seek, SeekFrom};
use std::os::unix::ffi::OsStringExt;
use std::path::{Path, PathBuf};

use super::adapter_error::{cleanup_durability_io, durability_error};
use super::fault::FaultController;
use super::identity::{append_token, observation};
use super::invalid_tree::enumerate_invalid_directory;
use super::model::{
    ArtifactObservation, ArtifactRole, NativeError, NativeFileEntry, NativeSnapshot,
    ObservationKind, OsContext,
};
use super::parent_scan::verified_artifact_observations;
use super::platform_ffi;
use super::sha256::sha256_hex;
use super::{
    NATIVE_MAX_BASENAME_BYTES, NATIVE_MAX_CLEANUP_ENTRIES, NATIVE_MAX_DIRECTORY_DEPTH,
    NATIVE_MAX_FILE_BYTES, NATIVE_MAX_PACKAGE_BYTES, NATIVE_MAX_PACKAGE_FILES,
    NATIVE_MAX_RELATIVE_PATH_BYTES,
};

pub(crate) struct ArtifactNames {
    pub parent_path: PathBuf,
    pub target: OsString,
    pub temporary: OsString,
    pub backup: OsString,
    pub marker: OsString,
    pub target_text: String,
}

impl ArtifactNames {
    pub fn derive(target_path: &str) -> Result<Self, NativeError> {
        if target_path.contains('\0') {
            return Err(name_error("target path contains a NUL byte"));
        }
        let path = Path::new(target_path);
        let target = path
            .file_name()
            .ok_or_else(|| name_error("target has no basename"))?;
        let target_text = target
            .to_str()
            .ok_or_else(|| name_error("target basename is not valid Unicode"))?;
        if !target_text.ends_with(".mapworld") {
            return Err(name_error("target basename must end in .mapworld"));
        }
        if target_text == "." || target_text == ".." || target_text.contains('/') {
            return Err(name_error("target basename is not representable safely"));
        }
        let temporary = format!(".{target_text}.commit-v1.temporary");
        let backup = format!(".{target_text}.commit-v1.backup");
        let marker = format!(".{target_text}.commit-v1.json");
        for name in [target_text, &temporary, &backup, &marker] {
            if name.len() > NATIVE_MAX_BASENAME_BYTES {
                return Err(name_error(
                    "target or derived artifact basename is too long",
                ));
            }
        }
        let parent_path = path
            .parent()
            .filter(|parent| !parent.as_os_str().is_empty())
            .unwrap_or_else(|| Path::new("."))
            .to_path_buf();
        Ok(Self {
            parent_path,
            target: target.to_os_string(),
            temporary: temporary.into(),
            backup: backup.into(),
            marker: marker.into(),
            target_text: target_text.to_owned(),
        })
    }

    pub fn role_name(&self, role: ArtifactRole) -> &OsStr {
        match role {
            ArtifactRole::Target => &self.target,
            ArtifactRole::Temporary => &self.temporary,
            ArtifactRole::Backup => &self.backup,
            ArtifactRole::Marker => &self.marker,
        }
    }
}

pub(crate) struct ParentSession {
    pub parent: File,
    pub names: ArtifactNames,
}

impl ParentSession {
    pub fn open_locked(target_path: &str) -> Result<Self, NativeError> {
        let names = ArtifactNames::derive(target_path)?;
        let parent = platform_ffi::open_parent(names.parent_path.as_os_str()).map_err(|error| {
            NativeError::from_io("persistence.recovery.io-failed", "open-parent", None, error)
        })?;
        match parent.try_lock() {
            Ok(()) => Ok(Self { parent, names }),
            Err(TryLockError::WouldBlock) => Err(NativeError::new(
                "persistence.recovery.operation-in-progress",
                "lock-parent",
                None,
                "another cooperating operation holds the parent lock",
            )),
            Err(TryLockError::Error(error)) => Err(durability_error("lock-parent", None, error)),
        }
    }

    pub fn snapshot(&self) -> NativeSnapshot {
        let [target, temporary, backup, marker] = verified_artifact_observations(self);
        let mut identity = Vec::new();
        append_token(&mut identity, &self.names.target_text);
        for observation in [&target, &temporary, &backup, &marker] {
            append_token(&mut identity, &observation.observation_token);
        }
        NativeSnapshot {
            target_name: self.names.target_text.clone(),
            snapshot_id: sha256_hex(&identity),
            target,
            temporary,
            backup,
            marker,
        }
    }

    pub(crate) fn raw_observe(&self, role: ArtifactRole) -> ArtifactObservation {
        let name = self.names.role_name(role);
        let kind = if role == ArtifactRole::Marker {
            self.observe_marker(name)
        } else {
            self.observe_package(name)
        };
        observation(kind)
    }

    pub fn open_role_directory(&self, role: ArtifactRole) -> io::Result<File> {
        platform_ffi::open_directory_at(&self.parent, self.names.role_name(role))
    }

    pub fn open_role_regular(&self, role: ArtifactRole) -> io::Result<File> {
        platform_ffi::open_regular_at(&self.parent, self.names.role_name(role))
    }

    #[cfg(target_os = "macos")]
    pub fn open_role_manifest(&self, role: ArtifactRole) -> io::Result<File> {
        let directory = self.open_role_directory(role)?;
        platform_ffi::open_regular_at(&directory, OsStr::new("manifest.json"))
    }

    pub fn sync_parent(&self) -> io::Result<()> {
        platform_ffi::sync_descriptor(&self.parent)
    }

    pub fn full_sync_role_anchor(&self, role: ArtifactRole) -> io::Result<()> {
        let anchor = if role == ArtifactRole::Marker {
            self.open_role_regular(role)?
        } else {
            let directory = self.open_role_directory(role)?;
            platform_ffi::open_regular_at(&directory, OsStr::new("manifest.json"))?
        };
        platform_ffi::full_sync(&anchor)
    }

    pub fn rename(&self, from: ArtifactRole, to: ArtifactRole) -> io::Result<()> {
        platform_ffi::rename_no_replace(
            &self.parent,
            self.names.role_name(from),
            self.names.role_name(to),
        )
    }

    pub fn probe_no_replace(&self) -> io::Result<()> {
        platform_ffi::probe_no_replace(&self.parent, &self.names.target)
    }

    pub fn remove_marker(&self) -> io::Result<()> {
        platform_ffi::unlink_file_at(&self.parent, &self.names.marker)
    }

    pub fn remove_empty_role(&self, role: ArtifactRole) -> io::Result<()> {
        platform_ffi::remove_directory_at(&self.parent, self.names.role_name(role))
    }

    pub fn remove_role_tree(&self, role: ArtifactRole, anchor: Option<&File>) -> io::Result<()> {
        let directory = self.open_role_directory(role)?;
        let mut remaining = NATIVE_MAX_CLEANUP_ENTRIES;
        remove_children(&directory, anchor, None, 0, &mut remaining)?;
        platform_ffi::remove_directory_at(&self.parent, self.names.role_name(role))
    }

    pub fn remove_role_tree_faulted(
        &self,
        role: ArtifactRole,
        anchor: Option<&File>,
        fault: &mut FaultController,
    ) -> io::Result<()> {
        let directory = self.open_role_directory(role)?;
        let mut remaining = NATIVE_MAX_CLEANUP_ENTRIES;
        remove_children(&directory, anchor, Some(fault), 0, &mut remaining)?;
        cleanup_call(Some(fault), "remove-backup-root", || {
            platform_ffi::remove_directory_at(&self.parent, self.names.role_name(role))
        })
    }

    fn observe_package(&self, name: &OsStr) -> ObservationKind {
        match platform_ffi::open_directory_at(&self.parent, name) {
            Ok(directory) => match enumerate_package(&directory) {
                Ok(entries) => ObservationKind::Directory(entries),
                Err(context) => match enumerate_invalid_directory(&directory) {
                    Ok((entries, directories)) => ObservationKind::InvalidDirectory {
                        entries,
                        directories,
                    },
                    Err(_) => ObservationKind::Unreadable(context),
                },
            },
            Err(directory_error) => self.classify_non_directory(name, directory_error, true),
        }
    }

    fn observe_marker(&self, name: &OsStr) -> ObservationKind {
        match platform_ffi::open_regular_at(&self.parent, name) {
            Ok(mut file) => match file.metadata() {
                Ok(metadata) if metadata.is_file() => {
                    match read_bounded(&mut file, super::NATIVE_MAX_MARKER_BYTES) {
                        Ok(bytes) => ObservationKind::RegularFile(bytes),
                        Err(error) => {
                            ObservationKind::Unreadable(OsContext::from_io("read-marker", &error))
                        }
                    }
                }
                Ok(_) => ObservationKind::Special,
                Err(error) => {
                    ObservationKind::Unreadable(OsContext::from_io("metadata-marker", &error))
                }
            },
            Err(file_error) => self.classify_non_directory(name, file_error, false),
        }
    }

    fn classify_non_directory(
        &self,
        name: &OsStr,
        original_error: io::Error,
        read_regular: bool,
    ) -> ObservationKind {
        match platform_ffi::is_symlink_at(&self.parent, name) {
            Ok(true) => return ObservationKind::Symlink,
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                return ObservationKind::Absent;
            }
            Err(error) => {
                return ObservationKind::Unreadable(OsContext::from_io("readlink-role", &error));
            }
            Ok(false) => {}
        }
        match platform_ffi::open_regular_at(&self.parent, name) {
            Ok(mut file) => match file.metadata() {
                Ok(metadata) if metadata.is_file() && read_regular => {
                    match read_bounded(&mut file, NATIVE_MAX_FILE_BYTES) {
                        Ok(bytes) => ObservationKind::RegularFile(bytes),
                        Err(error) => ObservationKind::Unreadable(OsContext::from_io(
                            "read-wrong-kind-file",
                            &error,
                        )),
                    }
                }
                Ok(metadata) if metadata.is_file() => {
                    match read_bounded(&mut file, NATIVE_MAX_FILE_BYTES) {
                        Ok(bytes) => ObservationKind::RegularFile(bytes),
                        Err(error) => {
                            ObservationKind::Unreadable(OsContext::from_io("read-marker", &error))
                        }
                    }
                }
                Ok(_) => ObservationKind::Special,
                Err(error) => {
                    ObservationKind::Unreadable(OsContext::from_io("metadata-role", &error))
                }
            },
            Err(error) if error.kind() == io::ErrorKind::NotFound => ObservationKind::Absent,
            Err(_) => ObservationKind::Unreadable(OsContext::from_io("open-role", &original_error)),
        }
    }
}

pub(crate) fn read_bounded(file: &mut File, maximum: usize) -> io::Result<Vec<u8>> {
    file.seek(SeekFrom::Start(0))?;
    let mut output = Vec::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        match file.read(&mut buffer) {
            Ok(0) => return Ok(output),
            Ok(count) => {
                if output.len().saturating_add(count) > maximum {
                    return Err(io::Error::new(
                        io::ErrorKind::InvalidData,
                        "native read limit exceeded",
                    ));
                }
                output.extend_from_slice(&buffer[..count]);
            }
            Err(error) if error.kind() == io::ErrorKind::Interrupted => {}
            Err(error) => return Err(error),
        }
    }
}

fn enumerate_package(root: &File) -> Result<Vec<NativeFileEntry>, OsContext> {
    let mut entries = Vec::new();
    let mut total_bytes = 0_usize;
    enumerate_directory(root, "", 0, &mut entries, &mut total_bytes)?;
    entries.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(entries)
}

fn enumerate_directory(
    directory: &File,
    prefix: &str,
    depth: usize,
    entries: &mut Vec<NativeFileEntry>,
    total_bytes: &mut usize,
) -> Result<(), OsContext> {
    if depth > NATIVE_MAX_DIRECTORY_DEPTH {
        return Err(OsContext::synthetic("directory-depth-limit"));
    }
    let mut names = platform_ffi::list_directory(directory)
        .map_err(|error| OsContext::from_io("enumerate-directory", &error))?;
    names.sort();
    if depth > 0 && names.is_empty() {
        return Err(OsContext::synthetic("empty-child-directory"));
    }
    for raw_name in names {
        let name = String::from_utf8(raw_name)
            .map_err(|_| OsContext::synthetic("non-unicode-package-entry"))?;
        if name.is_empty() || name == "." || name == ".." || name.contains('/') {
            return Err(OsContext::synthetic("invalid-package-entry-name"));
        }
        let path = if prefix.is_empty() {
            name.clone()
        } else {
            format!("{prefix}/{name}")
        };
        if path.len() > NATIVE_MAX_RELATIVE_PATH_BYTES {
            return Err(OsContext::synthetic("relative-path-limit"));
        }
        let os_name = OsStr::new(&name);
        match platform_ffi::is_symlink_at(directory, os_name) {
            Ok(true) => return Err(OsContext::synthetic("package-entry-symlink")),
            Ok(false) => {}
            Err(error) => return Err(OsContext::from_io("readlink-package-entry", &error)),
        }
        match platform_ffi::open_directory_at(directory, os_name) {
            Ok(child) => {
                if !is_package_directory(&path) {
                    return Err(OsContext::synthetic("unexpected-child-directory"));
                }
                enumerate_directory(&child, &path, depth + 1, entries, total_bytes)?;
                continue;
            }
            Err(error)
                if matches!(
                    error.kind(),
                    io::ErrorKind::NotADirectory | io::ErrorKind::Other
                ) => {}
            Err(error) => {
                if error.raw_os_error() != Some(20) {
                    return Err(OsContext::from_io("open-package-directory", &error));
                }
            }
        }
        let mut file = platform_ffi::open_regular_at(directory, os_name)
            .map_err(|error| OsContext::from_io("open-package-file", &error))?;
        let metadata = file
            .metadata()
            .map_err(|error| OsContext::from_io("metadata-package-file", &error))?;
        if !metadata.is_file() {
            return Err(OsContext::synthetic("package-entry-special"));
        }
        if entries.len() >= NATIVE_MAX_PACKAGE_FILES {
            return Err(OsContext::synthetic("package-file-count-limit"));
        }
        let bytes = read_bounded(&mut file, NATIVE_MAX_FILE_BYTES)
            .map_err(|error| OsContext::from_io("read-package-file", &error))?;
        *total_bytes = total_bytes.saturating_add(bytes.len());
        if *total_bytes > NATIVE_MAX_PACKAGE_BYTES {
            return Err(OsContext::synthetic("package-byte-limit"));
        }
        entries.push(NativeFileEntry { path, bytes });
    }
    Ok(())
}

fn is_package_directory(path: &str) -> bool {
    let segments = path.split('/').collect::<Vec<_>>();
    match segments.as_slice() {
        ["maps"] | ["data"] => true,
        ["data", map_id] => is_canonical_uuid(map_id),
        ["data", map_id, "aspects" | "fields"] => is_canonical_uuid(map_id),
        _ => false,
    }
}

fn is_canonical_uuid(value: &str) -> bool {
    value.len() == 36
        && value.bytes().enumerate().all(|(index, byte)| {
            if matches!(index, 8 | 13 | 18 | 23) {
                byte == b'-'
            } else {
                byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte)
            }
        })
}

fn remove_children(
    directory: &File,
    anchor: Option<&File>,
    mut fault: Option<&mut FaultController>,
    depth: usize,
    remaining: &mut usize,
) -> io::Result<()> {
    if depth > NATIVE_MAX_DIRECTORY_DEPTH {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "cleanup directory depth limit exceeded",
        ));
    }
    let mut names = platform_ffi::list_directory(directory)?;
    names.sort();
    for raw_name in names {
        if *remaining == 0 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "cleanup entry limit exceeded",
            ));
        }
        *remaining -= 1;
        let os_name = OsString::from_vec(raw_name);
        if platform_ffi::is_symlink_at(directory, &os_name)? {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "cleanup refuses symbolic links",
            ));
        }
        match platform_ffi::open_directory_at(directory, &os_name) {
            Ok(child) => {
                remove_children(&child, anchor, fault.as_deref_mut(), depth + 1, remaining)?;
                cleanup_call(
                    fault.as_deref_mut(),
                    "remove-backup-child-directory",
                    || platform_ffi::remove_directory_at(directory, &os_name),
                )?;
                cleanup_call(fault.as_deref_mut(), "sync-backup-directory", || {
                    sync_directory_barrier(directory, anchor)
                })?;
            }
            Err(error) if error.raw_os_error() == Some(20) => {
                let file = platform_ffi::open_regular_at(directory, &os_name)?;
                if !file.metadata()?.is_file() {
                    return Err(io::Error::new(
                        io::ErrorKind::InvalidData,
                        "cleanup refuses special files",
                    ));
                }
                cleanup_call(fault.as_deref_mut(), "unlink-backup-file", || {
                    platform_ffi::unlink_file_at(directory, &os_name)
                })?;
                cleanup_call(fault.as_deref_mut(), "sync-backup-directory", || {
                    sync_directory_barrier(directory, anchor)
                })?;
            }
            Err(error) => return Err(error),
        }
    }
    Ok(())
}

fn sync_directory_barrier(directory: &File, anchor: Option<&File>) -> io::Result<()> {
    platform_ffi::sync_descriptor(directory)?;
    match anchor {
        Some(anchor) => platform_ffi::full_sync(anchor),
        None => Ok(()),
    }
}

fn cleanup_call(
    fault: Option<&mut FaultController>,
    primitive: &'static str,
    operation: impl FnOnce() -> io::Result<()>,
) -> io::Result<()> {
    if let Some(controller) = fault {
        map_cleanup_operation(primitive, controller.before(14))?;
        map_cleanup_operation(primitive, operation())?;
        controller.after(14, primitive).map_err(io::Error::other)
    } else {
        map_cleanup_operation(primitive, operation())
    }
}

fn map_cleanup_operation(primitive: &'static str, result: io::Result<()>) -> io::Result<()> {
    if primitive.starts_with("sync-") {
        result.map_err(|error| cleanup_durability_io(primitive, error))
    } else {
        result
    }
}

fn name_error(message: &'static str) -> NativeError {
    NativeError::new(
        "persistence.recovery.artifact-name-invalid",
        "derive-artifact-names",
        None,
        message,
    )
}

#[cfg(test)]
mod tests {
    use super::is_package_directory;

    #[test]
    fn recognizes_only_v1_and_v2_authoritative_directory_shapes() {
        let map_id = "a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7";
        assert!(is_package_directory("maps"));
        assert!(is_package_directory("data"));
        assert!(is_package_directory(&format!("data/{map_id}")));
        assert!(is_package_directory(&format!("data/{map_id}/aspects")));
        assert!(is_package_directory(&format!("data/{map_id}/fields")));
        assert!(!is_package_directory("cache"));
        assert!(!is_package_directory("maps/nested"));
        assert!(!is_package_directory("data/not-a-map"));
        assert!(!is_package_directory(&format!("data/{map_id}/preview")));
        assert!(!is_package_directory(&format!(
            "data/{map_id}/aspects/nested"
        )));
    }
}
