/** Version-1 shared-preview threshold selection and full-profile land/water classification. */

import {
  createCompactLandWaterSampleReaderFromBits,
  createImmutableDomainArray,
  type LandWaterSampleReader,
  planetPointToAngles,
  roundTiesAwayFromZero,
} from '@ttrpg-map/core';

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
  WORLD_ATLAS_FULL_PROFILE,
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
  readonly samples: LandWaterSampleReader;
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

  const candidateResult = await thresholdCandidates(previewField, parameters, cooperation);
  if (candidateResult.status === 'cancelled') return candidateResult;
  const candidates = candidateResult.candidates;

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

/** Direct-module test seam; intentionally absent from the package public entry point. */
export async function inspectAtlasThresholdCandidatesForTesting(
  previewField: QuantizedSphericalField,
  parameters: AtlasLandWaterClassificationParameters,
): Promise<readonly ThresholdCandidate[]> {
  const result = await thresholdCandidates(previewField, parameters, {
    cooperate: () => Promise.resolve(false),
  });
  if (result.status === 'cancelled') throw new Error('Test candidate inspection was cancelled.');
  return result.candidates;
}

/** Classify every anchor from the selected shared threshold and measure weighted spherical area. */
export async function classifyAtlasLandWater(
  field: QuantizedSphericalField,
  contourLevel: AtlasContourLevel,
  targetWaterCoveragePercent: number,
  cooperation: AtlasClassificationCooperation,
): Promise<AtlasClassificationResult> {
  const packedSamples =
    field.profile.profileId === WORLD_ATLAS_FULL_PROFILE.profileId
      ? new Uint8Array(Math.ceil(field.sampleCount / 8))
      : undefined;
  const previewSamples =
    packedSamples === undefined ? new Array<'land' | 'water'>(field.sampleCount) : undefined;
  const southPoleSample = isAtlasLand(field.valueAt(0, 0), contourLevel) ? 'land' : 'water';
  const northPoleSample = isAtlasLand(
    field.valueAt(0, field.profile.latitudeBandCount),
    contourLevel,
  )
    ? 'land'
    : 'water';
  if (packedSamples === undefined) {
    if (previewSamples === undefined) throw new Error('Missing preview classification storage.');
    previewSamples[0] = southPoleSample;
    previewSamples[field.sampleCount - 1] = northPoleSample;
  } else {
    if (southPoleSample === 'land') setLandBit(packedSamples, 0);
    if (northPoleSample === 'land') setLandBit(packedSamples, field.sampleCount - 1);
  }

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
        if (packedSamples === undefined) {
          if (previewSamples === undefined)
            throw new Error('Missing preview classification storage.');
          previewSamples[index] = sample;
        } else if (sample === 'land') {
          setLandBit(packedSamples, index);
        }
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
  const samples: LandWaterSampleReader =
    packedSamples === undefined
      ? immutablePreviewSamples(previewSamples)
      : createCompactLandWaterSampleReaderFromBits(packedSamples, field.sampleCount);
  return Object.freeze({
    status: 'completed',
    output: Object.freeze({
      samples,
      realizedWaterCoveragePercent,
      absoluteWaterCoverageErrorBasisPoints: stableDecimal(
        Math.abs(realizedWaterCoveragePercent - targetWaterCoveragePercent) * 100,
      ),
    }),
  });
}

function immutablePreviewSamples(
  samples: readonly ('land' | 'water')[] | undefined,
): LandWaterSampleReader {
  if (samples === undefined) throw new Error('Missing preview classification samples.');
  const immutable = createImmutableDomainArray(samples);
  if (!immutable.ok) throw new Error('Land/water samples must be immutable plain values.');
  return immutable.value;
}

function setLandBit(storage: Uint8Array, index: number): void {
  const byteIndex = index >> 3;
  const byte = storage[byteIndex];
  if (byte === undefined) throw new RangeError('Classification sample index is out of range.');
  storage[byteIndex] = byte | (1 << (index & 7));
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

async function thresholdCandidates(
  field: QuantizedSphericalField,
  parameters: AtlasLandWaterClassificationParameters,
  cooperation: AtlasThresholdSelectionCooperation,
): Promise<
  | { readonly status: 'completed'; readonly candidates: readonly ThresholdCandidate[] }
  | { readonly status: 'cancelled' }
> {
  const totalWeight = totalSphericalWeight(field);
  const weightedTicks = sortedWeightedTicks(field, totalWeight, parameters);
  const nearestIndex = nearestCoverageIndex(weightedTicks);
  const candidateIndices = connectivityCandidateIndices(weightedTicks, nearestIndex);
  const candidateTicks: WeightedTick[] = [];
  const candidateContours: AtlasContourLevel[] = [];
  for (const weightedTickIndex of candidateIndices) {
    const weightedTick = weightedTicks[weightedTickIndex];
    if (weightedTick === undefined) throw new Error('Missing weighted threshold candidate.');
    candidateTicks.push(weightedTick);
    candidateContours.push(contourAbove(weightedTick.tick));
  }

  const componentResult = await summarizeWaterComponents(field, candidateContours, cooperation);
  if (componentResult.status === 'cancelled') return componentResult;
  const candidates = candidateTicks.map((weightedTick, index): ThresholdCandidate => {
    const contourLevel = candidateContours[index];
    const proxy = componentResult.proxies[index];
    if (contourLevel === undefined || proxy === undefined) {
      throw new Error('Missing water component candidate summary.');
    }
    return Object.freeze({ ...weightedTick, contourLevel, proxy });
  });
  return Object.freeze({ status: 'completed', candidates: Object.freeze(candidates) });
}

async function summarizeWaterComponents(
  field: QuantizedSphericalField,
  contourLevels: readonly AtlasContourLevel[],
  cooperation: AtlasThresholdSelectionCooperation,
): Promise<
  | { readonly status: 'completed'; readonly proxies: readonly AtlasWaterComponentProxy[] }
  | { readonly status: 'cancelled' }
> {
  const values = new Int32Array(field.sampleCount);
  const order = Array.from({ length: field.sampleCount }, (_, index) => index);
  for (let index = 0; index < field.sampleCount; index += 1) {
    values[index] = field.valueAt(...storageIndexCoordinates(field, index));
  }
  order.sort((left, right) => {
    const leftValue = values[left];
    const rightValue = values[right];
    if (leftValue === undefined || rightValue === undefined) {
      throw new Error('Missing water component sort value.');
    }
    return leftValue - rightValue;
  });

  const active = new Uint8Array(field.sampleCount);
  const parent = new Int32Array(field.sampleCount);
  const componentWeights = new Float64Array(field.sampleCount);
  const proxies = new Array<AtlasWaterComponentProxy>(contourLevels.length);
  let next = 0;
  let componentCount = 0;
  let totalWaterWeight = 0;
  let largestComponentWeight = 0;

  const activateThrough = (waterUpperBound: number): void => {
    while (next < order.length) {
      const index = order[next];
      const value = index === undefined ? undefined : values[index];
      if (index === undefined || value === undefined || value > waterUpperBound) break;
      next += 1;
      active[index] = 1;
      parent[index] = index;
      const weight = storageIndexWeight(field, index);
      componentWeights[index] = weight;
      totalWaterWeight += weight;
      componentCount += 1;
      largestComponentWeight = Math.max(largestComponentWeight, weight);
      forEachNeighbor(field, index, (neighbor) => {
        if (active[neighbor] === 0) return;
        let left = findRoot(parent, index);
        let right = findRoot(parent, neighbor);
        if (left === right) return;
        if (left > right) [left, right] = [right, left];
        parent[right] = left;
        const leftWeight = componentWeights[left];
        const rightWeight = componentWeights[right];
        if (leftWeight === undefined || rightWeight === undefined) {
          throw new Error('Missing water component weight.');
        }
        const mergedWeight = leftWeight + rightWeight;
        componentWeights[left] = mergedWeight;
        componentCount -= 1;
        largestComponentWeight = Math.max(largestComponentWeight, mergedWeight);
      });
    }
  };

  for (let index = 0; index < contourLevels.length; index += 1) {
    const contourLevel = contourLevels[index];
    if (contourLevel === undefined) throw new Error('Missing contour level.');
    activateThrough(Math.floor((contourLevel - 1) / 2));
    proxies[index] = Object.freeze({
      componentCount,
      largestComponentPercent: stableRatioPercent(largestComponentWeight, totalWaterWeight),
    });
    if (await cooperation.cooperate(index + 1, contourLevels.length)) {
      return Object.freeze({ status: 'cancelled' });
    }
  }
  return Object.freeze({ status: 'completed', proxies: Object.freeze(proxies) });
}

function findRoot(parent: Int32Array, index: number): number {
  let root = index;
  while (parent[root] !== root) root = parent[root] ?? root;
  while (parent[index] !== index) {
    const next = parent[index] ?? index;
    parent[index] = root;
    index = next;
  }
  return root;
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

function storageIndexCoordinates(field: QuantizedSphericalField, index: number): [number, number] {
  const width = field.profile.longitudeCellCount;
  const height = field.profile.latitudeBandCount;
  if (index === 0) return [0, 0];
  if (index === field.sampleCount - 1) return [0, height];
  const offset = index - 1;
  return [offset % width, Math.floor(offset / width) + 1];
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
