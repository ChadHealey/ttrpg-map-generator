/**
 * Canonical physical coordinate values for accepted world and regional geometry.
 *
 * Constructors quantize calculation inputs. Parsers validate persisted canonical values without
 * normalizing them, so a boundary cannot silently rewrite accepted geography.
 */

declare const PLANET_POINT_BRAND: unique symbol;
declare const REGIONAL_POINT_BRAND: unique symbol;
declare const REGIONAL_EXTENT_BRAND: unique symbol;
declare const PHYSICAL_DISTANCE_BRAND: unique symbol;
declare const WORLD_RADIUS_BRAND: unique symbol;

export const PLANET_TICKS_PER_TURN = 2 ** 32;
export const PLANET_LONGITUDE_MIN_TICKS = -(2 ** 31);
export const PLANET_LONGITUDE_MAX_TICKS = 2 ** 31 - 1;
export const PLANET_LATITUDE_MIN_TICKS = -(2 ** 30);
export const PLANET_LATITUDE_MAX_TICKS = 2 ** 30;
export const PLANET_ANGULAR_STEP_RAD = (2 * Math.PI) / PLANET_TICKS_PER_TURN;
export const PLANET_HALF_STEP_RAD = Math.PI / PLANET_TICKS_PER_TURN;
export const MILLIMETERS_PER_KILOMETER = 1_000_000;

/** A canonical location on the authoritative spherical world surface. */
export type PlanetPoint = Readonly<{
  readonly longitudeTicks: number;
  readonly latitudeTicks: number;
  readonly [PLANET_POINT_BRAND]: true;
}>;

/** A canonical point in a regional map's local physical coordinate space. */
export type RegionalPoint = Readonly<{
  readonly xMillimeters: number;
  readonly yMillimeters: number;
  readonly [REGIONAL_POINT_BRAND]: true;
}>;

/** A closed, axis-aligned extent in one regional physical coordinate space. */
export type RegionalExtent = Readonly<{
  readonly minXMillimeters: number;
  readonly maxXMillimeters: number;
  readonly minYMillimeters: number;
  readonly maxYMillimeters: number;
  readonly [REGIONAL_EXTENT_BRAND]: true;
}>;

/** A non-negative canonical physical distance measured in millimeter ticks. */
export type PhysicalDistance = Readonly<{
  readonly distanceMillimeters: number;
  readonly [PHYSICAL_DISTANCE_BRAND]: true;
}>;

/** The positive canonical radius of an authoritative spherical world. */
export type WorldRadius = Readonly<{
  readonly radiusMillimeters: number;
  readonly [WORLD_RADIUS_BRAND]: true;
}>;

/** Calculation-boundary angles for one planet point. */
export interface PlanetAngles {
  readonly longitudeRad: number;
  readonly latitudeRad: number;
}

/** Calculation-boundary coordinates in a regional map's kilometer unit. */
export interface RegionalKilometers {
  readonly xKm: number;
  readonly yKm: number;
}

export const COORDINATE_DIAGNOSTIC_CODES = {
  invalidPlanetAngles: 'coordinate.planet-angles.invalid',
  invalidPlanetPoint: 'coordinate.planet-point.invalid',
  invalidRegionalKilometers: 'coordinate.regional-kilometers.invalid',
  invalidRegionalPoint: 'coordinate.regional-point.invalid',
  invalidRegionalExtent: 'coordinate.regional-extent.invalid',
  invalidPhysicalDistance: 'coordinate.physical-distance.invalid',
  invalidWorldRadius: 'coordinate.world-radius.invalid',
} as const;

export type CoordinateDiagnosticCode =
  (typeof COORDINATE_DIAGNOSTIC_CODES)[keyof typeof COORDINATE_DIAGNOSTIC_CODES];

/** A stable, actionable failure returned at a coordinate boundary. */
export interface CoordinateDiagnostic {
  readonly code: CoordinateDiagnosticCode;
  readonly message: string;
}

export type CoordinateResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly diagnostic: CoordinateDiagnostic };

type UnknownRecord = Readonly<Record<string, unknown>>;

function failure<Value>(code: CoordinateDiagnosticCode, message: string): CoordinateResult<Value> {
  return { ok: false, diagnostic: { code, message } };
}

function isUnknownRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCanonicalInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0);
}

function canonicalZero(value: number): number {
  return value === 0 ? 0 : value;
}

/** Round to nearest integer, resolving exact halfway values away from zero. */
export function roundTiesAwayFromZero(value: number): number {
  const magnitude = Math.floor(Math.abs(value) + 0.5);
  return canonicalZero(Math.sign(value) * magnitude);
}

function quantizeKilometers(valueKm: number): number | undefined {
  if (!Number.isFinite(valueKm)) {
    return undefined;
  }

  const millimeters = roundTiesAwayFromZero(valueKm * MILLIMETERS_PER_KILOMETER);
  return Number.isSafeInteger(millimeters) ? millimeters : undefined;
}

/** Construct a canonical planet point from finite radians. */
export function createPlanetPoint(
  longitudeRad: number,
  latitudeRad: number,
): CoordinateResult<PlanetPoint> {
  if (
    !Number.isFinite(longitudeRad) ||
    !Number.isFinite(latitudeRad) ||
    latitudeRad < -Math.PI / 2 ||
    latitudeRad > Math.PI / 2
  ) {
    return failure(
      COORDINATE_DIAGNOSTIC_CODES.invalidPlanetAngles,
      'Planet longitude must be finite and latitude must be finite within [-pi/2, pi/2].',
    );
  }

  let wrappedLongitude = longitudeRad % (2 * Math.PI);
  if (wrappedLongitude >= Math.PI) {
    wrappedLongitude -= 2 * Math.PI;
  } else if (wrappedLongitude < -Math.PI) {
    wrappedLongitude += 2 * Math.PI;
  }
  let longitudeTicks = roundTiesAwayFromZero(wrappedLongitude / PLANET_ANGULAR_STEP_RAD);
  const latitudeTicks = roundTiesAwayFromZero(latitudeRad / PLANET_ANGULAR_STEP_RAD);

  if (longitudeTicks === -PLANET_LONGITUDE_MIN_TICKS) {
    longitudeTicks = PLANET_LONGITUDE_MIN_TICKS;
  }

  if (
    !Number.isSafeInteger(longitudeTicks) ||
    longitudeTicks < PLANET_LONGITUDE_MIN_TICKS ||
    longitudeTicks > PLANET_LONGITUDE_MAX_TICKS ||
    !Number.isSafeInteger(latitudeTicks) ||
    latitudeTicks < PLANET_LATITUDE_MIN_TICKS ||
    latitudeTicks > PLANET_LATITUDE_MAX_TICKS
  ) {
    return failure(
      COORDINATE_DIAGNOSTIC_CODES.invalidPlanetAngles,
      'Planet angles could not be represented by canonical planet ticks.',
    );
  }

  if (Math.abs(latitudeTicks) === PLANET_LATITUDE_MAX_TICKS) {
    longitudeTicks = 0;
  }

  return {
    ok: true,
    value: Object.freeze({
      longitudeTicks: canonicalZero(longitudeTicks),
      latitudeTicks: canonicalZero(latitudeTicks),
    }) as PlanetPoint,
  };
}

/** Validate persisted planet ticks without wrapping, clamping, or otherwise normalizing them. */
export function parsePlanetPoint(input: unknown): CoordinateResult<PlanetPoint> {
  if (!isUnknownRecord(input)) {
    return failure(
      COORDINATE_DIAGNOSTIC_CODES.invalidPlanetPoint,
      'Planet point must be an object containing canonical longitudeTicks and latitudeTicks.',
    );
  }

  const longitudeTicks = input.longitudeTicks;
  const latitudeTicks = input.latitudeTicks;
  if (
    !isCanonicalInteger(longitudeTicks) ||
    longitudeTicks < PLANET_LONGITUDE_MIN_TICKS ||
    longitudeTicks > PLANET_LONGITUDE_MAX_TICKS ||
    !isCanonicalInteger(latitudeTicks) ||
    latitudeTicks < PLANET_LATITUDE_MIN_TICKS ||
    latitudeTicks > PLANET_LATITUDE_MAX_TICKS ||
    (Math.abs(latitudeTicks) === PLANET_LATITUDE_MAX_TICKS && longitudeTicks !== 0)
  ) {
    return failure(
      COORDINATE_DIAGNOSTIC_CODES.invalidPlanetPoint,
      'Planet ticks must be canonical safe integers in range, with longitude zero at either pole.',
    );
  }

  return {
    ok: true,
    value: Object.freeze({ longitudeTicks, latitudeTicks }) as PlanetPoint,
  };
}

/** Recover calculation-boundary radians from an already canonical planet point. */
export function planetPointToAngles(point: PlanetPoint): PlanetAngles {
  return Object.freeze({
    longitudeRad: point.longitudeTicks * PLANET_ANGULAR_STEP_RAD,
    latitudeRad: point.latitudeTicks * PLANET_ANGULAR_STEP_RAD,
  });
}

/** Quantize finite regional kilometer coordinates to canonical millimeter ticks. */
export function createRegionalPoint(xKm: number, yKm: number): CoordinateResult<RegionalPoint> {
  const xMillimeters = quantizeKilometers(xKm);
  const yMillimeters = quantizeKilometers(yKm);
  if (xMillimeters === undefined || yMillimeters === undefined) {
    return failure(
      COORDINATE_DIAGNOSTIC_CODES.invalidRegionalKilometers,
      'Regional coordinates must be finite kilometer values that quantize to safe integer millimeters.',
    );
  }

  return {
    ok: true,
    value: Object.freeze({ xMillimeters, yMillimeters }) as RegionalPoint,
  };
}

/** Validate persisted regional millimeter ticks without re-quantizing them. */
export function parseRegionalPoint(input: unknown): CoordinateResult<RegionalPoint> {
  if (!isUnknownRecord(input)) {
    return failure(
      COORDINATE_DIAGNOSTIC_CODES.invalidRegionalPoint,
      'Regional point must contain canonical xMillimeters and yMillimeters.',
    );
  }

  const xMillimeters = input.xMillimeters;
  const yMillimeters = input.yMillimeters;
  if (!isCanonicalInteger(xMillimeters) || !isCanonicalInteger(yMillimeters)) {
    return failure(
      COORDINATE_DIAGNOSTIC_CODES.invalidRegionalPoint,
      'Regional point components must be canonical safe integer millimeter ticks.',
    );
  }

  return {
    ok: true,
    value: Object.freeze({ xMillimeters, yMillimeters }) as RegionalPoint,
  };
}

/** Recover calculation-boundary kilometers from an already canonical regional point. */
export function regionalPointToKilometers(point: RegionalPoint): RegionalKilometers {
  return Object.freeze({
    xKm: point.xMillimeters / MILLIMETERS_PER_KILOMETER,
    yKm: point.yMillimeters / MILLIMETERS_PER_KILOMETER,
  });
}

/** Construct a closed regional extent from canonical millimeter ticks. */
export function createRegionalExtent(
  minXMillimeters: number,
  maxXMillimeters: number,
  minYMillimeters: number,
  maxYMillimeters: number,
): CoordinateResult<RegionalExtent> {
  if (
    !isCanonicalInteger(minXMillimeters) ||
    !isCanonicalInteger(maxXMillimeters) ||
    !isCanonicalInteger(minYMillimeters) ||
    !isCanonicalInteger(maxYMillimeters) ||
    minXMillimeters > maxXMillimeters ||
    minYMillimeters > maxYMillimeters
  ) {
    return failure(
      COORDINATE_DIAGNOSTIC_CODES.invalidRegionalExtent,
      'Regional extent bounds must be ordered canonical safe integer millimeter ticks.',
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      minXMillimeters,
      maxXMillimeters,
      minYMillimeters,
      maxYMillimeters,
    }) as RegionalExtent,
  };
}

/** Validate a persisted regional extent without repairing its bounds. */
export function parseRegionalExtent(input: unknown): CoordinateResult<RegionalExtent> {
  if (!isUnknownRecord(input)) {
    return failure(
      COORDINATE_DIAGNOSTIC_CODES.invalidRegionalExtent,
      'Regional extent must be an object containing four canonical millimeter bounds.',
    );
  }

  const minXMillimeters = input.minXMillimeters;
  const maxXMillimeters = input.maxXMillimeters;
  const minYMillimeters = input.minYMillimeters;
  const maxYMillimeters = input.maxYMillimeters;
  if (
    !isCanonicalInteger(minXMillimeters) ||
    !isCanonicalInteger(maxXMillimeters) ||
    !isCanonicalInteger(minYMillimeters) ||
    !isCanonicalInteger(maxYMillimeters)
  ) {
    return failure(
      COORDINATE_DIAGNOSTIC_CODES.invalidRegionalExtent,
      'Regional extent bounds must be canonical safe integer millimeter ticks.',
    );
  }

  return createRegionalExtent(minXMillimeters, maxXMillimeters, minYMillimeters, maxYMillimeters);
}

/** Test closed-boundary membership after canonical quantization. */
export function regionalExtentContains(extent: RegionalExtent, point: RegionalPoint): boolean {
  return (
    point.xMillimeters >= extent.minXMillimeters &&
    point.xMillimeters <= extent.maxXMillimeters &&
    point.yMillimeters >= extent.minYMillimeters &&
    point.yMillimeters <= extent.maxYMillimeters
  );
}

/** Quantize a non-negative physical distance expressed in kilometers. */
export function createPhysicalDistance(distanceKm: number): CoordinateResult<PhysicalDistance> {
  const distanceMillimeters = quantizeKilometers(distanceKm);
  if (distanceMillimeters === undefined || distanceMillimeters < 0) {
    return failure(
      COORDINATE_DIAGNOSTIC_CODES.invalidPhysicalDistance,
      'Physical distance must be a finite non-negative kilometer value representable in millimeters.',
    );
  }

  return {
    ok: true,
    value: Object.freeze({ distanceMillimeters }) as PhysicalDistance,
  };
}

/** Validate a persisted non-negative physical-distance millimeter value without re-quantizing. */
export function parsePhysicalDistance(input: unknown): CoordinateResult<PhysicalDistance> {
  if (
    !isUnknownRecord(input) ||
    !isCanonicalInteger(input.distanceMillimeters) ||
    input.distanceMillimeters < 0
  ) {
    return failure(
      COORDINATE_DIAGNOSTIC_CODES.invalidPhysicalDistance,
      'Physical distance must contain non-negative canonical millimeter ticks.',
    );
  }

  return {
    ok: true,
    value: Object.freeze({ distanceMillimeters: input.distanceMillimeters }) as PhysicalDistance,
  };
}

export function physicalDistanceToKilometers(distance: PhysicalDistance): number {
  return distance.distanceMillimeters / MILLIMETERS_PER_KILOMETER;
}

/** Construct a positive world radius whose closed hemisphere remains safely representable. */
export function createWorldRadius(radiusKm: number): CoordinateResult<WorldRadius> {
  const radiusMillimeters = quantizeKilometers(radiusKm);
  if (
    radiusMillimeters === undefined ||
    radiusMillimeters <= 0 ||
    Math.ceil((radiusMillimeters * Math.PI) / 2) > Number.MAX_SAFE_INTEGER
  ) {
    return failure(
      COORDINATE_DIAGNOSTIC_CODES.invalidWorldRadius,
      'World radius must be positive and its projected closed hemisphere must fit safe integer millimeters.',
    );
  }

  return {
    ok: true,
    value: Object.freeze({ radiusMillimeters }) as WorldRadius,
  };
}

/** Validate a persisted world-radius millimeter value without re-quantizing it. */
export function parseWorldRadius(input: unknown): CoordinateResult<WorldRadius> {
  if (
    !isUnknownRecord(input) ||
    !isCanonicalInteger(input.radiusMillimeters) ||
    input.radiusMillimeters <= 0 ||
    Math.ceil((input.radiusMillimeters * Math.PI) / 2) > Number.MAX_SAFE_INTEGER
  ) {
    return failure(
      COORDINATE_DIAGNOSTIC_CODES.invalidWorldRadius,
      'World radius must contain positive canonical millimeter ticks with a safely representable hemisphere.',
    );
  }

  return {
    ok: true,
    value: Object.freeze({ radiusMillimeters: input.radiusMillimeters }) as WorldRadius,
  };
}

export function worldRadiusToKilometers(radius: WorldRadius): number {
  return radius.radiusMillimeters / MILLIMETERS_PER_KILOMETER;
}
