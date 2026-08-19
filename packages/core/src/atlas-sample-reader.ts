/** Immutable, deterministic readers for full-profile atlas samples. */

import type { MacroElevationValueTicks } from './atlas-geography-model.js';
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
