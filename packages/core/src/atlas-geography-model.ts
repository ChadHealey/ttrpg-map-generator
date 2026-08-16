/**
 * Accepted Milestone 2 whole-world geography contracts.
 *
 * These records hold semantic geography and canonical planet-native geometry only. They exclude
 * generator implementations, display projections, render scenes, persistence DTOs, previews, and
 * caches. Classification thresholds, matching, and coastline extraction remain future work.
 */

import type { PlanetPoint } from './coordinates.js';
import { type CoastlineRingId, type EntityId, type SurfaceComponentId } from './identity.js';

export const ATLAS_GEOGRAPHY_CONTRACT_VERSION = 1 as const;
export const ATLAS_FIELD_QUANTIZATION_SCALE = 2 ** 24;
export const ATLAS_FULL_PROFILE_ID = 'world-atlas-full-v1' as const;
export const ATLAS_FULL_LONGITUDE_CELL_COUNT = 2_048;
export const ATLAS_FULL_LATITUDE_BAND_COUNT = 1_024;
export const ATLAS_CANONICAL_FIELD_TRAVERSAL = 'south-pole-then-rows-then-north-pole' as const;

export const ATLAS_LANDMASS_KINDS = {
  continent: 'continent',
  island: 'island',
  majorIsland: 'majorIsland',
} as const;

export const ATLAS_ISLAND_GROUP_KINDS = {
  archipelago: 'archipelago',
  islandChain: 'islandChain',
} as const;

export const ATLAS_WATER_BODY_KINDS = {
  oceanBasin: 'oceanBasin',
  sea: 'sea',
} as const;

export const ATLAS_OCEAN_CONNECTIVITY = {
  connectedMajority: 'connectedMajority',
  multipleBasins: 'multipleBasins',
  singleGlobal: 'singleGlobal',
} as const;

export const ATLAS_CONTINENT_DISTRIBUTIONS = {
  balanced: 'balanced',
  oneDominant: 'oneDominant',
  varied: 'varied',
} as const;

export const ATLAS_POLAR_CHARACTERS = {
  landBiased: 'landBiased',
  neutral: 'neutral',
  oceanBiased: 'oceanBiased',
} as const;

export type AtlasLandmassKind = (typeof ATLAS_LANDMASS_KINDS)[keyof typeof ATLAS_LANDMASS_KINDS];
export type AtlasIslandGroupKind =
  (typeof ATLAS_ISLAND_GROUP_KINDS)[keyof typeof ATLAS_ISLAND_GROUP_KINDS];
export type AtlasWaterBodyKind =
  (typeof ATLAS_WATER_BODY_KINDS)[keyof typeof ATLAS_WATER_BODY_KINDS];
export type AtlasOceanConnectivity =
  (typeof ATLAS_OCEAN_CONNECTIVITY)[keyof typeof ATLAS_OCEAN_CONNECTIVITY];
export type AtlasContinentDistribution =
  (typeof ATLAS_CONTINENT_DISTRIBUTIONS)[keyof typeof ATLAS_CONTINENT_DISTRIBUTIONS];
export type AtlasPolarCharacter =
  (typeof ATLAS_POLAR_CHARACTERS)[keyof typeof ATLAS_POLAR_CHARACTERS];

/** Canonical accepted atlas controls; percentages are integer percentage points. */
export interface AtlasControls {
  readonly worldCircumferenceKm: number;
  readonly targetWaterCoveragePercent: number;
  readonly continentCountIntent: number;
  readonly continentDistribution: AtlasContinentDistribution;
  readonly fragmentationPercent: number;
  readonly islandAbundancePercent: number;
  readonly archipelagoAbundancePercent: number;
  readonly oceanConnectivity: AtlasOceanConnectivity;
  readonly polarCharacter: AtlasPolarCharacter;
}

export const DEFAULT_ATLAS_CONTROLS: AtlasControls = Object.freeze({
  worldCircumferenceKm: 40_000,
  targetWaterCoveragePercent: 65,
  continentCountIntent: 4,
  continentDistribution: ATLAS_CONTINENT_DISTRIBUTIONS.varied,
  fragmentationPercent: 35,
  islandAbundancePercent: 35,
  archipelagoAbundancePercent: 25,
  oceanConnectivity: ATLAS_OCEAN_CONNECTIVITY.singleGlobal,
  polarCharacter: ATLAS_POLAR_CHARACTERS.neutral,
});

/** Versioned, project-owned provenance for accepted quantized macro elevation. */
export interface MacroElevationFieldProvenance {
  readonly contractVersion: typeof ATLAS_GEOGRAPHY_CONTRACT_VERSION;
  readonly samplingProfileId: typeof ATLAS_FULL_PROFILE_ID;
  readonly samplingPolicyVersion: 1;
  readonly longitudeCellCount: typeof ATLAS_FULL_LONGITUDE_CELL_COUNT;
  readonly latitudeBandCount: typeof ATLAS_FULL_LATITUDE_BAND_COUNT;
  readonly canonicalTraversal: typeof ATLAS_CANONICAL_FIELD_TRAVERSAL;
  readonly fieldBehaviorVersion: 1;
  readonly quantizationScale: typeof ATLAS_FIELD_QUANTIZATION_SCALE;
}

/** A validated signed fixed-point macro elevation sample in [-2^24, 2^24]. */
export type MacroElevationValueTicks = number & {
  readonly __macroElevationValueTicks: unique symbol;
};

/** Accepted field values in ADR-0009 canonical sample traversal order. */
export interface MacroElevationField {
  readonly provenance: MacroElevationFieldProvenance;
  readonly values: readonly MacroElevationValueTicks[];
}

/** The accepted partition threshold is an odd doubled field tick. */
export interface LandWaterClassification {
  readonly classificationBehaviorVersion: 1;
  readonly seaLevelContourDoubledTicks: number;
  readonly landComponentIds: readonly SurfaceComponentId[];
  readonly waterComponentIds: readonly SurfaceComponentId[];
}

/** A component-local semantic entity; its name is never part of its identity. */
export interface Landmass {
  readonly entityId: EntityId;
  readonly componentId: SurfaceComponentId;
  readonly kind: AtlasLandmassKind;
  readonly containingWaterBodyId?: EntityId;
  readonly adjacentWaterBodyIds: readonly EntityId[];
}

/** A separately classified group of retained islands. */
export interface IslandGroup {
  readonly entityId: EntityId;
  readonly kind: AtlasIslandGroupKind;
  /** `islandChain` retains semantic chain order; `archipelago` IDs use canonical stable-ID order. */
  readonly memberLandmassIds: readonly EntityId[];
}

/** One explicit marine graph edge; both endpoint IDs identify distinct water-body entities. */
export interface WaterBodyConnectivity {
  readonly connectedWaterBodyId: EntityId;
  readonly kind: 'open-marine-neck';
}

/** One accepted partition member for either a primary ocean basin or retained sea. */
export interface WaterBody {
  readonly entityId: EntityId;
  readonly componentId: SurfaceComponentId;
  readonly kind: AtlasWaterBodyKind;
  readonly enclosure: 'enclosed' | 'open-marine';
  readonly containingWaterBodyId?: EntityId;
  readonly adjacentLandmassIds: readonly EntityId[];
  readonly connectivity: readonly WaterBodyConnectivity[];
}

/** A closed, implicit-closure, planet-native coastline ring with semantic source links. */
export interface CanonicalWorldCoastlineRing {
  readonly ringId: CoastlineRingId;
  readonly landmassId: EntityId;
  readonly waterBodyId: EntityId;
  readonly points: readonly PlanetPoint[];
}

/** Canonical geometry only; winding, nesting, simplification, and extraction are owned separately. */
export interface CanonicalWorldCoastline {
  readonly geometryBehaviorVersion: 1;
  readonly rings: readonly CanonicalWorldCoastlineRing[];
}

/** Semantic geography accepted by the Milestone 2 world map, never render or cache state. */
export interface AtlasGeographyRecords {
  readonly controls: AtlasControls;
  readonly macroElevation: MacroElevationField;
  readonly landWaterClassification: LandWaterClassification;
  readonly landmasses: readonly Landmass[];
  readonly islandGroups: readonly IslandGroup[];
  readonly waterBodies: readonly WaterBody[];
  readonly coastline: CanonicalWorldCoastline;
}
