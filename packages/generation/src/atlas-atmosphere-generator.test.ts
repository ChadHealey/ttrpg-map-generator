import {
  createVariantRevision,
  deriveAtlasAspectId,
  deriveWorldPhysicalContextAspectId,
  WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE,
  type WorldPhysicalFieldReader,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import {
  type AtlasAtmosphereGenerationInput,
  generateAtlasAtmosphere,
} from './atlas-atmosphere-generator.js';
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

describe('whole-world atmosphere generation', () => {
  it('produces two canonical proposals with the declared dependency topology and repeatable field fingerprints', async () => {
    const input = await atmosphereInput();
    const first = proposed(input);
    const repeated = proposed({ ...input, records: input.records });

    expect(fingerprints(repeated)).toStrictEqual(fingerprints(first));
    expect(first.temperature.target.aspect.aspectId).toBe(
      deriveWorldPhysicalContextAspectId(input.worldSurfaceEntityId, 'worldClimate.temperature'),
    );
    expect(first.prevailingWinds.target.aspect.aspectId).toBe(
      deriveWorldPhysicalContextAspectId(
        input.worldSurfaceEntityId,
        'worldClimate.prevailingWinds',
      ),
    );
    expect(first.temperature.dependencyAspects.map(({ aspectId }) => aspectId)).toStrictEqual(
      expectedTemperatureDependencies(input),
    );
    expect(first.prevailingWinds.dependencyAspects.map(({ aspectId }) => aspectId)).toStrictEqual(
      expectedWindDependencies(input),
    );
    expect(first.temperature.seedScope).toBe('map/entity');
    expect(first.prevailingWinds.seedScope).toBe('map/entity');
  }, 180_000);

  it('isolates accepted M2/M3 sources while climate controls and revisions alter only atmosphere proposals', async () => {
    const input = await atmosphereInput();
    const sourceBefore = JSON.stringify(input.records);
    const mountainsBefore = JSON.stringify(input.mountainSystems);
    const baseline = proposed(input);
    const extreme = proposed({ ...input, climateCharacter: 'extreme' });
    const rerolled = proposed({
      ...input,
      temperatureVariantRevision: revision(1),
      prevailingWindsVariantRevision: revision(1),
    });

    expect(fingerprints(extreme)).not.toStrictEqual(fingerprints(baseline));
    expect(fingerprints(rerolled)).not.toStrictEqual(fingerprints(baseline));
    expect(JSON.stringify(input.records)).toBe(sourceBefore);
    expect(JSON.stringify(input.mountainSystems)).toBe(mountainsBefore);
  }, 180_000);

  it('uses full-profile ranges, continuous seam neighbors, one-pole samples, and quantized Cartesian vectors', async () => {
    const patch = proposed(await atmosphereInput());
    const temperature = patch.temperature.output;
    const winds = patch.prevailingWinds.output;

    expect(temperature.values.length).toBe(2_095_106);
    expect(temperature.quantumCelsius).toBe(0.1);
    expect(winds.speedQuantumMetersPerSecond).toBe(0.1);
    expect(temperature.minimumValue).toBeLessThanOrEqual(temperature.maximumValue);
    expect(winds.speed.minimumValue).toBe(0);

    assertFieldRange(temperature.values, temperature.minimumValue, temperature.maximumValue);
    assertFieldRange(
      winds.xComponents.values,
      winds.xComponents.minimumValue,
      winds.xComponents.maximumValue,
    );
    assertFieldRange(
      winds.yComponents.values,
      winds.yComponents.minimumValue,
      winds.yComponents.maximumValue,
    );
    assertFieldRange(
      winds.zComponents.values,
      winds.zComponents.minimumValue,
      winds.zComponents.maximumValue,
    );
    assertFieldRange(winds.speed.values, winds.speed.minimumValue, winds.speed.maximumValue);

    const southPole = getAtlasSampleStorageIndex(WORLD_ATLAS_FULL_PROFILE, 0, 0);
    const northPole = getAtlasSampleStorageIndex(
      WORLD_ATLAS_FULL_PROFILE,
      0,
      WORLD_ATLAS_FULL_PROFILE.latitudeBandCount,
    );
    expect(winds.speed.values.at(southPole)).toBe(0);
    expect(winds.speed.values.at(northPole)).toBe(0);
    expect(winds.xComponents.values.at(southPole)).toBe(0);
    expect(winds.yComponents.values.at(northPole)).toBe(0);

    for (
      let latitudeIndex = 1;
      latitudeIndex < WORLD_ATLAS_FULL_PROFILE.latitudeBandCount;
      latitudeIndex += 73
    ) {
      const west = getAtlasSampleStorageIndex(WORLD_ATLAS_FULL_PROFILE, 0, latitudeIndex);
      const east = getAtlasSampleStorageIndex(
        WORLD_ATLAS_FULL_PROFILE,
        WORLD_ATLAS_FULL_PROFILE.longitudeCellCount - 1,
        latitudeIndex,
      );
      expect(
        Math.abs(
          requiredValue(temperature.values.at(west)) - requiredValue(temperature.values.at(east)),
        ),
      ).toBeLessThanOrEqual(1);
      for (const field of [
        winds.xComponents.values,
        winds.yComponents.values,
        winds.zComponents.values,
      ]) {
        expect(
          Math.abs(requiredValue(field.at(west)) - requiredValue(field.at(east))),
        ).toBeLessThan(WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE / 100);
      }
    }

    let vectorsAreValid = true;
    winds.speed.values.forEach((speed, index) => {
      const x = requiredValue(winds.xComponents.values.at(index));
      const y = requiredValue(winds.yComponents.values.at(index));
      const z = requiredValue(winds.zComponents.values.at(index));
      if (speed === 0) {
        vectorsAreValid = vectorsAreValid && x === 0 && y === 0 && z === 0;
        return;
      }
      const length = Math.hypot(x, y, z) / WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE;
      vectorsAreValid =
        vectorsAreValid && Math.abs(length - 1) < 3 / WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE;
    });
    expect(vectorsAreValid).toBe(true);
  }, 180_000);

  it('returns stable diagnostics without proposing output for invalid source or control input', async () => {
    const input = await atmosphereInput();
    const invalidControl = generateAtlasAtmosphere({
      ...input,
      climateCharacter: 'unbounded' as 'varied',
    });
    const invalidMountain = generateAtlasAtmosphere({
      ...input,
      mountainSystems: {
        ...input.mountainSystems,
        ownerAspectId: deriveWorldPhysicalContextAspectId(
          input.worldSurfaceEntityId,
          'worldClimate.temperature',
        ),
      },
    });
    const emptyMountainSystems = generateAtlasAtmosphere({
      ...input,
      mountainSystems: {
        ...input.mountainSystems,
        systems: [],
      },
    });
    const invalidMountainCoordinates = generateAtlasAtmosphere({
      ...input,
      mountainSystems: {
        ...input.mountainSystems,
        systems: input.mountainSystems.systems.map((system, index) =>
          index === 0
            ? {
                ...system,
                centerlines: [
                  [
                    { longitudeTicks: 2 ** 31, latitudeTicks: 0 },
                    { longitudeTicks: 0, latitudeTicks: 0 },
                  ],
                ],
              }
            : system,
        ),
      } as unknown as AtlasAtmosphereGenerationInput['mountainSystems'],
    });
    const malformedMountainCenterline = generateAtlasAtmosphere({
      ...input,
      mountainSystems: {
        ...input.mountainSystems,
        systems: input.mountainSystems.systems.map((system, index) =>
          index === 0 ? { ...system, centerlines: [[]] } : system,
        ),
      },
    });

    expect(invalidControl).toMatchObject({
      status: 'invalid',
      diagnostics: [{ code: 'atlas.atmosphere.input-invalid' }],
    });
    expect(invalidMountain).toMatchObject({
      status: 'invalid',
      diagnostics: [{ code: 'atlas.atmosphere.source-invalid' }],
    });
    for (const result of [
      emptyMountainSystems,
      invalidMountainCoordinates,
      malformedMountainCenterline,
    ]) {
      expect(result).toMatchObject({
        status: 'invalid',
        diagnostics: [{ code: 'atlas.atmosphere.source-invalid' }],
      });
      expect(result).not.toHaveProperty('patch');
    }
  }, 60_000);
});

let cachedSources:
  | Promise<
      Readonly<{
        records: AtlasAtmosphereGenerationInput['records'];
        mountainSystems: AtlasAtmosphereGenerationInput['mountainSystems'];
      }>
    >
  | undefined;

async function atmosphereInput(): Promise<AtlasAtmosphereGenerationInput> {
  const sources = cachedSources ?? createAtmosphereSources();
  cachedSources = sources;
  const { records, mountainSystems } = await sources;
  return Object.freeze({
    worldSeed: fixedAtlasInput().worldSeed,
    worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
    worldSurfaceEntityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
    macroElevationAspectId: FIXED_ATLAS_MACRO_ELEVATION_ASPECT_ID,
    landWaterClassificationAspectId: FIXED_ATLAS_LAND_WATER_ASPECT_ID,
    temperatureVariantRevision: revision(0),
    prevailingWindsVariantRevision: revision(0),
    climateCharacter: 'varied',
    records,
    mountainSystems,
  });
}

async function createAtmosphereSources(): Promise<
  Readonly<{
    records: AtlasAtmosphereGenerationInput['records'];
    mountainSystems: AtlasAtmosphereGenerationInput['mountainSystems'];
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

function proposed(input: AtlasAtmosphereGenerationInput) {
  const result = generateAtlasAtmosphere(input);
  if (result.status !== 'proposed') throw new Error(JSON.stringify(result.diagnostics));
  return result.patch;
}

function expectedTemperatureDependencies(input: AtlasAtmosphereGenerationInput): readonly string[] {
  return [
    input.macroElevationAspectId,
    input.landWaterClassificationAspectId,
    deriveWorldPhysicalContextAspectId(input.worldSurfaceEntityId, 'worldTerrain.mountainSystems'),
    ...input.records.waterBodies.map(({ entityId }) =>
      deriveAtlasAspectId(entityId, 'waterBody.classification'),
    ),
  ].sort();
}

function expectedWindDependencies(input: AtlasAtmosphereGenerationInput): readonly string[] {
  return [
    deriveWorldPhysicalContextAspectId(input.worldSurfaceEntityId, 'worldClimate.temperature'),
    deriveWorldPhysicalContextAspectId(input.worldSurfaceEntityId, 'worldTerrain.mountainSystems'),
    ...input.records.waterBodies.map(({ entityId }) =>
      deriveAtlasAspectId(entityId, 'waterBody.classification'),
    ),
  ].sort();
}

function fingerprints(patch: ReturnType<typeof proposed>): readonly string[] {
  return Object.freeze([
    patch.temperature.output.provenance.fingerprint,
    patch.prevailingWinds.output.xComponents.provenance.fingerprint,
    patch.prevailingWinds.output.yComponents.provenance.fingerprint,
    patch.prevailingWinds.output.zComponents.provenance.fingerprint,
    patch.prevailingWinds.output.speed.provenance.fingerprint,
  ]);
}

function assertFieldRange<Value extends number>(
  values: WorldPhysicalFieldReader<Value>,
  minimum: Value,
  maximum: Value,
): void {
  let isWithinRange = true;
  values.forEach((value) => {
    isWithinRange =
      isWithinRange && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
  });
  expect(isWithinRange).toBe(true);
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
