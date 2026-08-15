import { describe, expect, it } from 'vitest';

import {
  formatWorldSeed,
  parseSeedInput,
  parseWorldSeed,
  SEED_INPUT_DIAGNOSTIC_CODES,
  WORLD_SEED_MAX,
} from './seed-input.js';

const COMMON = {
  seedDerivationVersion: 1,
  deterministicStreamVersion: 1,
  worldSeed: '81985529216486895',
  generatorId: 'proof.markers',
  generatorVersion: 1,
  aspectName: 'proof.markers',
  variantRevision: 0,
} as const;
const MAP_ID = 'a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7';
const ENTITY_ID = 'c6f4a17b-dfaf-4dce-9904-9a900d300da4';
const ROOT_SURFACE_ID = '41c0988c-d65f-4dab-a064-fc8a8755eaec';
const BOUNDARY_PORTAL_ID = '7f59b4c3-bf70-42b5-9b5e-c97f7e8d8321';

describe('world seed validation', () => {
  it('round-trips the full unsigned 64-bit boundary exactly', () => {
    for (const text of ['0', '81985529216486895', '18446744073709551615']) {
      const parsed = parseWorldSeed(text);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) expect(formatWorldSeed(parsed.value)).toBe(text);
    }
    expect(WORLD_SEED_MAX).toBe(18_446_744_073_709_551_615n);
  });

  it.each(
    [
      -1,
      0,
      1,
      1n,
      '',
      '00',
      '01',
      '+1',
      '-1',
      ' 1',
      '1 ',
      '1.0',
      '1e3',
      '18446744073709551616',
    ].map((input) => [String(input), input] as const),
  )('rejects noncanonical or out-of-range input %s', (_label, input) => {
    expect(parseWorldSeed(input)).toMatchObject({
      ok: false,
      diagnostic: { code: SEED_INPUT_DIAGNOSTIC_CODES.invalidWorldSeed },
    });
  });
});

describe('scope-specific seed input validation', () => {
  it('constructs all three closed namespaces with branded boundary values', () => {
    expect(parseSeedInput(mapEntityInput())).toMatchObject({
      ok: true,
      value: { seedScope: 'map/entity', worldSeed: 81_985_529_216_486_895n },
    });
    expect(parseSeedInput(rootInput(-2_147_483_648, 0))).toMatchObject({
      ok: true,
      value: {
        seedScope: 'root-coordinate',
        point: { longitudeTicks: -2_147_483_648, latitudeTicks: 0 },
      },
    });
    expect(parseSeedInput(sharedInput())).toMatchObject({
      ok: true,
      value: { seedScope: 'shared-boundary', boundaryPortalId: BOUNDARY_PORTAL_ID },
    });
  });

  it('accepts the maximum representable world seed, versions, and revision as metadata', () => {
    expect(
      parseSeedInput({
        ...mapEntityInput(),
        seedDerivationVersion: Number.MAX_SAFE_INTEGER,
        deterministicStreamVersion: Number.MAX_SAFE_INTEGER,
        worldSeed: '18446744073709551615',
        generatorVersion: Number.MAX_SAFE_INTEGER,
        variantRevision: Number.MAX_SAFE_INTEGER,
      }),
    ).toMatchObject({ ok: true });
  });

  it.each([
    rootInput(0, 1_073_741_824),
    rootInput(0, -1_073_741_824),
    rootInput(536_870_912, 268_435_456),
  ])('accepts canonical seam, pole, and interior root keys', (input) => {
    expect(parseSeedInput(input)).toMatchObject({ ok: true });
  });

  it('rejects missing, unknown, and scope-inapplicable fields', () => {
    const { entityId: _missing, ...missing } = mapEntityInput();
    expect(parseSeedInput(missing)).toMatchObject({
      ok: false,
      diagnostic: { code: SEED_INPUT_DIAGNOSTIC_CODES.invalidFields },
    });
    expect(parseSeedInput({ ...mapEntityInput(), extra: true })).toMatchObject({
      ok: false,
      diagnostic: { code: SEED_INPUT_DIAGNOSTIC_CODES.invalidFields },
    });
    expect(parseSeedInput({ ...sharedInput(), mapId: MAP_ID })).toMatchObject({
      ok: false,
      diagnostic: { code: SEED_INPUT_DIAGNOSTIC_CODES.invalidFields },
    });
  });

  it.each([
    ['seedDerivationVersion', 0],
    ['deterministicStreamVersion', Number.MAX_SAFE_INTEGER + 1],
    ['worldSeed', '01'],
    ['generatorId', 'Proof.Markers'],
    ['generatorVersion', 0],
    ['aspectName', 'markers'],
    ['variantRevision', -1],
    ['mapId', MAP_ID.toUpperCase()],
    ['entityId', 'not-a-uuid'],
  ] as const)('rejects invalid map/entity field %s', (field, value) => {
    expect(parseSeedInput({ ...mapEntityInput(), [field]: value })).toMatchObject({
      ok: false,
      diagnostic: { code: SEED_INPUT_DIAGNOSTIC_CODES.invalidField, field },
    });
  });

  it('rejects invalid root and boundary identities and noncanonical planet points', () => {
    expect(
      parseSeedInput({ ...rootInput(0, 0), rootSurfaceId: MAP_ID.toUpperCase() }),
    ).toMatchObject({
      ok: false,
      diagnostic: { field: 'rootSurfaceId' },
    });
    expect(parseSeedInput(rootInput(1, 1_073_741_824))).toMatchObject({
      ok: false,
      diagnostic: { field: 'point' },
    });
    expect(parseSeedInput({ ...sharedInput(), boundaryPortalId: 'not-a-uuid' })).toMatchObject({
      ok: false,
      diagnostic: { field: 'boundaryPortalId' },
    });
  });
});

function mapEntityInput(): Readonly<Record<string, unknown>> {
  return { ...COMMON, seedScope: 'map/entity', mapId: MAP_ID, entityId: ENTITY_ID };
}

function rootInput(
  longitudeTicks: number,
  latitudeTicks: number,
): Readonly<Record<string, unknown>> {
  return {
    ...COMMON,
    seedScope: 'root-coordinate',
    rootSurfaceId: ROOT_SURFACE_ID,
    point: { longitudeTicks, latitudeTicks },
  };
}

function sharedInput(): Readonly<Record<string, unknown>> {
  return { ...COMMON, seedScope: 'shared-boundary', boundaryPortalId: BOUNDARY_PORTAL_ID };
}
