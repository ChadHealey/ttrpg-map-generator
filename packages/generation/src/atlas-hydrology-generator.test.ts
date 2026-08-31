import {
  createVariantRevision,
  createWorldPhysicalFieldReader,
  deriveWorldPhysicalContextAspectId,
  deriveWorldPhysicalFeatureEntityId,
  fingerprintWorldPhysicalRootSignature,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import { generateAtlasAtmosphere } from './atlas-atmosphere-generator.js';
import { generateAtlasEcology } from './atlas-ecology-generator.js';
import {
  type AtlasHydrologyGenerationInput,
  generateAtlasHydrology,
} from './atlas-hydrology-generator.js';
import {
  FIXED_ATLAS_LAND_WATER_ASPECT_ID,
  FIXED_ATLAS_MACRO_ELEVATION_ASPECT_ID,
  FIXED_ATLAS_WORLD_MAP_ID,
  FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
  fixedAtlasInput,
  generateFixedAtlasFull,
} from './atlas-land-water-test-support.js';
import { generateAtlasMountainSystems } from './atlas-mountain-systems-generator.js';
import { getAtlasSampleStorageIndex, WORLD_ATLAS_FULL_PROFILE } from './atlas-sampling-profiles.js';
import { generateAtlasSemanticGeography } from './atlas-semantic-generator-contract.js';

describe('whole-world hydrology generation', () => {
  it('proposes canonical full-profile watersheds with deterministic major river and lake records', async () => {
    const input = await hydrologyInput();
    const patch = proposed(input);

    expect(patch.watersheds.target.aspect.aspectId).toBe(
      deriveWorldPhysicalContextAspectId(input.worldSurfaceEntityId, 'worldHydrology.watersheds'),
    );
    expect(patch.majorRivers.target.aspect.aspectId).toBe(
      deriveWorldPhysicalContextAspectId(input.worldSurfaceEntityId, 'worldHydrology.majorRivers'),
    );
    expect(patch.majorLakes.target.aspect.aspectId).toBe(
      deriveWorldPhysicalContextAspectId(input.worldSurfaceEntityId, 'worldHydrology.majorLakes'),
    );
    expect(patch.watersheds.seedScope).toBe('map/entity');
    expect(patch.watersheds.output.values.length).toBe(2_095_106);
    expect(patch.watersheds.output.watersheds.length).toBe(input.records.landmasses.length);
    expect(patch.majorRivers.output.length).toBeGreaterThan(0);
    expect(patch.majorLakes.output.length).toBeGreaterThan(0);
    for (const watershed of patch.watersheds.output.watersheds) {
      expect(watershed.divideLines).toHaveLength(1);
      const river = patch.majorRivers.output.find(
        ({ watershedId }) => watershedId === watershed.entityId,
      );
      expect(watershed.outletEntityId).toBe(river?.outletEntityId);
      for (const point of watershed.divideLines.flat()) {
        expect(input.records.landWaterClassification.samples.at(sampleIndexFor(point))).toBe(
          'land',
        );
      }
    }
    for (const river of patch.majorRivers.output) {
      expect(river.centerline).toHaveLength(2);
      expect(river.dischargeSamples).toStrictEqual([1000, 2000]);
      expect(
        river.widthSamples.map(({ distanceMillimeters }) => distanceMillimeters),
      ).toStrictEqual([100000, 200000]);
    }
    for (const lake of patch.majorLakes.output) {
      expect(lake.ring).toHaveLength(4);
      expect(lake.outletRiverId).toBeUndefined();
      expect(lake.entityId).toBe(
        deriveWorldPhysicalFeatureEntityId(
          input.worldMapId,
          'lake',
          fingerprintWorldPhysicalRootSignature(lake.ring),
        ),
      );
    }
  }, 180_000);

  it('is repeatable and rejects malformed ecology without producing a partial patch', async () => {
    const input = await hydrologyInput();
    const baseline = proposed(input);
    const repeated = proposed({ ...input, records: input.records });
    const rerolled = proposed({ ...input, watershedsVariantRevision: revision(1) });
    const invalid = generateAtlasHydrology({
      ...input,
      ecology: {
        ...input.ecology,
        moisture: {
          ...input.ecology.moisture,
          dependencyAspects: [],
          output: {
            ...input.ecology.moisture.output,
            provenance: {
              ...input.ecology.moisture.output.provenance,
              ownerAspectId: deriveWorldPhysicalContextAspectId(
                input.worldSurfaceEntityId,
                'worldHydrology.watersheds',
              ),
            },
          },
        },
      },
    });
    const invalidValues = generateAtlasHydrology({
      ...input,
      ecology: {
        ...input.ecology,
        moisture: {
          ...input.ecology.moisture,
          output: {
            ...input.ecology.moisture.output,
            values: createWorldPhysicalFieldReader(
              Object.freeze([0]),
            ) as unknown as typeof input.ecology.moisture.output.values,
          },
        },
      },
    });

    expect(hydrologyFingerprint(repeated)).toStrictEqual(hydrologyFingerprint(baseline));
    expect(rerolled.watersheds.target.variantRevision).not.toBe(
      baseline.watersheds.target.variantRevision,
    );
    expect(invalid).toMatchObject({
      status: 'invalid',
      diagnostics: [{ code: 'atlas.hydrology.source-invalid' }],
    });
    expect(invalid).not.toHaveProperty('patch');
    expect(invalidValues).toMatchObject({
      status: 'invalid',
      diagnostics: [{ code: 'atlas.hydrology.source-invalid' }],
    });
  }, 180_000);
});

let cachedInput: Promise<AtlasHydrologyGenerationInput> | undefined;

async function hydrologyInput(): Promise<AtlasHydrologyGenerationInput> {
  cachedInput ??= createInput();
  return cachedInput;
}

function sampleIndexFor(point: {
  readonly longitudeTicks: number;
  readonly latitudeTicks: number;
}) {
  const latitudeIndex = (point.latitudeTicks + 2 ** 30) / 2 ** 21;
  const longitudeIndex =
    latitudeIndex === 0 || latitudeIndex === WORLD_ATLAS_FULL_PROFILE.latitudeBandCount
      ? 0
      : (point.longitudeTicks + 2 ** 31) / 2 ** 21;
  if (!Number.isSafeInteger(longitudeIndex) || !Number.isSafeInteger(latitudeIndex)) {
    throw new Error('Expected a canonical atlas sampling point.');
  }
  return getAtlasSampleStorageIndex(WORLD_ATLAS_FULL_PROFILE, longitudeIndex, latitudeIndex);
}

async function createInput(): Promise<AtlasHydrologyGenerationInput> {
  const generated = await generateFixedAtlasFull();
  const semantic = generateAtlasSemanticGeography({
    worldSeed: fixedAtlasInput().worldSeed,
    worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
    worldSurfaceEntityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
    landWaterClassificationAspectId: FIXED_ATLAS_LAND_WATER_ASPECT_ID,
    records: generated.patch.records,
    previousAcceptedAspects: [],
  });
  if (semantic.status !== 'proposed') throw new Error(JSON.stringify(semantic.diagnostics));
  const mountain = generateAtlasMountainSystems({
    worldSeed: fixedAtlasInput().worldSeed,
    worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
    worldSurfaceEntityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
    macroElevationAspectId: FIXED_ATLAS_MACRO_ELEVATION_ASPECT_ID,
    landWaterClassificationAspectId: FIXED_ATLAS_LAND_WATER_ASPECT_ID,
    mountainSystemsVariantRevision: revision(0),
    mountainCharacter: 'varied',
    records: generated.patch.records,
  });
  if (mountain.status !== 'proposed') throw new Error(JSON.stringify(mountain.diagnostics));
  const atmosphere = generateAtlasAtmosphere({
    worldSeed: fixedAtlasInput().worldSeed,
    worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
    worldSurfaceEntityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
    macroElevationAspectId: FIXED_ATLAS_MACRO_ELEVATION_ASPECT_ID,
    landWaterClassificationAspectId: FIXED_ATLAS_LAND_WATER_ASPECT_ID,
    temperatureVariantRevision: revision(0),
    prevailingWindsVariantRevision: revision(0),
    climateCharacter: 'varied',
    records: semantic.patch.records,
    mountainSystems: mountain.proposal.output,
  });
  if (atmosphere.status !== 'proposed') throw new Error(JSON.stringify(atmosphere.diagnostics));
  const ecology = generateAtlasEcology({
    worldSeed: fixedAtlasInput().worldSeed,
    worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
    worldSurfaceEntityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
    macroElevationAspectId: FIXED_ATLAS_MACRO_ELEVATION_ASPECT_ID,
    landWaterClassificationAspectId: FIXED_ATLAS_LAND_WATER_ASPECT_ID,
    moistureVariantRevision: revision(0),
    climateZonesVariantRevision: revision(0),
    biomeBeltsVariantRevision: revision(0),
    records: semantic.patch.records,
    mountainSystems: mountain.proposal.output,
    atmosphere: atmosphere.patch,
  });
  if (ecology.status !== 'proposed') throw new Error(JSON.stringify(ecology.diagnostics));
  return Object.freeze({
    worldSeed: fixedAtlasInput().worldSeed,
    worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
    worldSurfaceEntityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
    macroElevationAspectId: FIXED_ATLAS_MACRO_ELEVATION_ASPECT_ID,
    landWaterClassificationAspectId: FIXED_ATLAS_LAND_WATER_ASPECT_ID,
    watershedsVariantRevision: revision(0),
    majorRiversVariantRevision: revision(0),
    majorLakesVariantRevision: revision(0),
    records: semantic.patch.records,
    mountainSystems: mountain.proposal.output,
    ecology: ecology.patch,
  });
}

function proposed(input: AtlasHydrologyGenerationInput) {
  const result = generateAtlasHydrology(input);
  if (result.status !== 'proposed') throw new Error(JSON.stringify(result.diagnostics));
  return result.patch;
}

function revision(value: number) {
  const parsed = createVariantRevision(value);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostic));
  return parsed.value;
}

function hydrologyFingerprint(
  patch: Extract<
    ReturnType<typeof generateAtlasHydrology>,
    { readonly status: 'proposed' }
  >['patch'],
) {
  return {
    watershedField: patch.watersheds.output.provenance.fingerprint,
    watersheds: patch.watersheds.output.watersheds.map(({ entityId }) => entityId),
    rivers: patch.majorRivers.output.map(({ entityId }) => entityId),
    lakes: patch.majorLakes.output.map(({ entityId }) => entityId),
  };
}
