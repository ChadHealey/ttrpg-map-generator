/**
 * Stable identity primitives shared by domain and boundary contracts.
 *
 * This module owns identity syntax and derivation only. It does not create ambient randomness,
 * define persistence schemas, or derive generation seeds.
 */

import { deriveUuidV5 } from './uuid-v5.js';

declare const STABLE_UUID_ID_BRAND: unique symbol;
declare const GENERATOR_ID_BRAND: unique symbol;
declare const SEMANTIC_KEY_BRAND: unique symbol;

type StableUuidId<Kind extends StableIdKind> = string & {
  readonly [STABLE_UUID_ID_BRAND]: Kind;
};

/** Stable identity of the complete persisted world document. */
export type WorldDocumentId = StableUuidId<'world-document'>;

/** Stable identity of a scale-specific map document. */
export type MapId = StableUuidId<'map'>;

/** Stable identity of a meaningful entity owned by a map. */
export type EntityId = StableUuidId<'entity'>;

/** Stable identity of an independently generated aspect record. */
export type AspectId = StableUuidId<'aspect'>;

/** Stable identity of a user-authored generation constraint. */
export type ConstraintId = StableUuidId<'constraint'>;

/** Stable identity of user intent that protects accepted output from regeneration. */
export type LockId = StableUuidId<'lock'>;

/** Stable identity shared by records that describe one map-boundary crossing. */
export type BoundaryPortalId = StableUuidId<'boundary-portal'>;

/** A validated symbolic generator identifier such as `proof.outline`. */
export type GeneratorId = string & { readonly [GENERATOR_ID_BRAND]: true };

/** A validated, compatibility-sensitive key used to identify a generated subfeature. */
export type SemanticKey = string & { readonly [SEMANTIC_KEY_BRAND]: true };

export type StableIdKind =
  'world-document' | 'map' | 'entity' | 'aspect' | 'constraint' | 'lock' | 'boundary-portal';

export interface StableIdByKind {
  readonly 'world-document': WorldDocumentId;
  readonly map: MapId;
  readonly entity: EntityId;
  readonly aspect: AspectId;
  readonly constraint: ConstraintId;
  readonly lock: LockId;
  readonly 'boundary-portal': BoundaryPortalId;
}

/** UUID-backed and symbolic identities that have deterministic canonical text encodings. */
export type StableReference = StableIdByKind[StableIdKind] | GeneratorId;

export type IdentityDiagnosticCode =
  | 'identity.expected-string'
  | 'identity.invalid-uuid'
  | 'identity.noncanonical-uuid'
  | 'identity.nil-uuid'
  | 'identity.invalid-generator-id'
  | 'identity.invalid-semantic-key';

/** A boundary-safe identity failure with a stable machine-readable code. */
export interface IdentityDiagnostic {
  readonly code: IdentityDiagnosticCode;
  readonly subject: StableIdKind | 'generator' | 'semantic-key';
  readonly message: string;
}

export type IdentityParseResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly diagnostic: IdentityDiagnostic };

/** An explicit source for user-created or imported UUID identity. */
export interface StableIdSource {
  readonly nextUuid: (kind: StableIdKind) => unknown;
}

const CANONICAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UUID_PATTERN_CASE_INSENSITIVE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERATOR_ID_PATTERN = /^[a-z](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z](?:[a-z0-9-]*[a-z0-9])?)+$/;
const SEMANTIC_KEY_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const MAX_SYMBOLIC_ID_LENGTH = 128;
const DERIVATION_PREFIX = 'ttrpg-map/stable-id/v1';
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

/** Parse unknown input as one of the UUID-backed record IDs without coercion. */
export function parseStableId<Kind extends StableIdKind>(
  kind: Kind,
  input: unknown,
): IdentityParseResult<StableIdByKind[Kind]> {
  if (typeof input !== 'string') {
    return failure(
      'identity.expected-string',
      kind,
      `Expected ${kind} ID to be a canonical UUID string; received ${describeValue(input)}.`,
    );
  }

  if (!CANONICAL_UUID_PATTERN.test(input)) {
    if (UUID_PATTERN_CASE_INSENSITIVE.test(input)) {
      return failure(
        'identity.noncanonical-uuid',
        kind,
        `Expected ${kind} ID to use lowercase UUID text; use "${input.toLowerCase()}".`,
      );
    }

    return failure(
      'identity.invalid-uuid',
      kind,
      `Expected ${kind} ID in 8-4-4-4-12 lowercase UUID form.`,
    );
  }

  if (input === NIL_UUID) {
    return failure(
      'identity.nil-uuid',
      kind,
      `Expected ${kind} ID to identify a record; the nil UUID is reserved and cannot be used.`,
    );
  }

  return { ok: true, value: input as StableIdByKind[Kind] };
}

/** Parse an unknown symbolic generator ID such as `proof.outline`. */
export function parseGeneratorId(input: unknown): IdentityParseResult<GeneratorId> {
  if (typeof input !== 'string') {
    return failure(
      'identity.expected-string',
      'generator',
      `Expected generator ID to be a string; received ${describeValue(input)}.`,
    );
  }

  if (input.length > MAX_SYMBOLIC_ID_LENGTH || !GENERATOR_ID_PATTERN.test(input)) {
    return failure(
      'identity.invalid-generator-id',
      'generator',
      'Expected generator ID to contain two or more lowercase dot-separated segments; every segment begins with a lowercase letter and otherwise uses letters, digits, or internal hyphens (maximum 128 characters).',
    );
  }

  return { ok: true, value: input as GeneratorId };
}

/** Parse an unknown generated-subfeature key without normalization or coercion. */
export function parseSemanticKey(input: unknown): IdentityParseResult<SemanticKey> {
  if (typeof input !== 'string') {
    return failure(
      'identity.expected-string',
      'semantic-key',
      `Expected semantic key to be a string; received ${describeValue(input)}.`,
    );
  }

  if (input.length > MAX_SYMBOLIC_ID_LENGTH || !SEMANTIC_KEY_PATTERN.test(input)) {
    return failure(
      'identity.invalid-semantic-key',
      'semantic-key',
      'Expected semantic key to be 1–128 lowercase ASCII letters or digits separated by single dots, underscores, or hyphens.',
    );
  }

  return { ok: true, value: input as SemanticKey };
}

/** Request a new UUID from an injected source and validate its canonical representation. */
export function createStableId<Kind extends StableIdKind>(
  kind: Kind,
  source: StableIdSource,
): IdentityParseResult<StableIdByKind[Kind]> {
  return parseStableId(kind, source.nextUuid(kind));
}

/**
 * Derive a generated-subfeature ID with RFC UUIDv5 from its stable parent and semantic key.
 * The target kind is part of the name so distinct identity domains cannot collide.
 */
export function deriveStableId<Kind extends StableIdKind>(
  kind: Kind,
  parentId: StableIdByKind[StableIdKind],
  semanticKey: SemanticKey,
): StableIdByKind[Kind] {
  const name = `${DERIVATION_PREFIX}/${kind}/${semanticKey}`;
  return deriveUuidV5(parentId, name) as StableIdByKind[Kind];
}

/** Return the canonical persisted representation of a stable reference. */
export function encodeStableReference(reference: StableReference): string {
  return reference;
}

/** Compare references by their canonical ASCII encoding. */
export function compareStableReferences<Reference extends StableReference>(
  left: Reference,
  right: NoInfer<Reference>,
): -1 | 0 | 1 {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

/** Test reference equality without accepting a different branded identity kind. */
export function stableReferencesEqual<Reference extends StableReference>(
  left: Reference,
  right: NoInfer<Reference>,
): boolean {
  return left === right;
}

function failure(
  code: IdentityDiagnosticCode,
  subject: IdentityDiagnostic['subject'],
  message: string,
): IdentityParseResult<never> {
  return { ok: false, diagnostic: { code, subject, message } };
}

function describeValue(input: unknown): string {
  if (input === null) {
    return 'null';
  }
  if (Array.isArray(input)) {
    return 'array';
  }
  return typeof input;
}
