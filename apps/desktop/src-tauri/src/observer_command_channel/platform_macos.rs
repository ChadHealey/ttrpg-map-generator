//! Isolated macOS ABI and process-environment boundary for the observer channel.
//!
//! # Safety invariants
//!
//! The connected `UnixStream` descriptor is borrowed and valid for each call. `getpeereid` writes
//! exactly one effective UID/GID pair, and `getsockopt(SOL_LOCAL, LOCAL_PEERPID)` writes into an
//! exactly sized `pid_t`. The private bootstrap variables are removed before Tauri can create
//! threads, so the edition-2024 process-environment safety requirement is upheld. No raw pointer,
//! descriptor, environment value, UID, or PID escapes except as an owned numeric result.

use std::ffi::{OsString, c_int, c_uint, c_void};
use std::io;
use std::os::fd::AsRawFd;
use std::os::unix::net::UnixStream;

const SOL_LOCAL: c_int = 0;
// Darwin's documented local-domain peer process option from <sys/un.h>.
const LOCAL_PEERPID: c_int = 2;

unsafe extern "C" {
    fn geteuid() -> c_uint;
    fn getpeereid(descriptor: c_int, euid: *mut c_uint, egid: *mut c_uint) -> c_int;
    fn getsockopt(
        descriptor: c_int,
        level: c_int,
        option_name: c_int,
        option_value: *mut c_void,
        option_length: *mut c_uint,
    ) -> c_int;
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct PeerIdentity {
    pub(crate) effective_uid: u32,
    pub(crate) pid: i32,
}

pub(crate) fn effective_uid() -> u32 {
    // SAFETY: geteuid has no arguments and returns the caller's effective UID.
    unsafe { geteuid() }
}

pub(crate) fn peer_identity(stream: &UnixStream) -> io::Result<PeerIdentity> {
    let descriptor = stream.as_raw_fd();
    let mut effective_uid = 0_u32;
    let mut effective_gid = 0_u32;
    // SAFETY: both output pointers and the borrowed connected descriptor obey module invariants.
    if unsafe { getpeereid(descriptor, &mut effective_uid, &mut effective_gid) } != 0 {
        return Err(io::Error::last_os_error());
    }
    let mut pid = 0_i32;
    let mut length =
        c_uint::try_from(std::mem::size_of_val(&pid)).expect("pid_t size fits socklen");
    // SAFETY: LOCAL_PEERPID writes one pid_t and length describes exactly that storage.
    if unsafe {
        getsockopt(
            descriptor,
            SOL_LOCAL,
            LOCAL_PEERPID,
            std::ptr::addr_of_mut!(pid).cast::<c_void>(),
            &mut length,
        )
    } != 0
    {
        return Err(io::Error::last_os_error());
    }
    if length as usize != std::mem::size_of_val(&pid) || pid <= 0 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "LOCAL_PEERPID returned an invalid pid_t",
        ));
    }
    Ok(PeerIdentity { effective_uid, pid })
}

pub(crate) fn take_private_environment<const N: usize>(names: [&str; N]) -> [Option<OsString>; N] {
    let values = names.map(std::env::var_os);
    for name in names {
        // SAFETY: prepare calls this before Tauri or the observer implementation starts threads.
        unsafe { std::env::remove_var(name) };
    }
    values
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn local_peerpid_adapter_reports_the_connected_process() {
        let (left, _right) = UnixStream::pair().expect("stream pair");
        let peer = peer_identity(&left).expect("peer identity");
        assert_eq!(peer.effective_uid, effective_uid());
        assert_eq!(peer.pid, std::process::id() as i32);
    }
}
