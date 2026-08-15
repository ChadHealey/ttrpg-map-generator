import { sha256Hex } from './canonical-json.js';
import { type MapworldManifestDto } from './package-dto-schemas.js';
import {
  comparePersistenceDiagnostics,
  persistenceDiagnostic,
  persistenceFailure,
  persistenceSuccess,
} from './persistence-diagnostics.js';
import {
  type MapworldPackageFile,
  PERSISTENCE_DIAGNOSTIC_CODES,
  type PersistenceDiagnostic,
  type PersistenceResult,
} from './persistence-model.js';

const MAP_FILE_PATTERN =
  /^maps\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/u;

export function validatePackageContainer(
  input: unknown,
): PersistenceResult<readonly MapworldPackageFile[]> {
  if (
    typeof input !== 'object' ||
    input === null ||
    Array.isArray(input) ||
    Object.keys(input).length !== 1 ||
    !Object.hasOwn(input, 'files') ||
    !Array.isArray((input as { readonly files?: unknown }).files)
  ) {
    return persistenceFailure(
      persistenceDiagnostic(
        PERSISTENCE_DIAGNOSTIC_CODES.schemaInvalid,
        '$package',
        '$.files',
        'A mapworld package must contain exactly one files array.',
        'Provide the complete in-memory package returned by the v1 encoder.',
      ),
    );
  }
  const inputFiles = (input as { readonly files: readonly unknown[] }).files;
  const files: MapworldPackageFile[] = [];
  const seenPaths = new Set<string>();
  for (const [index, candidate] of inputFiles.entries()) {
    if (
      typeof candidate !== 'object' ||
      candidate === null ||
      Array.isArray(candidate) ||
      Object.keys(candidate).sort().join('\0') !== 'bytes\0path'
    ) {
      return invalidContainerFile(index);
    }
    const file = candidate as { readonly path?: unknown; readonly bytes?: unknown };
    if (
      typeof file.path !== 'string' ||
      !(file.bytes instanceof Uint8Array) ||
      !isAllowedPackagePath(file.path)
    ) {
      return invalidContainerFile(index);
    }
    if (seenPaths.has(file.path)) {
      return persistenceFailure(
        persistenceDiagnostic(
          PERSISTENCE_DIAGNOSTIC_CODES.fileDuplicate,
          file.path,
          '$',
          `Package file path appears more than once: ${file.path}.`,
          'Keep exactly one authoritative byte sequence for each declared file path.',
        ),
      );
    }
    seenPaths.add(file.path);
    files.push(Object.freeze({ path: file.path, bytes: file.bytes.slice() }));
  }
  return persistenceSuccess(Object.freeze(files));
}

export function validateManifestFiles(
  manifest: MapworldManifestDto,
  filesByPath: ReadonlyMap<string, Uint8Array>,
): readonly PersistenceDiagnostic[] {
  const diagnostics: PersistenceDiagnostic[] = [];
  const authoritativePaths = manifest.authoritativeFiles.map(({ path }) => path);
  if (new Set(authoritativePaths).size !== authoritativePaths.length) {
    diagnostics.push(
      referenceError(
        'manifest.json',
        '$.authoritativeFiles',
        'Authoritative file paths must be unique.',
      ),
    );
  }
  const expectedPaths = new Set(['manifest.json', ...authoritativePaths]);
  for (const path of expectedPaths) {
    if (!filesByPath.has(path)) diagnostics.push(missingFileDiagnostic(path));
  }
  for (const path of filesByPath.keys()) {
    if (!expectedPaths.has(path)) {
      diagnostics.push(
        persistenceDiagnostic(
          PERSISTENCE_DIAGNOSTIC_CODES.fileUnexpected,
          path,
          '$',
          `The v1 package contains undeclared file ${path}.`,
          'Remove undeclared content only through an explicit compatible package operation.',
        ),
      );
    }
  }
  return diagnostics.sort(comparePersistenceDiagnostics);
}

export function validateChecksums(
  manifest: MapworldManifestDto,
  filesByPath: ReadonlyMap<string, Uint8Array>,
): readonly PersistenceDiagnostic[] {
  const diagnostics: PersistenceDiagnostic[] = [];
  for (const [index, entry] of manifest.authoritativeFiles.entries()) {
    const bytes = filesByPath.get(entry.path);
    if (bytes !== undefined && sha256Hex(bytes) !== entry.sha256) {
      diagnostics.push(
        persistenceDiagnostic(
          PERSISTENCE_DIAGNOSTIC_CODES.checksumMismatch,
          entry.path,
          `manifest.json#$.authoritativeFiles[${String(index)}].sha256`,
          `SHA-256 does not match the authoritative bytes for ${entry.path}.`,
          'Restore the exact authoritative file or a manifest produced for those bytes.',
        ),
      );
    }
  }
  return diagnostics;
}

export function missingPackageFile<Value>(path: string): PersistenceResult<Value> {
  return persistenceFailure(missingFileDiagnostic(path));
}

function invalidContainerFile(index: number): PersistenceResult<never> {
  return persistenceFailure(
    persistenceDiagnostic(
      PERSISTENCE_DIAGNOSTIC_CODES.filePathInvalid,
      '$package',
      `$.files[${String(index)}]`,
      'Each package file must contain exactly a normalized v1 path and Uint8Array bytes.',
      'Use manifest.json, world.json, or maps/<canonical-map-id>.json paths only.',
    ),
  );
}

function isAllowedPackagePath(path: string): boolean {
  return path === 'manifest.json' || path === 'world.json' || MAP_FILE_PATTERN.test(path);
}

function missingFileDiagnostic(path: string): PersistenceDiagnostic {
  return persistenceDiagnostic(
    PERSISTENCE_DIAGNOSTIC_CODES.fileMissing,
    path,
    '$',
    `Required package file is missing: ${path}.`,
    'Restore the complete authoritative v1 package before opening it.',
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
