/** Pure generator contracts and implementations with no UI, persistence, or renderer access. */

export {
  type GenerationContext,
  type GenerationInput,
  type GenerationPlan,
  type GenerationProposal,
  type GenerationProposalValidation,
  type GenerationReadContext,
  type GenerationTarget,
  type GenerationValidationContext,
  type Generator,
  type GeneratorManifest,
  type GeneratorParameterCompatibility,
  type GeneratorValidationResponsibility,
  orderAspectReferences,
  orderGenerationDiagnostics,
  validateGenerationProposal,
} from './generator-contracts.js';
export type { DeterministicRandomStream } from '@ttrpg-map/core';
