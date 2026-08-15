import {
  createImmutableDomainSnapshot,
  parseStableId,
  parseWorldSeed,
  type WorldDocument,
} from '@ttrpg-map/core';

import { decodeCanonicalDto } from './canonical-dto-decoding.js';
import { parseCoreValue } from './core-parsing.js';
import { validateDocumentForPersistence } from './document-validation.js';
import { orderManifestDto, orderMapDocumentDto, orderWorldIndexDto } from './dto-ordering.js';
import { type MapDocumentDto, mapDocumentDtoSchema } from './map-document-dto-schema.js';
import { mapDocumentFromDto } from './map-document-from-dto.js';
import {
  mapworldManifestDtoSchema,
  type WorldIndexDto,
  worldIndexDtoSchema,
} from './package-dto-schemas.js';
import {
  missingPackageFile,
  validateChecksums,
  validateManifestFiles,
  validatePackageContainer,
} from './package-file-validation.js';
import { validateMapIndexEntry, validateWorldIndex } from './package-index-validation.js';
import {
  persistenceDiagnostic,
  persistenceFailure,
  persistenceSuccess,
} from './persistence-diagnostics.js';
import {
  ACCEPTED_ASPECT_SCHEMA_VERSION,
  MAP_DOCUMENT_SCHEMA_VERSION,
  MAPWORLD_APPLICATION_COMPATIBILITY,
  MAPWORLD_PACKAGE_VERSION,
  MAPWORLD_SCHEMA_VERSION,
  PERSISTENCE_DIAGNOSTIC_CODES,
  type PersistenceResult,
  WORLD_INDEX_SCHEMA_VERSION,
} from './persistence-model.js';

/** Validate and reconstruct a new deeply readonly world document without generator access. */
export function decodeMapworld(input: unknown): PersistenceResult<WorldDocument> {
  const packageFiles = validatePackageContainer(input);
  if (!packageFiles.ok) return packageFiles;
  const filesByPath = new Map(packageFiles.value.map((file) => [file.path, file.bytes] as const));
  const manifestBytes = filesByPath.get('manifest.json');
  if (manifestBytes === undefined) return missingPackageFile('manifest.json');

  const manifest = decodeCanonicalDto(
    manifestBytes,
    'manifest.json',
    mapworldManifestDtoSchema,
    orderManifestDto,
    [
      { path: ['packageVersion'], expected: MAPWORLD_PACKAGE_VERSION },
      { path: ['schemaVersion'], expected: MAPWORLD_SCHEMA_VERSION },
      {
        path: ['applicationCompatibility', 'minimumVersion'],
        expected: MAPWORLD_APPLICATION_COMPATIBILITY.minimumVersion,
      },
      {
        path: ['applicationCompatibility', 'maximumVersionExclusive'],
        expected: MAPWORLD_APPLICATION_COMPATIBILITY.maximumVersionExclusive,
      },
      {
        path: ['recordSchemaVersions', 'worldIndex'],
        expected: WORLD_INDEX_SCHEMA_VERSION,
      },
      {
        path: ['recordSchemaVersions', 'mapDocument'],
        expected: MAP_DOCUMENT_SCHEMA_VERSION,
      },
      {
        path: ['recordSchemaVersions', 'acceptedAspect'],
        expected: ACCEPTED_ASPECT_SCHEMA_VERSION,
      },
    ],
  );
  if (!manifest.ok) return manifest;

  const packageDiagnostics = validateManifestFiles(manifest.value, filesByPath);
  if (packageDiagnostics.length > 0) return persistenceFailure(...packageDiagnostics);
  const checksumDiagnostics = validateChecksums(manifest.value, filesByPath);
  if (checksumDiagnostics.length > 0) return persistenceFailure(...checksumDiagnostics);

  const worldBytes = filesByPath.get('world.json');
  if (worldBytes === undefined) return missingPackageFile('world.json');
  const worldIndex = decodeCanonicalDto(
    worldBytes,
    'world.json',
    worldIndexDtoSchema,
    orderWorldIndexDto,
    [{ path: ['worldIndexSchemaVersion'], expected: WORLD_INDEX_SCHEMA_VERSION }],
  );
  if (!worldIndex.ok) return worldIndex;
  const indexDiagnostics = validateWorldIndex(manifest.value, worldIndex.value);
  if (indexDiagnostics.length > 0) return persistenceFailure(...indexDiagnostics);

  const mapDtos: MapDocumentDto[] = [];
  for (const entry of worldIndex.value.mapFiles) {
    const bytes = filesByPath.get(entry.path);
    if (bytes === undefined) return missingPackageFile(entry.path);
    const dto = decodeCanonicalDto(bytes, entry.path, mapDocumentDtoSchema, orderMapDocumentDto, [
      { path: ['mapDocumentSchemaVersion'], expected: MAP_DOCUMENT_SCHEMA_VERSION },
      {
        path: ['aspects', '*', 'acceptedAspectSchemaVersion'],
        expected: ACCEPTED_ASPECT_SCHEMA_VERSION,
      },
      { path: ['coordinateSystem', 'transformVersion'], expected: 1 },
    ]);
    if (!dto.ok) return dto;
    const entryDiagnostic = validateMapIndexEntry(entry, dto.value);
    if (entryDiagnostic !== undefined) return persistenceFailure(entryDiagnostic);
    mapDtos.push(dto.value);
  }

  return worldDocumentFromDtos(worldIndex.value, mapDtos);
}

function worldDocumentFromDtos(
  world: WorldIndexDto,
  mapDtos: readonly MapDocumentDto[],
): PersistenceResult<WorldDocument> {
  const worldDocumentId = parseCoreValue(
    parseStableId('world-document', world.worldDocumentId),
    'world.json',
    '$.worldDocumentId',
  );
  if (!worldDocumentId.ok) return worldDocumentId;
  const rootMapId = parseCoreValue(
    parseStableId('map', world.rootMapId),
    'world.json',
    '$.rootMapId',
  );
  if (!rootMapId.ok) return rootMapId;
  const worldSeed = parseCoreValue(
    parseWorldSeed(world.worldSeed),
    'world.json',
    '$.worldSeed',
    PERSISTENCE_DIAGNOSTIC_CODES.seedInvalid,
  );
  if (!worldSeed.ok) return worldSeed;
  const maps = [];
  for (const [index, dto] of mapDtos.entries()) {
    const entry = world.mapFiles[index];
    if (entry === undefined) return missingPackageFile('world.json');
    const map = mapDocumentFromDto(dto, entry.path);
    if (!map.ok) return map;
    maps.push(map.value);
  }
  const candidate: WorldDocument = {
    worldDocumentId: worldDocumentId.value,
    displayName: world.displayName,
    worldSeed: worldSeed.value,
    rootMapId: rootMapId.value,
    maps,
  };
  const snapshot = createImmutableDomainSnapshot(candidate);
  if (!snapshot.ok) {
    return persistenceFailure(
      persistenceDiagnostic(
        PERSISTENCE_DIAGNOSTIC_CODES.immutableSnapshotInvalid,
        'world.json',
        '$',
        'The validated package could not be reconstructed as a deeply readonly world document.',
        'Restore plain canonical JSON records without aliases or executable properties.',
      ),
    );
  }
  const document = snapshot.value;
  const diagnostics = validateDocumentForPersistence(document);
  return diagnostics.length === 0
    ? persistenceSuccess(document)
    : persistenceFailure(...diagnostics);
}
