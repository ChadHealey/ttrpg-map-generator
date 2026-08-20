import {
  ATLAS_FIELD_QUANTIZATION_SCALE,
  type AtlasSampleReader,
  atlasSampleReaderToArray,
  type AtlasSemanticGeographyRecords,
  createImmutableDomainSnapshot,
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

const garbageCollector = (globalThis as { readonly gc?: () => void }).gc;

describe('atlas semantic validation proof', () => {
  it('reuses policy validation for an exact immutable semantic graph', async () => {
    const records = await classifiedRecords();
    expect(validateAtlasSemanticGeographyRecords(records)).toStrictEqual({ ok: true });

    const reusedWithPoisonedAnalysis = validateAtlasSemanticGeographyRecordsWithAnalysis(
      records,
      poisonedAnalysis(),
    );
    expect(reusedWithPoisonedAnalysis).toStrictEqual({ ok: true });
  }, 30_000);

  it('never grants a cached success after a semantic input identity changes', async () => {
    const records = await classifiedRecords();
    expect(validateAtlasSemanticGeographyRecords(records)).toStrictEqual({ ok: true });
    const firstLandmass = records.landmasses[0];
    expect(firstLandmass).toBeDefined();
    if (firstLandmass === undefined) return;

    const changedInputs: readonly AtlasSemanticGeographyRecords[] = [
      { ...records, controls: { ...records.controls } },
      { ...records, macroElevation: { ...records.macroElevation } },
      { ...records, landWaterClassification: { ...records.landWaterClassification } },
      { ...records, landmasses: [...records.landmasses] },
      { ...records, landmasses: [{ ...firstLandmass }, ...records.landmasses.slice(1)] },
      { ...records, islandGroups: [...records.islandGroups] },
      { ...records, waterBodies: [...records.waterBodies] },
    ];
    for (const changedRecords of changedInputs) {
      expect(() =>
        validateAtlasSemanticGeographyRecordsWithAnalysis(changedRecords, poisonedAnalysis()),
      ).toThrow('Exact semantic validation should not read a redundant policy analysis.');
    }
  }, 30_000);

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

  const retentionIt = garbageCollector === undefined ? it.skip : it;
  retentionIt(
    'does not retain obsolete derived semantic graphs behind a live classification',
    async () => {
      await proveObsoleteSemanticGraphsCollect(garbageCollector);
    },
    60_000,
  );
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

function poisonedAnalysis(): Parameters<
  typeof validateAtlasSemanticGeographyRecordsWithAnalysis
>[1] {
  return {
    get partition(): never {
      throw new Error('Exact semantic validation should not read a redundant policy analysis.');
    },
    get water(): never {
      throw new Error('Exact semantic validation should not read a redundant policy analysis.');
    },
  };
}

async function proveObsoleteSemanticGraphsCollect(
  collectGarbage: (() => void) | undefined,
): Promise<void> {
  if (collectGarbage === undefined)
    throw new Error('The retention proof requires node --expose-gc.');
  const records = await classifiedRecords();
  const partition = analyzeAtlasSurfacePartition(records.landWaterClassification.samples);
  const water = segmentAtlasWaterBodies(
    records.landWaterClassification.samples,
    partition,
    records.controls.oceanConnectivity,
  );
  expect(water.ok).toBe(true);
  if (!water.ok) return;

  const obsoleteReferences = Array.from({ length: 6 }, () =>
    validateTransientSemanticGraph(records, { partition, water }),
  ).flat();
  await collectWeakReferences(collectGarbage, obsoleteReferences);

  expect(records.landWaterClassification).toBeDefined();
  expect(obsoleteReferences.every((reference) => reference.deref() === undefined)).toBe(true);
}

function validateTransientSemanticGraph(
  records: AtlasSemanticGeographyRecords,
  analysis: Parameters<typeof validateAtlasSemanticGeographyRecordsWithAnalysis>[1],
): readonly WeakRef<object>[] {
  const snapshot = createImmutableDomainSnapshot({
    ...records,
    landmasses: records.landmasses.map((landmass) => ({ ...landmass })),
    islandGroups: records.islandGroups.map((islandGroup) => ({ ...islandGroup })),
    waterBodies: records.waterBodies.map((waterBody) => ({ ...waterBody })),
  });
  expect(snapshot.ok).toBe(true);
  if (!snapshot.ok) throw new Error('Expected a snapshot-owned derived semantic graph.');
  const derived = snapshot.value;
  expect(validateAtlasSemanticGeographyRecordsWithAnalysis(derived, analysis)).toStrictEqual({
    ok: true,
  });

  const firstLandmass = derived.landmasses[0];
  expect(firstLandmass).toBeDefined();
  if (firstLandmass === undefined) throw new Error('Expected a derived landmass.');
  return [new WeakRef(derived), new WeakRef(derived.landmasses), new WeakRef(firstLandmass)];
}

async function collectWeakReferences(
  collectGarbage: () => void,
  references: readonly WeakRef<object>[],
): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await nextTask();
    collectGarbage();
    await nextTask();
    if (references.every((reference) => reference.deref() === undefined)) return;
  }
}

function nextTask(): Promise<void> {
  return new Promise<void>((resolve) => {
    const schedule = (
      globalThis as unknown as {
        readonly setTimeout: (callback: () => void, delay: number) => void;
      }
    ).setTimeout;
    schedule(resolve, 0);
  });
}
