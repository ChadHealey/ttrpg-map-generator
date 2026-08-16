import { ATLAS_FULL_SAMPLE_COUNT } from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import { segmentAtlasWaterBodies } from './atlas-semantic-water.js';
import { analyzeAtlasSurfacePartition, atlasStorageIndex } from './atlas-surface-topology.js';

describe('atlas marine clearance classification', () => {
  it('distinguishes marginal and enclosed seas from the open basin graph', () => {
    const samples = marineFixture();
    const partition = analyzeAtlasSurfacePartition(samples);
    const result = segmentAtlasWaterBodies(samples, partition, 'singleGlobal');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.regions.filter(({ waterBodyKind }) => waterBodyKind === 'oceanBasin'),
    ).toHaveLength(1);
    expect(
      result.regions.some(
        ({ waterBodyKind, enclosure, connectedRegionIndices }) =>
          waterBodyKind === 'sea' &&
          enclosure === 'open-marine' &&
          connectedRegionIndices.length > 0,
      ),
    ).toBe(true);
    expect(
      result.regions.some(
        ({ waterBodyKind, enclosure }) => waterBodyKind === 'sea' && enclosure === 'enclosed',
      ),
    ).toBe(true);
    expect(result.regions.reduce((total, region) => total + region.sampleCount, 0)).toBe(
      samples.filter((sample) => sample === 'water').length,
    );
  });

  it('uses the same narrow passage to realize disconnected multiple basin roots', () => {
    const samples = marineFixture();
    const partition = analyzeAtlasSurfacePartition(samples);
    const result = segmentAtlasWaterBodies(samples, partition, 'multipleBasins');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const basins = result.regions.filter(({ waterBodyKind }) => waterBodyKind === 'oceanBasin');
    expect(basins).toHaveLength(2);
    expect(basins.every(({ connectedRegionIndices }) => connectedRegionIndices.length === 0)).toBe(
      true,
    );
  });

  it('keeps the largest open marine graph above the connected-majority policy', () => {
    const samples = marineFixture();
    const partition = analyzeAtlasSurfacePartition(samples);
    const result = segmentAtlasWaterBodies(samples, partition, 'connectedMajority');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const open = result.regions.filter(({ enclosure }) => enclosure === 'open-marine');
    expect(open.some(({ connectedRegionIndices }) => connectedRegionIndices.length > 0)).toBe(true);
    expect(open.filter(({ waterBodyKind }) => waterBodyKind === 'oceanBasin')).toHaveLength(1);
  });
});

function marineFixture(): ('land' | 'water')[] {
  const samples = Array.from({ length: ATLAS_FULL_SAMPLE_COUNT }, () => 'land' as const) as (
    'land' | 'water'
  )[];
  fillRectangle(samples, 300, 300, 420, 420);
  fillRectangle(samples, 600, 300, 720, 420);
  fillRectangle(samples, 420, 358, 600, 362);
  fillRectangle(samples, 1_000, 600, 1_050, 650);
  return samples;
}

function fillRectangle(
  samples: ('land' | 'water')[],
  minimumX: number,
  minimumY: number,
  maximumXExclusive: number,
  maximumYExclusive: number,
): void {
  for (let y = minimumY; y < maximumYExclusive; y += 1) {
    for (let x = minimumX; x < maximumXExclusive; x += 1) {
      samples[atlasStorageIndex(x, y)] = 'water';
    }
  }
}
