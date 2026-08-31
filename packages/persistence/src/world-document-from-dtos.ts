import {
  type AcceptedAspectRecord,
  createImmutableDomainSnapshot,
  parseStableId,
  parseWorldSeed,
  type WorldDocument,
} from '@ttrpg-map/core';

import { parseCoreValue } from './core-parsing.js';
import { validateDocumentForPersistence } from './document-validation.js';
import { type MapDocumentDto } from './map-document-dto-schema.js';
import { mapDocumentFromDto } from './map-document-from-dto.js';
import { type WorldIndexDto } from './package-dto-schemas.js';
import { missingPackageFile } from './package-file-validation.js';
import {
  persistenceDiagnostic,
  persistenceFailure,
  persistenceSuccess,
} from './persistence-diagnostics.js';
import { PERSISTENCE_DIAGNOSTIC_CODES, type PersistenceResult } from './persistence-model.js';

export function worldDocumentFromDtos(
  world: WorldIndexDto,
  mapDtos: readonly MapDocumentDto[],
  externalAspectsByMap: readonly (readonly AcceptedAspectRecord[])[] = [],
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
    maps.push({
      ...map.value,
      aspects: [...map.value.aspects, ...(externalAspectsByMap[index] ?? [])].sort((left, right) =>
        left.aspectId < right.aspectId ? -1 : left.aspectId > right.aspectId ? 1 : 0,
      ),
    });
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
