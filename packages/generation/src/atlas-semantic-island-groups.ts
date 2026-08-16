/** Deterministic, disjoint island-chain and archipelago relationship classification. */

import {
  deriveAtlasIslandGroupEntityId,
  type EntityId,
  type IslandGroup,
  type MapId,
} from '@ttrpg-map/core';

import { ATLAS_SEMANTIC_POLICY } from './atlas-semantic-classifier-policy.js';
import type { AtlasSurfaceCentroid } from './atlas-surface-topology.js';

export interface AtlasIslandGroupCandidate {
  readonly entityId: EntityId;
  readonly centroid: AtlasSurfaceCentroid;
}

/** Classify a bounded, geometry-ranked subset; unselected islands remain valid individuals. */
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

function angularDistance(left: AtlasSurfaceCentroid, right: AtlasSurfaceCentroid): number {
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
