/** Deterministic broad temperature and prevailing-wind proposals from accepted world geography. */

import {
  type AspectId,
  type AspectName,
  type AtlasSemanticGeographyRecords,
  compareStableReferences,
  createBehaviorVersion,
  createDeterministicRandomStream,
  createNormalizedFieldTicks,
  createParameterSchemaVersion,
  createTemperatureTicks,
  createWindSpeedTicks,
  createWorldPhysicalFieldReader,
  type DeepReadonly,
  deriveAtlasAspectId,
  deriveWorldPhysicalContextAspectId,
  type EntityId,
  fingerprintWorldPhysicalField,
  formatWorldSeed,
  type GenerationDiagnostic,
  type GeneratorId,
  type MapEntitySeedInput,
  type MapId,
  type MountainSystems,
  type NormalizedFieldTicks,
  parseAspectName,
  parseGenerationDiagnosticCode,
  parseGeneratorId,
  parseSeedInput,
  type PrevailingWindField,
  type QuantizedScalarField,
  roundTiesAwayFromZero,
  type TemperatureField,
  type TemperatureTicks,
  validateAtlasSemanticGeographyRecords,
  validateWorldPhysicalMountainSystems,
  type VariantRevision,
  type WindSpeedTicks,
  WORLD_PHYSICAL_CONTEXT_CONTRACT_VERSION,
  WORLD_PHYSICAL_FIELD_BEHAVIOR_VERSION,
  WORLD_PHYSICAL_FIELD_ENCODING_VERSION,
  WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE,
  WORLD_PHYSICAL_TEMPERATURE_QUANTUM_CELSIUS,
  WORLD_PHYSICAL_WIND_SPEED_QUANTUM_METERS_PER_SECOND,
  type WorldSeed,
} from '@ttrpg-map/core';

import { getAtlasSampleStorageIndex, WORLD_ATLAS_FULL_PROFILE } from './atlas-sampling-profiles.js';
import type { GenerationProposal } from './generator-contracts.js';

export const ATLAS_ATMOSPHERE_GENERATOR_MANIFEST_VERSION = 1 as const;
export const ATLAS_ATMOSPHERE_PARAMETER_SCHEMA_VERSION = 1 as const;

export const ATLAS_ATMOSPHERE_DIAGNOSTIC_CODES = Object.freeze({
  inputInvalid: 'atlas.atmosphere.input-invalid',
  invariantInvalid: 'atlas.atmosphere.invariant-invalid',
  sourceInvalid: 'atlas.atmosphere.source-invalid',
} as const);

export interface AtlasAtmosphereParameters {
  readonly parameterSchemaVersion: typeof ATLAS_ATMOSPHERE_PARAMETER_SCHEMA_VERSION;
  readonly fieldEncodingVersion: typeof WORLD_PHYSICAL_FIELD_ENCODING_VERSION;
  readonly climateCharacter: 'temperate' | 'varied' | 'extreme';
}

export const ATLAS_ATMOSPHERE_GENERATOR_MANIFEST = Object.freeze({
  manifestVersion: ATLAS_ATMOSPHERE_GENERATOR_MANIFEST_VERSION,
  generatorIds: Object.freeze([
    'worldClimate.temperature',
    'worldClimate.prevailingWinds',
  ] as const),
  generatorVersion: WORLD_PHYSICAL_FIELD_BEHAVIOR_VERSION,
  parameterSchemaVersion: ATLAS_ATMOSPHERE_PARAMETER_SCHEMA_VERSION,
  inputAspects: Object.freeze([
    'worldTerrain.macroElevation',
    'worldSurface.landWaterClassification',
    'waterBody.classification',
    'worldTerrain.mountainSystems',
  ] as const),
  outputAspects: Object.freeze([
    'worldClimate.temperature',
    'worldClimate.prevailingWinds',
  ] as const),
  seedScope: 'map/entity',
  diagnostics: ATLAS_ATMOSPHERE_DIAGNOSTIC_CODES,
});

export interface AtlasAtmosphereGenerationInput {
  readonly worldSeed: WorldSeed;
  readonly worldMapId: MapId;
  readonly worldSurfaceEntityId: EntityId;
  readonly macroElevationAspectId: AspectId;
  readonly landWaterClassificationAspectId: AspectId;
  readonly temperatureVariantRevision: VariantRevision;
  readonly prevailingWindsVariantRevision: VariantRevision;
  readonly climateCharacter: AtlasAtmosphereParameters['climateCharacter'];
  readonly records: AtlasSemanticGeographyRecords;
  readonly mountainSystems: MountainSystems;
}

export type AtlasTemperatureAspectProposal = GenerationProposal<
  AtlasAtmosphereParameters,
  TemperatureField,
  MapEntitySeedInput
>;

export type AtlasPrevailingWindsAspectProposal = GenerationProposal<
  AtlasAtmosphereParameters,
  PrevailingWindField,
  MapEntitySeedInput
>;

export interface AtlasAtmosphereProposedPatch {
  readonly temperature: AtlasTemperatureAspectProposal;
  readonly prevailingWinds: AtlasPrevailingWindsAspectProposal;
}

interface MountainRootAddress {
  readonly longitudeIndex: number;
  readonly latitudeIndex: number;
}

export type AtlasAtmosphereGenerationResult =
  | { readonly status: 'proposed'; readonly patch: AtlasAtmosphereProposedPatch }
  | { readonly status: 'invalid'; readonly diagnostics: readonly GenerationDiagnostic[] };

const TEMPERATURE_ASPECT_NAME = required(parseAspectName('worldClimate.temperature'));
const WINDS_ASPECT_NAME = required(parseAspectName('worldClimate.prevailingWinds'));
const TEMPERATURE_GENERATOR_ID = required(parseGeneratorId('worldClimate.temperature'));
const WINDS_GENERATOR_ID = required(parseGeneratorId('worldClimate.prevailingWinds'));
const GENERATOR_VERSION = required(createBehaviorVersion(WORLD_PHYSICAL_FIELD_BEHAVIOR_VERSION));
const PARAMETER_SCHEMA_VERSION = required(
  createParameterSchemaVersion(ATLAS_ATMOSPHERE_PARAMETER_SCHEMA_VERSION),
);
const SAMPLE_COUNT =
  WORLD_ATLAS_FULL_PROFILE.longitudeCellCount * (WORLD_ATLAS_FULL_PROFILE.latitudeBandCount - 1) +
  2;
const LONGITUDE_STEP_TICKS = 2 ** 21;
const LATITUDE_STEP_TICKS = 2 ** 21;

/** Propose the two dependency-ordered atmosphere aspects without committing accepted document state. */
export function generateAtlasAtmosphere(
  input: AtlasAtmosphereGenerationInput,
): AtlasAtmosphereGenerationResult {
  const inputDiagnostics = validateInput(input);
  if (inputDiagnostics.length > 0) return invalid(inputDiagnostics);

  const temperatureAspectId = deriveWorldPhysicalContextAspectId(
    input.worldSurfaceEntityId,
    'worldClimate.temperature',
  );
  const prevailingWindsAspectId = deriveWorldPhysicalContextAspectId(
    input.worldSurfaceEntityId,
    'worldClimate.prevailingWinds',
  );
  const temperatureSeed = createSeedMetadata(
    input,
    TEMPERATURE_GENERATOR_ID,
    TEMPERATURE_ASPECT_NAME,
    input.temperatureVariantRevision,
    temperatureAspectId,
  );
  const windSeed = createSeedMetadata(
    input,
    WINDS_GENERATOR_ID,
    WINDS_ASPECT_NAME,
    input.prevailingWindsVariantRevision,
    prevailingWindsAspectId,
  );
  const temperatureStream = createDeterministicRandomStream(temperatureSeed);
  const windStream = createDeterministicRandomStream(windSeed);
  if (!temperatureStream.ok || !windStream.ok) {
    return invalid([
      diagnostic(
        ATLAS_ATMOSPHERE_DIAGNOSTIC_CODES.inputInvalid,
        temperatureAspectId,
        'Atmosphere generation could not create its declared map/entity deterministic streams.',
        'Restore the declared version-1 world seed and aspect revisions before retrying.',
      ),
    ]);
  }

  const temperatureSources = temperatureSourceAspectIds(input);
  const temperature = generateTemperature(
    input,
    temperatureAspectId,
    temperatureSources,
    temperatureStream.value.nextFloat64(),
  );
  const windSources = prevailingWindSourceAspectIds(input, temperatureAspectId);
  const prevailingWinds = generatePrevailingWinds(
    input,
    prevailingWindsAspectId,
    windSources,
    temperature,
    windStream.value.nextFloat64(),
  );
  const parameters: AtlasAtmosphereParameters = Object.freeze({
    parameterSchemaVersion: ATLAS_ATMOSPHERE_PARAMETER_SCHEMA_VERSION,
    fieldEncodingVersion: WORLD_PHYSICAL_FIELD_ENCODING_VERSION,
    climateCharacter: input.climateCharacter,
  });

  return Object.freeze({
    status: 'proposed',
    patch: Object.freeze({
      temperature: proposal(
        input,
        temperatureAspectId,
        TEMPERATURE_ASPECT_NAME,
        TEMPERATURE_GENERATOR_ID,
        input.temperatureVariantRevision,
        temperatureSources,
        parameters,
        temperatureSeed,
        temperature,
      ),
      prevailingWinds: proposal(
        input,
        prevailingWindsAspectId,
        WINDS_ASPECT_NAME,
        WINDS_GENERATOR_ID,
        input.prevailingWindsVariantRevision,
        windSources,
        parameters,
        windSeed,
        prevailingWinds,
      ),
    }),
  });
}

function validateInput(input: AtlasAtmosphereGenerationInput): readonly GenerationDiagnostic[] {
  const expectedMacro = deriveAtlasAspectId(
    input.worldSurfaceEntityId,
    'worldTerrain.macroElevation',
  );
  const expectedLandWater = deriveAtlasAspectId(
    input.worldSurfaceEntityId,
    'worldSurface.landWaterClassification',
  );
  const expectedMountainSystems = deriveWorldPhysicalContextAspectId(
    input.worldSurfaceEntityId,
    'worldTerrain.mountainSystems',
  );
  if (
    input.records.worldMapId !== input.worldMapId ||
    input.records.worldSurfaceEntityId !== input.worldSurfaceEntityId ||
    input.macroElevationAspectId !== expectedMacro ||
    input.landWaterClassificationAspectId !== expectedLandWater ||
    input.records.landWaterClassificationAspectId !== input.landWaterClassificationAspectId ||
    !['temperate', 'varied', 'extreme'].includes(input.climateCharacter)
  ) {
    return Object.freeze([
      diagnostic(
        ATLAS_ATMOSPHERE_DIAGNOSTIC_CODES.inputInvalid,
        input.macroElevationAspectId,
        'Atmosphere generation requires canonical world-surface aspect IDs and a supported climate character.',
        'Rebuild input from accepted semantic geography and validated physical-context controls.',
      ),
    ]);
  }
  const geography = validateAtlasSemanticGeographyRecords(input.records);
  if (!geography.ok) {
    return Object.freeze([
      diagnostic(
        ATLAS_ATMOSPHERE_DIAGNOSTIC_CODES.sourceInvalid,
        input.landWaterClassificationAspectId,
        `Atmosphere generation requires valid accepted M2 semantic geography (${geography.diagnostics[0]?.code ?? 'unknown'}).`,
        'Restore or regenerate upstream land/water and water-body classification before retrying.',
      ),
    ]);
  }
  const expectedMountainSources = [expectedMacro, expectedLandWater].sort(compareStableReferences);
  if (
    input.mountainSystems.ownerAspectId !== expectedMountainSystems ||
    !sameOrderedAspectIds(input.mountainSystems.sourceAspectIds, expectedMountainSources) ||
    input.mountainSystems.systems.length === 0 ||
    validateWorldPhysicalMountainSystems(
      input.mountainSystems,
      input.worldSurfaceEntityId,
      input.worldMapId,
    ).length > 0
  ) {
    return Object.freeze([
      diagnostic(
        ATLAS_ATMOSPHERE_DIAGNOSTIC_CODES.sourceInvalid,
        expectedMountainSystems,
        'Atmosphere generation requires the canonical accepted mountain-systems proposal.',
        'Restore or regenerate the upstream mountain-systems proposal before retrying.',
      ),
    ]);
  }
  return Object.freeze([]);
}

function generateTemperature(
  input: AtlasAtmosphereGenerationInput,
  ownerAspectId: AspectId,
  sourceAspectIds: readonly AspectId[],
  phase: number,
): TemperatureField {
  const values = new Array<TemperatureTicks>(SAMPLE_COUNT);
  const mountainRoots = mountainRootAddresses(input.mountainSystems);
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (
    let latitudeIndex = 0;
    latitudeIndex <= WORLD_ATLAS_FULL_PROFILE.latitudeBandCount;
    latitudeIndex += 1
  ) {
    const longitudeCount =
      latitudeIndex === 0 || latitudeIndex === WORLD_ATLAS_FULL_PROFILE.latitudeBandCount
        ? 1
        : WORLD_ATLAS_FULL_PROFILE.longitudeCellCount;
    for (let longitudeIndex = 0; longitudeIndex < longitudeCount; longitudeIndex += 1) {
      const sampleIndex = getAtlasSampleStorageIndex(
        WORLD_ATLAS_FULL_PROFILE,
        longitudeIndex,
        latitudeIndex,
      );
      const elevation = input.records.macroElevation.values.at(sampleIndex);
      const landWater = input.records.landWaterClassification.samples.at(sampleIndex);
      if (elevation === undefined || landWater === undefined) {
        throw new Error('Accepted full-profile source records are incomplete.');
      }
      const value = requiredValue(
        createTemperatureTicks(
          temperatureAt(
            latitudeIndex,
            elevation,
            landWater,
            mountainInfluenceAt(longitudeIndex, latitudeIndex, mountainRoots),
            input.climateCharacter,
            phase,
          ),
        ),
      );
      values[sampleIndex] = value;
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
  }
  return Object.freeze({
    ...temperatureFieldBase(ownerAspectId, sourceAspectIds, values, minimum, maximum),
    quantumCelsius: WORLD_PHYSICAL_TEMPERATURE_QUANTUM_CELSIUS,
  });
}

function generatePrevailingWinds(
  input: AtlasAtmosphereGenerationInput,
  ownerAspectId: AspectId,
  sourceAspectIds: readonly AspectId[],
  temperature: TemperatureField,
  phase: number,
): PrevailingWindField {
  const x = new Array<NormalizedFieldTicks>(SAMPLE_COUNT);
  const y = new Array<NormalizedFieldTicks>(SAMPLE_COUNT);
  const z = new Array<NormalizedFieldTicks>(SAMPLE_COUNT);
  const speed = new Array<WindSpeedTicks>(SAMPLE_COUNT);
  const minimum = {
    speed: Number.POSITIVE_INFINITY,
    x: Number.POSITIVE_INFINITY,
    y: Number.POSITIVE_INFINITY,
    z: Number.POSITIVE_INFINITY,
  };
  const maximum = {
    speed: Number.NEGATIVE_INFINITY,
    x: Number.NEGATIVE_INFINITY,
    y: Number.NEGATIVE_INFINITY,
    z: Number.NEGATIVE_INFINITY,
  };
  const mountainRoots = mountainRootAddresses(input.mountainSystems);
  for (
    let latitudeIndex = 0;
    latitudeIndex <= WORLD_ATLAS_FULL_PROFILE.latitudeBandCount;
    latitudeIndex += 1
  ) {
    const longitudeCount =
      latitudeIndex === 0 || latitudeIndex === WORLD_ATLAS_FULL_PROFILE.latitudeBandCount
        ? 1
        : WORLD_ATLAS_FULL_PROFILE.longitudeCellCount;
    for (let longitudeIndex = 0; longitudeIndex < longitudeCount; longitudeIndex += 1) {
      const sampleIndex = getAtlasSampleStorageIndex(
        WORLD_ATLAS_FULL_PROFILE,
        longitudeIndex,
        latitudeIndex,
      );
      const temperatureTicks = temperature.values.at(sampleIndex);
      if (temperatureTicks === undefined)
        throw new Error('Generated temperature field is incomplete.');
      const vector = windAt(
        longitudeIndex,
        latitudeIndex,
        temperatureTicks,
        mountainInfluenceAt(longitudeIndex, latitudeIndex, mountainRoots),
        phase,
      );
      x[sampleIndex] = vector.x;
      y[sampleIndex] = vector.y;
      z[sampleIndex] = vector.z;
      speed[sampleIndex] = vector.speed;
      minimum.x = Math.min(minimum.x, vector.x);
      minimum.y = Math.min(minimum.y, vector.y);
      minimum.z = Math.min(minimum.z, vector.z);
      minimum.speed = Math.min(minimum.speed, vector.speed);
      maximum.x = Math.max(maximum.x, vector.x);
      maximum.y = Math.max(maximum.y, vector.y);
      maximum.z = Math.max(maximum.z, vector.z);
      maximum.speed = Math.max(maximum.speed, vector.speed);
    }
  }
  return Object.freeze({
    xComponents: directionField(ownerAspectId, sourceAspectIds, x, minimum.x, maximum.x),
    yComponents: directionField(ownerAspectId, sourceAspectIds, y, minimum.y, maximum.y),
    zComponents: directionField(ownerAspectId, sourceAspectIds, z, minimum.z, maximum.z),
    speed: speedField(ownerAspectId, sourceAspectIds, speed, minimum.speed, maximum.speed),
    speedQuantumMetersPerSecond: WORLD_PHYSICAL_WIND_SPEED_QUANTUM_METERS_PER_SECOND,
  });
}

function temperatureAt(
  latitudeIndex: number,
  elevation: number,
  landWater: 'land' | 'water',
  mountainInfluence: number,
  climateCharacter: AtlasAtmosphereParameters['climateCharacter'],
  phase: number,
): number {
  const latitude = Math.abs((2 * latitudeIndex) / WORLD_ATLAS_FULL_PROFILE.latitudeBandCount - 1);
  const gradient =
    climateCharacter === 'temperate' ? 420 : climateCharacter === 'extreme' ? 680 : 540;
  const seasonalOffset = roundTiesAwayFromZero((phase - 0.5) * 24);
  const elevationCooling = roundTiesAwayFromZero((Math.max(0, elevation) * 150) / 2 ** 24);
  const maritimeOffset = landWater === 'water' ? 12 : -4;
  const mountainCooling = roundTiesAwayFromZero(28 * mountainInfluence);
  return roundTiesAwayFromZero(
    290 -
      gradient * latitude * latitude -
      elevationCooling +
      maritimeOffset -
      mountainCooling +
      seasonalOffset,
  );
}

function windAt(
  longitudeIndex: number,
  latitudeIndex: number,
  temperature: TemperatureTicks,
  mountainInfluence: number,
  phase: number,
): Readonly<{
  x: NormalizedFieldTicks;
  y: NormalizedFieldTicks;
  z: NormalizedFieldTicks;
  speed: WindSpeedTicks;
}> {
  if (latitudeIndex === 0 || latitudeIndex === WORLD_ATLAS_FULL_PROFILE.latitudeBandCount) {
    const calm = requiredValue(createWindSpeedTicks(0));
    const zero = requiredValue(createNormalizedFieldTicks(0));
    return Object.freeze({ x: zero, y: zero, z: zero, speed: calm });
  }
  const longitude =
    -Math.PI + (longitudeIndex * 2 * Math.PI) / WORLD_ATLAS_FULL_PROFILE.longitudeCellCount;
  const latitude =
    -Math.PI / 2 + (latitudeIndex * Math.PI) / WORLD_ATLAS_FULL_PROFILE.latitudeBandCount;
  const bandPhase =
    phase * Math.PI * 2 + Math.sin(latitude * 3) * 0.8 + (temperature / 1000) * 0.35;
  const east = Math.cos(bandPhase);
  const north = Math.sin(bandPhase);
  const eastX = -Math.sin(longitude);
  const eastY = Math.cos(longitude);
  const northX = -Math.sin(latitude) * Math.cos(longitude);
  const northY = -Math.sin(latitude) * Math.sin(longitude);
  const northZ = Math.cos(latitude);
  const x = requiredValue(
    createNormalizedFieldTicks(
      roundTiesAwayFromZero(
        (east * eastX + north * northX) * WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE,
      ),
    ),
  );
  const y = requiredValue(
    createNormalizedFieldTicks(
      roundTiesAwayFromZero(
        (east * eastY + north * northY) * WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE,
      ),
    ),
  );
  const z = requiredValue(
    createNormalizedFieldTicks(
      roundTiesAwayFromZero(north * northZ * WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE),
    ),
  );
  const speed = requiredValue(
    createWindSpeedTicks(
      Math.max(1, roundTiesAwayFromZero(70 + Math.abs(temperature) / 12 - 8 * mountainInfluence)),
    ),
  );
  return Object.freeze({ x, y, z, speed });
}

function temperatureFieldBase(
  ownerAspectId: AspectId,
  sourceAspectIds: readonly AspectId[],
  values: readonly TemperatureTicks[],
  minimumValue: number,
  maximumValue: number,
): QuantizedScalarField<'temperature', TemperatureTicks> {
  const reader = createWorldPhysicalFieldReader(Object.freeze([...values]));
  const minimum = requiredValue(createTemperatureTicks(minimumValue));
  const maximum = requiredValue(createTemperatureTicks(maximumValue));
  const provenance = Object.freeze({
    contractVersion: WORLD_PHYSICAL_CONTEXT_CONTRACT_VERSION,
    fieldKind: 'temperature' as const,
    ownerAspectId,
    sourceAspectIds: Object.freeze([...sourceAspectIds]),
    fieldBehaviorVersion: WORLD_PHYSICAL_FIELD_BEHAVIOR_VERSION,
    fieldEncodingVersion: WORLD_PHYSICAL_FIELD_ENCODING_VERSION,
    valueEncoding: 'signed-integer-ticks' as const,
    quantizationScale: 10 as const,
    samplingProfileId: 'world-atlas-full-v1' as const,
    samplingPolicyVersion: 1 as const,
    longitudeCellCount: 2_048 as const,
    latitudeBandCount: 1_024 as const,
    canonicalTraversal: 'south-pole-then-rows-then-north-pole' as const,
  });
  return Object.freeze({
    provenance: Object.freeze({
      ...provenance,
      fingerprint: fingerprintWorldPhysicalField({
        provenance,
        minimumValue: minimum,
        maximumValue: maximum,
        values: reader,
      }),
    }),
    minimumValue: minimum,
    maximumValue: maximum,
    values: reader,
  });
}

function directionField(
  ownerAspectId: AspectId,
  sourceAspectIds: readonly AspectId[],
  values: readonly NormalizedFieldTicks[],
  minimumValue: number,
  maximumValue: number,
): QuantizedScalarField<'prevailing-winds-direction', NormalizedFieldTicks> {
  const reader = createWorldPhysicalFieldReader(Object.freeze([...values]));
  const minimum = requiredValue(createNormalizedFieldTicks(minimumValue));
  const maximum = requiredValue(createNormalizedFieldTicks(maximumValue));
  const provenance = Object.freeze({
    contractVersion: WORLD_PHYSICAL_CONTEXT_CONTRACT_VERSION,
    fieldKind: 'prevailing-winds-direction' as const,
    ownerAspectId,
    sourceAspectIds: Object.freeze([...sourceAspectIds]),
    fieldBehaviorVersion: WORLD_PHYSICAL_FIELD_BEHAVIOR_VERSION,
    fieldEncodingVersion: WORLD_PHYSICAL_FIELD_ENCODING_VERSION,
    valueEncoding: 'normalized-integer-ticks' as const,
    quantizationScale: WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE,
    samplingProfileId: 'world-atlas-full-v1' as const,
    samplingPolicyVersion: 1 as const,
    longitudeCellCount: 2_048 as const,
    latitudeBandCount: 1_024 as const,
    canonicalTraversal: 'south-pole-then-rows-then-north-pole' as const,
  });
  return Object.freeze({
    provenance: Object.freeze({
      ...provenance,
      fingerprint: fingerprintWorldPhysicalField({
        provenance,
        minimumValue: minimum,
        maximumValue: maximum,
        values: reader,
      }),
    }),
    minimumValue: minimum,
    maximumValue: maximum,
    values: reader,
  });
}

function speedField(
  ownerAspectId: AspectId,
  sourceAspectIds: readonly AspectId[],
  values: readonly WindSpeedTicks[],
  minimumValue: number,
  maximumValue: number,
): QuantizedScalarField<'prevailing-winds-speed', WindSpeedTicks> {
  const reader = createWorldPhysicalFieldReader(Object.freeze([...values]));
  const minimum = requiredValue(createWindSpeedTicks(minimumValue));
  const maximum = requiredValue(createWindSpeedTicks(maximumValue));
  const provenance = Object.freeze({
    contractVersion: WORLD_PHYSICAL_CONTEXT_CONTRACT_VERSION,
    fieldKind: 'prevailing-winds-speed' as const,
    ownerAspectId,
    sourceAspectIds: Object.freeze([...sourceAspectIds]),
    fieldBehaviorVersion: WORLD_PHYSICAL_FIELD_BEHAVIOR_VERSION,
    fieldEncodingVersion: WORLD_PHYSICAL_FIELD_ENCODING_VERSION,
    valueEncoding: 'unsigned-integer-ticks' as const,
    quantizationScale: 10 as const,
    samplingProfileId: 'world-atlas-full-v1' as const,
    samplingPolicyVersion: 1 as const,
    longitudeCellCount: 2_048 as const,
    latitudeBandCount: 1_024 as const,
    canonicalTraversal: 'south-pole-then-rows-then-north-pole' as const,
  });
  return Object.freeze({
    provenance: Object.freeze({
      ...provenance,
      fingerprint: fingerprintWorldPhysicalField({
        provenance,
        minimumValue: minimum,
        maximumValue: maximum,
        values: reader,
      }),
    }),
    minimumValue: minimum,
    maximumValue: maximum,
    values: reader,
  });
}

function proposal<Output>(
  input: AtlasAtmosphereGenerationInput,
  aspectId: AspectId,
  aspectName: AspectName,
  generatorId: GeneratorId,
  variantRevision: VariantRevision,
  sourceAspectIds: readonly AspectId[],
  parameters: AtlasAtmosphereParameters,
  seedMetadata: MapEntitySeedInput,
  output: DeepReadonly<Output>,
): GenerationProposal<AtlasAtmosphereParameters, Output, MapEntitySeedInput> {
  return Object.freeze({
    status: 'proposed',
    target: Object.freeze({
      mapId: input.worldMapId,
      entityId: input.worldSurfaceEntityId,
      aspect: Object.freeze({ aspectId }),
      aspectName,
      variantRevision,
    }),
    generatorId,
    generatorVersion: GENERATOR_VERSION,
    parameterSchemaVersion: PARAMETER_SCHEMA_VERSION,
    parameters,
    seedScope: 'map/entity',
    seedMetadata,
    dependencyAspects: Object.freeze(
      sourceAspectIds.map((aspectId) => Object.freeze({ aspectId })),
    ),
    output,
    diagnostics: Object.freeze([]),
  });
}

function temperatureSourceAspectIds(input: AtlasAtmosphereGenerationInput): readonly AspectId[] {
  return Object.freeze(
    [
      input.macroElevationAspectId,
      input.landWaterClassificationAspectId,
      deriveWorldPhysicalContextAspectId(
        input.worldSurfaceEntityId,
        'worldTerrain.mountainSystems',
      ),
      ...waterBodyAspectIds(input.records),
    ].sort(compareStableReferences),
  );
}

function prevailingWindSourceAspectIds(
  input: AtlasAtmosphereGenerationInput,
  temperatureAspectId: AspectId,
): readonly AspectId[] {
  return Object.freeze(
    [
      temperatureAspectId,
      deriveWorldPhysicalContextAspectId(
        input.worldSurfaceEntityId,
        'worldTerrain.mountainSystems',
      ),
      ...waterBodyAspectIds(input.records),
    ].sort(compareStableReferences),
  );
}

function waterBodyAspectIds(records: AtlasSemanticGeographyRecords): readonly AspectId[] {
  return Object.freeze(
    records.waterBodies
      .map(({ entityId }) => deriveAtlasAspectId(entityId, 'waterBody.classification'))
      .sort(compareStableReferences),
  );
}

function mountainRootAddresses(mountainSystems: MountainSystems): readonly MountainRootAddress[] {
  const roots: MountainRootAddress[] = [];
  for (const system of mountainSystems.systems) {
    for (const centerline of system.centerlines) {
      for (const point of centerline) {
        const longitudeIndex = (point.longitudeTicks + 2 ** 31) / LONGITUDE_STEP_TICKS;
        const latitudeIndex = (point.latitudeTicks + 2 ** 30) / LATITUDE_STEP_TICKS;
        if (
          Number.isSafeInteger(longitudeIndex) &&
          Number.isSafeInteger(latitudeIndex) &&
          latitudeIndex >= 0 &&
          latitudeIndex <= WORLD_ATLAS_FULL_PROFILE.latitudeBandCount
        ) {
          roots.push(Object.freeze({ longitudeIndex, latitudeIndex }));
        }
      }
    }
  }
  return Object.freeze(
    roots.sort(
      (left, right) =>
        left.latitudeIndex - right.latitudeIndex || left.longitudeIndex - right.longitudeIndex,
    ),
  );
}

function mountainInfluenceAt(
  longitudeIndex: number,
  latitudeIndex: number,
  roots: readonly MountainRootAddress[],
): number {
  let influence = 0;
  for (const root of roots) {
    const longitudeDistance = Math.abs(longitudeIndex - root.longitudeIndex);
    const wrappedLongitudeDistance = Math.min(
      longitudeDistance,
      WORLD_ATLAS_FULL_PROFILE.longitudeCellCount - longitudeDistance,
    );
    const latitudeDistance = Math.abs(latitudeIndex - root.latitudeIndex);
    const distance = Math.hypot(wrappedLongitudeDistance, latitudeDistance);
    influence = Math.max(influence, Math.max(0, 1 - distance / 96));
  }
  return influence;
}

function createSeedMetadata(
  input: AtlasAtmosphereGenerationInput,
  generatorId: GeneratorId,
  aspectName: AspectName,
  variantRevision: VariantRevision,
  aspectId: AspectId,
): MapEntitySeedInput {
  const parsed = parseSeedInput({
    seedDerivationVersion: 1,
    deterministicStreamVersion: 1,
    seedScope: 'map/entity',
    worldSeed: formatWorldSeed(input.worldSeed),
    generatorId,
    generatorVersion: GENERATOR_VERSION,
    aspectName,
    variantRevision,
    mapId: input.worldMapId,
    entityId: input.worldSurfaceEntityId,
  });
  if (!parsed.ok || parsed.value.seedScope !== 'map/entity') {
    throw new Error(`Atmosphere seed metadata is invalid for aspect ${aspectId}.`);
  }
  return parsed.value;
}

function sameOrderedAspectIds(left: readonly AspectId[], right: readonly AspectId[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function diagnostic(
  name: (typeof ATLAS_ATMOSPHERE_DIAGNOSTIC_CODES)[keyof typeof ATLAS_ATMOSPHERE_DIAGNOSTIC_CODES],
  aspectId: AspectId,
  message: string,
  suggestedAction: string,
): GenerationDiagnostic {
  return Object.freeze({
    code: required(parseGenerationDiagnosticCode(name)),
    severity: 'error',
    target: Object.freeze({ aspectId }),
    message,
    suggestedAction,
  });
}

function invalid(diagnostics: readonly GenerationDiagnostic[]): AtlasAtmosphereGenerationResult {
  return Object.freeze({ status: 'invalid', diagnostics: Object.freeze([...diagnostics]) });
}

function required<Value>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly diagnostic: unknown },
): Value {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostic));
  return result.value;
}

function requiredValue<Value>(value: Value | undefined): Value {
  if (value === undefined) throw new Error('Internal atmosphere value is invalid.');
  return value;
}
