/** Deterministic #59 semantic classification over accepted #58 land/water records. */

import {
  type AspectId,
  ATLAS_LANDMASS_KINDS,
  ATLAS_SEMANTIC_CLASSIFICATION_VERSION,
  type AtlasGeographyDiagnostic,
  type AtlasLandWaterRecords,
  type AtlasSemanticGeographyRecords,
  type AtlasSurfaceComponentMembership,
  deriveAtlasSemanticComponentIdentity,
  deriveAtlasSingletonEntityIds,
  type EntityId,
  type Landmass,
  type MapId,
  validateAtlasLandWaterRecords,
  validateAtlasSemanticGeographyRecords,
  type WaterBody,
} from '@ttrpg-map/core';

import { ATLAS_SEMANTIC_POLICY } from './atlas-semantic-classifier-policy.js';
import { classifyAtlasIslandGroups } from './atlas-semantic-island-groups.js';
import { segmentAtlasWaterBodies } from './atlas-semantic-water.js';
import {
  analyzeAtlasSurfacePartition,
  type AtlasSurfaceComponentAnalysis,
  forEachAtlasSurfaceNeighbor,
} from './atlas-surface-topology.js';

export interface AtlasSemanticClassificationInput {
  readonly worldMapId: MapId;
  readonly worldSurfaceEntityId: EntityId;
  readonly landWaterClassificationAspectId: AspectId;
  readonly records: AtlasLandWaterRecords;
}

export interface AtlasSemanticClassificationDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly suggestedAction: string;
}

export type AtlasSemanticClassificationResult =
  | { readonly ok: true; readonly records: AtlasSemanticGeographyRecords }
  | {
      readonly ok: false;
      readonly diagnostics: readonly AtlasSemanticClassificationDiagnostic[];
    };

interface LandmassDraft {
  readonly analysis: AtlasSurfaceComponentAnalysis;
  readonly entityId: EntityId;
  readonly componentId: Landmass['componentId'];
  readonly membership: AtlasSurfaceComponentMembership;
  readonly kind: Landmass['kind'];
}

interface WaterBodyDraft {
  readonly regionIndex: number;
  readonly entityId: EntityId;
  readonly componentId: WaterBody['componentId'];
  readonly membership: AtlasSurfaceComponentMembership;
  readonly kind: WaterBody['kind'];
  readonly enclosure: WaterBody['enclosure'];
  readonly connectedRegionIndices: readonly number[];
}

/** Classify one immutable accepted full-profile partition without changing its cells. */
export function classifyAtlasSemanticGeography(
  input: AtlasSemanticClassificationInput,
): AtlasSemanticClassificationResult {
  const inputDiagnostics = validateAtlasLandWaterRecords(input.records);
  const expectedSurface = deriveAtlasSingletonEntityIds(input.worldMapId).worldSurfaceEntityId;
  if (inputDiagnostics.length > 0 || input.worldSurfaceEntityId !== expectedSurface) {
    return failure(
      'atlas.semantic.input-invalid',
      'Semantic classification requires valid accepted #58 records and their derived world-surface owner.',
      'Regenerate or restore the accepted land/water proposal before semantic classification.',
    );
  }
  const partition = analyzeAtlasSurfacePartition(input.records.landWaterClassification.samples);
  const water = segmentAtlasWaterBodies(
    input.records.landWaterClassification.samples,
    partition,
    input.records.controls.oceanConnectivity,
  );
  if (!water.ok) {
    return failure(
      'atlas.semantic.classification-impossible',
      water.reason,
      'Change the upstream geography proposal or ocean-connectivity control and retry.',
    );
  }
  const landAnalyses = partition.components.filter((component) => component.kind === 'land');
  const totalLandArea = landAnalyses.reduce(
    (total, component) => total + component.sphericalAreaWeight,
    0,
  );
  if (totalLandArea <= 0) {
    return failure(
      'atlas.semantic.classification-impossible',
      'The accepted partition has no positive-area land component.',
      'Regenerate the upstream partition with non-empty atlas-scale land.',
    );
  }

  const landDrafts = landAnalyses.map((analysis): LandmassDraft => {
    const identity = deriveAtlasSemanticComponentIdentity(
      input.worldMapId,
      input.worldSurfaceEntityId,
      'land',
      analysis.sampleRanges,
    );
    const kind =
      analysis.sphericalAreaWeight * 100 >=
      totalLandArea * ATLAS_SEMANTIC_POLICY.continentMinimumLandAreaPercent
        ? ATLAS_LANDMASS_KINDS.continent
        : analysis.sphericalAreaWeight * 100 >=
            totalLandArea * ATLAS_SEMANTIC_POLICY.majorIslandMinimumLandAreaPercent
          ? ATLAS_LANDMASS_KINDS.majorIsland
          : ATLAS_LANDMASS_KINDS.island;
    return Object.freeze({
      analysis,
      entityId: identity.entityId,
      componentId: identity.componentId,
      membership: membership(identity.fingerprint, analysis),
      kind,
    });
  });
  const waterDrafts = water.regions.map((region): WaterBodyDraft => {
    const identity = deriveAtlasSemanticComponentIdentity(
      input.worldMapId,
      input.worldSurfaceEntityId,
      'water',
      region.sampleRanges,
    );
    return Object.freeze({
      regionIndex: region.analysisIndex,
      entityId: identity.entityId,
      componentId: identity.componentId,
      membership: membership(identity.fingerprint, region),
      kind: region.waterBodyKind,
      enclosure: region.enclosure,
      connectedRegionIndices: region.connectedRegionIndices,
    });
  });
  const adjacency = findLandWaterAdjacency(
    partition.componentIndexBySample,
    water.regionIndexBySample,
  );
  const landByAnalysis = new Map(landDrafts.map((draft) => [draft.analysis.analysisIndex, draft]));
  const waterByRegion = new Map(waterDrafts.map((draft) => [draft.regionIndex, draft]));

  const landmasses = landDrafts
    .map((draft): Landmass => {
      const adjacentDrafts = [...(adjacency.landToWater.get(draft.analysis.analysisIndex) ?? [])]
        .map((regionIndex) => waterByRegion.get(regionIndex))
        .filter((candidate): candidate is WaterBodyDraft => candidate !== undefined)
        .sort(compareEntityId);
      const containing =
        draft.kind === ATLAS_LANDMASS_KINDS.continent
          ? undefined
          : containingWaterBody(
              draft.analysis.analysisIndex,
              adjacentDrafts,
              adjacency.boundaryEdgeCounts,
            );
      return Object.freeze({
        entityId: draft.entityId,
        sourceClassificationAspectId: input.landWaterClassificationAspectId,
        componentId: draft.componentId,
        membership: draft.membership,
        kind: draft.kind,
        ...(containing === undefined ? {} : { containingWaterBodyId: containing.entityId }),
        adjacentWaterBodyIds: Object.freeze(adjacentDrafts.map(({ entityId }) => entityId)),
      });
    })
    .sort(compareEntityId);

  const waterBodies = waterDrafts
    .map((draft): WaterBody => {
      const adjacentLandmasses = [...(adjacency.waterToLand.get(draft.regionIndex) ?? [])]
        .map((analysisIndex) => landByAnalysis.get(analysisIndex))
        .filter((candidate): candidate is LandmassDraft => candidate !== undefined)
        .sort(compareEntityId);
      const connections = draft.connectedRegionIndices
        .map((regionIndex) => waterByRegion.get(regionIndex))
        .filter((candidate): candidate is WaterBodyDraft => candidate !== undefined)
        .sort(compareEntityId)
        .map(({ entityId }) =>
          Object.freeze({ connectedWaterBodyId: entityId, kind: 'open-marine-neck' as const }),
        );
      return Object.freeze({
        entityId: draft.entityId,
        sourceClassificationAspectId: input.landWaterClassificationAspectId,
        componentId: draft.componentId,
        membership: draft.membership,
        kind: draft.kind,
        enclosure: draft.enclosure,
        enclosedByLandmassIds: Object.freeze(
          draft.enclosure === 'enclosed' ? adjacentLandmasses.map(({ entityId }) => entityId) : [],
        ),
        adjacentLandmassIds: Object.freeze(adjacentLandmasses.map(({ entityId }) => entityId)),
        connectivity: Object.freeze(connections),
      });
    })
    .sort(compareEntityId);
  const landmassById = new Map(landmasses.map((landmass) => [landmass.entityId, landmass]));
  const islandGroups = classifyAtlasIslandGroups(
    input.worldMapId,
    landDrafts
      .filter(({ kind }) => kind !== ATLAS_LANDMASS_KINDS.continent)
      .map(({ entityId, analysis }) => Object.freeze({ entityId, centroid: analysis.centroid })),
    input.records.controls.archipelagoAbundancePercent,
  ).filter((group) => group.memberLandmassIds.every((id) => landmassById.has(id)));

  const records: AtlasSemanticGeographyRecords = Object.freeze({
    ...input.records,
    semanticClassificationVersion: ATLAS_SEMANTIC_CLASSIFICATION_VERSION,
    worldMapId: input.worldMapId,
    worldSurfaceEntityId: input.worldSurfaceEntityId,
    landWaterClassificationAspectId: input.landWaterClassificationAspectId,
    landmasses: Object.freeze(landmasses),
    islandGroups: Object.freeze(islandGroups),
    waterBodies: Object.freeze(waterBodies),
  });
  const validation = validateAtlasSemanticGeographyRecords(records);
  if (!validation.ok) return validationFailure(validation.diagnostics);
  return Object.freeze({ ok: true, records });
}

function membership(
  fingerprint: string,
  analysis: AtlasSurfaceComponentAnalysis,
): AtlasSurfaceComponentMembership {
  return Object.freeze({
    classificationVersion: ATLAS_SEMANTIC_CLASSIFICATION_VERSION,
    fingerprint,
    sampleCount: analysis.sampleCount,
    sphericalAreaWeight: analysis.sphericalAreaWeight,
    sampleRanges: analysis.sampleRanges,
  });
}

function findLandWaterAdjacency(
  landComponentBySample: Int32Array,
  waterRegionBySample: Int32Array,
): Readonly<{
  landToWater: ReadonlyMap<number, ReadonlySet<number>>;
  waterToLand: ReadonlyMap<number, ReadonlySet<number>>;
  boundaryEdgeCounts: ReadonlyMap<string, number>;
}> {
  const landToWater = new Map<number, Set<number>>();
  const waterToLand = new Map<number, Set<number>>();
  const boundaryEdgeCounts = new Map<string, number>();
  for (let index = 0; index < landComponentBySample.length; index += 1) {
    const landIndex = landComponentBySample[index];
    if (landIndex === undefined || waterRegionBySample[index] !== -1) continue;
    forEachAtlasSurfaceNeighbor(index, (neighbor) => {
      const waterIndex = waterRegionBySample[neighbor];
      if (waterIndex === undefined || waterIndex < 0) return;
      addSetValue(landToWater, landIndex, waterIndex);
      addSetValue(waterToLand, waterIndex, landIndex);
      const key = boundaryKey(landIndex, waterIndex);
      boundaryEdgeCounts.set(key, (boundaryEdgeCounts.get(key) ?? 0) + 1);
    });
  }
  return Object.freeze({ landToWater, waterToLand, boundaryEdgeCounts });
}

function containingWaterBody(
  landAnalysisIndex: number,
  candidates: readonly WaterBodyDraft[],
  boundaryEdgeCounts: ReadonlyMap<string, number>,
): WaterBodyDraft | undefined {
  return [...candidates].sort(
    (left, right) =>
      (boundaryEdgeCounts.get(boundaryKey(landAnalysisIndex, right.regionIndex)) ?? 0) -
        (boundaryEdgeCounts.get(boundaryKey(landAnalysisIndex, left.regionIndex)) ?? 0) ||
      compareEntityId(left, right),
  )[0];
}

function addSetValue(map: Map<number, Set<number>>, key: number, value: number): void {
  const values = map.get(key);
  if (values === undefined) map.set(key, new Set([value]));
  else values.add(value);
}

function boundaryKey(landAnalysisIndex: number, waterRegionIndex: number): string {
  return `${String(landAnalysisIndex)}:${String(waterRegionIndex)}`;
}

function compareEntityId(
  left: Readonly<{ entityId: EntityId }>,
  right: Readonly<{ entityId: EntityId }>,
): -1 | 0 | 1 {
  if (left.entityId < right.entityId) return -1;
  if (left.entityId > right.entityId) return 1;
  return 0;
}

function validationFailure(
  diagnostics: readonly AtlasGeographyDiagnostic[],
): AtlasSemanticClassificationResult {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze(
      diagnostics.map((diagnostic) =>
        Object.freeze({
          code: mapValidationCode(diagnostic.code),
          message: diagnostic.message,
          suggestedAction:
            'Reject this proposal, retain accepted geography, and inspect the referenced semantic relationship.',
        }),
      ),
    ),
  });
}

function mapValidationCode(code: string): string {
  if (code.includes('ambiguous')) return 'atlas.semantic.classification-ambiguous';
  if (code.includes('disconnected')) return 'atlas.semantic.component-disconnected';
  if (code.includes('overlap')) return 'atlas.semantic.ownership-overlap';
  if (code.includes('missing')) return 'atlas.semantic.ownership-missing';
  if (code.includes('collision')) return 'atlas.semantic.identity-collision';
  if (
    code.includes('relationship') ||
    code.includes('containment') ||
    code.includes('connectivity')
  ) {
    return 'atlas.semantic.relationship-invalid';
  }
  return 'atlas.semantic.output-invalid';
}

function failure(
  code: string,
  message: string,
  suggestedAction: string,
): AtlasSemanticClassificationResult {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([Object.freeze({ code, message, suggestedAction })]),
  });
}
