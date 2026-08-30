/**
 * Framework-free domain contracts shared by the generator, persistence, rendering, assets,
 * and desktop orchestration layers.
 */

export {
  createAspectDependencyGraph,
  getCanonicalAspectDependencyTraversal,
  validateAspectDependencyGraph,
} from './aspect-dependency-graph.js';
export {
  type AffectedAspect,
  ASPECT_DEPENDENCY_DIAGNOSTIC_CODES,
  ASPECT_INVALIDATION_EFFECTS,
  type AspectDependencyDiagnostic,
  type AspectDependencyDiagnosticCode,
  type AspectDependencyEdge,
  type AspectDependencyGraph,
  type AspectDependencyGraphResult,
  type AspectDependencyNode,
  type AspectDependencyNodeKind,
  type AspectInvalidationEffect,
  type AspectInvalidationResult,
  type RegionalContextStaleness,
} from './aspect-dependency-model.js';
export {
  getDirectAspectInvalidation,
  getTransitiveAspectInvalidation,
} from './aspect-invalidation.js';
export {
  ACCEPTED_ATLAS_DIAGNOSTIC_CODES,
  type AcceptedAtlasDiagnostic,
  type AcceptedAtlasDiagnosticCode,
  reconstructAcceptedAtlas,
  type ReconstructAcceptedAtlasResult,
  type ReconstructedAcceptedAtlas,
} from './atlas-accepted-state.js';
export {
  ATLAS_COASTLINE_APPEARANCE_BEHAVIOR_VERSION,
  ATLAS_PAPER_TREATMENT_BEHAVIOR_VERSION,
  ATLAS_STYLE_PROVENANCE_BEHAVIOR_VERSION,
  ATLAS_STYLE_TOKEN_VERSION,
  ATLAS_WATER_DECORATION_BEHAVIOR_VERSION,
  type AtlasAppearanceRecords,
  type AtlasCoastlineAppearance,
  type AtlasCoastlineInkDecision,
  type AtlasPaperTreatment,
  type AtlasStyleCoastlineTokens,
  type AtlasStyleColorTokens,
  type AtlasStylePaperTokens,
  type AtlasStyleProvenance,
  type AtlasStyleTokens,
  type AtlasStyleWaterDecorationTokens,
  type AtlasWaterDecoration,
  type AtlasWaterDecorationPath,
} from './atlas-appearance-model.js';
export {
  ATLAS_DOCUMENT_COMMAND_KIND,
  ATLAS_DOCUMENT_OPERATION_MODES,
  ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES,
  type AtlasDocumentOperationMode,
  type AtlasDocumentTransactionDiagnostic,
  type CommitAtlasProposalCommand,
  type CommitAtlasProposalResult,
  type ExpectedAtlasAspectRevision,
} from './atlas-document-transaction-model.js';
export { commitAtlasProposal } from './atlas-document-transactions.js';
export {
  ATLAS_ASPECT_DEFINITIONS,
  ATLAS_CONTROL_DEFINITIONS,
  ATLAS_CONTROL_INVALIDATION_ROOTS,
  type AtlasAspectDefinition,
  type AtlasAspectKind,
  atlasControlsMatchWorldRadius,
  type AtlasEnumControlDefinition,
  type AtlasNumericControlDefinition,
  compareAtlasEntityIds,
  deriveAtlasAspectId,
  deriveAtlasCoastlineRingId,
  deriveAtlasFeatureEntityId,
  deriveAtlasSingletonEntityIds,
  deriveAtlasSurfaceComponentId,
  deriveAtlasWorldRadius,
  getAtlasControlInvalidationRoots,
} from './atlas-geography-aspects.js';
export {
  type AtlasCoastlineBoundaryTransition,
  type AtlasCoastlineRingIdentity,
  type AtlasSemanticComponentIdentity,
  type AtlasSurfaceKind,
  deriveAtlasCoastlineRingIdentity,
  deriveAtlasCoastlineRingIdFromFingerprint,
  deriveAtlasIslandGroupEntityId,
  deriveAtlasSemanticComponentIdentity,
  fingerprintAtlasCoastlineBoundary,
  fingerprintAtlasSurfaceComponent,
  isAtlasSemanticFingerprint,
} from './atlas-geography-identity.js';
export {
  ATLAS_CANONICAL_FIELD_TRAVERSAL,
  ATLAS_COASTLINE_EXTRACTION_ALGORITHM_VERSION,
  ATLAS_COASTLINE_GEOMETRY_BEHAVIOR_VERSION,
  ATLAS_COASTLINE_REPAIR_POLICY,
  ATLAS_COASTLINE_SIMPLIFICATION_POLICY_VERSION,
  ATLAS_COASTLINE_SIMPLIFICATION_TOLERANCE_TICKS,
  ATLAS_COASTLINE_TOPOLOGY_VALIDATION_VERSION,
  ATLAS_COASTLINE_WINDING,
  ATLAS_CONNECTED_MAJORITY_MINIMUM_PERCENT,
  ATLAS_CONTINENT_DISTRIBUTIONS,
  ATLAS_FIELD_QUANTIZATION_SCALE,
  ATLAS_FULL_LATITUDE_BAND_COUNT,
  ATLAS_FULL_LONGITUDE_CELL_COUNT,
  ATLAS_FULL_PROFILE_ID,
  ATLAS_FULL_SAMPLE_COUNT,
  ATLAS_GEOGRAPHY_CONTRACT_VERSION,
  ATLAS_ISLAND_GROUP_KINDS,
  ATLAS_LANDMASS_KINDS,
  ATLAS_OCEAN_CONNECTIVITY,
  ATLAS_POLAR_CHARACTERS,
  ATLAS_SEMANTIC_AREA_WEIGHT_SCALE,
  ATLAS_SEMANTIC_CLASSIFICATION_VERSION,
  ATLAS_WATER_BODY_KINDS,
  type AtlasContinentDistribution,
  type AtlasControls,
  type AtlasGeographyRecords,
  type AtlasIslandGroupKind,
  type AtlasLandmassKind,
  type AtlasLandWaterRecords,
  type AtlasOceanConnectivity,
  type AtlasPolarCharacter,
  type AtlasSemanticGeographyRecords,
  type AtlasSurfaceComponentMembership,
  type AtlasSurfaceSampleRange,
  type AtlasWaterBodyKind,
  type CanonicalWorldCoastline,
  type CanonicalWorldCoastlineRing,
  DEFAULT_ATLAS_CONTROLS,
  type IslandGroup,
  type Landmass,
  type LandWaterClassification,
  type MacroElevationField,
  type MacroElevationFieldProvenance,
  type MacroElevationValueTicks,
  type WaterBody,
  type WaterBodyConnectivity,
} from './atlas-geography-model.js';
export {
  ATLAS_SEMANTIC_POLICY,
  ATLAS_SEMANTIC_POLICY_VERSION,
  type AtlasIslandGroupCandidate,
  type AtlasSemanticCentroid,
  type AtlasSemanticPolicy,
  classifyAtlasIslandGroups,
  classifyAtlasLandmassKind,
} from './atlas-geography-semantic-policy.js';
export {
  analyzeAtlasSurfacePartition,
  atlasMembershipCentroid,
  atlasStorageAddress,
  atlasStorageIndex,
  type AtlasSurfaceCentroid,
  type AtlasSurfaceComponentAnalysis,
  type AtlasSurfacePartitionAnalysis,
  createAtlasRowWeights,
  forEachAtlasSurfaceNeighbor,
  summarizeAtlasLabeledRegions,
} from './atlas-geography-surface-topology.js';
export {
  ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES,
  type AtlasControlsParseResult,
  type AtlasGeographyDiagnostic,
  type AtlasGeographyDiagnosticCode,
  type AtlasGeographyValidationResult,
  parseAtlasControls,
  validateAtlasControls,
  validateAtlasGeographyRecords,
  validateAtlasLandWaterRecords,
  validateAtlasSemanticGeographyRecords,
  validateAtlasSemanticGeographyRecordsWithAnalysis,
} from './atlas-geography-validation.js';
export {
  type AtlasWaterRegionAnalysis,
  type AtlasWaterSegmentationResult,
  segmentAtlasWaterBodies,
} from './atlas-geography-water-policy.js';
export {
  type AtlasLandWaterSample,
  type AtlasSampleReader,
  atlasSampleReadersEqual,
  atlasSampleReaderToArray,
  createAtlasSampleReader,
  createCompactLandWaterSampleReader,
  createCompactLandWaterSampleReaderFromBits,
  createCompactMacroElevationSampleReader,
  createLandWaterSampleReader,
  createMacroElevationSampleReader,
  getCompactAtlasSampleReaderStorageByteLength,
  isAtlasSampleReader,
  isCompactLandWaterSampleReader,
  isCompactMacroElevationSampleReader,
  type LandWaterSampleReader,
  type MacroElevationSampleReader,
} from './atlas-sample-reader.js';
export {
  type BehaviorVersion,
  COMPATIBILITY_DIAGNOSTIC_CODES,
  type CompatibilityDiagnostic,
  type CompatibilityDiagnosticCode,
  type CompatibilityParseResult,
  createBehaviorVersion,
  createDeterministicStreamVersion,
  createParameterSchemaVersion,
  createSeedDerivationVersion,
  createVariantRevision,
  type DeterministicStreamVersion,
  incrementVariantRevision,
  type ParameterSchemaVersion,
  parseBehaviorVersion,
  parseDeterministicStreamVersion,
  parseParameterSchemaVersion,
  parseSeedDerivationVersion,
  parseVariantRevision,
  type SeedDerivationVersion,
  type VariantRevision,
} from './compatibility.js';
export {
  composeCoordinateTransforms,
  composeInvertibleCoordinateTransforms,
  COORDINATE_TRANSFORM_VERSION,
  type CoordinateOperationDiagnostic,
  type CoordinateOperationResult,
  type CoordinateTransform,
  createPlanetRegionalTransform,
  createProofInputPoint,
  getPublicRoundTripBoundKm,
  inverseUnknownRegionalPoint,
  type InvertibleCoordinateTransform,
  PLANET_REGIONAL_TRANSFORM_ID,
  type PlanetRegionalTransform,
  PROOF_INPUT_EXTENT,
  PROOF_INPUT_TO_PLANET_TRANSFORM_ID,
  type ProofInputPoint,
  proofInputToPlanetTransform,
  TRANSFORM_DIAGNOSTIC_CODES,
  type TransformDiagnostic,
  type TransformDiagnosticCode,
  transformUnknownPlanetPoint,
  validateRoundTripSafeRegionalExtent,
} from './coordinate-transforms.js';
export {
  COORDINATE_DIAGNOSTIC_CODES,
  type CoordinateDiagnostic,
  type CoordinateDiagnosticCode,
  type CoordinateResult,
  createPhysicalDistance,
  createPlanetPoint,
  createRegionalExtent,
  createRegionalPoint,
  createWorldRadius,
  MILLIMETERS_PER_KILOMETER,
  parsePhysicalDistance,
  parsePlanetPoint,
  parseRegionalExtent,
  parseRegionalPoint,
  parseWorldRadius,
  type PhysicalDistance,
  physicalDistanceToKilometers,
  PLANET_ANGULAR_STEP_RAD,
  PLANET_HALF_STEP_RAD,
  PLANET_LATITUDE_MAX_TICKS,
  PLANET_LATITUDE_MIN_TICKS,
  PLANET_LONGITUDE_MAX_TICKS,
  PLANET_LONGITUDE_MIN_TICKS,
  PLANET_TICKS_PER_TURN,
  type PlanetAngles,
  type PlanetPoint,
  planetPointToAngles,
  type RegionalExtent,
  regionalExtentContains,
  type RegionalKilometers,
  type RegionalPoint,
  regionalPointToKilometers,
  roundTiesAwayFromZero,
  type WorldRadius,
  worldRadiusToKilometers,
} from './coordinates.js';
export {
  createDeterministicRandomStream,
  DETERMINISTIC_STREAM_DIAGNOSTIC_CODES,
  type DeterministicRandomStream,
  type DeterministicStreamCreationResult,
  type DeterministicStreamDiagnostic,
  type DeterministicStreamDiagnosticCode,
} from './deterministic-random-stream.js';
export {
  type AcceptedAspectRecord,
  ASPECT_DEPENDENCY_PROVENANCE_KINDS,
  type AspectDependencyReference,
  type AspectGenerationTarget,
  type AspectName,
  type AspectReference,
  type AspectReplacementProposal,
  type DeepReadonly,
  GENERATED_ASPECT_DIAGNOSTIC_CODES,
  type GeneratedAspectContractDiagnostic,
  type GeneratedAspectContractDiagnosticCode,
  type GeneratedAspectContractParseResult,
  type GenerationDiagnostic,
  type GenerationDiagnosticCode,
  type GenerationDiagnosticSeverity,
  type GenerationStatus,
  type InheritedContextDependencyProvenance,
  orderGenerationDiagnostics,
  parseAspectName,
  parseGenerationDiagnosticCode,
  type SeedScope,
} from './generated-aspects.js';
export {
  type AspectId,
  type BoundaryPortalId,
  type CoastlineRingId,
  compareStableReferences,
  type ConstraintId,
  createStableId,
  deriveStableId,
  encodeStableReference,
  type EntityId,
  type GeneratorId,
  type IdentityDiagnostic,
  type IdentityDiagnosticCode,
  type IdentityParseResult,
  type LockId,
  type MapId,
  parseGeneratorId,
  parseSemanticKey,
  parseStableId,
  type RootSurfaceId,
  type SemanticKey,
  type StableIdByKind,
  type StableIdKind,
  type StableIdSource,
  type StableReference,
  stableReferencesEqual,
  type SurfaceComponentId,
  type WorldDocumentId,
} from './identity.js';
export {
  createImmutableDomainArray,
  createImmutableDomainSnapshot,
  type ImmutableDomainSnapshotResult,
  isImmutableDomainSnapshot,
} from './immutable-domain-snapshot.js';
export {
  deriveRegionalFootprintEntityId,
  encodeRegionalFootprintIdentityInput,
} from './regional-footprint-identity.js';
export {
  REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES,
  REGIONAL_RECTANGLE_FOOTPRINT_SHAPE_VERSION,
  type RegionalFootprintDiagnostic,
  type RegionalFootprintDiagnosticCode,
  type RegionalFootprintParseResult,
  type RegionalRectangleFootprint,
} from './regional-footprint-model.js';
export {
  createRegionalFootprintTransform,
  parseRegionalRectangleFootprint,
  validateRegionalRectangleFootprint,
} from './regional-footprint-validation.js';
export {
  type DerivedSeed,
  deriveSeed,
  encodeSeedInput,
  parseDerivedSeedHex,
  SEED_DERIVATION_DIAGNOSTIC_CODES,
  type SeedDerivationDiagnostic,
  type SeedDerivationDiagnosticCode,
  type SeedDerivationResult,
  validateSeedInputEncodingV1,
} from './seed-derivation.js';
export {
  DETERMINISTIC_STREAM_VERSION,
  formatWorldSeed,
  type MapEntitySeedInput,
  parseSeedInput,
  parseWorldSeed,
  type RootCoordinateSeedInput,
  SEED_DERIVATION_VERSION,
  SEED_INPUT_DIAGNOSTIC_CODES,
  type SeedInput,
  type SeedInputDiagnostic,
  type SeedInputDiagnosticCode,
  type SeedInputParseResult,
  type SharedBoundarySeedInput,
  WORLD_SEED_MAX,
  type WorldSeed,
} from './seed-input.js';
export { sha256 } from './sha-256.js';
export {
  type AcceptedDecoration,
  type AspectConstraint,
  type AspectLock,
  CONSTRAINT_KINDS,
  type ConstraintKind,
  MAP_COORDINATE_SYSTEM_KINDS,
  MAP_KINDS,
  MAP_RELATIONSHIP_KINDS,
  MAP_SCALE_CLASSES,
  type MapAcceptedState,
  type MapDocument,
  type MapEntity,
  type MapKind,
  type MapLayoutState,
  type MapRelationshipKind,
  type MapScaleClass,
  type OwnershipRecordId,
  type RegionalMap,
  type RegionalMapCoordinateSystem,
  type RegionalMapParent,
  WORLD_MAP_EXTENT_KIND,
  type WorldDocument,
  type WorldMap,
  type WorldMapCoordinateSystem,
  type WorldMapExtent,
} from './world-document.js';
export {
  getCanonicalOwnershipTraversal,
  OWNERSHIP_DIAGNOSTIC_CODES,
  type OwnershipDiagnostic,
  type OwnershipDiagnosticCode,
  type OwnershipRecordKind,
  type OwnershipTraversalNode,
  type OwnershipTraversalResult,
  validateWorldDocumentOwnership,
} from './world-document-ownership.js';
export {
  type AspectProposalCommit,
  type CommitAspectProposalCommand,
  type CommitAspectProposalResult,
  DOCUMENT_COMMAND_KINDS,
  DOCUMENT_DEPENDENCY_EFFECT_KINDS,
  DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES,
  type DocumentAspectTarget,
  type DocumentDependencyEffect,
  type DocumentTransactionDiagnostic,
  type DocumentTransactionDiagnosticCode,
  type ReplacementDocumentDependencyEffect,
  type RetainedDocumentDependencyEffect,
} from './world-document-transaction-model.js';
export { commitAspectProposal } from './world-document-transactions.js';
export {
  getWorldPhysicalContextControlInvalidationRoots,
  WORLD_PHYSICAL_CONTEXT_ASPECT_DEFINITIONS,
  WORLD_PHYSICAL_CONTEXT_CONTROL_DEFINITIONS,
  type WorldPhysicalContextAspectDefinition,
  type WorldPhysicalContextAspectKind,
  type WorldPhysicalContextDependencyKind,
  type WorldPhysicalEnumControlDefinition,
} from './world-physical-context-aspects.js';
export {
  deriveWorldPhysicalContextAspectId,
  deriveWorldPhysicalFeatureEntityId,
  fingerprintWorldPhysicalField,
  fingerprintWorldPhysicalRootSignature,
  isWorldPhysicalFieldFingerprint,
  parseBiomeKey,
  parseClimateZoneKey,
  parseWorldPhysicalFieldFingerprint,
  type WorldPhysicalFeatureKind,
} from './world-physical-context-identity.js';
export {
  type BiomeBeltField,
  type BiomeBeltSummary,
  type BiomeDefinition,
  type BiomeKey,
  CLIMATE_CHARACTERS,
  type ClimateCharacter,
  type ClimateZoneDefinition,
  type ClimateZoneField,
  type ClimateZoneKey,
  createDischargeTicks,
  createElevationTicks,
  createNormalizedFieldTicks,
  createTemperatureTicks,
  createWindSpeedTicks,
  DEFAULT_WORLD_PHYSICAL_CONTEXT_CONTROLS,
  type DischargeTicks,
  type ElevationTicks,
  isCalmWindSpeed,
  type MajorLake,
  type MajorRiver,
  type MoistureField,
  MOUNTAIN_CHARACTERS,
  type MountainCharacter,
  type MountainSystem,
  type MountainSystems,
  type NormalizedFieldTicks,
  type PrevailingWindField,
  type QuantizedScalarField,
  type TemperatureField,
  type TemperatureTicks,
  type Watershed,
  type WatershedRecords,
  type WindSpeedTicks,
  WORLD_PHYSICAL_CLASSIFICATION_POLICY_VERSION,
  WORLD_PHYSICAL_CONTEXT_CONTRACT_VERSION,
  WORLD_PHYSICAL_FEATURE_BEHAVIOR_VERSION,
  WORLD_PHYSICAL_FIELD_BEHAVIOR_VERSION,
  WORLD_PHYSICAL_FIELD_ENCODING_VERSION,
  WORLD_PHYSICAL_GEOMETRY_VERSION,
  WORLD_PHYSICAL_GRAPH_POLICY_VERSION,
  WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE,
  WORLD_PHYSICAL_TEMPERATURE_QUANTUM_CELSIUS,
  WORLD_PHYSICAL_WIND_SPEED_QUANTUM_METERS_PER_SECOND,
  type WorldPhysicalContextControls,
  type WorldPhysicalContextRecords,
  type WorldPhysicalFieldFingerprint,
  type WorldPhysicalFieldKind,
  type WorldPhysicalFieldProvenance,
  type WorldPhysicalFieldQuantizationScale,
  type WorldPhysicalFieldValueEncoding,
  type WorldPhysicalRootSignature,
} from './world-physical-context-model.js';
export {
  createConstantWorldPhysicalFieldReader,
  createWorldPhysicalFieldReader,
  isWorldPhysicalFieldReader,
  type WorldPhysicalFieldReader,
} from './world-physical-context-readers.js';
export {
  getCanonicalWorldPhysicalContextAspectTraversal,
  validateWorldPhysicalContextAspectDefinitions,
  validateWorldPhysicalContextControls,
  validateWorldPhysicalContextRecords,
  WORLD_PHYSICAL_CONTEXT_DIAGNOSTIC_CODES,
  type WorldPhysicalContextDiagnostic,
  type WorldPhysicalContextDiagnosticCode,
  type WorldPhysicalContextValidationResult,
} from './world-physical-context-validation.js';

/** A point in the fixed render-pixel coordinate space of a {@link RenderScene}. */
export interface RenderPoint {
  readonly xPx: number;
  readonly yPx: number;
}

/** A style-neutral link from a render node to the record that supplied it. */
export type RenderSourceId = string;

/** An ink and fill treatment shared by Canvas and SVG renderers. */
export interface RenderPaint {
  readonly fillColor: string;
  readonly strokeColor: string;
  readonly strokeWidthPx: number;
}

/** One closed contour within a compound render path. */
export interface RenderSubpath {
  readonly points: readonly RenderPoint[];
}

/** A filled rectangular render node. */
export interface RenderRectangle {
  readonly id: string;
  readonly kind: 'rectangle';
  readonly sourceId: RenderSourceId;
  readonly sourceAspectId?: RenderSourceId;
  readonly relatedSourceIds?: readonly RenderSourceId[];
  readonly xPx: number;
  readonly yPx: number;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly fillColor: string;
}

/** A closed, filled polygon with an optional ink outline. */
export interface RenderPolygon {
  readonly id: string;
  readonly kind: 'polygon';
  readonly sourceId: RenderSourceId;
  readonly sourceAspectId?: RenderSourceId;
  readonly relatedSourceIds?: readonly RenderSourceId[];
  readonly points: readonly RenderPoint[];
  readonly paint: RenderPaint;
}

/**
 * A filled path containing one or more closed contours. Even-odd filling preserves holes and
 * seam-split pieces without asking a renderer to reconstruct semantic geography.
 */
export interface RenderCompoundPath {
  readonly id: string;
  readonly kind: 'compoundPath';
  readonly sourceId: RenderSourceId;
  readonly sourceAspectId?: RenderSourceId;
  readonly relatedSourceIds?: readonly RenderSourceId[];
  readonly subpaths: readonly RenderSubpath[];
  readonly fillColor: string;
  readonly fillRule: 'evenodd';
}

/** An open ink path. */
export interface RenderPolyline {
  readonly id: string;
  readonly kind: 'polyline';
  readonly sourceId: RenderSourceId;
  readonly sourceAspectId?: RenderSourceId;
  readonly relatedSourceIds?: readonly RenderSourceId[];
  readonly points: readonly RenderPoint[];
  readonly strokeColor: string;
  readonly strokeWidthPx: number;
}

/** A text label drawn in render-pixel coordinates. */
export interface RenderLabel {
  readonly id: string;
  readonly kind: 'label';
  readonly sourceId: RenderSourceId;
  readonly sourceAspectId?: RenderSourceId;
  readonly relatedSourceIds?: readonly RenderSourceId[];
  readonly text: string;
  readonly position: RenderPoint;
  readonly fontFamily: string;
  readonly fontSizePx: number;
  readonly fontWeight: number;
  readonly fillColor: string;
  readonly textAnchor: 'start' | 'middle' | 'end';
}

/** A single renderer-neutral drawing instruction. */
export type RenderNode =
  RenderRectangle | RenderPolygon | RenderCompoundPath | RenderPolyline | RenderLabel;

/**
 * An ordered, immutable description of visual output in fixed render-pixel coordinates.
 * Renderers must interpret nodes in array order and may not reconstruct semantic geometry.
 */
export interface RenderScene {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly nodes: readonly RenderNode[];
}

/**
 * The fixed Milestone 0 scene used to prove renderer parity. It is render-only demonstration
 * content, not accepted world data or a generator output.
 */
export const inkedProofScene: RenderScene = {
  widthPx: 960,
  heightPx: 600,
  nodes: [
    {
      id: 'proof-paper',
      kind: 'rectangle',
      sourceId: 'proof:paper',
      xPx: 0,
      yPx: 0,
      widthPx: 960,
      heightPx: 600,
      fillColor: '#f3e7c6',
    },
    {
      id: 'proof-island',
      kind: 'polygon',
      sourceId: 'proof:island',
      points: [
        { xPx: 124, yPx: 341 },
        { xPx: 202, yPx: 228 },
        { xPx: 334, yPx: 169 },
        { xPx: 507, yPx: 185 },
        { xPx: 677, yPx: 128 },
        { xPx: 843, yPx: 229 },
        { xPx: 814, yPx: 365 },
        { xPx: 694, yPx: 457 },
        { xPx: 528, yPx: 429 },
        { xPx: 365, yPx: 488 },
        { xPx: 201, yPx: 432 },
      ],
      paint: {
        fillColor: '#cbd7a2',
        strokeColor: '#2c2a20',
        strokeWidthPx: 5,
      },
    },
    {
      id: 'proof-river',
      kind: 'polyline',
      sourceId: 'proof:river',
      points: [
        { xPx: 639, yPx: 171 },
        { xPx: 609, yPx: 222 },
        { xPx: 625, yPx: 269 },
        { xPx: 584, yPx: 318 },
        { xPx: 596, yPx: 380 },
        { xPx: 564, yPx: 427 },
      ],
      strokeColor: '#2d6170',
      strokeWidthPx: 7,
    },
    {
      id: 'proof-title',
      kind: 'label',
      sourceId: 'proof:label',
      text: 'The Verdant Reach',
      position: { xPx: 480, yPx: 550 },
      fontFamily: 'Georgia, serif',
      fontSizePx: 35,
      fontWeight: 600,
      fillColor: '#302d21',
      textAnchor: 'middle',
    },
  ],
};
