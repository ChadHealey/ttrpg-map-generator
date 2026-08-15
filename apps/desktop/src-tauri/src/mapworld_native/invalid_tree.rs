use std::ffi::OsStr;
use std::fs::File;
use std::io;

use super::filesystem::read_bounded;
use super::model::{NativeFileEntry, OsContext};
use super::platform_ffi;
use super::{
    NATIVE_MAX_DIRECTORY_DEPTH, NATIVE_MAX_FILE_BYTES, NATIVE_MAX_PACKAGE_BYTES,
    NATIVE_MAX_PACKAGE_FILES, NATIVE_MAX_RELATIVE_PATH_BYTES,
};

/// Capture a readable but structurally invalid directory without losing empty-directory identity.
pub(crate) fn enumerate_invalid_directory(
    root: &File,
) -> Result<(Vec<NativeFileEntry>, Vec<String>), OsContext> {
    let mut entries = Vec::new();
    let mut directories = Vec::new();
    let mut total_bytes = 0_usize;
    enumerate_tree(
        root,
        "",
        0,
        &mut entries,
        &mut directories,
        &mut total_bytes,
    )?;
    entries.sort_by(|left, right| left.path.cmp(&right.path));
    directories.sort();
    Ok((entries, directories))
}

fn enumerate_tree(
    directory: &File,
    prefix: &str,
    depth: usize,
    entries: &mut Vec<NativeFileEntry>,
    directories: &mut Vec<String>,
    total_bytes: &mut usize,
) -> Result<(), OsContext> {
    if depth > NATIVE_MAX_DIRECTORY_DEPTH {
        return Err(OsContext::synthetic("invalid-tree-depth-limit"));
    }
    let mut names = platform_ffi::list_directory(directory)
        .map_err(|error| OsContext::from_io("enumerate-invalid-tree", &error))?;
    names.sort();
    for raw_name in names {
        let name = String::from_utf8(raw_name)
            .map_err(|_| OsContext::synthetic("non-unicode-invalid-tree-entry"))?;
        if name.is_empty() || name == "." || name == ".." || name.contains('/') {
            return Err(OsContext::synthetic("invalid-tree-entry-name"));
        }
        let path = if prefix.is_empty() {
            name.clone()
        } else {
            format!("{prefix}/{name}")
        };
        if path.len() > NATIVE_MAX_RELATIVE_PATH_BYTES {
            return Err(OsContext::synthetic("invalid-tree-path-limit"));
        }
        let os_name = OsStr::new(&name);
        match platform_ffi::is_symlink_at(directory, os_name) {
            Ok(true) => return Err(OsContext::synthetic("invalid-tree-symlink")),
            Ok(false) => {}
            Err(error) => return Err(OsContext::from_io("readlink-invalid-tree", &error)),
        }
        match platform_ffi::open_directory_at(directory, os_name) {
            Ok(child) => {
                directories.push(path.clone());
                if directories.len().saturating_add(entries.len())
                    > super::NATIVE_MAX_CLEANUP_ENTRIES
                {
                    return Err(OsContext::synthetic("invalid-tree-entry-limit"));
                }
                enumerate_tree(&child, &path, depth + 1, entries, directories, total_bytes)?;
                continue;
            }
            Err(error) if error.raw_os_error() == Some(20) => {}
            Err(error) => return Err(OsContext::from_io("open-invalid-tree-directory", &error)),
        }
        let mut file = platform_ffi::open_regular_at(directory, os_name)
            .map_err(|error| OsContext::from_io("open-invalid-tree-file", &error))?;
        if !file
            .metadata()
            .map_err(|error| OsContext::from_io("metadata-invalid-tree-file", &error))?
            .is_file()
        {
            return Err(OsContext::synthetic("invalid-tree-special-file"));
        }
        if entries.len() >= NATIVE_MAX_PACKAGE_FILES {
            return Err(OsContext::synthetic("invalid-tree-file-count-limit"));
        }
        let bytes = read_bounded(&mut file, NATIVE_MAX_FILE_BYTES)
            .map_err(|error| map_read_error("read-invalid-tree-file", error))?;
        *total_bytes = total_bytes.saturating_add(bytes.len());
        if *total_bytes > NATIVE_MAX_PACKAGE_BYTES {
            return Err(OsContext::synthetic("invalid-tree-byte-limit"));
        }
        entries.push(NativeFileEntry { path, bytes });
    }
    Ok(())
}

fn map_read_error(primitive: &'static str, error: io::Error) -> OsContext {
    OsContext::from_io(primitive, &error)
}
