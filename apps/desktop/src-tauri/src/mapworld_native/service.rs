use super::base64::{canonical_base64_decoded_length, decode_canonical_base64};
use super::filesystem::ParentSession;
use super::model::{NativeError, NativeSelectedCandidate, NativeSnapshot};
use super::sha256::sha256_hex;
use super::{
    NATIVE_MAX_FILE_BYTES, NATIVE_MAX_MARKER_BYTES, NATIVE_MAX_PACKAGE_BYTES,
    NATIVE_MAX_PACKAGE_FILES,
};

pub use super::recovery::apply_recovery_plan;
pub use super::save::execute_save;

#[derive(Clone, Debug)]
pub struct NativeSaveRequest {
    pub target_path: String,
    pub operation: String,
    pub expected_previous_manifest_sha256: Option<String>,
    pub expected_previous_observation_token: Option<String>,
    pub candidate_manifest_sha256: String,
    pub marker_bytes: Vec<u8>,
    pub relative_paths: Vec<String>,
    pub file_bytes: Vec<Vec<u8>>,
}

#[tauri::command]
pub fn mapworld_native_snapshot(target_path: String) -> String {
    match snapshot_target(&target_path) {
        Ok(snapshot) => snapshot.success_json(),
        Err(error) => error.to_json(),
    }
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn mapworld_native_save(
    target_path: String,
    operation: String,
    expected_previous_manifest_sha256: Option<String>,
    expected_previous_observation_token: Option<String>,
    candidate_manifest_sha256: String,
    marker_bytes: Vec<u8>,
    relative_paths: Vec<String>,
    file_bytes: Vec<Vec<u8>>,
) -> String {
    let request = NativeSaveRequest {
        target_path,
        operation,
        expected_previous_manifest_sha256,
        expected_previous_observation_token,
        candidate_manifest_sha256,
        marker_bytes,
        relative_paths,
        file_bytes,
    };
    match execute_save(&request, None) {
        Ok(snapshot) => snapshot.result_json("saved"),
        Err(error) => error.to_json(),
    }
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn mapworld_native_save_base64(
    target_path: String,
    operation: String,
    expected_previous_manifest_sha256: Option<String>,
    expected_previous_observation_token: Option<String>,
    candidate_manifest_sha256: String,
    marker_base64: String,
    relative_paths: Vec<String>,
    file_bytes_base64: Vec<String>,
) -> String {
    let marker_bytes = match decode_canonical_base64(&marker_base64, NATIVE_MAX_MARKER_BYTES) {
        Ok(bytes) => bytes,
        Err(()) => return invalid_base64_transport(),
    };
    let file_bytes = match decode_base64_files_with_limits(
        file_bytes_base64,
        NATIVE_MAX_PACKAGE_FILES,
        NATIVE_MAX_FILE_BYTES,
        NATIVE_MAX_PACKAGE_BYTES,
    ) {
        Ok(bytes) => bytes,
        Err(()) => return invalid_base64_transport(),
    };
    mapworld_native_save(
        target_path,
        operation,
        expected_previous_manifest_sha256,
        expected_previous_observation_token,
        candidate_manifest_sha256,
        marker_bytes,
        relative_paths,
        file_bytes,
    )
}

fn decode_base64_files_with_limits(
    values: Vec<String>,
    maximum_files: usize,
    maximum_file_bytes: usize,
    maximum_package_bytes: usize,
) -> Result<Vec<Vec<u8>>, ()> {
    if values.len() > maximum_files {
        return Err(());
    }
    let mut total_bytes = 0_usize;
    let mut decoded = Vec::with_capacity(values.len());
    for value in values {
        let byte_length = canonical_base64_decoded_length(&value)?;
        if byte_length > maximum_file_bytes {
            return Err(());
        }
        let next_total = total_bytes.checked_add(byte_length).ok_or(())?;
        if next_total > maximum_package_bytes {
            return Err(());
        }
        decoded.push(decode_canonical_base64(&value, maximum_file_bytes)?);
        total_bytes = next_total;
    }
    Ok(decoded)
}

fn invalid_base64_transport() -> String {
    NativeError::new(
        "persistence.recovery.artifact-conflict",
        "decode-save-transport",
        None,
        "native save base64 payload is malformed or exceeds its byte limit",
    )
    .to_json()
}

#[tauri::command]
pub fn mapworld_native_apply(
    target_path: String,
    expected_snapshot_id: String,
    selected_role: Option<String>,
    selected_observation_token: Option<String>,
    selected_manifest_sha256: Option<String>,
    steps: Vec<String>,
    confirmation_tokens: Vec<String>,
) -> String {
    let selected_candidate = match (
        selected_role,
        selected_observation_token,
        selected_manifest_sha256,
    ) {
        (None, None, None) => None,
        (Some(role), Some(observation_token), Some(manifest_sha256)) => {
            Some(NativeSelectedCandidate {
                role,
                observation_token,
                manifest_sha256,
            })
        }
        _ => {
            return NativeError::new(
                "persistence.recovery.artifact-conflict",
                "validate-selected-candidate",
                None,
                "selected candidate DTO fields must be all present or all absent",
            )
            .to_json();
        }
    };
    match apply_recovery_plan(
        &target_path,
        &expected_snapshot_id,
        &steps,
        &confirmation_tokens,
        selected_candidate.as_ref(),
    ) {
        Ok(snapshot) => snapshot.result_json("applied"),
        Err(error) => error.to_json(),
    }
}

pub fn snapshot_target(target_path: &str) -> Result<NativeSnapshot, NativeError> {
    let session = ParentSession::open_locked(target_path)?;
    Ok(session.snapshot())
}

pub fn manifest_fingerprint_bytes(bytes: &[u8]) -> String {
    sha256_hex(bytes)
}

#[cfg(test)]
mod tests {
    use super::decode_base64_files_with_limits;

    #[test]
    fn rejects_aggregate_base64_transport_before_retaining_bytes_beyond_the_limit() {
        let values = vec!["AQID".to_owned(), "BAUG".to_owned()];
        assert!(decode_base64_files_with_limits(values.clone(), 2, 3, 5).is_err());
        assert_eq!(
            decode_base64_files_with_limits(values, 2, 3, 6),
            Ok(vec![vec![1, 2, 3], vec![4, 5, 6]])
        );
    }
}
