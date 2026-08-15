use super::filesystem::ParentSession;
use super::model::{NativeError, NativeSelectedCandidate, NativeSnapshot};
use super::sha256::sha256_hex;

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
