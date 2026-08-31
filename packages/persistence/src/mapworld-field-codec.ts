import {
  createDictionaryWorldPhysicalFieldReader,
  createNumericWorldPhysicalFieldReader,
  isWorldPhysicalFieldReader,
  type WorldPhysicalDictionaryIndexStorage,
  type WorldPhysicalFieldReader,
  type WorldPhysicalNumericStorage,
} from '@ttrpg-map/core';

import { MAPWORLD_NATIVE_LIMITS } from './mapworld-recovery-model.js';
import {
  persistenceDiagnostic,
  persistenceFailure,
  persistenceSuccess,
} from './persistence-diagnostics.js';
import {
  MAPWORLD_FIELD_FILE_SCHEMA_VERSION,
  PERSISTENCE_DIAGNOSTIC_CODES,
  type PersistenceResult,
} from './persistence-model.js';

const HEADER_BYTES = 32;
const MAGIC = new TextEncoder().encode('MWFIELD2');

export type MapworldFieldEncoding =
  'i16' | 'i32' | 'u16' | 'u32' | 'dictionary-u8' | 'dictionary-u16' | 'dictionary-u32';

export interface MapworldFieldDescriptor {
  readonly byteOrder: 'little-endian';
  readonly fieldFileSchemaVersion: typeof MAPWORLD_FIELD_FILE_SCHEMA_VERSION;
  readonly path: string;
  readonly sampleCount: number;
  readonly storageKind: 'mapworld-field-binary';
  readonly valueEncoding: MapworldFieldEncoding;
  readonly dictionary?: readonly string[];
}

const ENCODINGS = Object.freeze({
  i16: { code: 1, width: 2, minimum: -0x8000, maximum: 0x7fff },
  i32: { code: 2, width: 4, minimum: -0x8000_0000, maximum: 0x7fff_ffff },
  u16: { code: 3, width: 2, minimum: 0, maximum: 0xffff },
  u32: { code: 4, width: 4, minimum: 0, maximum: 0xffff_ffff },
  'dictionary-u8': { code: 5, width: 1, minimum: 0, maximum: 0xff },
  'dictionary-u16': { code: 6, width: 2, minimum: 0, maximum: 0xffff },
  'dictionary-u32': { code: 7, width: 4, minimum: 0, maximum: 0xffff_ffff },
} as const);

export function encodeMapworldField(
  path: string,
  reader: WorldPhysicalFieldReader<number | string>,
  numericEncoding?: 'i16' | 'i32' | 'u16' | 'u32',
): PersistenceResult<{ readonly descriptor: MapworldFieldDescriptor; readonly bytes: Uint8Array }> {
  if (!isWorldPhysicalFieldReader(reader))
    return invalid(path, 'Field values require a project-owned reader.');
  if (
    !Number.isSafeInteger(reader.length) ||
    reader.length > 0xffff_ffff ||
    HEADER_BYTES + reader.length > MAPWORLD_NATIVE_LIMITS.maximumFileBytes
  ) {
    return invalid(path, 'Field sample count exceeds the bounded version-1 file representation.');
  }

  let dictionary: readonly string[] | undefined;
  let encoding: MapworldFieldEncoding;
  let indexByValue: ReadonlyMap<string, number> | undefined;
  if (numericEncoding === undefined) {
    const values = new Set<string>();
    let stringValueCount = 0;
    reader.forEach((value) => {
      if (typeof value === 'string') {
        stringValueCount += 1;
        values.add(value);
      }
    });
    if (stringValueCount !== reader.length || values.size === 0)
      return invalid(path, 'Dictionary fields require one or more string values.');
    dictionary = Object.freeze([...values].sort(compareText));
    encoding = canonicalDictionaryEncoding(dictionary.length);
    indexByValue = new Map(dictionary.map((value, index) => [value, index] as const));
  } else {
    encoding = numericEncoding;
  }

  const definition = ENCODINGS[encoding];
  const payloadLength = reader.length * definition.width;
  if (
    !Number.isSafeInteger(reader.length) ||
    reader.length > 0xffff_ffff ||
    !Number.isSafeInteger(payloadLength) ||
    payloadLength > 0xffff_ffff
  ) {
    return invalid(
      path,
      'Field sample count or payload length exceeds the version-1 unsigned 32-bit boundary.',
    );
  }
  if (HEADER_BYTES + payloadLength > MAPWORLD_NATIVE_LIMITS.maximumFileBytes) {
    return invalid(path, 'Field chunk exceeds the native per-file allocation boundary.');
  }

  let failure: string | undefined;
  reader.forEach((value, index) => {
    if (failure !== undefined) return;
    if (dictionary === undefined) {
      if (
        typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        Object.is(value, -0) ||
        value < definition.minimum ||
        value > definition.maximum
      ) {
        failure = `Field value at index ${String(index)} is outside ${encoding}.`;
      }
      return;
    }
    if (typeof value !== 'string' || indexByValue?.get(value) === undefined) {
      failure = `Dictionary field value at index ${String(index)} is undeclared.`;
    }
  });
  if (failure !== undefined) return invalid(path, failure);

  const bytes = new Uint8Array(HEADER_BYTES + payloadLength);
  bytes.set(MAGIC, 0);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  view.setUint16(8, MAPWORLD_FIELD_FILE_SCHEMA_VERSION, true);
  view.setUint8(10, definition.code);
  view.setUint8(11, 0);
  view.setUint32(12, reader.length, true);
  view.setUint32(16, dictionary?.length ?? 0, true);
  view.setUint32(20, payloadLength, true);

  reader.forEach((value, index) => {
    let encoded: number;
    if (dictionary === undefined) {
      encoded = value as number;
    } else {
      const dictionaryIndex = indexByValue?.get(value as string);
      if (dictionaryIndex === undefined) {
        throw new Error('Prevalidated dictionary value is missing its canonical index.');
      }
      encoded = dictionaryIndex;
    }
    writeValue(view, HEADER_BYTES + index * definition.width, encoded, definition.code);
  });

  return persistenceSuccess({
    descriptor: Object.freeze({
      byteOrder: 'little-endian',
      fieldFileSchemaVersion: MAPWORLD_FIELD_FILE_SCHEMA_VERSION,
      path,
      sampleCount: reader.length,
      storageKind: 'mapworld-field-binary',
      valueEncoding: encoding,
      ...(dictionary === undefined ? {} : { dictionary }),
    }),
    bytes,
  });
}

export function decodeMapworldField(
  descriptor: MapworldFieldDescriptor,
  bytes: Uint8Array,
): PersistenceResult<WorldPhysicalFieldReader<number | string>> {
  const path = descriptor.path;
  if (bytes.byteLength < HEADER_BYTES || !MAGIC.every((byte, index) => bytes[index] === byte)) {
    return invalid(path, 'Field chunk has a missing or malformed MWFIELD2 header.');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(8, true) !== MAPWORLD_FIELD_FILE_SCHEMA_VERSION) {
    return incompatible(path, '$.fieldFileSchemaVersion', view.getUint16(8, true));
  }
  const code = view.getUint8(10);
  const encoding = encodingForCode(code);
  if (encoding === undefined) return incompatible(path, '$.valueEncoding', code);
  if (view.getUint8(11) !== 0 || bytes.subarray(24, 32).some((byte) => byte !== 0)) {
    return invalid(path, 'Field flags and reserved header bytes must all be zero.');
  }
  const sampleCount = view.getUint32(12, true);
  const dictionaryCount = view.getUint32(16, true);
  const payloadLength = view.getUint32(20, true);
  const definition = ENCODINGS[encoding];
  if (
    descriptor.valueEncoding !== encoding ||
    descriptor.sampleCount !== sampleCount ||
    payloadLength !== sampleCount * definition.width ||
    bytes.byteLength !== HEADER_BYTES + payloadLength
  ) {
    return invalid(
      path,
      'Field descriptor, count, encoding, and payload length must agree exactly.',
    );
  }
  const dictionary = descriptor.dictionary;
  if (encoding.startsWith('dictionary-')) {
    if (dictionary === undefined) {
      return invalid(path, 'A dictionary encoding requires a descriptor dictionary.');
    }
    if (
      dictionary.length !== dictionaryCount ||
      !isCanonicalDictionary(dictionary) ||
      canonicalDictionaryEncoding(dictionary.length) !== encoding
    ) {
      return invalid(
        path,
        'Field dictionary must be sorted, unique, nonempty, count-matched, and use the smallest index width.',
      );
    }
  } else if (dictionary !== undefined || dictionaryCount !== 0) {
    return invalid(path, 'Numeric fields cannot declare a dictionary.');
  }

  if (dictionary !== undefined) {
    const used = new Uint8Array(dictionary.length);
    for (let index = 0; index < sampleCount; index += 1) {
      const value = readValue(view, HEADER_BYTES + index * definition.width, code);
      if (value >= dictionary.length)
        return invalid(path, `Dictionary index ${String(value)} is out of range.`);
      used[value] = 1;
    }
    if (used.some((value) => value === 0))
      return invalid(path, 'Every dictionary entry must be referenced by the payload.');
  }

  const storage = createTypedStorage(encoding, sampleCount);
  for (let index = 0; index < sampleCount; index += 1) {
    storage[index] = readValue(view, HEADER_BYTES + index * definition.width, code);
  }
  const reader =
    dictionary === undefined
      ? createNumericWorldPhysicalFieldReader(storage as WorldPhysicalNumericStorage)
      : createDictionaryWorldPhysicalFieldReader(
          storage as WorldPhysicalDictionaryIndexStorage,
          dictionary,
        );
  return persistenceSuccess(reader);
}

export function isMapworldFieldDescriptor(value: unknown): value is MapworldFieldDescriptor {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Readonly<Record<string, unknown>>;
  const keys = Object.keys(record).sort(compareText);
  const expected =
    record.dictionary === undefined
      ? [
          'byteOrder',
          'fieldFileSchemaVersion',
          'path',
          'sampleCount',
          'storageKind',
          'valueEncoding',
        ]
      : [
          'byteOrder',
          'dictionary',
          'fieldFileSchemaVersion',
          'path',
          'sampleCount',
          'storageKind',
          'valueEncoding',
        ];
  return (
    keys.join('\0') === expected.sort(compareText).join('\0') &&
    record.byteOrder === 'little-endian' &&
    record.fieldFileSchemaVersion === MAPWORLD_FIELD_FILE_SCHEMA_VERSION &&
    typeof record.path === 'string' &&
    Number.isSafeInteger(record.sampleCount) &&
    (record.sampleCount as number) >= 0 &&
    record.storageKind === 'mapworld-field-binary' &&
    typeof record.valueEncoding === 'string' &&
    Object.hasOwn(ENCODINGS, record.valueEncoding) &&
    (record.dictionary === undefined ||
      (Array.isArray(record.dictionary) &&
        record.dictionary.every((item) => typeof item === 'string')))
  );
}

function canonicalDictionaryEncoding(count: number): MapworldFieldEncoding {
  return count <= 0x100 ? 'dictionary-u8' : count <= 0x1_0000 ? 'dictionary-u16' : 'dictionary-u32';
}

function isCanonicalDictionary(dictionary: readonly string[]): boolean {
  return (
    dictionary.length > 0 &&
    dictionary.every((value, index) => {
      if (index === 0) return true;
      const previous = dictionary[index - 1];
      return previous !== undefined && previous < value;
    })
  );
}

function createTypedStorage(
  encoding: MapworldFieldEncoding,
  length: number,
): WorldPhysicalNumericStorage | WorldPhysicalDictionaryIndexStorage {
  if (encoding === 'i16') return new Int16Array(length);
  if (encoding === 'i32') return new Int32Array(length);
  if (encoding === 'u16' || encoding === 'dictionary-u16') return new Uint16Array(length);
  if (encoding === 'u32' || encoding === 'dictionary-u32') return new Uint32Array(length);
  return new Uint8Array(length);
}

function encodingForCode(code: number): MapworldFieldEncoding | undefined {
  return (Object.entries(ENCODINGS) as [MapworldFieldEncoding, { readonly code: number }][]).find(
    ([, value]) => value.code === code,
  )?.[0];
}

function writeValue(view: DataView, offset: number, value: number, code: number): void {
  if (code === 1) view.setInt16(offset, value, true);
  else if (code === 2) view.setInt32(offset, value, true);
  else if (code === 3 || code === 6) view.setUint16(offset, value, true);
  else if (code === 4 || code === 7) view.setUint32(offset, value, true);
  else view.setUint8(offset, value);
}

function readValue(view: DataView, offset: number, code: number): number {
  if (code === 1) return view.getInt16(offset, true);
  if (code === 2) return view.getInt32(offset, true);
  if (code === 3 || code === 6) return view.getUint16(offset, true);
  if (code === 4 || code === 7) return view.getUint32(offset, true);
  return view.getUint8(offset);
}

function invalid<Value>(path: string, message: string): PersistenceResult<Value> {
  return persistenceFailure(
    persistenceDiagnostic(
      PERSISTENCE_DIAGNOSTIC_CODES.fieldInvalid,
      path,
      '$',
      message,
      'Restore the exact canonical field descriptor and chunk bytes.',
    ),
  );
}

function incompatible<Value>(
  path: string,
  fieldPath: string,
  actual: unknown,
): PersistenceResult<Value> {
  return persistenceFailure(
    persistenceDiagnostic(
      PERSISTENCE_DIAGNOSTIC_CODES.versionIncompatible,
      path,
      fieldPath,
      `Unsupported field compatibility value ${JSON.stringify(actual)}.`,
      'Open the package with a compatible application or apply an explicit supported migration.',
    ),
  );
}

function compareText(left: string, right: string): -1 | 0 | 1 {
  return left < right ? -1 : left > right ? 1 : 0;
}
