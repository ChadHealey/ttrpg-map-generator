/** Versioned ownership, compatibility, cost, and tolerance metadata for atlas land/water v1. */

import {
  ATLAS_ASPECT_DEFINITIONS,
  ATLAS_FULL_SAMPLE_COUNT,
  ATLAS_GEOGRAPHY_CONTRACT_VERSION,
  type AtlasControls,
  DETERMINISTIC_STREAM_VERSION,
  type GenerationDiagnosticCode,
  type GeneratorId,
  parseGenerationDiagnosticCode,
  SEED_DERIVATION_VERSION,
} from '@ttrpg-map/core';

import {
  ATLAS_FIELD_ALGORITHM_VERSION,
  ATLAS_SAMPLING_POLICY_VERSION,
  WORLD_ATLAS_FULL_PROFILE,
  WORLD_ATLAS_PREVIEW_BOUNDARY_TOLERANCE_RAD,
  WORLD_ATLAS_PREVIEW_PROFILE,
} from './atlas-sampling-profiles.js';

export const ATLAS_LAND_WATER_GENERATOR_MANIFEST_VERSION = 1 as const;
export const ATLAS_LAND_WATER_PARAMETER_SCHEMA_VERSION = 1 as const;
export const ATLAS_LAND_WATER_CLASSIFICATION_VERSION = 1 as const;
export const ATLAS_LAND_WATER_REALIZATION_VERSION = 1 as const;
export const ATLAS_LAND_WATER_PROGRESS_VERSION = 1 as const;
export const ATLAS_LAND_WATER_CANCELLATION_VERSION = 1 as const;
export const ATLAS_LAND_WATER_PREVIEW_VERSION = 1 as const;

/** One basis point is 0.01 percentage points of sampled spherical area. */
export const ATLAS_WATER_COVERAGE_TOLERANCE_BASIS_POINTS = 25;
export const ATLAS_CONNECTED_MAJORITY_PROXY_MIN_PERCENT = 90;
export const ATLAS_CONNECTIVITY_SELECTION_MAX_COVERAGE_ERROR_BASIS_POINTS = 10;
export const ATLAS_GENERATION_PROGRESS_TOTAL_WORK = 1_000;
export const ATLAS_GENERATION_COOPERATION_ROW_INTERVAL = 16;

export const ATLAS_LAND_WATER_DIAGNOSTIC_CODES = Object.freeze({
  cancelled: diagnosticCode('atlas.land-water.cancelled'),
  invalidOutput: diagnosticCode('atlas.land-water.output-invalid'),
  invalidRuntime: diagnosticCode('atlas.land-water.runtime-invalid'),
  oceanConnectivityUnsupported: diagnosticCode('atlas.land-water.ocean-connectivity-unsupported'),
  oceanConnectivityUnverified: diagnosticCode('atlas.land-water.ocean-connectivity-unverified'),
  waterCoverageUnsatisfied: diagnosticCode('atlas.land-water.water-coverage-unsatisfied'),
});

export type AtlasLandWaterDiagnosticCode =
  (typeof ATLAS_LAND_WATER_DIAGNOSTIC_CODES)[keyof typeof ATLAS_LAND_WATER_DIAGNOSTIC_CODES];

interface AtlasManifestAspect {
  readonly aspectName: 'worldTerrain.macroElevation' | 'worldSurface.landWaterClassification';
  readonly generatorId: GeneratorId;
  readonly generatorVersion: 1;
  readonly parameterSchemaVersion: typeof ATLAS_LAND_WATER_PARAMETER_SCHEMA_VERSION;
  readonly additionalBehaviorVersion: 1;
  readonly seedScope: 'map/entity';
  readonly directDependencies: readonly (
    'worldTerrain.macroElevation' | 'worldSurface.landWaterClassification'
  )[];
  readonly invalidatedByControls: readonly (keyof AtlasControls)[];
  readonly outputRecord: 'LandWaterClassification' | 'MacroElevationField';
  readonly randomDrawPolicy: 'finite-basis-parameters' | 'zero-draws';
}

/** Complete machine-readable v1 ownership, compatibility, cost, and tolerance declaration. */
export const ATLAS_LAND_WATER_GENERATOR_MANIFEST = Object.freeze({
  manifestVersion: ATLAS_LAND_WATER_GENERATOR_MANIFEST_VERSION,
  inputs: Object.freeze([
    'validated-atlas-controls',
    'canonical-world-seed',
    'world-map-id',
    'world-surface-entity-id',
    'two-aspect-ids',
    'two-variant-revisions',
    'two-independent-map-entity-streams',
  ] as const),
  aspects: Object.freeze([
    aspectManifest(
      'worldTerrain.macroElevation',
      [],
      [
        'archipelagoAbundancePercent',
        'continentCountIntent',
        'continentDistribution',
        'fragmentationPercent',
        'islandAbundancePercent',
        'polarCharacter',
        'worldCircumferenceKm',
      ],
    ),
    aspectManifest(
      'worldSurface.landWaterClassification',
      ['worldTerrain.macroElevation'],
      ['oceanConnectivity', 'targetWaterCoveragePercent'],
    ),
  ] as const),
  directDependencyEdges: Object.freeze([
    Object.freeze({
      input: 'worldTerrain.macroElevation',
      output: 'worldSurface.landWaterClassification',
    }),
  ] as const),
  versions: Object.freeze({
    geographyContractVersion: ATLAS_GEOGRAPHY_CONTRACT_VERSION,
    samplingPolicyVersion: ATLAS_SAMPLING_POLICY_VERSION,
    fieldBehaviorVersion: ATLAS_FIELD_ALGORITHM_VERSION,
    classificationBehaviorVersion: ATLAS_LAND_WATER_CLASSIFICATION_VERSION,
    parameterSchemaVersion: ATLAS_LAND_WATER_PARAMETER_SCHEMA_VERSION,
    realizationVersion: ATLAS_LAND_WATER_REALIZATION_VERSION,
    previewVersion: ATLAS_LAND_WATER_PREVIEW_VERSION,
    seedDerivationVersion: SEED_DERIVATION_VERSION,
    deterministicStreamVersion: DETERMINISTIC_STREAM_VERSION,
  }),
  profiles: Object.freeze({
    preview: Object.freeze({
      ...WORLD_ATLAS_PREVIEW_PROFILE,
      sampleCount:
        WORLD_ATLAS_PREVIEW_PROFILE.longitudeCellCount *
          (WORLD_ATLAS_PREVIEW_PROFILE.latitudeBandCount - 1) +
        2,
      authority: 'disposable',
      isPromotable: false,
    }),
    full: Object.freeze({
      ...WORLD_ATLAS_FULL_PROFILE,
      sampleCount: ATLAS_FULL_SAMPLE_COUNT,
      authority: 'proposed-accepted-output',
    }),
    sharedAnchorRefinementFactor: 4,
  }),
  tolerances: Object.freeze({
    connectedMajorityProxyMinimumPercent: ATLAS_CONNECTED_MAJORITY_PROXY_MIN_PERCENT,
    connectivityPreferenceMaxCoverageErrorBasisPoints:
      ATLAS_CONNECTIVITY_SELECTION_MAX_COVERAGE_ERROR_BASIS_POINTS,
    sharedAnchorFieldTicks: 0,
    sharedAnchorClassificationDifferences: 0,
    canonicalSeamIdentityFieldTicks: 0,
    poleSamplesPerPole: 1,
    maximumWaterCoverageErrorBasisPoints: ATLAS_WATER_COVERAGE_TOLERANCE_BASIS_POINTS,
    retainedPreviewBoundaryDisplacementRad: WORLD_ATLAS_PREVIEW_BOUNDARY_TOLERANCE_RAD,
  }),
  expectedCost: Object.freeze({
    complexity: 'linear-in-profile-anchors',
    costClass: 'costly',
    previewAnchorCount: 130_562,
    fullAnchorCount: ATLAS_FULL_SAMPLE_COUNT,
    fullReferenceWallClockBudgetMs: 10_000,
    fullReferencePeakAdditionalMemoryMiB: 768,
    cooperationRowInterval: ATLAS_GENERATION_COOPERATION_ROW_INTERVAL,
    progressTotalWork: ATLAS_GENERATION_PROGRESS_TOTAL_WORK,
  }),
  controlOwnership: Object.freeze({
    macroElevation: Object.freeze([
      'archipelagoAbundancePercent',
      'continentCountIntent',
      'continentDistribution',
      'fragmentationPercent',
      'islandAbundancePercent',
      'polarCharacter',
      'worldCircumferenceKm',
    ] as const),
    landWaterClassification: Object.freeze([
      'oceanConnectivity',
      'targetWaterCoveragePercent',
    ] as const),
  }),
});

function aspectManifest(
  kind: AtlasManifestAspect['aspectName'],
  directDependencies: AtlasManifestAspect['directDependencies'],
  invalidatedByControls: AtlasManifestAspect['invalidatedByControls'],
): AtlasManifestAspect {
  const definition = atlasAspectDefinition(kind);
  return Object.freeze({
    aspectName: kind,
    generatorId: definition.generatorId,
    generatorVersion: 1,
    parameterSchemaVersion: ATLAS_LAND_WATER_PARAMETER_SCHEMA_VERSION,
    additionalBehaviorVersion: 1,
    seedScope: 'map/entity',
    directDependencies: Object.freeze([...directDependencies]),
    invalidatedByControls: Object.freeze([...invalidatedByControls]),
    outputRecord:
      kind === 'worldTerrain.macroElevation'
        ? ('MacroElevationField' as const)
        : ('LandWaterClassification' as const),
    randomDrawPolicy:
      kind === 'worldTerrain.macroElevation'
        ? ('finite-basis-parameters' as const)
        : ('zero-draws' as const),
  });
}

function atlasAspectDefinition(
  kind: AtlasManifestAspect['aspectName'],
): (typeof ATLAS_ASPECT_DEFINITIONS)[number] {
  const definition = ATLAS_ASPECT_DEFINITIONS.find((candidate) => candidate.kind === kind);
  if (definition === undefined) throw new Error('Missing accepted atlas aspect definition.');
  return definition;
}

function diagnosticCode(value: string): GenerationDiagnosticCode {
  const parsed = parseGenerationDiagnosticCode(value);
  if (!parsed.ok) throw new Error('Invalid internal atlas generator diagnostic code.');
  return parsed.value;
}
