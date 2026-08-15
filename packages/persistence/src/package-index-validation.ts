import { type MapDocumentDto } from './map-document-dto-schema.js';
import { type MapworldManifestDto, type WorldIndexDto } from './package-dto-schemas.js';
import { comparePersistenceDiagnostics, persistenceDiagnostic } from './persistence-diagnostics.js';
import { PERSISTENCE_DIAGNOSTIC_CODES, type PersistenceDiagnostic } from './persistence-model.js';

export function validateWorldIndex(
  manifest: MapworldManifestDto,
  world: WorldIndexDto,
): readonly PersistenceDiagnostic[] {
  const diagnostics: PersistenceDiagnostic[] = [];
  const mapIds = world.mapFiles.map(({ mapId }) => mapId);
  const mapPaths = world.mapFiles.map(({ path }) => path);
  const roots = world.mapFiles.filter(({ mapKind }) => mapKind === 'world');
  if (new Set(mapIds).size !== mapIds.length || new Set(mapPaths).size !== mapPaths.length) {
    diagnostics.push(
      referenceError('world.json', '$.mapFiles', 'Map IDs and map file paths must be unique.'),
    );
  }
  if (roots.length !== 1 || roots[0]?.mapId !== world.rootMapId) {
    diagnostics.push(
      referenceError(
        'world.json',
        '$.rootMapId',
        'The declared rootMapId must identify the one WorldMap index entry.',
      ),
    );
  }
  for (const [index, entry] of world.mapFiles.entries()) {
    if (entry.path !== `maps/${entry.mapId}.json`) {
      diagnostics.push(
        referenceError(
          'world.json',
          `$.mapFiles[${String(index)}].path`,
          'A map file path must be derived exactly from its stable map ID.',
        ),
      );
    }
    if (entry.mapKind === 'regional' && entry.parentMapId !== world.rootMapId) {
      diagnostics.push(
        referenceError(
          'world.json',
          `$.mapFiles[${String(index)}].parentMapId`,
          'Every v1 RegionalMap must be owned directly by the root WorldMap.',
        ),
      );
    }
  }
  const expectedAuthoritativePaths = ['world.json', ...mapPaths];
  const manifestPaths = manifest.authoritativeFiles.map(({ path }) => path);
  if (
    manifestPaths.length !== expectedAuthoritativePaths.length ||
    manifestPaths.some((path, index) => path !== expectedAuthoritativePaths[index])
  ) {
    diagnostics.push(
      referenceError(
        'manifest.json',
        '$.authoritativeFiles',
        'The manifest authoritative set must exactly match world.json and the complete map index.',
      ),
    );
  }
  return diagnostics.sort(comparePersistenceDiagnostics);
}

export function validateMapIndexEntry(
  entry: WorldIndexDto['mapFiles'][number],
  map: MapDocumentDto,
): PersistenceDiagnostic | undefined {
  const parentMatches =
    entry.mapKind === 'world' ||
    (map.mapKind === 'regional' && entry.parentMapId === map.parent.parentMapId);
  if (entry.mapId === map.mapId && entry.mapKind === map.mapKind && parentMatches) return undefined;
  return referenceError(
    entry.path,
    '$',
    'Map identity, kind, and parent must exactly match the complete world.json index entry.',
  );
}

function referenceError(
  filePath: string,
  fieldPath: string,
  message: string,
): PersistenceDiagnostic {
  return persistenceDiagnostic(
    PERSISTENCE_DIAGNOSTIC_CODES.referenceInvalid,
    filePath,
    fieldPath,
    message,
    'Restore matching stable IDs and declared file references without guessing or repair.',
  );
}
