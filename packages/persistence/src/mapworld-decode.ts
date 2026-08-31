import { type WorldDocument } from '@ttrpg-map/core';

import { decodeCanonicalDto } from './canonical-dto-decoding.js';
import { parseCanonicalJsonBytes } from './canonical-json.js';
import { orderManifestDto, orderMapDocumentDto, orderWorldIndexDto } from './dto-ordering.js';
import { type MapDocumentDto, mapDocumentDtoSchema } from './map-document-dto-schema.js';
import { decodeMapworldV2Files } from './mapworld-v2-codec.js';
import { mapworldManifestDtoSchema, worldIndexDtoSchema } from './package-dto-schemas.js';
import {
  missingPackageFile,
  validateChecksums,
  validateManifestFiles,
  validatePackageContainer,
} from './package-file-validation.js';
import { validateMapIndexEntry, validateWorldIndex } from './package-index-validation.js';
import { persistenceDiagnostic, persistenceFailure } from './persistence-diagnostics.js';
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
import { worldDocumentFromDtos } from './world-document-from-dtos.js';

/** Validate and reconstruct a new deeply readonly world document without generator access. */
export function decodeMapworld(input: unknown): PersistenceResult<WorldDocument> {
  const packageFiles = validatePackageContainer(input);
  if (!packageFiles.ok) return packageFiles;
  const manifestFile = packageFiles.value.find(({ path }) => path === 'manifest.json');
  if (manifestFile === undefined) return missingPackageFile('manifest.json');
  const manifestJson = parseCanonicalJsonBytes(manifestFile.bytes, 'manifest.json');
  if (!manifestJson.ok) return manifestJson;
  if (
    typeof manifestJson.value !== 'object' ||
    manifestJson.value === null ||
    Array.isArray(manifestJson.value)
  ) {
    return incompatibleManifest(undefined);
  }
  const version = (manifestJson.value as Readonly<Record<string, unknown>>).packageVersion;
  const schemaVersion = (manifestJson.value as Readonly<Record<string, unknown>>).schemaVersion;
  if (version === 1 && schemaVersion === 1) return decodeMapworldV1Files(packageFiles.value);
  if (version === 2 && schemaVersion === 2) return decodeMapworldV2Files(packageFiles.value);
  return incompatibleManifest({ packageVersion: version, schemaVersion });
}

/** The compatibility-only v1 reader rejects v2 before reading referenced records. */
export function decodeMapworldV1(input: unknown): PersistenceResult<WorldDocument> {
  const packageFiles = validatePackageContainer(input);
  return packageFiles.ok ? decodeMapworldV1Files(packageFiles.value) : packageFiles;
}

function decodeMapworldV1Files(
  packageFiles: readonly { readonly path: string; readonly bytes: Uint8Array }[],
): PersistenceResult<WorldDocument> {
  const filesByPath = new Map(packageFiles.map((file) => [file.path, file.bytes] as const));
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

function incompatibleManifest(actual: unknown): PersistenceResult<never> {
  return persistenceFailure(
    persistenceDiagnostic(
      PERSISTENCE_DIAGNOSTIC_CODES.versionIncompatible,
      'manifest.json',
      '$',
      `Unsupported mapworld package/schema version ${JSON.stringify(actual)}.`,
      'Open the package with a compatible application or apply an explicit supported migration.',
    ),
  );
}
