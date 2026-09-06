/** Private proposed generator-3 concern registry; no accepted entities are allocated. */
import {
  createDeterministicRandomStream,
  deriveAtlasSingletonEntityIds,
  deriveSeed,
  encodeSeedInput,
  type MapEntitySeedInput,
  parseSeedInput,
  parseStableId,
  validateSeedInputEncodingV1,
} from '@ttrpg-map/core';

export const REGISTRY_VERSION = 'issue-185-registry-r1';
export const PREFIX = 'worldTerrain.macroElevation.v3';
export const LIMITS = Object.freeze({
  owners: 8,
  candidates: 16,
  islands: 4,
  archipelagoMembers: 7,
  attempts: 64,
});
export interface Authority {
  readonly worldSeed: string;
  readonly mapId: string;
  readonly entityId: string;
  readonly variantRevision: number;
}
export type Concern =
  | { readonly kind: 'primaryCount' | 'layoutOrder' }
  | { readonly kind: 'anatomyBase' | 'anatomyLarge'; readonly owner: number }
  | {
      readonly kind: 'island' | 'archipelagoMember';
      readonly owner: number;
      readonly candidate: number;
      readonly member: number;
    }
  | { readonly kind: 'codeRotation'; readonly attempt: number }
  | {
      readonly kind: 'centerDirections' | 'refinement' | 'orientation';
      readonly owner: number;
      readonly attempt: number;
    };
const DEFINITIONS = Object.freeze({
  primaryCount: { keys: [], draws: 1 },
  layoutOrder: { keys: [], draws: 1 },
  anatomyBase: { keys: ['owner'], draws: 3 },
  anatomyLarge: { keys: ['owner'], draws: 3 },
  island: { keys: ['owner', 'candidate', 'member'], draws: 4 },
  archipelagoMember: { keys: ['owner', 'candidate', 'member'], draws: 4 },
  codeRotation: { keys: ['attempt'], draws: 3 },
  centerDirections: { keys: ['owner', 'attempt'], draws: 256 },
  refinement: { keys: ['owner', 'attempt'], draws: 64 },
  orientation: { keys: ['owner', 'attempt'], draws: 1 },
} as const);
function record(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input))
    throw new TypeError('Expected a closed record');
  return input as Record<string, unknown>;
}
function exact(input: Record<string, unknown>, keys: readonly string[]): void {
  const actual = Object.keys(input).sort(),
    expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index]))
    throw new TypeError('Unknown or missing registry fields');
}
function index(value: unknown, maximum: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    Object.is(value, -0) ||
    value < 0 ||
    value >= maximum
  )
    throw new RangeError('Noncanonical or out-of-range index');
  return value;
}
export function scope(
  authority: Authority,
  concern: Concern,
): { readonly input: MapEntitySeedInput; readonly drawLimit: number } {
  const a = record(authority),
    c = record(concern);
  exact(a, ['worldSeed', 'mapId', 'entityId', 'variantRevision']);
  if (typeof c.kind !== 'string' || !Object.hasOwn(DEFINITIONS, c.kind))
    throw new TypeError('Unknown concern');
  const kind = c.kind as keyof typeof DEFINITIONS;
  const definition = DEFINITIONS[kind];
  exact(c, ['kind', ...definition.keys]);
  const owner = Object.hasOwn(c, 'owner') ? index(c.owner, LIMITS.owners) : undefined;
  const candidate = Object.hasOwn(c, 'candidate')
    ? index(c.candidate, LIMITS.candidates)
    : undefined;
  const member = Object.hasOwn(c, 'member')
    ? index(c.member, kind === 'island' ? LIMITS.islands : LIMITS.archipelagoMembers)
    : undefined;
  const attempt = Object.hasOwn(c, 'attempt') ? index(c.attempt, LIMITS.attempts) : undefined;
  const suffix =
    kind === 'primaryCount' || kind === 'layoutOrder'
      ? `global.${kind}`
      : kind === 'anatomyBase' || kind === 'anatomyLarge'
        ? `owner${String(owner)}.${kind}`
        : kind === 'island' || kind === 'archipelagoMember'
          ? `owner${String(owner)}.candidate${String(candidate)}.${kind}${String(member)}`
          : kind === 'codeRotation'
            ? `placement.attempt${String(attempt)}.codeRotation`
            : `placement.attempt${String(attempt)}.owner${String(owner)}.${kind}`;
  const parsed = parseSeedInput({
    seedDerivationVersion: 1,
    deterministicStreamVersion: 1,
    seedScope: 'map/entity',
    worldSeed: a.worldSeed,
    mapId: a.mapId,
    entityId: a.entityId,
    generatorId: 'worldTerrain.macroElevation',
    generatorVersion: 3,
    aspectName: `${PREFIX}.${suffix}`,
    variantRevision: a.variantRevision,
  });
  if (!parsed.ok || parsed.value.seedScope !== 'map/entity')
    throw new TypeError('Core seed parsing rejected authority');
  if (
    deriveAtlasSingletonEntityIds(parsed.value.mapId).worldSurfaceEntityId !== parsed.value.entityId
  )
    throw new TypeError('Entity must be the authoritative world surface of this map');
  return Object.freeze({ input: parsed.value, drawLimit: definition.draws });
}
export function fixedAuthority(variantRevision = 0): Authority {
  const map = parseStableId('map', 'a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7');
  if (!map.ok) throw new Error('Invalid synthetic map identity');
  return Object.freeze({
    worldSeed: '81985529216486895',
    mapId: map.value,
    entityId: deriveAtlasSingletonEntityIds(map.value).worldSurfaceEntityId,
    variantRevision,
  });
}
/** Exactly the declared number of nextFloat64 calls; one raw uint64 advancement each. */
export function evaluate(authority: Authority, concern: Concern) {
  const { input, drawLimit } = scope(authority, concern);
  const seed = deriveSeed(input),
    encoded = encodeSeedInput(input),
    random = createDeterministicRandomStream(input);
  if (!seed.ok || !encoded.ok || !random.ok || !validateSeedInputEncodingV1(encoded.value).ok)
    throw new Error('Released core seed/stream rejected a validated scope');
  return {
    input: { ...input, worldSeed: input.worldSeed.toString(10) },
    preimageHex: Array.from(encoded.value, (byte) => byte.toString(16).padStart(2, '0')).join(''),
    seedHex: seed.value.hex,
    values: Array.from({ length: drawLimit }, () => random.value.nextFloat64()),
  };
}
export function enumerate(
  ownerCount: number,
  islandCount: number,
  archipelagoCount: number,
): Concern[] {
  index(ownerCount, LIMITS.owners + 1);
  if (ownerCount === 0) throw new RangeError('Owner count must be 1..8');
  index(islandCount, LIMITS.islands + 1);
  index(archipelagoCount, LIMITS.archipelagoMembers + 1);
  const output: Concern[] = [{ kind: 'primaryCount' }, { kind: 'layoutOrder' }];
  for (let owner = 0; owner < ownerCount; owner++) {
    output.push({ kind: 'anatomyBase', owner }, { kind: 'anatomyLarge', owner });
    for (let candidate = 0; candidate < LIMITS.candidates; candidate++) {
      for (let member = 0; member < islandCount; member++)
        output.push({ kind: 'island', owner, candidate, member });
      for (let member = 0; member < archipelagoCount; member++)
        output.push({ kind: 'archipelagoMember', owner, candidate, member });
    }
  }
  for (let attempt = 0; attempt < LIMITS.attempts; attempt++) {
    output.push({ kind: 'codeRotation', attempt });
    for (let owner = 0; owner < ownerCount; owner++)
      output.push(
        { kind: 'centerDirections', owner, attempt },
        { kind: 'refinement', owner, attempt },
        { kind: 'orientation', owner, attempt },
      );
  }
  return output;
}
