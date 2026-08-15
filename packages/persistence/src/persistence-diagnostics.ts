import {
  type PersistenceDiagnostic,
  type PersistenceDiagnosticCode,
  type PersistenceResult,
} from './persistence-model.js';

export function persistenceDiagnostic(
  code: PersistenceDiagnosticCode,
  filePath: string,
  fieldPath: string,
  message: string,
  suggestedAction: string,
): PersistenceDiagnostic {
  return Object.freeze({ code, filePath, fieldPath, message, suggestedAction });
}

export function persistenceFailure<Value>(
  ...diagnostics: readonly PersistenceDiagnostic[]
): PersistenceResult<Value> {
  return Object.freeze({ ok: false, diagnostics: Object.freeze([...diagnostics]) });
}

export function persistenceSuccess<Value>(value: Value): PersistenceResult<Value> {
  return Object.freeze({ ok: true, value });
}

export function comparePersistenceDiagnostics(
  left: PersistenceDiagnostic,
  right: PersistenceDiagnostic,
): number {
  return (
    compareText(left.filePath, right.filePath) ||
    compareText(left.fieldPath, right.fieldPath) ||
    compareText(left.code, right.code) ||
    compareText(left.message, right.message)
  );
}

function compareText(left: string, right: string): -1 | 0 | 1 {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
