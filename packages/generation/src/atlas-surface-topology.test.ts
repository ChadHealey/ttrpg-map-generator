import { ATLAS_FULL_SAMPLE_COUNT } from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import { analyzeAtlasSurfacePartition, atlasStorageIndex } from './atlas-surface-topology.js';

describe('atlas spherical component topology', () => {
  it('joins seam neighbors into one component under many deterministic row constructions', () => {
    for (let caseIndex = 0; caseIndex < 8; caseIndex += 1) {
      const samples = Array.from({ length: ATLAS_FULL_SAMPLE_COUNT }, () => 'water' as const) as (
        'land' | 'water'
      )[];
      const latitudeIndex = 2 + ((caseIndex * 41) % 1_020);
      samples[atlasStorageIndex(0, latitudeIndex)] = 'land';
      samples[atlasStorageIndex(2_047, latitudeIndex)] = 'land';
      const partition = analyzeAtlasSurfacePartition(samples);
      const land = partition.components.filter(({ kind }) => kind === 'land');
      expect(land).toHaveLength(1);
      expect(land[0]?.sampleCount).toBe(2);
    }
  }, 30_000);

  it('treats each pole as one vertex joining its complete adjacent row', () => {
    const samples = Array.from({ length: ATLAS_FULL_SAMPLE_COUNT }, () => 'water' as const) as (
      'land' | 'water'
    )[];
    samples[0] = 'land';
    samples[atlasStorageIndex(17, 1)] = 'land';
    samples[atlasStorageIndex(1_731, 1)] = 'land';
    samples[ATLAS_FULL_SAMPLE_COUNT - 1] = 'land';
    samples[atlasStorageIndex(29, 1_023)] = 'land';
    samples[atlasStorageIndex(1_509, 1_023)] = 'land';
    const land = analyzeAtlasSurfacePartition(samples).components.filter(
      ({ kind }) => kind === 'land',
    );
    expect(land.map(({ sampleCount }) => sampleCount).sort((a, b) => a - b)).toStrictEqual([3, 3]);
  });
});
