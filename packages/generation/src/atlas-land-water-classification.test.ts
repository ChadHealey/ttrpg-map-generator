import { planetPointToAngles, roundTiesAwayFromZero } from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import {
  type AtlasWaterComponentProxy,
  inspectAtlasThresholdCandidatesForTesting,
  selectAtlasLandWaterThreshold,
} from './atlas-land-water-classification.js';
import {
  atlasLandWaterClassificationParameters,
  atlasMacroElevationParameters,
} from './atlas-land-water-generator-contract.js';
import {
  FIXED_ATLAS_GENERATOR_CASES,
  fixedAtlasInput,
  fixedAtlasRuntime,
} from './atlas-land-water-test-support.js';
import {
  createAtlasMacroElevationFieldAdapter,
  sampleAtlasMacroElevationField,
} from './atlas-macro-elevation-field.js';
import {
  type AtlasContourLevel,
  getAtlasGridVertex,
  isAtlasLand,
  WORLD_ATLAS_PREVIEW_PROFILE,
} from './atlas-sampling-profiles.js';
import type { QuantizedSphericalField } from './geography-algorithm-adapters.js';

const AREA_WEIGHT_SCALE = 2 ** 20;

describe('atlas land/water threshold classification', () => {
  it('matches the previous per-candidate traversal and preserves cooperation order', async () => {
    for (const fixed of FIXED_ATLAS_GENERATOR_CASES) {
      const input = fixedAtlasInput(fixed);
      const runtime = fixedAtlasRuntime(input);
      const adapter = createAtlasMacroElevationFieldAdapter(
        atlasMacroElevationParameters(input.controls, input.macroElevationFieldBehaviorVersion),
        runtime.macroElevationRandom,
      );
      const sampled = await sampleAtlasMacroElevationField(WORLD_ATLAS_PREVIEW_PROFILE, adapter, {
        cooperate: () => Promise.resolve(false),
      });
      if (sampled.status === 'cancelled') throw new Error('Fixed preview sampling was cancelled.');

      const parameters = atlasLandWaterClassificationParameters(input.controls);
      const candidates = await inspectAtlasThresholdCandidatesForTesting(sampled.field, parameters);
      expect(candidates.length).toBeGreaterThan(0);
      for (const candidate of candidates) {
        expect(candidate.proxy).toStrictEqual(
          summarizeWaterComponentsByTraversal(sampled.field, candidate.contourLevel),
        );
      }

      const cooperationCalls: [number, number][] = [];
      const selection = await selectAtlasLandWaterThreshold(sampled.field, parameters, {
        cooperate: (completedCandidates, totalCandidates) => {
          cooperationCalls.push([completedCandidates, totalCandidates]);
          return Promise.resolve(false);
        },
      });
      expect(selection.status).toBe('completed');
      expect(cooperationCalls).toStrictEqual(
        candidates.map((_, index) => [index + 1, candidates.length]),
      );
    }
  }, 30_000);
});

function summarizeWaterComponentsByTraversal(
  field: QuantizedSphericalField,
  contourLevel: AtlasContourLevel,
): AtlasWaterComponentProxy {
  const visited = new Uint8Array(field.sampleCount);
  const queue = new Int32Array(field.sampleCount);
  let componentCount = 0;
  let totalWaterWeight = 0;
  let largestComponentWeight = 0;

  for (let startIndex = 0; startIndex < field.sampleCount; startIndex += 1) {
    if (visited[startIndex] !== 0 || isLandAtStorageIndex(field, contourLevel, startIndex)) {
      continue;
    }
    componentCount += 1;
    let componentWeight = 0;
    let head = 0;
    let tail = 0;
    queue[tail] = startIndex;
    tail += 1;
    visited[startIndex] = 1;
    while (head < tail) {
      const current = queue[head];
      head += 1;
      if (current === undefined) throw new Error('Traversal queue lost its current anchor.');
      const weight = storageIndexWeight(field, current);
      componentWeight += weight;
      totalWaterWeight += weight;
      forEachNeighbor(field, current, (neighbor) => {
        if (visited[neighbor] === 0 && !isLandAtStorageIndex(field, contourLevel, neighbor)) {
          visited[neighbor] = 1;
          queue[tail] = neighbor;
          tail += 1;
        }
      });
    }
    largestComponentWeight = Math.max(largestComponentWeight, componentWeight);
  }

  return {
    componentCount,
    largestComponentPercent: stableRatioPercent(largestComponentWeight, totalWaterWeight),
  };
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

function isLandAtStorageIndex(
  field: QuantizedSphericalField,
  contourLevel: AtlasContourLevel,
  index: number,
): boolean {
  const width = field.profile.longitudeCellCount;
  const height = field.profile.latitudeBandCount;
  if (index === 0) return isAtlasLand(field.valueAt(0, 0), contourLevel);
  if (index === field.sampleCount - 1) {
    return isAtlasLand(field.valueAt(0, height), contourLevel);
  }
  const offset = index - 1;
  return isAtlasLand(field.valueAt(offset % width, Math.floor(offset / width) + 1), contourLevel);
}

function storageIndexWeight(field: QuantizedSphericalField, index: number): number {
  if (index === 0 || index === field.sampleCount - 1) return 0;
  const latitudeIndex = Math.floor((index - 1) / field.profile.longitudeCellCount) + 1;
  const latitudeRad = planetPointToAngles(
    getAtlasGridVertex(field.profile, 0, latitudeIndex),
  ).latitudeRad;
  return roundTiesAwayFromZero(Math.cos(latitudeRad) * AREA_WEIGHT_SCALE);
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

function stableRatioPercent(part: number, whole: number): number {
  if (whole === 0) return 0;
  const rounded = roundTiesAwayFromZero((part / whole) * 100 * 1_000_000) / 1_000_000;
  return rounded === 0 ? 0 : rounded;
}
