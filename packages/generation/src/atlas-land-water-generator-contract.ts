/** Public immutable inputs, proposals, previews, progress, and cancellation contracts. */

import {
  type AspectId,
  ATLAS_ASPECT_DEFINITIONS,
  type ATLAS_CANONICAL_FIELD_TRAVERSAL,
  type ATLAS_FIELD_QUANTIZATION_SCALE,
  ATLAS_FULL_PROFILE_ID,
  type AtlasControls,
  type AtlasLandWaterRecords,
  type DeepReadonly,
  deriveAtlasAspectId,
  deriveAtlasSingletonEntityIds,
  DETERMINISTIC_STREAM_VERSION,
  type DeterministicRandomStream,
  type EntityId,
  formatWorldSeed,
  type GenerationDiagnostic,
  type GeneratorId,
  type LandWaterClassification,
  type MacroElevationField,
  type MacroElevationFieldBehaviorVersion,
  type MapEntitySeedInput,
  type MapId,
  orderGenerationDiagnostics,
  parseAtlasControls,
  parseSeedInput,
  parseStableId,
  parseVariantRevision,
  parseWorldSeed,
  SEED_DERIVATION_VERSION,
  selectAtlasMacroElevationVersion,
  type VariantRevision,
  type WorldSeed,
} from '@ttrpg-map/core';

import {
  type ATLAS_GENERATION_PROGRESS_TOTAL_WORK,
  type ATLAS_LAND_WATER_CANCELLATION_VERSION,
  ATLAS_LAND_WATER_CLASSIFICATION_VERSION,
  ATLAS_LAND_WATER_PARAMETER_SCHEMA_VERSION,
  type ATLAS_LAND_WATER_PREVIEW_VERSION,
  type ATLAS_LAND_WATER_PROGRESS_VERSION,
  ATLAS_LAND_WATER_REALIZATION_VERSION,
  ATLAS_WATER_COVERAGE_TOLERANCE_BASIS_POINTS,
} from './atlas-land-water-generator-metadata.js';
import {
  ATLAS_SAMPLING_POLICY_VERSION,
  type AtlasFieldValueTicks,
  WORLD_ATLAS_FULL_PROFILE,
  WORLD_ATLAS_PREVIEW_PROFILE,
} from './atlas-sampling-profiles.js';
import type { GenerationProposal } from './generator-contracts.js';

export {
  ATLAS_CONNECTED_MAJORITY_PROXY_MIN_PERCENT,
  ATLAS_GENERATION_COOPERATION_ROW_INTERVAL,
  ATLAS_GENERATION_PROGRESS_TOTAL_WORK,
  ATLAS_LAND_WATER_CANCELLATION_VERSION,
  ATLAS_LAND_WATER_CLASSIFICATION_VERSION,
  ATLAS_LAND_WATER_DIAGNOSTIC_CODES,
  ATLAS_LAND_WATER_GENERATOR_MANIFEST,
  ATLAS_LAND_WATER_GENERATOR_MANIFEST_VERSION,
  ATLAS_LAND_WATER_PARAMETER_SCHEMA_VERSION,
  ATLAS_LAND_WATER_PREVIEW_VERSION,
  ATLAS_LAND_WATER_PROGRESS_VERSION,
  ATLAS_LAND_WATER_REALIZATION_VERSION,
  ATLAS_WATER_COVERAGE_TOLERANCE_BASIS_POINTS,
  type AtlasLandWaterDiagnosticCode,
} from './atlas-land-water-generator-metadata.js';

declare const VALIDATED_ATLAS_LAND_WATER_INPUT: unique symbol;

export const ATLAS_LAND_WATER_INPUT_DIAGNOSTIC_CODES = {
  invalidField: 'atlas.land-water.input-field-invalid',
  invalidRecord: 'atlas.land-water.input-record-invalid',
} as const;

export type AtlasLandWaterInputDiagnosticCode =
  (typeof ATLAS_LAND_WATER_INPUT_DIAGNOSTIC_CODES)[keyof typeof ATLAS_LAND_WATER_INPUT_DIAGNOSTIC_CODES];

export interface AtlasLandWaterInputDiagnostic {
  readonly code: AtlasLandWaterInputDiagnosticCode;
  readonly field?: string;
  readonly message: string;
  readonly suggestedAction: string;
}

export interface AtlasLandWaterGenerationInputSource {
  readonly worldSeed: unknown;
  readonly worldMapId: unknown;
  readonly worldSurfaceEntityId: unknown;
  readonly macroElevationAspectId: unknown;
  readonly landWaterClassificationAspectId: unknown;
  readonly macroElevationVariantRevision: unknown;
  readonly macroElevationFieldBehaviorVersion: unknown;
  readonly landWaterClassificationVariantRevision: unknown;
  readonly controls: unknown;
}

/** Validated, independently owned input. Only the factory below can construct this brand. */
export interface AtlasLandWaterGenerationInput {
  readonly worldSeed: WorldSeed;
  readonly worldMapId: MapId;
  readonly worldSurfaceEntityId: EntityId;
  readonly macroElevationAspectId: AspectId;
  readonly landWaterClassificationAspectId: AspectId;
  readonly macroElevationVariantRevision: VariantRevision;
  readonly macroElevationFieldBehaviorVersion: MacroElevationFieldBehaviorVersion;
  readonly landWaterClassificationVariantRevision: VariantRevision;
  readonly controls: AtlasControls;
  readonly macroElevationSeedMetadata: MapEntitySeedInput;
  readonly landWaterClassificationSeedMetadata: MapEntitySeedInput;
  readonly [VALIDATED_ATLAS_LAND_WATER_INPUT]: true;
}

export type AtlasLandWaterGenerationInputResult =
  | { readonly ok: true; readonly value: AtlasLandWaterGenerationInput }
  | { readonly ok: false; readonly diagnostics: readonly AtlasLandWaterInputDiagnostic[] };

/** Parameters persisted only with macro elevation; classification-only controls are absent. */
export interface AtlasMacroElevationParameters {
  readonly parameterSchemaVersion: typeof ATLAS_LAND_WATER_PARAMETER_SCHEMA_VERSION;
  readonly samplingProfileId: typeof ATLAS_FULL_PROFILE_ID;
  readonly samplingPolicyVersion: typeof ATLAS_SAMPLING_POLICY_VERSION;
  readonly fieldBehaviorVersion: MacroElevationFieldBehaviorVersion;
  readonly worldCircumferenceKm: number;
  readonly continentCountIntent: number;
  readonly continentDistribution: AtlasControls['continentDistribution'];
  readonly fragmentationPercent: number;
  readonly islandAbundancePercent: number;
  readonly archipelagoAbundancePercent: number;
  readonly polarCharacter: AtlasControls['polarCharacter'];
}

/** Parameters persisted only with classification; macro controls remain upstream provenance. */
export interface AtlasLandWaterClassificationParameters {
  readonly parameterSchemaVersion: typeof ATLAS_LAND_WATER_PARAMETER_SCHEMA_VERSION;
  readonly classificationBehaviorVersion: typeof ATLAS_LAND_WATER_CLASSIFICATION_VERSION;
  readonly sharedThresholdProfileId: typeof WORLD_ATLAS_PREVIEW_PROFILE.profileId;
  readonly acceptedProfileId: typeof WORLD_ATLAS_FULL_PROFILE.profileId;
  readonly realizationVersion: typeof ATLAS_LAND_WATER_REALIZATION_VERSION;
  readonly maximumWaterCoverageErrorBasisPoints: number;
  readonly targetWaterCoveragePercent: number;
  readonly oceanConnectivity: AtlasControls['oceanConnectivity'];
}

export interface AtlasLandWaterProposedPatch {
  readonly patchKind: 'replace-atlas-land-water-aspects';
  readonly records: AtlasLandWaterRecords;
  /** Stable direct-dependency order: macro elevation precedes land/water classification. */
  readonly replacements: readonly [
    GenerationProposal<AtlasMacroElevationParameters, MacroElevationField, MapEntitySeedInput>,
    GenerationProposal<
      AtlasLandWaterClassificationParameters,
      LandWaterClassification,
      MapEntitySeedInput
    >,
  ];
}

export interface AtlasLandWaterRealization {
  readonly realizationVersion: typeof ATLAS_LAND_WATER_REALIZATION_VERSION;
  readonly targetWaterCoveragePercent: number;
  readonly realizedWaterCoveragePercent: number;
  readonly absoluteWaterCoverageErrorBasisPoints: number;
  readonly waterComponentProxyCount: number;
  readonly largestWaterComponentProxyPercent: number;
}

/** Disposable preview has no aspect ID, revision, accepted status, or package path. */
export interface AtlasLandWaterPreview {
  readonly previewKind: 'disposable-atlas-land-water';
  readonly previewVersion: typeof ATLAS_LAND_WATER_PREVIEW_VERSION;
  readonly profileId: typeof WORLD_ATLAS_PREVIEW_PROFILE.profileId;
  readonly samplingPolicyVersion: typeof ATLAS_SAMPLING_POLICY_VERSION;
  readonly longitudeCellCount: typeof WORLD_ATLAS_PREVIEW_PROFILE.longitudeCellCount;
  readonly latitudeBandCount: typeof WORLD_ATLAS_PREVIEW_PROFILE.latitudeBandCount;
  readonly canonicalTraversal: typeof ATLAS_CANONICAL_FIELD_TRAVERSAL;
  readonly quantizationScale: typeof ATLAS_FIELD_QUANTIZATION_SCALE;
  readonly authority: 'disposable';
  readonly isPromotable: false;
  readonly controls: AtlasControls;
  readonly macroElevationValues: readonly AtlasFieldValueTicks[];
  readonly seaLevelContourDoubledTicks: number;
  readonly landWaterSamples: readonly ('land' | 'water')[];
}

export type AtlasGenerationStage =
  | 'preparing'
  | 'sampling-shared-preview-anchors'
  | 'selecting-land-water-threshold'
  | 'sampling-full-macro-elevation'
  | 'classifying-land-water'
  | 'validating-proposal'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface AtlasGenerationProgress {
  readonly progressVersion: typeof ATLAS_LAND_WATER_PROGRESS_VERSION;
  readonly operationId: string;
  readonly profileId:
    typeof WORLD_ATLAS_PREVIEW_PROFILE.profileId | typeof WORLD_ATLAS_FULL_PROFILE.profileId;
  readonly stage: AtlasGenerationStage;
  readonly completedWork: number;
  readonly totalWork: typeof ATLAS_GENERATION_PROGRESS_TOTAL_WORK;
  readonly stageCompletedWork: number;
  readonly stageTotalWork: number;
  readonly isCancellationRequested: boolean;
  readonly isTerminal: boolean;
}

export interface AtlasGenerationCancellationSignal {
  readonly cancellationVersion: typeof ATLAS_LAND_WATER_CANCELLATION_VERSION;
  readonly isCancellationRequested: () => boolean;
}

export interface AtlasLandWaterGenerationRuntime {
  readonly operationId: string;
  readonly macroElevationRandom: DeterministicRandomStream;
  readonly landWaterClassificationRandom: DeterministicRandomStream;
  readonly cancellation: AtlasGenerationCancellationSignal;
  readonly reportProgress: (progress: AtlasGenerationProgress) => void;
  readonly yieldControl: () => Promise<void>;
}

export type AtlasLandWaterFullGenerationResult =
  | {
      readonly status: 'proposed-full';
      readonly patch: AtlasLandWaterProposedPatch;
      readonly realization: AtlasLandWaterRealization;
      readonly diagnostics: readonly GenerationDiagnostic[];
    }
  | {
      readonly status: 'cancelled' | 'invalid';
      readonly diagnostics: readonly GenerationDiagnostic[];
    };

export type AtlasLandWaterPreviewGenerationResult =
  | {
      readonly status: 'preview';
      readonly preview: AtlasLandWaterPreview;
      readonly realization: AtlasLandWaterRealization;
      readonly diagnostics: readonly GenerationDiagnostic[];
    }
  | {
      readonly status: 'cancelled' | 'invalid';
      readonly diagnostics: readonly GenerationDiagnostic[];
    };

/** Parse, cross-check, copy in fixed field order, and freeze every accepted generator input. */
export function createAtlasLandWaterGenerationInput(
  input: unknown,
): AtlasLandWaterGenerationInputResult {
  if (!isExactInputRecord(input)) {
    return inputFailure(
      ATLAS_LAND_WATER_INPUT_DIAGNOSTIC_CODES.invalidRecord,
      'Atlas land/water input must contain exactly the nine declared fields.',
      'Provide the canonical seed, map/surface/aspect IDs, revisions, macro field version, and complete controls.',
    );
  }

  const worldSeed = parseWorldSeed(input.worldSeed);
  if (!worldSeed.ok) return fieldFailure('worldSeed', worldSeed.diagnostic.message);
  const worldMapId = parseStableId('map', input.worldMapId);
  if (!worldMapId.ok) return fieldFailure('worldMapId', worldMapId.diagnostic.message);
  const worldSurfaceEntityId = parseStableId('entity', input.worldSurfaceEntityId);
  if (!worldSurfaceEntityId.ok) {
    return fieldFailure('worldSurfaceEntityId', worldSurfaceEntityId.diagnostic.message);
  }
  const macroElevationAspectId = parseStableId('aspect', input.macroElevationAspectId);
  if (!macroElevationAspectId.ok) {
    return fieldFailure('macroElevationAspectId', macroElevationAspectId.diagnostic.message);
  }
  const landWaterClassificationAspectId = parseStableId(
    'aspect',
    input.landWaterClassificationAspectId,
  );
  if (!landWaterClassificationAspectId.ok) {
    return fieldFailure(
      'landWaterClassificationAspectId',
      landWaterClassificationAspectId.diagnostic.message,
    );
  }
  const macroElevationVariantRevision = parseVariantRevision(input.macroElevationVariantRevision);
  if (!macroElevationVariantRevision.ok) {
    return fieldFailure(
      'macroElevationVariantRevision',
      macroElevationVariantRevision.diagnostic.message,
    );
  }
  if (
    input.macroElevationFieldBehaviorVersion !== 1 &&
    input.macroElevationFieldBehaviorVersion !== 2
  ) {
    return fieldFailure(
      'macroElevationFieldBehaviorVersion',
      'Macro-elevation field behavior version must be the supported literal 1 or 2.',
    );
  }
  const landWaterClassificationVariantRevision = parseVariantRevision(
    input.landWaterClassificationVariantRevision,
  );
  if (!landWaterClassificationVariantRevision.ok) {
    return fieldFailure(
      'landWaterClassificationVariantRevision',
      landWaterClassificationVariantRevision.diagnostic.message,
    );
  }
  const controls = parseAtlasControls(input.controls);
  if (!controls.ok) {
    return fieldFailure('controls', controls.diagnostics.map(({ code }) => code).join(', '));
  }

  const expectedSurface = deriveAtlasSingletonEntityIds(worldMapId.value).worldSurfaceEntityId;
  if (worldSurfaceEntityId.value !== expectedSurface) {
    return fieldFailure(
      'worldSurfaceEntityId',
      'World-surface entity ID does not derive from the declared world-map ID.',
    );
  }
  const expectedMacroAspect = deriveAtlasAspectId(
    worldSurfaceEntityId.value,
    'worldTerrain.macroElevation',
  );
  const expectedClassificationAspect = deriveAtlasAspectId(
    worldSurfaceEntityId.value,
    'worldSurface.landWaterClassification',
  );
  if (macroElevationAspectId.value !== expectedMacroAspect) {
    return fieldFailure(
      'macroElevationAspectId',
      'Macro-elevation aspect ID does not derive from the declared world-surface entity.',
    );
  }
  if (landWaterClassificationAspectId.value !== expectedClassificationAspect) {
    return fieldFailure(
      'landWaterClassificationAspectId',
      'Land/water aspect ID does not derive from the declared world-surface entity.',
    );
  }

  const orderedControls = freezeControls(controls.value);
  const macroDefinition = atlasAspectDefinition('worldTerrain.macroElevation');
  const macroVersion = selectAtlasMacroElevationVersion(input.macroElevationFieldBehaviorVersion);
  const classificationDefinition = atlasAspectDefinition('worldSurface.landWaterClassification');
  const macroSeed = mapEntitySeed(
    worldSeed.value,
    worldMapId.value,
    worldSurfaceEntityId.value,
    macroDefinition.generatorId,
    macroVersion.generatorVersion,
    macroDefinition.aspectName,
    macroElevationVariantRevision.value,
  );
  const classificationSeed = mapEntitySeed(
    worldSeed.value,
    worldMapId.value,
    worldSurfaceEntityId.value,
    classificationDefinition.generatorId,
    classificationDefinition.generatorVersion,
    classificationDefinition.aspectName,
    landWaterClassificationVariantRevision.value,
  );

  return {
    ok: true,
    value: Object.freeze({
      worldSeed: worldSeed.value,
      worldMapId: worldMapId.value,
      worldSurfaceEntityId: worldSurfaceEntityId.value,
      macroElevationAspectId: macroElevationAspectId.value,
      landWaterClassificationAspectId: landWaterClassificationAspectId.value,
      macroElevationVariantRevision: macroElevationVariantRevision.value,
      macroElevationFieldBehaviorVersion: input.macroElevationFieldBehaviorVersion,
      landWaterClassificationVariantRevision: landWaterClassificationVariantRevision.value,
      controls: orderedControls,
      macroElevationSeedMetadata: macroSeed,
      landWaterClassificationSeedMetadata: classificationSeed,
    }) as AtlasLandWaterGenerationInput,
  };
}

export function atlasMacroElevationParameters(
  controls: DeepReadonly<AtlasControls>,
  fieldBehaviorVersion: MacroElevationFieldBehaviorVersion,
): AtlasMacroElevationParameters {
  return Object.freeze({
    parameterSchemaVersion: ATLAS_LAND_WATER_PARAMETER_SCHEMA_VERSION,
    samplingProfileId: ATLAS_FULL_PROFILE_ID,
    samplingPolicyVersion: ATLAS_SAMPLING_POLICY_VERSION,
    fieldBehaviorVersion,
    worldCircumferenceKm: controls.worldCircumferenceKm,
    continentCountIntent: controls.continentCountIntent,
    continentDistribution: controls.continentDistribution,
    fragmentationPercent: controls.fragmentationPercent,
    islandAbundancePercent: controls.islandAbundancePercent,
    archipelagoAbundancePercent: controls.archipelagoAbundancePercent,
    polarCharacter: controls.polarCharacter,
  });
}

export function atlasLandWaterClassificationParameters(
  controls: DeepReadonly<AtlasControls>,
): AtlasLandWaterClassificationParameters {
  return Object.freeze({
    parameterSchemaVersion: ATLAS_LAND_WATER_PARAMETER_SCHEMA_VERSION,
    classificationBehaviorVersion: ATLAS_LAND_WATER_CLASSIFICATION_VERSION,
    sharedThresholdProfileId: WORLD_ATLAS_PREVIEW_PROFILE.profileId,
    acceptedProfileId: WORLD_ATLAS_FULL_PROFILE.profileId,
    realizationVersion: ATLAS_LAND_WATER_REALIZATION_VERSION,
    maximumWaterCoverageErrorBasisPoints: ATLAS_WATER_COVERAGE_TOLERANCE_BASIS_POINTS,
    targetWaterCoveragePercent: controls.targetWaterCoveragePercent,
    oceanConnectivity: controls.oceanConnectivity,
  });
}

export function orderedAtlasLandWaterDiagnostics(
  diagnostics: readonly GenerationDiagnostic[],
): readonly GenerationDiagnostic[] {
  return orderGenerationDiagnostics(diagnostics);
}

function atlasAspectDefinition(
  kind: 'worldSurface.landWaterClassification' | 'worldTerrain.macroElevation',
): (typeof ATLAS_ASPECT_DEFINITIONS)[number] {
  const definition = ATLAS_ASPECT_DEFINITIONS.find((candidate) => candidate.kind === kind);
  if (definition === undefined) throw new Error('Missing accepted atlas aspect definition.');
  return definition;
}

function mapEntitySeed(
  worldSeed: WorldSeed,
  mapId: MapId,
  entityId: EntityId,
  generatorId: GeneratorId,
  generatorVersion: MapEntitySeedInput['generatorVersion'],
  aspectName: (typeof ATLAS_ASPECT_DEFINITIONS)[number]['aspectName'],
  variantRevision: VariantRevision,
): MapEntitySeedInput {
  const parsed = parseSeedInput({
    seedDerivationVersion: SEED_DERIVATION_VERSION,
    deterministicStreamVersion: DETERMINISTIC_STREAM_VERSION,
    seedScope: 'map/entity',
    worldSeed: formatWorldSeed(worldSeed),
    generatorId,
    generatorVersion,
    aspectName,
    variantRevision,
    mapId,
    entityId,
  });
  if (!parsed.ok || parsed.value.seedScope !== 'map/entity') {
    throw new Error('Validated atlas metadata did not produce a map/entity seed namespace.');
  }
  return parsed.value;
}

function freezeControls(controls: AtlasControls): AtlasControls {
  return Object.freeze({
    worldCircumferenceKm: controls.worldCircumferenceKm,
    targetWaterCoveragePercent: controls.targetWaterCoveragePercent,
    continentCountIntent: controls.continentCountIntent,
    continentDistribution: controls.continentDistribution,
    fragmentationPercent: controls.fragmentationPercent,
    islandAbundancePercent: controls.islandAbundancePercent,
    archipelagoAbundancePercent: controls.archipelagoAbundancePercent,
    oceanConnectivity: controls.oceanConnectivity,
    polarCharacter: controls.polarCharacter,
  });
}

function isExactInputRecord(input: unknown): input is Readonly<Record<string, unknown>> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return false;
  const actual = Object.keys(input).sort();
  const expected = [
    'controls',
    'landWaterClassificationAspectId',
    'landWaterClassificationVariantRevision',
    'macroElevationAspectId',
    'macroElevationFieldBehaviorVersion',
    'macroElevationVariantRevision',
    'worldMapId',
    'worldSeed',
    'worldSurfaceEntityId',
  ];
  return (
    actual.length === expected.length && actual.every((field, index) => field === expected[index])
  );
}

function fieldFailure(field: string, message: string): AtlasLandWaterGenerationInputResult {
  return inputFailure(
    ATLAS_LAND_WATER_INPUT_DIAGNOSTIC_CODES.invalidField,
    `Invalid atlas land/water input field ${field}: ${message}`,
    'Recreate the proposal input from validated accepted controls and derived stable identities.',
    field,
  );
}

function inputFailure(
  code: AtlasLandWaterInputDiagnosticCode,
  message: string,
  suggestedAction: string,
  field?: string,
): AtlasLandWaterGenerationInputResult {
  return {
    ok: false,
    diagnostics: Object.freeze([
      Object.freeze({
        code,
        ...(field === undefined ? {} : { field }),
        message,
        suggestedAction,
      }),
    ]),
  };
}
