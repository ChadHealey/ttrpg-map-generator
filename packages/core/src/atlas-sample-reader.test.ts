import { describe, expect, it } from 'vitest';

import {
  ATLAS_FIELD_QUANTIZATION_SCALE,
  ATLAS_FULL_SAMPLE_COUNT,
  atlasSampleReaderToArray,
  createCompactLandWaterSampleReader,
  createCompactLandWaterSampleReaderFromBits,
  createCompactMacroElevationSampleReader,
  createLandWaterSampleReader,
  createMacroElevationSampleReader,
  getCompactAtlasSampleReaderStorageByteLength,
  isCompactLandWaterSampleReader,
  isCompactMacroElevationSampleReader,
  type MacroElevationValueTicks,
} from './index.js';
import { deepEqual } from './world-document-transaction-support.js';

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

  it('owns exact full-profile signed and one-bit compact storage without exposing buffers', () => {
    const macroSource = new Int32Array(ATLAS_FULL_SAMPLE_COUNT);
    macroSource[0] = -ATLAS_FIELD_QUANTIZATION_SCALE;
    macroSource[macroSource.length - 1] = ATLAS_FIELD_QUANTIZATION_SCALE;
    const macro = createCompactMacroElevationSampleReader(macroSource);

    const classificationBits = new Uint8Array(Math.ceil(ATLAS_FULL_SAMPLE_COUNT / 8));
    classificationBits[0] = 1;
    classificationBits[classificationBits.length - 1] = 2;
    const classification = createCompactLandWaterSampleReaderFromBits(
      classificationBits,
      ATLAS_FULL_SAMPLE_COUNT,
    );

    macroSource.fill(0);
    classificationBits.fill(0);
    expect(macro.at(0)).toBe(-ATLAS_FIELD_QUANTIZATION_SCALE);
    expect(macro.at(macro.length - 1)).toBe(ATLAS_FIELD_QUANTIZATION_SCALE);
    expect(classification.at(0)).toBe('land');
    expect(classification.at(1)).toBe('water');
    expect(classification.at(classification.length - 1)).toBe('land');
    expect(getCompactAtlasSampleReaderStorageByteLength(macro)).toBe(
      ATLAS_FULL_SAMPLE_COUNT * Int32Array.BYTES_PER_ELEMENT,
    );
    expect(getCompactAtlasSampleReaderStorageByteLength(classification)).toBe(
      Math.ceil(ATLAS_FULL_SAMPLE_COUNT / 8),
    );
    expect(isCompactMacroElevationSampleReader(macro)).toBe(true);
    expect(isCompactLandWaterSampleReader(classification)).toBe(true);
    expect('buffer' in macro).toBe(false);
    expect('values' in macro).toBe(false);
    expect('buffer' in classification).toBe(false);
    expect('bits' in classification).toBe(false);
  });

  it('rejects malformed compact constructor inputs before they become domain values', () => {
    expect(() => createCompactMacroElevationSampleReader(new Int32Array(1))).toThrow(
      'exactly 2095106 samples',
    );
    expect(() => createCompactLandWaterSampleReader(['water'])).toThrow('exactly 2095106 samples');
    const sparseMacro = new Array<number>(ATLAS_FULL_SAMPLE_COUNT);
    sparseMacro[0] = 0;
    expect(() => createCompactMacroElevationSampleReader(sparseMacro)).toThrow('dense array');

    const invalidMacro = new Array<number>(ATLAS_FULL_SAMPLE_COUNT).fill(0);
    invalidMacro[1] = Number.NaN;
    expect(() => createCompactMacroElevationSampleReader(invalidMacro)).toThrow(
      'canonical signed integer tick',
    );
    invalidMacro[1] = ATLAS_FIELD_QUANTIZATION_SCALE + 1;
    expect(() => createCompactMacroElevationSampleReader(invalidMacro)).toThrow(
      'canonical signed integer tick',
    );

    const invalidClassification = new Array<unknown>(ATLAS_FULL_SAMPLE_COUNT).fill('water');
    invalidClassification[1] = 'coast';
    expect(() => createCompactLandWaterSampleReader(invalidClassification)).toThrow(
      'either land or water',
    );
    const sparseClassification = new Array<'land' | 'water'>(ATLAS_FULL_SAMPLE_COUNT);
    sparseClassification[0] = 'water';
    expect(() => createCompactLandWaterSampleReader(sparseClassification)).toThrow('dense sample');

    const bits = new Uint8Array(Math.ceil(ATLAS_FULL_SAMPLE_COUNT / 8));
    bits[bits.length - 1] = 0x80;
    expect(() => createCompactLandWaterSampleReaderFromBits(bits, ATLAS_FULL_SAMPLE_COUNT)).toThrow(
      'padding bits',
    );
    expect(() =>
      createCompactLandWaterSampleReaderFromBits(
        new Uint8Array(bits.length - 1),
        ATLAS_FULL_SAMPLE_COUNT,
      ),
    ).toThrow('exactly 261889 bytes');
  });

  it('compares independently owned compact values by canonical samples', () => {
    const source = new Int32Array(ATLAS_FULL_SAMPLE_COUNT);
    source[0] = 17;
    const first = createCompactMacroElevationSampleReader(source);
    const same = createCompactMacroElevationSampleReader(source);
    source[source.length - 1] = 1;
    const changed = createCompactMacroElevationSampleReader(source);

    expect(deepEqual(first, same)).toBe(true);
    expect(deepEqual(first, changed)).toBe(false);
  });
});
