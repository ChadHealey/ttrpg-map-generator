import { describe, expect, it } from 'vitest';

import {
  createDeterministicRandomStream,
  createDeterministicRandomStreamFromSeed,
  DETERMINISTIC_STREAM_DIAGNOSTIC_CODES,
  type DeterministicRandomStream,
} from './deterministic-random-stream.js';
import { parseDerivedSeedHex } from './seed-derivation.js';
import { DETERMINISTIC_STREAM_VERSION, parseSeedInput } from './seed-input.js';

const STREAM_VECTORS = [
  {
    input: mapEntityInput(0),
    samples: [
      4_969_472_649_965_073_277n,
      4_126_389_313_282_449_473n,
      12_255_398_325_814_149_716n,
      6_219_055_558_446_306_254n,
      17_257_435_883_629_250_169n,
      12_766_772_300_167_332_155n,
    ],
  },
  {
    input: mapEntityInput(1),
    samples: [
      482_482_241_414_034_812n,
      7_331_834_249_422_374_937n,
      5_071_566_112_739_751_929n,
      17_259_582_541_064_106_200n,
      8_692_955_153_456_199_867n,
      13_616_984_490_983_226_921n,
    ],
  },
  {
    input: rootInput(),
    samples: [
      12_216_437_898_497_178_811n,
      17_692_849_315_921_094_206n,
      15_229_514_985_953_005_997n,
      3_414_435_803_347_387_516n,
      15_069_927_402_757_322_134n,
      2_129_342_890_703_147_323n,
    ],
  },
  {
    input: sharedInput(),
    samples: [
      17_046_239_271_336_261_284n,
      7_757_445_114_682_684_189n,
      15_827_175_737_314_354_443n,
      4_320_748_786_356_295_447n,
      5_858_308_439_689_601_826n,
      10_457_685_005_984_530_350n,
    ],
  },
] as const;

describe('deterministic stream version 1', () => {
  it.each(STREAM_VECTORS)('matches all six raw compatibility samples', (vector) => {
    const stream = streamFrom(vector.input);
    expect(Array.from({ length: 6 }, () => stream.nextUint64())).toStrictEqual(vector.samples);
  });

  it('implements each public sampler from one independent raw draw', () => {
    expect(streamFrom(mapEntityInput(0)).nextUint32()).toBe(1_157_045_515);
    expect(streamFrom(mapEntityInput(0)).nextFloat64()).toBe(0.2693956521599714);
    expect(streamFrom(mapEntityInput(0)).nextInt(1_000)).toBe(277);
  });

  it('repeats from fresh input while independent instances consume only their own state', () => {
    const first = streamFrom(mapEntityInput(0));
    const second = streamFrom(mapEntityInput(0));
    const expected = STREAM_VECTORS[0].samples;

    first.nextUint64();
    first.nextUint64();
    expect(second.nextUint64()).toBe(expected[0]);
    expect(second.nextUint64()).toBe(expected[1]);
    expect(first.nextUint64()).toBe(expected[2]);
  });

  it('isolates aspect revisions and unrelated aspect streams', () => {
    const markersR0 = streamFrom(mapEntityInput(0));
    const markersR1 = streamFrom(mapEntityInput(1));
    const outlineBefore = streamFrom(outlineInput());
    const expectedOutline = Array.from({ length: 4 }, () => outlineBefore.nextUint64());

    const revisionZeroSamples = Array.from({ length: 4 }, () => markersR0.nextUint64());
    const revisionOneSamples = Array.from({ length: 4 }, () => markersR1.nextUint64());
    expect(revisionOneSamples).not.toStrictEqual(revisionZeroSamples);

    const outlineAfter = streamFrom(outlineInput());
    expect(Array.from({ length: 4 }, () => outlineAfter.nextUint64())).toStrictEqual(
      expectedOutline,
    );
  });

  it('agrees across distinct child contexts for one root point and one shared portal', () => {
    const childA = '11111111-1111-4111-8111-111111111111';
    const childB = '22222222-2222-4222-8222-222222222222';
    const rootContexts = [
      { childMapId: childA, seedInput: rootInput() },
      { childMapId: childB, seedInput: rootInput() },
    ];
    const boundaryContexts = [
      { childMapId: childA, seedInput: sharedInput() },
      { childMapId: childB, seedInput: sharedInput() },
    ];

    expect(sequence(rootContexts[0]?.seedInput)).toStrictEqual(
      sequence(rootContexts[1]?.seedInput),
    );
    expect(sequence(boundaryContexts[0]?.seedInput)).toStrictEqual(
      sequence(boundaryContexts[1]?.seedInput),
    );
    expect(rootContexts[0]?.childMapId).not.toBe(rootContexts[1]?.childMapId);
  });

  it('uses observable rejection sampling rather than biased modulo reduction', () => {
    const crafted = expectValue(
      parseDerivedSeedHex('00000000000000004fc71c71c71c71c700000000000000000000000000000000'),
    );
    const sampled = expectValue(
      createDeterministicRandomStreamFromSeed(crafted, DETERMINISTIC_STREAM_VERSION),
    );
    const raw = expectValue(
      createDeterministicRandomStreamFromSeed(crafted, DETERMINISTIC_STREAM_VERSION),
    );
    const rejected = raw.nextUint64();
    const maximum = 2 ** 53 - 1;
    const modulus = BigInt(maximum);
    const limit = (1n << 64n) - ((1n << 64n) % modulus);
    let accepted: bigint;
    do {
      accepted = raw.nextUint64();
    } while (accepted >= limit);
    const following = raw.nextUint64();

    expect(rejected).toBe((1n << 64n) - 1n);
    expect(sampled.nextInt(maximum)).toBe(Number(accepted % modulus));
    expect(sampled.nextUint64()).toBe(following);
  });

  it('validates integer bounds and never returns the exclusive maximum', () => {
    const stream = streamFrom(mapEntityInput(0));
    for (const invalid of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]) {
      expect(() => stream.nextInt(invalid)).toThrow(RangeError);
    }
    const upperBoundStream = streamFrom(mapEntityInput(0));
    for (let index = 0; index < 64; index += 1) {
      const sample = upperBoundStream.nextInt(2 ** 53 - 1);
      expect(Number.isSafeInteger(sample)).toBe(true);
      expect(sample).toBeGreaterThanOrEqual(0);
      expect(sample).toBeLessThan(2 ** 53 - 1);
    }
  });

  it('maps only the all-zero seed state to s3 = 1', () => {
    const allZero = expectValue(parseDerivedSeedHex('0'.repeat(64)));
    const explicitS3 = expectValue(parseDerivedSeedHex(`${'0'.repeat(62)}01`));
    const zeroStream = expectValue(
      createDeterministicRandomStreamFromSeed(allZero, DETERMINISTIC_STREAM_VERSION),
    );
    const explicitStream = expectValue(
      createDeterministicRandomStreamFromSeed(explicitS3, DETERMINISTIC_STREAM_VERSION),
    );
    expect(Array.from({ length: 8 }, () => zeroStream.nextUint64())).toStrictEqual(
      Array.from({ length: 8 }, () => explicitStream.nextUint64()),
    );
  });

  it('reports unsupported stream versions without falling back', () => {
    const input = expectValue(
      parseSeedInput({ ...mapEntityInput(0), deterministicStreamVersion: 2 }),
    );
    expect(createDeterministicRandomStream(input)).toStrictEqual({
      ok: false,
      diagnostic: {
        code: DETERMINISTIC_STREAM_DIAGNOSTIC_CODES.unsupportedVersion,
        message: 'Deterministic-stream version 2 is not supported.',
      },
    });
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

function outlineInput(): Readonly<Record<string, unknown>> {
  return { ...mapEntityInput(0), generatorId: 'proof.outline', aspectName: 'proof.outline' };
}

function rootInput(): Readonly<Record<string, unknown>> {
  const { mapId: _mapId, entityId: _entityId, ...common } = mapEntityInput(0);
  return {
    ...common,
    seedScope: 'root-coordinate',
    rootSurfaceId: '41c0988c-d65f-4dab-a064-fc8a8755eaec',
    point: { longitudeTicks: -2_147_483_648, latitudeTicks: 0 },
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

function streamFrom(raw: Readonly<Record<string, unknown>>): DeterministicRandomStream {
  return expectValue(createDeterministicRandomStream(expectValue(parseSeedInput(raw))));
}

function sequence(raw: Readonly<Record<string, unknown>> | undefined): readonly bigint[] {
  if (raw === undefined) throw new Error('Expected child context seed input.');
  const stream = streamFrom(raw);
  return Array.from({ length: 6 }, () => stream.nextUint64());
}

function expectValue<Value>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly diagnostic: unknown },
): Value {
  if (!result.ok) throw new Error(`Expected success: ${JSON.stringify(result.diagnostic)}`);
  return result.value;
}
