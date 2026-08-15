/**
 * Compatibility values are nominal types so behavior versions, parameter schema versions, and
 * reroll counters cannot be accidentally exchanged at domain boundaries.
 */
declare const COMPATIBILITY_VALUE_BRAND: unique symbol;

type CompatibilityValue<TName extends string> = number & {
  readonly [COMPATIBILITY_VALUE_BRAND]: TName;
};

/** A version for output-affecting generator behavior. */
export type BehaviorVersion = CompatibilityValue<'BehaviorVersion'>;

/** A version for a generator's persisted parameter shape. */
export type ParameterSchemaVersion = CompatibilityValue<'ParameterSchemaVersion'>;

/** An intentionally incremented counter selecting a generated variant. */
export type VariantRevision = CompatibilityValue<'VariantRevision'>;

/** Stable codes emitted while validating compatibility values at a trust boundary. */
export const COMPATIBILITY_DIAGNOSTIC_CODES = {
  invalidBehaviorVersion: 'compatibility.behavior-version.invalid',
  invalidParameterSchemaVersion: 'compatibility.parameter-schema-version.invalid',
  invalidVariantRevision: 'compatibility.variant-revision.invalid',
  variantRevisionExhausted: 'compatibility.variant-revision.exhausted',
} as const;

export type CompatibilityDiagnosticCode =
  (typeof COMPATIBILITY_DIAGNOSTIC_CODES)[keyof typeof COMPATIBILITY_DIAGNOSTIC_CODES];

/** A stable, actionable finding returned when compatibility metadata is invalid. */
export interface CompatibilityDiagnostic {
  readonly code: CompatibilityDiagnosticCode;
  readonly message: string;
}

/** The result of converting unknown boundary input into a compatibility value. */
export type CompatibilityParseResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly diagnostic: CompatibilityDiagnostic;
    };

function isSafeIntegerAtLeast(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}

function invalidResult<T>(
  code: CompatibilityDiagnosticCode,
  message: string,
): CompatibilityParseResult<T> {
  return { ok: false, diagnostic: { code, message } };
}

function parsePositiveVersion<T>(
  value: unknown,
  code: CompatibilityDiagnosticCode,
  label: string,
): CompatibilityParseResult<T> {
  if (!isSafeIntegerAtLeast(value, 1)) {
    return invalidResult(code, `${label} must be a positive safe integer.`);
  }

  return { ok: true, value: value as T };
}

/** Validates unknown input as a behavior version. */
export function parseBehaviorVersion(value: unknown): CompatibilityParseResult<BehaviorVersion> {
  return parsePositiveVersion(
    value,
    COMPATIBILITY_DIAGNOSTIC_CODES.invalidBehaviorVersion,
    'Behavior version',
  );
}

/** Explicitly constructs a behavior version from a numeric caller value. */
export function createBehaviorVersion(value: number): CompatibilityParseResult<BehaviorVersion> {
  return parseBehaviorVersion(value);
}

/** Validates unknown input as a parameter schema version. */
export function parseParameterSchemaVersion(
  value: unknown,
): CompatibilityParseResult<ParameterSchemaVersion> {
  return parsePositiveVersion(
    value,
    COMPATIBILITY_DIAGNOSTIC_CODES.invalidParameterSchemaVersion,
    'Parameter schema version',
  );
}

/** Explicitly constructs a parameter schema version from a numeric caller value. */
export function createParameterSchemaVersion(
  value: number,
): CompatibilityParseResult<ParameterSchemaVersion> {
  return parseParameterSchemaVersion(value);
}

/** Validates unknown input as an intentionally incremented variant revision. */
export function parseVariantRevision(value: unknown): CompatibilityParseResult<VariantRevision> {
  if (!isSafeIntegerAtLeast(value, 0)) {
    return invalidResult(
      COMPATIBILITY_DIAGNOSTIC_CODES.invalidVariantRevision,
      'Variant revision must be a non-negative safe integer.',
    );
  }

  return { ok: true, value: value as VariantRevision };
}

/** Explicitly constructs a variant revision from a numeric caller value. */
export function createVariantRevision(value: number): CompatibilityParseResult<VariantRevision> {
  return parseVariantRevision(value);
}

/**
 * Advances a revision by one without wrapping or silently selecting a prior variant.
 */
export function incrementVariantRevision(
  revision: VariantRevision,
): CompatibilityParseResult<VariantRevision> {
  if (revision >= Number.MAX_SAFE_INTEGER) {
    return invalidResult(
      COMPATIBILITY_DIAGNOSTIC_CODES.variantRevisionExhausted,
      'Variant revision cannot be incremented beyond Number.MAX_SAFE_INTEGER.',
    );
  }

  return { ok: true, value: (revision + 1) as VariantRevision };
}
