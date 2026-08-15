import { sha256 } from '@ttrpg-map/core';

import {
  persistenceDiagnostic,
  persistenceFailure,
  persistenceSuccess,
} from './persistence-diagnostics.js';
import {
  type CanonicalJsonValue,
  PERSISTENCE_DIAGNOSTIC_CODES,
  type PersistenceResult,
} from './persistence-model.js';

const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

/** Encode canonical UTF-8 JSON with ASCII-sorted keys, two spaces, LF, and one final newline. */
export function canonicalJsonBytes(
  value: unknown,
  filePath: string,
  fieldPath = '$',
): PersistenceResult<Uint8Array> {
  const canonical = canonicalizeJsonValue(value, filePath, fieldPath);
  if (!canonical.ok) return canonical;
  return persistenceSuccess(UTF8_ENCODER.encode(`${JSON.stringify(canonical.value, null, 2)}\n`));
}

/** Decode JSON bytes without normalizing malformed UTF-8, a BOM, or noncanonical JSON text. */
export function parseCanonicalJsonBytes(
  bytes: Uint8Array,
  filePath: string,
): PersistenceResult<unknown> {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return persistenceFailure(
      persistenceDiagnostic(
        PERSISTENCE_DIAGNOSTIC_CODES.jsonUtf8Invalid,
        filePath,
        '$',
        'Canonical JSON must be UTF-8 without a byte-order mark.',
        'Remove the UTF-8 BOM and regenerate the package with the v1 serializer.',
      ),
    );
  }

  let text: string;
  try {
    text = UTF8_DECODER.decode(bytes);
  } catch {
    return persistenceFailure(
      persistenceDiagnostic(
        PERSISTENCE_DIAGNOSTIC_CODES.jsonUtf8Invalid,
        filePath,
        '$',
        'The file is not valid UTF-8.',
        'Restore an uncorrupted UTF-8 package file.',
      ),
    );
  }

  try {
    return persistenceSuccess(JSON.parse(text) as unknown);
  } catch {
    return persistenceFailure(
      persistenceDiagnostic(
        PERSISTENCE_DIAGNOSTIC_CODES.jsonMalformed,
        filePath,
        '$',
        'The file is not valid JSON.',
        'Restore an uncorrupted canonical JSON package file.',
      ),
    );
  }
}

export function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}

export function sha256Hex(bytes: Uint8Array): string {
  return Array.from(sha256(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Validate the complete JSON data model without invoking accessors or reconstructing records. */
export function isCanonicalJsonValue(value: unknown): value is CanonicalJsonValue {
  return canonicalizeJsonValue(value, '$json', '$', new Set()).ok;
}

function canonicalizeJsonValue(
  value: unknown,
  filePath: string,
  fieldPath: string,
  ancestors = new Set<object>(),
): PersistenceResult<CanonicalJsonValue> {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return persistenceSuccess(value);
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      return noncanonicalNumber(filePath, fieldPath);
    }
    return persistenceSuccess(value);
  }
  if (Array.isArray(value)) {
    if (
      Object.getPrototypeOf(value) !== Array.prototype ||
      ancestors.has(value) ||
      !hasCanonicalArrayProperties(value)
    ) {
      return unsupportedValue(filePath, fieldPath);
    }
    ancestors.add(value);
    const items: CanonicalJsonValue[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !('value' in descriptor)) {
        ancestors.delete(value);
        return unsupportedValue(filePath, `${fieldPath}[${String(index)}]`);
      }
      const canonical = canonicalizeJsonValue(
        descriptor.value,
        filePath,
        `${fieldPath}[${String(index)}]`,
        ancestors,
      );
      if (!canonical.ok) {
        ancestors.delete(value);
        return canonical;
      }
      items.push(canonical.value);
    }
    ancestors.delete(value);
    return persistenceSuccess(items);
  }
  if (
    typeof value !== 'object' ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
    ancestors.has(value)
  ) {
    return unsupportedValue(filePath, fieldPath);
  }

  const keys = Object.keys(value).sort(compareText);
  if (Reflect.ownKeys(value).length !== keys.length) {
    return unsupportedValue(filePath, fieldPath);
  }
  ancestors.add(value);
  const record = Object.create(null) as Record<string, CanonicalJsonValue>;
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
      ancestors.delete(value);
      return unsupportedValue(filePath, jsonPropertyPath(fieldPath, key));
    }
    const property = canonicalizeJsonValue(
      descriptor.value,
      filePath,
      jsonPropertyPath(fieldPath, key),
      ancestors,
    );
    if (!property.ok) {
      ancestors.delete(value);
      return property;
    }
    Object.defineProperty(record, key, {
      configurable: true,
      enumerable: true,
      value: property.value,
      writable: true,
    });
  }
  ancestors.delete(value);
  return persistenceSuccess(record);
}

function hasCanonicalArrayProperties(value: readonly unknown[]): boolean {
  const keys = Object.keys(value);
  if (
    keys.length !== value.length ||
    keys.some((key, index) => key !== String(index)) ||
    Reflect.ownKeys(value).length !== value.length + 1
  ) {
    return false;
  }
  return keys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && descriptor.enumerable && 'value' in descriptor;
  });
}

function jsonPropertyPath(parent: string, key: string): string {
  return `${parent}[${JSON.stringify(key)}]`;
}

function noncanonicalNumber(filePath: string, fieldPath: string): PersistenceResult<never> {
  return persistenceFailure(
    persistenceDiagnostic(
      PERSISTENCE_DIAGNOSTIC_CODES.jsonNoncanonical,
      filePath,
      fieldPath,
      'Canonical v1 JSON numbers must be safe integers and cannot be negative zero.',
      'Quantize the value to its declared integer unit before encoding.',
    ),
  );
}

function unsupportedValue(filePath: string, fieldPath: string): PersistenceResult<never> {
  return persistenceFailure(
    persistenceDiagnostic(
      PERSISTENCE_DIAGNOSTIC_CODES.jsonNoncanonical,
      filePath,
      fieldPath,
      'Canonical v1 JSON contains only null, booleans, strings, safe integers, dense plain arrays, and plain data-property objects.',
      'Remove accessors, symbols, cycles, sparse entries, executable values, and exotic prototypes before encoding.',
    ),
  );
}

function compareText(left: string, right: string): -1 | 0 | 1 {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
