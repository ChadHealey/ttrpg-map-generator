import {
  persistenceDiagnostic,
  persistenceFailure,
  persistenceSuccess,
} from './persistence-diagnostics.js';
import {
  PERSISTENCE_DIAGNOSTIC_CODES,
  type PersistenceDiagnosticCode,
  type PersistenceResult,
} from './persistence-model.js';

export function parseCoreValue<Value>(
  result:
    | { readonly ok: true; readonly value: Value }
    | {
        readonly ok: false;
        readonly diagnostic: { readonly code?: string; readonly message: string };
      },
  filePath: string,
  fieldPath: string,
  code: PersistenceDiagnosticCode = PERSISTENCE_DIAGNOSTIC_CODES.schemaInvalid,
): PersistenceResult<Value> {
  if (result.ok) return persistenceSuccess(result.value);
  const coreCode = result.diagnostic.code;
  return persistenceFailure(
    persistenceDiagnostic(
      code,
      filePath,
      fieldPath,
      `${coreCode === undefined ? '' : `${coreCode}: `}${result.diagnostic.message}`,
      'Restore the original canonical value without coercion, normalization, or repair.',
    ),
  );
}
