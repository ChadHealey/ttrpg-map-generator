/**
 * Generator-independent metadata for accepted aspects and actionable findings.
 *
 * These records contain no generator implementation, persistence adapter, render value, or
 * document mutation capability. Dependencies and diagnostic targets use opaque aspect IDs;
 * aspect names are descriptive labels rather than references.
 */

import type { BehaviorVersion, ParameterSchemaVersion, VariantRevision } from './compatibility.js';
import type { AspectId, EntityId, GeneratorId, MapId } from './identity.js';
import type { SeedInput } from './seed-input.js';

declare const ASPECT_NAME_BRAND: unique symbol;
declare const GENERATION_DIAGNOSTIC_CODE_BRAND: unique symbol;

/** A validated descriptive aspect label such as `proof.markers`. */
export type AspectName = string & { readonly [ASPECT_NAME_BRAND]: true };

/** A stable machine-readable diagnostic code such as `proof.markers.outside-outline`. */
export type GenerationDiagnosticCode = string & {
  readonly [GENERATION_DIAGNOSTIC_CODE_BRAND]: true;
};

/** The fixed seed-isolation categories declared by generator and accepted-aspect metadata. */
export type SeedScope = 'map/entity' | 'root-coordinate' | 'shared-boundary';

/** Lifecycle states that may appear in proposal or accepted-aspect records. */
export type GenerationStatus = 'accepted' | 'invalid' | 'proposed';

/** A dependency or target reference whose identity cannot drift when an aspect is renamed. */
export interface AspectReference {
  readonly aspectId: AspectId;
}

export const ASPECT_DEPENDENCY_PROVENANCE_KINDS = {
  inheritedContext: 'inherited-context',
} as const;

/** Minimal provenance required when an aspect dependency crosses a map boundary. */
export interface InheritedContextDependencyProvenance {
  readonly kind: typeof ASPECT_DEPENDENCY_PROVENANCE_KINDS.inheritedContext;
  readonly parentMapId: MapId;
  readonly childMapId: MapId;
}

/**
 * A stable upstream-aspect reference. Same-map dependencies omit provenance; cross-map
 * dependencies must declare the inherited-context boundary they cross.
 */
export interface AspectDependencyReference extends AspectReference {
  readonly contextProvenance?: InheritedContextDependencyProvenance;
}

/** Severity controls whether a proposal may cross the later document transaction boundary. */
export type GenerationDiagnosticSeverity = 'error' | 'warning';

/** An actionable generator finding with a stable code and opaque target. */
export interface GenerationDiagnostic {
  readonly code: GenerationDiagnosticCode;
  readonly severity: GenerationDiagnosticSeverity;
  readonly target: AspectReference;
  readonly message: string;
  readonly suggestedAction: string;
}

/** The stable map/entity/aspect address selected for one generated replacement. */
export interface AspectGenerationTarget {
  readonly mapId: MapId;
  readonly entityId: EntityId;
  readonly aspect: AspectReference;
  readonly aspectName: AspectName;
  readonly variantRevision: VariantRevision;
}

/**
 * A complete generator proposal understood by the document transaction without exposing the
 * generator implementation to `core`.
 */
export interface AspectReplacementProposal<
  Parameters = unknown,
  Output = unknown,
  SeedMetadata extends SeedInput = SeedInput,
> {
  readonly status: 'proposed';
  readonly target: AspectGenerationTarget;
  readonly generatorId: GeneratorId;
  readonly generatorVersion: BehaviorVersion;
  readonly parameterSchemaVersion: ParameterSchemaVersion;
  readonly parameters: DeepReadonly<Parameters>;
  readonly seedScope: SeedScope;
  readonly seedMetadata: DeepReadonly<SeedMetadata>;
  readonly dependencyAspects: readonly AspectDependencyReference[];
  readonly output: DeepReadonly<Output>;
  readonly diagnostics: readonly GenerationDiagnostic[];
}

/** Recursively readonly view used at generator boundaries. */
export type DeepReadonly<Value> = Value extends
  null | undefined | string | number | boolean | bigint | symbol
  ? Value
  : Value extends (...arguments_: never[]) => unknown
    ? Value
    : Value extends readonly (infer Item)[]
      ? readonly DeepReadonly<Item>[]
      : Value extends object
        ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
        : Value;

/**
 * One complete accepted aspect record at the canonical per-aspect comparison boundary.
 * Canonical serialization is deliberately owned by later persistence work.
 */
export interface AcceptedAspectRecord<
  Parameters = unknown,
  Output = unknown,
  SeedMetadata extends SeedInput = SeedInput,
> {
  readonly mapId: MapId;
  readonly entityId: EntityId;
  readonly aspectId: AspectId;
  readonly aspectName: AspectName;
  readonly generatorId: GeneratorId;
  readonly generatorVersion: BehaviorVersion;
  readonly parameterSchemaVersion: ParameterSchemaVersion;
  readonly parameters: DeepReadonly<Parameters>;
  readonly seedScope: SeedMetadata['seedScope'];
  readonly seedMetadata: DeepReadonly<SeedMetadata>;
  readonly variantRevision: VariantRevision;
  readonly dependencyAspects: readonly AspectDependencyReference[];
  readonly generationStatus: 'accepted';
  readonly diagnostics: readonly GenerationDiagnostic[];
  readonly acceptedOutput: DeepReadonly<Output>;
}

export const GENERATED_ASPECT_DIAGNOSTIC_CODES = {
  invalidAspectName: 'generation.aspect-name.invalid',
  invalidDiagnosticCode: 'generation.diagnostic-code.invalid',
} as const;

export type GeneratedAspectContractDiagnosticCode =
  (typeof GENERATED_ASPECT_DIAGNOSTIC_CODES)[keyof typeof GENERATED_ASPECT_DIAGNOSTIC_CODES];

/** A stable boundary failure returned when symbolic aspect metadata is invalid. */
export interface GeneratedAspectContractDiagnostic {
  readonly code: GeneratedAspectContractDiagnosticCode;
  readonly message: string;
}

export type GeneratedAspectContractParseResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly diagnostic: GeneratedAspectContractDiagnostic };

const ASPECT_NAME_PATTERN = /^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*)+$/;
const DIAGNOSTIC_CODE_PATTERN = /^[a-z](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z](?:[a-z0-9-]*[a-z0-9])?)+$/;
const MAX_SYMBOLIC_VALUE_LENGTH = 128;

/** Parse an unknown descriptive aspect name without normalization or coercion. */
export function parseAspectName(input: unknown): GeneratedAspectContractParseResult<AspectName> {
  if (!isValidSymbolicValue(input, ASPECT_NAME_PATTERN)) {
    return {
      ok: false,
      diagnostic: {
        code: GENERATED_ASPECT_DIAGNOSTIC_CODES.invalidAspectName,
        message:
          'Aspect name must contain two or more lower-camel dot-separated ASCII segments (maximum 128 characters).',
      },
    };
  }

  return { ok: true, value: input as AspectName };
}

/** Parse an unknown stable generation diagnostic code without normalization or coercion. */
export function parseGenerationDiagnosticCode(
  input: unknown,
): GeneratedAspectContractParseResult<GenerationDiagnosticCode> {
  if (!isValidSymbolicValue(input, DIAGNOSTIC_CODE_PATTERN)) {
    return invalidSymbolicValue(
      GENERATED_ASPECT_DIAGNOSTIC_CODES.invalidDiagnosticCode,
      'Generation diagnostic code',
    );
  }

  return { ok: true, value: input as GenerationDiagnosticCode };
}

/** Return a platform-independent order for persisted and transaction diagnostics. */
export function orderGenerationDiagnostics(
  diagnostics: readonly GenerationDiagnostic[],
): readonly GenerationDiagnostic[] {
  return Object.freeze([...diagnostics].sort(compareGenerationDiagnostics));
}

function isValidSymbolicValue(input: unknown, pattern: RegExp): input is string {
  return (
    typeof input === 'string' && input.length <= MAX_SYMBOLIC_VALUE_LENGTH && pattern.test(input)
  );
}

function invalidSymbolicValue(
  code: GeneratedAspectContractDiagnosticCode,
  label: string,
): GeneratedAspectContractParseResult<never> {
  return {
    ok: false,
    diagnostic: {
      code,
      message: `${label} must contain two or more lowercase dot-separated segments; every segment begins with a lowercase letter and otherwise uses letters, digits, or internal hyphens (maximum 128 characters).`,
    },
  };
}

function compareGenerationDiagnostics(
  left: GenerationDiagnostic,
  right: GenerationDiagnostic,
): number {
  return (
    compareAscii(left.target.aspectId, right.target.aspectId) ||
    compareAscii(left.code, right.code) ||
    compareAscii(left.severity, right.severity) ||
    compareAscii(left.message, right.message) ||
    compareAscii(left.suggestedAction, right.suggestedAction)
  );
}

function compareAscii(left: string, right: string): -1 | 0 | 1 {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
