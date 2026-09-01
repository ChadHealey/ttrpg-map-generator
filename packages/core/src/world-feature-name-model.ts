/** Deterministic world-feature name-content contracts, validation, and generation. */

import type { AtlasGeographyRecords } from './atlas-geography-model.js';
import {
  type BehaviorVersion,
  createBehaviorVersion,
  createParameterSchemaVersion,
  createVariantRevision,
  incrementVariantRevision,
  type ParameterSchemaVersion,
  type VariantRevision,
} from './compatibility.js';
import { createDeterministicRandomStream } from './deterministic-random-stream.js';
import {
  type AspectReplacementProposal,
  type GenerationDiagnostic,
  type GenerationDiagnosticCode,
  parseAspectName,
  parseGenerationDiagnosticCode,
} from './generated-aspects.js';
import {
  type AspectId,
  deriveStableId,
  type EntityId,
  type MapId,
  parseGeneratorId,
  parseSemanticKey,
} from './identity.js';
import {
  DETERMINISTIC_STREAM_VERSION,
  SEED_DERIVATION_VERSION,
  type WorldSeed,
} from './seed-input.js';
import { WORLD_FEATURE_NAME_LEXICON_V1 } from './world-feature-name-lexicon.js';
import type { WorldPhysicalContextRecords } from './world-physical-context-model.js';

export type WorldFeatureNameKind =
  'landmass' | 'island-group' | 'water-body' | 'mountain-system' | 'watershed' | 'river' | 'lake';

export type WorldFeatureNameOrigin = 'generated' | 'manual-override';

export interface WorldFeatureNameLexicon {
  readonly version: BehaviorVersion;
  readonly firstWords: readonly string[];
  readonly secondWords: Readonly<Record<WorldFeatureNameKind, readonly string[]>>;
}

export interface WorldFeatureNameSource {
  readonly entityId: EntityId;
  readonly nameKind: WorldFeatureNameKind;
  readonly variantRevision: VariantRevision;
}

export interface WorldFeatureNameContent {
  readonly entityId: EntityId;
  readonly nameKind: WorldFeatureNameKind;
  readonly nameContentBehaviorVersion: BehaviorVersion;
  readonly lexiconVersion: BehaviorVersion;
  readonly variantRevision: VariantRevision;
  readonly origin: WorldFeatureNameOrigin;
  readonly displayName: string;
  readonly comparisonKey: string;
}

export interface WorldFeatureNameParameters {
  readonly parameterSchemaVersion: ParameterSchemaVersion;
  readonly lexiconVersion: BehaviorVersion;
  readonly nameContentBehaviorVersion: BehaviorVersion;
}

export type WorldFeatureNameProposal = AspectReplacementProposal<
  WorldFeatureNameParameters,
  WorldFeatureNameContent
>;

export interface CreateWorldFeatureNameProposalsInput {
  readonly mapId: MapId;
  readonly worldSeed: WorldSeed;
  readonly sources: readonly WorldFeatureNameSource[];
  /** Existing accepted manual overrides remain authoritative and reserve their comparison keys. */
  readonly manualOverrides?: readonly WorldFeatureNameContent[];
  /** Fixed accepted peers used to reject a manual override that would duplicate their name. */
  readonly acceptedPeerNames?: readonly WorldFeatureNameContent[];
  readonly lexicon?: WorldFeatureNameLexicon;
}

export interface RerollWorldFeatureNameInput {
  readonly mapId: MapId;
  readonly worldSeed: WorldSeed;
  readonly current: WorldFeatureNameContent;
  /** Accepted names for other entities; they are read-only collision constraints. */
  readonly otherNames: readonly WorldFeatureNameContent[];
  readonly lexicon?: WorldFeatureNameLexicon;
}

export type WorldFeatureNameGenerationResult =
  | {
      readonly ok: true;
      readonly proposals: readonly WorldFeatureNameProposal[];
      readonly retainedManualOverrides: readonly WorldFeatureNameContent[];
    }
  | { readonly ok: false; readonly diagnostics: readonly GenerationDiagnostic[] };

export const WORLD_FEATURE_NAME_ASPECT_NAME = required(parseAspectName('worldFeature.nameContent'));
export const WORLD_FEATURE_NAME_GENERATOR_ID = required(
  parseGeneratorId('worldFeature.nameContent'),
);
export const WORLD_FEATURE_NAME_BEHAVIOR_VERSION = required(createBehaviorVersion(1));
export const WORLD_FEATURE_NAME_PARAMETER_SCHEMA_VERSION = required(
  createParameterSchemaVersion(1),
);
export const WORLD_FEATURE_NAME_INITIAL_VARIANT_REVISION = required(createVariantRevision(0));
export const WORLD_FEATURE_NAME_DIAGNOSTIC_CODES = {
  duplicate: required(parseGenerationDiagnosticCode('world-feature-name.duplicate')),
  invalidContent: required(parseGenerationDiagnosticCode('world-feature-name.content.invalid')),
  manualReroll: required(parseGenerationDiagnosticCode('world-feature-name.manual-reroll')),
} as const;

const NAME_ASPECT_KEY = required(parseSemanticKey('world-feature-name-content'));
const ASCII_NAME_PATTERN =
  /^[A-Z][a-z]*(?: [A-Z][a-z]*)*(?: (?:I|II|III|IV|V|VI|VII|VIII|IX|X|L|C|D|M)+)?$/u;

/** Derive the entity-owned aspect identity without using display content or source ordering. */
export function deriveWorldFeatureNameAspectId(entityId: EntityId): AspectId {
  return deriveStableId('aspect', entityId, NAME_ASPECT_KEY);
}

/** Collect exactly the ADR-0024 eligible M2/M3 semantic entities in canonical entity-ID order. */
export function collectWorldFeatureNameSources(
  geography: AtlasGeographyRecords,
  physical: WorldPhysicalContextRecords,
): readonly WorldFeatureNameSource[] {
  if (geography.worldMapId !== physical.worldMapId) {
    throw new Error(
      'World-feature name sources require geography and physical records from one map.',
    );
  }
  const sources: WorldFeatureNameSource[] = [
    ...geography.landmasses.map((record) => source(record.entityId, 'landmass')),
    ...geography.islandGroups.map((record) => source(record.entityId, 'island-group')),
    ...geography.waterBodies.map((record) => source(record.entityId, 'water-body')),
    ...physical.mountainSystems.systems.map((record) => source(record.entityId, 'mountain-system')),
    ...physical.watersheds.watersheds.map((record) => source(record.entityId, 'watershed')),
    ...physical.majorRivers.map((record) => source(record.entityId, 'river')),
    ...physical.majorLakes.map((record) => source(record.entityId, 'lake')),
  ];
  const ordered = orderedSources(sources);
  if (ordered === undefined)
    throw new Error('Eligible world-feature sources must have unique valid IDs.');
  return ordered;
}

/** Return the exact ASCII comparison key; invalid names are rejected rather than normalized. */
export function parseWorldFeatureNameDisplayName(
  displayName: unknown,
): { readonly ok: true; readonly value: string } | { readonly ok: false } {
  return typeof displayName === 'string' && ASCII_NAME_PATTERN.test(displayName)
    ? { ok: true, value: displayName }
    : { ok: false };
}

/** Validate a standalone name-content record without coercing user-provided text. */
export function validateWorldFeatureNameContent(content: WorldFeatureNameContent): boolean {
  const parsed = parseWorldFeatureNameDisplayName(content.displayName);
  return (
    parsed.ok &&
    content.comparisonKey === comparisonKey(parsed.value) &&
    createBehaviorVersion(content.nameContentBehaviorVersion).ok &&
    createBehaviorVersion(content.lexiconVersion).ok &&
    createVariantRevision(content.variantRevision).ok &&
    isNameKind(content.nameKind)
  );
}

/** Generate an insertion-order-independent proposal for each non-manually-overridden source. */
export function createWorldFeatureNameProposals(
  input: CreateWorldFeatureNameProposalsInput,
): WorldFeatureNameGenerationResult {
  const lexicon = input.lexicon ?? WORLD_FEATURE_NAME_LEXICON_V1;
  const invalid = validateLexicon(lexicon);
  if (invalid !== undefined) return invalidResult(input.sources, invalid);

  const sources = orderedSources(input.sources);
  if (sources === undefined)
    return invalidResult(input.sources, 'Name sources are duplicated or invalid.');
  const sourceByEntity = new Map(sources.map((source) => [source.entityId, source] as const));
  const peers = input.acceptedPeerNames ?? [];
  if (peers.some((content) => !validateWorldFeatureNameContent(content))) {
    return invalidResult(sources, 'Accepted peer name content is invalid.');
  }
  const duplicatePeers = duplicateContent(peers);
  if (duplicatePeers !== undefined) return duplicateResult(duplicatePeers);

  const manualByEntity = new Map<EntityId, WorldFeatureNameContent>();
  for (const content of input.manualOverrides ?? []) {
    if (!validateWorldFeatureNameContent(content) || content.origin !== 'manual-override') {
      return invalidResult(input.sources, 'Manual name content is invalid.');
    }
    const source = sourceByEntity.get(content.entityId);
    if (
      source?.nameKind !== content.nameKind ||
      source.variantRevision !== content.variantRevision
    ) {
      return invalidResult(
        sources,
        'Manual name content does not match one selected source revision and kind.',
      );
    }
    const collidingPeer = peers.find(
      (peer) =>
        peer.entityId !== content.entityId &&
        peer.nameKind === content.nameKind &&
        peer.comparisonKey === content.comparisonKey,
    );
    if (collidingPeer !== undefined) return duplicateResult(content);
    if (manualByEntity.has(content.entityId))
      return invalidResult(input.sources, 'Manual name content repeats an entity.');
    manualByEntity.set(content.entityId, content);
  }
  const duplicateManual = duplicateContent([...manualByEntity.values()]);
  if (duplicateManual !== undefined) return duplicateResult(duplicateManual);

  const sourceEntityIds = new Set(sources.map(({ entityId }) => entityId));
  const claimed = claimedKeysByKind(peers.filter(({ entityId }) => !sourceEntityIds.has(entityId)));
  for (const content of manualByEntity.values()) {
    const claims = claimed.get(content.nameKind) ?? new Set<string>();
    claims.add(content.comparisonKey);
    claimed.set(content.nameKind, claims);
  }
  const proposals: WorldFeatureNameProposal[] = [];
  const retainedManualOverrides: WorldFeatureNameContent[] = [];
  for (const source of sources) {
    const manual = manualByEntity.get(source.entityId);
    if (manual !== undefined) {
      retainedManualOverrides.push(manual);
      continue;
    }
    const claims = claimed.get(source.nameKind) ?? new Set<string>();
    claimed.set(source.nameKind, claims);
    const generated = generateAvailableContent(
      input.mapId,
      input.worldSeed,
      source,
      claims,
      lexicon,
    );
    if (!generated.ok) return generated;
    claims.add(generated.value.comparisonKey);
    proposals.push(proposalFromContent(input.mapId, input.worldSeed, source, generated.value));
  }
  return {
    ok: true,
    proposals: Object.freeze(proposals),
    retainedManualOverrides: Object.freeze(retainedManualOverrides),
  };
}

/** Reroll one generated name against fixed accepted peers without modifying those peers. */
export function rerollWorldFeatureName(
  input: RerollWorldFeatureNameInput,
): WorldFeatureNameGenerationResult {
  if (!validateWorldFeatureNameContent(input.current))
    return invalidResult([], 'Current name content is invalid.');
  const source: WorldFeatureNameSource = {
    entityId: input.current.entityId,
    nameKind: input.current.nameKind,
    variantRevision: input.current.variantRevision,
  };
  if (input.current.origin === 'manual-override') {
    return {
      ok: false,
      diagnostics: Object.freeze([
        diagnostic(
          source,
          WORLD_FEATURE_NAME_DIAGNOSTIC_CODES.manualReroll,
          'Manual overrides cannot be rerolled.',
          'Clear the manual override before generating a new name.',
        ),
      ]),
    };
  }
  const next = incrementVariantRevision(input.current.variantRevision);
  if (!next.ok) return invalidResult([source], next.diagnostic.message);
  const peers = input.otherNames.filter(({ entityId }) => entityId !== input.current.entityId);
  if (peers.some((content) => !validateWorldFeatureNameContent(content))) {
    return invalidResult([source], 'One or more accepted peer names are invalid.');
  }
  const duplicate = duplicateContent(peers);
  if (duplicate !== undefined) return duplicateResult(duplicate);
  const lexicon = input.lexicon ?? WORLD_FEATURE_NAME_LEXICON_V1;
  const invalid = validateLexicon(lexicon);
  if (invalid !== undefined) return invalidResult([source], invalid);
  const rerolled: WorldFeatureNameSource = { ...source, variantRevision: next.value };
  const generated = generateAvailableContent(
    input.mapId,
    input.worldSeed,
    rerolled,
    claimedKeys(peers.filter(({ nameKind }) => nameKind === rerolled.nameKind)),
    lexicon,
  );
  if (!generated.ok) return generated;
  return {
    ok: true,
    proposals: Object.freeze([
      proposalFromContent(input.mapId, input.worldSeed, rerolled, generated.value),
    ]),
    retainedManualOverrides: Object.freeze([]),
  };
}

type GenerateAvailableResult =
  | { readonly ok: true; readonly value: WorldFeatureNameContent }
  | { readonly ok: false; readonly diagnostics: readonly GenerationDiagnostic[] };

function generateAvailableContent(
  mapId: MapId,
  worldSeed: WorldSeed,
  source: WorldFeatureNameSource,
  claimed: Set<string>,
  lexicon: WorldFeatureNameLexicon,
): GenerateAvailableResult {
  const stream = createDeterministicRandomStream(seedMetadata(mapId, worldSeed, source));
  if (!stream.ok) return invalidResult([source], stream.diagnostic.message);
  let finalBase: string | undefined;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const displayName = candidateName(source.nameKind, stream.value, lexicon);
    finalBase = displayName;
    const key = comparisonKey(displayName);
    if (!claimed.has(key))
      return { ok: true, value: generatedContent(source, displayName, lexicon) };
  }
  if (finalBase === undefined)
    return invalidResult([source], 'Name candidate generation is empty.');
  let ordinal = 2;
  let displayName: string;
  do {
    displayName = `${finalBase} ${romanNumeral(ordinal)}`;
    ordinal += 1;
  } while (claimed.has(comparisonKey(displayName)));
  return { ok: true, value: generatedContent(source, displayName, lexicon) };
}

function proposalFromContent(
  mapId: MapId,
  worldSeed: WorldSeed,
  source: WorldFeatureNameSource,
  content: WorldFeatureNameContent,
): WorldFeatureNameProposal {
  const seed = seedMetadata(mapId, worldSeed, source);
  return Object.freeze({
    status: 'proposed',
    target: Object.freeze({
      mapId,
      entityId: source.entityId,
      aspect: Object.freeze({ aspectId: deriveWorldFeatureNameAspectId(source.entityId) }),
      aspectName: WORLD_FEATURE_NAME_ASPECT_NAME,
      variantRevision: source.variantRevision,
    }),
    generatorId: WORLD_FEATURE_NAME_GENERATOR_ID,
    generatorVersion: WORLD_FEATURE_NAME_BEHAVIOR_VERSION,
    parameterSchemaVersion: WORLD_FEATURE_NAME_PARAMETER_SCHEMA_VERSION,
    parameters: Object.freeze({
      parameterSchemaVersion: WORLD_FEATURE_NAME_PARAMETER_SCHEMA_VERSION,
      lexiconVersion: content.lexiconVersion,
      nameContentBehaviorVersion: content.nameContentBehaviorVersion,
    }),
    seedScope: 'map/entity',
    seedMetadata: seed,
    dependencyAspects: Object.freeze([]),
    output: Object.freeze(content),
    diagnostics: Object.freeze([]),
  });
}

function seedMetadata(mapId: MapId, worldSeed: WorldSeed, source: WorldFeatureNameSource) {
  return Object.freeze({
    seedDerivationVersion: SEED_DERIVATION_VERSION,
    deterministicStreamVersion: DETERMINISTIC_STREAM_VERSION,
    seedScope: 'map/entity' as const,
    worldSeed,
    mapId,
    entityId: source.entityId,
    generatorId: WORLD_FEATURE_NAME_GENERATOR_ID,
    generatorVersion: WORLD_FEATURE_NAME_BEHAVIOR_VERSION,
    aspectName: WORLD_FEATURE_NAME_ASPECT_NAME,
    variantRevision: source.variantRevision,
  });
}

function generatedContent(
  source: WorldFeatureNameSource,
  displayName: string,
  lexicon: WorldFeatureNameLexicon,
): WorldFeatureNameContent {
  return Object.freeze({
    entityId: source.entityId,
    nameKind: source.nameKind,
    nameContentBehaviorVersion: WORLD_FEATURE_NAME_BEHAVIOR_VERSION,
    lexiconVersion: lexicon.version,
    variantRevision: source.variantRevision,
    origin: 'generated',
    displayName,
    comparisonKey: comparisonKey(displayName),
  });
}

function source(entityId: EntityId, nameKind: WorldFeatureNameKind): WorldFeatureNameSource {
  return Object.freeze({
    entityId,
    nameKind,
    variantRevision: WORLD_FEATURE_NAME_INITIAL_VARIANT_REVISION,
  });
}

function candidateName(
  kind: WorldFeatureNameKind,
  stream: { readonly nextInt: (maxExclusive: number) => number },
  lexicon: WorldFeatureNameLexicon,
): string {
  const first = lexicon.firstWords[stream.nextInt(lexicon.firstWords.length)];
  const words = lexicon.secondWords[kind];
  const second = words[stream.nextInt(words.length)];
  return `${titleCase(first ?? '')} ${titleCase(second ?? '')}`;
}

function orderedSources(
  sources: readonly WorldFeatureNameSource[],
): readonly WorldFeatureNameSource[] | undefined {
  if (
    sources.some(
      ({ nameKind, variantRevision }) =>
        !isNameKind(nameKind) || !createVariantRevision(variantRevision).ok,
    )
  ) {
    return undefined;
  }
  const ordered = [...sources].sort((left, right) =>
    left.entityId < right.entityId ? -1 : left.entityId > right.entityId ? 1 : 0,
  );
  return ordered.some((source, index) => source.entityId === ordered[index - 1]?.entityId)
    ? undefined
    : Object.freeze(ordered);
}

function duplicateContent(
  contents: readonly WorldFeatureNameContent[],
): WorldFeatureNameContent | undefined {
  const claimed = new Set<string>();
  for (const content of contents) {
    const key = `${content.nameKind}\0${content.comparisonKey}`;
    if (claimed.has(key)) return content;
    claimed.add(key);
  }
  return undefined;
}

function claimedKeys(contents: Iterable<WorldFeatureNameContent>): Set<string> {
  return new Set([...contents].map(({ comparisonKey }) => comparisonKey));
}

function claimedKeysByKind(
  contents: Iterable<WorldFeatureNameContent>,
): Map<WorldFeatureNameKind, Set<string>> {
  const result = new Map<WorldFeatureNameKind, Set<string>>();
  for (const content of contents) {
    const claims = result.get(content.nameKind) ?? new Set<string>();
    claims.add(content.comparisonKey);
    result.set(content.nameKind, claims);
  }
  return result;
}

function duplicateResult(content: WorldFeatureNameContent): WorldFeatureNameGenerationResult {
  const source: WorldFeatureNameSource = {
    entityId: content.entityId,
    nameKind: content.nameKind,
    variantRevision: content.variantRevision,
  };
  return {
    ok: false,
    diagnostics: Object.freeze([
      diagnostic(
        source,
        WORLD_FEATURE_NAME_DIAGNOSTIC_CODES.duplicate,
        'A manual name override duplicates an accepted name in its uniqueness domain.',
        'Choose a distinct ASCII display name for the manual override.',
      ),
    ]),
  };
}

function invalidResult(
  sources: readonly WorldFeatureNameSource[],
  message: string,
): { readonly ok: false; readonly diagnostics: readonly GenerationDiagnostic[] } {
  const fallback: WorldFeatureNameSource = sources[0] ?? {
    entityId: '' as EntityId,
    nameKind: 'landmass',
    variantRevision: WORLD_FEATURE_NAME_INITIAL_VARIANT_REVISION,
  };
  return {
    ok: false,
    diagnostics: Object.freeze([
      diagnostic(
        fallback,
        WORLD_FEATURE_NAME_DIAGNOSTIC_CODES.invalidContent,
        message,
        'Correct the name-content inputs and regenerate the complete batch.',
      ),
    ]),
  };
}

function diagnostic(
  source: WorldFeatureNameSource,
  code: GenerationDiagnosticCode,
  message: string,
  suggestedAction: string,
): GenerationDiagnostic {
  return Object.freeze({
    code,
    severity: 'error',
    target: Object.freeze({ aspectId: deriveWorldFeatureNameAspectId(source.entityId) }),
    message,
    suggestedAction,
  });
}

function validateLexicon(lexicon: WorldFeatureNameLexicon): string | undefined {
  const requiredKinds: readonly WorldFeatureNameKind[] = [
    'landmass',
    'island-group',
    'water-body',
    'mountain-system',
    'watershed',
    'river',
    'lake',
  ];
  if (
    !createBehaviorVersion(lexicon.version).ok ||
    lexicon.firstWords.length === 0 ||
    requiredKinds.some((kind) => lexicon.secondWords[kind].length === 0)
  ) {
    return 'Name lexicon version or first-word set is invalid.';
  }
  const words = [
    ...lexicon.firstWords,
    ...Object.values(lexicon.secondWords).flatMap((values) => values),
  ];
  return words.length === 0 || words.some((word) => !/^[a-z]+$/u.test(word))
    ? 'Name lexicon tokens must be non-empty lowercase ASCII words.'
    : undefined;
}

function comparisonKey(displayName: string): string {
  return displayName.replace(/[A-Z]/gu, (value) => value.toLowerCase());
}

function titleCase(value: string): string {
  return `${value[0]?.toUpperCase() ?? ''}${value.slice(1)}`;
}

function romanNumeral(value: number): string {
  const table: readonly [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let remaining = value;
  let result = '';
  for (const [amount, glyph] of table) {
    while (remaining >= amount) {
      result += glyph;
      remaining -= amount;
    }
  }
  return result;
}

function isNameKind(value: unknown): value is WorldFeatureNameKind {
  return (
    value === 'landmass' ||
    value === 'island-group' ||
    value === 'water-body' ||
    value === 'mountain-system' ||
    value === 'watershed' ||
    value === 'river' ||
    value === 'lake'
  );
}

function required<Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false },
): Value {
  if (!result.ok) throw new Error('Internal world-feature name contract constant is invalid.');
  return result.value;
}
