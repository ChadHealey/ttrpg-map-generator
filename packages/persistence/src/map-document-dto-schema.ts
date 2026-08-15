import { z } from 'zod';

import { acceptedAspectDtoSchema } from './accepted-aspect-dto-schema.js';
import { MAP_DOCUMENT_SCHEMA_VERSION } from './persistence-model.js';
import {
  aspectReferenceDtoSchema,
  displayNameDtoSchema,
  planetPointDtoSchema,
  regionalExtentDtoSchema,
  stableIdDtoSchema,
  worldRadiusDtoSchema,
} from './primitive-dto-schemas.js';

export const constraintDtoSchema = z.strictObject({
  constraintId: stableIdDtoSchema,
  constraintKind: z.literal('proof.keep-within-extent'),
  target: aspectReferenceDtoSchema,
  parameters: z.strictObject({}),
});

export const lockDtoSchema = z.strictObject({
  lockId: stableIdDtoSchema,
  target: aspectReferenceDtoSchema,
});

export const decorationDtoSchema = z.strictObject({
  aspectReferences: z.array(aspectReferenceDtoSchema),
});

export const layoutDtoSchema = z.strictObject({
  aspectReferences: z.array(aspectReferenceDtoSchema),
});

const mapEntityDtoSchema = z.strictObject({
  entityId: stableIdDtoSchema,
  displayName: displayNameDtoSchema,
});

const commonMapFields = {
  mapDocumentSchemaVersion: z.literal(MAP_DOCUMENT_SCHEMA_VERSION),
  mapId: stableIdDtoSchema,
  displayName: displayNameDtoSchema,
  entities: z.array(mapEntityDtoSchema),
  aspects: z.array(acceptedAspectDtoSchema),
  constraints: z.array(constraintDtoSchema),
  locks: z.array(lockDtoSchema),
  decoration: decorationDtoSchema,
  layout: layoutDtoSchema,
} as const;

const worldMapDtoSchema = z.strictObject({
  ...commonMapFields,
  mapKind: z.literal('world'),
  scaleClass: z.literal('world'),
  coordinateSystem: z.strictObject({
    kind: z.literal('planet-sphere'),
    rootSurfaceId: stableIdDtoSchema,
    radius: worldRadiusDtoSchema,
  }),
  extent: z.strictObject({ kind: z.literal('whole-surface') }),
});

const regionalMapDtoSchema = z.strictObject({
  ...commonMapFields,
  mapKind: z.literal('regional'),
  scaleClass: z.literal('regional'),
  parent: z.strictObject({
    parentMapId: stableIdDtoSchema,
    rootMapId: stableIdDtoSchema,
    relationshipKind: z.literal('world-to-regional'),
    contextStatusAspectId: stableIdDtoSchema,
  }),
  coordinateSystem: z.strictObject({
    kind: z.literal('regional-azimuthal-equidistant'),
    rootSurfaceId: stableIdDtoSchema,
    transformId: z.literal('planet-regional-azimuthal-equidistant'),
    transformVersion: z.literal(1),
    origin: planetPointDtoSchema,
    radius: worldRadiusDtoSchema,
  }),
  extent: regionalExtentDtoSchema,
});

export const mapDocumentDtoSchema = z.discriminatedUnion('mapKind', [
  worldMapDtoSchema,
  regionalMapDtoSchema,
]);

export type MapDocumentDto = z.infer<typeof mapDocumentDtoSchema>;
