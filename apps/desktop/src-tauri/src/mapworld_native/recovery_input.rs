use super::model::NativeError;
use super::{
    NATIVE_MAX_CONFIRMATION_TOKEN_BYTES, NATIVE_MAX_CONFIRMATION_TOKENS,
    NATIVE_MAX_RECOVERY_STEP_BYTES, NATIVE_MAX_RECOVERY_STEPS,
};

pub(crate) fn validate_recovery_inputs(
    steps: &[String],
    confirmation_tokens: &[String],
) -> Result<(), NativeError> {
    if steps.len() > NATIVE_MAX_RECOVERY_STEPS
        || steps
            .iter()
            .any(|step| step.len() > NATIVE_MAX_RECOVERY_STEP_BYTES || !supported_step(step))
    {
        return Err(NativeError::new(
            "persistence.recovery.artifact-conflict",
            "validate-recovery-plan",
            None,
            "native recovery steps are too numerous, oversized, or unsupported",
        ));
    }
    if confirmation_tokens.len() > NATIVE_MAX_CONFIRMATION_TOKENS
        || confirmation_tokens
            .iter()
            .enumerate()
            .any(|(index, token)| {
                token.len() > NATIVE_MAX_CONFIRMATION_TOKEN_BYTES
                    || !valid_confirmation_token(token)
                    || confirmation_tokens[..index].contains(token)
            })
    {
        return Err(NativeError::new(
            "persistence.recovery.artifact-conflict",
            "validate-confirmation-tokens",
            None,
            "confirmation tokens are too numerous, duplicated, oversized, or malformed",
        ));
    }
    Ok(())
}

pub(crate) fn is_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn supported_step(step: &str) -> bool {
    matches!(
        step,
        "sync-target-commit"
            | "rename-temporary-to-target"
            | "rename-target-to-backup"
            | "rename-backup-to-target"
            | "remove-temporary-exact-candidate"
            | "remove-backup-exact-previous"
            | "remove-temporary-empty"
            | "remove-backup-empty"
            | "remove-marker"
            | "remove-confirmed-target"
            | "remove-confirmed-temporary"
            | "remove-confirmed-backup"
            | "remove-confirmed-marker"
    )
}

fn valid_confirmation_token(value: &str) -> bool {
    let mut fields = value.split('|');
    let role = fields.next();
    let observation = fields.next();
    let fingerprint = fields.next();
    matches!(role, Some("target" | "temporary" | "backup" | "marker"))
        && observation.is_some_and(is_sha256)
        && match role {
            Some("marker") => fingerprint.is_none(),
            _ => fingerprint.is_none_or(is_sha256),
        }
        && fields.next().is_none()
}
