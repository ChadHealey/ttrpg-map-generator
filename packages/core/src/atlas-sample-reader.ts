/** Immutable, deterministic readers for full-profile atlas samples. */

import {
  ATLAS_FIELD_QUANTIZATION_SCALE,
  ATLAS_FULL_SAMPLE_COUNT,
  type MacroElevationValueTicks,
} from './atlas-geography-model.js';
import { registerImmutableDomainSnapshot } from './immutable-domain-snapshot.js';

export type AtlasLandWaterSample = 'land' | 'water';

/**
 * Project-owned read access for a canonical sample traversal.
 *
 * The contract intentionally does not expose an array, iterator, backing buffer, or mutating
 * method. Future packed implementations can therefore retain the same domain boundary.
 */
export interface AtlasSampleReader<Value> {
  readonly length: number;
  at(index: number): Value | undefined;
  forEach(visit: (value: Value, index: number) => void): void;
}

export type MacroElevationSampleReader = AtlasSampleReader<MacroElevationValueTicks>;
export type LandWaterSampleReader = AtlasSampleReader<AtlasLandWaterSample>;

const atlasSampleReaders = new WeakSet<object>();
interface CompactAtlasSampleReaderMetadata {
  readonly kind: 'classification' | 'macro-elevation';
  readonly storageByteLength: number;
}

const compactAtlasSampleReaderMetadata = new WeakMap<object, CompactAtlasSampleReaderMetadata>();

/** Wrap an already immutable producer array without exposing it through the public contract. */
export function createAtlasSampleReader<Value>(values: readonly Value[]): AtlasSampleReader<Value> {
  if (!isDenseFrozenSampleArray(values)) {
    throw new TypeError('Atlas sample reader input must be an immutable dense sample array.');
  }
  const reader = Object.freeze({
    length: values.length,
    at(index: number): Value | undefined {
      return Number.isSafeInteger(index) && index >= 0 && index < values.length
        ? values[index]
        : undefined;
    },
    forEach(visit: (value: Value, index: number) => void): void {
      for (let index = 0; index < values.length; index += 1) {
        visit(values[index] as Value, index);
      }
    },
  });
  atlasSampleReaders.add(reader);
  return registerImmutableDomainSnapshot(reader);
}

/** True only for readers created by this module's immutable factory. */
export function isAtlasSampleReader<Value>(value: unknown): value is AtlasSampleReader<Value> {
  return typeof value === 'object' && value !== null && atlasSampleReaders.has(value);
}

export function createMacroElevationSampleReader(
  values: readonly MacroElevationValueTicks[],
): MacroElevationSampleReader {
  return createAtlasSampleReader(values);
}

export function createLandWaterSampleReader(
  values: readonly AtlasLandWaterSample[],
): LandWaterSampleReader {
  return createAtlasSampleReader(values);
}

/** Own one full-profile macro-elevation traversal in exact signed 32-bit storage. */
export function createCompactMacroElevationSampleReader(
  values: readonly unknown[] | Int32Array,
): MacroElevationSampleReader {
  if (!isDensePlainArray(values) && !isExactInt32Array(values)) {
    throw new TypeError('Compact macro elevation input must be a dense array or Int32Array.');
  }
  if (values.length !== ATLAS_FULL_SAMPLE_COUNT) {
    throw new RangeError(
      `Compact macro elevation requires exactly ${String(ATLAS_FULL_SAMPLE_COUNT)} samples.`,
    );
  }
  const storage = new Int32Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (
      typeof value !== 'number' ||
      !Number.isSafeInteger(value) ||
      Object.is(value, -0) ||
      value < -ATLAS_FIELD_QUANTIZATION_SCALE ||
      value > ATLAS_FIELD_QUANTIZATION_SCALE
    ) {
      throw new RangeError(
        `Compact macro elevation sample ${String(index)} must be a canonical signed integer tick.`,
      );
    }
    storage[index] = value;
  }
  return compactReader('macro-elevation', values.length, storage.byteLength, (index) => {
    const value = storage[index];
    return value === undefined ? undefined : (value as MacroElevationValueTicks);
  });
}

/** Own one full-profile classification traversal in one deterministic bit per sample. */
export function createCompactLandWaterSampleReader(
  samples: readonly unknown[],
): LandWaterSampleReader {
  if (!isDensePlainArray(samples)) {
    throw new TypeError('Compact land/water input must be a dense sample array.');
  }
  if (samples.length !== ATLAS_FULL_SAMPLE_COUNT) {
    throw new RangeError(
      `Compact land/water classification requires exactly ${String(ATLAS_FULL_SAMPLE_COUNT)} samples.`,
    );
  }
  const bits = new Uint8Array(Math.ceil(samples.length / 8));
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    if (sample !== 'land' && sample !== 'water') {
      throw new TypeError(
        `Compact land/water sample ${String(index)} must be either land or water.`,
      );
    }
    if (sample === 'land') setClassificationBit(bits, index);
  }
  return compactClassificationReader(bits, samples.length);
}

/**
 * Own a completed producer bitset without exposing or retaining its mutable source buffer.
 * Bit value one is land; zero is water; unused high bits in the last byte must be zero.
 */
export function createCompactLandWaterSampleReaderFromBits(
  sourceBits: Uint8Array,
  sampleCount: number,
): LandWaterSampleReader {
  if (!isExactUint8Array(sourceBits)) {
    throw new TypeError('Compact land/water bit storage must be a Uint8Array.');
  }
  if (sampleCount !== ATLAS_FULL_SAMPLE_COUNT) {
    throw new RangeError(
      `Compact land/water classification requires exactly ${String(ATLAS_FULL_SAMPLE_COUNT)} samples.`,
    );
  }
  const expectedBytes = Math.ceil(sampleCount / 8);
  if (sourceBits.length !== expectedBytes) {
    throw new RangeError(
      `Compact land/water classification requires exactly ${String(expectedBytes)} bytes.`,
    );
  }
  const usedBitsInLastByte = sampleCount % 8;
  const lastByte = sourceBits[sourceBits.length - 1] ?? 0;
  if (usedBitsInLastByte !== 0 && (lastByte & ~((1 << usedBitsInLastByte) - 1)) !== 0) {
    throw new RangeError('Compact land/water padding bits must be zero.');
  }
  return compactClassificationReader(new Uint8Array(sourceBits), sampleCount);
}

export function isCompactMacroElevationSampleReader(
  value: unknown,
): value is MacroElevationSampleReader {
  return (
    typeof value === 'object' &&
    value !== null &&
    compactAtlasSampleReaderMetadata.get(value)?.kind === 'macro-elevation'
  );
}

export function isCompactLandWaterSampleReader(value: unknown): value is LandWaterSampleReader {
  return (
    typeof value === 'object' &&
    value !== null &&
    compactAtlasSampleReaderMetadata.get(value)?.kind === 'classification'
  );
}

/** Return bounded payload bytes for a nominal compact reader, without exposing its storage. */
export function getCompactAtlasSampleReaderStorageByteLength(value: unknown): number | undefined {
  return typeof value === 'object' && value !== null
    ? compactAtlasSampleReaderMetadata.get(value)?.storageByteLength
    : undefined;
}

/** Deterministic value equality for nominal project-owned readers. */
export function atlasSampleReadersEqual(
  left: AtlasSampleReader<unknown>,
  right: AtlasSampleReader<unknown>,
): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (!Object.is(left.at(index), right.at(index))) return false;
  }
  return true;
}

/** Explicit persistence adapter; canonical DTO array order remains unchanged. */
export function atlasSampleReaderToArray<Value>(
  reader: AtlasSampleReader<Value>,
): readonly Value[] {
  const values: Value[] = [];
  reader.forEach((value) => values.push(value));
  return Object.freeze(values);
}

function isDenseFrozenSampleArray(values: readonly unknown[]): boolean {
  if (!Object.isFrozen(values) || !Array.isArray(values)) return false;
  const keys = Object.keys(values);
  if (
    keys.length !== values.length ||
    keys.some((key, index) => key !== String(index)) ||
    Reflect.ownKeys(values).length !== values.length + 1
  ) {
    return false;
  }
  return keys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(values, key);
    return descriptor !== undefined && 'value' in descriptor && descriptor.value !== undefined;
  });
}

function compactClassificationReader(storage: Uint8Array, length: number): LandWaterSampleReader {
  return compactReader('classification', length, storage.byteLength, (index) =>
    classificationBit(storage, index) ? 'land' : 'water',
  );
}

function compactReader<Value>(
  kind: 'classification' | 'macro-elevation',
  length: number,
  storageByteLength: number,
  read: (index: number) => Value | undefined,
): AtlasSampleReader<Value> {
  const reader = Object.freeze({
    length,
    at(index: number): Value | undefined {
      return Number.isSafeInteger(index) && index >= 0 && index < length ? read(index) : undefined;
    },
    forEach(visit: (value: Value, index: number) => void): void {
      for (let index = 0; index < length; index += 1) {
        const value = read(index);
        if (value === undefined) throw new Error('Compact atlas sample storage is incomplete.');
        visit(value, index);
      }
    },
  });
  atlasSampleReaders.add(reader);
  compactAtlasSampleReaderMetadata.set(reader, Object.freeze({ kind, storageByteLength }));
  return registerImmutableDomainSnapshot(reader);
}

function setClassificationBit(storage: Uint8Array, index: number): void {
  const byteIndex = index >> 3;
  const byte = storage[byteIndex];
  if (byte === undefined) throw new RangeError('Classification sample index is out of range.');
  storage[byteIndex] = byte | (1 << (index & 7));
}

function classificationBit(storage: Uint8Array, index: number): boolean {
  const byte = storage[index >> 3];
  if (byte === undefined) throw new RangeError('Classification sample index is out of range.');
  return (byte & (1 << (index & 7))) !== 0;
}

function isDensePlainArray(values: readonly unknown[] | Int32Array): values is readonly unknown[] {
  if (!Array.isArray(values) || Object.getPrototypeOf(values) !== Array.prototype) return false;
  const keys = Object.keys(values);
  return (
    keys.length === values.length &&
    keys.every((key, index) => key === String(index)) &&
    Reflect.ownKeys(values).length === values.length + 1 &&
    keys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(values, key);
      return descriptor !== undefined && 'value' in descriptor;
    })
  );
}

function isExactInt32Array(value: unknown): value is Int32Array {
  return value instanceof Int32Array && Object.getPrototypeOf(value) === Int32Array.prototype;
}

function isExactUint8Array(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array && Object.getPrototypeOf(value) === Uint8Array.prototype;
}
