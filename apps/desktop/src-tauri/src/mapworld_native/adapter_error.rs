use std::{fmt, io};

use super::model::{ArtifactRole, NativeError};

pub(crate) fn io_error(
    primitive: &'static str,
    role: Option<ArtifactRole>,
    error: io::Error,
) -> NativeError {
    NativeError::from_io("persistence.recovery.io-failed", primitive, role, error)
}

pub(crate) fn backup_cleanup_error(error: io::Error) -> NativeError {
    cleanup_error(error, ArtifactRole::Backup, "remove-backup")
}

pub(crate) fn cleanup_error(
    error: io::Error,
    role: ArtifactRole,
    fallback_primitive: &'static str,
) -> NativeError {
    if let Some(injected) = error
        .get_ref()
        .and_then(|source| source.downcast_ref::<NativeError>())
    {
        return injected.clone();
    }
    if let Some(source) = error
        .get_ref()
        .and_then(|value| value.downcast_ref::<CleanupDurabilitySource>())
    {
        return durability_error(source.primitive, Some(role), source.as_io_error());
    }
    io_error(fallback_primitive, Some(role), error)
}

pub(crate) fn cleanup_durability_io(primitive: &'static str, error: io::Error) -> io::Error {
    io::Error::other(CleanupDurabilitySource {
        primitive,
        os_error_number: error.raw_os_error(),
        kind: error.kind(),
        message: error.to_string(),
    })
}

pub(crate) fn durability_error(
    primitive: &'static str,
    role: Option<ArtifactRole>,
    error: io::Error,
) -> NativeError {
    let unsupported = is_unsupported(&error);
    NativeError::from_io(
        if unsupported {
            "persistence.recovery.durability-unsupported"
        } else {
            "persistence.recovery.durability-failed"
        },
        primitive,
        role,
        error,
    )
}

pub(crate) fn rename_error(role: ArtifactRole, error: io::Error) -> NativeError {
    let unsupported = is_unsupported(&error);
    if matches!(
        error.kind(),
        io::ErrorKind::AlreadyExists | io::ErrorKind::NotFound
    ) {
        return NativeError::from_io(
            "persistence.recovery.target-changed",
            "rename-no-replace",
            Some(role),
            error,
        );
    }
    NativeError::from_io(
        if unsupported {
            "persistence.recovery.durability-unsupported"
        } else {
            "persistence.recovery.io-failed"
        },
        "rename-no-replace",
        Some(role),
        error,
    )
}

fn is_unsupported(error: &io::Error) -> bool {
    error.kind() == io::ErrorKind::Unsupported
        || matches!(error.raw_os_error(), Some(22 | 38 | 45 | 78 | 95 | 102))
}

#[derive(Debug)]
struct CleanupDurabilitySource {
    primitive: &'static str,
    os_error_number: Option<i32>,
    kind: io::ErrorKind,
    message: String,
}

impl CleanupDurabilitySource {
    fn as_io_error(&self) -> io::Error {
        self.os_error_number.map_or_else(
            || io::Error::new(self.kind, self.message.clone()),
            io::Error::from_raw_os_error,
        )
    }
}

impl fmt::Display for CleanupDurabilitySource {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for CleanupDurabilitySource {}

pub(crate) fn plan_error(message: impl Into<String>) -> NativeError {
    NativeError::new(
        "persistence.recovery.artifact-conflict",
        "validate-native-save-plan",
        None,
        message,
    )
}

pub(crate) fn artifact_conflict(
    primitive: &'static str,
    role: ArtifactRole,
    message: impl Into<String>,
) -> NativeError {
    NativeError::new(
        "persistence.recovery.artifact-conflict",
        primitive,
        Some(role),
        message,
    )
}

pub(crate) fn fingerprint_error(
    primitive: &'static str,
    role: ArtifactRole,
    message: impl Into<String>,
) -> NativeError {
    NativeError::new(
        "persistence.recovery.fingerprint-mismatch",
        primitive,
        Some(role),
        message,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_adapter_failures_to_stable_error_codes() {
        let unsupported_number = if cfg!(target_os = "macos") { 78 } else { 38 };
        assert_eq!(
            durability_error(
                "sync-test",
                Some(ArtifactRole::Target),
                io::Error::from_raw_os_error(unsupported_number),
            )
            .code,
            "persistence.recovery.durability-unsupported"
        );
        assert_eq!(
            durability_error(
                "sync-test",
                Some(ArtifactRole::Target),
                io::Error::from_raw_os_error(5),
            )
            .code,
            "persistence.recovery.durability-failed"
        );
        for number in [13, 18, 28, 30] {
            assert_eq!(
                io_error(
                    "syscall-test",
                    Some(ArtifactRole::Temporary),
                    io::Error::from_raw_os_error(number),
                )
                .code,
                "persistence.recovery.io-failed"
            );
        }
        assert_eq!(
            rename_error(ArtifactRole::Temporary, io::Error::from_raw_os_error(18)).code,
            "persistence.recovery.io-failed"
        );
        assert_eq!(
            rename_error(
                ArtifactRole::Temporary,
                io::Error::from_raw_os_error(unsupported_number),
            )
            .code,
            "persistence.recovery.durability-unsupported"
        );
    }
}
