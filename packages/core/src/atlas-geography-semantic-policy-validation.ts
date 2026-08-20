/** Recompute version-1 semantic policy truth before records can be accepted or decoded. */

import {
  ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES,
  type AtlasGeographyDiagnostic,
} from './atlas-geography-diagnostics.js';
import { deriveAtlasSemanticComponentIdentity } from './atlas-geography-identity.js';
import type {
  AtlasSemanticGeographyRecords,
  AtlasSurfaceComponentMembership,
  IslandGroup,
  WaterBody,
} from './atlas-geography-model.js';
import {
  type AtlasIslandGroupCandidate,
  classifyAtlasIslandGroups,
  classifyAtlasLandmassKind,
} from './atlas-geography-semantic-policy.js';
import {
  analyzeAtlasSurfacePartition,
  atlasMembershipCentroid,
  type AtlasSurfacePartitionAnalysis,
  trustedAtlasSurfacePartitionAnalysisFor,
} from './atlas-geography-surface-topology.js';
import {
  type AtlasWaterSegmentationResult,
  segmentAtlasWaterBodies,
  trustedAtlasWaterSegmentationFor,
} from './atlas-geography-water-policy.js';
import type { EntityId } from './identity.js';

export interface AtlasSemanticPolicyAnalysis {
  readonly partition: AtlasSurfacePartitionAnalysis;
  readonly water: Extract<AtlasWaterSegmentationResult, { readonly ok: true }>;
}

/** Validate every deterministic v1 threshold, grouping, enclosure, and basin-root rule. */
export function validateAtlasSemanticPolicyConformance(
  records: AtlasSemanticGeographyRecords,
  precomputed?: AtlasSemanticPolicyAnalysis,
): readonly AtlasGeographyDiagnostic[] {
  const diagnostics: AtlasGeographyDiagnostic[] = [];
  validateBasinRoots(records, diagnostics);
  if (diagnostics.length > 0) return diagnostics;

  const totalLandAreaWeight = records.landmasses.reduce(
    (total, landmass) => total + landmass.membership.sphericalAreaWeight,
    0,
  );
  for (const landmass of records.landmasses) {
    const expectedKind = classifyAtlasLandmassKind(
      landmass.membership.sphericalAreaWeight,
      totalLandAreaWeight,
    );
    if (landmass.kind !== expectedKind) {
      diagnostics.push(
        policyDiagnostic(
          `Land component ${landmass.membership.fingerprint} must be classified as ${expectedKind} by the version-1 20%/2% spherical-area thresholds.`,
        ),
      );
    }
  }
  if (diagnostics.length > 0) return diagnostics;

  const groupCandidates: AtlasIslandGroupCandidate[] = records.landmasses
    .filter(({ kind }) => kind !== 'continent')
    .map(({ entityId, membership }) => ({
      entityId,
      centroid: atlasMembershipCentroid(membership),
    }));
  const expectedGroups = classifyAtlasIslandGroups(
    records.worldMapId,
    groupCandidates,
    records.controls.archipelagoAbundancePercent,
  );
  if (!sameIslandGroups(records.islandGroups, expectedGroups)) {
    diagnostics.push(
      policyDiagnostic(
        'Island groups must exactly match the version-1 abundance budget, centroid thresholds, kind, membership, and chain order.',
      ),
    );
  }
  if (diagnostics.length > 0) return diagnostics;

  const samples = records.landWaterClassification.samples;
  const partition =
    precomputed === undefined
      ? analyzeAtlasSurfacePartition(samples)
      : (trustedAtlasSurfacePartitionAnalysisFor(precomputed.partition, samples) ??
        analyzeAtlasSurfacePartition(samples));
  const landAnalyses = partition.components.filter(({ kind }) => kind === 'land');
  const expectedLandIds = new Set(
    landAnalyses.map(
      ({ sampleRanges }) =>
        deriveAtlasSemanticComponentIdentity(
          records.worldMapId,
          records.worldSurfaceEntityId,
          'land',
          sampleRanges,
        ).entityId,
    ),
  );
  if (
    records.landmasses.length !== expectedLandIds.size ||
    records.landmasses.some(({ entityId }) => !expectedLandIds.has(entityId))
  ) {
    diagnostics.push(
      policyDiagnostic(
        'Accepted landmass entities must exactly match version-1 globe-connected land components.',
      ),
    );
    return diagnostics;
  }

  const water =
    precomputed === undefined
      ? segmentAtlasWaterBodies(samples, partition, records.controls.oceanConnectivity)
      : (trustedAtlasWaterSegmentationFor(
          precomputed.water,
          samples,
          partition,
          records.controls.oceanConnectivity,
        ) ?? segmentAtlasWaterBodies(samples, partition, records.controls.oceanConnectivity));
  if (!water.ok) {
    diagnostics.push(policyDiagnostic(water.reason));
    return diagnostics;
  }
  const actualWaterById = new Map(
    records.waterBodies.map((waterBody) => [waterBody.entityId, waterBody] as const),
  );
  const expectedWaterIdsByRegion = new Map<number, EntityId>();
  for (const region of water.regions) {
    const identity = deriveAtlasSemanticComponentIdentity(
      records.worldMapId,
      records.worldSurfaceEntityId,
      'water',
      region.sampleRanges,
    );
    expectedWaterIdsByRegion.set(region.analysisIndex, identity.entityId);
  }
  const expectedWaterIds = new Set(expectedWaterIdsByRegion.values());
  for (const region of water.regions) {
    const entityId = expectedWaterIdsByRegion.get(region.analysisIndex);
    const actual = entityId === undefined ? undefined : actualWaterById.get(entityId);
    const expectedConnections = region.connectedRegionIndices
      .flatMap((index) => {
        const connectedId = expectedWaterIdsByRegion.get(index);
        return connectedId === undefined ? [] : [connectedId];
      })
      .sort(compareText);
    const actualConnections = (actual?.connectivity ?? [])
      .map(({ connectedWaterBodyId }) => connectedWaterBodyId)
      .sort(compareText);
    if (
      actual?.kind !== region.waterBodyKind ||
      actual.enclosure !== region.enclosure ||
      !sameStrings(actualConnections, expectedConnections)
    ) {
      diagnostics.push(
        policyDiagnostic(
          `Water region ${entityId ?? 'unknown'} must match version-1 clearance, enclosure, basin-root, largest-region, and neck policy.`,
        ),
      );
    }
  }
  if (
    records.waterBodies.length !== expectedWaterIds.size ||
    records.waterBodies.some(({ entityId }) => !expectedWaterIds.has(entityId))
  ) {
    diagnostics.push(
      policyDiagnostic(
        'Accepted water bodies must exactly match version-1 open-marine and enclosed region memberships.',
      ),
    );
  }
  return diagnostics;
}

function validateBasinRoots(
  records: AtlasSemanticGeographyRecords,
  diagnostics: AtlasGeographyDiagnostic[],
): void {
  const open = records.waterBodies.filter(({ enclosure }) => enclosure === 'open-marine');
  const byId = new Map(open.map((body) => [body.entityId, body] as const));
  const seen = new Set<EntityId>();
  let hasInvalidRootComponent = false;
  for (const start of open) {
    if (seen.has(start.entityId)) continue;
    const queue = [start.entityId];
    let rootCount = 0;
    seen.add(start.entityId);
    while (queue.length > 0) {
      const currentId = queue.shift();
      if (currentId === undefined) continue;
      const current = byId.get(currentId);
      if (current?.kind === 'oceanBasin') rootCount += 1;
      for (const { connectedWaterBodyId } of current?.connectivity ?? []) {
        if (byId.has(connectedWaterBodyId) && !seen.has(connectedWaterBodyId)) {
          seen.add(connectedWaterBodyId);
          queue.push(connectedWaterBodyId);
        }
      }
    }
    if (rootCount !== 1) hasInvalidRootComponent = true;
  }
  const largestOpen = [...open].sort(compareWaterAreaThenMembership)[0];
  const expectedKinds =
    records.controls.oceanConnectivity === 'multipleBasins'
      ? open.every(({ kind }) => kind === 'oceanBasin') && open.length >= 2
      : open.filter(({ kind }) => kind === 'oceanBasin').length === 1 &&
        largestOpen?.kind === 'oceanBasin';
  if (hasInvalidRootComponent || !expectedKinds) {
    diagnostics.push(
      policyDiagnostic(
        'Every open-marine graph component must have exactly one ocean-basin root; single-global and connected-majority must root the largest region, while multiple-basins must root every independent open region.',
      ),
    );
  }
}

function sameIslandGroups(left: readonly IslandGroup[], right: readonly IslandGroup[]): boolean {
  return (
    left.length === right.length &&
    left.every((group, index) => {
      const expected = right[index];
      if (expected === undefined) return false;
      return (
        group.entityId === expected.entityId &&
        group.kind === expected.kind &&
        sameStrings(group.memberLandmassIds, expected.memberLandmassIds)
      );
    })
  );
}

function compareWaterAreaThenMembership(left: WaterBody, right: WaterBody): number {
  return (
    right.membership.sphericalAreaWeight - left.membership.sphericalAreaWeight ||
    compareMembership(left.membership, right.membership)
  );
}

function compareMembership(
  left: AtlasSurfaceComponentMembership,
  right: AtlasSurfaceComponentMembership,
): number {
  const count = Math.min(left.sampleRanges.length, right.sampleRanges.length);
  for (let index = 0; index < count; index += 1) {
    const leftRange = left.sampleRanges[index];
    const rightRange = right.sampleRanges[index];
    const comparison =
      (leftRange?.startIndex ?? 0) - (rightRange?.startIndex ?? 0) ||
      (leftRange?.endIndexExclusive ?? 0) - (rightRange?.endIndexExclusive ?? 0);
    if (comparison !== 0) return comparison;
  }
  return left.sampleRanges.length - right.sampleRanges.length;
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function policyDiagnostic(message: string): AtlasGeographyDiagnostic {
  return Object.freeze({ code: ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.policyMisclassification, message });
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
