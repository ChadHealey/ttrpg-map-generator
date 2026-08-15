import { z } from 'zod';

import { isCanonicalJsonValue } from './canonical-json.js';
import { type CanonicalJsonValue } from './persistence-model.js';

export const canonicalIntegerDtoSchema = z
  .number()
  .int()
  .refine(Number.isSafeInteger)
  .refine((value) => !Object.is(value, -0));

export const nonnegativeIntegerDtoSchema = canonicalIntegerDtoSchema.min(0);
export const positiveIntegerDtoSchema = canonicalIntegerDtoSchema.min(1);
export const canonicalWorldSeedDtoSchema = z.string().regex(/^(?:0|[1-9][0-9]*)$/u);
export const stableIdDtoSchema = z.string();
export const symbolicTextDtoSchema = z.string().min(1).max(128);
export const displayNameDtoSchema = z.string().min(1).max(256);

/** Validate arbitrary JSON data without letting Zod reconstruct or discard valid object keys. */
export const canonicalJsonValueDtoSchema: z.ZodType<CanonicalJsonValue> =
  z.custom<CanonicalJsonValue>(
    isCanonicalJsonValue,
    'Value must be canonical JSON data with dense arrays and plain data-property objects.',
  );

export const planetPointDtoSchema = z.strictObject({
  longitudeTicks: canonicalIntegerDtoSchema,
  latitudeTicks: canonicalIntegerDtoSchema,
});

export const regionalExtentDtoSchema = z.strictObject({
  minXMillimeters: canonicalIntegerDtoSchema,
  maxXMillimeters: canonicalIntegerDtoSchema,
  minYMillimeters: canonicalIntegerDtoSchema,
  maxYMillimeters: canonicalIntegerDtoSchema,
});

export const worldRadiusDtoSchema = z.strictObject({
  radiusMillimeters: positiveIntegerDtoSchema,
});

const commonSeedFields = {
  seedDerivationVersion: positiveIntegerDtoSchema,
  deterministicStreamVersion: positiveIntegerDtoSchema,
  worldSeed: canonicalWorldSeedDtoSchema,
  generatorId: symbolicTextDtoSchema,
  generatorVersion: positiveIntegerDtoSchema,
  aspectName: symbolicTextDtoSchema,
  variantRevision: nonnegativeIntegerDtoSchema,
} as const;

export const seedInputDtoSchema = z.discriminatedUnion('seedScope', [
  z.strictObject({
    ...commonSeedFields,
    seedScope: z.literal('map/entity'),
    mapId: stableIdDtoSchema,
    entityId: stableIdDtoSchema,
  }),
  z.strictObject({
    ...commonSeedFields,
    seedScope: z.literal('root-coordinate'),
    rootSurfaceId: stableIdDtoSchema,
    point: planetPointDtoSchema,
  }),
  z.strictObject({
    ...commonSeedFields,
    seedScope: z.literal('shared-boundary'),
    boundaryPortalId: stableIdDtoSchema,
  }),
]);

export const aspectReferenceDtoSchema = z.strictObject({
  aspectId: stableIdDtoSchema,
});

export const contextProvenanceDtoSchema = z.strictObject({
  kind: z.literal('inherited-context'),
  parentMapId: stableIdDtoSchema,
  childMapId: stableIdDtoSchema,
});

export const aspectDependencyReferenceDtoSchema = z.strictObject({
  aspectId: stableIdDtoSchema,
  contextProvenance: contextProvenanceDtoSchema.optional(),
});

export const diagnosticDtoSchema = z.strictObject({
  code: symbolicTextDtoSchema,
  severity: z.enum(['error', 'warning']),
  target: aspectReferenceDtoSchema,
  message: z.string().min(1).max(2_048),
  suggestedAction: z.string().min(1).max(2_048),
});
