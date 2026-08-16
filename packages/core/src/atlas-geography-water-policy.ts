/** Version-1 marine clearance and basin/sea segmentation shared by generation and validation. */

import { fingerprintAtlasSurfaceComponent } from './atlas-geography-identity.js';
import type { AtlasOceanConnectivity } from './atlas-geography-model.js';
import { ATLAS_SEMANTIC_POLICY } from './atlas-geography-semantic-policy.js';
import {
  type AtlasSurfaceComponentAnalysis,
  type AtlasSurfacePartitionAnalysis,
  forEachAtlasSurfaceNeighbor,
  summarizeAtlasLabeledRegions,
} from './atlas-geography-surface-topology.js';

export interface AtlasWaterRegionAnalysis extends AtlasSurfaceComponentAnalysis {
  readonly kind: 'water';
  readonly waterBodyKind: 'oceanBasin' | 'sea';
  readonly enclosure: 'enclosed' | 'open-marine';
  readonly connectedRegionIndices: readonly number[];
}

export type AtlasWaterSegmentationResult =
  | {
      readonly ok: true;
      readonly regions: readonly AtlasWaterRegionAnalysis[];
      readonly regionIndexBySample: Int32Array;
    }
  | { readonly ok: false; readonly reason: string };

/** Segment raw water connectivity through the explicit v1 clearance graph. */
export function segmentAtlasWaterBodies(
  samples: readonly ('land' | 'water')[],
  partition: AtlasSurfacePartitionAnalysis,
  oceanConnectivity: AtlasOceanConnectivity,
): AtlasWaterSegmentationResult {
  const rawWater = partition.components
    .filter((component) => component.kind === 'water')
    .sort(compareComponentAreaThenRanges);
  const primary = rawWater[0];
  if (primary === undefined) {
    return Object.freeze({ ok: false, reason: 'The accepted partition contains no water.' });
  }
  const clearance = distanceFromLand(samples);
  const rawPrimaryIndex = primary.analysisIndex;
  const coreLabels = canonicalizeCoreLabels(
    discoverClearanceCores(partition, rawPrimaryIndex, clearance),
    partition.rowWeights,
  );
  const coreCount = maximumLabel(coreLabels) + 1;
  if (oceanConnectivity === 'multipleBasins' && coreCount < 2) {
    return Object.freeze({
      ok: false,
      reason:
        'The version-1 open-marine clearance graph cannot realize two disconnected basin roots.',
    });
  }

  const regionIndexBySample = assignPrimaryRegions(
    partition,
    rawPrimaryIndex,
    coreLabels,
    Math.max(1, coreCount),
  );
  let nextRegionIndex = Math.max(1, coreCount);
  for (const component of rawWater.slice(1)) {
    for (const range of component.sampleRanges) {
      regionIndexBySample.fill(nextRegionIndex, range.startIndex, range.endIndexExclusive);
    }
    nextRegionIndex += 1;
  }

  const summaries = summarizeAtlasLabeledRegions(
    regionIndexBySample,
    'water',
    partition.rowWeights,
  );
  const openRegionCount = Math.max(1, coreCount);
  const largestOpenRegionIndex = summaries
    .slice(0, openRegionCount)
    .sort(compareComponentAreaThenRanges)[0]?.analysisIndex;
  const connections =
    oceanConnectivity === 'multipleBasins'
      ? new Map<number, readonly number[]>()
      : openRegionAdjacency(regionIndexBySample, openRegionCount);
  const regions = summaries.map((summary): AtlasWaterRegionAnalysis => {
    const isOpen = summary.analysisIndex < openRegionCount;
    return Object.freeze({
      ...summary,
      kind: 'water',
      waterBodyKind:
        isOpen &&
        (oceanConnectivity === 'multipleBasins' || summary.analysisIndex === largestOpenRegionIndex)
          ? 'oceanBasin'
          : 'sea',
      enclosure: isOpen ? 'open-marine' : 'enclosed',
      connectedRegionIndices: Object.freeze([...(connections.get(summary.analysisIndex) ?? [])]),
    });
  });
  return Object.freeze({ ok: true, regions: Object.freeze(regions), regionIndexBySample });
}

function distanceFromLand(samples: readonly ('land' | 'water')[]): Uint8Array {
  const distance = new Uint8Array(samples.length);
  distance.fill(255);
  const queue = new Int32Array(samples.length);
  let head = 0;
  let tail = 0;
  for (let index = 0; index < samples.length; index += 1) {
    if (samples[index] === 'land') {
      distance[index] = 0;
      queue[tail] = index;
      tail += 1;
    }
  }
  while (head < tail) {
    const current = queue[head];
    head += 1;
    if (current === undefined) throw new Error('Land-distance queue lost an anchor.');
    const nextDistance = Math.min(254, (distance[current] ?? 0) + 1);
    forEachAtlasSurfaceNeighbor(current, (neighbor) => {
      if ((distance[neighbor] ?? 0) > nextDistance) {
        distance[neighbor] = nextDistance;
        queue[tail] = neighbor;
        tail += 1;
      }
    });
  }
  return distance;
}

function discoverClearanceCores(
  partition: AtlasSurfacePartitionAnalysis,
  rawPrimaryIndex: number,
  clearance: Uint8Array,
): Int32Array {
  const labels = new Int32Array(clearance.length);
  labels.fill(-1);
  const queue = new Int32Array(clearance.length);
  let nextLabel = 0;
  for (let start = 0; start < clearance.length; start += 1) {
    if (
      labels[start] !== -1 ||
      partition.componentIndexBySample[start] !== rawPrimaryIndex ||
      (clearance[start] ?? 0) <= ATLAS_SEMANTIC_POLICY.openMarineClearanceCells
    ) {
      continue;
    }
    let head = 0;
    let tail = 0;
    queue[tail] = start;
    tail += 1;
    labels[start] = nextLabel;
    while (head < tail) {
      const current = queue[head];
      head += 1;
      if (current === undefined) throw new Error('Clearance-core queue lost an anchor.');
      forEachAtlasSurfaceNeighbor(current, (neighbor) => {
        if (
          labels[neighbor] === -1 &&
          partition.componentIndexBySample[neighbor] === rawPrimaryIndex &&
          (clearance[neighbor] ?? 0) > ATLAS_SEMANTIC_POLICY.openMarineClearanceCells
        ) {
          labels[neighbor] = nextLabel;
          queue[tail] = neighbor;
          tail += 1;
        }
      });
    }
    nextLabel += 1;
  }
  return labels;
}

function canonicalizeCoreLabels(labels: Int32Array, rowWeights: Int32Array): Int32Array {
  const summaries = summarizeAtlasLabeledRegions(labels, 'water', rowWeights);
  if (summaries.length < 2) return labels;
  const canonicalOrder = summaries
    .map((summary) => ({
      previous: summary.analysisIndex,
      fingerprint: fingerprintAtlasSurfaceComponent('water', summary.sampleRanges),
    }))
    .sort(
      (left, right) =>
        compareText(left.fingerprint, right.fingerprint) || left.previous - right.previous,
    );
  const remap = new Int32Array(summaries.length);
  for (const [canonical, entry] of canonicalOrder.entries()) remap[entry.previous] = canonical;
  for (let index = 0; index < labels.length; index += 1) {
    const previous = labels[index];
    if (previous !== undefined && previous >= 0) labels[index] = remap[previous] ?? -1;
  }
  return labels;
}

function assignPrimaryRegions(
  partition: AtlasSurfacePartitionAnalysis,
  rawPrimaryIndex: number,
  coreLabels: Int32Array,
  coreCount: number,
): Int32Array {
  const labels = new Int32Array(coreLabels.length);
  labels.fill(-1);
  if (maximumLabel(coreLabels) < 0) {
    for (let index = 0; index < labels.length; index += 1) {
      if (partition.componentIndexBySample[index] === rawPrimaryIndex) labels[index] = 0;
    }
    return labels;
  }
  const queue = new Int32Array(coreLabels.length);
  let head = 0;
  let tail = 0;
  for (let index = 0; index < coreLabels.length; index += 1) {
    const coreLabel = coreLabels[index];
    if (coreLabel !== undefined && coreLabel >= 0) {
      labels[index] = coreLabel;
      queue[tail] = index;
      tail += 1;
    }
  }
  while (head < tail) {
    const current = queue[head];
    head += 1;
    if (current === undefined) throw new Error('Marine-region queue lost an anchor.');
    const label = labels[current];
    if (label === undefined || label < 0 || label >= coreCount) continue;
    forEachAtlasSurfaceNeighbor(current, (neighbor) => {
      if (
        partition.componentIndexBySample[neighbor] === rawPrimaryIndex &&
        labels[neighbor] === -1
      ) {
        labels[neighbor] = label;
        queue[tail] = neighbor;
        tail += 1;
      }
    });
  }
  return labels;
}

function openRegionAdjacency(
  labels: Int32Array,
  openRegionCount: number,
): ReadonlyMap<number, readonly number[]> {
  const adjacency = Array.from({ length: openRegionCount }, () => new Set<number>());
  for (let index = 0; index < labels.length; index += 1) {
    const label = labels[index];
    if (label === undefined || label < 0 || label >= openRegionCount) continue;
    forEachAtlasSurfaceNeighbor(index, (neighbor) => {
      const other = labels[neighbor];
      if (other !== undefined && other >= 0 && other < openRegionCount && other !== label) {
        adjacency[label]?.add(other);
      }
    });
  }
  return new Map(
    adjacency.map((neighbors, index) => [
      index,
      Object.freeze([...neighbors].sort((a, b) => a - b)),
    ]),
  );
}

function compareComponentAreaThenRanges(
  left: AtlasSurfaceComponentAnalysis,
  right: AtlasSurfaceComponentAnalysis,
): number {
  return (
    right.sphericalAreaWeight - left.sphericalAreaWeight ||
    (left.sampleRanges[0]?.startIndex ?? 0) - (right.sampleRanges[0]?.startIndex ?? 0)
  );
}

function maximumLabel(labels: Int32Array): number {
  let maximum = -1;
  for (const label of labels) maximum = Math.max(maximum, label);
  return maximum;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
