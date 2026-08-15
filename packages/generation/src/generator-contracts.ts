/**
 * Pure proposal-oriented generator contracts.
 *
 * A generator receives only readonly project-owned values and an explicit deterministic stream.
 * This surface deliberately exposes no document commit, persistence, filesystem, UI, DOM,
 * Canvas, clock, worker, or cache capability.
 */

import {
  type AspectDependencyReference,
  type AspectGenerationTarget,
  type AspectName,
  type AspectReference,
  type AspectReplacementProposal,
  type BehaviorVersion,
  type CommitAspectProposalCommand,
  compareStableReferences,
  type DeepReadonly,
  type DeterministicRandomStream,
  DOCUMENT_COMMAND_KINDS,
  type DocumentDependencyEffect,
  type GenerationDiagnostic,
  type GenerationDiagnosticCode,
  type GeneratorId,
  orderGenerationDiagnostics,
  type ParameterSchemaVersion,
  type SeedInput,
  type SeedScope,
  type VariantRevision,
} from '@ttrpg-map/core';

/** Parameter schema versions accepted by this generator implementation. */
export interface GeneratorParameterCompatibility {
  readonly currentVersion: ParameterSchemaVersion;
  readonly acceptedVersions: readonly ParameterSchemaVersion[];
}

/** Generator-owned validation codes that may be returned before a proposal can be committed. */
export interface GeneratorValidationResponsibility {
  readonly owner: 'generator';
  readonly diagnosticCodes: readonly GenerationDiagnosticCode[];
}

/** Minimal declaration of behavior, dependencies, isolation, parameters, and validation. */
export interface GeneratorManifest {
  readonly generatorId: GeneratorId;
  readonly generatorVersion: BehaviorVersion;
  readonly parameterCompatibility: GeneratorParameterCompatibility;
  readonly inputAspects: readonly AspectName[];
  readonly outputAspects: readonly AspectName[];
  readonly seedScope: SeedScope;
  readonly validation: GeneratorValidationResponsibility;
}

/** A readonly accepted dependency made available to planning and generation. */
export interface GenerationInput<Output = unknown> {
  readonly reference: AspectReference;
  readonly aspectName: AspectName;
  readonly variantRevision: VariantRevision;
  readonly acceptedOutput: DeepReadonly<Output>;
}

/** The accepted inputs visible to a generator, with no containing document or mutation API. */
export interface GenerationReadContext<Input = unknown> {
  readonly inputs: readonly GenerationInput<Input>[];
}

/** Readonly generation inputs plus the one explicit random capability used by the proposal. */
export interface GenerationContext<
  Input = unknown,
  SeedMetadata extends SeedInput = SeedInput,
> extends GenerationReadContext<Input> {
  readonly seedMetadata: DeepReadonly<SeedMetadata>;
  readonly random: DeterministicRandomStream;
}

/** The stable map/entity/aspect address selected for generation. */
export type GenerationTarget = AspectGenerationTarget;

/** Immutable base plan shared by concrete generator-specific plans. */
export interface GenerationPlan {
  readonly target: GenerationTarget;
  readonly dependencyAspects: readonly AspectDependencyReference[];
  readonly seedScope: SeedScope;
}

/** A complete proposed replacement that a later transaction service may validate and commit. */
export type GenerationProposal<
  Parameters = unknown,
  Output = unknown,
  SeedMetadata extends SeedInput = SeedInput,
> = AspectReplacementProposal<Parameters, Output, SeedMetadata>;

/** Result of generator-owned validation; invalid output remains inspectable but not committable. */
export type GenerationProposalValidation<
  Parameters = unknown,
  Output = unknown,
  SeedMetadata extends SeedInput = SeedInput,
> =
  | {
      readonly status: 'proposed';
      readonly proposal: GenerationProposal<Parameters, Output, SeedMetadata>;
      readonly diagnostics: readonly GenerationDiagnostic[];
    }
  | {
      readonly status: 'invalid';
      readonly proposal: GenerationProposal<Parameters, Output, SeedMetadata>;
      readonly diagnostics: readonly GenerationDiagnostic[];
    };

/** Readonly validation inputs kept separate from the random generation capability. */
export interface GenerationValidationContext<Input = unknown> extends GenerationReadContext<Input> {
  readonly target: GenerationTarget;
}

/**
 * A generator plans and proposes accepted-aspect replacements but cannot commit them.
 * Expected invalid output is reported through diagnostics rather than thrown strings.
 */
export interface Generator<
  Parameters,
  Output,
  Input = unknown,
  SeedMetadata extends SeedInput = SeedInput,
  Plan extends GenerationPlan = GenerationPlan,
> {
  readonly manifest: GeneratorManifest;
  readonly plan: (context: GenerationReadContext<Input>, target: GenerationTarget) => Plan;
  readonly generate: (
    context: GenerationContext<Input, SeedMetadata>,
    plan: Plan,
    parameters: DeepReadonly<Parameters>,
  ) => GenerationProposal<Parameters, Output, SeedMetadata>;
  readonly validate: (
    proposal: GenerationProposal<Parameters, Output, SeedMetadata>,
    context: GenerationValidationContext<Input>,
  ) => readonly GenerationDiagnostic[];
}

/** Order opaque aspect references by their canonical stable-ID encoding. */
export function orderAspectReferences<Reference extends AspectReference>(
  references: readonly Reference[],
): readonly Reference[] {
  return Object.freeze(
    [...references].sort((left, right) => compareStableReferences(left.aspectId, right.aspectId)),
  );
}

/**
 * Return a platform-independent diagnostic order. Human-readable text is only a final tie-break;
 * callers make decisions from severity and stable code.
 */
export { orderGenerationDiagnostics };

/** Apply generator-owned validation and make expected invalid output explicit. */
export function validateGenerationProposal<
  Parameters,
  Output,
  Input,
  SeedMetadata extends SeedInput,
>(
  generator: Pick<Generator<Parameters, Output, Input, SeedMetadata>, 'validate'>,
  proposal: GenerationProposal<Parameters, Output, SeedMetadata>,
  context: GenerationValidationContext<Input>,
): GenerationProposalValidation<Parameters, Output, SeedMetadata> {
  const diagnostics = orderGenerationDiagnostics([
    ...proposal.diagnostics,
    ...generator.validate(proposal, context),
  ]);
  const status = diagnostics.some((diagnostic) => diagnostic.severity === 'error')
    ? 'invalid'
    : 'proposed';

  return Object.freeze({ status, proposal, diagnostics });
}

/**
 * Build the named document command from the complete generator-validation result. Invalid
 * validation results remain representable so the transaction can return its stable rejection.
 */
export function createCommitAspectProposalCommand<
  Parameters,
  Output,
  SeedMetadata extends SeedInput,
>(
  validation: GenerationProposalValidation<Parameters, Output, SeedMetadata>,
  expectedPreviousRevision: VariantRevision,
  declaredDependencyEffects: readonly DocumentDependencyEffect[],
): CommitAspectProposalCommand {
  const target = validation.proposal.target;
  return Object.freeze({
    kind: DOCUMENT_COMMAND_KINDS.commitAspectProposal,
    target: Object.freeze({
      mapId: target.mapId,
      entityId: target.entityId,
      aspectId: target.aspect.aspectId,
    }),
    expectedPreviousRevision,
    proposedReplacement: validation.proposal,
    diagnostics: validation.diagnostics,
    declaredDependencyEffects: Object.freeze([...declaredDependencyEffects]),
  });
}
