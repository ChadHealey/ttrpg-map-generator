import { z } from 'zod';

import { ACCEPTED_ASPECT_SCHEMA_VERSION } from './persistence-model.js';
import {
  aspectDependencyReferenceDtoSchema,
  diagnosticDtoSchema,
  nonnegativeIntegerDtoSchema,
  positiveIntegerDtoSchema,
  seedInputDtoSchema,
  stableIdDtoSchema,
} from './primitive-dto-schemas.js';

export const commonAcceptedAspectFields = {
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
