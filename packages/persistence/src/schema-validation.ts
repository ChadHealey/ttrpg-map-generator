import { type z } from 'zod';

import {
  comparePersistenceDiagnostics,
  persistenceDiagnostic,
  persistenceFailure,
  persistenceSuccess,
} from './persistence-diagnostics.js';
import { PERSISTENCE_DIAGNOSTIC_CODES, type PersistenceResult } from './persistence-model.js';

export function validateDto<Value>(
  schema: z.ZodType<Value>,
  input: unknown,
  filePath: string,
  schemaVersion: 'v1' | 'v2' = 'v1',
): PersistenceResult<Value> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return persistenceSuccess(parsed.data);

  const diagnostics = parsed.error.issues
    .map((issue) =>
      persistenceDiagnostic(
        PERSISTENCE_DIAGNOSTIC_CODES.schemaInvalid,
        filePath,
        formatZodPath(issue.path),
        `The persisted record does not match the strict ${schemaVersion} schema: ${issue.message}`,
        `Restore a compatible ${schemaVersion} record without unknown, missing, or malformed fields.`,
      ),
    )
    .sort(comparePersistenceDiagnostics);
  return persistenceFailure(...diagnostics);
}

function formatZodPath(path: readonly PropertyKey[]): string {
  let formatted = '$';
  for (const segment of path) {
    if (typeof segment === 'number') {
      formatted += `[${String(segment)}]`;
    } else if (typeof segment === 'string' && /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(segment)) {
      formatted += `.${segment}`;
    } else {
      formatted += `[${JSON.stringify(String(segment))}]`;
    }
  }
  return formatted;
}
