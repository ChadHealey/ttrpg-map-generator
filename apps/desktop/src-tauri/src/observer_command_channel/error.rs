use std::fmt;

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum ObserverError {
    #[cfg_attr(target_os = "macos", allow(dead_code))]
    UnsupportedPlatform,
    BootstrapMissing,
    BootstrapInvalid,
    CandidateMismatch,
    PathPolicy,
    PathCollision,
    PathReplaced,
    Permission,
    PeerUid,
    PeerPid,
    Timeout,
    Disconnect,
    Framing,
    Malformed,
    Version,
    Unauthorized,
    Sequence,
    Busy,
    Unsupported,
    Lifecycle,
    Io,
}

impl ObserverError {
    pub(crate) const fn code(self) -> &'static str {
        match self {
            Self::UnsupportedPlatform => "observer.unsupported-platform",
            Self::BootstrapMissing => "observer.bootstrap-missing",
            Self::BootstrapInvalid => "observer.bootstrap-invalid",
            Self::CandidateMismatch => "observer.candidate-mismatch",
            Self::PathPolicy => "observer.path-policy",
            Self::PathCollision => "observer.path-collision",
            Self::PathReplaced => "observer.path-replaced",
            Self::Permission => "observer.permission",
            Self::PeerUid => "observer.peer-uid",
            Self::PeerPid => "observer.peer-pid",
            Self::Timeout => "observer.timeout",
            Self::Disconnect => "observer.disconnect",
            Self::Framing => "observer.framing",
            Self::Malformed => "observer.malformed",
            Self::Version => "observer.version",
            Self::Unauthorized => "observer.unauthorized",
            Self::Sequence => "observer.sequence",
            Self::Busy => "observer.busy",
            Self::Unsupported => "observer.unsupported",
            Self::Lifecycle => "observer.lifecycle",
            Self::Io => "observer.io",
        }
    }

    pub(crate) const fn reject_reason(self) -> u16 {
        match self {
            Self::Unauthorized
            | Self::BootstrapMissing
            | Self::BootstrapInvalid
            | Self::CandidateMismatch
            | Self::PeerUid
            | Self::PeerPid => 1,
            Self::Framing | Self::Malformed => 2,
            Self::Version => 3,
            Self::Sequence => 4,
            Self::Busy => 5,
            Self::Unsupported | Self::UnsupportedPlatform => 6,
            Self::Timeout => 7,
            Self::PathPolicy
            | Self::PathCollision
            | Self::PathReplaced
            | Self::Permission
            | Self::Disconnect
            | Self::Lifecycle
            | Self::Io => 8,
        }
    }
}

impl fmt::Display for ObserverError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code())
    }
}

impl std::error::Error for ObserverError {}

impl From<std::io::Error> for ObserverError {
    fn from(_: std::io::Error) -> Self {
        Self::Io
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn public_errors_are_stable_and_contain_no_runtime_context() {
        for error in [
            ObserverError::UnsupportedPlatform,
            ObserverError::BootstrapMissing,
            ObserverError::BootstrapInvalid,
            ObserverError::CandidateMismatch,
            ObserverError::PathPolicy,
            ObserverError::PathCollision,
            ObserverError::PathReplaced,
            ObserverError::Permission,
            ObserverError::PeerUid,
            ObserverError::PeerPid,
            ObserverError::Timeout,
            ObserverError::Disconnect,
            ObserverError::Framing,
            ObserverError::Malformed,
            ObserverError::Version,
            ObserverError::Unauthorized,
            ObserverError::Sequence,
            ObserverError::Busy,
            ObserverError::Unsupported,
            ObserverError::Lifecycle,
            ObserverError::Io,
        ] {
            let rendered = error.to_string();
            assert!(rendered.starts_with("observer."));
            assert!(
                rendered
                    .bytes()
                    .all(|byte| byte.is_ascii_lowercase() || byte == b'.' || byte == b'-')
            );
        }
    }
}
