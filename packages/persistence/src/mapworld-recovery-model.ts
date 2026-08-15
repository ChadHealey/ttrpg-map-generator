import type { DeepReadonly, WorldDocument } from '@ttrpg-map/core';

import type { PersistenceDiagnostic } from './persistence-model.js';

export const MAPWORLD_RECOVERY_CODES = Object.freeze({
  ambiguousCandidates: 'persistence.recovery.ambiguous-candidates',
  artifactConflict: 'persistence.recovery.artifact-conflict',
  artifactNameInvalid: 'persistence.recovery.artifact-name-invalid',
  confirmationRequired: 'persistence.recovery.confirmation-required',
  durabilityFailed: 'persistence.recovery.durability-failed',
  durabilityUnsupported: 'persistence.recovery.durability-unsupported',
  fingerprintMismatch: 'persistence.recovery.fingerprint-mismatch',
  ioFailed: 'persistence.recovery.io-failed',
  markerInvalid: 'persistence.recovery.marker-invalid',
  markerVersionIncompatible: 'persistence.recovery.marker-version-incompatible',
  noValidPackage: 'persistence.recovery.no-valid-package',
  operationInProgress: 'persistence.recovery.operation-in-progress',
  targetChanged: 'persistence.recovery.target-changed',
});

export type MapworldRecoveryCode =
  (typeof MAPWORLD_RECOVERY_CODES)[keyof typeof MAPWORLD_RECOVERY_CODES];

export const MAPWORLD_NATIVE_LIMITS = Object.freeze({
  maximumBasenameBytes: 255,
  maximumDirectoryDepth: 8,
  maximumFileBytes: 16_777_216,
  maximumMarkerBytes: 65_536,
  maximumPackageBytes: 67_108_864,
  maximumPackageFiles: 256,
  maximumRecoverySteps: 64,
  maximumRelativePathBytes: 1_024,
});

export const MAPWORLD_RECOVERY_PROTOCOL_VERSION = 1 as const;

export type MapworldRecoveryRole = 'backup' | 'marker' | 'target' | 'temporary';
export type MapworldPackageRole = Exclude<MapworldRecoveryRole, 'marker'>;

export interface MapworldRecoveryError {
  readonly code: MapworldRecoveryCode;
  readonly message: string;
  readonly suggestedAction: string;
  readonly role?: MapworldRecoveryRole;
  readonly expectedFingerprint?: string | null;
  readonly actualFingerprint?: string | null;
  readonly diagnostics?: readonly PersistenceDiagnostic[];
}

export type MapworldRecoveryResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: MapworldRecoveryError };

export interface MapworldRecoveryArtifactNames {
  readonly targetName: string;
  readonly temporaryName: string;
  readonly backupName: string;
  readonly markerName: string;
}

export interface MapworldRecoveryMarker {
  readonly backupName: string;
  readonly candidateManifestSha256: string;
  readonly checksumAlgorithm: 'sha256';
  readonly operation: 'first-save' | 'replacement-save';
  readonly previousManifestSha256: string | null;
  readonly protocol: 'mapworld-directory-commit';
  readonly protocolVersion: typeof MAPWORLD_RECOVERY_PROTOCOL_VERSION;
  readonly targetName: string;
  readonly temporaryName: string;
}

export interface MapworldSavePlan {
  readonly operation: MapworldRecoveryMarker['operation'];
  readonly targetName: string;
  readonly artifactNames: MapworldRecoveryArtifactNames;
  readonly expectedPreviousManifestSha256: string | null;
  readonly candidateManifestSha256: string;
  readonly markerBytes: readonly number[];
  readonly files: readonly MapworldSavePlanFile[];
}

export interface MapworldSavePlanFile {
  readonly path: string;
  readonly bytes: readonly number[];
}

export type MapworldSaveIntent =
  | {
      readonly operation: 'first-save';
      readonly targetName: string;
      readonly previousManifestSha256: null;
    }
  | {
      readonly operation: 'replacement-save';
      readonly targetName: string;
      readonly previousManifestSha256: string;
    };

export type NativeMapworldObservedKind =
  | 'absent'
  | 'empty-directory'
  | 'directory'
  | 'invalid-directory'
  | 'regular-file'
  | 'symlink'
  | 'special'
  | 'unreadable';

export interface NativeMapworldOsContext {
  readonly primitive: string;
  readonly osErrorNumber: number | null;
  readonly osErrorName: string | null;
}

export interface ClassifiedMapworldPackageCandidate {
  readonly role: MapworldPackageRole;
  readonly observationToken: string;
  readonly observedKind: NativeMapworldObservedKind;
  readonly classification: 'absent' | 'empty' | 'valid' | 'invalid' | 'wrong-kind' | 'unreadable';
  readonly fingerprint?: string;
  /** `decodeMapworld` constructs this as a recursively frozen plain-data snapshot. */
  readonly document?: DeepReadonly<WorldDocument>;
  readonly diagnostics?: readonly PersistenceDiagnostic[];
  readonly osContext?: NativeMapworldOsContext;
}

export interface ClassifiedMapworldMarkerCandidate {
  readonly role: 'marker';
  readonly observationToken: string;
  readonly observedKind: NativeMapworldObservedKind;
  readonly classification:
    'absent' | 'valid' | 'invalid' | 'incompatible' | 'wrong-kind' | 'unreadable';
  readonly marker?: MapworldRecoveryMarker;
  readonly error?: MapworldRecoveryError;
  readonly osContext?: NativeMapworldOsContext;
}

export interface ClassifiedMapworldRecoverySnapshot {
  readonly targetName: string;
  readonly snapshotId: string;
  readonly target: ClassifiedMapworldPackageCandidate;
  readonly temporary: ClassifiedMapworldPackageCandidate;
  readonly backup: ClassifiedMapworldPackageCandidate;
  readonly marker: ClassifiedMapworldMarkerCandidate;
}

export type MapworldRecoveryStep =
  | 'sync-target-commit'
  | 'rename-temporary-to-target'
  | 'rename-target-to-backup'
  | 'remove-temporary-exact-candidate'
  | 'remove-temporary-empty'
  | 'remove-backup-exact-previous'
  | 'remove-backup-empty'
  | 'rename-backup-to-target'
  | 'remove-confirmed-target'
  | 'remove-confirmed-temporary'
  | 'remove-confirmed-backup'
  | 'remove-confirmed-marker'
  | 'remove-marker';

export interface MapworldRecoveryExpectedObservation {
  readonly role: MapworldRecoveryRole;
  readonly observationToken: string;
}

export interface MapworldRecoveryNativePlan {
  readonly snapshotId: string;
  readonly selectedRole: MapworldPackageRole | null;
  readonly selectedObservationToken: string | null;
  readonly selectedManifestSha256: string | null;
  readonly expectedObservations: readonly MapworldRecoveryExpectedObservation[];
  readonly steps: readonly MapworldRecoveryStep[];
  readonly confirmationTokens: readonly string[];
}

export type MapworldRecoveryConfirmation =
  | {
      readonly action: 'remove-artifact';
      readonly role: MapworldPackageRole;
      readonly observationToken: string;
      readonly fingerprint?: string;
    }
  | {
      readonly action: 'remove-marker';
      readonly role: 'marker';
      readonly observationToken: string;
    }
  | {
      readonly action: 'select-candidate';
      readonly role: MapworldPackageRole;
      readonly observationToken: string;
      readonly fingerprint: string;
    }
  | {
      readonly action: 'promote-candidate';
      readonly role: Exclude<MapworldPackageRole, 'target'>;
      readonly observationToken: string;
      readonly fingerprint: string;
      readonly invalidTargetObservationToken?: string;
    };

export interface MapworldRecoveryAttention {
  readonly code: MapworldRecoveryCode;
  readonly role: MapworldRecoveryRole;
  readonly observedKind: NativeMapworldObservedKind;
  readonly observationToken: string;
  readonly expectedFingerprint: string | null;
  readonly actualFingerprint: string | null;
  readonly diagnostics: readonly PersistenceDiagnostic[];
  readonly osContext?: NativeMapworldOsContext;
  readonly confirmations: readonly MapworldRecoveryConfirmation[];
}

export type MapworldRecoveryDecision =
  | {
      readonly kind: 'clean';
      readonly selected: ClassifiedMapworldPackageCandidate | null;
      readonly canSave: boolean;
    }
  | {
      readonly kind: 'apply';
      readonly selected: ClassifiedMapworldPackageCandidate | null;
      readonly plan: MapworldRecoveryNativePlan;
    }
  | {
      readonly kind: 'attention';
      readonly code: MapworldRecoveryCode;
      readonly selected: ClassifiedMapworldPackageCandidate | null;
      readonly canOpenReadOnly: boolean;
      readonly attention: readonly MapworldRecoveryAttention[];
    };

export type ReadonlyClassifiedMapworldRecoverySnapshot =
  DeepReadonly<ClassifiedMapworldRecoverySnapshot>;
