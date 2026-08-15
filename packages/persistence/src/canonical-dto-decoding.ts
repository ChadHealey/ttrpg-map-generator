import { type z } from 'zod';

import { bytesEqual, canonicalJsonBytes, parseCanonicalJsonBytes } from './canonical-json.js';
import {
  persistenceDiagnostic,
  persistenceFailure,
  persistenceSuccess,
} from './persistence-diagnostics.js';
import { PERSISTENCE_DIAGNOSTIC_CODES, type PersistenceResult } from './persistence-model.js';
import { validateDto } from './schema-validation.js';

export function decodeCanonicalDto<Value>(
  bytes: Uint8Array,
  filePath: string,
  schema: z.ZodType<Value>,
  order: (value: Value) => Value,
  versionFields: readonly VersionField[],
): PersistenceResult<Value> {
  const json = parseCanonicalJsonBytes(bytes, filePath);
  if (!json.ok) return json;
  const incompatible = findIncompatibleVersion(json.value, filePath, versionFields);
  if (incompatible !== undefined) return persistenceFailure(incompatible);
  const dto = validateDto(schema, json.value, filePath);
  if (!dto.ok) return dto;
  const ordered = order(dto.value);
  const canonical = canonicalJsonBytes(ordered, filePath);
  if (!canonical.ok) return canonical;
  if (!bytesEqual(bytes, canonical.value)) {
    return persistenceFailure(
      persistenceDiagnostic(
        PERSISTENCE_DIAGNOSTIC_CODES.jsonNoncanonical,
        filePath,
        '$',
        'JSON bytes do not use the canonical v1 key, collection, whitespace, or newline ordering.',
        'Regenerate the file with the v1 canonical serializer; do not hand-edit accepted evidence.',
      ),
    );
  }
  return persistenceSuccess(ordered);
}

export interface VersionField {
  readonly path: readonly string[];
  readonly expected: number | string;
}

function findIncompatibleVersion(
  value: unknown,
  filePath: string,
  fields: readonly VersionField[],
) {
  for (const field of fields) {
    const mismatch = findMismatch(value, field.path, field.expected, '$');
    if (mismatch !== undefined) {
      return persistenceDiagnostic(
        PERSISTENCE_DIAGNOSTIC_CODES.versionIncompatible,
        filePath,
        mismatch.path,
        `Unsupported v1 compatibility value ${JSON.stringify(mismatch.actual)}; expected ${JSON.stringify(field.expected)}.`,
        'Open the package with a compatible application or apply an explicit supported migration.',
      );
    }
  }
  return undefined;
}

function findMismatch(
  value: unknown,
  path: readonly string[],
  expected: number | string,
  fieldPath: string,
): { readonly actual: unknown; readonly path: string } | undefined {
  const [segment, ...remaining] = path;
  if (segment === undefined) {
    return value === undefined || value === expected
      ? undefined
      : { actual: value, path: fieldPath };
  }
  if (segment === '*') {
    if (!Array.isArray(value)) return undefined;
    for (const [index, item] of value.entries()) {
      const mismatch = findMismatch(item, remaining, expected, `${fieldPath}[${String(index)}]`);
      if (mismatch !== undefined) return mismatch;
    }
    return undefined;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return findMismatch(
    (value as Readonly<Record<string, unknown>>)[segment],
    remaining,
    expected,
    `${fieldPath}.${segment}`,
  );
}
