import {
  ATLAS_CANONICAL_FIELD_TRAVERSAL,
  ATLAS_COASTLINE_REPAIR_POLICY,
  ATLAS_COASTLINE_SIMPLIFICATION_TOLERANCE_TICKS,
  ATLAS_COASTLINE_WINDING,
  ATLAS_CONTINENT_DISTRIBUTIONS,
  ATLAS_FIELD_QUANTIZATION_SCALE,
  ATLAS_FULL_LATITUDE_BAND_COUNT,
  ATLAS_FULL_LONGITUDE_CELL_COUNT,
  ATLAS_FULL_PROFILE_ID,
  ATLAS_FULL_SAMPLE_COUNT,
  ATLAS_ISLAND_GROUP_KINDS,
  ATLAS_LANDMASS_KINDS,
  ATLAS_OCEAN_CONNECTIVITY,
  ATLAS_POLAR_CHARACTERS,
  ATLAS_WATER_BODY_KINDS,
} from '@ttrpg-map/core';
import { z } from 'zod';

import { commonAcceptedAspectFields } from './accepted-aspect-common-dto-schema.js';
import {
  canonicalIntegerDtoSchema,
  canonicalWorldSeedDtoSchema,
  nonnegativeIntegerDtoSchema,
  planetPointDtoSchema,
  positiveIntegerDtoSchema,
  stableIdDtoSchema,
  symbolicTextDtoSchema,
} from './primitive-dto-schemas.js';

export const ATLAS_ACCEPTED_ASPECT_NAMES: ReadonlySet<string> = new Set([
  'worldTerrain.macroElevation',
  'worldSurface.landWaterClassification',
  'landmass.classification',
  'islandGroup.classification',
  'waterBody.classification',
  'worldCoastline.geometry',
  'atlas.coastlineAppearance',
  'atlas.waterDecoration',
  'atlas.paperTreatment',
]);

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const fingerprintDtoSchema = z.string().regex(SHA256_PATTERN);
const permilleDtoSchema = canonicalIntegerDtoSchema.min(0).max(1_000);
function macroParametersDtoSchema(fieldBehaviorVersion: 1 | 2) {
  return z.strictObject({
    parameterSchemaVersion: z.literal(1),
    samplingProfileId: z.literal(ATLAS_FULL_PROFILE_ID),
    samplingPolicyVersion: z.literal(1),
    fieldBehaviorVersion: z.literal(fieldBehaviorVersion),
    worldCircumferenceKm: canonicalIntegerDtoSchema.min(10_000).max(80_000),
    continentCountIntent: canonicalIntegerDtoSchema.min(1).max(8),
    continentDistribution: z.enum(ATLAS_CONTINENT_DISTRIBUTIONS),
    fragmentationPercent: canonicalIntegerDtoSchema.min(0).max(100),
    islandAbundancePercent: canonicalIntegerDtoSchema.min(0).max(100),
    archipelagoAbundancePercent: canonicalIntegerDtoSchema.min(0).max(100),
    polarCharacter: z.enum(ATLAS_POLAR_CHARACTERS),
  });
}

function macroOutputDtoSchema(fieldBehaviorVersion: 1 | 2) {
  return z.strictObject({
    provenance: z.strictObject({
      contractVersion: z.literal(1),
      samplingProfileId: z.literal(ATLAS_FULL_PROFILE_ID),
      samplingPolicyVersion: z.literal(1),
      longitudeCellCount: z.literal(ATLAS_FULL_LONGITUDE_CELL_COUNT),
      latitudeBandCount: z.literal(ATLAS_FULL_LATITUDE_BAND_COUNT),
      canonicalTraversal: z.literal(ATLAS_CANONICAL_FIELD_TRAVERSAL),
      fieldBehaviorVersion: z.literal(fieldBehaviorVersion),
      quantizationScale: z.literal(ATLAS_FIELD_QUANTIZATION_SCALE),
    }),
    values: z
      .array(
        canonicalIntegerDtoSchema
          .min(-ATLAS_FIELD_QUANTIZATION_SCALE)
          .max(ATLAS_FIELD_QUANTIZATION_SCALE),
      )
      .length(ATLAS_FULL_SAMPLE_COUNT),
  });
}

const partitionParametersDtoSchema = z.strictObject({
  parameterSchemaVersion: z.literal(1),
  classificationBehaviorVersion: z.literal(1),
  sharedThresholdProfileId: z.literal('world-atlas-preview-v1'),
  acceptedProfileId: z.literal(ATLAS_FULL_PROFILE_ID),
  realizationVersion: z.literal(1),
  maximumWaterCoverageErrorBasisPoints: z.literal(25),
  targetWaterCoveragePercent: canonicalIntegerDtoSchema.min(45).max(80),
  oceanConnectivity: z.enum(ATLAS_OCEAN_CONNECTIVITY),
});

const partitionOutputDtoSchema = z.strictObject({
  classificationBehaviorVersion: z.literal(1),
  seaLevelContourDoubledTicks: canonicalIntegerDtoSchema,
  samples: z.array(z.enum(['land', 'water'])).length(ATLAS_FULL_SAMPLE_COUNT),
});

const semanticParametersDtoSchema = z.strictObject({
  parameterSchemaVersion: z.literal(1),
  policyVersion: z.literal(1),
  continentMinimumLandAreaBasisPoints: z.literal(2_000),
  majorIslandMinimumLandAreaBasisPoints: z.literal(200),
  minimumRetainedIslandSampleCount: z.literal(1),
  openMarineClearanceCells: z.literal(16),
  minimumRetainedSeaSampleCount: z.literal(1),
  connectedMajorityMinimumPercent: z.literal(90),
  archipelagoMaximumCentroidSeparationMilliRad: z.literal(750),
  islandChainMaximumNeighborSeparationMilliRad: z.literal(1_800),
  identityDerivationVersion: z.literal(1),
});

const membershipDtoSchema = z.strictObject({
  classificationVersion: z.literal(1),
  fingerprint: fingerprintDtoSchema,
  sampleCount: positiveIntegerDtoSchema,
  sphericalAreaWeight: nonnegativeIntegerDtoSchema,
  sampleRanges: z.array(
    z.strictObject({
      startIndex: nonnegativeIntegerDtoSchema,
      endIndexExclusive: positiveIntegerDtoSchema,
    }),
  ),
});

const landmassOutputDtoSchema = z.strictObject({
  entityId: stableIdDtoSchema,
  sourceClassificationAspectId: stableIdDtoSchema,
  componentId: stableIdDtoSchema,
  membership: membershipDtoSchema,
  kind: z.enum(ATLAS_LANDMASS_KINDS),
  containingWaterBodyId: stableIdDtoSchema.optional(),
  adjacentWaterBodyIds: z.array(stableIdDtoSchema),
});

const islandGroupOutputDtoSchema = z.strictObject({
  entityId: stableIdDtoSchema,
  kind: z.enum(ATLAS_ISLAND_GROUP_KINDS),
  memberLandmassIds: z.array(stableIdDtoSchema).min(2),
});

const waterBodyOutputDtoSchema = z.strictObject({
  entityId: stableIdDtoSchema,
  sourceClassificationAspectId: stableIdDtoSchema,
  componentId: stableIdDtoSchema,
  membership: membershipDtoSchema,
  kind: z.enum(ATLAS_WATER_BODY_KINDS),
  enclosure: z.enum(['enclosed', 'open-marine']),
  enclosedByLandmassIds: z.array(stableIdDtoSchema),
  adjacentLandmassIds: z.array(stableIdDtoSchema),
  connectivity: z.array(
    z.strictObject({
      connectedWaterBodyId: stableIdDtoSchema,
      kind: z.literal('open-marine-neck'),
    }),
  ),
});

const coastlineParametersDtoSchema = z.strictObject({
  parameterSchemaVersion: z.literal(1),
  extractionAlgorithmVersion: z.literal(1),
  simplificationPolicyVersion: z.literal(1),
  simplificationToleranceTicks: z.literal(ATLAS_COASTLINE_SIMPLIFICATION_TOLERANCE_TICKS),
  topologyValidationVersion: z.literal(1),
  winding: z.literal(ATLAS_COASTLINE_WINDING),
  repairPolicy: z.literal(ATLAS_COASTLINE_REPAIR_POLICY),
});

const coastlineOutputDtoSchema = z.strictObject({
  geometryBehaviorVersion: z.literal(1),
  extractionAlgorithmVersion: z.literal(1),
  simplificationPolicyVersion: z.literal(1),
  simplificationToleranceTicks: z.literal(ATLAS_COASTLINE_SIMPLIFICATION_TOLERANCE_TICKS),
  topologyValidationVersion: z.literal(1),
  winding: z.literal(ATLAS_COASTLINE_WINDING),
  repairPolicy: z.literal(ATLAS_COASTLINE_REPAIR_POLICY),
  rings: z.array(
    z.strictObject({
      ringId: stableIdDtoSchema,
      sourceBoundaryFingerprint: fingerprintDtoSchema,
      landmassId: stableIdDtoSchema,
      waterBodyIds: z.array(stableIdDtoSchema),
      points: z.array(planetPointDtoSchema).min(3),
    }),
  ),
});

const appearanceParametersDtoSchema = z.strictObject({
  parameterSchemaVersion: z.literal(1),
  styleId: symbolicTextDtoSchema,
  styleBehaviorVersion: z.literal(1),
});

const styleProvenanceDtoSchema = z.strictObject({
  styleId: symbolicTextDtoSchema,
  styleBehaviorVersion: z.literal(1),
});

const coastlineAppearanceOutputDtoSchema = z.strictObject({
  appearanceBehaviorVersion: z.literal(1),
  style: styleProvenanceDtoSchema,
  ringDecisions: z.array(
    z.strictObject({
      sourceRingId: stableIdDtoSchema,
      sourceBoundaryFingerprint: fingerprintDtoSchema,
      wobblePhasePermille: permilleDtoSchema,
      wobbleStrengthPermille: permilleDtoSchema,
      secondaryPhasePermille: permilleDtoSchema,
      pressurePhasePermille: permilleDtoSchema,
      pressureStrengthPermille: permilleDtoSchema,
    }),
  ),
});

const waterDecorationOutputDtoSchema = z.strictObject({
  decorationBehaviorVersion: z.literal(1),
  style: styleProvenanceDtoSchema,
  paths: z.array(
    z.strictObject({
      decorationId: z.string().min(1).max(512),
      kind: z.enum(['coastal-echo', 'water-mark']),
      sourceEntityId: stableIdDtoSchema,
      sourceRingId: stableIdDtoSchema.optional(),
      sourceBoundaryFingerprint: fingerprintDtoSchema.optional(),
      relatedSourceIds: z.array(stableIdDtoSchema),
      weightPermille: canonicalIntegerDtoSchema.min(1).max(1_000),
      points: z.array(planetPointDtoSchema).min(2),
    }),
  ),
});

const paperTreatmentOutputDtoSchema = z.strictObject({
  treatmentBehaviorVersion: z.literal(1),
  style: styleProvenanceDtoSchema,
  grainPhaseXPermille: permilleDtoSchema,
  grainPhaseYPermille: permilleDtoSchema,
  grainAnglePermille: permilleDtoSchema,
  grainDensityPermille: permilleDtoSchema,
  grainLengthPermille: permilleDtoSchema,
});

function atlasAspectSchema<
  Name extends string,
  Version extends 1 | 2,
  Parameters extends z.ZodType,
  Output extends z.ZodType,
>(aspectName: Name, generatorVersion: Version, parameters: Parameters, acceptedOutput: Output) {
  return z.strictObject({
    ...commonAcceptedAspectFields,
    aspectName: z.literal(aspectName),
    generatorId: z.literal(aspectName),
    generatorVersion: z.literal(generatorVersion),
    parameterSchemaVersion: z.literal(1),
    seedScope: z.literal('map/entity'),
    seedMetadata: z.strictObject({
      seedDerivationVersion: z.literal(1),
      deterministicStreamVersion: z.literal(1),
      worldSeed: canonicalWorldSeedDtoSchema,
      generatorId: z.literal(aspectName),
      generatorVersion: z.literal(generatorVersion),
      aspectName: z.literal(aspectName),
      variantRevision: nonnegativeIntegerDtoSchema,
      seedScope: z.literal('map/entity'),
      mapId: stableIdDtoSchema,
      entityId: stableIdDtoSchema,
    }),
    parameters,
    acceptedOutput,
  });
}

export const atlasAcceptedAspectDtoSchemas = [
  atlasAspectSchema(
    'worldTerrain.macroElevation',
    1,
    macroParametersDtoSchema(1),
    macroOutputDtoSchema(1),
  ),
  atlasAspectSchema(
    'worldTerrain.macroElevation',
    2,
    macroParametersDtoSchema(2),
    macroOutputDtoSchema(2),
  ),
  atlasAspectSchema(
    'worldSurface.landWaterClassification',
    1,
    partitionParametersDtoSchema,
    partitionOutputDtoSchema,
  ),
  atlasAspectSchema(
    'landmass.classification',
    1,
    semanticParametersDtoSchema,
    landmassOutputDtoSchema,
  ),
  atlasAspectSchema(
    'islandGroup.classification',
    1,
    semanticParametersDtoSchema,
    islandGroupOutputDtoSchema,
  ),
  atlasAspectSchema(
    'waterBody.classification',
    1,
    semanticParametersDtoSchema,
    waterBodyOutputDtoSchema,
  ),
  atlasAspectSchema(
    'worldCoastline.geometry',
    1,
    coastlineParametersDtoSchema,
    coastlineOutputDtoSchema,
  ),
  atlasAspectSchema(
    'atlas.coastlineAppearance',
    1,
    appearanceParametersDtoSchema,
    coastlineAppearanceOutputDtoSchema,
  ),
  atlasAspectSchema(
    'atlas.waterDecoration',
    1,
    appearanceParametersDtoSchema,
    waterDecorationOutputDtoSchema,
  ),
  atlasAspectSchema(
    'atlas.paperTreatment',
    1,
    appearanceParametersDtoSchema,
    paperTreatmentOutputDtoSchema,
  ),
] as const;
