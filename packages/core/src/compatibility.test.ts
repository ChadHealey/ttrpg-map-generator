import { describe, expect, it } from 'vitest';

import {
  type BehaviorVersion,
  COMPATIBILITY_DIAGNOSTIC_CODES,
  createBehaviorVersion,
  createDeterministicStreamVersion,
  createParameterSchemaVersion,
  createSeedDerivationVersion,
  createVariantRevision,
  type DeterministicStreamVersion,
  incrementVariantRevision,
  type ParameterSchemaVersion,
  parseBehaviorVersion,
  parseParameterSchemaVersion,
  parseSeedDerivationVersion,
  parseVariantRevision,
  type SeedDerivationVersion,
  type VariantRevision,
} from './compatibility.js';

function expectValue<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false },
): T {
  if (!result.ok) {
    throw new Error('Expected a successful compatibility parse result.');
  }

  return result.value;
}

describe('compatibility values', () => {
  it('accepts positive safe integers as behavior and parameter schema versions', () => {
    expect(createBehaviorVersion(1)).toStrictEqual({ ok: true, value: 1 });
    expect(createParameterSchemaVersion(Number.MAX_SAFE_INTEGER)).toStrictEqual({
      ok: true,
      value: Number.MAX_SAFE_INTEGER,
    });
  });

  it('keeps seed-derivation and deterministic-stream versions explicit and positive', () => {
    expect(createSeedDerivationVersion(1)).toStrictEqual({ ok: true, value: 1 });
    expect(createDeterministicStreamVersion(Number.MAX_SAFE_INTEGER)).toStrictEqual({
      ok: true,
      value: Number.MAX_SAFE_INTEGER,
    });
    expect(parseSeedDerivationVersion(0)).toStrictEqual({
      ok: false,
      diagnostic: {
        code: COMPATIBILITY_DIAGNOSTIC_CODES.invalidSeedDerivationVersion,
        message: 'Seed-derivation version must be a positive safe integer.',
      },
    });
  });

  it('rejects invalid behavior versions with a stable actionable diagnostic', () => {
    expect(parseBehaviorVersion(0)).toStrictEqual({
      ok: false,
      diagnostic: {
        code: COMPATIBILITY_DIAGNOSTIC_CODES.invalidBehaviorVersion,
        message: 'Behavior version must be a positive safe integer.',
      },
    });
    expect(parseBehaviorVersion(Number.MAX_SAFE_INTEGER + 1)).toMatchObject({ ok: false });
    expect(parseBehaviorVersion('1')).toMatchObject({ ok: false });
  });

  it('rejects invalid parameter schema versions with a stable actionable diagnostic', () => {
    expect(parseParameterSchemaVersion(-1)).toStrictEqual({
      ok: false,
      diagnostic: {
        code: COMPATIBILITY_DIAGNOSTIC_CODES.invalidParameterSchemaVersion,
        message: 'Parameter schema version must be a positive safe integer.',
      },
    });
    expect(parseParameterSchemaVersion(1.5)).toMatchObject({ ok: false });
    expect(parseParameterSchemaVersion(Number.NaN)).toMatchObject({ ok: false });
  });

  it('uses zero as the initial variant revision and increments it explicitly', () => {
    const initialRevision = expectValue(createVariantRevision(0));

    expect(incrementVariantRevision(initialRevision)).toStrictEqual({ ok: true, value: 1 });
  });

  it('rejects invalid variant revisions and prevents revision overflow', () => {
    expect(parseVariantRevision(-1)).toStrictEqual({
      ok: false,
      diagnostic: {
        code: COMPATIBILITY_DIAGNOSTIC_CODES.invalidVariantRevision,
        message: 'Variant revision must be a non-negative safe integer.',
      },
    });
    expect(parseVariantRevision(Number.MAX_SAFE_INTEGER + 1)).toMatchObject({ ok: false });

    const maximumRevision = expectValue(createVariantRevision(Number.MAX_SAFE_INTEGER));
    expect(incrementVariantRevision(maximumRevision)).toStrictEqual({
      ok: false,
      diagnostic: {
        code: COMPATIBILITY_DIAGNOSTIC_CODES.variantRevisionExhausted,
        message: 'Variant revision cannot be incremented beyond Number.MAX_SAFE_INTEGER.',
      },
    });
  });

  it('keeps behavior versions, parameter schema versions, and revisions distinct at compile time', () => {
    const behaviorVersion = expectValue(createBehaviorVersion(1));
    const parameterSchemaVersion = expectValue(createParameterSchemaVersion(1));
    const seedDerivationVersion = expectValue(createSeedDerivationVersion(1));
    const deterministicStreamVersion = expectValue(createDeterministicStreamVersion(1));
    const variantRevision = expectValue(createVariantRevision(0));

    function acceptsBehaviorVersion(value: BehaviorVersion): void {
      void value;
    }
    function acceptsParameterSchemaVersion(value: ParameterSchemaVersion): void {
      void value;
    }
    function acceptsVariantRevision(value: VariantRevision): void {
      void value;
    }
    function acceptsSeedDerivationVersion(value: SeedDerivationVersion): void {
      void value;
    }
    function acceptsDeterministicStreamVersion(value: DeterministicStreamVersion): void {
      void value;
    }

    acceptsBehaviorVersion(behaviorVersion);
    acceptsParameterSchemaVersion(parameterSchemaVersion);
    acceptsVariantRevision(variantRevision);
    acceptsSeedDerivationVersion(seedDerivationVersion);
    acceptsDeterministicStreamVersion(deterministicStreamVersion);

    // @ts-expect-error Behavior versions cannot stand in for parameter schema versions.
    acceptsParameterSchemaVersion(behaviorVersion);
    // @ts-expect-error Parameter schema versions cannot stand in for variant revisions.
    acceptsVariantRevision(parameterSchemaVersion);
    // @ts-expect-error Variant revisions cannot stand in for behavior versions.
    acceptsBehaviorVersion(variantRevision);
    // @ts-expect-error Seed-derivation versions cannot stand in for stream versions.
    acceptsDeterministicStreamVersion(seedDerivationVersion);
    // @ts-expect-error Stream versions cannot stand in for generator behavior versions.
    acceptsBehaviorVersion(deterministicStreamVersion);
  });
});
