import {
  ATLAS_COASTLINE_EXTRACTION_ALGORITHM_VERSION,
  ATLAS_COASTLINE_GEOMETRY_BEHAVIOR_VERSION,
  ATLAS_COASTLINE_REPAIR_POLICY,
  ATLAS_COASTLINE_SIMPLIFICATION_POLICY_VERSION,
  ATLAS_COASTLINE_SIMPLIFICATION_TOLERANCE_TICKS,
  ATLAS_COASTLINE_TOPOLOGY_VALIDATION_VERSION,
  ATLAS_COASTLINE_WINDING,
  ATLAS_FIELD_QUANTIZATION_SCALE,
  ATLAS_FULL_LATITUDE_BAND_COUNT,
  ATLAS_FULL_LONGITUDE_CELL_COUNT,
  ATLAS_FULL_PROFILE_ID,
  ATLAS_FULL_SAMPLE_COUNT,
  type AtlasAppearanceRecords,
  type AtlasGeographyRecords,
  createDeterministicRandomStream,
  createVariantRevision,
  deriveAtlasAspectId,
  deriveAtlasSingletonEntityIds,
  parsePlanetPoint,
  parseStableId,
  parseWorldSeed,
  type PlanetPoint,
  type VariantRevision,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import {
  type AtlasAppearanceGenerationInput,
  createAtlasAppearanceSeedInputs,
  createInitialAtlasAppearanceRevisions,
  generateAtlasAppearance,
} from './atlas-appearance-generator.js';
import { RESTRAINED_INK_ATLAS_STYLE } from './restrained-ink-atlas-style.js';

describe('restrained atlas appearance generation', () => {
  it('uses three independent deterministic seed namespaces and leaves geography untouched', () => {
    const records = geography();
    const input = generationInput(
      records,
      createInitialAtlasAppearanceRevisions(),
      'initial-appearance',
    );
    const seeds = createAtlasAppearanceSeedInputs(input);
    const before = sourceReferences(records);

    const first = proposed(generateAtlasAppearance(input, runtime(input)));
    const second = proposed(generateAtlasAppearance(input, runtime(input)));

    expect(first.appearance).toEqual(second.appearance);
    expect(new Set(Object.values(seeds).map((seed) => seed.aspectName))).toHaveLength(3);
    expect(new Set(Object.values(seeds).map((seed) => seed.generatorId))).toHaveLength(3);
    expect(sourceReferences(records)).toEqual(before);
    expect(first.appearance.coastlineAppearance.ringDecisions).toHaveLength(
      records.coastline.rings.length,
    );
    expect(first.appearance.waterDecoration.paths.some(({ kind }) => kind === 'coastal-echo')).toBe(
      true,
    );
    expect(first.appearance.waterDecoration.paths.some(({ kind }) => kind === 'water-mark')).toBe(
      true,
    );
    expect(
      first.replacements.every(
        ({ seedMetadata }) => seedMetadata.entityId === first.appearance.atlasPresentationEntityId,
      ),
    ).toBe(true);
    const waterProposal = first.replacements.find(
      ({ target }) => target.aspectName === 'atlas.waterDecoration',
    );
    expect(waterProposal?.dependencyAspectIds).toEqual(
      [
        records.landWaterClassificationAspectId,
        deriveAtlasAspectId(
          deriveAtlasSingletonEntityIds(records.worldMapId).worldCoastlineEntityId,
          'worldCoastline.geometry',
        ),
        ...records.waterBodies.map(({ entityId }) =>
          deriveAtlasAspectId(entityId, 'waterBody.classification'),
        ),
      ].sort(),
    );
  });

  it('rerolls all appearance outputs without changing source geography or style provenance', () => {
    const records = geography();
    const baselineInput = generationInput(
      records,
      createInitialAtlasAppearanceRevisions(),
      'initial-appearance',
    );
    const revisionOne = revision(1);
    const rerollInput = generationInput(
      records,
      {
        coastlineAppearance: revisionOne,
        waterDecoration: revisionOne,
        paperTreatment: revisionOne,
      },
      'appearance-reroll',
    );
    const baseline = proposed(generateAtlasAppearance(baselineInput, runtime(baselineInput)));
    const rerolled = proposed(generateAtlasAppearance(rerollInput, runtime(rerollInput)));

    expect(rerolled.appearance.coastlineAppearance).not.toEqual(
      baseline.appearance.coastlineAppearance,
    );
    expect(rerolled.appearance.waterDecoration).not.toEqual(baseline.appearance.waterDecoration);
    expect(rerolled.appearance.paperTreatment).not.toEqual(baseline.appearance.paperTreatment);
    expect(rerolled.explicitlyIncrementedAspectIds).toHaveLength(3);
    for (const appearance of [baseline.appearance, rerolled.appearance]) {
      expect(styleIds(appearance)).toEqual([
        RESTRAINED_INK_ATLAS_STYLE.styleId,
        RESTRAINED_INK_ATLAS_STYLE.styleId,
        RESTRAINED_INK_ATLAS_STYLE.styleId,
      ]);
    }
    expect(rerollInput.records).toBe(baselineInput.records);
    expect(rerollInput.records.coastline).toBe(baselineInput.records.coastline);
  });
});

function runtime(input: AtlasAppearanceGenerationInput) {
  const seeds = createAtlasAppearanceSeedInputs(input);
  return {
    coastlineAppearanceRandom: stream(seeds.coastlineAppearance),
    waterDecorationRandom: stream(seeds.waterDecoration),
    paperTreatmentRandom: stream(seeds.paperTreatment),
  };
}

function stream(seed: ReturnType<typeof createAtlasAppearanceSeedInputs>['coastlineAppearance']) {
  const result = createDeterministicRandomStream(seed);
  if (!result.ok) throw new Error(result.diagnostic.message);
  return result.value;
}

function generationInput(
  records: AtlasGeographyRecords,
  variantRevisions: ReturnType<typeof createInitialAtlasAppearanceRevisions>,
  operationMode: AtlasAppearanceGenerationInput['operationMode'],
): AtlasAppearanceGenerationInput {
  const seed = parseWorldSeed('81985529216486895');
  if (!seed.ok) throw new Error(seed.diagnostic.message);
  return {
    worldSeed: seed.value,
    worldMapId: records.worldMapId,
    records,
    variantRevisions,
    operationMode,
  };
}

function geography(): AtlasGeographyRecords {
  const worldMapId = stable('map', 'a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7');
  const singletons = deriveAtlasSingletonEntityIds(worldMapId);
  const landmassId = stable('entity', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  const waterBodyId = stable('entity', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  const componentId = stable('surface-component', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  const waterComponentId = stable('surface-component', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
  const ringId = stable('coastline-ring', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  const waterSamples = Object.freeze(new Array<'water'>(ATLAS_FULL_SAMPLE_COUNT).fill('water'));
  return Object.freeze({
    controls: Object.freeze({
      worldCircumferenceKm: 40_000,
      targetWaterCoveragePercent: 65,
      continentCountIntent: 4,
      continentDistribution: 'varied',
      fragmentationPercent: 35,
      islandAbundancePercent: 35,
      archipelagoAbundancePercent: 25,
      oceanConnectivity: 'singleGlobal',
      polarCharacter: 'neutral',
    }),
    macroElevation: Object.freeze({
      provenance: Object.freeze({
        contractVersion: 1,
        samplingProfileId: ATLAS_FULL_PROFILE_ID,
        samplingPolicyVersion: 1,
        longitudeCellCount: ATLAS_FULL_LONGITUDE_CELL_COUNT,
        latitudeBandCount: ATLAS_FULL_LATITUDE_BAND_COUNT,
        canonicalTraversal: 'south-pole-then-rows-then-north-pole',
        fieldBehaviorVersion: 1,
        quantizationScale: ATLAS_FIELD_QUANTIZATION_SCALE,
      }),
      values: Object.freeze([]),
    }),
    landWaterClassification: Object.freeze({
      classificationBehaviorVersion: 1,
      seaLevelContourDoubledTicks: 1,
      samples: waterSamples,
    }),
    semanticClassificationVersion: 1,
    worldMapId,
    worldSurfaceEntityId: singletons.worldSurfaceEntityId,
    landWaterClassificationAspectId: deriveAtlasAspectId(
      singletons.worldSurfaceEntityId,
      'worldSurface.landWaterClassification',
    ),
    landmasses: Object.freeze([
      Object.freeze({
        entityId: landmassId,
        sourceClassificationAspectId: deriveAtlasAspectId(landmassId, 'landmass.classification'),
        componentId,
        membership: Object.freeze({
          classificationVersion: 1,
          fingerprint: '1'.repeat(64),
          sampleCount: 1,
          sphericalAreaWeight: 1,
          sampleRanges: Object.freeze([{ startIndex: 1_048_577, endIndexExclusive: 1_048_578 }]),
        }),
        kind: 'continent',
        adjacentWaterBodyIds: Object.freeze([waterBodyId]),
      }),
    ]),
    islandGroups: Object.freeze([]),
    waterBodies: Object.freeze([
      Object.freeze({
        entityId: waterBodyId,
        sourceClassificationAspectId: deriveAtlasAspectId(waterBodyId, 'waterBody.classification'),
        componentId: waterComponentId,
        membership: Object.freeze({
          classificationVersion: 1,
          fingerprint: '2'.repeat(64),
          sampleCount: ATLAS_FULL_SAMPLE_COUNT,
          sphericalAreaWeight: 1,
          sampleRanges: Object.freeze([
            { startIndex: 0, endIndexExclusive: ATLAS_FULL_SAMPLE_COUNT },
          ]),
        }),
        kind: 'oceanBasin',
        enclosure: 'open-marine',
        enclosedByLandmassIds: Object.freeze([]),
        adjacentLandmassIds: Object.freeze([landmassId]),
        connectivity: Object.freeze([]),
      }),
    ]),
    coastline: Object.freeze({
      geometryBehaviorVersion: ATLAS_COASTLINE_GEOMETRY_BEHAVIOR_VERSION,
      extractionAlgorithmVersion: ATLAS_COASTLINE_EXTRACTION_ALGORITHM_VERSION,
      simplificationPolicyVersion: ATLAS_COASTLINE_SIMPLIFICATION_POLICY_VERSION,
      simplificationToleranceTicks: ATLAS_COASTLINE_SIMPLIFICATION_TOLERANCE_TICKS,
      topologyValidationVersion: ATLAS_COASTLINE_TOPOLOGY_VALIDATION_VERSION,
      winding: ATLAS_COASTLINE_WINDING,
      repairPolicy: ATLAS_COASTLINE_REPAIR_POLICY,
      rings: Object.freeze([
        Object.freeze({
          ringId,
          sourceBoundaryFingerprint: '3'.repeat(64),
          landmassId,
          waterBodyIds: Object.freeze([waterBodyId]),
          points: ringPoints(),
        }),
      ]),
    }),
  });
}

function ringPoints(): readonly PlanetPoint[] {
  const points = [
    [-500_000_000, -300_000_000],
    [-250_000_000, -300_000_000],
    [0, -300_000_000],
    [250_000_000, -300_000_000],
    [500_000_000, -300_000_000],
    [500_000_000, -150_000_000],
    [500_000_000, 0],
    [500_000_000, 150_000_000],
    [500_000_000, 300_000_000],
    [250_000_000, 300_000_000],
    [0, 300_000_000],
    [-250_000_000, 300_000_000],
    [-500_000_000, 300_000_000],
    [-500_000_000, 150_000_000],
    [-500_000_000, 0],
    [-500_000_000, -150_000_000],
  ] as const;
  return Object.freeze(
    points.map(([longitudeTicks, latitudeTicks]) => {
      const parsed = parsePlanetPoint({ longitudeTicks, latitudeTicks });
      if (!parsed.ok) throw new Error(parsed.diagnostic.message);
      return parsed.value;
    }),
  );
}

function sourceReferences(records: AtlasGeographyRecords) {
  return {
    macroElevation: records.macroElevation,
    classification: records.landWaterClassification,
    landmasses: records.landmasses,
    waterBodies: records.waterBodies,
    coastline: records.coastline,
  };
}

function styleIds(appearance: AtlasAppearanceRecords) {
  return [
    appearance.coastlineAppearance.style.styleId,
    appearance.waterDecoration.style.styleId,
    appearance.paperTreatment.style.styleId,
  ];
}

function proposed(result: ReturnType<typeof generateAtlasAppearance>) {
  if (result.status !== 'proposed') throw new Error(JSON.stringify(result.diagnostics));
  return result.patch;
}

function revision(value: number): VariantRevision {
  const parsed = createVariantRevision(value);
  if (!parsed.ok) throw new Error(parsed.diagnostic.message);
  return parsed.value;
}

function stable<Kind extends Parameters<typeof parseStableId>[0]>(kind: Kind, value: string) {
  const parsed = parseStableId(kind, value);
  if (!parsed.ok) throw new Error(parsed.diagnostic.message);
  return parsed.value;
}
