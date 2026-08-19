/** Canonical, planet-native Milestone 2 coastline proposal and validation. */

import {
  type AcceptedAspectRecord,
  ATLAS_ASPECT_DEFINITIONS,
  ATLAS_COASTLINE_EXTRACTION_ALGORITHM_VERSION,
  ATLAS_COASTLINE_GEOMETRY_BEHAVIOR_VERSION,
  ATLAS_COASTLINE_REPAIR_POLICY,
  ATLAS_COASTLINE_SIMPLIFICATION_POLICY_VERSION,
  ATLAS_COASTLINE_SIMPLIFICATION_TOLERANCE_TICKS,
  ATLAS_COASTLINE_TOPOLOGY_VALIDATION_VERSION,
  ATLAS_COASTLINE_WINDING,
  type AtlasGeographyRecords,
  type AtlasSemanticGeographyRecords,
  type CanonicalWorldCoastline,
  type CanonicalWorldCoastlineRing,
  createVariantRevision,
  deriveAtlasAspectId,
  deriveAtlasCoastlineRingIdentity,
  DETERMINISTIC_STREAM_VERSION,
  type EntityId,
  formatWorldSeed,
  type GenerationDiagnostic,
  type MapEntitySeedInput,
  type MapId,
  parseSeedInput,
  SEED_DERIVATION_VERSION,
  type VariantRevision,
  type WorldSeed,
} from '@ttrpg-map/core';

import { atlasPlanetContourExtractionAdapter } from './atlas-coastline-contours.js';
import { simplifyAtlasCoastlineRing } from './atlas-coastline-simplification.js';
import {
  buildAtlasCoastlineSourceMaps,
  validateAtlasCoastlineSourceCoverage,
  validateAtlasRawCoastlineWinding,
} from './atlas-coastline-source-validation.js';
import { atlasPlanetTopologyValidationAdapter } from './atlas-coastline-topology.js';
import {
  type AtlasContourLevel,
  parseAtlasFieldValueTicks,
  WORLD_ATLAS_FULL_PROFILE,
} from './atlas-sampling-profiles.js';
import { validateProvenAtlasSemanticGeographyRecords } from './atlas-semantic-validation-proof.js';
import type { GenerationProposal } from './generator-contracts.js';
import type {
  GeographyAdapterDiagnostic,
  QuantizedSphericalField,
} from './geography-algorithm-adapters.js';

export const ATLAS_COASTLINE_GENERATOR_MANIFEST_VERSION = 1 as const;
export const ATLAS_COASTLINE_PARAMETER_SCHEMA_VERSION = 1 as const;

export const ATLAS_COASTLINE_DIAGNOSTIC_CODES = Object.freeze({
  inputInvalid: 'atlas.coastline.input-invalid',
  extractionInvalid: 'atlas.coastline.extraction-invalid',
  sourceCoverageInvalid: 'atlas.coastline.source-coverage-invalid',
  sourceIdentityInvalid: 'atlas.coastline.source-identity-invalid',
  windingInvalid: 'atlas.coastline.winding-invalid',
  topologyInvalid: 'atlas.coastline.topology-invalid',
} as const);

export const ATLAS_COASTLINE_PARAMETERS = Object.freeze({
  parameterSchemaVersion: ATLAS_COASTLINE_PARAMETER_SCHEMA_VERSION,
  extractionAlgorithmVersion: ATLAS_COASTLINE_EXTRACTION_ALGORITHM_VERSION,
  simplificationPolicyVersion: ATLAS_COASTLINE_SIMPLIFICATION_POLICY_VERSION,
  simplificationToleranceTicks: ATLAS_COASTLINE_SIMPLIFICATION_TOLERANCE_TICKS,
  topologyValidationVersion: ATLAS_COASTLINE_TOPOLOGY_VALIDATION_VERSION,
  winding: ATLAS_COASTLINE_WINDING,
  repairPolicy: ATLAS_COASTLINE_REPAIR_POLICY,
});

export type AtlasCoastlineParameters = typeof ATLAS_COASTLINE_PARAMETERS;

export const ATLAS_COASTLINE_GENERATOR_MANIFEST = Object.freeze({
  manifestVersion: ATLAS_COASTLINE_GENERATOR_MANIFEST_VERSION,
  generatorId: 'worldCoastline.geometry',
  generatorVersion: ATLAS_COASTLINE_GEOMETRY_BEHAVIOR_VERSION,
  parameterSchemaVersion: ATLAS_COASTLINE_PARAMETER_SCHEMA_VERSION,
  inputAspects: Object.freeze([
    'worldSurface.landWaterClassification',
    'landmass.classification',
    'waterBody.classification',
  ] as const),
  outputAspect: 'worldCoastline.geometry',
  seedScope: 'map/entity',
  randomDrawPolicy: 'zero-draws',
  invalidation: Object.freeze({
    directDependencyKinds: Object.freeze([
      'worldSurface.landWaterClassification',
      'landmass.classification',
      'waterBody.classification',
    ] as const),
    controlRoots: Object.freeze([
      'worldSurface.landWaterClassification',
      'worldTerrain.macroElevation',
    ] as const),
  }),
  diagnostics: ATLAS_COASTLINE_DIAGNOSTIC_CODES,
  parameters: ATLAS_COASTLINE_PARAMETERS,
});

export interface AtlasCoastlineGenerationInput {
  readonly worldSeed: WorldSeed;
  readonly worldMapId: MapId;
  readonly worldCoastlineEntityId: EntityId;
  readonly records: AtlasSemanticGeographyRecords;
  readonly previousAcceptedAspects: readonly AcceptedAspectRecord[];
}

export type AtlasCoastlineAspectProposal = GenerationProposal<
  AtlasCoastlineParameters,
  CanonicalWorldCoastline,
  MapEntitySeedInput
>;

export interface AtlasCoastlineProposedPatch {
  readonly patchKind: 'replace-atlas-canonical-coastline';
  readonly operationMode: 'geography-dependency-recompute';
  readonly records: AtlasGeographyRecords;
  readonly replacement: AtlasCoastlineAspectProposal;
  readonly explicitlyIncrementedAspectIds: readonly [];
  readonly rawPointCount: number;
  readonly canonicalPointCount: number;
}

export interface AtlasCoastlineGenerationDiagnostic {
  readonly code: (typeof ATLAS_COASTLINE_DIAGNOSTIC_CODES)[keyof typeof ATLAS_COASTLINE_DIAGNOSTIC_CODES];
  readonly message: string;
  readonly suggestedAction: string;
  readonly adapterDiagnostics?: readonly GeographyAdapterDiagnostic[];
}

export type AtlasCoastlineGenerationResult =
  | { readonly status: 'proposed'; readonly patch: AtlasCoastlineProposedPatch }
  | {
      readonly status: 'invalid';
      readonly diagnostics: readonly AtlasCoastlineGenerationDiagnostic[];
    };

/** Extract, prove, simplify, and propose one immutable accepted coastline aspect. */
export function generateAtlasCanonicalCoastline(
  input: AtlasCoastlineGenerationInput,
): AtlasCoastlineGenerationResult {
  const sourceValidation = validateProvenAtlasSemanticGeographyRecords(input.records);
  if (!sourceValidation.ok) {
    return invalid({
      code: ATLAS_COASTLINE_DIAGNOSTIC_CODES.inputInvalid,
      message: 'Coastline generation requires independently valid accepted semantic geography.',
      suggestedAction: 'Restore or regenerate semantic classification before coastline generation.',
    });
  }
  const sourceMaps = buildAtlasCoastlineSourceMaps(input.records);
  const field = acceptedField(input.records);
  const contourLevel = input.records.landWaterClassification
    .seaLevelContourDoubledTicks as AtlasContourLevel;
  const extracted = atlasPlanetContourExtractionAdapter.extract(field, contourLevel);
  if (extracted.diagnostics.length > 0) {
    return invalid({
      code: ATLAS_COASTLINE_DIAGNOSTIC_CODES.extractionInvalid,
      message: 'Canonical coastline extraction produced invalid quantized contour topology.',
      suggestedAction: 'Reject the proposal and inspect the stable adapter diagnostics.',
      adapterDiagnostics: extracted.diagnostics,
    });
  }
  const hasCompleteSourceCoverage = validateAtlasCoastlineSourceCoverage(
    input.records.landWaterClassification.samples,
    extracted.rings,
  );
  if (!hasCompleteSourceCoverage) return invalid(sourceCoverageDiagnostic());
  if (!validateAtlasRawCoastlineWinding(extracted.rings)) return invalid(windingDiagnostic());

  const canonicalRings: CanonicalWorldCoastlineRing[] = [];
  let rawPointCount = 0;
  let canonicalPointCount = 0;
  for (const ring of extracted.rings) {
    const transitions = ring.sourceTransitions;
    if (transitions?.length !== ring.points.length) {
      return invalid(sourceIdentityDiagnostic('A contour ring has incomplete source provenance.'));
    }
    const landIndices = new Set(
      transitions.map(({ landSampleIndex }) => sourceMaps.landBySample[landSampleIndex] ?? -1),
    );
    if (landIndices.size !== 1 || landIndices.has(-1)) {
      return invalid(
        sourceIdentityDiagnostic(
          'One physical coastline loop references multiple or missing landmasses.',
        ),
      );
    }
    const landIndex = [...landIndices][0];
    const landmass = landIndex === undefined ? undefined : input.records.landmasses[landIndex];
    if (landmass === undefined)
      return invalid(sourceIdentityDiagnostic('A coastline landmass is missing.'));
    const waterBodyIds = [
      ...new Set(
        transitions.map(({ waterSampleIndex }) => {
          const waterIndex = sourceMaps.waterBySample[waterSampleIndex] ?? -1;
          return input.records.waterBodies[waterIndex]?.entityId;
        }),
      ),
    ]
      .filter(isEntityId)
      .sort();
    if (waterBodyIds.length === 0) {
      return invalid(
        sourceIdentityDiagnostic('A coastline loop has no adjacent accepted water body.'),
      );
    }
    const identity = deriveAtlasCoastlineRingIdentity(
      input.worldCoastlineEntityId,
      landmass.entityId,
      waterBodyIds,
      transitions,
    );
    const simplified = simplifyAtlasCoastlineRing(ring, WORLD_ATLAS_FULL_PROFILE);
    rawPointCount += ring.points.length;
    canonicalPointCount += simplified.ring.points.length;
    canonicalRings.push(
      Object.freeze({
        ringId: identity.ringId,
        sourceBoundaryFingerprint: identity.fingerprint,
        landmassId: landmass.entityId,
        waterBodyIds: Object.freeze(waterBodyIds),
        points: simplified.ring.points,
      }),
    );
  }
  canonicalRings.sort((left, right) => compareAscii(left.ringId, right.ringId));
  const simplifiedTopology = atlasPlanetTopologyValidationAdapter.validate(
    canonicalRings.map(({ points }) => Object.freeze({ points })),
  );
  if (simplifiedTopology.length > 0) {
    return invalid({
      code: ATLAS_COASTLINE_DIAGNOSTIC_CODES.topologyInvalid,
      message: 'Guarded simplification did not preserve complete quantized ring topology.',
      suggestedAction: 'Reject the proposal; accepted semantic geography remains unchanged.',
      adapterDiagnostics: simplifiedTopology,
    });
  }
  const coastline: CanonicalWorldCoastline = Object.freeze({
    geometryBehaviorVersion: ATLAS_COASTLINE_GEOMETRY_BEHAVIOR_VERSION,
    extractionAlgorithmVersion: ATLAS_COASTLINE_EXTRACTION_ALGORITHM_VERSION,
    simplificationPolicyVersion: ATLAS_COASTLINE_SIMPLIFICATION_POLICY_VERSION,
    simplificationToleranceTicks: ATLAS_COASTLINE_SIMPLIFICATION_TOLERANCE_TICKS,
    topologyValidationVersion: ATLAS_COASTLINE_TOPOLOGY_VALIDATION_VERSION,
    winding: ATLAS_COASTLINE_WINDING,
    repairPolicy: ATLAS_COASTLINE_REPAIR_POLICY,
    rings: Object.freeze(canonicalRings),
  });
  const records: AtlasGeographyRecords = Object.freeze({ ...input.records, coastline });
  const replacement = proposal(input, coastline);
  return Object.freeze({
    status: 'proposed',
    patch: Object.freeze({
      patchKind: 'replace-atlas-canonical-coastline',
      operationMode: 'geography-dependency-recompute',
      records,
      replacement,
      explicitlyIncrementedAspectIds: Object.freeze([] as const),
      rawPointCount,
      canonicalPointCount,
    }),
  });
}

function acceptedField(records: AtlasSemanticGeographyRecords): QuantizedSphericalField {
  return Object.freeze({
    profile: WORLD_ATLAS_FULL_PROFILE,
    sampleCount: records.macroElevation.values.length,
    valueAt: (longitudeIndex: number, latitudeIndex: number) => {
      const index = storageIndex(longitudeIndex, latitudeIndex);
      const value = records.macroElevation.values[index];
      const parsed = parseAtlasFieldValueTicks(value);
      if (!parsed.ok) throw new Error(parsed.diagnostic.message);
      return parsed.value;
    },
  });
}

function proposal(
  input: AtlasCoastlineGenerationInput,
  coastline: CanonicalWorldCoastline,
): AtlasCoastlineAspectProposal {
  const definition = aspectDefinition();
  const aspectId = deriveAtlasAspectId(input.worldCoastlineEntityId, 'worldCoastline.geometry');
  const previous = input.previousAcceptedAspects.find((aspect) => aspect.aspectId === aspectId);
  const revision = previous?.variantRevision ?? revisionZero();
  const seedMetadata = mapEntitySeed(
    input,
    definition.generatorId,
    definition.aspectName,
    revision,
  );
  const dependencyAspects = [
    input.records.landWaterClassificationAspectId,
    ...input.records.landmasses.map(({ entityId }) =>
      deriveAtlasAspectId(entityId, 'landmass.classification'),
    ),
    ...input.records.waterBodies.map(({ entityId }) =>
      deriveAtlasAspectId(entityId, 'waterBody.classification'),
    ),
  ]
    .sort()
    .map((dependencyAspectId) => Object.freeze({ aspectId: dependencyAspectId }));
  return Object.freeze({
    status: 'proposed',
    target: Object.freeze({
      mapId: input.worldMapId,
      entityId: input.worldCoastlineEntityId,
      aspect: Object.freeze({ aspectId }),
      aspectName: definition.aspectName,
      variantRevision: revision,
    }),
    generatorId: definition.generatorId,
    generatorVersion: definition.generatorVersion,
    parameterSchemaVersion: definition.parameterSchemaVersion,
    parameters: ATLAS_COASTLINE_PARAMETERS,
    seedScope: 'map/entity',
    seedMetadata,
    dependencyAspects: Object.freeze(dependencyAspects),
    output: coastline,
    diagnostics: Object.freeze([] as GenerationDiagnostic[]),
  });
}

function mapEntitySeed(
  input: AtlasCoastlineGenerationInput,
  generatorId: (typeof ATLAS_ASPECT_DEFINITIONS)[number]['generatorId'],
  aspectName: (typeof ATLAS_ASPECT_DEFINITIONS)[number]['aspectName'],
  variantRevision: VariantRevision,
): MapEntitySeedInput {
  const parsed = parseSeedInput({
    seedDerivationVersion: SEED_DERIVATION_VERSION,
    deterministicStreamVersion: DETERMINISTIC_STREAM_VERSION,
    seedScope: 'map/entity',
    worldSeed: formatWorldSeed(input.worldSeed),
    generatorId,
    generatorVersion: ATLAS_COASTLINE_GEOMETRY_BEHAVIOR_VERSION,
    aspectName,
    variantRevision,
    mapId: input.worldMapId,
    entityId: input.worldCoastlineEntityId,
  });
  if (!parsed.ok || parsed.value.seedScope !== 'map/entity') {
    throw new Error('Coastline metadata did not produce a map/entity seed namespace.');
  }
  return parsed.value;
}

function aspectDefinition(): (typeof ATLAS_ASPECT_DEFINITIONS)[number] {
  const definition = ATLAS_ASPECT_DEFINITIONS.find(
    ({ kind }) => kind === 'worldCoastline.geometry',
  );
  if (definition === undefined) throw new Error('Missing coastline aspect definition.');
  return definition;
}

function revisionZero(): VariantRevision {
  const revision = createVariantRevision(0);
  if (!revision.ok) throw new Error('Coastline revision zero is invalid.');
  return revision.value;
}

function storageIndex(longitudeIndex: number, latitudeIndex: number): number {
  if (latitudeIndex === 0) return 0;
  if (latitudeIndex === WORLD_ATLAS_FULL_PROFILE.latitudeBandCount) {
    return (
      WORLD_ATLAS_FULL_PROFILE.longitudeCellCount *
        (WORLD_ATLAS_FULL_PROFILE.latitudeBandCount - 1) +
      1
    );
  }
  return 1 + (latitudeIndex - 1) * WORLD_ATLAS_FULL_PROFILE.longitudeCellCount + longitudeIndex;
}

function sourceCoverageDiagnostic(): AtlasCoastlineGenerationDiagnostic {
  return {
    code: ATLAS_COASTLINE_DIAGNOSTIC_CODES.sourceCoverageInvalid,
    message: 'Extracted rings do not cover every accepted land/water adjacency exactly once.',
    suggestedAction:
      'Reject the proposal; no channel, island, or classification edge may be repaired away.',
  };
}

function sourceIdentityDiagnostic(message: string): AtlasCoastlineGenerationDiagnostic {
  return {
    code: ATLAS_COASTLINE_DIAGNOSTIC_CODES.sourceIdentityInvalid,
    message,
    suggestedAction: 'Reject the proposal and inspect semantic component ownership.',
  };
}

function windingDiagnostic(): AtlasCoastlineGenerationDiagnostic {
  return {
    code: ATLAS_COASTLINE_DIAGNOSTIC_CODES.windingInvalid,
    message: 'Extracted coastline rings are not consistently wound with land on the left.',
    suggestedAction: 'Reject the proposal; renderers must not repair or reinterpret ring winding.',
  };
}

function invalid(diagnostic: AtlasCoastlineGenerationDiagnostic): AtlasCoastlineGenerationResult {
  return Object.freeze({
    status: 'invalid',
    diagnostics: Object.freeze([Object.freeze(diagnostic)]),
  });
}

function compareAscii(left: string, right: string): -1 | 0 | 1 {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function isEntityId(value: EntityId | undefined): value is EntityId {
  return value !== undefined;
}
