/** Validated, closed seed namespaces and canonical unsigned-64 world seeds. */

import {
  type BehaviorVersion,
  type DeterministicStreamVersion,
  parseBehaviorVersion,
  parseDeterministicStreamVersion,
  parseSeedDerivationVersion,
  parseVariantRevision,
  type SeedDerivationVersion,
  type VariantRevision,
} from './compatibility.js';
import { parsePlanetPoint, type PlanetPoint } from './coordinates.js';
import { type AspectName, parseAspectName, type SeedScope } from './generated-aspects.js';
import {
  type BoundaryPortalId,
  type EntityId,
  type GeneratorId,
  type MapId,
  parseGeneratorId,
  parseStableId,
  type RootSurfaceId,
} from './identity.js';

declare const WORLD_SEED_BRAND: unique symbol;

/** An unsigned 64-bit world seed represented exactly in memory. */
export type WorldSeed = bigint & { readonly [WORLD_SEED_BRAND]: true };

export const SEED_DERIVATION_VERSION = 1 as SeedDerivationVersion;
export const DETERMINISTIC_STREAM_VERSION = 1 as DeterministicStreamVersion;
export const WORLD_SEED_MAX = (1n << 64n) - 1n;

interface CommonSeedInput {
  readonly seedDerivationVersion: SeedDerivationVersion;
  readonly deterministicStreamVersion: DeterministicStreamVersion;
  readonly worldSeed: WorldSeed;
  readonly generatorId: GeneratorId;
  readonly generatorVersion: BehaviorVersion;
  readonly aspectName: AspectName;
  readonly variantRevision: VariantRevision;
}

/** Complete independent namespace for one map-owned entity aspect. */
export interface MapEntitySeedInput extends CommonSeedInput {
  readonly seedScope: 'map/entity';
  readonly mapId: MapId;
  readonly entityId: EntityId;
}

/** Complete physical namespace shared at one canonical root-surface point. */
export interface RootCoordinateSeedInput extends CommonSeedInput {
  readonly seedScope: 'root-coordinate';
  readonly rootSurfaceId: RootSurfaceId;
  readonly point: PlanetPoint;
}

/** Complete namespace shared by every context that refers to one boundary portal. */
export interface SharedBoundarySeedInput extends CommonSeedInput {
  readonly seedScope: 'shared-boundary';
  readonly boundaryPortalId: BoundaryPortalId;
}

/** Exactly one validated seed namespace accepted by versioned derivation. */
export type SeedInput = MapEntitySeedInput | RootCoordinateSeedInput | SharedBoundarySeedInput;

export const SEED_INPUT_DIAGNOSTIC_CODES = {
  invalidWorldSeed: 'seed.world-seed.invalid',
  invalidRecord: 'seed.input.invalid-record',
  invalidScope: 'seed.input.invalid-scope',
  invalidFields: 'seed.input.invalid-fields',
  invalidField: 'seed.input.invalid-field',
} as const;

export type SeedInputDiagnosticCode =
  (typeof SEED_INPUT_DIAGNOSTIC_CODES)[keyof typeof SEED_INPUT_DIAGNOSTIC_CODES];

/** A stable boundary finding for a world seed or complete seed namespace. */
export interface SeedInputDiagnostic {
  readonly code: SeedInputDiagnosticCode;
  readonly message: string;
  readonly field?: string;
}

export type SeedInputParseResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly diagnostic: SeedInputDiagnostic };

type UnknownRecord = Readonly<Record<string, unknown>>;

const COMMON_FIELDS = [
  'seedDerivationVersion',
  'deterministicStreamVersion',
  'seedScope',
  'worldSeed',
  'generatorId',
  'generatorVersion',
  'aspectName',
  'variantRevision',
] as const;

/** Parse the only canonical external form of an unsigned 64-bit world seed. */
export function parseWorldSeed(input: unknown): SeedInputParseResult<WorldSeed> {
  if (typeof input !== 'string' || !/^(?:0|[1-9][0-9]*)$/u.test(input)) {
    return failure(
      SEED_INPUT_DIAGNOSTIC_CODES.invalidWorldSeed,
      'World seed must be a canonical base-10 unsigned 64-bit integer string.',
    );
  }

  const value = BigInt(input);
  if (value > WORLD_SEED_MAX) {
    return failure(
      SEED_INPUT_DIAGNOSTIC_CODES.invalidWorldSeed,
      `World seed must be at most ${WORLD_SEED_MAX.toString(10)}.`,
    );
  }
  return { ok: true, value: value as WorldSeed };
}

/** Return the unique persisted decimal form of an already validated world seed. */
export function formatWorldSeed(worldSeed: WorldSeed): string {
  return worldSeed.toString(10);
}

/** Validate a complete scope-specific seed namespace without normalizing any field. */
export function parseSeedInput(input: unknown): SeedInputParseResult<SeedInput> {
  if (!isUnknownRecord(input)) {
    return failure(
      SEED_INPUT_DIAGNOSTIC_CODES.invalidRecord,
      'Seed input must be an object containing one complete validated seed namespace.',
    );
  }

  const seedScope = input.seedScope;
  if (!isSeedScope(seedScope)) {
    return failure(
      SEED_INPUT_DIAGNOSTIC_CODES.invalidScope,
      'Seed scope must be "map/entity", "root-coordinate", or "shared-boundary".',
      'seedScope',
    );
  }

  const scopeFields =
    seedScope === 'map/entity'
      ? ['mapId', 'entityId']
      : seedScope === 'root-coordinate'
        ? ['rootSurfaceId', 'point']
        : ['boundaryPortalId'];
  if (!hasExactFields(input, [...COMMON_FIELDS, ...scopeFields])) {
    return failure(
      SEED_INPUT_DIAGNOSTIC_CODES.invalidFields,
      `Seed input for ${seedScope} must contain exactly its declared common and scope-specific fields.`,
    );
  }

  const seedDerivationVersion = fieldValue(
    'seedDerivationVersion',
    parseSeedDerivationVersion(input.seedDerivationVersion),
  );
  if (!seedDerivationVersion.ok) return seedDerivationVersion;
  const deterministicStreamVersion = fieldValue(
    'deterministicStreamVersion',
    parseDeterministicStreamVersion(input.deterministicStreamVersion),
  );
  if (!deterministicStreamVersion.ok) return deterministicStreamVersion;
  const worldSeed = fieldValue('worldSeed', parseWorldSeed(input.worldSeed));
  if (!worldSeed.ok) return worldSeed;
  const generatorId = fieldValue('generatorId', parseGeneratorId(input.generatorId));
  if (!generatorId.ok) return generatorId;
  const generatorVersion = fieldValue(
    'generatorVersion',
    parseBehaviorVersion(input.generatorVersion),
  );
  if (!generatorVersion.ok) return generatorVersion;
  const aspectName = fieldValue('aspectName', parseAspectName(input.aspectName));
  if (!aspectName.ok) return aspectName;
  const variantRevision = fieldValue(
    'variantRevision',
    parseVariantRevision(input.variantRevision),
  );
  if (!variantRevision.ok) return variantRevision;

  const common = {
    seedDerivationVersion: seedDerivationVersion.value,
    deterministicStreamVersion: deterministicStreamVersion.value,
    worldSeed: worldSeed.value,
    generatorId: generatorId.value,
    generatorVersion: generatorVersion.value,
    aspectName: aspectName.value,
    variantRevision: variantRevision.value,
  };
  if (seedScope === 'map/entity') {
    const mapId = fieldValue('mapId', parseStableId('map', input.mapId));
    if (!mapId.ok) return mapId;
    const entityId = fieldValue('entityId', parseStableId('entity', input.entityId));
    if (!entityId.ok) return entityId;
    return {
      ok: true,
      value: Object.freeze({ ...common, seedScope, mapId: mapId.value, entityId: entityId.value }),
    };
  }
  if (seedScope === 'root-coordinate') {
    const rootSurfaceId = fieldValue(
      'rootSurfaceId',
      parseStableId('root-surface', input.rootSurfaceId),
    );
    if (!rootSurfaceId.ok) return rootSurfaceId;
    const point = fieldValue('point', parsePlanetPoint(input.point));
    if (!point.ok) return point;
    return {
      ok: true,
      value: Object.freeze({
        ...common,
        seedScope,
        rootSurfaceId: rootSurfaceId.value,
        point: point.value,
      }),
    };
  }

  const boundaryPortalId = fieldValue(
    'boundaryPortalId',
    parseStableId('boundary-portal', input.boundaryPortalId),
  );
  if (!boundaryPortalId.ok) return boundaryPortalId;
  return {
    ok: true,
    value: Object.freeze({ ...common, seedScope, boundaryPortalId: boundaryPortalId.value }),
  };
}

function fieldValue<Value>(
  field: string,
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly diagnostic: { readonly message: string } },
): SeedInputParseResult<Value> {
  return result.ok
    ? result
    : failure(
        SEED_INPUT_DIAGNOSTIC_CODES.invalidField,
        `Invalid seed input field ${field}: ${result.diagnostic.message}`,
        field,
      );
}

function failure<Value>(
  code: SeedInputDiagnosticCode,
  message: string,
  field?: string,
): SeedInputParseResult<Value> {
  return {
    ok: false,
    diagnostic: field === undefined ? { code, message } : { code, message, field },
  };
}

function isUnknownRecord(input: unknown): input is UnknownRecord {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function hasExactFields(input: UnknownRecord, expectedFields: readonly string[]): boolean {
  const actualFields = Object.keys(input).sort();
  const sortedExpected = [...expectedFields].sort();
  return (
    actualFields.length === sortedExpected.length &&
    actualFields.every((field, index) => field === sortedExpected[index])
  );
}

function isSeedScope(input: unknown): input is SeedScope {
  return input === 'map/entity' || input === 'root-coordinate' || input === 'shared-boundary';
}
