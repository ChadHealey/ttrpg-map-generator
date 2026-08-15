import type { DeepReadonly } from '@ttrpg-map/core';

export const MAPWORLD_PACKAGE_VERSION = 1 as const;
export const MAPWORLD_SCHEMA_VERSION = 1 as const;
export const WORLD_INDEX_SCHEMA_VERSION = 1 as const;
export const MAP_DOCUMENT_SCHEMA_VERSION = 1 as const;
export const ACCEPTED_ASPECT_SCHEMA_VERSION = 1 as const;

export const MAPWORLD_APPLICATION_COMPATIBILITY = Object.freeze({
  minimumVersion: '0.1.0',
  maximumVersionExclusive: '0.2.0',
});

export const MAPWORLD_CHECKSUM_ALGORITHM = 'sha256' as const;

export const PERSISTENCE_DIAGNOSTIC_CODES = {
  checksumMismatch: 'persistence.checksum.mismatch',
  dependencyInvalid: 'persistence.dependency.invalid',
  fileDuplicate: 'persistence.file.duplicate',
  fileMissing: 'persistence.file.missing',
  filePathInvalid: 'persistence.file.path-invalid',
  fileUnexpected: 'persistence.file.unexpected',
  immutableSnapshotInvalid: 'persistence.snapshot.invalid',
  jsonMalformed: 'persistence.json.malformed',
  jsonNoncanonical: 'persistence.json.noncanonical',
  jsonUtf8Invalid: 'persistence.json.utf8-invalid',
  ownershipInvalid: 'persistence.ownership.invalid',
  proofInvalid: 'persistence.proof.invalid',
  referenceInvalid: 'persistence.reference.invalid',
  schemaInvalid: 'persistence.schema.invalid',
  seedInvalid: 'persistence.seed.invalid',
  versionIncompatible: 'persistence.version.incompatible',
} as const;

export type PersistenceDiagnosticCode =
  (typeof PERSISTENCE_DIAGNOSTIC_CODES)[keyof typeof PERSISTENCE_DIAGNOSTIC_CODES];

/** Stable, actionable failure at a package, file, or JSON field boundary. */
export interface PersistenceDiagnostic {
  readonly code: PersistenceDiagnosticCode;
  readonly filePath: string;
  readonly fieldPath: string;
  readonly message: string;
  readonly suggestedAction: string;
}

export type PersistenceResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly diagnostics: readonly PersistenceDiagnostic[] };

/** One normalized package-relative file represented without filesystem ownership. */
export interface MapworldPackageFile {
  readonly path: string;
  readonly bytes: Uint8Array;
}

/** Complete in-memory v1 package; atomic filesystem replacement belongs to issue #46. */
export interface MapworldPackage {
  readonly files: readonly MapworldPackageFile[];
}

export type CanonicalJsonPrimitive = null | boolean | number | string;
export type CanonicalJsonValue =
  | CanonicalJsonPrimitive
  | readonly CanonicalJsonValue[]
  | { readonly [key: string]: CanonicalJsonValue };

export type ReadonlyMapworldPackage = DeepReadonly<MapworldPackage>;
