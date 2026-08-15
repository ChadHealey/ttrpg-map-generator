use super::model::{ArtifactObservation, ObservationKind};
use super::sha256::sha256_hex;

pub(crate) fn observation(kind: ObservationKind) -> ArtifactObservation {
    let mut bytes = Vec::new();
    match &kind {
        ObservationKind::Absent => bytes.extend_from_slice(b"absent\0"),
        ObservationKind::Directory(entries) => {
            bytes.extend_from_slice(b"directory\0");
            for entry in entries {
                append_token(&mut bytes, &entry.path);
                bytes.extend_from_slice(&(entry.bytes.len() as u64).to_be_bytes());
                bytes.extend_from_slice(&entry.bytes);
            }
        }
        ObservationKind::InvalidDirectory {
            entries,
            directories,
        } => {
            bytes.extend_from_slice(b"invalid-directory\0");
            for directory in directories {
                append_token(&mut bytes, directory);
            }
            for entry in entries {
                append_token(&mut bytes, &entry.path);
                bytes.extend_from_slice(&(entry.bytes.len() as u64).to_be_bytes());
                bytes.extend_from_slice(&entry.bytes);
            }
        }
        ObservationKind::RegularFile(value) => {
            bytes.extend_from_slice(b"regular-file\0");
            bytes.extend_from_slice(&(value.len() as u64).to_be_bytes());
            bytes.extend_from_slice(value);
        }
        ObservationKind::Symlink => bytes.extend_from_slice(b"symlink\0"),
        ObservationKind::Special => bytes.extend_from_slice(b"special\0"),
        ObservationKind::Unreadable(context) => {
            bytes.extend_from_slice(b"unreadable\0");
            append_token(&mut bytes, &context.primitive);
            bytes.extend_from_slice(&context.os_error_number.unwrap_or_default().to_be_bytes());
        }
    }
    ArtifactObservation {
        observation_token: sha256_hex(&bytes),
        kind,
    }
}

pub(crate) fn append_token(output: &mut Vec<u8>, value: &str) {
    output.extend_from_slice(&(value.len() as u64).to_be_bytes());
    output.extend_from_slice(value.as_bytes());
}
