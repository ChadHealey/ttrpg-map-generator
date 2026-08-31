import { sha256Hex } from './canonical-json.js';
import { MAPWORLD_NATIVE_LIMITS } from './mapworld-recovery-model.js';
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
const DATA_FILE_PATTERN =
  /^data\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(?:aspects\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json|fields\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9-]+\.mwf)$/u;
const UTF8_ENCODER = new TextEncoder();

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
  if (inputFiles.length === 0 || inputFiles.length > MAPWORLD_NATIVE_LIMITS.maximumPackageFiles) {
    return limitFailure('$package', '$.files', 'Package file count exceeds the native limit.');
  }
  const validatedFiles: { readonly path: string; readonly bytes: Uint8Array }[] = [];
  const seenPaths = new Set<string>();
  let aggregateBytes = 0;
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
    if (!isPathWithinNativeLimits(file.path)) {
      return limitFailure(
        file.path,
        `$.files[${String(index)}].path`,
        'Package path exceeds the native path or component limit.',
      );
    }
    if (file.bytes.byteLength > MAPWORLD_NATIVE_LIMITS.maximumFileBytes) {
      return limitFailure(
        file.path,
        `$.files[${String(index)}].bytes`,
        'Package entry exceeds the native per-file byte limit.',
      );
    }
    aggregateBytes += file.bytes.byteLength;
    if (aggregateBytes > MAPWORLD_NATIVE_LIMITS.maximumPackageBytes) {
      return limitFailure(
        '$package',
        '$.files',
        'Package exceeds the native aggregate byte limit.',
      );
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
    validatedFiles.push({ path: file.path, bytes: file.bytes });
  }
  const files: MapworldPackageFile[] = validatedFiles.map(({ path, bytes }) =>
    Object.freeze({ path, bytes: bytes.slice() }),
  );
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
  return (
    path === 'manifest.json' ||
    path === 'world.json' ||
    MAP_FILE_PATTERN.test(path) ||
    DATA_FILE_PATTERN.test(path)
  );
}

function isPathWithinNativeLimits(path: string): boolean {
  const components = path.split('/');
  return (
    UTF8_ENCODER.encode(path).byteLength <= MAPWORLD_NATIVE_LIMITS.maximumRelativePathBytes &&
    components.length - 1 <= MAPWORLD_NATIVE_LIMITS.maximumDirectoryDepth &&
    components.every(
      (component) =>
        component.length > 0 &&
        component !== '.' &&
        component !== '..' &&
        UTF8_ENCODER.encode(component).byteLength <= MAPWORLD_NATIVE_LIMITS.maximumBasenameBytes,
    )
  );
}

function limitFailure<Value>(
  filePath: string,
  fieldPath: string,
  message: string,
): PersistenceResult<Value> {
  return persistenceFailure(
    persistenceDiagnostic(
      PERSISTENCE_DIAGNOSTIC_CODES.limitExceeded,
      filePath,
      fieldPath,
      message,
      'Reduce the bounded package or restore an in-limit package before opening it.',
    ),
  );
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
