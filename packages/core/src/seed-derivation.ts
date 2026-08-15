/** Versioned binary seed-input framing and SHA-256 aspect-seed derivation. */

import { parseSeedInput, SEED_DERIVATION_VERSION, type SeedInput } from './seed-input.js';
import { sha256 } from './sha-256.js';

declare const DERIVED_SEED_BRAND: unique symbol;

/** Immutable 32-byte seed evidence used to initialize a deterministic stream. */
export type DerivedSeed = Readonly<{
  readonly bytes: readonly number[];
  readonly hex: string;
  readonly [DERIVED_SEED_BRAND]: true;
}>;

export const SEED_DERIVATION_DIAGNOSTIC_CODES = {
  unsupportedVersion: 'seed.derivation.version.unsupported',
  invalidEncoding: 'seed.encoding.invalid',
  invalidEncodingFields: 'seed.encoding.fields.invalid',
  invalidDerivedSeed: 'seed.derived.invalid',
} as const;

export type SeedDerivationDiagnosticCode =
  (typeof SEED_DERIVATION_DIAGNOSTIC_CODES)[keyof typeof SEED_DERIVATION_DIAGNOSTIC_CODES];

/** A stable failure from derivation or encoded-preimage validation. */
export interface SeedDerivationDiagnostic {
  readonly code: SeedDerivationDiagnosticCode;
  readonly message: string;
}

export type SeedDerivationResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly diagnostic: SeedDerivationDiagnostic };

const PREFIX = new TextEncoder().encode('ttrpg-map/seed-input/v1\0');
const COMMON_TAGS = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06] as const;
const SCOPE_DISCRIMINANTS = {
  'map/entity': 1,
  'root-coordinate': 2,
  'shared-boundary': 3,
} as const;

/** Encode a validated namespace with the exact ADR-0006 version 1 framing. */
export function encodeSeedInput(input: SeedInput): SeedDerivationResult<Uint8Array> {
  if (input.seedDerivationVersion !== SEED_DERIVATION_VERSION) {
    return failure(
      SEED_DERIVATION_DIAGNOSTIC_CODES.unsupportedVersion,
      `Seed-derivation version ${String(input.seedDerivationVersion)} is not supported.`,
    );
  }

  const fields = [
    frame(0x01, Uint8Array.of(SCOPE_DISCRIMINANTS[input.seedScope])),
    frame(0x02, unsigned64(input.worldSeed)),
    frame(0x03, ascii(input.generatorId)),
    frame(0x04, unsigned64(BigInt(input.generatorVersion))),
    frame(0x05, ascii(input.aspectName)),
    frame(0x06, unsigned64(BigInt(input.variantRevision))),
  ];
  if (input.seedScope === 'map/entity') {
    fields.push(frame(0x10, uuidBytes(input.mapId)), frame(0x11, uuidBytes(input.entityId)));
  } else if (input.seedScope === 'root-coordinate') {
    fields.push(
      frame(0x20, uuidBytes(input.rootSurfaceId)),
      frame(0x21, signed32(input.point.longitudeTicks)),
      frame(0x22, signed32(input.point.latitudeTicks)),
    );
  } else {
    fields.push(frame(0x30, uuidBytes(input.boundaryPortalId)));
  }
  return { ok: true, value: concatenate([PREFIX, ...fields]) };
}

/** Derive the standard SHA-256 digest of the complete versioned seed-input encoding. */
export function deriveSeed(input: SeedInput): SeedDerivationResult<DerivedSeed> {
  const encoded = encodeSeedInput(input);
  return encoded.ok ? { ok: true, value: derivedSeedFromBytes(sha256(encoded.value)) } : encoded;
}

/** Parse lowercase diagnostic seed evidence without accepting a replacement for metadata. */
export function parseDerivedSeedHex(input: unknown): SeedDerivationResult<DerivedSeed> {
  if (typeof input !== 'string' || !/^[0-9a-f]{64}$/u.test(input)) {
    return failure(
      SEED_DERIVATION_DIAGNOSTIC_CODES.invalidDerivedSeed,
      'Derived seed evidence must be exactly 64 lowercase hexadecimal characters.',
    );
  }
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(input.slice(index * 2, index * 2 + 2), 16);
  }
  return { ok: true, value: derivedSeedFromBytes(bytes) };
}

/** Validate one exact version 1 preimage, including field order and payload grammar. */
export function validateSeedInputEncodingV1(input: unknown): SeedDerivationResult<true> {
  if (!(input instanceof Uint8Array) || !startsWith(input, PREFIX)) {
    return failure(
      SEED_DERIVATION_DIAGNOSTIC_CODES.invalidEncoding,
      'Seed input encoding must be bytes beginning with the version 1 prefix.',
    );
  }

  const frames = readFrames(input, PREFIX.byteLength);
  if (!frames.ok) return frames;
  const scopePayload = frames.value[0]?.payload;
  const discriminant = scopePayload?.byteLength === 1 ? scopePayload[0] : undefined;
  const suffixTags =
    discriminant === 1
      ? [0x10, 0x11]
      : discriminant === 2
        ? [0x20, 0x21, 0x22]
        : discriminant === 3
          ? [0x30]
          : undefined;
  if (suffixTags === undefined || !hasExactTags(frames.value, [...COMMON_TAGS, ...suffixTags])) {
    return failure(
      SEED_DERIVATION_DIAGNOSTIC_CODES.invalidEncodingFields,
      'Seed input fields are missing, duplicate, reordered, unknown, or invalid for the scope.',
    );
  }

  const payloads = frames.value.map(({ payload }) => payload);
  const worldSeed = readUnsigned64(payloads[1]);
  const generatorId = readAscii(payloads[2]);
  const generatorVersion = readSafeUnsigned64(payloads[3]);
  const aspectName = readAscii(payloads[4]);
  const variantRevision = readSafeUnsigned64(payloads[5]);
  if (
    worldSeed === undefined ||
    generatorId === undefined ||
    generatorVersion === undefined ||
    aspectName === undefined ||
    variantRevision === undefined
  ) {
    return invalidPayloads();
  }

  const common = {
    seedDerivationVersion: SEED_DERIVATION_VERSION,
    deterministicStreamVersion: 1,
    worldSeed: worldSeed.toString(10),
    generatorId,
    generatorVersion,
    aspectName,
    variantRevision,
  };
  const decoded =
    discriminant === 1
      ? decodeMapEntity(common, payloads)
      : discriminant === 2
        ? decodeRootCoordinate(common, payloads)
        : decodeSharedBoundary(common, payloads);
  if (decoded === undefined) return invalidPayloads();
  const parsed = parseSeedInput(decoded);
  return parsed.ok
    ? { ok: true, value: true }
    : failure(
        SEED_DERIVATION_DIAGNOSTIC_CODES.invalidEncodingFields,
        `Seed input payload is not canonical: ${parsed.diagnostic.message}`,
      );
}

interface EncodedFrame {
  readonly tag: number;
  readonly payload: Uint8Array;
}

function readFrames(
  input: Uint8Array,
  initialOffset: number,
): SeedDerivationResult<readonly EncodedFrame[]> {
  const frames: EncodedFrame[] = [];
  let offset = initialOffset;
  while (offset < input.byteLength) {
    if (input.byteLength - offset < 5) return invalidPayloads();
    const tag = input[offset];
    if (tag === undefined) return invalidPayloads();
    const length = new DataView(input.buffer, input.byteOffset + offset + 1, 4).getUint32(0, false);
    offset += 5;
    if (input.byteLength - offset < length) return invalidPayloads();
    frames.push({ tag, payload: input.slice(offset, offset + length) });
    offset += length;
  }
  return { ok: true, value: frames };
}

function hasExactTags(frames: readonly EncodedFrame[], tags: readonly number[]): boolean {
  return frames.length === tags.length && frames.every(({ tag }, index) => tag === tags[index]);
}

function decodeMapEntity(common: object, payloads: readonly Uint8Array[]): object | undefined {
  const mapId = readUuid(payloads[6]);
  const entityId = readUuid(payloads[7]);
  return mapId === undefined || entityId === undefined
    ? undefined
    : { ...common, seedScope: 'map/entity', mapId, entityId };
}

function decodeRootCoordinate(common: object, payloads: readonly Uint8Array[]): object | undefined {
  const rootSurfaceId = readUuid(payloads[6]);
  const longitudeTicks = readSigned32(payloads[7]);
  const latitudeTicks = readSigned32(payloads[8]);
  return rootSurfaceId === undefined || longitudeTicks === undefined || latitudeTicks === undefined
    ? undefined
    : {
        ...common,
        seedScope: 'root-coordinate',
        rootSurfaceId,
        point: { longitudeTicks, latitudeTicks },
      };
}

function decodeSharedBoundary(common: object, payloads: readonly Uint8Array[]): object | undefined {
  const boundaryPortalId = readUuid(payloads[6]);
  return boundaryPortalId === undefined
    ? undefined
    : { ...common, seedScope: 'shared-boundary', boundaryPortalId };
}

function frame(tag: number, payload: Uint8Array): Uint8Array {
  const output = new Uint8Array(5 + payload.byteLength);
  const view = new DataView(output.buffer);
  output[0] = tag;
  view.setUint32(1, payload.byteLength, false);
  output.set(payload, 5);
  return output;
}

function ascii(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function unsigned64(value: bigint): Uint8Array {
  const output = new Uint8Array(8);
  new DataView(output.buffer).setBigUint64(0, value, false);
  return output;
}

function signed32(value: number): Uint8Array {
  const output = new Uint8Array(4);
  new DataView(output.buffer).setInt32(0, value, false);
  return output;
}

function uuidBytes(value: string): Uint8Array {
  const hex = value.replaceAll('-', '');
  const bytes = new Uint8Array(16);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function concatenate(parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function startsWith(input: Uint8Array, prefix: Uint8Array): boolean {
  return (
    input.byteLength >= prefix.byteLength && prefix.every((byte, index) => input[index] === byte)
  );
}

function readUnsigned64(bytes: Uint8Array | undefined): bigint | undefined {
  return bytes?.byteLength === 8
    ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(0, false)
    : undefined;
}

function readSafeUnsigned64(bytes: Uint8Array | undefined): number | undefined {
  const value = readUnsigned64(bytes);
  return value !== undefined && value <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(value)
    : undefined;
}

function readSigned32(bytes: Uint8Array | undefined): number | undefined {
  return bytes?.byteLength === 4
    ? new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getInt32(0, false)
    : undefined;
}

function readAscii(bytes: Uint8Array | undefined): string | undefined {
  if (bytes === undefined || bytes.some((byte) => byte > 0x7f)) return undefined;
  return String.fromCharCode(...bytes);
}

function readUuid(bytes: Uint8Array | undefined): string | undefined {
  if (bytes?.byteLength !== 16) return undefined;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function derivedSeedFromBytes(bytes: Uint8Array): DerivedSeed {
  const immutableBytes = Object.freeze(Array.from(bytes));
  const hex = immutableBytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return Object.freeze({ bytes: immutableBytes, hex }) as DerivedSeed;
}

function invalidPayloads<Value>(): SeedDerivationResult<Value> {
  return failure(
    SEED_DERIVATION_DIAGNOSTIC_CODES.invalidEncodingFields,
    'Seed input field framing or payload length is invalid.',
  );
}

function failure<Value>(
  code: SeedDerivationDiagnosticCode,
  message: string,
): SeedDerivationResult<Value> {
  return { ok: false, diagnostic: { code, message } };
}
