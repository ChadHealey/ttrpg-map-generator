import { z } from 'zod';

import { ACCEPTED_ASPECT_SCHEMA_VERSION } from './persistence-model.js';
import {
  aspectDependencyReferenceDtoSchema,
  canonicalJsonValueDtoSchema,
  diagnosticDtoSchema,
  nonnegativeIntegerDtoSchema,
  planetPointDtoSchema,
  positiveIntegerDtoSchema,
  seedInputDtoSchema,
  stableIdDtoSchema,
  symbolicTextDtoSchema,
} from './primitive-dto-schemas.js';

export const PROOF_OUTLINE_ASPECT_ID_TEXT = '54b92092-3d5f-4bca-a12c-353185de1557';
export const PROOF_MARKER_ASPECT_ID_TEXT = '42928679-db9b-4de2-a8d4-0baecd709cc9';

const commonAcceptedAspectFields = {
  acceptedAspectSchemaVersion: z.literal(ACCEPTED_ASPECT_SCHEMA_VERSION),
  mapId: stableIdDtoSchema,
  entityId: stableIdDtoSchema,
  aspectId: stableIdDtoSchema,
  generatorVersion: positiveIntegerDtoSchema,
  parameterSchemaVersion: positiveIntegerDtoSchema,
  seedScope: z.enum(['map/entity', 'root-coordinate', 'shared-boundary']),
  seedMetadata: seedInputDtoSchema,
  variantRevision: nonnegativeIntegerDtoSchema,
  dependencyAspects: z.array(aspectDependencyReferenceDtoSchema),
  generationStatus: z.literal('accepted'),
  diagnostics: z.array(diagnosticDtoSchema),
} as const;

const proofOutlineParametersDtoSchema = z.strictObject({
  pointCount: z.literal(8),
  insetPermille: z.literal(120),
  radialJitterPermille: z.literal(180),
});

const proofMarkerParametersDtoSchema = z.strictObject({
  markerCount: z.literal(9),
  edgeClearancePermille: z.literal(40),
});

const proofOutlineOutputDtoSchema = z.strictObject({
  points: z.array(planetPointDtoSchema).length(9),
});

const proofMarkerOutputDtoSchema = z.strictObject({
  markers: z
    .array(
      z.strictObject({
        markerId: stableIdDtoSchema,
        position: planetPointDtoSchema,
      }),
    )
    .length(9),
});

const proofOutlineAcceptedAspectDtoSchema = z.strictObject({
  ...commonAcceptedAspectFields,
  aspectId: z.literal(PROOF_OUTLINE_ASPECT_ID_TEXT),
  aspectName: z.literal('proof.outline'),
  generatorId: z.literal('proof.outline'),
  generatorVersion: z.literal(1),
  parameterSchemaVersion: z.literal(1),
  parameters: proofOutlineParametersDtoSchema,
  seedScope: z.literal('map/entity'),
  dependencyAspects: z.array(aspectDependencyReferenceDtoSchema).length(0),
  acceptedOutput: proofOutlineOutputDtoSchema,
});

const proofMarkerAcceptedAspectDtoSchema = z.strictObject({
  ...commonAcceptedAspectFields,
  aspectId: z.literal(PROOF_MARKER_ASPECT_ID_TEXT),
  aspectName: z.literal('proof.markers'),
  generatorId: z.literal('proof.markers'),
  generatorVersion: z.literal(1),
  parameterSchemaVersion: z.literal(1),
  parameters: proofMarkerParametersDtoSchema,
  seedScope: z.literal('map/entity'),
  dependencyAspects: z.array(aspectDependencyReferenceDtoSchema).length(1),
  acceptedOutput: proofMarkerOutputDtoSchema,
});

const otherAcceptedAspectDtoSchema = z
  .strictObject({
    ...commonAcceptedAspectFields,
    aspectName: symbolicTextDtoSchema,
    generatorId: symbolicTextDtoSchema,
    parameters: canonicalJsonValueDtoSchema,
    acceptedOutput: canonicalJsonValueDtoSchema,
  })
  .superRefine((record, context) => {
    if (
      record.aspectName === 'proof.outline' ||
      record.aspectName === 'proof.markers' ||
      record.aspectId === PROOF_OUTLINE_ASPECT_ID_TEXT ||
      record.aspectId === PROOF_MARKER_ASPECT_ID_TEXT
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Milestone 1 proof aspects must match their exact v1 schema.',
      });
    }
  });

/** Strict proof arms prevent generic JSON from bypassing the normative M1 output contract. */
export const acceptedAspectDtoSchema = z.union([
  proofOutlineAcceptedAspectDtoSchema,
  proofMarkerAcceptedAspectDtoSchema,
  otherAcceptedAspectDtoSchema,
]);

export type AcceptedAspectDto = z.infer<typeof acceptedAspectDtoSchema>;

export const proofAcceptedOutputDtoSchema = z.discriminatedUnion('aspectName', [
  z.strictObject({
    aspectName: z.literal('proof.outline'),
    acceptedOutput: proofOutlineOutputDtoSchema,
  }),
  z.strictObject({
    aspectName: z.literal('proof.markers'),
    acceptedOutput: proofMarkerOutputDtoSchema,
  }),
]);
