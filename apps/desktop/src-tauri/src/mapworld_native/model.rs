use std::io;
use std::{error, fmt};

use super::base64::encode_base64;
use super::platform_ffi;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ArtifactRole {
    Target,
    Temporary,
    Backup,
    Marker,
}

impl ArtifactRole {
    pub const ALL: [Self; 4] = [Self::Target, Self::Temporary, Self::Backup, Self::Marker];

    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Target => "target",
            Self::Temporary => "temporary",
            Self::Backup => "backup",
            Self::Marker => "marker",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|role| role.as_str() == value)
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NativeFileEntry {
    pub path: String,
    pub bytes: Vec<u8>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OsContext {
    pub primitive: String,
    pub os_error_number: Option<i32>,
    pub os_error_name: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ObservationKind {
    Absent,
    Directory(Vec<NativeFileEntry>),
    InvalidDirectory {
        entries: Vec<NativeFileEntry>,
        directories: Vec<String>,
    },
    RegularFile(Vec<u8>),
    Symlink,
    Special,
    Unreadable(OsContext),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ArtifactObservation {
    pub observation_token: String,
    pub kind: ObservationKind,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NativeSnapshot {
    pub target_name: String,
    pub snapshot_id: String,
    pub target: ArtifactObservation,
    pub temporary: ArtifactObservation,
    pub backup: ArtifactObservation,
    pub marker: ArtifactObservation,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NativeSelectedCandidate {
    pub role: String,
    pub observation_token: String,
    pub manifest_sha256: String,
}

impl NativeSnapshot {
    pub fn observation(&self, role: ArtifactRole) -> &ArtifactObservation {
        match role {
            ArtifactRole::Target => &self.target,
            ArtifactRole::Temporary => &self.temporary,
            ArtifactRole::Backup => &self.backup,
            ArtifactRole::Marker => &self.marker,
        }
    }

    pub fn success_json(&self) -> String {
        format!(
            "{{\"ok\":true,\"snapshot\":{{\"targetName\":{},\"snapshotId\":{},\"target\":{},\"temporary\":{},\"backup\":{},\"marker\":{}}}}}",
            quoted(&self.target_name),
            quoted(&self.snapshot_id),
            self.target.to_json(),
            self.temporary.to_json(),
            self.backup.to_json(),
            self.marker.to_json(),
        )
    }

    pub fn result_json(&self, kind: &str) -> String {
        format!(
            "{{\"ok\":true,\"result\":{{\"kind\":{},\"snapshotId\":{},\"platform\":{}}}}}",
            quoted(kind),
            quoted(&self.snapshot_id),
            quoted(platform_ffi::platform_name()),
        )
    }
}

impl ArtifactObservation {
    pub fn to_json(&self) -> String {
        let common = format!("\"observationToken\":{}", quoted(&self.observation_token));
        match &self.kind {
            ObservationKind::Absent => {
                format!("{{{common},\"kind\":\"absent\"}}")
            }
            ObservationKind::Directory(entries) => {
                if entries.is_empty() {
                    return format!("{{{common},\"kind\":\"empty-directory\"}}");
                }
                let entries = entries
                    .iter()
                    .map(NativeFileEntry::to_json)
                    .collect::<Vec<_>>()
                    .join(",");
                format!("{{{common},\"kind\":\"directory\",\"entries\":[{entries}]}}")
            }
            ObservationKind::InvalidDirectory {
                entries,
                directories,
            } => {
                let entries = entries
                    .iter()
                    .map(NativeFileEntry::to_json)
                    .collect::<Vec<_>>()
                    .join(",");
                let directories = directories
                    .iter()
                    .map(|path| quoted(path))
                    .collect::<Vec<_>>()
                    .join(",");
                format!(
                    "{{{common},\"kind\":\"invalid-directory\",\"entries\":[{entries}],\"directories\":[{directories}]}}"
                )
            }
            ObservationKind::RegularFile(bytes) => format!(
                "{{{common},\"kind\":\"regular-file\",\"bytes\":{}}}",
                quoted(&encode_base64(bytes))
            ),
            ObservationKind::Symlink => {
                format!("{{{common},\"kind\":\"symlink\"}}")
            }
            ObservationKind::Special => {
                format!("{{{common},\"kind\":\"special\"}}")
            }
            ObservationKind::Unreadable(context) => format!(
                "{{{common},\"kind\":\"unreadable\",\"osContext\":{}}}",
                context.to_json()
            ),
        }
    }
}

impl NativeFileEntry {
    fn to_json(&self) -> String {
        format!(
            "{{\"path\":{},\"bytes\":{}}}",
            quoted(&self.path),
            quoted(&encode_base64(&self.bytes))
        )
    }
}

impl OsContext {
    fn to_json(&self) -> String {
        format!(
            "{{\"primitive\":{},\"osErrorNumber\":{},\"osErrorName\":{}}}",
            quoted(&self.primitive),
            optional_number(self.os_error_number),
            optional_string(self.os_error_name.as_deref()),
        )
    }

    pub fn from_io(primitive: &str, error: &io::Error) -> Self {
        let number = error.raw_os_error();
        Self {
            primitive: primitive.to_owned(),
            os_error_number: number,
            os_error_name: number.map(errno_name).map(str::to_owned),
        }
    }

    pub fn synthetic(primitive: &str) -> Self {
        Self {
            primitive: primitive.to_owned(),
            os_error_number: None,
            os_error_name: None,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NativeError {
    pub code: &'static str,
    pub primitive: String,
    pub role: Option<ArtifactRole>,
    pub os_error_number: Option<i32>,
    pub os_error_name: Option<String>,
    pub message: String,
}

impl fmt::Display for NativeError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}: {}", self.primitive, self.message)
    }
}

impl error::Error for NativeError {}

impl NativeError {
    pub fn new(
        code: &'static str,
        primitive: impl Into<String>,
        role: Option<ArtifactRole>,
        message: impl Into<String>,
    ) -> Self {
        Self {
            code,
            primitive: primitive.into(),
            role,
            os_error_number: None,
            os_error_name: None,
            message: message.into(),
        }
    }

    pub fn from_io(
        code: &'static str,
        primitive: impl Into<String>,
        role: Option<ArtifactRole>,
        error: io::Error,
    ) -> Self {
        let number = error.raw_os_error();
        Self {
            code,
            primitive: primitive.into(),
            role,
            os_error_number: number,
            os_error_name: number.map(errno_name).map(str::to_owned),
            message: error.to_string(),
        }
    }

    pub fn injected(point: u8, primitive: &str, phase: &str) -> Self {
        Self::new(
            "persistence.recovery.io-failed",
            format!("fault-P{point:02}-{primitive}"),
            None,
            format!("injected {phase}-operation error at P{point:02}"),
        )
    }

    pub fn terminated(point: u8, primitive: &str) -> Self {
        Self::new(
            "persistence.recovery.io-failed",
            format!("termination-P{point:02}-{primitive}"),
            None,
            format!("simulated termination after P{point:02}"),
        )
    }

    pub fn to_json(&self) -> String {
        format!(
            "{{\"ok\":false,\"error\":{{\"code\":{},\"primitive\":{},\"role\":{},\"osErrorNumber\":{},\"osErrorName\":{},\"message\":{},\"platform\":{}}}}}",
            quoted(self.code),
            quoted(&self.primitive),
            optional_string(self.role.map(ArtifactRole::as_str)),
            optional_number(self.os_error_number),
            optional_string(self.os_error_name.as_deref()),
            quoted(&self.message),
            quoted(platform_ffi::platform_name()),
        )
    }
}

pub(crate) fn quoted(value: &str) -> String {
    let mut output = String::with_capacity(value.len() + 2);
    output.push('"');
    for character in value.chars() {
        match character {
            '"' => output.push_str("\\\""),
            '\\' => output.push_str("\\\\"),
            '\n' => output.push_str("\\n"),
            '\r' => output.push_str("\\r"),
            '\t' => output.push_str("\\t"),
            value if value <= '\u{001f}' => {
                use std::fmt::Write as _;
                write!(&mut output, "\\u{:04x}", u32::from(value))
                    .expect("writing to String cannot fail");
            }
            value => output.push(value),
        }
    }
    output.push('"');
    output
}

fn optional_string(value: Option<&str>) -> String {
    value.map_or_else(|| "null".to_owned(), quoted)
}

fn optional_number(value: Option<i32>) -> String {
    value.map_or_else(|| "null".to_owned(), |number| number.to_string())
}

fn errno_name(number: i32) -> &'static str {
    match number {
        1 => "EPERM",
        2 => "ENOENT",
        4 => "EINTR",
        5 => "EIO",
        13 => "EACCES",
        17 => "EEXIST",
        18 => "EXDEV",
        20 => "ENOTDIR",
        21 => "EISDIR",
        22 => "EINVAL",
        28 => "ENOSPC",
        30 => "EROFS",
        35 if cfg!(target_os = "macos") => "EAGAIN",
        38 if cfg!(target_os = "linux") => "ENOSYS",
        40 if cfg!(target_os = "linux") => "ELOOP",
        45 if cfg!(target_os = "macos") => "ENOTSUP",
        62 if cfg!(target_os = "macos") => "ELOOP",
        78 if cfg!(target_os = "macos") => "ENOSYS",
        95 if cfg!(target_os = "linux") => "EOPNOTSUPP",
        102 if cfg!(target_os = "macos") => "EOPNOTSUPP",
        _ => "UNKNOWN",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn escapes_json_without_a_serialization_dependency() {
        assert_eq!(quoted("a\n\"\\b"), "\"a\\n\\\"\\\\b\"");
    }

    #[test]
    fn maps_portable_durability_errnos_to_stable_names() {
        for (number, expected) in [
            (4, "EINTR"),
            (5, "EIO"),
            (13, "EACCES"),
            (17, "EEXIST"),
            (18, "EXDEV"),
            (28, "ENOSPC"),
            (30, "EROFS"),
        ] {
            let error = NativeError::from_io(
                "persistence.recovery.io-failed",
                "test-primitive",
                Some(ArtifactRole::Target),
                io::Error::from_raw_os_error(number),
            );
            assert_eq!(error.code, "persistence.recovery.io-failed");
            assert_eq!(error.primitive, "test-primitive");
            assert_eq!(error.role, Some(ArtifactRole::Target));
            assert_eq!(error.os_error_number, Some(number));
            assert_eq!(error.os_error_name.as_deref(), Some(expected));
        }
    }

    #[test]
    fn maps_platform_no_follow_and_unsupported_errnos() {
        let platform_cases = if cfg!(target_os = "macos") {
            [(62, "ELOOP"), (45, "ENOTSUP"), (78, "ENOSYS")]
        } else {
            [(40, "ELOOP"), (95, "EOPNOTSUPP"), (38, "ENOSYS")]
        };
        for (number, expected) in platform_cases {
            assert_eq!(errno_name(number), expected);
        }
    }
}
