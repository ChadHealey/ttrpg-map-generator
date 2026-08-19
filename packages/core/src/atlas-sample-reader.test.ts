import { describe, expect, it } from 'vitest';

import {
  atlasSampleReaderToArray,
  createLandWaterSampleReader,
  createMacroElevationSampleReader,
  type MacroElevationValueTicks,
} from './index.js';

describe('atlas sample readers', () => {
  it('provides deterministic indexed and traversal access without exposing an array', () => {
    const reader = createLandWaterSampleReader(Object.freeze(['water', 'land', 'water'] as const));
    const traversed: (readonly [number, string])[] = [];
    reader.forEach((sample, index) => traversed.push([index, sample]));

    expect(reader.length).toBe(3);
    expect(typeof reader.at).toBe('function');
    expect(typeof reader.forEach).toBe('function');
    expect(Object.isFrozen(reader)).toBe(true);
    expect(reader.at(0)).toBe('water');
    expect(reader.at(2)).toBe('water');
    expect(reader.at(-1)).toBeUndefined();
    expect(reader.at(3)).toBeUndefined();
    expect(reader.at(0.5)).toBeUndefined();
    expect(traversed).toStrictEqual([
      [0, 'water'],
      [1, 'land'],
      [2, 'water'],
    ]);
    expect(atlasSampleReaderToArray(reader)).toStrictEqual(['water', 'land', 'water']);
  });

  it('requires an immutable producer and does not expose mutable backing storage', () => {
    expect(() => createLandWaterSampleReader(['land'])).toThrow('immutable dense sample array');
    const reader = createMacroElevationSampleReader(Object.freeze([0 as MacroElevationValueTicks]));
    expect('values' in reader).toBe(false);
    expect('buffer' in reader).toBe(false);
  });

  it('rejects sparse arrays before a reader can expose missing in-range samples', () => {
    const sparse: ('land' | 'water')[] = [];
    sparse.length = 2;
    sparse[0] = 'land';

    expect(() => createLandWaterSampleReader(Object.freeze(sparse))).toThrow(
      'immutable dense sample array',
    );
  });
});
