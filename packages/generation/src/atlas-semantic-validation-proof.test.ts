import {
  ATLAS_FIELD_QUANTIZATION_SCALE,
  type AtlasSampleReader,
  atlasSampleReaderToArray,
  type AtlasSemanticGeographyRecords,
  validateAtlasSemanticGeographyRecords,
  validateAtlasSemanticGeographyRecordsWithAnalysis,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import {
  FIXED_ATLAS_LAND_WATER_ASPECT_ID,
  FIXED_ATLAS_WORLD_MAP_ID,
  FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
  generateFixedAtlasFull,
} from './atlas-land-water-test-support.js';
import { classifyAtlasSemanticGeography } from './atlas-semantic-classifier.js';
import { validateProvenAtlasSemanticGeographyRecords } from './atlas-semantic-validation-proof.js';
import { segmentAtlasWaterBodies } from './atlas-semantic-water.js';
import { analyzeAtlasSurfacePartition } from './atlas-surface-topology.js';

describe('atlas semantic validation proof', () => {
  it('never reuses validation for a fully frozen graph with accessor-backed fields', async () => {
    const generated = await generateFixedAtlasFull();
    const classified = classifyAtlasSemanticGeography({
      worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
      worldSurfaceEntityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
      landWaterClassificationAspectId: FIXED_ATLAS_LAND_WATER_ASPECT_ID,
      records: generated.patch.records,
    });
    expect(classified.ok).toBe(true);
    if (!classified.ok) return;

    let landWaterClassificationAspectId = classified.records.landWaterClassificationAspectId;
    const records = Object.freeze({
      ...classified.records,
      get landWaterClassificationAspectId() {
        return landWaterClassificationAspectId;
      },
    });
    expect(Object.isFrozen(records)).toBe(true);
    expect(validateProvenAtlasSemanticGeographyRecords(records)).toStrictEqual({ ok: true });

    landWaterClassificationAspectId = 'invalid-aspect-id' as typeof landWaterClassificationAspectId;
    expect(validateProvenAtlasSemanticGeographyRecords(records).ok).toBe(false);
  }, 30_000);

  it('never reuses validation for a semantic graph with mutable nested records', async () => {
    const generated = await generateFixedAtlasFull();
    const classified = classifyAtlasSemanticGeography({
      worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
      worldSurfaceEntityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
      landWaterClassificationAspectId: FIXED_ATLAS_LAND_WATER_ASPECT_ID,
      records: generated.patch.records,
    });
    expect(classified.ok).toBe(true);
    if (!classified.ok) return;

    const firstLandmass = classified.records.landmasses[0];
    expect(firstLandmass).toBeDefined();
    if (firstLandmass === undefined) return;
    const mutableLandmass = { ...firstLandmass };
    const records = Object.freeze({
      ...classified.records,
      landmasses: Object.freeze([mutableLandmass, ...classified.records.landmasses.slice(1)]),
    });
    expect(validateProvenAtlasSemanticGeographyRecords(records)).toStrictEqual({ ok: true });

    (
      mutableLandmass as unknown as { sourceClassificationAspectId: string }
    ).sourceClassificationAspectId = 'invalid-aspect-id';
    expect(validateProvenAtlasSemanticGeographyRecords(records).ok).toBe(false);
  }, 30_000);

  it('reuses validation for the same exact snapshot-owned semantic graph', async () => {
    const generated = await generateFixedAtlasFull();
    const classified = classifyAtlasSemanticGeography({
      worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
      worldSurfaceEntityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
      landWaterClassificationAspectId: FIXED_ATLAS_LAND_WATER_ASPECT_ID,
      records: generated.patch.records,
    });
    expect(classified.ok).toBe(true);
    if (!classified.ok) return;

    expect(validateProvenAtlasSemanticGeographyRecords(classified.records)).toStrictEqual({
      ok: true,
    });
    expect(validateProvenAtlasSemanticGeographyRecords(classified.records)).toStrictEqual({
      ok: true,
    });
  }, 30_000);

  it('uses only certified immutable sources and ignores mutable analysis transport', async () => {
    const records = await classifiedRecords();
    const partition = analyzeAtlasSurfacePartition(records.landWaterClassification.samples);
    const water = segmentAtlasWaterBodies(
      records.landWaterClassification.samples,
      partition,
      records.controls.oceanConnectivity,
    );
    expect(water.ok).toBe(true);
    if (!water.ok) return;

    // This shallow clone preserves valid semantic data but deliberately misses the identity cache.
    const uncachedRecords: AtlasSemanticGeographyRecords = {
      ...records,
      macroElevation: { ...records.macroElevation },
    };
    const expectedCertifiedSource = validateAtlasSemanticGeographyRecords(uncachedRecords);
    expect(
      validateAtlasSemanticGeographyRecordsWithAnalysis(uncachedRecords, { partition, water }),
    ).toStrictEqual(expectedCertifiedSource);

    partition.componentIndexBySample.fill(0);
    expect(
      validateAtlasSemanticGeographyRecordsWithAnalysis(uncachedRecords, { partition, water }),
    ).toStrictEqual(expectedCertifiedSource);
    partition.rowWeights.fill(0);
    expect(
      validateAtlasSemanticGeographyRecordsWithAnalysis(uncachedRecords, { partition, water }),
    ).toStrictEqual(expectedCertifiedSource);
    water.regionIndexBySample.fill(0);
    expect(
      validateAtlasSemanticGeographyRecordsWithAnalysis(uncachedRecords, { partition, water }),
    ).toStrictEqual(expectedCertifiedSource);

    const mutableSamples = [...atlasSampleReaderToArray(records.landWaterClassification.samples)];
    const mutableElevations = [...atlasSampleReaderToArray(records.macroElevation.values)];
    const mutableRecords: AtlasSemanticGeographyRecords = {
      ...records,
      macroElevation: {
        ...records.macroElevation,
        values: mutableReader(mutableElevations),
      },
      landWaterClassification: {
        ...records.landWaterClassification,
        samples: mutableReader(mutableSamples),
      },
    };
    const untrustedPartition = analyzeAtlasSurfacePartition(
      mutableRecords.landWaterClassification.samples,
    );
    const untrustedWater = segmentAtlasWaterBodies(
      mutableRecords.landWaterClassification.samples,
      untrustedPartition,
      mutableRecords.controls.oceanConnectivity,
    );
    expect(untrustedWater.ok).toBe(true);
    if (!untrustedWater.ok) return;

    const mutationIndex = mutableSamples.findIndex((sample) => sample === 'land');
    expect(mutationIndex).toBeGreaterThanOrEqual(0);
    if (mutationIndex < 0) return;
    mutableSamples[mutationIndex] = 'water';
    mutableElevations[mutationIndex] =
      -ATLAS_FIELD_QUANTIZATION_SCALE as (typeof mutableElevations)[number];

    const expectedMutatedSource = validateAtlasSemanticGeographyRecords(mutableRecords);
    expect(expectedMutatedSource.ok).toBe(false);
    expect(
      validateAtlasSemanticGeographyRecordsWithAnalysis(mutableRecords, {
        partition: untrustedPartition,
        water: untrustedWater,
      }),
    ).toStrictEqual(expectedMutatedSource);
  }, 60_000);
});

async function classifiedRecords(): Promise<AtlasSemanticGeographyRecords> {
  const generated = await generateFixedAtlasFull();
  const classified = classifyAtlasSemanticGeography({
    worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
    worldSurfaceEntityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
    landWaterClassificationAspectId: FIXED_ATLAS_LAND_WATER_ASPECT_ID,
    records: generated.patch.records,
  });
  expect(classified.ok).toBe(true);
  if (!classified.ok) throw new Error('Expected fixed atlas semantic classification.');
  return classified.records;
}

function mutableReader<Value>(values: Value[]): AtlasSampleReader<Value> {
  return {
    length: values.length,
    at(index: number): Value | undefined {
      return Number.isSafeInteger(index) && index >= 0 ? values[index] : undefined;
    },
    forEach(visit: (value: Value, index: number) => void): void {
      values.forEach(visit);
    },
  };
}
