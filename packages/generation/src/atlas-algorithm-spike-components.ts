/** Spherical four-neighbor connected-component prototype with explicit seam and pole adjacency. */

import { type AtlasContourLevel, isAtlasLand } from './atlas-sampling-profiles.js';
import type { QuantizedSphericalField } from './geography-algorithm-adapters.js';

export interface SphericalComponentSummary {
  readonly componentCount: number;
  readonly anchorCount: number;
  readonly largestComponentAnchorCount: number;
}

export interface SphericalPartitionSummary {
  readonly land: SphericalComponentSummary;
  readonly water: SphericalComponentSummary;
  /** Field + one visited bitmap + one exact-capacity queue; contour storage is separate. */
  readonly componentWorkingBytes: number;
}

/** Count both sides of the sampled partition without relying on map or set iteration order. */
export function summarizeSphericalPartition(
  field: QuantizedSphericalField,
  contourLevel: AtlasContourLevel,
): SphericalPartitionSummary {
  const land = summarizeOneClassification(field, contourLevel, true);
  const water = summarizeOneClassification(field, contourLevel, false);
  return Object.freeze({
    land,
    water,
    componentWorkingBytes: field.sampleCount * (4 + 1 + 4),
  });
}

function summarizeOneClassification(
  field: QuantizedSphericalField,
  contourLevel: AtlasContourLevel,
  targetIsLand: boolean,
): SphericalComponentSummary {
  const visited = new Uint8Array(field.sampleCount);
  const queue = new Int32Array(field.sampleCount);
  let componentCount = 0;
  let anchorCount = 0;
  let largestComponentAnchorCount = 0;

  for (let startIndex = 0; startIndex < field.sampleCount; startIndex += 1) {
    if (visited[startIndex] !== 0 || isTarget(field, contourLevel, startIndex) !== targetIsLand) {
      continue;
    }
    componentCount += 1;
    let head = 0;
    let tail = 0;
    let componentAnchorCount = 0;
    queue[tail] = startIndex;
    tail += 1;
    visited[startIndex] = 1;
    while (head < tail) {
      const current = queue[head];
      head += 1;
      if (current === undefined) throw new Error('Component queue returned no current anchor.');
      componentAnchorCount += 1;
      anchorCount += 1;
      forEachNeighbor(field, current, (neighbor) => {
        if (visited[neighbor] === 0 && isTarget(field, contourLevel, neighbor) === targetIsLand) {
          visited[neighbor] = 1;
          queue[tail] = neighbor;
          tail += 1;
        }
      });
    }
    largestComponentAnchorCount = Math.max(largestComponentAnchorCount, componentAnchorCount);
  }

  return Object.freeze({ componentCount, anchorCount, largestComponentAnchorCount });
}

function forEachNeighbor(
  field: QuantizedSphericalField,
  index: number,
  visit: (neighborIndex: number) => void,
): void {
  const width = field.profile.longitudeCellCount;
  const height = field.profile.latitudeBandCount;
  const northPoleIndex = field.sampleCount - 1;
  if (index === 0) {
    for (let longitudeIndex = 0; longitudeIndex < width; longitudeIndex += 1) {
      visit(storageIndex(width, height, longitudeIndex, 1));
    }
    return;
  }
  if (index === northPoleIndex) {
    for (let longitudeIndex = 0; longitudeIndex < width; longitudeIndex += 1) {
      visit(storageIndex(width, height, longitudeIndex, height - 1));
    }
    return;
  }

  const offset = index - 1;
  const latitudeIndex = Math.floor(offset / width) + 1;
  const longitudeIndex = offset % width;
  visit(storageIndex(width, height, longitudeIndex, latitudeIndex - 1));
  visit(storageIndex(width, height, (longitudeIndex + width - 1) % width, latitudeIndex));
  visit(storageIndex(width, height, (longitudeIndex + 1) % width, latitudeIndex));
  visit(storageIndex(width, height, longitudeIndex, latitudeIndex + 1));
}

function isTarget(
  field: QuantizedSphericalField,
  contourLevel: AtlasContourLevel,
  storageIndexValue: number,
): boolean {
  const width = field.profile.longitudeCellCount;
  const height = field.profile.latitudeBandCount;
  if (storageIndexValue === 0) return isAtlasLand(field.valueAt(0, 0), contourLevel);
  if (storageIndexValue === field.sampleCount - 1) {
    return isAtlasLand(field.valueAt(0, height), contourLevel);
  }
  const offset = storageIndexValue - 1;
  const latitudeIndex = Math.floor(offset / width) + 1;
  const longitudeIndex = offset % width;
  return isAtlasLand(field.valueAt(longitudeIndex, latitudeIndex), contourLevel);
}

function storageIndex(
  width: number,
  height: number,
  longitudeIndex: number,
  latitudeIndex: number,
): number {
  if (latitudeIndex === 0) return 0;
  if (latitudeIndex === height) return width * (height - 1) + 1;
  return 1 + (latitudeIndex - 1) * width + longitudeIndex;
}
