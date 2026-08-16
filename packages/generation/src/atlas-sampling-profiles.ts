/**
 * Versioned planet-native sample lattices shared by the Milestone 2 preview and full profiles.
 *
 * The lattice is a spherical topology contract, not a display projection. Interior latitude
 * rows contain one sample per longitude cell, each pole is sampled once, the last longitude
 * cell wraps to the first, and the two polar bands are triangle fans.
 */

import {
  parsePlanetPoint,
  PLANET_LATITUDE_MIN_TICKS,
  PLANET_LONGITUDE_MIN_TICKS,
  PLANET_TICKS_PER_TURN,
  type PlanetPoint,
  roundTiesAwayFromZero,
} from '@ttrpg-map/core';

declare const ATLAS_FIELD_VALUE_TICKS_BRAND: unique symbol;
declare const ATLAS_CONTOUR_LEVEL_BRAND: unique symbol;

/** Signed fixed-point scalar used at field, classification, contour, and adapter boundaries. */
export type AtlasFieldValueTicks = number & {
  readonly [ATLAS_FIELD_VALUE_TICKS_BRAND]: true;
};

/** An odd doubled field tick, so a contour level can never equal an integer field sample. */
export type AtlasContourLevel = number & { readonly [ATLAS_CONTOUR_LEVEL_BRAND]: true };

export type AtlasSamplingProfileId = 'world-atlas-preview-v1' | 'world-atlas-full-v1';

/** Effective cell dimensions and compatibility identity for one spherical sample lattice. */
export interface AtlasSamplingProfile {
  readonly profileId: AtlasSamplingProfileId;
  readonly samplingPolicyVersion: 1;
  readonly longitudeCellCount: number;
  readonly latitudeBandCount: number;
}

export const ATLAS_SAMPLING_POLICY_VERSION = 1 as const;
export const ATLAS_FIELD_ALGORITHM_VERSION = 1 as const;
export const ATLAS_FIELD_QUANTIZATION_SCALE = 2 ** 24;
export const ATLAS_FIELD_QUANTUM = 1 / ATLAS_FIELD_QUANTIZATION_SCALE;

export const WORLD_ATLAS_PREVIEW_PROFILE = Object.freeze({
  profileId: 'world-atlas-preview-v1',
  samplingPolicyVersion: ATLAS_SAMPLING_POLICY_VERSION,
  longitudeCellCount: 512,
  latitudeBandCount: 256,
}) satisfies AtlasSamplingProfile;

export const WORLD_ATLAS_FULL_PROFILE = Object.freeze({
  profileId: 'world-atlas-full-v1',
  samplingPolicyVersion: ATLAS_SAMPLING_POLICY_VERSION,
  longitudeCellCount: 2_048,
  latitudeBandCount: 1_024,
}) satisfies AtlasSamplingProfile;

export const WORLD_ATLAS_PROFILE_REFINEMENT_FACTOR = 4;

/** Maximum angular displacement permitted for a retained disposable preview boundary. */
export const WORLD_ATLAS_PREVIEW_BOUNDARY_TOLERANCE_RAD =
  (Math.SQRT2 * Math.PI) / WORLD_ATLAS_PREVIEW_PROFILE.latitudeBandCount;

export const ATLAS_SAMPLING_DIAGNOSTIC_CODES = {
  invalidFieldValue: 'atlas.field-value.invalid',
  invalidFieldTicks: 'atlas.field-ticks.invalid',
  invalidContourLevel: 'atlas.contour-level.invalid',
} as const;

export type AtlasSamplingDiagnosticCode =
  (typeof ATLAS_SAMPLING_DIAGNOSTIC_CODES)[keyof typeof ATLAS_SAMPLING_DIAGNOSTIC_CODES];

export interface AtlasSamplingDiagnostic {
  readonly code: AtlasSamplingDiagnosticCode;
  readonly message: string;
}

export type AtlasSamplingResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly diagnostic: AtlasSamplingDiagnostic };

/** Number of unique planet-native evaluation anchors in canonical traversal order. */
export function getAtlasSampleAnchorCount(profile: AtlasSamplingProfile): number {
  validateProfile(profile);
  return profile.longitudeCellCount * (profile.latitudeBandCount - 1) + 2;
}

/**
 * Return one canonical planet point for a lattice vertex.
 *
 * At latitude indices zero and `latitudeBandCount`, every longitude index resolves to the one
 * canonical pole. Callers that enumerate unique anchors must visit each pole only once.
 */
export function getAtlasGridVertex(
  profile: AtlasSamplingProfile,
  longitudeIndex: number,
  latitudeIndex: number,
): PlanetPoint {
  validateProfile(profile);
  if (
    !Number.isSafeInteger(longitudeIndex) ||
    longitudeIndex < 0 ||
    longitudeIndex >= profile.longitudeCellCount ||
    !Number.isSafeInteger(latitudeIndex) ||
    latitudeIndex < 0 ||
    latitudeIndex > profile.latitudeBandCount
  ) {
    throw new RangeError('Atlas grid indices must address a vertex in the declared profile.');
  }

  const latitudeStepTicks = PLANET_TICKS_PER_TURN / 2 / profile.latitudeBandCount;
  const latitudeTicks = PLANET_LATITUDE_MIN_TICKS + latitudeIndex * latitudeStepTicks;
  const longitudeTicks =
    latitudeIndex === 0 || latitudeIndex === profile.latitudeBandCount
      ? 0
      : PLANET_LONGITUDE_MIN_TICKS +
        longitudeIndex * (PLANET_TICKS_PER_TURN / profile.longitudeCellCount);
  const point = parsePlanetPoint({ longitudeTicks, latitudeTicks });
  if (!point.ok) {
    throw new Error(`Invalid fixed atlas anchor: ${point.diagnostic.message}`);
  }
  return point.value;
}

/** Canonical south-pole, row-major west-to-east, north-pole storage index. */
export function getAtlasSampleStorageIndex(
  profile: AtlasSamplingProfile,
  longitudeIndex: number,
  latitudeIndex: number,
): number {
  getAtlasGridVertex(profile, longitudeIndex, latitudeIndex);
  if (latitudeIndex === 0) return 0;
  if (latitudeIndex === profile.latitudeBandCount) {
    return getAtlasSampleAnchorCount(profile) - 1;
  }
  return 1 + (latitudeIndex - 1) * profile.longitudeCellCount + longitudeIndex;
}

/** Map a preview lattice vertex to the identical full-profile evaluation anchor. */
export function getFullProfileAddressForPreview(
  longitudeIndex: number,
  latitudeIndex: number,
): Readonly<{ longitudeIndex: number; latitudeIndex: number }> {
  getAtlasGridVertex(WORLD_ATLAS_PREVIEW_PROFILE, longitudeIndex, latitudeIndex);
  return Object.freeze({
    longitudeIndex:
      latitudeIndex === 0 || latitudeIndex === WORLD_ATLAS_PREVIEW_PROFILE.latitudeBandCount
        ? 0
        : longitudeIndex * WORLD_ATLAS_PROFILE_REFINEMENT_FACTOR,
    latitudeIndex: latitudeIndex * WORLD_ATLAS_PROFILE_REFINEMENT_FACTOR,
  });
}

/** Quantize a finite normalized field value with the ADR-0005 ties-away-from-zero rule. */
export function quantizeAtlasFieldValue(value: number): AtlasSamplingResult<AtlasFieldValueTicks> {
  if (!Number.isFinite(value) || value < -1 || value > 1) {
    return failure(
      ATLAS_SAMPLING_DIAGNOSTIC_CODES.invalidFieldValue,
      'Atlas field values must be finite normalized numbers in [-1, 1].',
    );
  }
  const ticks = roundTiesAwayFromZero(value * ATLAS_FIELD_QUANTIZATION_SCALE);
  return { ok: true, value: (ticks === 0 ? 0 : ticks) as AtlasFieldValueTicks };
}

/** Validate adapter or persisted evidence ticks without normalizing them. */
export function parseAtlasFieldValueTicks(
  value: unknown,
): AtlasSamplingResult<AtlasFieldValueTicks> {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    Object.is(value, -0) ||
    value < -ATLAS_FIELD_QUANTIZATION_SCALE ||
    value > ATLAS_FIELD_QUANTIZATION_SCALE
  ) {
    return failure(
      ATLAS_SAMPLING_DIAGNOSTIC_CODES.invalidFieldTicks,
      `Atlas field ticks must be a canonical integer in [-${String(
        ATLAS_FIELD_QUANTIZATION_SCALE,
      )}, ${String(ATLAS_FIELD_QUANTIZATION_SCALE)}].`,
    );
  }
  return { ok: true, value: value as AtlasFieldValueTicks };
}

/** Place a non-degenerate contour level halfway above one field tick. */
export function createAtlasContourLevel(
  lowerTick: AtlasFieldValueTicks,
): AtlasSamplingResult<AtlasContourLevel> {
  const level = lowerTick * 2 + 1;
  if (!Number.isSafeInteger(level) || level % 2 === 0) {
    return failure(
      ATLAS_SAMPLING_DIAGNOSTIC_CODES.invalidContourLevel,
      'Atlas contour level must be a safe odd doubled field tick.',
    );
  }
  return { ok: true, value: level as AtlasContourLevel };
}

/** Classification uses only integers; an anchor can never lie exactly on the contour. */
export function isAtlasLand(
  fieldValue: AtlasFieldValueTicks,
  contourLevel: AtlasContourLevel,
): boolean {
  return fieldValue * 2 > contourLevel;
}

function validateProfile(profile: AtlasSamplingProfile): void {
  const longitudeStep = PLANET_TICKS_PER_TURN / profile.longitudeCellCount;
  const latitudeStep = PLANET_TICKS_PER_TURN / 2 / profile.latitudeBandCount;
  const hasCanonicalDimensions =
    (profile.profileId === WORLD_ATLAS_PREVIEW_PROFILE.profileId &&
      profile.longitudeCellCount === WORLD_ATLAS_PREVIEW_PROFILE.longitudeCellCount &&
      profile.latitudeBandCount === WORLD_ATLAS_PREVIEW_PROFILE.latitudeBandCount) ||
    (profile.profileId === WORLD_ATLAS_FULL_PROFILE.profileId &&
      profile.longitudeCellCount === WORLD_ATLAS_FULL_PROFILE.longitudeCellCount &&
      profile.latitudeBandCount === WORLD_ATLAS_FULL_PROFILE.latitudeBandCount);
  if (
    !hasCanonicalDimensions ||
    !Number.isSafeInteger(profile.longitudeCellCount) ||
    profile.longitudeCellCount < 4 ||
    !Number.isSafeInteger(profile.latitudeBandCount) ||
    profile.latitudeBandCount < 2 ||
    !Number.isSafeInteger(longitudeStep) ||
    !Number.isSafeInteger(latitudeStep)
  ) {
    throw new RangeError(
      'Atlas sampling profiles must use their exact version 1 dimensions and integer subdivisions.',
    );
  }
}

function failure<Value>(
  code: AtlasSamplingDiagnosticCode,
  message: string,
): AtlasSamplingResult<Value> {
  return { ok: false, diagnostic: { code, message } };
}
