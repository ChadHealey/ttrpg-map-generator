/** Production version-1 analytic spherical macro-elevation field and profile sampler. */

import {
  type DeepReadonly,
  type DeterministicRandomStream,
  PLANET_ANGULAR_STEP_RAD,
  PLANET_LATITUDE_MIN_TICKS,
  PLANET_LONGITUDE_MIN_TICKS,
  PLANET_TICKS_PER_TURN,
  type PlanetPoint,
  planetPointToAngles,
} from '@ttrpg-map/core';

import {
  ATLAS_GENERATION_COOPERATION_ROW_INTERVAL,
  type AtlasMacroElevationParameters,
} from './atlas-land-water-generator-contract.js';
import {
  type AtlasFieldValueTicks,
  type AtlasSamplingProfile,
  getAtlasGridVertex,
  getAtlasSampleAnchorCount,
  quantizeAtlasFieldValue,
  WORLD_ATLAS_PREVIEW_PROFILE,
  WORLD_ATLAS_PROFILE_REFINEMENT_FACTOR,
} from './atlas-sampling-profiles.js';
import type {
  QuantizedPlanetFieldAdapter,
  QuantizedSphericalField,
} from './geography-algorithm-adapters.js';

interface SphericalBasis {
  readonly centerX: number;
  readonly centerY: number;
  readonly centerZ: number;
  readonly cutoffDot: number;
  readonly amplitude: number;
}

interface CartesianMacroElevationAdapter extends QuantizedPlanetFieldAdapter {
  readonly sampleCartesian: (x: number, y: number, z: number) => AtlasFieldValueTicks;
}

export interface SampledAtlasMacroElevationField extends QuantizedSphericalField {
  /** Return an independently owned canonical traversal copy suitable for a proposal record. */
  readonly copyValues: () => readonly AtlasFieldValueTicks[];
}

export interface AtlasFieldSamplingCooperation {
  /** Called after deterministic row chunks; true stops work before another chunk is scheduled. */
  readonly cooperate: (completedAnchors: number, totalAnchors: number) => Promise<boolean>;
}

export type AtlasFieldSamplingResult =
  | { readonly status: 'completed'; readonly field: SampledAtlasMacroElevationField }
  | { readonly status: 'cancelled' };

class SampledMacroElevationField implements SampledAtlasMacroElevationField {
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

  public copyValues(): readonly AtlasFieldValueTicks[] {
    return Object.freeze(Array.from(this.#values, (value) => value as AtlasFieldValueTicks));
  }
}

/**
 * Construct finite seeded basis parameters from the macro aspect's explicit stream.
 * Classification-only controls cannot enter this function's parameter type.
 */
export function createAtlasMacroElevationFieldAdapter(
  parameters: DeepReadonly<AtlasMacroElevationParameters>,
  random: DeterministicRandomStream,
): QuantizedPlanetFieldAdapter {
  const circumferenceScale = Math.sqrt(40_000 / parameters.worldCircumferenceKm);
  const fragmentationRatio = parameters.fragmentationPercent / 100;
  const islandRatio = parameters.islandAbundancePercent / 100;
  const archipelagoRatio = parameters.archipelagoAbundancePercent / 100;
  const broadCount = parameters.continentCountIntent;
  const bases: SphericalBasis[] = [];

  const balancedPhase = random.nextFloat64();
  for (let index = 0; index < broadCount; index += 1) {
    const center = continentCenter(parameters, random, balancedPhase, index, broadCount);
    const distributionAmplitude =
      parameters.continentDistribution === 'oneDominant'
        ? index === 0
          ? 1.38
          : 0.58
        : parameters.continentDistribution === 'balanced'
          ? 0.9
          : 0.68 + random.nextFloat64() * 0.45;
    bases.push(
      basisAt(
        center,
        clamp(
          0.3,
          0.88,
          (0.64 * circumferenceScale * (1 - fragmentationRatio * 0.12)) / Math.sqrt(broadCount),
        ),
        distributionAmplitude,
      ),
    );
  }

  const islandCount = parameters.islandAbundancePercent === 0 ? 0 : Math.ceil(islandRatio * 7);
  for (let index = 0; index < islandCount; index += 1) {
    bases.push(
      basisAt(
        randomUnitVector(random),
        (0.075 + islandRatio * 0.065) * clamp(0.75, 1.35, circumferenceScale),
        0.22 + islandRatio * 0.18,
      ),
    );
  }

  const archipelagoCount =
    parameters.archipelagoAbundancePercent === 0 ? 0 : Math.ceil(archipelagoRatio * 4);
  for (let clusterIndex = 0; clusterIndex < archipelagoCount; clusterIndex += 1) {
    const clusterCenter = randomUnitVector(random);
    const clusterRadius = 0.12 + archipelagoRatio * 0.08;
    bases.push(basisAt(clusterCenter, clusterRadius, 0.28 + archipelagoRatio * 0.16));
    for (let memberIndex = 0; memberIndex < 3; memberIndex += 1) {
      const bearing = random.nextFloat64() * Math.PI * 2;
      const distance = 0.08 + random.nextFloat64() * (0.07 + archipelagoRatio * 0.05);
      bases.push(
        basisAt(
          offsetUnitVector(clusterCenter, bearing, distance),
          0.055 + archipelagoRatio * 0.035,
          0.2 + archipelagoRatio * 0.14,
        ),
      );
    }
  }

  const cutCount = parameters.fragmentationPercent === 0 ? 0 : Math.ceil(fragmentationRatio * 7);
  for (let index = 0; index < cutCount; index += 1) {
    bases.push(
      basisAt(
        randomUnitVector(random),
        0.1 + random.nextFloat64() * (0.1 + fragmentationRatio * 0.1),
        -(0.18 + fragmentationRatio * 0.42),
      ),
    );
  }

  const polarAmplitude =
    parameters.polarCharacter === 'landBiased'
      ? 0.38
      : parameters.polarCharacter === 'oceanBiased'
        ? -0.38
        : 0;

  const sampleCartesian = (x: number, y: number, z: number): AtlasFieldValueTicks => {
    let value = -0.42 + polarAmplitude * z * z * z * z;
    value += fragmentationRatio * 0.055 * (x * y + y * z - z * x);
    for (const basis of bases) {
      const dot = x * basis.centerX + y * basis.centerY + z * basis.centerZ;
      if (dot <= basis.cutoffDot) continue;
      const normalized = (dot - basis.cutoffDot) / (1 - basis.cutoffDot);
      const smooth = normalized * normalized * (3 - 2 * normalized);
      value += basis.amplitude * smooth;
    }
    return fieldTicks(clamp(-1, 1, value));
  };

  const adapter: CartesianMacroElevationAdapter = Object.freeze({
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
  return adapter;
}

/** Sample one complete profile and optionally reuse the exact nested preview evaluations. */
export async function sampleAtlasMacroElevationField(
  profile: AtlasSamplingProfile,
  adapter: QuantizedPlanetFieldAdapter,
  cooperation: AtlasFieldSamplingCooperation,
  nestedPreview?: SampledAtlasMacroElevationField,
): Promise<AtlasFieldSamplingResult> {
  if (
    nestedPreview !== undefined &&
    (profile.profileId === WORLD_ATLAS_PREVIEW_PROFILE.profileId ||
      nestedPreview.profile.profileId !== WORLD_ATLAS_PREVIEW_PROFILE.profileId)
  ) {
    throw new RangeError('Only the full profile may reuse the exact version-1 preview anchors.');
  }

  const kernel = adapter as Partial<CartesianMacroElevationAdapter> & QuantizedPlanetFieldAdapter;
  const values = new Int32Array(getAtlasSampleAnchorCount(profile));
  values[0] =
    nestedPreview?.valueAt(0, 0) ??
    kernel.sampleCartesian?.(0, 0, -1) ??
    adapter.sample(getAtlasGridVertex(profile, 0, 0));
  values[values.length - 1] =
    nestedPreview?.valueAt(0, nestedPreview.profile.latitudeBandCount) ??
    kernel.sampleCartesian?.(0, 0, 1) ??
    adapter.sample(getAtlasGridVertex(profile, 0, profile.latitudeBandCount));

  const latitudeStepTicks = PLANET_TICKS_PER_TURN / 2 / profile.latitudeBandCount;
  const longitudeStepTicks = PLANET_TICKS_PER_TURN / profile.longitudeCellCount;
  const totalAnchors = values.length;
  let completedAnchors: number;

  for (
    let chunkStart = 1;
    chunkStart < profile.latitudeBandCount;
    chunkStart += ATLAS_GENERATION_COOPERATION_ROW_INTERVAL
  ) {
    const chunkEnd = Math.min(
      profile.latitudeBandCount,
      chunkStart + ATLAS_GENERATION_COOPERATION_ROW_INTERVAL,
    );
    for (let latitudeIndex = chunkStart; latitudeIndex < chunkEnd; latitudeIndex += 1) {
      const latitudeRad =
        (PLANET_LATITUDE_MIN_TICKS + latitudeIndex * latitudeStepTicks) * PLANET_ANGULAR_STEP_RAD;
      const cosLatitude = Math.cos(latitudeRad);
      const z = Math.sin(latitudeRad);
      for (
        let longitudeIndex = 0;
        longitudeIndex < profile.longitudeCellCount;
        longitudeIndex += 1
      ) {
        const index = 1 + (latitudeIndex - 1) * profile.longitudeCellCount + longitudeIndex;
        if (
          nestedPreview !== undefined &&
          latitudeIndex % WORLD_ATLAS_PROFILE_REFINEMENT_FACTOR === 0 &&
          longitudeIndex % WORLD_ATLAS_PROFILE_REFINEMENT_FACTOR === 0
        ) {
          values[index] = nestedPreview.valueAt(
            longitudeIndex / WORLD_ATLAS_PROFILE_REFINEMENT_FACTOR,
            latitudeIndex / WORLD_ATLAS_PROFILE_REFINEMENT_FACTOR,
          );
          continue;
        }
        const longitudeRad =
          (PLANET_LONGITUDE_MIN_TICKS + longitudeIndex * longitudeStepTicks) *
          PLANET_ANGULAR_STEP_RAD;
        values[index] =
          kernel.sampleCartesian?.(
            cosLatitude * Math.cos(longitudeRad),
            cosLatitude * Math.sin(longitudeRad),
            z,
          ) ?? adapter.sample(getAtlasGridVertex(profile, longitudeIndex, latitudeIndex));
      }
    }
    completedAnchors = 1 + (chunkEnd - 1) * profile.longitudeCellCount;
    if (await cooperation.cooperate(completedAnchors, totalAnchors)) {
      return Object.freeze({ status: 'cancelled' });
    }
  }

  completedAnchors = totalAnchors;
  if (await cooperation.cooperate(completedAnchors, totalAnchors)) {
    return Object.freeze({ status: 'cancelled' });
  }
  return Object.freeze({
    status: 'completed',
    field: new SampledMacroElevationField(profile, values),
  });
}

function continentCenter(
  parameters: DeepReadonly<AtlasMacroElevationParameters>,
  random: DeterministicRandomStream,
  balancedPhase: number,
  index: number,
  count: number,
): UnitVector {
  if (parameters.continentDistribution !== 'balanced') return randomUnitVector(random);
  const z = 1 - (2 * (index + 0.5)) / count;
  const horizontal = Math.sqrt(Math.max(0, 1 - z * z));
  const azimuth = (balancedPhase + index * 0.618_033_988_749_894_8) * Math.PI * 2;
  return Object.freeze({
    x: horizontal * Math.cos(azimuth),
    y: horizontal * Math.sin(azimuth),
    z,
  });
}

interface UnitVector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function randomUnitVector(random: DeterministicRandomStream): UnitVector {
  const z = 2 * random.nextFloat64() - 1;
  const horizontal = Math.sqrt(Math.max(0, 1 - z * z));
  const azimuth = random.nextFloat64() * Math.PI * 2;
  return Object.freeze({
    x: horizontal * Math.cos(azimuth),
    y: horizontal * Math.sin(azimuth),
    z,
  });
}

function offsetUnitVector(center: UnitVector, bearing: number, distance: number): UnitVector {
  const reference = Math.abs(center.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  const tangentX = reference.y * center.z - reference.z * center.y;
  const tangentY = reference.z * center.x - reference.x * center.z;
  const tangentZ = reference.x * center.y - reference.y * center.x;
  const tangentLength = Math.hypot(tangentX, tangentY, tangentZ);
  const east = {
    x: tangentX / tangentLength,
    y: tangentY / tangentLength,
    z: tangentZ / tangentLength,
  };
  const north = {
    x: center.y * east.z - center.z * east.y,
    y: center.z * east.x - center.x * east.z,
    z: center.x * east.y - center.y * east.x,
  };
  const tangent = {
    x: east.x * Math.cos(bearing) + north.x * Math.sin(bearing),
    y: east.y * Math.cos(bearing) + north.y * Math.sin(bearing),
    z: east.z * Math.cos(bearing) + north.z * Math.sin(bearing),
  };
  return Object.freeze({
    x: center.x * Math.cos(distance) + tangent.x * Math.sin(distance),
    y: center.y * Math.cos(distance) + tangent.y * Math.sin(distance),
    z: center.z * Math.cos(distance) + tangent.z * Math.sin(distance),
  });
}

function basisAt(center: UnitVector, angularRadiusRad: number, amplitude: number): SphericalBasis {
  return Object.freeze({
    centerX: center.x,
    centerY: center.y,
    centerZ: center.z,
    cutoffDot: Math.cos(angularRadiusRad),
    amplitude,
  });
}

function fieldTicks(value: number): AtlasFieldValueTicks {
  const quantized = quantizeAtlasFieldValue(value);
  if (!quantized.ok) throw new Error(quantized.diagnostic.message);
  return quantized.value;
}

function clamp(minimum: number, maximum: number, value: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
