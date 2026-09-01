/** Deterministic procedural asset-family contracts and implementations. */

export {
  ATLAS_APPEARANCE_DIAGNOSTIC_CODES,
  ATLAS_APPEARANCE_GENERATOR_MANIFEST_VERSION,
  ATLAS_APPEARANCE_GENERATOR_MANIFESTS,
  ATLAS_APPEARANCE_PARAMETER_SCHEMA_VERSION,
  type AtlasAppearanceAspectProposal,
  type AtlasAppearanceDiagnostic,
  type AtlasAppearanceDiagnosticCode,
  type AtlasAppearanceGenerationInput,
  type AtlasAppearanceGenerationResult,
  type AtlasAppearanceGenerationRuntime,
  type AtlasAppearanceProposedPatch,
  type AtlasAppearanceVariantRevisions,
  createAtlasAppearanceSeedInputs,
  createInitialAtlasAppearanceRevisions,
  generateAtlasAppearance,
} from './atlas-appearance-generator.js';
export { ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_PACK } from './atlas-glyph-pack.js';
export {
  RESTRAINED_INK_ATLAS_STYLE,
  RESTRAINED_INK_ATLAS_STYLE_BEHAVIOR_VERSION,
} from './restrained-ink-atlas-style.js';
