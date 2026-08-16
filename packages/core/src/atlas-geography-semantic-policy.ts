/** Executable version-1 semantic policy shared by generation and accepted-record validation. */

import { deriveAtlasIslandGroupEntityId } from './atlas-geography-identity.js';
import {
  ATLAS_CONNECTED_MAJORITY_MINIMUM_PERCENT,
  ATLAS_SEMANTIC_AREA_WEIGHT_SCALE,
  type AtlasLandmassKind,
  type IslandGroup,
} from './atlas-geography-model.js';
import type { EntityId, MapId } from './identity.js';

export const ATLAS_SEMANTIC_POLICY_VERSION = 1 as const;

export const ATLAS_SEMANTIC_POLICY = Object.freeze({
  policyVersion: ATLAS_SEMANTIC_POLICY_VERSION,
  sphericalAreaWeightScale: ATLAS_SEMANTIC_AREA_WEIGHT_SCALE,
  continentMinimumLandAreaBasisPoints: 2_000,
  continentMinimumLandAreaPercent: 20,
  majorIslandMinimumLandAreaBasisPoints: 200,
  majorIslandMinimumLandAreaPercent: 2,
  minimumRetainedIslandSampleCount: 1,
  openMarineClearanceCells: 16,
  minimumRetainedSeaSampleCount: 1,
  connectedMajorityMinimumPercent: ATLAS_CONNECTED_MAJORITY_MINIMUM_PERCENT,
  islandGroupBudgetRounding: 'floor' as const,
  archipelagoMaximumCentroidSeparationMilliRad: 750,
  archipelagoMaximumCentroidSeparationRad: 0.75,
  islandChainMaximumNeighborSeparationMilliRad: 1_800,
  islandChainMaximumNeighborSeparationRad: 1.8,
  minimumBudgetForBothIslandGroupKinds: 4,
  componentFingerprintVersion: 1,
  identityDerivationVersion: 1,
});

export type AtlasSemanticPolicy = typeof ATLAS_SEMANTIC_POLICY;

export interface AtlasSemanticCentroid {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface AtlasIslandGroupCandidate {
  readonly entityId: EntityId;
  readonly centroid: AtlasSemanticCentroid;
}

/** Apply the exact v1 integer-area thresholds without floating-point percentage division. */
export function classifyAtlasLandmassKind(
  sphericalAreaWeight: number,
  totalLandAreaWeight: number,
): AtlasLandmassKind {
  if (
    sphericalAreaWeight * 10_000 >=
    totalLandAreaWeight * ATLAS_SEMANTIC_POLICY.continentMinimumLandAreaBasisPoints
  ) {
    return 'continent';
  }
  if (
    sphericalAreaWeight * 10_000 >=
    totalLandAreaWeight * ATLAS_SEMANTIC_POLICY.majorIslandMinimumLandAreaBasisPoints
  ) {
    return 'majorIsland';
  }
  return 'island';
}

/** Classify the exact deterministic v1 island-group set and member order. */
export function classifyAtlasIslandGroups(
  worldMapId: MapId,
  candidates: readonly AtlasIslandGroupCandidate[],
  archipelagoAbundancePercent: number,
): readonly IslandGroup[] {
  const canonicalCandidates = [...candidates].sort(compareCandidateId);
  let budget = Math.floor((canonicalCandidates.length * archipelagoAbundancePercent) / 100);
  if (budget < 2) return Object.freeze([]);
  budget = Math.min(budget, canonicalCandidates.length);
  const selected = [...canonicalCandidates]
    .sort(
      (left, right) =>
        nearestDistance(left, canonicalCandidates) - nearestDistance(right, canonicalCandidates) ||
        compareCandidateId(left, right),
    )
    .slice(0, budget);

  const groups: IslandGroup[] = [];
  if (selected.length >= ATLAS_SEMANTIC_POLICY.minimumBudgetForBothIslandGroupKinds) {
    const compactPair = closestPair(selected);
    if (
      compactPair !== undefined &&
      angularDistance(compactPair[0].centroid, compactPair[1].centroid) <=
        ATLAS_SEMANTIC_POLICY.archipelagoMaximumCentroidSeparationRad
    ) {
      groups.push(createGroup(worldMapId, 'archipelago', compactPair));
      const pairIds = new Set(compactPair.map(({ entityId }) => entityId));
      const remaining = selected.filter(({ entityId }) => !pairIds.has(entityId));
      if (remaining.length >= 2) {
        const chain = chainOrder(remaining);
        if (
          maximumNeighborDistance(chain) <=
          ATLAS_SEMANTIC_POLICY.islandChainMaximumNeighborSeparationRad
        ) {
          groups.push(createGroup(worldMapId, 'islandChain', chain));
        }
      }
      return Object.freeze(groups.sort(compareGroupId));
    }
  }

  const maximumDistance = maximumPairDistance(selected);
  const kind =
    maximumDistance <= ATLAS_SEMANTIC_POLICY.archipelagoMaximumCentroidSeparationRad
      ? ('archipelago' as const)
      : ('islandChain' as const);
  const members =
    kind === 'archipelago' ? [...selected].sort(compareCandidateId) : chainOrder(selected);
  if (
    kind === 'islandChain' &&
    maximumNeighborDistance(members) > ATLAS_SEMANTIC_POLICY.islandChainMaximumNeighborSeparationRad
  ) {
    return Object.freeze([]);
  }
  return Object.freeze([createGroup(worldMapId, kind, members)]);
}

function createGroup(
  worldMapId: MapId,
  kind: IslandGroup['kind'],
  members: readonly AtlasIslandGroupCandidate[],
): IslandGroup {
  const memberLandmassIds = members.map(({ entityId }) => entityId);
  return Object.freeze({
    entityId: deriveAtlasIslandGroupEntityId(worldMapId, kind, memberLandmassIds),
    kind,
    memberLandmassIds: Object.freeze(memberLandmassIds),
  });
}

function chainOrder(
  candidates: readonly AtlasIslandGroupCandidate[],
): readonly AtlasIslandGroupCandidate[] {
  const remaining = [...candidates].sort(compareCandidateId);
  const first = remaining.shift();
  if (first === undefined) return Object.freeze([]);
  const ordered = [first];
  while (remaining.length > 0) {
    const current = ordered[ordered.length - 1];
    if (current === undefined) break;
    remaining.sort(
      (left, right) =>
        angularDistance(current.centroid, left.centroid) -
          angularDistance(current.centroid, right.centroid) || compareCandidateId(left, right),
    );
    const next = remaining.shift();
    if (next !== undefined) ordered.push(next);
  }
  return Object.freeze(ordered);
}

function closestPair(
  candidates: readonly AtlasIslandGroupCandidate[],
): readonly [AtlasIslandGroupCandidate, AtlasIslandGroupCandidate] | undefined {
  let result: readonly [AtlasIslandGroupCandidate, AtlasIslandGroupCandidate] | undefined;
  let resultDistance = Number.POSITIVE_INFINITY;
  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      const left = candidates[leftIndex];
      const right = candidates[rightIndex];
      if (left === undefined || right === undefined) continue;
      const pair = [left, right].sort(compareCandidateId) as [
        AtlasIslandGroupCandidate,
        AtlasIslandGroupCandidate,
      ];
      const distance = angularDistance(left.centroid, right.centroid);
      if (
        distance < resultDistance ||
        (distance === resultDistance && pairKey(pair) < pairKey(result ?? pair))
      ) {
        result = pair;
        resultDistance = distance;
      }
    }
  }
  return result;
}

function nearestDistance(
  candidate: AtlasIslandGroupCandidate,
  candidates: readonly AtlasIslandGroupCandidate[],
): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (const other of candidates) {
    if (other.entityId !== candidate.entityId) {
      nearest = Math.min(nearest, angularDistance(candidate.centroid, other.centroid));
    }
  }
  return nearest;
}

function maximumPairDistance(candidates: readonly AtlasIslandGroupCandidate[]): number {
  let maximum = 0;
  for (let left = 0; left < candidates.length; left += 1) {
    for (let right = left + 1; right < candidates.length; right += 1) {
      const first = candidates[left];
      const second = candidates[right];
      if (first !== undefined && second !== undefined) {
        maximum = Math.max(maximum, angularDistance(first.centroid, second.centroid));
      }
    }
  }
  return maximum;
}

function maximumNeighborDistance(candidates: readonly AtlasIslandGroupCandidate[]): number {
  let maximum = 0;
  for (let index = 1; index < candidates.length; index += 1) {
    const previous = candidates[index - 1];
    const current = candidates[index];
    if (previous !== undefined && current !== undefined) {
      maximum = Math.max(maximum, angularDistance(previous.centroid, current.centroid));
    }
  }
  return maximum;
}

function angularDistance(left: AtlasSemanticCentroid, right: AtlasSemanticCentroid): number {
  const dot = Math.max(-1, Math.min(1, left.x * right.x + left.y * right.y + left.z * right.z));
  return Math.acos(dot);
}

function compareCandidateId(
  left: AtlasIslandGroupCandidate,
  right: AtlasIslandGroupCandidate,
): -1 | 0 | 1 {
  if (left.entityId < right.entityId) return -1;
  if (left.entityId > right.entityId) return 1;
  return 0;
}

function compareGroupId(left: IslandGroup, right: IslandGroup): -1 | 0 | 1 {
  if (left.entityId < right.entityId) return -1;
  if (left.entityId > right.entityId) return 1;
  return 0;
}

function pairKey(pair: readonly AtlasIslandGroupCandidate[]): string {
  return pair.map(({ entityId }) => entityId).join('\0');
}
