import {
  createVariantRevision,
  deriveAtlasAspectId,
  deriveWorldPhysicalBiomeBeltEntityId,
  deriveWorldPhysicalContextAspectId,
  fingerprintWorldPhysicalRootSignature,
  WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import { generateAtlasAtmosphere } from './atlas-atmosphere-generator.js';
import { atlasPlanetTopologyValidationAdapter } from './atlas-coastline-topology.js';
import {
  type AtlasEcologyGenerationInput,
  generateAtlasEcology,
} from './atlas-ecology-generator.js';
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

describe('whole-world ecology generation', () => {
  it('proposes canonical dependency-ordered full-profile moisture, zones, and biome belts', async () => {
    const input = await ecologyInput();
    const patch = proposed(input);

    expect(patch.moisture.target.aspect.aspectId).toBe(
      deriveWorldPhysicalContextAspectId(input.worldSurfaceEntityId, 'worldClimate.moisture'),
    );
    expect(patch.climateZones.target.aspect.aspectId).toBe(
      deriveWorldPhysicalContextAspectId(input.worldSurfaceEntityId, 'worldClimate.zones'),
    );
    expect(patch.biomeBelts.target.aspect.aspectId).toBe(
      deriveWorldPhysicalContextAspectId(input.worldSurfaceEntityId, 'worldEcology.biomeBelts'),
    );
    expect(patch.moisture.seedScope).toBe('map/entity');
    expect(patch.climateZones.seedScope).toBe('map/entity');
    expect(patch.biomeBelts.seedScope).toBe('map/entity');
    expect(patch.moisture.dependencyAspects.map(({ aspectId }) => aspectId)).toStrictEqual(
      expectedMoistureDependencies(input),
    );
    expect(patch.climateZones.dependencyAspects.map(({ aspectId }) => aspectId)).toStrictEqual(
      expectedZoneDependencies(input),
    );
    expect(patch.biomeBelts.dependencyAspects.map(({ aspectId }) => aspectId)).toStrictEqual(
      expectedBiomeDependencies(input),
    );

    const { moisture, climateZones, biomeBelts } = patch;
    expect(moisture.output.values.length).toBe(2_095_106);
    expect(moisture.output.influenceKinds).toStrictEqual(['coastal', 'rain-shadow', 'windward']);
    expect(moisture.output.minimumValue).toBeGreaterThanOrEqual(0);
    expect(moisture.output.maximumValue).toBeLessThanOrEqual(
      WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE,
    );
    const zoneKeys = new Set(climateZones.output.definitions.map(({ key }) => key));
    const biomeDefinitions = new Map(
      biomeBelts.output.definitions.map((definition) => [definition.key, definition]),
    );
    const zoneValuesAreDefined = { value: true };
    const biomeValuesAreCompatible = { value: true };
    climateZones.output.values.forEach((zone, index) => {
      const biome = requiredValue(biomeBelts.output.values.at(index));
      zoneValuesAreDefined.value &&= zoneKeys.has(zone);
      biomeValuesAreCompatible.value &&=
        biomeDefinitions.get(biome)?.compatibleClimateZoneKeys.includes(zone) ?? false;
    });
    expect(zoneValuesAreDefined.value).toBe(true);
    expect(biomeValuesAreCompatible.value).toBe(true);

    const southPole = getAtlasSampleStorageIndex(WORLD_ATLAS_FULL_PROFILE, 0, 0);
    const northPole = getAtlasSampleStorageIndex(
      WORLD_ATLAS_FULL_PROFILE,
      0,
      WORLD_ATLAS_FULL_PROFILE.latitudeBandCount,
    );
    expect(moisture.output.values.at(southPole)).toBeDefined();
    expect(moisture.output.values.at(northPole)).toBeDefined();
    expect(climateZones.output.values.at(southPole)).toBeDefined();
    expect(biomeBelts.output.values.at(northPole)).toBeDefined();
    for (const summary of biomeBelts.output.beltSummaries) {
      expect(summary.entityId).toBe(
        deriveWorldPhysicalBiomeBeltEntityId(
          input.worldMapId,
          summary.biomeKey,
          fingerprintWorldPhysicalRootSignature(summary.boundaryPoints),
        ),
      );
      expect(summary.boundaryPoints.length).toBeGreaterThanOrEqual(3);
      expect(
        atlasPlanetTopologyValidationAdapter.validate([{ points: summary.boundaryPoints }]),
      ).toStrictEqual([]);
    }
  }, 180_000);

  it('is repeatable and isolates accepted sources when revisions or preceding climate change', async () => {
    const input = await ecologyInput();
    const sourceBefore = stringifySource({
      records: input.records,
      mountains: input.mountainSystems,
      atmosphere: input.atmosphere,
    });
    const baseline = proposed(input);
    const repeated = proposed({ ...input, records: input.records });
    const rerolled = proposed({ ...input, moistureVariantRevision: revision(1) });
    const extreme = proposed(await ecologyInput('extreme'));

    expect(fingerprints(repeated)).toStrictEqual(fingerprints(baseline));
    expect(fingerprints(rerolled)).not.toStrictEqual(fingerprints(baseline));
    expect(fingerprints(extreme)).not.toStrictEqual(fingerprints(baseline));
    expect(
      stringifySource({
        records: input.records,
        mountains: input.mountainSystems,
        atmosphere: input.atmosphere,
      }),
    ).toBe(sourceBefore);
  }, 180_000);

  it('returns stable source diagnostics without proposing output for malformed predecessor proposals', async () => {
    const input = await ecologyInput();
    const invalidAtmosphere = generateAtlasEcology({
      ...input,
      atmosphere: {
        ...input.atmosphere,
        temperature: {
          ...input.atmosphere.temperature,
          output: {
            ...input.atmosphere.temperature.output,
            provenance: {
              ...input.atmosphere.temperature.output.provenance,
              fieldKind: 'moisture',
            },
          },
        },
      } as unknown as AtlasEcologyGenerationInput['atmosphere'],
    });
    const invalidMountains = generateAtlasEcology({
      ...input,
      mountainSystems: { ...input.mountainSystems, systems: [] },
    });
    const invalidDependencies = generateAtlasEcology({
      ...input,
      atmosphere: {
        ...input.atmosphere,
        prevailingWinds: {
          ...input.atmosphere.prevailingWinds,
          dependencyAspects: [],
        },
      },
    });

    for (const result of [invalidAtmosphere, invalidMountains, invalidDependencies]) {
      expect(result).toMatchObject({
        status: 'invalid',
        diagnostics: [{ code: 'atlas.ecology.source-invalid' }],
      });
      expect(result).not.toHaveProperty('patch');
    }
  }, 60_000);
});

let cachedSources:
  | Promise<
      Readonly<{
        records: AtlasEcologyGenerationInput['records'];
        mountainSystems: AtlasEcologyGenerationInput['mountainSystems'];
      }>
    >
  | undefined;

async function ecologyInput(
  climateCharacter: 'temperate' | 'varied' | 'extreme' = 'varied',
): Promise<AtlasEcologyGenerationInput> {
  const sources = cachedSources ?? createSources();
  cachedSources = sources;
  const { records, mountainSystems } = await sources;
  const atmosphere = generateAtlasAtmosphere({
    worldSeed: fixedAtlasInput().worldSeed,
    worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
    worldSurfaceEntityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
    macroElevationAspectId: FIXED_ATLAS_MACRO_ELEVATION_ASPECT_ID,
    landWaterClassificationAspectId: FIXED_ATLAS_LAND_WATER_ASPECT_ID,
    temperatureVariantRevision: revision(0),
    prevailingWindsVariantRevision: revision(0),
    climateCharacter,
    records,
    mountainSystems,
  });
  if (atmosphere.status !== 'proposed') throw new Error(JSON.stringify(atmosphere.diagnostics));
  return Object.freeze({
    worldSeed: fixedAtlasInput().worldSeed,
    worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
    worldSurfaceEntityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
    macroElevationAspectId: FIXED_ATLAS_MACRO_ELEVATION_ASPECT_ID,
    landWaterClassificationAspectId: FIXED_ATLAS_LAND_WATER_ASPECT_ID,
    moistureVariantRevision: revision(0),
    climateZonesVariantRevision: revision(0),
    biomeBeltsVariantRevision: revision(0),
    records,
    mountainSystems,
    atmosphere: atmosphere.patch,
  });
}

async function createSources(): Promise<
  Readonly<{
    records: AtlasEcologyGenerationInput['records'];
    mountainSystems: AtlasEcologyGenerationInput['mountainSystems'];
  }>
> {
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
  return Object.freeze({
    records: semantic.patch.records,
    mountainSystems: mountain.proposal.output,
  });
}

function proposed(input: AtlasEcologyGenerationInput) {
  const result = generateAtlasEcology(input);
  if (result.status !== 'proposed') throw new Error(JSON.stringify(result.diagnostics));
  return result.patch;
}

function expectedMoistureDependencies(input: AtlasEcologyGenerationInput): readonly string[] {
  return [
    deriveWorldPhysicalContextAspectId(input.worldSurfaceEntityId, 'worldClimate.prevailingWinds'),
    deriveWorldPhysicalContextAspectId(input.worldSurfaceEntityId, 'worldClimate.temperature'),
    deriveWorldPhysicalContextAspectId(input.worldSurfaceEntityId, 'worldTerrain.mountainSystems'),
    ...input.records.waterBodies.map(({ entityId }) =>
      deriveAtlasAspectId(entityId, 'waterBody.classification'),
    ),
  ].sort();
}

function expectedZoneDependencies(input: AtlasEcologyGenerationInput): readonly string[] {
  return [
    input.landWaterClassificationAspectId,
    deriveWorldPhysicalContextAspectId(input.worldSurfaceEntityId, 'worldClimate.moisture'),
    deriveWorldPhysicalContextAspectId(input.worldSurfaceEntityId, 'worldClimate.temperature'),
  ].sort();
}

function expectedBiomeDependencies(input: AtlasEcologyGenerationInput): readonly string[] {
  return [
    input.macroElevationAspectId,
    deriveWorldPhysicalContextAspectId(input.worldSurfaceEntityId, 'worldClimate.moisture'),
    deriveWorldPhysicalContextAspectId(input.worldSurfaceEntityId, 'worldClimate.temperature'),
    deriveWorldPhysicalContextAspectId(input.worldSurfaceEntityId, 'worldClimate.zones'),
    ...input.records.landmasses.map(({ entityId }) =>
      deriveAtlasAspectId(entityId, 'landmass.classification'),
    ),
  ].sort();
}

function fingerprints(patch: ReturnType<typeof proposed>): readonly string[] {
  return Object.freeze([
    patch.moisture.output.provenance.fingerprint,
    patch.climateZones.output.provenance.fingerprint,
    patch.biomeBelts.output.provenance.fingerprint,
  ]);
}

function revision(value: number) {
  const parsed = createVariantRevision(value);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostic));
  return parsed.value;
}

function requiredValue<Value>(value: Value | undefined): Value {
  if (value === undefined) throw new Error('Expected a complete world-atlas field.');
  return value;
}

function stringifySource(value: unknown): string {
  return JSON.stringify(value, (_key: string, nested: unknown): unknown =>
    typeof nested === 'bigint' ? nested.toString() : nested,
  );
}
