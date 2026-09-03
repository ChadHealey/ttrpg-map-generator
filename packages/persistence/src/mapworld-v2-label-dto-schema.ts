import {
  ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_ASSET_ID,
  ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_ASSET_SCHEMA_VERSION,
  ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_BEHAVIOR_VERSION,
  ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_PACK_SHA256,
  ATLAS_LABEL_MAX_CODE_POINTS,
  ATLAS_LABEL_PLACEMENT_ASPECT_NAME,
  ATLAS_LABEL_PLACEMENT_BEHAVIOR_VERSION,
  ATLAS_LABEL_PLACEMENT_GENERATOR_ID,
  ATLAS_LABEL_PLACEMENT_PARAMETER_SCHEMA_VERSION,
  WORLD_FEATURE_NAME_ASPECT_NAME,
  WORLD_FEATURE_NAME_BEHAVIOR_VERSION,
  WORLD_FEATURE_NAME_GENERATOR_ID,
  WORLD_FEATURE_NAME_PARAMETER_SCHEMA_VERSION,
} from '@ttrpg-map/core';
import { z } from 'zod';

import { commonAcceptedAspectFields } from './accepted-aspect-common-dto-schema.js';
import { MAPWORLD_V2_ACCEPTED_ASPECT_SCHEMA_VERSION } from './persistence-model.js';
import {
  canonicalIntegerDtoSchema,
  canonicalWorldSeedDtoSchema,
  nonnegativeIntegerDtoSchema,
  positiveIntegerDtoSchema,
  stableIdDtoSchema,
} from './primitive-dto-schemas.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const ASCII_NAME_PATTERN =
  /^[A-Z][a-z]*(?: [A-Z][a-z]*)*(?: (?:I|II|III|IV|V|VI|VII|VIII|IX|X|L|C|D|M)+)?$/u;
const VARIANT_KEY_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;

const canonicalIdSchema = stableIdDtoSchema
  .regex(UUID_PATTERN)
  .refine((value) => !/^0{8}-0{4}-0{4}-0{4}-0{12}$/u.test(value));
const asciiNameSchema = z.string().min(1).regex(ASCII_NAME_PATTERN);
const placementTextSchema = asciiNameSchema.refine(
  (value) => Array.from(value).length <= ATLAS_LABEL_MAX_CODE_POINTS,
  `Accepted placement text must contain at most ${String(ATLAS_LABEL_MAX_CODE_POINTS)} code points.`,
);
const tickPointSchema = z.strictObject({
  xTicks: canonicalIntegerDtoSchema,
  yTicks: canonicalIntegerDtoSchema,
});

function mapEntitySeedSchema(aspectName: string, generatorId: string) {
  return z.strictObject({
    seedDerivationVersion: z.literal(1),
    deterministicStreamVersion: z.literal(1),
    worldSeed: canonicalWorldSeedDtoSchema,
    generatorId: z.literal(generatorId),
    generatorVersion: z.literal(1),
    aspectName: z.literal(aspectName),
    variantRevision: nonnegativeIntegerDtoSchema,
    seedScope: z.literal('map/entity'),
    mapId: canonicalIdSchema,
    entityId: canonicalIdSchema,
  });
}

const nameParametersSchema = z.strictObject({
  parameterSchemaVersion: z.literal(WORLD_FEATURE_NAME_PARAMETER_SCHEMA_VERSION),
  lexiconVersion: z.literal(WORLD_FEATURE_NAME_BEHAVIOR_VERSION),
  nameContentBehaviorVersion: z.literal(WORLD_FEATURE_NAME_BEHAVIOR_VERSION),
});

const nameOutputSchema = z
  .strictObject({
    entityId: canonicalIdSchema,
    nameKind: z.enum([
      'landmass',
      'island-group',
      'water-body',
      'mountain-system',
      'watershed',
      'river',
      'lake',
    ]),
    nameContentBehaviorVersion: z.literal(WORLD_FEATURE_NAME_BEHAVIOR_VERSION),
    lexiconVersion: z.literal(WORLD_FEATURE_NAME_BEHAVIOR_VERSION),
    variantRevision: nonnegativeIntegerDtoSchema,
    origin: z.enum(['generated', 'manual-override']),
    displayName: asciiNameSchema,
    comparisonKey: z.string().min(1),
  })
  .superRefine((output, context) => {
    const expected = output.displayName.replace(/[A-Z]/gu, (value) => value.toLowerCase());
    if (output.comparisonKey !== expected) {
      context.addIssue({
        code: 'custom',
        path: ['comparisonKey'],
        message: 'Name comparisonKey must contain the exact accepted ASCII comparison bytes.',
      });
    }
  });

const worldFeatureNameAspectSchema = z
  .strictObject({
    ...commonAcceptedAspectFields,
    acceptedAspectSchemaVersion: z.literal(MAPWORLD_V2_ACCEPTED_ASPECT_SCHEMA_VERSION),
    aspectName: z.literal(WORLD_FEATURE_NAME_ASPECT_NAME),
    generatorId: z.literal(WORLD_FEATURE_NAME_GENERATOR_ID),
    generatorVersion: z.literal(WORLD_FEATURE_NAME_BEHAVIOR_VERSION),
    parameterSchemaVersion: z.literal(WORLD_FEATURE_NAME_PARAMETER_SCHEMA_VERSION),
    parameters: nameParametersSchema,
    seedScope: z.literal('map/entity'),
    seedMetadata: mapEntitySeedSchema(
      WORLD_FEATURE_NAME_ASPECT_NAME,
      WORLD_FEATURE_NAME_GENERATOR_ID,
    ),
    dependencyAspects: z.array(commonAcceptedAspectFields.dependencyAspects.element).length(0),
    acceptedOutput: nameOutputSchema,
  })
  .superRefine((record, context) => {
    if (
      record.acceptedOutput.entityId !== record.entityId ||
      record.acceptedOutput.variantRevision !== record.variantRevision
    ) {
      context.addIssue({
        code: 'custom',
        path: ['acceptedOutput'],
        message: 'Accepted name output must exactly match its owner and envelope revision.',
      });
    }
  });

const glyphOriginSchema = tickPointSchema
  .extend({
    glyphKey: z.string().regex(/^[A-Za-z]$/u),
    codePoint: canonicalIntegerDtoSchema.refine(
      (value) => (value >= 65 && value <= 90) || (value >= 97 && value <= 122),
    ),
  })
  .superRefine((origin, context) => {
    if (origin.glyphKey.codePointAt(0) !== origin.codePoint) {
      context.addIssue({
        code: 'custom',
        path: ['codePoint'],
        message: 'Glyph codePoint must exactly match glyphKey.',
      });
    }
  });

const placementParametersSchema = z.strictObject({
  parameterSchemaVersion: z.literal(ATLAS_LABEL_PLACEMENT_PARAMETER_SCHEMA_VERSION),
  placementBehaviorVersion: z.literal(ATLAS_LABEL_PLACEMENT_BEHAVIOR_VERSION),
  glyphPackSha256: z.literal(ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_PACK_SHA256),
});

const placementOutputSchema = z
  .strictObject({
    placementId: canonicalIdSchema,
    sourceEntityId: canonicalIdSchema,
    sourceNameAspectId: canonicalIdSchema,
    sourceNameVariantRevision: nonnegativeIntegerDtoSchema,
    displayText: placementTextSchema,
    glyphAssetId: z.literal(ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_ASSET_ID),
    glyphAssetSchemaVersion: z.literal(ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_ASSET_SCHEMA_VERSION),
    glyphBehaviorVersion: z.literal(ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_BEHAVIOR_VERSION),
    glyphPackSha256: z.literal(ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_PACK_SHA256),
    placementBehaviorVersion: z.literal(ATLAS_LABEL_PLACEMENT_BEHAVIOR_VERSION),
    variantRevision: nonnegativeIntegerDtoSchema,
    priority: canonicalIntegerDtoSchema,
    fontSizeTicks: positiveIntegerDtoSchema,
    baseline: tickPointSchema,
    bounds: z.strictObject({
      minXTicks: canonicalIntegerDtoSchema,
      minYTicks: canonicalIntegerDtoSchema,
      maxXTicks: canonicalIntegerDtoSchema,
      maxYTicks: canonicalIntegerDtoSchema,
    }),
    glyphOrigins: z.array(glyphOriginSchema).max(ATLAS_LABEL_MAX_CODE_POINTS),
    selectedVariantKey: z.string().regex(VARIANT_KEY_PATTERN),
  })
  .superRefine((output, context) => {
    if (
      output.bounds.minXTicks > output.bounds.maxXTicks ||
      output.bounds.minYTicks > output.bounds.maxYTicks
    ) {
      context.addIssue({
        code: 'custom',
        path: ['bounds'],
        message: 'Accepted placement bounds must be ordered.',
      });
    }
    const characters = Array.from(output.displayText).filter((character) => character !== ' ');
    if (
      output.glyphOrigins.length !== characters.length ||
      output.glyphOrigins.some((origin, index) => origin.glyphKey !== characters[index])
    ) {
      context.addIssue({
        code: 'custom',
        path: ['glyphOrigins'],
        message: 'Glyph origins must retain exact display-text order.',
      });
    }
  });

const atlasLabelPlacementAspectSchema = z
  .strictObject({
    ...commonAcceptedAspectFields,
    acceptedAspectSchemaVersion: z.literal(MAPWORLD_V2_ACCEPTED_ASPECT_SCHEMA_VERSION),
    aspectName: z.literal(ATLAS_LABEL_PLACEMENT_ASPECT_NAME),
    generatorId: z.literal(ATLAS_LABEL_PLACEMENT_GENERATOR_ID),
    generatorVersion: z.literal(ATLAS_LABEL_PLACEMENT_BEHAVIOR_VERSION),
    parameterSchemaVersion: z.literal(ATLAS_LABEL_PLACEMENT_PARAMETER_SCHEMA_VERSION),
    parameters: placementParametersSchema,
    seedScope: z.literal('map/entity'),
    seedMetadata: mapEntitySeedSchema(
      ATLAS_LABEL_PLACEMENT_ASPECT_NAME,
      ATLAS_LABEL_PLACEMENT_GENERATOR_ID,
    ),
    dependencyAspects: z.array(commonAcceptedAspectFields.dependencyAspects.element).length(1),
    acceptedOutput: placementOutputSchema,
  })
  .superRefine((record, context) => {
    const output = record.acceptedOutput;
    if (
      output.placementId !== record.aspectId ||
      output.sourceEntityId !== record.entityId ||
      output.variantRevision !== record.variantRevision ||
      record.dependencyAspects[0]?.aspectId !== output.sourceNameAspectId
    ) {
      context.addIssue({
        code: 'custom',
        path: ['acceptedOutput'],
        message: 'Accepted placement output must exactly match its owner, revision, and name link.',
      });
    }
  });

export const mapworldV2LabelAcceptedAspectDtoSchemas = [
  worldFeatureNameAspectSchema,
  atlasLabelPlacementAspectSchema,
] as const;
