import { z } from 'zod';

import {
  ACCEPTED_ASPECT_SCHEMA_VERSION,
  MAP_DOCUMENT_SCHEMA_VERSION,
  MAPWORLD_APPLICATION_COMPATIBILITY,
  MAPWORLD_CHECKSUM_ALGORITHM,
  MAPWORLD_PACKAGE_VERSION,
  MAPWORLD_SCHEMA_VERSION,
  WORLD_INDEX_SCHEMA_VERSION,
} from './persistence-model.js';
import {
  canonicalWorldSeedDtoSchema,
  displayNameDtoSchema,
  stableIdDtoSchema,
} from './primitive-dto-schemas.js';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const MAP_FILE_PATTERN =
  /^maps\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/u;

const authoritativeFileDtoSchema = z.strictObject({
  path: z.string().refine((path) => path === 'world.json' || MAP_FILE_PATTERN.test(path)),
  checksumAlgorithm: z.literal(MAPWORLD_CHECKSUM_ALGORITHM),
  sha256: z.string().regex(SHA256_PATTERN),
});

export const mapworldManifestDtoSchema = z.strictObject({
  packageVersion: z.literal(MAPWORLD_PACKAGE_VERSION),
  schemaVersion: z.literal(MAPWORLD_SCHEMA_VERSION),
  applicationCompatibility: z.strictObject({
    minimumVersion: z.literal(MAPWORLD_APPLICATION_COMPATIBILITY.minimumVersion),
    maximumVersionExclusive: z.literal(MAPWORLD_APPLICATION_COMPATIBILITY.maximumVersionExclusive),
  }),
  recordSchemaVersions: z.strictObject({
    worldIndex: z.literal(WORLD_INDEX_SCHEMA_VERSION),
    mapDocument: z.literal(MAP_DOCUMENT_SCHEMA_VERSION),
    acceptedAspect: z.literal(ACCEPTED_ASPECT_SCHEMA_VERSION),
  }),
  authoritativeFiles: z.array(authoritativeFileDtoSchema).min(2),
  recovery: z.strictObject({ mode: z.literal('none') }),
});

const worldMapIndexEntryDtoSchema = z.strictObject({
  mapId: stableIdDtoSchema,
  mapKind: z.literal('world'),
  path: z.string().regex(MAP_FILE_PATTERN),
});

const regionalMapIndexEntryDtoSchema = z.strictObject({
  mapId: stableIdDtoSchema,
  mapKind: z.literal('regional'),
  parentMapId: stableIdDtoSchema,
  path: z.string().regex(MAP_FILE_PATTERN),
});

export const worldIndexDtoSchema = z.strictObject({
  worldIndexSchemaVersion: z.literal(WORLD_INDEX_SCHEMA_VERSION),
  worldDocumentId: stableIdDtoSchema,
  displayName: displayNameDtoSchema,
  worldSeed: canonicalWorldSeedDtoSchema,
  rootMapId: stableIdDtoSchema,
  mapFiles: z.array(
    z.discriminatedUnion('mapKind', [worldMapIndexEntryDtoSchema, regionalMapIndexEntryDtoSchema]),
  ),
});

export type MapworldManifestDto = z.infer<typeof mapworldManifestDtoSchema>;
export type WorldIndexDto = z.infer<typeof worldIndexDtoSchema>;
