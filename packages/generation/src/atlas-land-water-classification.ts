/** Version-1 shared-preview threshold selection and full-profile land/water classification. */

import { planetPointToAngles, roundTiesAwayFromZero } from '@ttrpg-map/core';

import type { AtlasLandWaterClassificationParameters } from './atlas-land-water-generator-contract.js';
import {
  ATLAS_CONNECTED_MAJORITY_PROXY_MIN_PERCENT,
  ATLAS_CONNECTIVITY_SELECTION_MAX_COVERAGE_ERROR_BASIS_POINTS,
  ATLAS_GENERATION_COOPERATION_ROW_INTERVAL,
  ATLAS_WATER_COVERAGE_TOLERANCE_BASIS_POINTS,
} from './atlas-land-water-generator-metadata.js';
import {
  type AtlasContourLevel,
  type AtlasFieldValueTicks,
  createAtlasContourLevel,
  getAtlasGridVertex,
  isAtlasLand,
  parseAtlasFieldValueTicks,
  WORLD_ATLAS_PREVIEW_PROFILE,
} from './atlas-sampling-profiles.js';
import type { QuantizedSphericalField } from './geography-algorithm-adapters.js';

const AREA_WEIGHT_SCALE = 2 ** 20;
const MAX_CONNECTIVITY_CANDIDATES = 17;

interface WeightedTick {
  readonly tick: AtlasFieldValueTicks;
  readonly cumulativeWaterWeight: number;
  readonly waterCoveragePercent: number;
  readonly coverageErrorBasisPoints: number;
}

export interface AtlasWaterComponentProxy {
  readonly componentCount: number;
  readonly largestComponentPercent: number;
}

interface ThresholdCandidate extends WeightedTick {
  readonly contourLevel: AtlasContourLevel;
  readonly proxy: AtlasWaterComponentProxy;
}

export interface AtlasThresholdSelection {
  readonly contourLevel: AtlasContourLevel;
  readonly previewWaterCoveragePercent: number;
  readonly previewCoverageErrorBasisPoints: number;
  readonly proxy: AtlasWaterComponentProxy;
  readonly isConnectivityProxySupported: boolean;
}

export type AtlasThresholdSelectionResult =
  | { readonly status: 'completed'; readonly selection: AtlasThresholdSelection }
  | { readonly status: 'cancelled' };

export interface AtlasThresholdSelectionCooperation {
  readonly cooperate: (completedCandidates: number, totalCandidates: number) => Promise<boolean>;
}

export interface AtlasClassificationCooperation {
  readonly cooperate: (completedAnchors: number, totalAnchors: number) => Promise<boolean>;
}

export interface AtlasClassificationOutput {
  readonly samples: readonly ('land' | 'water')[];
  readonly realizedWaterCoveragePercent: number;
  readonly absoluteWaterCoverageErrorBasisPoints: number;
}

export type AtlasClassificationResult =
  | { readonly status: 'completed'; readonly output: AtlasClassificationOutput }
  | { readonly status: 'cancelled' };

/**
 * Pick one half-tick threshold only from shared preview anchors. Ocean intent changes only this
 * classification step and uses a transient topology proxy; it never creates semantic entities.
 */
export async function selectAtlasLandWaterThreshold(
  previewField: QuantizedSphericalField,
  parameters: AtlasLandWaterClassificationParameters,
  cooperation: AtlasThresholdSelectionCooperation,
): Promise<AtlasThresholdSelectionResult> {
  if (previewField.profile.profileId !== WORLD_ATLAS_PREVIEW_PROFILE.profileId) {
    throw new RangeError('Land/water threshold selection requires the version-1 preview profile.');
  }

  const totalWeight = totalSphericalWeight(previewField);
  const weightedTicks = sortedWeightedTicks(previewField, totalWeight, parameters);
  const nearestIndex = nearestCoverageIndex(weightedTicks);
  const candidateIndices = connectivityCandidateIndices(weightedTicks, nearestIndex);
  const candidates: ThresholdCandidate[] = [];
  for (const [progressIndex, weightedTickIndex] of candidateIndices.entries()) {
    const weightedTick = weightedTicks[weightedTickIndex];
    if (weightedTick === undefined) throw new Error('Missing weighted threshold candidate.');
    const contourLevel = contourAbove(weightedTick.tick);
    candidates.push(
      Object.freeze({
        ...weightedTick,
        contourLevel,
        proxy: summarizeWaterComponents(previewField, contourLevel),
      }),
    );
    if (await cooperation.cooperate(progressIndex + 1, candidateIndices.length)) {
      return Object.freeze({ status: 'cancelled' });
    }
  }

  const selected = [...candidates].sort((left, right) =>
    compareThresholdCandidates(left, right, parameters.oceanConnectivity),
  )[0];
  if (selected === undefined) throw new Error('No atlas land/water threshold candidate exists.');
  return Object.freeze({
    status: 'completed',
    selection: Object.freeze({
      contourLevel: selected.contourLevel,
      previewWaterCoveragePercent: selected.waterCoveragePercent,
      previewCoverageErrorBasisPoints: selected.coverageErrorBasisPoints,
      proxy: selected.proxy,
      isConnectivityProxySupported: supportsConnectivityProxy(
        parameters.oceanConnectivity,
        selected.proxy,
      ),
    }),
  });
}

/** Classify every anchor from the selected shared threshold and measure weighted spherical area. */
export async function classifyAtlasLandWater(
  field: QuantizedSphericalField,
  contourLevel: AtlasContourLevel,
  targetWaterCoveragePercent: number,
  cooperation: AtlasClassificationCooperation,
): Promise<AtlasClassificationResult> {
  const samples = new Array<'land' | 'water'>(field.sampleCount);
  samples[0] = isAtlasLand(field.valueAt(0, 0), contourLevel) ? 'land' : 'water';
  samples[field.sampleCount - 1] = isAtlasLand(
    field.valueAt(0, field.profile.latitudeBandCount),
    contourLevel,
  )
    ? 'land'
    : 'water';

  let totalWeight = 0;
  let waterWeight = 0;
  for (
    let chunkStart = 1;
    chunkStart < field.profile.latitudeBandCount;
    chunkStart += ATLAS_GENERATION_COOPERATION_ROW_INTERVAL
  ) {
    const chunkEnd = Math.min(
      field.profile.latitudeBandCount,
      chunkStart + ATLAS_GENERATION_COOPERATION_ROW_INTERVAL,
    );
    for (let latitudeIndex = chunkStart; latitudeIndex < chunkEnd; latitudeIndex += 1) {
      const rowWeight = sphericalRowWeight(field, latitudeIndex);
      for (
        let longitudeIndex = 0;
        longitudeIndex < field.profile.longitudeCellCount;
        longitudeIndex += 1
      ) {
        const index = 1 + (latitudeIndex - 1) * field.profile.longitudeCellCount + longitudeIndex;
        const sample = isAtlasLand(field.valueAt(longitudeIndex, latitudeIndex), contourLevel)
          ? 'land'
          : 'water';
        samples[index] = sample;
        totalWeight += rowWeight;
        if (sample === 'water') waterWeight += rowWeight;
      }
    }
    const completedAnchors = 1 + (chunkEnd - 1) * field.profile.longitudeCellCount;
    if (await cooperation.cooperate(completedAnchors, field.sampleCount)) {
      return Object.freeze({ status: 'cancelled' });
    }
  }

  if (await cooperation.cooperate(field.sampleCount, field.sampleCount)) {
    return Object.freeze({ status: 'cancelled' });
  }
  const realizedWaterCoveragePercent = stableRatioPercent(waterWeight, totalWeight);
  return Object.freeze({
    status: 'completed',
    output: Object.freeze({
      samples: Object.freeze(samples),
      realizedWaterCoveragePercent,
      absoluteWaterCoverageErrorBasisPoints: stableDecimal(
        Math.abs(realizedWaterCoveragePercent - targetWaterCoveragePercent) * 100,
      ),
    }),
  });
}

function sortedWeightedTicks(
  field: QuantizedSphericalField,
  totalWeight: number,
  parameters: AtlasLandWaterClassificationParameters,
): readonly WeightedTick[] {
  const weightsByTick = new Map<AtlasFieldValueTicks, number>();
  for (let latitudeIndex = 1; latitudeIndex < field.profile.latitudeBandCount; latitudeIndex += 1) {
    const rowWeight = sphericalRowWeight(field, latitudeIndex);
    for (
      let longitudeIndex = 0;
      longitudeIndex < field.profile.longitudeCellCount;
      longitudeIndex += 1
    ) {
      const value = field.valueAt(longitudeIndex, latitudeIndex);
      weightsByTick.set(value, (weightsByTick.get(value) ?? 0) + rowWeight);
    }
  }
  const ticks = [...weightsByTick.keys()].sort((left, right) => left - right);
  let cumulativeWaterWeight = 0;
  return Object.freeze(
    ticks.map((tick): WeightedTick => {
      cumulativeWaterWeight += weightsByTick.get(tick) ?? 0;
      const waterCoveragePercent = stableRatioPercent(cumulativeWaterWeight, totalWeight);
      return Object.freeze({
        tick,
        cumulativeWaterWeight,
        waterCoveragePercent,
        coverageErrorBasisPoints: stableDecimal(
          Math.abs(waterCoveragePercent - parameters.targetWaterCoveragePercent) * 100,
        ),
      });
    }),
  );
}

function nearestCoverageIndex(weightedTicks: readonly WeightedTick[]): number {
  let nearestIndex = 0;
  for (let index = 1; index < weightedTicks.length; index += 1) {
    const candidate = weightedTicks[index];
    const current = weightedTicks[nearestIndex];
    if (candidate === undefined || current === undefined) continue;
    if (
      candidate.coverageErrorBasisPoints < current.coverageErrorBasisPoints ||
      (candidate.coverageErrorBasisPoints === current.coverageErrorBasisPoints &&
        candidate.tick < current.tick)
    ) {
      nearestIndex = index;
    }
  }
  return nearestIndex;
}

function connectivityCandidateIndices(
  weightedTicks: readonly WeightedTick[],
  nearestIndex: number,
): readonly number[] {
  const eligible = weightedTicks.flatMap((candidate, index) =>
    candidate.coverageErrorBasisPoints <=
    Math.min(
      ATLAS_WATER_COVERAGE_TOLERANCE_BASIS_POINTS,
      ATLAS_CONNECTIVITY_SELECTION_MAX_COVERAGE_ERROR_BASIS_POINTS,
    )
      ? [index]
      : [],
  );
  if (!eligible.includes(nearestIndex)) eligible.push(nearestIndex);
  eligible.sort((left, right) => left - right);
  if (eligible.length <= MAX_CONNECTIVITY_CANDIDATES) return Object.freeze(eligible);

  const selected = new Set<number>([eligible[0] ?? nearestIndex, nearestIndex]);
  for (let index = 0; index < MAX_CONNECTIVITY_CANDIDATES; index += 1) {
    const position = roundTiesAwayFromZero(
      (index * (eligible.length - 1)) / (MAX_CONNECTIVITY_CANDIDATES - 1),
    );
    const candidate = eligible[position];
    if (candidate !== undefined) selected.add(candidate);
  }
  return Object.freeze([...selected].sort((left, right) => left - right));
}

function compareThresholdCandidates(
  left: ThresholdCandidate,
  right: ThresholdCandidate,
  oceanConnectivity: AtlasLandWaterClassificationParameters['oceanConnectivity'],
): number {
  const leftSupported = supportsConnectivityProxy(oceanConnectivity, left.proxy);
  const rightSupported = supportsConnectivityProxy(oceanConnectivity, right.proxy);
  if (leftSupported !== rightSupported) return leftSupported ? -1 : 1;

  if (oceanConnectivity === 'multipleBasins') {
    const componentDifference = right.proxy.componentCount - left.proxy.componentCount;
    if (componentDifference !== 0) return componentDifference;
  } else if (oceanConnectivity === 'singleGlobal') {
    const componentDifference = left.proxy.componentCount - right.proxy.componentCount;
    if (componentDifference !== 0) return componentDifference;
  } else {
    const shareDifference =
      right.proxy.largestComponentPercent - left.proxy.largestComponentPercent;
    if (shareDifference !== 0) return shareDifference;
  }

  const errorDifference = left.coverageErrorBasisPoints - right.coverageErrorBasisPoints;
  return errorDifference || left.tick - right.tick;
}

function supportsConnectivityProxy(
  oceanConnectivity: AtlasLandWaterClassificationParameters['oceanConnectivity'],
  proxy: AtlasWaterComponentProxy,
): boolean {
  if (oceanConnectivity === 'multipleBasins') return proxy.componentCount >= 2;
  if (oceanConnectivity === 'connectedMajority') {
    return proxy.largestComponentPercent >= ATLAS_CONNECTED_MAJORITY_PROXY_MIN_PERCENT;
  }
  return proxy.componentCount === 1;
}

function summarizeWaterComponents(
  field: QuantizedSphericalField,
  contourLevel: AtlasContourLevel,
): AtlasWaterComponentProxy {
  const visited = new Uint8Array(field.sampleCount);
  const queue = new Int32Array(field.sampleCount);
  let componentCount = 0;
  let totalWaterWeight = 0;
  let largestComponentWeight = 0;

  for (let startIndex = 0; startIndex < field.sampleCount; startIndex += 1) {
    if (visited[startIndex] !== 0 || isLandAtStorageIndex(field, contourLevel, startIndex))
      continue;
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
      if (current === undefined) throw new Error('Water component queue lost its current anchor.');
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

  return Object.freeze({
    componentCount,
    largestComponentPercent: stableRatioPercent(largestComponentWeight, totalWaterWeight),
  });
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
  return sphericalRowWeight(field, latitudeIndex);
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

function sphericalRowWeight(field: QuantizedSphericalField, latitudeIndex: number): number {
  const latitudeRad = planetPointToAngles(
    getAtlasGridVertex(field.profile, 0, latitudeIndex),
  ).latitudeRad;
  return roundTiesAwayFromZero(Math.cos(latitudeRad) * AREA_WEIGHT_SCALE);
}

function totalSphericalWeight(field: QuantizedSphericalField): number {
  let total = 0;
  for (let latitudeIndex = 1; latitudeIndex < field.profile.latitudeBandCount; latitudeIndex += 1) {
    total += sphericalRowWeight(field, latitudeIndex) * field.profile.longitudeCellCount;
  }
  return total;
}

function contourAbove(tick: AtlasFieldValueTicks): AtlasContourLevel {
  const parsed = parseAtlasFieldValueTicks(tick);
  if (!parsed.ok) throw new Error(parsed.diagnostic.message);
  const contour = createAtlasContourLevel(parsed.value);
  if (!contour.ok) throw new Error(contour.diagnostic.message);
  return contour.value;
}

function stableRatioPercent(part: number, whole: number): number {
  return whole === 0 ? 0 : stableDecimal((part / whole) * 100);
}

function stableDecimal(value: number): number {
  const rounded = roundTiesAwayFromZero(value * 1_000_000) / 1_000_000;
  return rounded === 0 ? 0 : rounded;
}
