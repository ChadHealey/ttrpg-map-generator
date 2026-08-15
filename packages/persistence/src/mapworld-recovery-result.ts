import {
  type MapworldRecoveryCode,
  type MapworldRecoveryError,
  type MapworldRecoveryResult,
} from './mapworld-recovery-model.js';

export function recoverySuccess<Value>(value: Value): MapworldRecoveryResult<Value> {
  return Object.freeze({ ok: true, value });
}

export function recoveryFailure<Value>(
  code: MapworldRecoveryCode,
  message: string,
  suggestedAction: string,
  context: Omit<MapworldRecoveryError, 'code' | 'message' | 'suggestedAction'> = {},
): MapworldRecoveryResult<Value> {
  return Object.freeze({
    ok: false,
    error: Object.freeze({ code, message, suggestedAction, ...context }),
  });
}
