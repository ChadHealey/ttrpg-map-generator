import {
  WORLD_PHYSICAL_CLASSIFICATION_POLICY_VERSION,
  WORLD_PHYSICAL_CONTEXT_CONTRACT_VERSION,
  WORLD_PHYSICAL_FEATURE_BEHAVIOR_VERSION,
  WORLD_PHYSICAL_FIELD_BEHAVIOR_VERSION,
  WORLD_PHYSICAL_FIELD_ENCODING_VERSION,
  WORLD_PHYSICAL_GEOMETRY_VERSION,
  WORLD_PHYSICAL_GRAPH_POLICY_VERSION,
  WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE,
} from '@ttrpg-map/core';
import { z } from 'zod';

import { commonAcceptedAspectFields } from './accepted-aspect-common-dto-schema.js';
import { isMapworldFieldDescriptor, type MapworldFieldDescriptor } from './mapworld-field-codec.js';
import { MAPWORLD_V2_ACCEPTED_ASPECT_SCHEMA_VERSION } from './persistence-model.js';
import {
  canonicalIntegerDtoSchema,
  nonnegativeIntegerDtoSchema,
  planetPointDtoSchema,
} from './primitive-dto-schemas.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/u;
const SEMANTIC_KEY_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;
const canonicalIdSchema = z
  .string()
  .regex(UUID_PATTERN)
  .refine((value) => !/^0{8}-0{4}-0{4}-0{4}-0{12}$/u.test(value));
const semanticKeySchema = z.string().min(1).max(128).regex(SEMANTIC_KEY_PATTERN);
const fieldDescriptorSchema = z.custom<MapworldFieldDescriptor>(
  isMapworldFieldDescriptor,
  'Expected an exact mapworld field descriptor.',
);
const fixedTenthSchema = z.strictObject({ denominator: z.literal(10), numerator: z.literal(1) });
const physicalDistanceSchema = z.strictObject({
  distanceMillimeters: nonnegativeIntegerDtoSchema,
});

function provenanceSchema(
  fieldKind:
    | 'temperature'
    | 'prevailing-winds-direction'
    | 'prevailing-winds-speed'
    | 'moisture'
    | 'climate-zones'
    | 'biome-belts'
    | 'watershed-assignment',
  valueEncoding:
    | 'entity-id'
    | 'normalized-integer-ticks'
    | 'semantic-key'
    | 'signed-integer-ticks'
    | 'unsigned-integer-ticks',
  quantizationScale: 1 | 10 | typeof WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE,
) {
  return z.strictObject({
    contractVersion: z.literal(WORLD_PHYSICAL_CONTEXT_CONTRACT_VERSION),
    fieldKind: z.literal(fieldKind),
    ownerAspectId: canonicalIdSchema,
    sourceAspectIds: z.array(canonicalIdSchema).min(1),
    fieldBehaviorVersion: z.literal(WORLD_PHYSICAL_FIELD_BEHAVIOR_VERSION),
    fieldEncodingVersion: z.literal(WORLD_PHYSICAL_FIELD_ENCODING_VERSION),
    valueEncoding: z.literal(valueEncoding),
    quantizationScale: z.literal(quantizationScale),
    samplingProfileId: z.literal('world-atlas-full-v1'),
    samplingPolicyVersion: z.literal(1),
    longitudeCellCount: z.literal(2_048),
    latitudeBandCount: z.literal(1_024),
    canonicalTraversal: z.literal('south-pole-then-rows-then-north-pole'),
    fingerprint: z.string().regex(FINGERPRINT_PATTERN),
  });
}

function scalarFieldSchema(provenance: ReturnType<typeof provenanceSchema>, value: z.ZodType) {
  return z.strictObject({
    provenance,
    minimumValue: value,
    maximumValue: value,
    values: fieldDescriptorSchema,
  });
}

const temperatureOutputSchema = scalarFieldSchema(
  provenanceSchema('temperature', 'signed-integer-ticks', 10),
  canonicalIntegerDtoSchema,
).extend({ quantumCelsius: fixedTenthSchema });

const directionFieldSchema = scalarFieldSchema(
  provenanceSchema(
    'prevailing-winds-direction',
    'normalized-integer-ticks',
    WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE,
  ),
  canonicalIntegerDtoSchema
    .min(-WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE)
    .max(WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE),
);

const speedFieldSchema = scalarFieldSchema(
  provenanceSchema('prevailing-winds-speed', 'unsigned-integer-ticks', 10),
  nonnegativeIntegerDtoSchema,
);

const prevailingWindsOutputSchema = z.strictObject({
  xComponents: directionFieldSchema,
  yComponents: directionFieldSchema,
  zComponents: directionFieldSchema,
  speed: speedFieldSchema,
  speedQuantumMetersPerSecond: fixedTenthSchema,
});

const moistureOutputSchema = scalarFieldSchema(
  provenanceSchema(
    'moisture',
    'normalized-integer-ticks',
    WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE,
  ),
  nonnegativeIntegerDtoSchema.max(WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE),
).extend({
  influenceKinds: z.tuple([z.literal('coastal'), z.literal('rain-shadow'), z.literal('windward')]),
});

const climateZonesOutputSchema = scalarFieldSchema(
  provenanceSchema('climate-zones', 'semantic-key', 1),
  semanticKeySchema,
).extend({
  classificationPolicyVersion: z.literal(WORLD_PHYSICAL_CLASSIFICATION_POLICY_VERSION),
  definitions: z.array(
    z.strictObject({
      key: semanticKeySchema,
      minimumTemperature: canonicalIntegerDtoSchema,
      maximumTemperature: canonicalIntegerDtoSchema,
      minimumMoisture: nonnegativeIntegerDtoSchema.max(
        WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE,
      ),
      maximumMoisture: nonnegativeIntegerDtoSchema.max(
        WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE,
      ),
    }),
  ),
});

const biomeBeltsOutputSchema = scalarFieldSchema(
  provenanceSchema('biome-belts', 'semantic-key', 1),
  semanticKeySchema,
).extend({
  classificationPolicyVersion: z.literal(WORLD_PHYSICAL_CLASSIFICATION_POLICY_VERSION),
  definitions: z.array(
    z.strictObject({
      key: semanticKeySchema,
      compatibleClimateZoneKeys: z.array(semanticKeySchema),
    }),
  ),
  beltSummaries: z.array(
    z.strictObject({
      entityId: canonicalIdSchema,
      biomeKey: semanticKeySchema,
      geometryVersion: z.literal(WORLD_PHYSICAL_GEOMETRY_VERSION),
      boundaryPoints: z.array(planetPointDtoSchema).min(3),
    }),
  ),
});

const mountainSystemsOutputSchema = z.strictObject({
  ownerAspectId: canonicalIdSchema,
  sourceAspectIds: z.array(canonicalIdSchema).min(1),
  systems: z.array(
    z.strictObject({
      entityId: canonicalIdSchema,
      behaviorVersion: z.literal(WORLD_PHYSICAL_FEATURE_BEHAVIOR_VERSION),
      geometryVersion: z.literal(WORLD_PHYSICAL_GEOMETRY_VERSION),
      centerlines: z.array(z.array(planetPointDtoSchema).min(2)).min(1),
      influenceWidth: physicalDistanceSchema,
      prominence: canonicalIntegerDtoSchema,
      boundaryPortalIds: z.array(canonicalIdSchema),
    }),
  ),
});

const watershedsOutputSchema = scalarFieldSchema(
  provenanceSchema('watershed-assignment', 'entity-id', 1),
  canonicalIdSchema,
).extend({
  graphPolicyVersion: z.literal(WORLD_PHYSICAL_GRAPH_POLICY_VERSION),
  watersheds: z.array(
    z.strictObject({
      entityId: canonicalIdSchema,
      behaviorVersion: z.literal(WORLD_PHYSICAL_FEATURE_BEHAVIOR_VERSION),
      geometryVersion: z.literal(WORLD_PHYSICAL_GEOMETRY_VERSION),
      outletEntityId: canonicalIdSchema.optional(),
      divideLines: z.array(z.array(planetPointDtoSchema).min(2)).min(1),
      boundaryPortalIds: z.array(canonicalIdSchema),
    }),
  ),
});

const majorRiversOutputSchema = z.array(
  z.strictObject({
    entityId: canonicalIdSchema,
    behaviorVersion: z.literal(WORLD_PHYSICAL_FEATURE_BEHAVIOR_VERSION),
    geometryVersion: z.literal(WORLD_PHYSICAL_GEOMETRY_VERSION),
    watershedId: canonicalIdSchema,
    centerline: z.array(planetPointDtoSchema).min(2),
    sourceEntityId: canonicalIdSchema,
    outletEntityId: canonicalIdSchema.optional(),
    joinsRiverIds: z.array(canonicalIdSchema),
    dischargeSamples: z.array(nonnegativeIntegerDtoSchema),
    widthSamples: z.array(physicalDistanceSchema),
    boundaryPortalIds: z.array(canonicalIdSchema),
  }),
);

const majorLakesOutputSchema = z.array(
  z.strictObject({
    entityId: canonicalIdSchema,
    behaviorVersion: z.literal(WORLD_PHYSICAL_FEATURE_BEHAVIOR_VERSION),
    geometryVersion: z.literal(WORLD_PHYSICAL_GEOMETRY_VERSION),
    watershedId: canonicalIdSchema,
    ring: z.array(planetPointDtoSchema).min(3),
    outletRiverId: canonicalIdSchema.optional(),
    depth: canonicalIntegerDtoSchema,
    surfaceElevation: canonicalIntegerDtoSchema,
    boundaryPortalIds: z.array(canonicalIdSchema),
  }),
);

const mountainParametersSchema = z.strictObject({
  parameterSchemaVersion: z.literal(1),
  ridgeGeometryVersion: z.literal(WORLD_PHYSICAL_GEOMETRY_VERSION),
  mountainCharacter: z.enum(['low', 'varied', 'rugged']),
});
const atmosphereParametersSchema = z.strictObject({
  parameterSchemaVersion: z.literal(1),
  fieldEncodingVersion: z.literal(WORLD_PHYSICAL_FIELD_ENCODING_VERSION),
  climateCharacter: z.enum(['temperate', 'varied', 'extreme']),
});
const ecologyParametersSchema = z.strictObject({
  parameterSchemaVersion: z.literal(1),
  classificationPolicyVersion: z.literal(WORLD_PHYSICAL_CLASSIFICATION_POLICY_VERSION),
  fieldEncodingVersion: z.literal(WORLD_PHYSICAL_FIELD_ENCODING_VERSION),
});
const hydrologyParametersSchema = z.strictObject({
  parameterSchemaVersion: z.literal(1),
  graphPolicyVersion: z.literal(WORLD_PHYSICAL_GRAPH_POLICY_VERSION),
  geometryVersion: z.literal(WORLD_PHYSICAL_GEOMETRY_VERSION),
});

function aspectSchema<Name extends string>(
  name: Name,
  parameters: z.ZodType,
  acceptedOutput: z.ZodType,
) {
  return z.strictObject({
    ...commonAcceptedAspectFields,
    acceptedAspectSchemaVersion: z.literal(MAPWORLD_V2_ACCEPTED_ASPECT_SCHEMA_VERSION),
    aspectName: z.literal(name),
    generatorId: z.literal(name),
    generatorVersion: z.literal(1),
    parameterSchemaVersion: z.literal(1),
    parameters,
    seedScope: z.literal('map/entity'),
    acceptedOutput,
  });
}

export const mapworldV2AcceptedAspectDtoSchema = z.discriminatedUnion('aspectName', [
  aspectSchema(
    'worldTerrain.mountainSystems',
    mountainParametersSchema,
    mountainSystemsOutputSchema,
  ),
  aspectSchema('worldClimate.temperature', atmosphereParametersSchema, temperatureOutputSchema),
  aspectSchema(
    'worldClimate.prevailingWinds',
    atmosphereParametersSchema,
    prevailingWindsOutputSchema,
  ),
  aspectSchema('worldClimate.moisture', ecologyParametersSchema, moistureOutputSchema),
  aspectSchema('worldClimate.zones', ecologyParametersSchema, climateZonesOutputSchema),
  aspectSchema('worldEcology.biomeBelts', ecologyParametersSchema, biomeBeltsOutputSchema),
  aspectSchema('worldHydrology.watersheds', hydrologyParametersSchema, watershedsOutputSchema),
  aspectSchema('worldHydrology.majorRivers', hydrologyParametersSchema, majorRiversOutputSchema),
  aspectSchema('worldHydrology.majorLakes', hydrologyParametersSchema, majorLakesOutputSchema),
]);

export type MapworldV2AcceptedAspectDto = z.infer<typeof mapworldV2AcceptedAspectDtoSchema>;
