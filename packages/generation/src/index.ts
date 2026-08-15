/** Pure generator contracts and implementations with no UI, persistence, or renderer access. */

export {
  createCommitAspectProposalCommand,
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
export {
  PROOF_MARKER_ASPECT_ID,
  PROOF_MARKER_ASPECT_NAME,
  PROOF_MARKER_GENERATOR_ID,
  PROOF_MARKER_PARAMETERS,
  PROOF_OUTLINE_ASPECT_ID,
  PROOF_OUTLINE_ASPECT_NAME,
  type ProofMarker,
  proofMarkerGenerator,
  type ProofMarkerOutput,
  type ProofMarkerParameters,
  type ProofMarkerPlan,
  type ProofOutlineOutput,
} from './proof-marker-generator.js';
export type { DeterministicRandomStream } from '@ttrpg-map/core';
