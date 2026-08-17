import { sha256Hex } from './canonical-json.js';
import { decodeMapworld } from './mapworld-decode.js';
import {
  deriveMapworldRecoveryArtifactNames,
  parseMapworldRecoveryMarker,
} from './mapworld-recovery-marker.js';
import {
  type ClassifiedMapworldMarkerCandidate,
  type ClassifiedMapworldPackageCandidate,
  type ClassifiedMapworldRecoverySnapshot,
  MAPWORLD_RECOVERY_CODES,
  type MapworldPackageRole,
  type MapworldRecoveryResult,
  type NativeMapworldOsContext,
} from './mapworld-recovery-model.js';
import { recoveryFailure, recoverySuccess } from './mapworld-recovery-result.js';
import {
  type NativeMapworldMarkerRoleDto,
  type NativeMapworldPackageRoleDto,
  nativeMapworldRecoverySnapshotSchema,
} from './mapworld-recovery-schemas.js';
import { persistenceDiagnostic } from './persistence-diagnostics.js';
import type { MapworldPackage, PersistenceDiagnostic } from './persistence-model.js';

export function classifyMapworldRecoverySnapshot(
  input: unknown,
): MapworldRecoveryResult<ClassifiedMapworldRecoverySnapshot> {
  const parsed = nativeMapworldRecoverySnapshotSchema.safeParse(input);
  if (!parsed.success) {
    return recoveryFailure(
      MAPWORLD_RECOVERY_CODES.artifactConflict,
      'The native recovery snapshot DTO is malformed or exceeds its declared bounds.',
      'Preserve all artifacts and retry enumeration with the supported native adapter.',
    );
  }
  const names = deriveMapworldRecoveryArtifactNames(parsed.data.targetName);
  if (!names.ok) return names;
  const target = classifyPackageRole('target', parsed.data.target);
  const temporary = classifyPackageRole('temporary', parsed.data.temporary);
  const backup = classifyPackageRole('backup', parsed.data.backup);
  const marker = classifyMarkerRole(parsed.data.marker, parsed.data.targetName);
  return recoverySuccess(
    Object.freeze({
      targetName: parsed.data.targetName,
      snapshotId: parsed.data.snapshotId,
      target,
      temporary,
      backup,
      marker,
    }),
  );
}

function classifyPackageRole(
  role: MapworldPackageRole,
  observed: NativeMapworldPackageRoleDto,
): ClassifiedMapworldPackageCandidate {
  const base = Object.freeze({
    role,
    observationToken: observed.observationToken,
    observedKind: observed.kind,
  });
  switch (observed.kind) {
    case 'absent':
      return Object.freeze({ ...base, classification: 'absent' });
    case 'empty-directory':
      return Object.freeze({ ...base, classification: 'empty' });
    case 'directory':
      return classifyDirectory(base, observed.entries);
    case 'invalid-directory': {
      const decoded = decodeMapworld({
        files: observed.entries.map(({ path, bytes }) => ({ path, bytes })),
      });
      return Object.freeze({
        ...base,
        classification: 'invalid',
        diagnostics: decoded.ok
          ? Object.freeze([
              persistenceDiagnostic(
                'persistence.file.unexpected',
                `${observed.directories[0] ?? '<unknown>'}/`,
                '$',
                'The package contains a native directory not represented by the v1 file contract.',
                'Preserve it until its exact candidate-specific cleanup is confirmed.',
              ),
            ])
          : freezeDiagnostics(decoded.diagnostics),
      });
    }
    case 'regular-file':
    case 'special':
    case 'symlink':
      return Object.freeze({ ...base, classification: 'wrong-kind' });
    case 'unreadable':
      return Object.freeze({
        ...base,
        classification: 'unreadable',
        osContext: freezeOsContext(observed.osContext),
      });
  }
}

function classifyDirectory(
  base: Pick<ClassifiedMapworldPackageCandidate, 'role' | 'observationToken' | 'observedKind'>,
  entries: readonly { readonly path: string; readonly bytes: Uint8Array }[],
): ClassifiedMapworldPackageCandidate {
  const pkg: MapworldPackage = {
    files: entries.map(({ path, bytes }) => ({ path, bytes })),
  };
  const decoded = decodeMapworld(pkg);
  if (!decoded.ok) {
    return Object.freeze({
      ...base,
      classification: 'invalid',
      diagnostics: freezeDiagnostics(decoded.diagnostics),
    });
  }
  const manifest = pkg.files.find(({ path }) => path === 'manifest.json');
  if (manifest === undefined) {
    return Object.freeze({
      ...base,
      classification: 'invalid',
      diagnostics: Object.freeze([
        persistenceDiagnostic(
          'persistence.file.missing',
          'manifest.json',
          '$',
          'The decoded package did not retain its required manifest.',
          'Restore a complete canonical mapworld package.',
        ),
      ]),
    });
  }
  return Object.freeze({
    ...base,
    classification: 'valid',
    fingerprint: sha256Hex(manifest.bytes),
    document: decoded.value,
  });
}

function classifyMarkerRole(
  observed: NativeMapworldMarkerRoleDto,
  targetName: string,
): ClassifiedMapworldMarkerCandidate {
  const base = Object.freeze({
    role: 'marker' as const,
    observationToken: observed.observationToken,
    observedKind: observed.kind,
  });
  switch (observed.kind) {
    case 'absent':
      return Object.freeze({ ...base, classification: 'absent' });
    case 'regular-file': {
      const marker = parseMapworldRecoveryMarker(observed.bytes, targetName);
      if (marker.ok) {
        return Object.freeze({ ...base, classification: 'valid', marker: marker.value });
      }
      return Object.freeze({
        ...base,
        classification:
          marker.error.code === MAPWORLD_RECOVERY_CODES.markerVersionIncompatible
            ? 'incompatible'
            : 'invalid',
        error: marker.error,
      });
    }
    case 'unreadable':
      return Object.freeze({
        ...base,
        classification: 'unreadable',
        osContext: freezeOsContext(observed.osContext),
      });
    case 'directory':
    case 'empty-directory':
    case 'special':
    case 'symlink':
      return Object.freeze({ ...base, classification: 'wrong-kind' });
  }
}

function freezeOsContext(context: NativeMapworldOsContext): NativeMapworldOsContext {
  return Object.freeze({ ...context });
}

function freezeDiagnostics(
  diagnostics: readonly PersistenceDiagnostic[],
): readonly PersistenceDiagnostic[] {
  return Object.freeze(diagnostics.map((diagnostic) => Object.freeze({ ...diagnostic })));
}
