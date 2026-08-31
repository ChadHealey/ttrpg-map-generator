/** Deterministic broad moisture, climate-zone, and biome-belt proposals from accepted world fields. */

/*
 * This generator intentionally keeps its three dependency-ordered aspects together, matching the
 * immediately preceding atmosphere generator. They share one canonical traversal, provenance
 * construction, and source-validation boundary; splitting them would obscure those invariants.
 */

import {
  type AspectId,
  type AspectName,
  type AtlasSemanticGeographyRecords,
  type BiomeBeltField,
  type BiomeDefinition,
  type BiomeKey,
  type ClimateZoneDefinition,
  type ClimateZoneField,
  type ClimateZoneKey,
  compareStableReferences,
  createBehaviorVersion,
  createDeterministicRandomStream,
  createNormalizedFieldTicks,
  createParameterSchemaVersion,
  createTemperatureTicks,
  createWorldPhysicalFieldReader,
  type DeepReadonly,
  deriveAtlasAspectId,
  deriveWorldPhysicalBiomeBeltEntityId,
  deriveWorldPhysicalContextAspectId,
  type EntityId,
  fingerprintWorldPhysicalField,
  fingerprintWorldPhysicalRootSignature,
  formatWorldSeed,
  type GenerationDiagnostic,
  type GeneratorId,
  type MapEntitySeedInput,
  type MapId,
  type MoistureField,
  type MountainSystems,
  type NormalizedFieldTicks,
  parseAspectName,
  parseBiomeKey,
  parseClimateZoneKey,
  parseGenerationDiagnosticCode,
  parseGeneratorId,
  parseSeedInput,
  type PlanetPoint,
  type QuantizedScalarField,
  roundTiesAwayFromZero,
  validateAtlasSemanticGeographyRecords,
  validateWorldPhysicalMountainSystems,
  validateWorldPhysicalPrevailingWindField,
  validateWorldPhysicalTemperatureField,
  type VariantRevision,
  WORLD_PHYSICAL_CLASSIFICATION_POLICY_VERSION,
  WORLD_PHYSICAL_CONTEXT_CONTRACT_VERSION,
  WORLD_PHYSICAL_FIELD_BEHAVIOR_VERSION,
  WORLD_PHYSICAL_FIELD_ENCODING_VERSION,
  WORLD_PHYSICAL_GEOMETRY_VERSION,
  WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE,
  type WorldPhysicalFieldKind,
  type WorldSeed,
} from '@ttrpg-map/core';

import {
  ATLAS_ATMOSPHERE_PARAMETER_SCHEMA_VERSION,
  type AtlasAtmosphereProposedPatch,
} from './atlas-atmosphere-generator.js';
import { atlasPlanetContourExtractionAdapter } from './atlas-coastline-contours.js';
import {
  createAtlasContourLevel,
  getAtlasSampleStorageIndex,
  parseAtlasFieldValueTicks,
  WORLD_ATLAS_FULL_PROFILE,
} from './atlas-sampling-profiles.js';
import type { GenerationProposal } from './generator-contracts.js';
import type { QuantizedSphericalField } from './geography-algorithm-adapters.js';

export const ATLAS_ECOLOGY_GENERATOR_MANIFEST_VERSION = 1 as const;
export const ATLAS_ECOLOGY_PARAMETER_SCHEMA_VERSION = 1 as const;

export const ATLAS_ECOLOGY_DIAGNOSTIC_CODES = Object.freeze({
  inputInvalid: 'atlas.ecology.input-invalid',
  invariantInvalid: 'atlas.ecology.invariant-invalid',
  sourceInvalid: 'atlas.ecology.source-invalid',
} as const);

export interface AtlasEcologyParameters {
  readonly parameterSchemaVersion: typeof ATLAS_ECOLOGY_PARAMETER_SCHEMA_VERSION;
  readonly classificationPolicyVersion: typeof WORLD_PHYSICAL_CLASSIFICATION_POLICY_VERSION;
  readonly fieldEncodingVersion: typeof WORLD_PHYSICAL_FIELD_ENCODING_VERSION;
}

export const ATLAS_ECOLOGY_GENERATOR_MANIFEST = Object.freeze({
  manifestVersion: ATLAS_ECOLOGY_GENERATOR_MANIFEST_VERSION,
  generatorIds: Object.freeze([
    'worldClimate.moisture',
    'worldClimate.zones',
    'worldEcology.biomeBelts',
  ] as const),
  generatorVersion: WORLD_PHYSICAL_FIELD_BEHAVIOR_VERSION,
  parameterSchemaVersion: ATLAS_ECOLOGY_PARAMETER_SCHEMA_VERSION,
  inputAspects: Object.freeze([
    'worldTerrain.macroElevation',
    'worldSurface.landWaterClassification',
    'landmass.classification',
    'waterBody.classification',
    'worldTerrain.mountainSystems',
    'worldClimate.temperature',
    'worldClimate.prevailingWinds',
  ] as const),
  outputAspects: Object.freeze([
    'worldClimate.moisture',
    'worldClimate.zones',
    'worldEcology.biomeBelts',
  ] as const),
  seedScope: 'map/entity',
  diagnostics: ATLAS_ECOLOGY_DIAGNOSTIC_CODES,
});

export interface AtlasEcologyGenerationInput {
  readonly worldSeed: WorldSeed;
  readonly worldMapId: MapId;
  readonly worldSurfaceEntityId: EntityId;
  readonly macroElevationAspectId: AspectId;
  readonly landWaterClassificationAspectId: AspectId;
  readonly moistureVariantRevision: VariantRevision;
  readonly climateZonesVariantRevision: VariantRevision;
  readonly biomeBeltsVariantRevision: VariantRevision;
  readonly records: AtlasSemanticGeographyRecords;
  readonly mountainSystems: MountainSystems;
  readonly atmosphere: AtlasAtmosphereProposedPatch;
}

export type AtlasMoistureAspectProposal = GenerationProposal<
  AtlasEcologyParameters,
  MoistureField,
  MapEntitySeedInput
>;
export type AtlasClimateZonesAspectProposal = GenerationProposal<
  AtlasEcologyParameters,
  ClimateZoneField,
  MapEntitySeedInput
>;
export type AtlasBiomeBeltsAspectProposal = GenerationProposal<
  AtlasEcologyParameters,
  BiomeBeltField,
  MapEntitySeedInput
>;

export interface AtlasEcologyProposedPatch {
  readonly moisture: AtlasMoistureAspectProposal;
  readonly climateZones: AtlasClimateZonesAspectProposal;
  readonly biomeBelts: AtlasBiomeBeltsAspectProposal;
}

export type AtlasEcologyGenerationResult =
  | { readonly status: 'proposed'; readonly patch: AtlasEcologyProposedPatch }
  | { readonly status: 'invalid'; readonly diagnostics: readonly GenerationDiagnostic[] };

const SAMPLE_COUNT =
  WORLD_ATLAS_FULL_PROFILE.longitudeCellCount * (WORLD_ATLAS_FULL_PROFILE.latitudeBandCount - 1) +
  2;
const MOISTURE_ASPECT_NAME = required(parseAspectName('worldClimate.moisture'));
const ZONES_ASPECT_NAME = required(parseAspectName('worldClimate.zones'));
const BIOMES_ASPECT_NAME = required(parseAspectName('worldEcology.biomeBelts'));
const TEMPERATURE_ASPECT_NAME = required(parseAspectName('worldClimate.temperature'));
const WINDS_ASPECT_NAME = required(parseAspectName('worldClimate.prevailingWinds'));
const MOISTURE_GENERATOR_ID = required(parseGeneratorId('worldClimate.moisture'));
const ZONES_GENERATOR_ID = required(parseGeneratorId('worldClimate.zones'));
const BIOMES_GENERATOR_ID = required(parseGeneratorId('worldEcology.biomeBelts'));
const TEMPERATURE_GENERATOR_ID = required(parseGeneratorId('worldClimate.temperature'));
const WINDS_GENERATOR_ID = required(parseGeneratorId('worldClimate.prevailingWinds'));
const GENERATOR_VERSION = required(createBehaviorVersion(WORLD_PHYSICAL_FIELD_BEHAVIOR_VERSION));
const PARAMETER_SCHEMA_VERSION = required(
  createParameterSchemaVersion(ATLAS_ECOLOGY_PARAMETER_SCHEMA_VERSION),
);
const NORMALIZED_MAX = WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE;
const BIOME_MASK_LOW = required(parseAtlasFieldValueTicks(-1));
const BIOME_MASK_HIGH = required(parseAtlasFieldValueTicks(1));
const BIOME_MASK_CONTOUR = required(
  createAtlasContourLevel(required(parseAtlasFieldValueTicks(0))),
);

const CLIMATE_ZONES = Object.freeze([
  climateZone('arid', Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 0, NORMALIZED_MAX / 4),
  climateZone('polar', Number.MIN_SAFE_INTEGER, 0, 0, NORMALIZED_MAX),
  climateZone('temperate', Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 0, NORMALIZED_MAX),
  climateZone('tropical', 221, Number.MAX_SAFE_INTEGER, 0, NORMALIZED_MAX),
  climateZone('water', Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 0, NORMALIZED_MAX),
]);
const BIOMES = Object.freeze([
  biome('arid-desert', ['arid']),
  biome('polar-tundra', ['polar']),
  biome('temperate-forest', ['temperate']),
  biome('tropical-rainforest', ['tropical']),
  biome('water', ['water']),
]);
const FIRST_CLIMATE_ZONE = requiredValue(CLIMATE_ZONES.at(0));
const LAST_CLIMATE_ZONE = requiredValue(CLIMATE_ZONES.at(-1));
const FIRST_BIOME = requiredValue(BIOMES.at(0));
const LAST_BIOME = requiredValue(BIOMES.at(-1));

/** Propose dependency-ordered ecological aspects without attaching them to accepted document state. */
export function generateAtlasEcology(
  input: AtlasEcologyGenerationInput,
): AtlasEcologyGenerationResult {
  const diagnostics = validateInput(input);
  if (diagnostics.length > 0) return invalid(diagnostics);

  const moistureAspectId = deriveWorldPhysicalContextAspectId(
    input.worldSurfaceEntityId,
    'worldClimate.moisture',
  );
  const zonesAspectId = deriveWorldPhysicalContextAspectId(
    input.worldSurfaceEntityId,
    'worldClimate.zones',
  );
  const biomesAspectId = deriveWorldPhysicalContextAspectId(
    input.worldSurfaceEntityId,
    'worldEcology.biomeBelts',
  );
  const moistureSeed = createSeedMetadata(
    input,
    MOISTURE_GENERATOR_ID,
    MOISTURE_ASPECT_NAME,
    input.moistureVariantRevision,
    moistureAspectId,
  );
  const moistureStream = createDeterministicRandomStream(moistureSeed);
  if (!moistureStream.ok) {
    return invalid([
      diagnostic(
        ATLAS_ECOLOGY_DIAGNOSTIC_CODES.inputInvalid,
        moistureAspectId,
        'Ecology generation could not create its declared map/entity deterministic stream.',
        'Restore the declared version-1 world seed and aspect revision before retrying.',
      ),
    ]);
  }
  const moistureSources = moistureSourceAspectIds(input);
  const moisture = generateMoisture(
    input,
    moistureAspectId,
    moistureSources,
    moistureStream.value.nextFloat64(),
  );
  const zoneSources = zoneSourceAspectIds(input, moistureAspectId);
  const climateZones = generateClimateZones(input, zonesAspectId, zoneSources, moisture);
  const biomeSources = biomeSourceAspectIds(input, zonesAspectId, moistureAspectId);
  const biomeBelts = generateBiomeBelts(input, biomesAspectId, biomeSources, climateZones);
  if (!biomeBelts.ok) {
    return invalid([
      diagnostic(
        ATLAS_ECOLOGY_DIAGNOSTIC_CODES.invariantInvalid,
        biomesAspectId,
        'Biome-belt contours violate the canonical planet-topology invariants.',
        'Reject this proposal; do not repair or replace the classified biome field.',
      ),
    ]);
  }
  const parameters: AtlasEcologyParameters = Object.freeze({
    parameterSchemaVersion: ATLAS_ECOLOGY_PARAMETER_SCHEMA_VERSION,
    classificationPolicyVersion: WORLD_PHYSICAL_CLASSIFICATION_POLICY_VERSION,
    fieldEncodingVersion: WORLD_PHYSICAL_FIELD_ENCODING_VERSION,
  });
  return Object.freeze({
    status: 'proposed',
    patch: Object.freeze({
      moisture: proposal(
        input,
        moistureAspectId,
        MOISTURE_ASPECT_NAME,
        MOISTURE_GENERATOR_ID,
        input.moistureVariantRevision,
        moistureSources,
        parameters,
        moistureSeed,
        moisture,
      ),
      climateZones: proposal(
        input,
        zonesAspectId,
        ZONES_ASPECT_NAME,
        ZONES_GENERATOR_ID,
        input.climateZonesVariantRevision,
        zoneSources,
        parameters,
        createSeedMetadata(
          input,
          ZONES_GENERATOR_ID,
          ZONES_ASPECT_NAME,
          input.climateZonesVariantRevision,
          zonesAspectId,
        ),
        climateZones,
      ),
      biomeBelts: proposal(
        input,
        biomesAspectId,
        BIOMES_ASPECT_NAME,
        BIOMES_GENERATOR_ID,
        input.biomeBeltsVariantRevision,
        biomeSources,
        parameters,
        createSeedMetadata(
          input,
          BIOMES_GENERATOR_ID,
          BIOMES_ASPECT_NAME,
          input.biomeBeltsVariantRevision,
          biomesAspectId,
        ),
        biomeBelts.value,
      ),
    }),
  });
}

function validateInput(input: AtlasEcologyGenerationInput): readonly GenerationDiagnostic[] {
  const expectedMacro = deriveAtlasAspectId(
    input.worldSurfaceEntityId,
    'worldTerrain.macroElevation',
  );
  const expectedLandWater = deriveAtlasAspectId(
    input.worldSurfaceEntityId,
    'worldSurface.landWaterClassification',
  );
  if (
    input.records.worldMapId !== input.worldMapId ||
    input.records.worldSurfaceEntityId !== input.worldSurfaceEntityId ||
    input.macroElevationAspectId !== expectedMacro ||
    input.landWaterClassificationAspectId !== expectedLandWater ||
    input.records.landWaterClassificationAspectId !== expectedLandWater
  ) {
    return Object.freeze([
      diagnostic(
        ATLAS_ECOLOGY_DIAGNOSTIC_CODES.inputInvalid,
        input.macroElevationAspectId,
        'Ecology generation requires canonical world-surface aspect IDs.',
        'Rebuild input from accepted semantic geography and physical-context proposals.',
      ),
    ]);
  }
  const geography = validateAtlasSemanticGeographyRecords(input.records);
  const mountains = validateWorldPhysicalMountainSystems(
    input.mountainSystems,
    input.worldSurfaceEntityId,
    input.worldMapId,
  );
  const temperature = validateWorldPhysicalTemperatureField(
    input.atmosphere.temperature.output,
    input.worldSurfaceEntityId,
  );
  const winds = validateWorldPhysicalPrevailingWindField(
    input.atmosphere.prevailingWinds.output,
    input.worldSurfaceEntityId,
  );
  if (
    !geography.ok ||
    mountains.length > 0 ||
    input.mountainSystems.systems.length === 0 ||
    temperature.length > 0 ||
    winds.length > 0 ||
    !hasAtmosphereTopology(input)
  ) {
    return Object.freeze([
      diagnostic(
        ATLAS_ECOLOGY_DIAGNOSTIC_CODES.sourceInvalid,
        expectedLandWater,
        'Ecology generation requires canonical accepted geography, mountain, temperature, and prevailing-wind proposals.',
        'Restore or regenerate the upstream M2, mountain, and atmosphere proposals before retrying.',
      ),
    ]);
  }
  return Object.freeze([]);
}

function hasAtmosphereTopology(input: AtlasEcologyGenerationInput): boolean {
  const temperature = input.atmosphere.temperature;
  const winds = input.atmosphere.prevailingWinds;
  const temperatureAspectId = deriveWorldPhysicalContextAspectId(
    input.worldSurfaceEntityId,
    'worldClimate.temperature',
  );
  const windsAspectId = deriveWorldPhysicalContextAspectId(
    input.worldSurfaceEntityId,
    'worldClimate.prevailingWinds',
  );
  const temperatureSources = [
    input.macroElevationAspectId,
    input.landWaterClassificationAspectId,
    deriveWorldPhysicalContextAspectId(input.worldSurfaceEntityId, 'worldTerrain.mountainSystems'),
    ...input.records.waterBodies.map(({ entityId }) =>
      deriveAtlasAspectId(entityId, 'waterBody.classification'),
    ),
  ].sort(compareStableReferences);
  const windSources = [
    temperatureAspectId,
    deriveWorldPhysicalContextAspectId(input.worldSurfaceEntityId, 'worldTerrain.mountainSystems'),
    ...input.records.waterBodies.map(({ entityId }) =>
      deriveAtlasAspectId(entityId, 'waterBody.classification'),
    ),
  ].sort(compareStableReferences);
  return (
    temperature.generatorId === TEMPERATURE_GENERATOR_ID &&
    temperature.generatorVersion === GENERATOR_VERSION &&
    temperature.parameterSchemaVersion === ATLAS_ATMOSPHERE_PARAMETER_SCHEMA_VERSION &&
    temperature.target.mapId === input.worldMapId &&
    temperature.target.entityId === input.worldSurfaceEntityId &&
    temperature.target.aspect.aspectId === temperatureAspectId &&
    temperature.target.aspectName === TEMPERATURE_ASPECT_NAME &&
    temperature.seedScope === 'map/entity' &&
    sameOrderedAspectIds(
      temperature.dependencyAspects.map(({ aspectId }) => aspectId),
      temperatureSources,
    ) &&
    sameOrderedAspectIds(temperature.output.provenance.sourceAspectIds, temperatureSources) &&
    winds.generatorId === WINDS_GENERATOR_ID &&
    winds.generatorVersion === GENERATOR_VERSION &&
    winds.parameterSchemaVersion === ATLAS_ATMOSPHERE_PARAMETER_SCHEMA_VERSION &&
    winds.target.mapId === input.worldMapId &&
    winds.target.entityId === input.worldSurfaceEntityId &&
    winds.target.aspect.aspectId === windsAspectId &&
    winds.target.aspectName === WINDS_ASPECT_NAME &&
    winds.seedScope === 'map/entity' &&
    sameOrderedAspectIds(
      winds.dependencyAspects.map(({ aspectId }) => aspectId),
      windSources,
    ) &&
    sameOrderedAspectIds(winds.output.speed.provenance.sourceAspectIds, windSources) &&
    sameOrderedAspectIds(winds.output.xComponents.provenance.sourceAspectIds, windSources) &&
    sameOrderedAspectIds(winds.output.yComponents.provenance.sourceAspectIds, windSources) &&
    sameOrderedAspectIds(winds.output.zComponents.provenance.sourceAspectIds, windSources)
  );
}

function generateMoisture(
  input: AtlasEcologyGenerationInput,
  ownerAspectId: AspectId,
  sourceAspectIds: readonly AspectId[],
  phase: number,
): MoistureField {
  const values = new Array<NormalizedFieldTicks>(SAMPLE_COUNT);
  const roots = mountainRoots(input.mountainSystems);
  let minimum: number = NORMALIZED_MAX;
  let maximum = 0;
  forEachAtlasSample((longitudeIndex, latitudeIndex, sampleIndex) => {
    const landWater = requiredValue(input.records.landWaterClassification.samples.at(sampleIndex));
    const wind = requiredValue(
      input.atmosphere.prevailingWinds.output.speed.values.at(sampleIndex),
    );
    const temperature = requiredValue(input.atmosphere.temperature.output.values.at(sampleIndex));
    const coastal = coastalInfluence(input.records, longitudeIndex, latitudeIndex);
    const mountain = mountainInfluence(longitudeIndex, latitudeIndex, roots);
    const windFactor = Math.min(1, wind / 1_000);
    const temperatureFactor = Math.max(0, 1 - Math.abs(temperature - 160) / 800);
    const value =
      landWater === 'water'
        ? NORMALIZED_MAX
        : Math.min(
            NORMALIZED_MAX,
            Math.max(
              0,
              roundTiesAwayFromZero(
                NORMALIZED_MAX *
                  (0.08 +
                    coastal * 0.56 +
                    windFactor * 0.22 +
                    temperatureFactor * 0.14 -
                    mountain * (0.16 + phase * 0.08)),
              ),
            ),
          );
    const ticks = requiredValue(createNormalizedFieldTicks(value));
    values[sampleIndex] = ticks;
    minimum = Math.min(minimum, ticks);
    maximum = Math.max(maximum, ticks);
  });
  return Object.freeze({
    ...field(
      'moisture',
      ownerAspectId,
      sourceAspectIds,
      values,
      requiredValue(createNormalizedFieldTicks(minimum)),
      requiredValue(createNormalizedFieldTicks(maximum)),
      'normalized-integer-ticks',
      NORMALIZED_MAX,
    ),
    influenceKinds: Object.freeze(['coastal', 'rain-shadow', 'windward'] as const),
  });
}

function generateClimateZones(
  input: AtlasEcologyGenerationInput,
  ownerAspectId: AspectId,
  sourceAspectIds: readonly AspectId[],
  moisture: MoistureField,
): ClimateZoneField {
  const values = new Array<ClimateZoneKey>(SAMPLE_COUNT);
  forEachAtlasSample((_longitudeIndex, _latitudeIndex, sampleIndex) => {
    values[sampleIndex] = climateZoneFor(
      requiredValue(input.records.landWaterClassification.samples.at(sampleIndex)),
      requiredValue(input.atmosphere.temperature.output.values.at(sampleIndex)),
      requiredValue(moisture.values.at(sampleIndex)),
    );
  });
  return Object.freeze({
    ...field(
      'climate-zones',
      ownerAspectId,
      sourceAspectIds,
      values,
      FIRST_CLIMATE_ZONE.key,
      LAST_CLIMATE_ZONE.key,
      'semantic-key',
      1,
    ),
    classificationPolicyVersion: WORLD_PHYSICAL_CLASSIFICATION_POLICY_VERSION,
    definitions: CLIMATE_ZONES,
  });
}

function generateBiomeBelts(
  input: AtlasEcologyGenerationInput,
  ownerAspectId: AspectId,
  sourceAspectIds: readonly AspectId[],
  zones: ClimateZoneField,
): { readonly ok: true; readonly value: BiomeBeltField } | { readonly ok: false } {
  const values = new Array<BiomeKey>(SAMPLE_COUNT);
  forEachAtlasSample((_longitudeIndex, _latitudeIndex, sampleIndex) => {
    const biome = biomeFor(requiredValue(zones.values.at(sampleIndex)));
    values[sampleIndex] = biome;
  });
  const beltSummaries = [] as {
    readonly entityId: EntityId;
    readonly biomeKey: BiomeKey;
    readonly geometryVersion: typeof WORLD_PHYSICAL_GEOMETRY_VERSION;
    readonly boundaryPoints: readonly PlanetPoint[];
  }[];
  for (const definition of BIOMES) {
    const contours = atlasPlanetContourExtractionAdapter.extract(
      biomeMask(values, definition.key),
      BIOME_MASK_CONTOUR,
    );
    if (contours.diagnostics.length > 0) return Object.freeze({ ok: false });
    for (const ring of contours.rings) {
      const boundaryPoints = Object.freeze([...ring.points]);
      beltSummaries.push(
        Object.freeze({
          entityId: deriveWorldPhysicalBiomeBeltEntityId(
            input.worldMapId,
            definition.key,
            fingerprintWorldPhysicalRootSignature(boundaryPoints),
          ),
          biomeKey: definition.key,
          geometryVersion: WORLD_PHYSICAL_GEOMETRY_VERSION,
          boundaryPoints,
        }),
      );
    }
  }
  const value: BiomeBeltField = Object.freeze({
    ...field(
      'biome-belts',
      ownerAspectId,
      sourceAspectIds,
      values,
      FIRST_BIOME.key,
      LAST_BIOME.key,
      'semantic-key',
      1,
    ),
    classificationPolicyVersion: WORLD_PHYSICAL_CLASSIFICATION_POLICY_VERSION,
    definitions: BIOMES,
    beltSummaries: Object.freeze(
      beltSummaries.sort((left, right) => compareStableReferences(left.entityId, right.entityId)),
    ),
  });
  return Object.freeze({ ok: true, value });
}

function biomeMask(values: readonly BiomeKey[], biomeKey: BiomeKey): QuantizedSphericalField {
  return Object.freeze({
    profile: WORLD_ATLAS_FULL_PROFILE,
    sampleCount: values.length,
    valueAt(longitudeIndex: number, latitudeIndex: number) {
      const value = requiredValue(
        values.at(
          getAtlasSampleStorageIndex(WORLD_ATLAS_FULL_PROFILE, longitudeIndex, latitudeIndex),
        ),
      );
      return value === biomeKey ? BIOME_MASK_HIGH : BIOME_MASK_LOW;
    },
  });
}

function climateZoneFor(
  landWater: 'land' | 'water',
  temperature: number,
  moisture: number,
): ClimateZoneKey {
  if (landWater === 'water') return zone('water');
  if (moisture <= NORMALIZED_MAX / 4) return zone('arid');
  if (temperature <= 0) return zone('polar');
  return temperature >= 221 ? zone('tropical') : zone('temperate');
}

function biomeFor(zoneKey: ClimateZoneKey): BiomeKey {
  if (zoneKey === zone('water')) return biomeKey('water');
  if (zoneKey === zone('arid')) return biomeKey('arid-desert');
  if (zoneKey === zone('polar')) return biomeKey('polar-tundra');
  if (zoneKey === zone('tropical')) return biomeKey('tropical-rainforest');
  return biomeKey('temperate-forest');
}

function field<Kind extends WorldPhysicalFieldKind, Value extends number | string>(
  kind: Kind,
  ownerAspectId: AspectId,
  sourceAspectIds: readonly AspectId[],
  values: readonly Value[],
  minimumValue: Value,
  maximumValue: Value,
  valueEncoding: QuantizedScalarField<Kind, Value>['provenance']['valueEncoding'],
  quantizationScale: QuantizedScalarField<Kind, Value>['provenance']['quantizationScale'],
): QuantizedScalarField<Kind, Value> {
  const reader = createWorldPhysicalFieldReader(Object.freeze([...values]));
  const provenance = Object.freeze({
    contractVersion: WORLD_PHYSICAL_CONTEXT_CONTRACT_VERSION,
    fieldKind: kind,
    ownerAspectId,
    sourceAspectIds: Object.freeze([...sourceAspectIds]),
    fieldBehaviorVersion: WORLD_PHYSICAL_FIELD_BEHAVIOR_VERSION,
    fieldEncodingVersion: WORLD_PHYSICAL_FIELD_ENCODING_VERSION,
    valueEncoding,
    quantizationScale,
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
        minimumValue,
        maximumValue,
        values: reader,
      }),
    }),
    minimumValue,
    maximumValue,
    values: reader,
  });
}

function moistureSourceAspectIds(input: AtlasEcologyGenerationInput): readonly AspectId[] {
  return Object.freeze(
    [
      deriveWorldPhysicalContextAspectId(
        input.worldSurfaceEntityId,
        'worldClimate.prevailingWinds',
      ),
      deriveWorldPhysicalContextAspectId(input.worldSurfaceEntityId, 'worldClimate.temperature'),
      deriveWorldPhysicalContextAspectId(
        input.worldSurfaceEntityId,
        'worldTerrain.mountainSystems',
      ),
      ...input.records.waterBodies.map(({ entityId }) =>
        deriveAtlasAspectId(entityId, 'waterBody.classification'),
      ),
    ].sort(compareStableReferences),
  );
}

function zoneSourceAspectIds(
  input: AtlasEcologyGenerationInput,
  moistureAspectId: AspectId,
): readonly AspectId[] {
  return Object.freeze(
    [
      input.landWaterClassificationAspectId,
      moistureAspectId,
      deriveWorldPhysicalContextAspectId(input.worldSurfaceEntityId, 'worldClimate.temperature'),
    ].sort(compareStableReferences),
  );
}

function biomeSourceAspectIds(
  input: AtlasEcologyGenerationInput,
  zonesAspectId: AspectId,
  moistureAspectId: AspectId,
): readonly AspectId[] {
  return Object.freeze(
    [
      input.macroElevationAspectId,
      moistureAspectId,
      zonesAspectId,
      deriveWorldPhysicalContextAspectId(input.worldSurfaceEntityId, 'worldClimate.temperature'),
      ...input.records.landmasses.map(({ entityId }) =>
        deriveAtlasAspectId(entityId, 'landmass.classification'),
      ),
    ].sort(compareStableReferences),
  );
}

function coastalInfluence(
  records: AtlasSemanticGeographyRecords,
  longitudeIndex: number,
  latitudeIndex: number,
): number {
  if (latitudeIndex === 0 || latitudeIndex === WORLD_ATLAS_FULL_PROFILE.latitudeBandCount) return 1;
  const sample = (longitude: number, latitude: number): 'land' | 'water' =>
    requiredValue(
      records.landWaterClassification.samples.at(
        getAtlasSampleStorageIndex(WORLD_ATLAS_FULL_PROFILE, longitude, latitude),
      ),
    );
  if (sample(longitudeIndex, latitudeIndex) === 'water') return 1;
  const neighbors: readonly (readonly [number, number])[] = [
    [(longitudeIndex + 1) % WORLD_ATLAS_FULL_PROFILE.longitudeCellCount, latitudeIndex],
    [
      (longitudeIndex + WORLD_ATLAS_FULL_PROFILE.longitudeCellCount - 1) %
        WORLD_ATLAS_FULL_PROFILE.longitudeCellCount,
      latitudeIndex,
    ],
    [longitudeIndex, latitudeIndex - 1],
    [longitudeIndex, latitudeIndex + 1],
  ];
  for (const [longitude, latitude] of neighbors)
    if (sample(longitude, latitude) === 'water') return 1;
  return 0;
}

function mountainRoots(
  systems: MountainSystems,
): readonly { readonly longitudeIndex: number; readonly latitudeIndex: number }[] {
  const roots = systems.systems
    .flatMap((system) => system.centerlines.flatMap((line) => line))
    .flatMap((point) => {
      const longitudeIndex = (point.longitudeTicks + 2 ** 31) / 2 ** 21;
      const latitudeIndex = (point.latitudeTicks + 2 ** 30) / 2 ** 21;
      return Number.isSafeInteger(longitudeIndex) && Number.isSafeInteger(latitudeIndex)
        ? [Object.freeze({ longitudeIndex, latitudeIndex })]
        : [];
    });
  return Object.freeze(
    roots.sort(
      (left, right) =>
        left.latitudeIndex - right.latitudeIndex || left.longitudeIndex - right.longitudeIndex,
    ),
  );
}

function mountainInfluence(
  longitudeIndex: number,
  latitudeIndex: number,
  roots: readonly { readonly longitudeIndex: number; readonly latitudeIndex: number }[],
): number {
  return roots.reduce((influence, root) => {
    const longitude = Math.abs(longitudeIndex - root.longitudeIndex);
    const distance = Math.hypot(
      Math.min(longitude, WORLD_ATLAS_FULL_PROFILE.longitudeCellCount - longitude),
      Math.abs(latitudeIndex - root.latitudeIndex),
    );
    return Math.max(influence, Math.max(0, 1 - distance / 96));
  }, 0);
}

function forEachAtlasSample(
  visit: (longitudeIndex: number, latitudeIndex: number, sampleIndex: number) => void,
): void {
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
      visit(
        longitudeIndex,
        latitudeIndex,
        getAtlasSampleStorageIndex(WORLD_ATLAS_FULL_PROFILE, longitudeIndex, latitudeIndex),
      );
    }
  }
}

function proposal<Output>(
  input: AtlasEcologyGenerationInput,
  aspectId: AspectId,
  aspectName: AspectName,
  generatorId: GeneratorId,
  variantRevision: VariantRevision,
  sourceAspectIds: readonly AspectId[],
  parameters: AtlasEcologyParameters,
  seedMetadata: MapEntitySeedInput,
  output: DeepReadonly<Output>,
): GenerationProposal<AtlasEcologyParameters, Output, MapEntitySeedInput> {
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
      sourceAspectIds.map((dependencyAspectId) => Object.freeze({ aspectId: dependencyAspectId })),
    ),
    output,
    diagnostics: Object.freeze([]),
  });
}

function createSeedMetadata(
  input: AtlasEcologyGenerationInput,
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
  if (!parsed.ok || parsed.value.seedScope !== 'map/entity')
    throw new Error(`Ecology seed metadata is invalid for aspect ${aspectId}.`);
  return parsed.value;
}

function sameOrderedAspectIds(left: readonly AspectId[], right: readonly AspectId[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function climateZone(
  key: string,
  minimumTemperature: number,
  maximumTemperature: number,
  minimumMoisture: number,
  maximumMoisture: number,
): ClimateZoneDefinition {
  return Object.freeze({
    key: zone(key),
    minimumTemperature: requiredValue(createTemperatureTicks(minimumTemperature)),
    maximumTemperature: requiredValue(createTemperatureTicks(maximumTemperature)),
    minimumMoisture: requiredValue(createNormalizedFieldTicks(minimumMoisture)),
    maximumMoisture: requiredValue(createNormalizedFieldTicks(maximumMoisture)),
  });
}

function biome(key: string, compatibleZoneKeys: readonly string[]): BiomeDefinition {
  return Object.freeze({
    key: biomeKey(key),
    compatibleClimateZoneKeys: Object.freeze([...compatibleZoneKeys].map(zone).sort()),
  });
}

function zone(value: string): ClimateZoneKey {
  return requiredValue(parseClimateZoneKey(value));
}
function biomeKey(value: string): BiomeKey {
  return requiredValue(parseBiomeKey(value));
}

function diagnostic(
  name: (typeof ATLAS_ECOLOGY_DIAGNOSTIC_CODES)[keyof typeof ATLAS_ECOLOGY_DIAGNOSTIC_CODES],
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

function invalid(diagnostics: readonly GenerationDiagnostic[]): AtlasEcologyGenerationResult {
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
  if (value === undefined) throw new Error('Expected a complete canonical world-atlas field.');
  return value;
}
