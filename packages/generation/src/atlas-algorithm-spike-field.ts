/** Project-owned spherical field candidate and the fixed issue #56 comparison matrix. */

import {
  createDeterministicRandomStream,
  parseSeedInput,
  PLANET_ANGULAR_STEP_RAD,
  PLANET_LATITUDE_MIN_TICKS,
  PLANET_LONGITUDE_MIN_TICKS,
  PLANET_TICKS_PER_TURN,
  type PlanetPoint,
  planetPointToAngles,
} from '@ttrpg-map/core';

import {
  ATLAS_FIELD_QUANTIZATION_SCALE,
  type AtlasContourLevel,
  type AtlasFieldValueTicks,
  type AtlasSamplingProfile,
  createAtlasContourLevel,
  getAtlasGridVertex,
  getAtlasSampleAnchorCount,
  parseAtlasFieldValueTicks,
  quantizeAtlasFieldValue,
  WORLD_ATLAS_PREVIEW_PROFILE,
} from './atlas-sampling-profiles.js';
import type {
  QuantizedPlanetFieldAdapter,
  QuantizedSphericalField,
} from './geography-algorithm-adapters.js';

export type AtlasContinentDistribution = 'balanced' | 'varied' | 'oneDominant';
export type AtlasOceanConnectivity = 'singleGlobal' | 'connectedMajority' | 'multipleBasins';
export type AtlasPolarCharacter = 'oceanBiased' | 'neutral' | 'landBiased';

/** Validated control shape is owned downstream; this exact shape is only spike input. */
export interface AtlasAlgorithmSpikeControls {
  readonly circumferenceKm: number;
  readonly targetWaterCoveragePercent: number;
  readonly continentCountIntent: number;
  readonly continentDistribution: AtlasContinentDistribution;
  readonly fragmentationPercent: number;
  readonly islandAbundancePercent: number;
  readonly archipelagoAbundancePercent: number;
  readonly oceanConnectivity: AtlasOceanConnectivity;
  readonly polarCharacter: AtlasPolarCharacter;
}

export interface AtlasAlgorithmSpikeCase {
  readonly fixtureId:
    | 'milestone-2-atlas-proof'
    | 'milestone-2-atlas-fragmented-islands'
    | 'milestone-2-atlas-connected-majority'
    | 'milestone-2-atlas-seam-crossing'
    | 'milestone-2-atlas-control-min'
    | 'milestone-2-atlas-control-max';
  readonly worldSeed: string;
  readonly controls: AtlasAlgorithmSpikeControls;
}

const DEFAULT_CONTROLS: AtlasAlgorithmSpikeControls = Object.freeze({
  circumferenceKm: 40_000,
  targetWaterCoveragePercent: 65,
  continentCountIntent: 4,
  continentDistribution: 'varied',
  fragmentationPercent: 35,
  islandAbundancePercent: 35,
  archipelagoAbundancePercent: 25,
  oceanConnectivity: 'singleGlobal',
  polarCharacter: 'neutral',
});

/** Exact six rows registered by the accepted Milestone 2 proof contract. */
export const MILESTONE_TWO_ATLAS_ALGORITHM_SPIKE_CASES: readonly AtlasAlgorithmSpikeCase[] =
  Object.freeze([
    spikeCase('milestone-2-atlas-proof', '81985529216486895', {}),
    spikeCase('milestone-2-atlas-fragmented-islands', '18364758544493064720', {
      targetWaterCoveragePercent: 70,
      continentCountIntent: 5,
      fragmentationPercent: 90,
      islandAbundancePercent: 95,
      archipelagoAbundancePercent: 95,
    }),
    spikeCase('milestone-2-atlas-connected-majority', '1085102592571150095', {
      targetWaterCoveragePercent: 60,
      continentCountIntent: 6,
      continentDistribution: 'balanced',
      fragmentationPercent: 55,
      islandAbundancePercent: 55,
      archipelagoAbundancePercent: 50,
      oceanConnectivity: 'connectedMajority',
    }),
    spikeCase('milestone-2-atlas-seam-crossing', '12297829382473034410', {}),
    spikeCase('milestone-2-atlas-control-min', '6148914691236517205', {
      circumferenceKm: 10_000,
      targetWaterCoveragePercent: 45,
      continentCountIntent: 1,
      continentDistribution: 'balanced',
      fragmentationPercent: 0,
      islandAbundancePercent: 0,
      archipelagoAbundancePercent: 0,
      polarCharacter: 'landBiased',
    }),
    spikeCase('milestone-2-atlas-control-max', '16045690984503098046', {
      circumferenceKm: 80_000,
      targetWaterCoveragePercent: 80,
      continentCountIntent: 8,
      continentDistribution: 'oneDominant',
      fragmentationPercent: 100,
      islandAbundancePercent: 100,
      archipelagoAbundancePercent: 100,
      oceanConnectivity: 'multipleBasins',
      polarCharacter: 'oceanBiased',
    }),
  ]);

interface SphericalBasis {
  readonly centerX: number;
  readonly centerY: number;
  readonly centerZ: number;
  readonly cutoffDot: number;
  readonly amplitude: number;
}

interface SpikeFieldKernel extends QuantizedPlanetFieldAdapter {
  readonly sampleCartesian: (x: number, y: number, z: number) => AtlasFieldValueTicks;
}

class SampledSphericalField implements QuantizedSphericalField {
  readonly #values: Int32Array;
  public readonly profile: AtlasSamplingProfile;
  public readonly sampleCount: number;

  public constructor(profile: AtlasSamplingProfile, values: Int32Array) {
    this.profile = profile;
    this.sampleCount = values.length;
    this.#values = values;
  }

  public valueAt(longitudeIndex: number, latitudeIndex: number): AtlasFieldValueTicks {
    if (
      !Number.isSafeInteger(longitudeIndex) ||
      longitudeIndex < 0 ||
      longitudeIndex >= this.profile.longitudeCellCount ||
      !Number.isSafeInteger(latitudeIndex) ||
      latitudeIndex < 0 ||
      latitudeIndex > this.profile.latitudeBandCount
    ) {
      throw new RangeError('Atlas field indices must address the declared spherical profile.');
    }
    const index =
      latitudeIndex === 0
        ? 0
        : latitudeIndex === this.profile.latitudeBandCount
          ? this.#values.length - 1
          : 1 + (latitudeIndex - 1) * this.profile.longitudeCellCount + longitudeIndex;
    const value = this.#values[index];
    if (value === undefined) throw new RangeError('Atlas field sample index is out of range.');
    return value as AtlasFieldValueTicks;
  }
}

/** Build the deterministic analytic spherical-basis candidate; no dependency type is exposed. */
export function createAtlasAlgorithmSpikeField(
  spike: AtlasAlgorithmSpikeCase,
): QuantizedPlanetFieldAdapter {
  validateControls(spike.controls);
  const seedInput = parseSeedInput({
    seedDerivationVersion: 1,
    deterministicStreamVersion: 1,
    seedScope: 'map/entity',
    worldSeed: spike.worldSeed,
    generatorId: 'world-terrain.spherical-basis-field-spike',
    generatorVersion: 1,
    aspectName: 'worldTerrain.macroElevation',
    variantRevision: 0,
    mapId: 'a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7',
    entityId: 'c6f4a17b-dfaf-4dce-9904-9a900d300da4',
  });
  if (!seedInput.ok) throw new Error(seedInput.diagnostic.message);
  const random = createDeterministicRandomStream(seedInput.value);
  if (!random.ok) throw new Error(random.diagnostic.message);

  const controls = spike.controls;
  const circumferenceScale = Math.sqrt(40_000 / controls.circumferenceKm);
  const broadCount = controls.continentCountIntent;
  const islandCount = Math.floor(controls.islandAbundancePercent / 20);
  const archipelagoCount = Math.floor(controls.archipelagoAbundancePercent / 25);
  const cutCount = Math.floor(controls.fragmentationPercent / 20);
  const bases: SphericalBasis[] = [];

  for (let index = 0; index < broadCount; index += 1) {
    const distributionAmplitude =
      controls.continentDistribution === 'oneDominant'
        ? index === 0
          ? 1.35
          : 0.6
        : controls.continentDistribution === 'balanced'
          ? 0.88
          : 0.68 + random.value.nextFloat64() * 0.45;
    bases.push(
      createBasis(
        random.value.nextFloat64(),
        random.value.nextFloat64(),
        clamp(0.35, 0.82, (0.58 * circumferenceScale) / Math.sqrt(broadCount)),
        distributionAmplitude,
      ),
    );
  }
  for (let index = 0; index < islandCount + archipelagoCount; index += 1) {
    const isArchipelago = index >= islandCount;
    bases.push(
      createBasis(
        random.value.nextFloat64(),
        random.value.nextFloat64(),
        isArchipelago ? 0.18 : 0.11,
        isArchipelago ? 0.44 : 0.31,
      ),
    );
  }
  for (let index = 0; index < cutCount; index += 1) {
    bases.push(
      createBasis(
        random.value.nextFloat64(),
        random.value.nextFloat64(),
        0.12 + random.value.nextFloat64() * 0.16,
        -(0.22 + controls.fragmentationPercent / 250),
      ),
    );
  }

  const polarAmplitude =
    controls.polarCharacter === 'landBiased'
      ? 0.38
      : controls.polarCharacter === 'oceanBiased'
        ? -0.38
        : 0;
  const marineWaveAmplitude =
    controls.oceanConnectivity === 'multipleBasins'
      ? 0.18
      : controls.oceanConnectivity === 'connectedMajority'
        ? 0.08
        : -0.05;

  const sampleCartesian = (x: number, y: number, z: number): AtlasFieldValueTicks => {
    let value = -0.42 + polarAmplitude * z * z * z * z;
    value += marineWaveAmplitude * (x * x - y * y) * (1 - z * z);
    for (const basis of bases) {
      const dot = x * basis.centerX + y * basis.centerY + z * basis.centerZ;
      if (dot <= basis.cutoffDot) continue;
      const normalized = (dot - basis.cutoffDot) / (1 - basis.cutoffDot);
      const smooth = normalized * normalized * (3 - 2 * normalized);
      value += basis.amplitude * smooth;
    }
    return fixedFieldTicks(clamp(-1, 1, value));
  };

  const field: SpikeFieldKernel = Object.freeze({
    algorithmId: 'spherical-basis-field',
    algorithmVersion: 1,
    sample(point: PlanetPoint): AtlasFieldValueTicks {
      const { longitudeRad, latitudeRad } = planetPointToAngles(point);
      const cosLatitude = Math.cos(latitudeRad);
      return sampleCartesian(
        cosLatitude * Math.cos(longitudeRad),
        cosLatitude * Math.sin(longitudeRad),
        Math.sin(latitudeRad),
      );
    },
    sampleCartesian,
  });
  return field;
}

/** Evaluate one complete profile in canonical pole/row/pole storage order. */
export function sampleAtlasAlgorithmSpikeField(
  profile: AtlasSamplingProfile,
  adapter: QuantizedPlanetFieldAdapter,
): QuantizedSphericalField {
  const kernel = adapter as Partial<SpikeFieldKernel> & QuantizedPlanetFieldAdapter;
  const values = new Int32Array(getAtlasSampleAnchorCount(profile));
  values[0] =
    kernel.sampleCartesian?.(0, 0, -1) ?? adapter.sample(getAtlasGridVertex(profile, 0, 0));
  const northIndex = values.length - 1;
  values[northIndex] =
    kernel.sampleCartesian?.(0, 0, 1) ??
    adapter.sample(getAtlasGridVertex(profile, 0, profile.latitudeBandCount));
  const latitudeStepTicks = PLANET_TICKS_PER_TURN / 2 / profile.latitudeBandCount;
  const longitudeStepTicks = PLANET_TICKS_PER_TURN / profile.longitudeCellCount;

  for (let latitudeIndex = 1; latitudeIndex < profile.latitudeBandCount; latitudeIndex += 1) {
    const latitudeRad =
      (PLANET_LATITUDE_MIN_TICKS + latitudeIndex * latitudeStepTicks) * PLANET_ANGULAR_STEP_RAD;
    const cosLatitude = Math.cos(latitudeRad);
    const z = Math.sin(latitudeRad);
    for (let longitudeIndex = 0; longitudeIndex < profile.longitudeCellCount; longitudeIndex += 1) {
      const longitudeRad =
        (PLANET_LONGITUDE_MIN_TICKS + longitudeIndex * longitudeStepTicks) *
        PLANET_ANGULAR_STEP_RAD;
      const index = 1 + (latitudeIndex - 1) * profile.longitudeCellCount + longitudeIndex;
      values[index] =
        kernel.sampleCartesian?.(
          cosLatitude * Math.cos(longitudeRad),
          cosLatitude * Math.sin(longitudeRad),
          z,
        ) ?? adapter.sample(getAtlasGridVertex(profile, longitudeIndex, latitudeIndex));
    }
  }
  return new SampledSphericalField(profile, values);
}

/**
 * Select one half-tick level from preview anchors only. Full generation reuses this exact level,
 * which makes every shared preview/full classification byte-identical.
 */
export function selectAtlasAlgorithmSpikeContourLevel(
  field: QuantizedSphericalField,
  targetWaterCoveragePercent: number,
): AtlasContourLevel {
  if (field.profile.profileId !== WORLD_ATLAS_PREVIEW_PROFILE.profileId) {
    throw new RangeError('Atlas spike contour selection must use the versioned preview anchors.');
  }
  if (
    !Number.isSafeInteger(targetWaterCoveragePercent) ||
    targetWaterCoveragePercent < 0 ||
    targetWaterCoveragePercent > 100
  ) {
    throw new RangeError('Target water coverage must be integer percentage points in [0, 100].');
  }

  let low = -ATLAS_FIELD_QUANTIZATION_SCALE;
  let high = ATLAS_FIELD_QUANTIZATION_SCALE;
  const targetRatio = targetWaterCoveragePercent / 100;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const waterRatio = getWeightedWaterRatio(field, middle);
    if (waterRatio < targetRatio) low = middle + 1;
    else high = middle;
  }
  const lowerTick = parseAtlasFieldValueTicks(low);
  if (!lowerTick.ok) throw new Error(lowerTick.diagnostic.message);
  const level = createAtlasContourLevel(lowerTick.value);
  if (!level.ok) throw new Error(level.diagnostic.message);
  return level.value;
}

function getWeightedWaterRatio(field: QuantizedSphericalField, upperWaterTick: number): number {
  let waterWeight = 0;
  let totalWeight = 0;
  for (let latitudeIndex = 1; latitudeIndex < field.profile.latitudeBandCount; latitudeIndex += 1) {
    const point = getAtlasGridVertex(field.profile, 0, latitudeIndex);
    const weight = Math.cos(planetPointToAngles(point).latitudeRad);
    for (
      let longitudeIndex = 0;
      longitudeIndex < field.profile.longitudeCellCount;
      longitudeIndex += 1
    ) {
      const value = field.valueAt(longitudeIndex, latitudeIndex);
      totalWeight += weight;
      if (value <= upperWaterTick) waterWeight += weight;
    }
  }
  return totalWeight === 0 ? 0 : waterWeight / totalWeight;
}

function createBasis(
  azimuthRatio: number,
  heightRatio: number,
  angularRadiusRad: number,
  amplitude: number,
): SphericalBasis {
  const z = 2 * heightRatio - 1;
  const horizontal = Math.sqrt(Math.max(0, 1 - z * z));
  const azimuth = azimuthRatio * 2 * Math.PI;
  return Object.freeze({
    centerX: horizontal * Math.cos(azimuth),
    centerY: horizontal * Math.sin(azimuth),
    centerZ: z,
    cutoffDot: Math.cos(angularRadiusRad),
    amplitude,
  });
}

function fixedFieldTicks(value: number): AtlasFieldValueTicks {
  const quantized = quantizeAtlasFieldValue(value);
  if (!quantized.ok) throw new Error(quantized.diagnostic.message);
  return quantized.value;
}

function spikeCase(
  fixtureId: AtlasAlgorithmSpikeCase['fixtureId'],
  worldSeed: string,
  overrides: Partial<AtlasAlgorithmSpikeControls>,
): AtlasAlgorithmSpikeCase {
  return Object.freeze({
    fixtureId,
    worldSeed,
    controls: Object.freeze({ ...DEFAULT_CONTROLS, ...overrides }),
  });
}

function validateControls(controls: AtlasAlgorithmSpikeControls): void {
  if (
    !Number.isSafeInteger(controls.circumferenceKm) ||
    controls.circumferenceKm < 10_000 ||
    controls.circumferenceKm > 80_000 ||
    !Number.isSafeInteger(controls.targetWaterCoveragePercent) ||
    controls.targetWaterCoveragePercent < 45 ||
    controls.targetWaterCoveragePercent > 80 ||
    !Number.isSafeInteger(controls.continentCountIntent) ||
    controls.continentCountIntent < 1 ||
    controls.continentCountIntent > 8
  ) {
    throw new RangeError('Atlas spike controls must remain inside the accepted proof ranges.');
  }
  for (const percentage of [
    controls.fragmentationPercent,
    controls.islandAbundancePercent,
    controls.archipelagoAbundancePercent,
  ]) {
    if (!Number.isSafeInteger(percentage) || percentage < 0 || percentage > 100) {
      throw new RangeError('Atlas spike abundance controls must be integer percentages.');
    }
  }
}

function clamp(minimum: number, maximum: number, value: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
