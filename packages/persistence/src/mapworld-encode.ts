import {
  type AcceptedAspectRecord,
  createImmutableDomainSnapshot,
  type WorldDocument,
} from '@ttrpg-map/core';

import { canonicalJsonBytes, sha256Hex } from './canonical-json.js';
import { validateDocumentForPersistence } from './document-validation.js';
import {
  acceptedAspectToDto,
  mapDocumentToDto,
  orderedMaps,
  worldIndexRaw,
} from './domain-to-dto.js';
import { orderManifestDto, orderWorldIndexDto } from './dto-ordering.js';
import { mapworldManifestDtoSchema, worldIndexDtoSchema } from './package-dto-schemas.js';
import {
  persistenceDiagnostic,
  persistenceFailure,
  persistenceSuccess,
} from './persistence-diagnostics.js';
import {
  ACCEPTED_ASPECT_SCHEMA_VERSION,
  MAP_DOCUMENT_SCHEMA_VERSION,
  MAPWORLD_APPLICATION_COMPATIBILITY,
  MAPWORLD_CHECKSUM_ALGORITHM,
  MAPWORLD_PACKAGE_VERSION,
  MAPWORLD_SCHEMA_VERSION,
  type MapworldPackage,
  type MapworldPackageFile,
  PERSISTENCE_DIAGNOSTIC_CODES,
  type PersistenceResult,
  WORLD_INDEX_SCHEMA_VERSION,
} from './persistence-model.js';
import { validateDto } from './schema-validation.js';

export function encodeMapworld(document: WorldDocument): PersistenceResult<MapworldPackage> {
  const snapshot = createImmutableDomainSnapshot(document);
  if (!snapshot.ok) return invalidEncodingSnapshot('$document');
  const safeDocument = snapshot.value;
  const documentDiagnostics = validateDocumentForPersistence(safeDocument);
  if (documentDiagnostics.length > 0) return persistenceFailure(...documentDiagnostics);

  const authoritativeFiles: MapworldPackageFile[] = [];
  const rawWorldIndex = worldIndexRaw(safeDocument);
  const worldIndex = validateDto(worldIndexDtoSchema, rawWorldIndex, 'world.json');
  if (!worldIndex.ok) return worldIndex;
  const worldBytes = canonicalJsonBytes(orderWorldIndexDto(worldIndex.value), 'world.json');
  if (!worldBytes.ok) return worldBytes;
  authoritativeFiles.push({ path: 'world.json', bytes: worldBytes.value });

  for (const map of orderedMaps(safeDocument)) {
    const dto = mapDocumentToDto(map);
    if (!dto.ok) return dto;
    const path = `maps/${map.mapId}.json`;
    const bytes = canonicalJsonBytes(dto.value, path);
    if (!bytes.ok) return bytes;
    authoritativeFiles.push({ path, bytes: bytes.value });
  }

  const rawManifest = {
    packageVersion: MAPWORLD_PACKAGE_VERSION,
    schemaVersion: MAPWORLD_SCHEMA_VERSION,
    applicationCompatibility: { ...MAPWORLD_APPLICATION_COMPATIBILITY },
    recordSchemaVersions: {
      worldIndex: WORLD_INDEX_SCHEMA_VERSION,
      mapDocument: MAP_DOCUMENT_SCHEMA_VERSION,
      acceptedAspect: ACCEPTED_ASPECT_SCHEMA_VERSION,
    },
    authoritativeFiles: authoritativeFiles.map((file) => ({
      path: file.path,
      checksumAlgorithm: MAPWORLD_CHECKSUM_ALGORITHM,
      sha256: sha256Hex(file.bytes),
    })),
    recovery: { mode: 'none' as const },
  };
  const manifest = validateDto(mapworldManifestDtoSchema, rawManifest, 'manifest.json');
  if (!manifest.ok) return manifest;
  const manifestBytes = canonicalJsonBytes(orderManifestDto(manifest.value), 'manifest.json');
  if (!manifestBytes.ok) return manifestBytes;

  return persistenceSuccess(
    Object.freeze({
      files: Object.freeze([
        frozenFile('manifest.json', manifestBytes.value),
        ...authoritativeFiles.map((file) => frozenFile(file.path, file.bytes)),
      ]),
    }),
  );
}

export function canonicalAspectBytes(aspect: AcceptedAspectRecord): PersistenceResult<Uint8Array> {
  const snapshot = createImmutableDomainSnapshot(aspect);
  if (!snapshot.ok) return invalidEncodingSnapshot('$aspect');
  const dto = acceptedAspectToDto(snapshot.value, '$aspect');
  return dto.ok ? canonicalJsonBytes(dto.value, '$aspect') : dto;
}

export function canonicalAspectOutputBytes(
  aspect: AcceptedAspectRecord,
): PersistenceResult<Uint8Array> {
  const snapshot = createImmutableDomainSnapshot(aspect);
  if (!snapshot.ok) return invalidEncodingSnapshot('$aspect-output');
  const dto = acceptedAspectToDto(snapshot.value, '$aspect-output');
  return dto.ok ? canonicalJsonBytes(dto.value.acceptedOutput, '$aspect-output') : dto;
}

function frozenFile(path: string, bytes: Uint8Array): MapworldPackageFile {
  return Object.freeze({ path, bytes: bytes.slice() });
}

function invalidEncodingSnapshot<Value>(filePath: string): PersistenceResult<Value> {
  return persistenceFailure(
    persistenceDiagnostic(
      PERSISTENCE_DIAGNOSTIC_CODES.immutableSnapshotInvalid,
      filePath,
      '$',
      'Persistence input must be a finite plain-data graph without accessors, symbols, sparse arrays, exotic prototypes, or cycles.',
      'Provide independently owned project records containing only persistence-ready data values.',
    ),
  );
}
