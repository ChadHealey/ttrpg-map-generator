//! Isolated Unix ABI boundary for the native `.mapworld` adapter.
//!
//! # Safety invariants
//!
//! This is the only module allowed to use `unsafe`. Every pathname is converted to an owned,
//! NUL-free `CString`; every descriptor argument is borrowed and valid for the complete call;
//! successful raw descriptors are wrapped in `File` exactly once; `fdopendir` receives a newly
//! opened descriptor and owns it until `closedir`; `readdir` names are copied within the declared
//! record/name bounds before the next call; errno is captured immediately; and no raw pointer or
//! descriptor escapes this module. Callers receive only owned Rust values and `io::Error`.

#![cfg(any(target_os = "macos", target_os = "linux"))]

#[cfg(not(target_pointer_width = "64"))]
compile_error!("the project-owned dirent ABI boundary supports only 64-bit macOS and Linux");

use std::ffi::{CString, OsStr, c_char, c_int, c_uint};
use std::fs::File;
use std::io;
use std::os::fd::{AsRawFd, FromRawFd};
use std::os::unix::ffi::OsStrExt;

#[cfg(target_os = "macos")]
const O_RDONLY: c_int = 0;
#[cfg(target_os = "macos")]
const O_WRONLY: c_int = 1;
#[cfg(target_os = "macos")]
const O_NONBLOCK: c_int = 0x0000_0004;
#[cfg(target_os = "macos")]
const O_NOFOLLOW: c_int = 0x0000_0100;
#[cfg(target_os = "macos")]
const O_CREAT: c_int = 0x0000_0200;
#[cfg(target_os = "macos")]
const O_EXCL: c_int = 0x0000_0800;
#[cfg(target_os = "macos")]
const O_DIRECTORY: c_int = 0x0010_0000;
#[cfg(target_os = "macos")]
const O_CLOEXEC: c_int = 0x0100_0000;
#[cfg(target_os = "macos")]
const AT_REMOVEDIR: c_int = 0x0080;
#[cfg(target_os = "macos")]
const RENAME_EXCL: c_uint = 0x0000_0004;
#[cfg(target_os = "macos")]
const RENAME_NOFOLLOW_ANY: c_uint = 0x0000_0010;
#[cfg(target_os = "macos")]
const F_FULLFSYNC: c_int = 51;

#[cfg(target_os = "linux")]
const O_RDONLY: c_int = 0;
#[cfg(target_os = "linux")]
const O_WRONLY: c_int = 1;
#[cfg(target_os = "linux")]
const O_CREAT: c_int = 0o100;
#[cfg(target_os = "linux")]
const O_EXCL: c_int = 0o200;
#[cfg(target_os = "linux")]
const O_NONBLOCK: c_int = 0o4000;
#[cfg(target_os = "linux")]
const O_DIRECTORY: c_int = 0o200000;
#[cfg(target_os = "linux")]
const O_NOFOLLOW: c_int = 0o400000;
#[cfg(target_os = "linux")]
const O_CLOEXEC: c_int = 0o2000000;
#[cfg(target_os = "linux")]
const AT_REMOVEDIR: c_int = 0x0200;
#[cfg(target_os = "linux")]
const RENAME_NOREPLACE: c_uint = 1;

const MODE_PRIVATE: c_uint = 0o600;
const MODE_DIRECTORY: c_uint = 0o700;

#[repr(C)]
struct Dir {
    _private: [u8; 0],
}

#[cfg(target_os = "macos")]
#[repr(C)]
struct Dirent {
    d_ino: u64,
    d_seekoff: u64,
    d_reclen: u16,
    d_namlen: u16,
    d_type: u8,
    d_name: [c_char; 1024],
}

#[cfg(target_os = "linux")]
#[repr(C)]
struct Dirent {
    d_ino: u64,
    d_off: i64,
    d_reclen: u16,
    d_type: u8,
    d_name: [c_char; 256],
}

unsafe extern "C" {
    fn open(path: *const c_char, flags: c_int, ...) -> c_int;
    fn openat(directory: c_int, path: *const c_char, flags: c_int, ...) -> c_int;
    fn mkdirat(directory: c_int, path: *const c_char, mode: c_uint) -> c_int;
    fn unlinkat(directory: c_int, path: *const c_char, flags: c_int) -> c_int;
    fn readlinkat(
        directory: c_int,
        path: *const c_char,
        buffer: *mut c_char,
        capacity: usize,
    ) -> isize;
    fn fdopendir(descriptor: c_int) -> *mut Dir;
    fn readdir(directory: *mut Dir) -> *mut Dirent;
    fn closedir(directory: *mut Dir) -> c_int;
    fn fsync(descriptor: c_int) -> c_int;
    fn fcntl(descriptor: c_int, command: c_int, ...) -> c_int;
}

#[cfg(target_os = "macos")]
unsafe extern "C" {
    fn renameatx_np(
        from_directory: c_int,
        from: *const c_char,
        to_directory: c_int,
        to: *const c_char,
        flags: c_uint,
    ) -> c_int;
    fn __error() -> *mut c_int;
}

#[cfg(target_os = "linux")]
unsafe extern "C" {
    fn renameat2(
        from_directory: c_int,
        from: *const c_char,
        to_directory: c_int,
        to: *const c_char,
        flags: c_uint,
    ) -> c_int;
    fn __errno_location() -> *mut c_int;
}

pub fn open_parent(path: &OsStr) -> io::Result<File> {
    let path = c_string(path)?;
    #[cfg(target_os = "macos")]
    let flags = O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC;
    #[cfg(target_os = "linux")]
    let flags = O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC;
    // SAFETY: the CString and returned descriptor obey the module invariants.
    let descriptor = unsafe { open(path.as_ptr(), flags) };
    owned_file(descriptor)
}

pub fn open_directory_at(parent: &File, name: &OsStr) -> io::Result<File> {
    open_at(
        parent,
        name,
        O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC,
        0,
    )
}

pub fn open_regular_at(parent: &File, name: &OsStr) -> io::Result<File> {
    open_at(
        parent,
        name,
        O_RDONLY | O_NONBLOCK | O_NOFOLLOW | O_CLOEXEC,
        0,
    )
}

pub fn create_regular_at(parent: &File, name: &OsStr) -> io::Result<File> {
    open_at(
        parent,
        name,
        O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC,
        MODE_PRIVATE,
    )
}

pub fn create_directory_at(parent: &File, name: &OsStr) -> io::Result<()> {
    let name = c_string(name)?;
    // SAFETY: the parent descriptor and CString obey the module invariants.
    cvt(unsafe { mkdirat(parent.as_raw_fd(), name.as_ptr(), MODE_DIRECTORY) })
}

pub fn unlink_file_at(parent: &File, name: &OsStr) -> io::Result<()> {
    unlink_at(parent, name, 0)
}

pub fn remove_directory_at(parent: &File, name: &OsStr) -> io::Result<()> {
    unlink_at(parent, name, AT_REMOVEDIR)
}

pub fn rename_no_replace(parent: &File, from: &OsStr, to: &OsStr) -> io::Result<()> {
    let from = c_string(from)?;
    let to = c_string(to)?;
    #[cfg(target_os = "macos")]
    // SAFETY: both names and the shared parent descriptor obey the module invariants.
    let result = unsafe {
        renameatx_np(
            parent.as_raw_fd(),
            from.as_ptr(),
            parent.as_raw_fd(),
            to.as_ptr(),
            RENAME_EXCL | RENAME_NOFOLLOW_ANY,
        )
    };
    #[cfg(target_os = "linux")]
    // SAFETY: both names and the shared parent descriptor obey the module invariants.
    let result = unsafe {
        renameat2(
            parent.as_raw_fd(),
            from.as_ptr(),
            parent.as_raw_fd(),
            to.as_ptr(),
            RENAME_NOREPLACE,
        )
    };
    cvt(result)
}

/// Probe availability of the exact no-replace primitive without changing a namespace entry.
///
/// Renaming a pathname to itself is a no-op even when it exists. An absent pathname yields
/// `ENOENT`; an existing pathname normally yields success or `EEXIST` under no-replace flags.
pub fn probe_no_replace(parent: &File, name: &OsStr) -> io::Result<()> {
    match rename_no_replace(parent, name, name) {
        Ok(()) => Ok(()),
        Err(error)
            if error.kind() == io::ErrorKind::NotFound
                || error.kind() == io::ErrorKind::AlreadyExists =>
        {
            Ok(())
        }
        Err(error) => Err(error),
    }
}

pub fn is_symlink_at(parent: &File, name: &OsStr) -> io::Result<bool> {
    let name = c_string(name)?;
    let mut buffer = [0_u8; 1];
    // SAFETY: the one-byte output buffer is valid and no pointer escapes.
    let result = unsafe {
        readlinkat(
            parent.as_raw_fd(),
            name.as_ptr(),
            buffer.as_mut_ptr().cast::<c_char>(),
            buffer.len(),
        )
    };
    if result >= 0 {
        return Ok(true);
    }
    let error = io::Error::last_os_error();
    if error.raw_os_error() == Some(22) {
        Ok(false)
    } else {
        Err(error)
    }
}

pub fn list_directory(directory: &File) -> io::Result<Vec<Vec<u8>>> {
    list_directory_bounded(directory, super::NATIVE_MAX_CLEANUP_ENTRIES)
}

pub fn list_parent_directory(directory: &File) -> io::Result<Vec<Vec<u8>>> {
    list_directory_bounded(directory, super::NATIVE_MAX_PARENT_ENTRIES)
}

fn list_directory_bounded(directory: &File, maximum_entries: usize) -> io::Result<Vec<Vec<u8>>> {
    let duplicate = open_at(
        directory,
        OsStr::new("."),
        O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC,
        0,
    )?;
    let raw = duplicate.as_raw_fd();
    std::mem::forget(duplicate);
    // SAFETY: ownership of the fresh descriptor transfers exactly once to DIR.
    let stream = unsafe { fdopendir(raw) };
    if stream.is_null() {
        let error = io::Error::last_os_error();
        // SAFETY: fdopendir failed and retained ownership of the fresh descriptor.
        drop(unsafe { File::from_raw_fd(raw) });
        return Err(error);
    }
    let mut names = Vec::new();
    loop {
        set_errno(0);
        // SAFETY: stream remains valid until closedir and the record is copied immediately.
        let entry = unsafe { readdir(stream) };
        if entry.is_null() {
            let error_number = errno();
            // SAFETY: stream is closed exactly once and no record pointer is retained.
            let close_result = unsafe { closedir(stream) };
            if error_number != 0 {
                return Err(io::Error::from_raw_os_error(error_number));
            }
            return cvt(close_result).map(|()| names);
        }
        let name_offset = std::mem::offset_of!(Dirent, d_name);
        // SAFETY: readdir returned a record whose fixed header is valid until the next call.
        let record_length = usize::from(unsafe { (*entry).d_reclen });
        if record_length <= name_offset {
            return invalid_directory_record(stream, "dirent record is shorter than d_name");
        }
        #[cfg(target_os = "macos")]
        let capacity = 1024_usize;
        #[cfg(target_os = "linux")]
        let capacity = 256_usize;
        let available = record_length.saturating_sub(name_offset).min(capacity);
        // SAFETY: the pointer addresses d_name and available is bounded by both d_reclen and the
        // project-owned ABI array declaration; bytes are copied before the next readdir call.
        let name_bytes = unsafe {
            std::slice::from_raw_parts(std::ptr::addr_of!((*entry).d_name).cast::<u8>(), available)
        };
        #[cfg(target_os = "macos")]
        let bytes = {
            // SAFETY: d_namlen belongs to the same valid fixed record header.
            let name_length = usize::from(unsafe { (*entry).d_namlen });
            if name_length > available || name_bytes[..name_length].contains(&0) {
                return invalid_directory_record(stream, "dirent name length is invalid");
            }
            name_bytes[..name_length].to_vec()
        };
        #[cfg(target_os = "linux")]
        let bytes = match name_bytes.iter().position(|byte| *byte == 0) {
            Some(name_length) => name_bytes[..name_length].to_vec(),
            None => return invalid_directory_record(stream, "dirent name is not NUL terminated"),
        };
        if bytes != b"." && bytes != b".." {
            if names.len() >= maximum_entries {
                // SAFETY: stream is closed exactly once and no record pointer is retained.
                let close_result = unsafe { closedir(stream) };
                if close_result != 0 {
                    return Err(io::Error::last_os_error());
                }
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    "directory enumeration entry limit exceeded",
                ));
            }
            names.push(bytes);
        }
    }
}

fn invalid_directory_record(stream: *mut Dir, message: &'static str) -> io::Result<Vec<Vec<u8>>> {
    // SAFETY: the caller owns stream and returns immediately, so it is closed exactly once.
    let close_result = unsafe { closedir(stream) };
    if close_result != 0 {
        return Err(io::Error::last_os_error());
    }
    Err(io::Error::new(io::ErrorKind::InvalidData, message))
}

pub fn sync_descriptor(file: &File) -> io::Result<()> {
    // SAFETY: the borrowed descriptor is valid for the call.
    cvt(unsafe { fsync(file.as_raw_fd()) })
}

#[cfg(target_os = "macos")]
pub fn full_sync(file: &File) -> io::Result<()> {
    // SAFETY: the borrowed regular-file descriptor is valid for the call.
    cvt(unsafe { fcntl(file.as_raw_fd(), F_FULLFSYNC) })
}

#[cfg(target_os = "linux")]
pub fn full_sync(_file: &File) -> io::Result<()> {
    Ok(())
}

pub const fn platform_name() -> &'static str {
    if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    }
}

fn open_at(parent: &File, name: &OsStr, flags: c_int, mode: c_uint) -> io::Result<File> {
    let name = c_string(name)?;
    // SAFETY: the parent descriptor and CString obey the module invariants.
    let descriptor = unsafe { openat(parent.as_raw_fd(), name.as_ptr(), flags, mode) };
    owned_file(descriptor)
}

fn unlink_at(parent: &File, name: &OsStr, flags: c_int) -> io::Result<()> {
    let name = c_string(name)?;
    // SAFETY: the parent descriptor and CString obey the module invariants.
    cvt(unsafe { unlinkat(parent.as_raw_fd(), name.as_ptr(), flags) })
}

fn owned_file(descriptor: c_int) -> io::Result<File> {
    if descriptor < 0 {
        Err(io::Error::last_os_error())
    } else {
        // SAFETY: a successful open call returned a newly owned descriptor.
        Ok(unsafe { File::from_raw_fd(descriptor) })
    }
}

fn c_string(value: &OsStr) -> io::Result<CString> {
    CString::new(value.as_bytes()).map_err(|_| {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            "filesystem name contains a NUL byte",
        )
    })
}

fn cvt(result: c_int) -> io::Result<()> {
    if result == 0 {
        Ok(())
    } else {
        Err(io::Error::last_os_error())
    }
}

fn errno() -> c_int {
    #[cfg(target_os = "macos")]
    // SAFETY: the platform returns a valid thread-local errno pointer.
    unsafe {
        *__error()
    }
    #[cfg(target_os = "linux")]
    // SAFETY: the platform returns a valid thread-local errno pointer.
    unsafe {
        *__errno_location()
    }
}

fn set_errno(value: c_int) {
    #[cfg(target_os = "macos")]
    // SAFETY: the platform returns a valid thread-local errno pointer.
    unsafe {
        *__error() = value;
    }
    #[cfg(target_os = "linux")]
    // SAFETY: the platform returns a valid thread-local errno pointer.
    unsafe {
        *__errno_location() = value;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_nul_names_before_ffi() {
        let error = c_string(OsStr::from_bytes(b"bad\0name")).expect_err("must reject NUL");
        assert_eq!(error.kind(), io::ErrorKind::InvalidInput);
    }
}
