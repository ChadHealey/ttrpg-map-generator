use std::collections::BTreeSet;

use super::adapter_error::{artifact_conflict, fingerprint_error, plan_error};
use super::model::{ArtifactRole, NativeError, NativeFileEntry, NativeSnapshot, ObservationKind};
use super::service::NativeSaveRequest;
use super::sha256::sha256_hex;
use super::{
    NATIVE_MAX_BASENAME_BYTES, NATIVE_MAX_DIRECTORY_DEPTH, NATIVE_MAX_FILE_BYTES,
    NATIVE_MAX_MARKER_BYTES, NATIVE_MAX_PACKAGE_BYTES, NATIVE_MAX_PACKAGE_FILES,
    NATIVE_MAX_RELATIVE_PATH_BYTES,
};

pub(crate) fn validate_save_request(
    request: &NativeSaveRequest,
) -> Result<Vec<NativeFileEntry>, NativeError> {
    if !matches!(
        request.operation.as_str(),
        "first-save" | "replacement-save"
    ) {
        return Err(plan_error("save operation is not supported"));
    }
    if request.operation == "first-save" && request.expected_previous_manifest_sha256.is_some() {
        return Err(plan_error(
            "first save cannot name a previous manifest fingerprint",
        ));
    }
    if request.operation == "first-save" && request.expected_previous_observation_token.is_some() {
        return Err(plan_error(
            "first save cannot name a previous observation token",
        ));
    }
    if request.operation == "replacement-save"
        && request.expected_previous_manifest_sha256.is_none()
    {
        return Err(plan_error(
            "replacement save requires the previous manifest fingerprint",
        ));
    }
    if request.operation == "replacement-save"
        && request
            .expected_previous_observation_token
            .as_deref()
            .is_none_or(|value| !is_sha256(value))
    {
        return Err(plan_error(
            "replacement save requires a lowercase SHA-256 previous observation token",
        ));
    }
    if !is_sha256(&request.candidate_manifest_sha256)
        || request
            .expected_previous_manifest_sha256
            .as_deref()
            .is_some_and(|value| !is_sha256(value))
    {
        return Err(plan_error("manifest fingerprint is not lowercase SHA-256"));
    }
    if request.marker_bytes.len() > NATIVE_MAX_MARKER_BYTES {
        return Err(plan_error("marker byte limit exceeded"));
    }
    if request.relative_paths.len() != request.file_bytes.len()
        || request.relative_paths.is_empty()
        || request.relative_paths.len() > NATIVE_MAX_PACKAGE_FILES
    {
        return Err(plan_error(
            "package file arrays are empty, unequal, or too large",
        ));
    }
    let mut entries = Vec::with_capacity(request.relative_paths.len());
    let mut seen = BTreeSet::new();
    let mut total = 0_usize;
    for (path, bytes) in request.relative_paths.iter().zip(&request.file_bytes) {
        validate_relative_path(path)?;
        if !seen.insert(path.clone()) {
            return Err(plan_error("package contains a duplicate relative path"));
        }
        if bytes.len() > NATIVE_MAX_FILE_BYTES {
            return Err(plan_error("authoritative file byte limit exceeded"));
        }
        total = total.saturating_add(bytes.len());
        if total > NATIVE_MAX_PACKAGE_BYTES {
            return Err(plan_error("package byte limit exceeded"));
        }
        entries.push(NativeFileEntry {
            path: path.clone(),
            bytes: bytes.clone(),
        });
    }
    entries.sort_by(|left, right| left.path.cmp(&right.path));
    let manifest = entries
        .iter()
        .find(|entry| entry.path == "manifest.json")
        .ok_or_else(|| plan_error("package has no manifest.json"))?;
    if sha256_hex(&manifest.bytes) != request.candidate_manifest_sha256 {
        return Err(fingerprint_error(
            "validate-candidate-fingerprint",
            ArtifactRole::Temporary,
            "candidate manifest bytes do not match the supplied fingerprint",
        ));
    }
    Ok(entries)
}

pub(crate) fn preflight_save(
    request: &NativeSaveRequest,
    snapshot: &NativeSnapshot,
) -> Result<(), NativeError> {
    for role in [
        ArtifactRole::Temporary,
        ArtifactRole::Backup,
        ArtifactRole::Marker,
    ] {
        if !matches!(snapshot.observation(role).kind, ObservationKind::Absent) {
            return Err(artifact_conflict(
                "preflight-recovery-artifacts",
                role,
                "pre-existing recovery artifact must be recovered first",
            ));
        }
    }
    match request.operation.as_str() {
        "first-save" if !matches!(snapshot.target.kind, ObservationKind::Absent) => {
            Err(artifact_conflict(
                "preflight-first-save",
                ArtifactRole::Target,
                "first-save target already exists",
            ))
        }
        "replacement-save" => preflight_replacement(request, snapshot),
        _ => Ok(()),
    }
}

fn preflight_replacement(
    request: &NativeSaveRequest,
    snapshot: &NativeSnapshot,
) -> Result<(), NativeError> {
    let entries = match &snapshot.target.kind {
        ObservationKind::Directory(entries) => entries,
        _ => {
            return Err(artifact_conflict(
                "preflight-replacement",
                ArtifactRole::Target,
                "replacement target is not a readable package directory",
            ));
        }
    };
    let actual = manifest_fingerprint(entries).ok_or_else(|| {
        fingerprint_error(
            "preflight-target-manifest",
            ArtifactRole::Target,
            "replacement target has no manifest.json",
        )
    })?;
    if Some(actual.as_str()) != request.expected_previous_manifest_sha256.as_deref() {
        return Err(NativeError::new(
            "persistence.recovery.target-changed",
            "preflight-target-fingerprint",
            Some(ArtifactRole::Target),
            "replacement target differs from the last opened fingerprint",
        ));
    }
    if Some(snapshot.target.observation_token.as_str())
        != request.expected_previous_observation_token.as_deref()
    {
        return Err(NativeError::new(
            "persistence.recovery.target-changed",
            "preflight-target-observation",
            Some(ArtifactRole::Target),
            "replacement target bytes differ from the last opened observation",
        ));
    }
    Ok(())
}

pub(crate) fn manifest_fingerprint(entries: &[NativeFileEntry]) -> Option<String> {
    entries
        .iter()
        .find(|entry| entry.path == "manifest.json")
        .map(|entry| sha256_hex(&entry.bytes))
}

fn validate_relative_path(path: &str) -> Result<(), NativeError> {
    if path.is_empty()
        || path.len() > NATIVE_MAX_RELATIVE_PATH_BYTES
        || path.starts_with('/')
        || path.ends_with('/')
        || path.contains('\0')
        || path.contains('\\')
    {
        return Err(plan_error(
            "package relative path is not representable safely",
        ));
    }
    let segments = path.split('/').collect::<Vec<_>>();
    if segments.len().saturating_sub(1) > NATIVE_MAX_DIRECTORY_DEPTH
        || segments.iter().any(|segment| {
            segment.is_empty()
                || *segment == "."
                || *segment == ".."
                || segment.len() > NATIVE_MAX_BASENAME_BYTES
        })
    {
        return Err(plan_error("package relative path has an invalid component"));
    }
    Ok(())
}

fn is_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(path: &str) -> NativeSaveRequest {
        NativeSaveRequest {
            target_path: "/tmp/Test.mapworld".to_owned(),
            operation: "first-save".to_owned(),
            expected_previous_manifest_sha256: None,
            expected_previous_observation_token: None,
            candidate_manifest_sha256: "0".repeat(64),
            marker_bytes: Vec::new(),
            relative_paths: vec![path.to_owned()],
            file_bytes: vec![Vec::new()],
        }
    }

    #[test]
    fn rejects_parent_traversal_in_native_save_paths() {
        let error =
            validate_save_request(&request("../manifest.json")).expect_err("must reject traversal");
        assert_eq!(error.code, "persistence.recovery.artifact-conflict");
    }

    #[test]
    fn rejects_portably_ambiguous_backslashes_in_native_save_paths() {
        let error = validate_save_request(&request("maps\\manifest.json"))
            .expect_err("must reject backslash paths");
        assert_eq!(error.code, "persistence.recovery.artifact-conflict");
    }
}
