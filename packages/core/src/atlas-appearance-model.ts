/** Accepted, projection-neutral Milestone 2 atlas appearance contracts. */

import type { PlanetPoint } from './coordinates.js';
import type { CoastlineRingId, EntityId, SemanticKey } from './identity.js';

export const ATLAS_COASTLINE_APPEARANCE_BEHAVIOR_VERSION = 1 as const;
export const ATLAS_WATER_DECORATION_BEHAVIOR_VERSION = 1 as const;
export const ATLAS_PAPER_TREATMENT_BEHAVIOR_VERSION = 1 as const;
export const ATLAS_STYLE_TOKEN_VERSION = 1 as const;

/** Explicit style identity recorded by every accepted appearance output. */
export interface AtlasStyleProvenance {
  readonly styleId: SemanticKey;
  readonly styleBehaviorVersion: 1;
}

/** Renderer-neutral colors for one closed atlas style. */
export interface AtlasStyleColorTokens {
  readonly ink: string;
  readonly water: string;
  readonly waterInk: string;
  readonly land: string;
  readonly paper: string;
  readonly paperGrain: string;
}

/** Physical scene-space ink parameters; accepted outputs retain only unitless decisions. */
export interface AtlasStyleCoastlineTokens {
  readonly primaryWidthPx: number;
  readonly pressureVariationPx: number;
  readonly maximumWobblePx: number;
  readonly primaryWavelengthPx: number;
  readonly secondaryWavelengthPx: number;
  readonly pressureWavelengthPx: number;
  readonly strokeSegmentLengthPx: number;
}

export interface AtlasStyleWaterDecorationTokens {
  readonly echoWidthPx: number;
  readonly waterMarkWidthPx: number;
}

export interface AtlasStylePaperTokens {
  readonly grainCount: number;
  readonly grainLengthPx: number;
  readonly grainWidthPx: number;
}

/** Complete versioned token set supplied to scene composition by the owning asset package. */
export interface AtlasStyleTokens extends AtlasStyleProvenance {
  readonly tokenVersion: typeof ATLAS_STYLE_TOKEN_VERSION;
  readonly colors: AtlasStyleColorTokens;
  readonly coastline: AtlasStyleCoastlineTokens;
  readonly waterDecoration: AtlasStyleWaterDecorationTokens;
  readonly paper: AtlasStylePaperTokens;
}

/** One stable, unitless ink decision linked to an unchanged canonical coastline ring. */
export interface AtlasCoastlineInkDecision {
  readonly sourceRingId: CoastlineRingId;
  readonly sourceBoundaryFingerprint: string;
  readonly wobblePhasePermille: number;
  readonly wobbleStrengthPermille: number;
  readonly secondaryPhasePermille: number;
  readonly pressurePhasePermille: number;
  readonly pressureStrengthPermille: number;
}

export interface AtlasCoastlineAppearance {
  readonly appearanceBehaviorVersion: typeof ATLAS_COASTLINE_APPEARANCE_BEHAVIOR_VERSION;
  readonly style: AtlasStyleProvenance;
  readonly ringDecisions: readonly AtlasCoastlineInkDecision[];
}

/** A source-linked decorative path held in canonical planet-native coordinates. */
export interface AtlasWaterDecorationPath {
  readonly decorationId: string;
  readonly kind: 'coastal-echo' | 'water-mark';
  readonly sourceEntityId: EntityId;
  readonly sourceRingId?: CoastlineRingId;
  readonly sourceBoundaryFingerprint?: string;
  readonly relatedSourceIds: readonly (CoastlineRingId | EntityId)[];
  readonly weightPermille: number;
  readonly points: readonly PlanetPoint[];
}

export interface AtlasWaterDecoration {
  readonly decorationBehaviorVersion: typeof ATLAS_WATER_DECORATION_BEHAVIOR_VERSION;
  readonly style: AtlasStyleProvenance;
  readonly paths: readonly AtlasWaterDecorationPath[];
}

/** Accepted paper decisions are parameters, never raster pixels or a generated texture. */
export interface AtlasPaperTreatment {
  readonly treatmentBehaviorVersion: typeof ATLAS_PAPER_TREATMENT_BEHAVIOR_VERSION;
  readonly style: AtlasStyleProvenance;
  readonly grainPhaseXPermille: number;
  readonly grainPhaseYPermille: number;
  readonly grainAnglePermille: number;
  readonly grainDensityPermille: number;
  readonly grainLengthPermille: number;
}

/** Complete accepted appearance output owned by the atlas-presentation singleton. */
export interface AtlasAppearanceRecords {
  readonly atlasPresentationEntityId: EntityId;
  readonly coastlineAppearance: AtlasCoastlineAppearance;
  readonly waterDecoration: AtlasWaterDecoration;
  readonly paperTreatment: AtlasPaperTreatment;
}
