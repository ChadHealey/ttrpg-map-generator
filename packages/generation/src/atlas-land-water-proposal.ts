/** Assembly of accepted atlas records and ordered, uncommitted aspect replacements. */

import {
  ATLAS_ASPECT_DEFINITIONS,
  ATLAS_CANONICAL_FIELD_TRAVERSAL,
  ATLAS_FIELD_QUANTIZATION_SCALE,
  ATLAS_FULL_LATITUDE_BAND_COUNT,
  ATLAS_FULL_LONGITUDE_CELL_COUNT,
  ATLAS_FULL_PROFILE_ID,
  ATLAS_GEOGRAPHY_CONTRACT_VERSION,
  type AtlasLandWaterRecords,
  createImmutableDomainSnapshot,
  createLandWaterSampleReader,
  createMacroElevationSampleReader,
  type GenerationDiagnostic,
  type LandWaterClassification,
  type MacroElevationField,
  type MacroElevationValueTicks,
  type MapEntitySeedInput,
} from '@ttrpg-map/core';

import type { AtlasClassificationOutput } from './atlas-land-water-classification.js';
import type {
  AtlasLandWaterClassificationParameters,
  AtlasLandWaterGenerationInput,
  AtlasLandWaterProposedPatch,
  AtlasLandWaterRealization,
  AtlasMacroElevationParameters,
} from './atlas-land-water-generator-contract.js';
import {
  ATLAS_LAND_WATER_CLASSIFICATION_VERSION,
  ATLAS_LAND_WATER_REALIZATION_VERSION,
} from './atlas-land-water-generator-metadata.js';
import type { SampledAtlasMacroElevationField } from './atlas-macro-elevation-field.js';
import {
  ATLAS_FIELD_ALGORITHM_VERSION,
  ATLAS_SAMPLING_POLICY_VERSION,
  type AtlasContourLevel,
} from './atlas-sampling-profiles.js';
import type { GenerationProposal } from './generator-contracts.js';

export function createAtlasLandWaterRecords(
  input: AtlasLandWaterGenerationInput,
  field: SampledAtlasMacroElevationField,
  contourLevel: AtlasContourLevel,
  classification: AtlasClassificationOutput,
): AtlasLandWaterRecords {
  const macroElevation: MacroElevationField = Object.freeze({
    provenance: Object.freeze({
      contractVersion: ATLAS_GEOGRAPHY_CONTRACT_VERSION,
      samplingProfileId: ATLAS_FULL_PROFILE_ID,
      samplingPolicyVersion: ATLAS_SAMPLING_POLICY_VERSION,
      longitudeCellCount: ATLAS_FULL_LONGITUDE_CELL_COUNT,
      latitudeBandCount: ATLAS_FULL_LATITUDE_BAND_COUNT,
      canonicalTraversal: ATLAS_CANONICAL_FIELD_TRAVERSAL,
      fieldBehaviorVersion: ATLAS_FIELD_ALGORITHM_VERSION,
      quantizationScale: ATLAS_FIELD_QUANTIZATION_SCALE,
    }),
    values: createMacroElevationSampleReader(
      field.copyValues() as unknown as readonly MacroElevationValueTicks[],
    ),
  });
  const landWaterClassification: LandWaterClassification = Object.freeze({
    classificationBehaviorVersion: ATLAS_LAND_WATER_CLASSIFICATION_VERSION,
    seaLevelContourDoubledTicks: contourLevel,
    samples: createLandWaterSampleReader(classification.samples),
  });
  const records: AtlasLandWaterRecords = Object.freeze({
    controls: input.controls,
    macroElevation,
    landWaterClassification,
  });
  const snapshot = createImmutableDomainSnapshot(records);
  if (!snapshot.ok) throw new Error('Atlas land/water records must be immutable plain data.');
  return snapshot.value;
}

export function createAtlasLandWaterProposedPatch(
  input: AtlasLandWaterGenerationInput,
  macroParameters: AtlasMacroElevationParameters,
  classificationParameters: AtlasLandWaterClassificationParameters,
  records: AtlasLandWaterRecords,
  diagnostics: readonly GenerationDiagnostic[],
): AtlasLandWaterProposedPatch {
  const macroDefinition = aspectDefinition('worldTerrain.macroElevation');
  const classificationDefinition = aspectDefinition('worldSurface.landWaterClassification');
  const macroProposal: GenerationProposal<
    AtlasMacroElevationParameters,
    MacroElevationField,
    MapEntitySeedInput
  > = Object.freeze({
    status: 'proposed',
    target: Object.freeze({
      mapId: input.worldMapId,
      entityId: input.worldSurfaceEntityId,
      aspect: Object.freeze({ aspectId: input.macroElevationAspectId }),
      aspectName: macroDefinition.aspectName,
      variantRevision: input.macroElevationVariantRevision,
    }),
    generatorId: macroDefinition.generatorId,
    generatorVersion: macroDefinition.generatorVersion,
    parameterSchemaVersion: macroDefinition.parameterSchemaVersion,
    parameters: macroParameters,
    seedScope: 'map/entity',
    seedMetadata: input.macroElevationSeedMetadata,
    dependencyAspects: Object.freeze([]),
    output: records.macroElevation,
    diagnostics: Object.freeze([]),
  });
  const classificationDiagnostics = Object.freeze(
    diagnostics.filter(({ target }) => target.aspectId === input.landWaterClassificationAspectId),
  );
  const classificationProposal: GenerationProposal<
    AtlasLandWaterClassificationParameters,
    LandWaterClassification,
    MapEntitySeedInput
  > = Object.freeze({
    status: 'proposed',
    target: Object.freeze({
      mapId: input.worldMapId,
      entityId: input.worldSurfaceEntityId,
      aspect: Object.freeze({ aspectId: input.landWaterClassificationAspectId }),
      aspectName: classificationDefinition.aspectName,
      variantRevision: input.landWaterClassificationVariantRevision,
    }),
    generatorId: classificationDefinition.generatorId,
    generatorVersion: classificationDefinition.generatorVersion,
    parameterSchemaVersion: classificationDefinition.parameterSchemaVersion,
    parameters: classificationParameters,
    seedScope: 'map/entity',
    seedMetadata: input.landWaterClassificationSeedMetadata,
    dependencyAspects: Object.freeze([Object.freeze({ aspectId: input.macroElevationAspectId })]),
    output: records.landWaterClassification,
    diagnostics: classificationDiagnostics,
  });
  return Object.freeze({
    patchKind: 'replace-atlas-land-water-aspects',
    records,
    replacements: Object.freeze([macroProposal, classificationProposal] as const),
  });
}

export function createAtlasLandWaterRealization(
  targetWaterCoveragePercent: number,
  classification: AtlasClassificationOutput,
  componentCount: number,
  largestComponentPercent: number,
): AtlasLandWaterRealization {
  return Object.freeze({
    realizationVersion: ATLAS_LAND_WATER_REALIZATION_VERSION,
    targetWaterCoveragePercent,
    realizedWaterCoveragePercent: classification.realizedWaterCoveragePercent,
    absoluteWaterCoverageErrorBasisPoints: classification.absoluteWaterCoverageErrorBasisPoints,
    waterComponentProxyCount: componentCount,
    largestWaterComponentProxyPercent: largestComponentPercent,
  });
}

function aspectDefinition(
  kind: 'worldSurface.landWaterClassification' | 'worldTerrain.macroElevation',
): (typeof ATLAS_ASPECT_DEFINITIONS)[number] {
  const definition = ATLAS_ASPECT_DEFINITIONS.find((candidate) => candidate.kind === kind);
  if (definition === undefined) throw new Error('Missing accepted atlas aspect definition.');
  return definition;
}
