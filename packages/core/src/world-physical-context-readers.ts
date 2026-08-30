/** Nominal project-owned readers for accepted Milestone 3 full-profile field values. */

import { type AtlasSampleReader, createAtlasSampleReader } from './atlas-sample-reader.js';
import { registerImmutableDomainSnapshot } from './immutable-domain-snapshot.js';
import { sha256 } from './sha-256.js';

const WORLD_PHYSICAL_FIELD_READER_BRAND: unique symbol = Symbol('world-physical-field-reader');

/**
 * A nominal reader prevents arbitrary structural objects from crossing the accepted M3 field
 * boundary. It intentionally exposes neither backing storage nor an iterator.
 */
export interface WorldPhysicalFieldReader<Value> extends AtlasSampleReader<Value> {
  readonly [WORLD_PHYSICAL_FIELD_READER_BRAND]: 'world-physical-field-reader';
}

const readers = new WeakSet<object>();
const readerValueFingerprints = new WeakMap<object, string>();
const encoder = new TextEncoder();

/** Wrap an immutable dense source array in an owned M3 field reader. */
export function createWorldPhysicalFieldReader<Value>(
  values: readonly Value[],
): WorldPhysicalFieldReader<Value> {
  const source = createAtlasSampleReader(values);
  return readerFrom(source, fingerprintValues(values));
}

/** Construct a full-profile reader without exposing or allocating a repeated backing array. */
export function createConstantWorldPhysicalFieldReader<Value>(
  length: number,
  value: Value,
): WorldPhysicalFieldReader<Value> {
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new RangeError('World physical field reader length must be a non-negative safe integer.');
  }
  return readerFrom(
    {
      length,
      at(index: number): Value | undefined {
        return Number.isSafeInteger(index) && index >= 0 && index < length ? value : undefined;
      },
      forEach(visit: (sample: Value, index: number) => void): void {
        for (let index = 0; index < length; index += 1) visit(value, index);
      },
    },
    `rle/v1/${String(length)}:${canonicalValue(value)}`,
  );
}

/** True only for readers made by this module's project-owned factories. */
export function isWorldPhysicalFieldReader<Value>(
  value: unknown,
): value is WorldPhysicalFieldReader<Value> {
  return typeof value === 'object' && value !== null && readers.has(value);
}

/** Return the immutable reader's canonical logical-value fingerprint. */
export function getWorldPhysicalFieldReaderValueFingerprint(
  reader: WorldPhysicalFieldReader<unknown>,
): string {
  const fingerprint = readerValueFingerprints.get(reader);
  if (fingerprint === undefined) {
    throw new TypeError('World physical field reader is missing immutable value fingerprint.');
  }
  return fingerprint;
}

function readerFrom<Value>(
  source: AtlasSampleReader<Value>,
  logicalValues: string,
): WorldPhysicalFieldReader<Value> {
  const reader = Object.freeze({
    [WORLD_PHYSICAL_FIELD_READER_BRAND]: 'world-physical-field-reader' as const,
    length: source.length,
    at(index: number): Value | undefined {
      return source.at(index);
    },
    forEach(visit: (value: Value, index: number) => void): void {
      source.forEach(visit);
    },
  });
  readers.add(reader);
  readerValueFingerprints.set(reader, digestHex(logicalValues));
  return registerImmutableDomainSnapshot(reader);
}

function fingerprintValues(values: readonly unknown[]): string {
  if (values.length === 0) return 'rle/v1';
  const runs = ['rle/v1'];
  let previous = canonicalValue(values[0]);
  let count = 1;
  for (let index = 1; index < values.length; index += 1) {
    const value = canonicalValue(values[index]);
    if (value === previous) {
      count += 1;
    } else {
      runs.push(`${String(count)}:${previous}`);
      previous = value;
      count = 1;
    }
  }
  runs.push(`${String(count)}:${previous}`);
  return runs.join('\n');
}

function canonicalValue(value: unknown): string {
  if (typeof value === 'number' || typeof value === 'string') return JSON.stringify(value);
  throw new TypeError('World physical field reader values must be canonical numbers or strings.');
}

function digestHex(value: string): string {
  return Array.from(sha256(encoder.encode(value)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
