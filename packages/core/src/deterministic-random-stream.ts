/** Exact xoshiro256** version 1 stream and unbiased public sampling operations. */

import type { DeterministicStreamVersion } from './compatibility.js';
import { type DerivedSeed, deriveSeed, type SeedDerivationDiagnostic } from './seed-derivation.js';
import { DETERMINISTIC_STREAM_VERSION, type SeedInput } from './seed-input.js';

const UINT64_MODULUS = 1n << 64n;
const UINT64_MASK = UINT64_MODULUS - 1n;
const FLOAT64_DENOMINATOR = 2 ** 53;

/** Explicit deterministic random capability supplied to one generator proposal. */
export interface DeterministicRandomStream {
  readonly nextUint64: () => bigint;
  readonly nextUint32: () => number;
  readonly nextFloat64: () => number;
  readonly nextInt: (maxExclusive: number) => number;
}

export const DETERMINISTIC_STREAM_DIAGNOSTIC_CODES = {
  unsupportedVersion: 'seed.stream.version.unsupported',
} as const;

export type DeterministicStreamDiagnosticCode =
  (typeof DETERMINISTIC_STREAM_DIAGNOSTIC_CODES)[keyof typeof DETERMINISTIC_STREAM_DIAGNOSTIC_CODES];

/** A stable compatibility failure returned before a stream can be initialized. */
export interface DeterministicStreamDiagnostic {
  readonly code: DeterministicStreamDiagnosticCode;
  readonly message: string;
}

export type DeterministicStreamCreationResult =
  | { readonly ok: true; readonly value: DeterministicRandomStream }
  | {
      readonly ok: false;
      readonly diagnostic: DeterministicStreamDiagnostic | SeedDerivationDiagnostic;
    };

/** Derive and initialize a fresh aspect-scoped stream from complete authoritative metadata. */
export function createDeterministicRandomStream(
  input: SeedInput,
): DeterministicStreamCreationResult {
  const seed = deriveSeed(input);
  return seed.ok
    ? createDeterministicRandomStreamFromSeed(seed.value, input.deterministicStreamVersion)
    : seed;
}

/** Internal initialization seam used after authoritative metadata has derived its 32-byte seed. */
export function createDeterministicRandomStreamFromSeed(
  seed: DerivedSeed,
  version: DeterministicStreamVersion,
): DeterministicStreamCreationResult {
  if (version !== DETERMINISTIC_STREAM_VERSION) {
    return {
      ok: false,
      diagnostic: {
        code: DETERMINISTIC_STREAM_DIAGNOSTIC_CODES.unsupportedVersion,
        message: `Deterministic-stream version ${String(version)} is not supported.`,
      },
    };
  }
  return { ok: true, value: new Xoshiro256StarStar(seed.bytes) };
}

/**
 * Version 1 procedural stream. It is reproducible, isolated, and deliberately not
 * cryptographically secure.
 */
class Xoshiro256StarStar implements DeterministicRandomStream {
  #s0: bigint;
  #s1: bigint;
  #s2: bigint;
  #s3: bigint;

  public constructor(bytes: readonly number[]) {
    const seedBytes = Uint8Array.from(bytes);
    const view = new DataView(seedBytes.buffer, seedBytes.byteOffset, seedBytes.byteLength);
    this.#s0 = view.getBigUint64(0, false);
    this.#s1 = view.getBigUint64(8, false);
    this.#s2 = view.getBigUint64(16, false);
    this.#s3 = view.getBigUint64(24, false);
    if ((this.#s0 | this.#s1 | this.#s2 | this.#s3) === 0n) {
      this.#s3 = 1n;
    }
  }

  public nextUint64(): bigint {
    const result = (rotateLeft64((this.#s1 * 5n) & UINT64_MASK, 7n) * 9n) & UINT64_MASK;
    const temporary = (this.#s1 << 17n) & UINT64_MASK;

    this.#s2 = (this.#s2 ^ this.#s0) & UINT64_MASK;
    this.#s3 = (this.#s3 ^ this.#s1) & UINT64_MASK;
    this.#s1 = (this.#s1 ^ this.#s2) & UINT64_MASK;
    this.#s0 = (this.#s0 ^ this.#s3) & UINT64_MASK;
    this.#s2 = (this.#s2 ^ temporary) & UINT64_MASK;
    this.#s3 = rotateLeft64(this.#s3, 45n);
    return result;
  }

  public nextUint32(): number {
    return Number(this.nextUint64() >> 32n);
  }

  public nextFloat64(): number {
    return Number(this.nextUint64() >> 11n) / FLOAT64_DENOMINATOR;
  }

  public nextInt(maxExclusive: number): number {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > 2 ** 53 - 1) {
      throw new RangeError(
        'nextInt maxExclusive must be a positive safe integer at most 2^53 - 1.',
      );
    }
    const modulus = BigInt(maxExclusive);
    const limit = UINT64_MODULUS - (UINT64_MODULUS % modulus);
    let value: bigint;
    do {
      value = this.nextUint64();
    } while (value >= limit);
    return Number(value % modulus);
  }
}

function rotateLeft64(value: bigint, bits: bigint): bigint {
  return ((value << bits) | (value >> (64n - bits))) & UINT64_MASK;
}
