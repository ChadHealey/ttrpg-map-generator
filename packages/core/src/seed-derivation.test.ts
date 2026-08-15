import { describe, expect, it } from 'vitest';

import {
  deriveSeed,
  encodeSeedInput,
  parseDerivedSeedHex,
  SEED_DERIVATION_DIAGNOSTIC_CODES,
  validateSeedInputEncodingV1,
} from './seed-derivation.js';
import { parseSeedInput } from './seed-input.js';

const MAP_ENTITY_R0_HEX =
  '74747270672d6d61702f736565642d696e7075742f76310001000000010102000000080123456789abcdef030000000d70726f6f662e6d61726b65727304000000080000000000000001050000000d70726f6f662e6d61726b657273060000000800000000000000001000000010a6f9999609e84f5fbf5f80b6bb38bdb71100000010c6f4a17bdfaf4dce99049a900d300da4';

const VECTORS = [
  {
    name: 'map/entity r0',
    input: mapEntityInput(0),
    encodedLength: 147,
    encodedHex: MAP_ENTITY_R0_HEX,
    derivedSeed: '1a2f8b58dd15bc73225e165c502a3b05f27c71466b375d6e7ec01f1977040d56',
  },
  {
    name: 'map/entity r1',
    input: mapEntityInput(1),
    encodedLength: 147,
    encodedHex:
      '74747270672d6d61702f736565642d696e7075742f76310001000000010102000000080123456789abcdef030000000d70726f6f662e6d61726b65727304000000080000000000000001050000000d70726f6f662e6d61726b657273060000000800000000000000011000000010a6f9999609e84f5fbf5f80b6bb38bdb71100000010c6f4a17bdfaf4dce99049a900d300da4',
    derivedSeed: '00848c0bb927d5ef71c768a0ab25c62dd1c2492ad9b79f694229851e85083367',
  },
  {
    name: 'root-coordinate',
    input: rootInput(-2_147_483_648, 0),
    encodedLength: 144,
    encodedHex:
      '74747270672d6d61702f736565642d696e7075742f76310001000000010202000000080123456789abcdef030000000d70726f6f662e6d61726b65727304000000080000000000000001050000000d70726f6f662e6d61726b65727306000000080000000000000000200000001041c0988cd65f4daba064fc8a8755eaec210000000480000000220000000400000000',
    derivedSeed: 'e0df5749db434e06a7fc283ea57833b3fe11c35e389576f6d83f504c68822089',
  },
  {
    name: 'shared-boundary',
    input: sharedInput(),
    encodedLength: 126,
    encodedHex:
      '74747270672d6d61702f736565642d696e7075742f76310001000000010302000000080123456789abcdef030000000d70726f6f662e6d61726b65727304000000080000000000000001050000000d70726f6f662e6d61726b6572730600000008000000000000000030000000107f59b4c3bf7042b59b5ec97f7e8d8321',
    derivedSeed: '9d7796bda6544cea685a288d2b4364410ed4d61dc182963d0b8a60c8afff2360',
  },
] as const;

describe('seed input encoding and derivation version 1', () => {
  it.each(VECTORS)('matches the accepted $name compatibility vector', (vector) => {
    const input = expectValue(parseSeedInput(vector.input));
    const encoded = expectValue(encodeSeedInput(input));
    const seed = expectValue(deriveSeed(input));

    expect(encoded).toHaveLength(vector.encodedLength);
    expect(toHex(encoded)).toBe(vector.encodedHex);
    expect(seed.hex).toBe(vector.derivedSeed);
    expect(expectValue(validateSeedInputEncodingV1(encoded))).toBe(true);
  });

  it('uses fixed field order independently of object insertion order', () => {
    const forward = expectValue(parseSeedInput(mapEntityInput(0)));
    const reverse = expectValue(
      parseSeedInput(Object.fromEntries(Object.entries(mapEntityInput(0)).reverse())),
    );

    expect(expectValue(encodeSeedInput(reverse))).toStrictEqual(
      expectValue(encodeSeedInput(forward)),
    );
    expect(expectValue(deriveSeed(reverse))).toStrictEqual(expectValue(deriveSeed(forward)));
  });

  it('domain-separates every map/entity namespace field', () => {
    const baseline = expectValue(deriveSeed(expectValue(parseSeedInput(mapEntityInput(0))))).hex;
    const variants = [
      { ...mapEntityInput(0), worldSeed: '81985529216486896' },
      { ...mapEntityInput(0), generatorId: 'proof.outline' },
      { ...mapEntityInput(0), generatorVersion: 2 },
      { ...mapEntityInput(0), aspectName: 'proof.outline' },
      { ...mapEntityInput(0), variantRevision: 1 },
      { ...mapEntityInput(0), mapId: '11111111-1111-4111-8111-111111111111' },
      { ...mapEntityInput(0), entityId: '22222222-2222-4222-8222-222222222222' },
    ];

    expect(
      variants.map((variant) => expectValue(deriveSeed(expectValue(parseSeedInput(variant)))).hex),
    ).not.toContain(baseline);
    expect(
      new Set(
        variants.map(
          (variant) => expectValue(deriveSeed(expectValue(parseSeedInput(variant)))).hex,
        ),
      ).size,
    ).toBe(variants.length);
  });

  it('domain-separates root point, root identity, and shared portal identity', () => {
    const rootBaseline = seedHex(rootInput(0, 0));
    expect(seedHex(rootInput(1, 0))).not.toBe(rootBaseline);
    expect(seedHex(rootInput(0, 1))).not.toBe(rootBaseline);
    expect(
      seedHex({ ...rootInput(0, 0), rootSurfaceId: '33333333-3333-4333-8333-333333333333' }),
    ).not.toBe(rootBaseline);
    expect(
      seedHex({ ...sharedInput(), boundaryPortalId: '44444444-4444-4444-8444-444444444444' }),
    ).not.toBe(seedHex(sharedInput()));
  });

  it('rejects missing, duplicate, reordered, unknown, and malformed binary fields', () => {
    const encoded = fromHex(MAP_ENTITY_R0_HEX);
    const parts = splitFrames(encoded);
    const prefix = requirePart(parts, 0);
    const frames = parts.slice(1);
    const firstFrame = requirePart(frames, 0);
    const secondFrame = requirePart(frames, 1);
    const cases = [
      concatenate([prefix, ...frames.slice(0, -1)]),
      concatenate([prefix, firstFrame, ...frames]),
      concatenate([prefix, secondFrame, firstFrame, ...frames.slice(2)]),
      concatenate([prefix, ...frames, frame(0x7f, Uint8Array.of(1))]),
      encoded.slice(0, -1),
    ];

    for (const candidate of cases) {
      expect(validateSeedInputEncodingV1(candidate)).toMatchObject({
        ok: false,
        diagnostic: { code: SEED_DERIVATION_DIAGNOSTIC_CODES.invalidEncodingFields },
      });
    }
    const wrongPrefix = encoded.slice();
    wrongPrefix[0] = 0;
    expect(validateSeedInputEncodingV1(wrongPrefix)).toMatchObject({
      ok: false,
      diagnostic: { code: SEED_DERIVATION_DIAGNOSTIC_CODES.invalidEncoding },
    });
  });

  it('reports unsupported derivation versions without changing accepted metadata', () => {
    const input = expectValue(parseSeedInput({ ...mapEntityInput(0), seedDerivationVersion: 2 }));
    expect(deriveSeed(input)).toStrictEqual({
      ok: false,
      diagnostic: {
        code: SEED_DERIVATION_DIAGNOSTIC_CODES.unsupportedVersion,
        message: 'Seed-derivation version 2 is not supported.',
      },
    });
    expect(input.seedDerivationVersion).toBe(2);
  });

  it('parses only exact lowercase 32-byte derived evidence', () => {
    const expected = VECTORS[0].derivedSeed;
    expect(expectValue(parseDerivedSeedHex(expected)).hex).toBe(expected);
    for (const invalid of [expected.toUpperCase(), expected.slice(2), `${expected}00`, 42]) {
      expect(parseDerivedSeedHex(invalid)).toMatchObject({
        ok: false,
        diagnostic: { code: SEED_DERIVATION_DIAGNOSTIC_CODES.invalidDerivedSeed },
      });
    }
  });
});

function mapEntityInput(variantRevision: number): Readonly<Record<string, unknown>> {
  return {
    seedDerivationVersion: 1,
    deterministicStreamVersion: 1,
    seedScope: 'map/entity',
    worldSeed: '81985529216486895',
    generatorId: 'proof.markers',
    generatorVersion: 1,
    aspectName: 'proof.markers',
    variantRevision,
    mapId: 'a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7',
    entityId: 'c6f4a17b-dfaf-4dce-9904-9a900d300da4',
  };
}

function rootInput(
  longitudeTicks: number,
  latitudeTicks: number,
): Readonly<Record<string, unknown>> {
  const { mapId: _mapId, entityId: _entityId, ...common } = mapEntityInput(0);
  return {
    ...common,
    seedScope: 'root-coordinate',
    rootSurfaceId: '41c0988c-d65f-4dab-a064-fc8a8755eaec',
    point: { longitudeTicks, latitudeTicks },
  };
}

function sharedInput(): Readonly<Record<string, unknown>> {
  const { mapId: _mapId, entityId: _entityId, ...common } = mapEntityInput(0);
  return {
    ...common,
    seedScope: 'shared-boundary',
    boundaryPortalId: '7f59b4c3-bf70-42b5-9b5e-c97f7e8d8321',
  };
}

function seedHex(raw: Readonly<Record<string, unknown>>): string {
  return expectValue(deriveSeed(expectValue(parseSeedInput(raw)))).hex;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  return Uint8Array.from({ length: hex.length / 2 }, (_, index) =>
    Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16),
  );
}

function splitFrames(encoded: Uint8Array): readonly Uint8Array[] {
  const parts: Uint8Array[] = [encoded.slice(0, 24)];
  let offset = 24;
  while (offset < encoded.length) {
    const length = new DataView(encoded.buffer, encoded.byteOffset + offset + 1, 4).getUint32(
      0,
      false,
    );
    parts.push(encoded.slice(offset, offset + 5 + length));
    offset += 5 + length;
  }
  return parts;
}

function frame(tag: number, payload: Uint8Array): Uint8Array {
  const result = new Uint8Array(5 + payload.length);
  result[0] = tag;
  new DataView(result.buffer).setUint32(1, payload.length, false);
  result.set(payload, 5);
  return result;
}

function concatenate(parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function requirePart(parts: readonly Uint8Array[], index: number): Uint8Array {
  const part = parts[index];
  if (part === undefined) throw new Error(`Expected encoded fixture part ${String(index)}.`);
  return part;
}

function expectValue<Value>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly diagnostic: unknown },
): Value {
  if (!result.ok) throw new Error(`Expected success: ${JSON.stringify(result.diagnostic)}`);
  return result.value;
}
