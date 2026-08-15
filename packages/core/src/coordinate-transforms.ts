import {
  inverseRegionalKilometersContinuous,
  projectPlanetAnglesContinuous,
} from './coordinate-transform-math.js';
import {
  type CoordinateDiagnostic,
  createPlanetPoint,
  createRegionalPoint,
  MILLIMETERS_PER_KILOMETER,
  parsePlanetPoint,
  parseRegionalPoint,
  type PlanetPoint,
  planetPointToAngles,
  type RegionalExtent,
  type RegionalPoint,
  regionalPointToKilometers,
  type WorldRadius,
  worldRadiusToKilometers,
} from './coordinates.js';

declare const PROOF_INPUT_POINT_BRAND: unique symbol;

export const PROOF_INPUT_EXTENT = 10_000;
export const PROOF_INPUT_TO_PLANET_TRANSFORM_ID = 'proof-input-to-planet';
export const PLANET_REGIONAL_TRANSFORM_ID = 'planet-regional-azimuthal-equidistant';
export const COORDINATE_TRANSFORM_VERSION = 1;

/** A generator-local point in the fixed synthetic Milestone 1 proof lattice. */
export type ProofInputPoint = Readonly<{
  readonly x: number;
  readonly y: number;
  readonly [PROOF_INPUT_POINT_BRAND]: true;
}>;

export const TRANSFORM_DIAGNOSTIC_CODES = {
  invalidProofInput: 'transform.proof-input.invalid',
  outsideProofImage: 'transform.proof-image.outside',
  outsideHemisphere: 'transform.hemisphere.outside',
  unsafeRegionalExtent: 'transform.regional-extent.unsafe',
} as const;

export type TransformDiagnosticCode =
  (typeof TRANSFORM_DIAGNOSTIC_CODES)[keyof typeof TRANSFORM_DIAGNOSTIC_CODES];

export interface TransformDiagnostic {
  readonly code: TransformDiagnosticCode;
  readonly message: string;
}

export type CoordinateOperationDiagnostic = CoordinateDiagnostic | TransformDiagnostic;

export type CoordinateOperationResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly diagnostic: CoordinateOperationDiagnostic };

export interface CoordinateTransform<Source, Destination> {
  readonly id: string;
  readonly version: typeof COORDINATE_TRANSFORM_VERSION;
  readonly sourceSpace: string;
  readonly destinationSpace: string;
  readonly forward: (source: Source) => CoordinateOperationResult<Destination>;
}

export interface InvertibleCoordinateTransform<Source, Destination> extends CoordinateTransform<
  Source,
  Destination
> {
  readonly inverse: (destination: Destination) => CoordinateOperationResult<Source>;
}

export interface PlanetRegionalTransform extends InvertibleCoordinateTransform<
  PlanetPoint,
  RegionalPoint
> {
  readonly id: typeof PLANET_REGIONAL_TRANSFORM_ID;
  readonly sourceSpace: 'planet';
  readonly destinationSpace: 'regional';
  readonly origin: PlanetPoint;
  readonly radius: WorldRadius;
  readonly hemisphereRadiusMillimeters: number;
}

function transformFailure<Value>(
  code: TransformDiagnosticCode,
  message: string,
): CoordinateOperationResult<Value> {
  return { ok: false, diagnostic: { code, message } };
}

function isInHemisphereDisk(point: RegionalPoint, radiusMillimeters: number): boolean {
  const x = BigInt(point.xMillimeters);
  const y = BigInt(point.yMillimeters);
  const radius = BigInt(radiusMillimeters);
  return x * x + y * y <= radius * radius;
}

/** Validate one generator-local proof input without coercion. */
export function createProofInputPoint(
  x: number,
  y: number,
): CoordinateOperationResult<ProofInputPoint> {
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    x > PROOF_INPUT_EXTENT ||
    y < 0 ||
    y > PROOF_INPUT_EXTENT
  ) {
    return transformFailure(
      TRANSFORM_DIAGNOSTIC_CODES.invalidProofInput,
      `Proof input coordinates must be integers in [0, ${String(PROOF_INPUT_EXTENT)}].`,
    );
  }

  return {
    ok: true,
    value: Object.freeze({ x, y }) as ProofInputPoint,
  };
}

function proofInputToPlanet(source: ProofInputPoint): CoordinateOperationResult<PlanetPoint> {
  return parsePlanetPoint({
    longitudeTicks: (source.x - PROOF_INPUT_EXTENT / 2) * 65_536,
    latitudeTicks: (source.y - PROOF_INPUT_EXTENT / 2) * 65_536,
  });
}

function planetToProofInput(destination: PlanetPoint): CoordinateOperationResult<ProofInputPoint> {
  const minimumTick = -(PROOF_INPUT_EXTENT / 2) * 65_536;
  const maximumTick = (PROOF_INPUT_EXTENT / 2) * 65_536;
  if (
    destination.longitudeTicks < minimumTick ||
    destination.longitudeTicks > maximumTick ||
    destination.latitudeTicks < minimumTick ||
    destination.latitudeTicks > maximumTick ||
    destination.longitudeTicks % 65_536 !== 0 ||
    destination.latitudeTicks % 65_536 !== 0
  ) {
    return transformFailure(
      TRANSFORM_DIAGNOSTIC_CODES.outsideProofImage,
      'Planet point is not on the exact proof-input-to-planet version 1 lattice image.',
    );
  }

  return createProofInputPoint(
    destination.longitudeTicks / 65_536 + PROOF_INPUT_EXTENT / 2,
    destination.latitudeTicks / 65_536 + PROOF_INPUT_EXTENT / 2,
  );
}

/** Exact fixed transform used only by the synthetic Milestone 1 proof. */
export const proofInputToPlanetTransform: InvertibleCoordinateTransform<
  ProofInputPoint,
  PlanetPoint
> = Object.freeze({
  id: PROOF_INPUT_TO_PLANET_TRANSFORM_ID,
  version: COORDINATE_TRANSFORM_VERSION,
  sourceSpace: 'proof-input',
  destinationSpace: 'planet',
  forward: proofInputToPlanet,
  inverse: planetToProofInput,
});

/** Compose only transforms whose destination/source types agree. */
export function composeCoordinateTransforms<Source, Intermediate, Destination>(
  first: CoordinateTransform<Source, Intermediate>,
  second: CoordinateTransform<Intermediate, Destination>,
): CoordinateTransform<Source, Destination> {
  return Object.freeze({
    id: `${first.id}|${second.id}`,
    version: COORDINATE_TRANSFORM_VERSION,
    sourceSpace: first.sourceSpace,
    destinationSpace: second.destinationSpace,
    forward(source: Source): CoordinateOperationResult<Destination> {
      const intermediate = first.forward(source);
      return intermediate.ok ? second.forward(intermediate.value) : intermediate;
    },
  });
}

/** Compose invertible transforms and apply inverse operations in the required reverse order. */
export function composeInvertibleCoordinateTransforms<Source, Intermediate, Destination>(
  first: InvertibleCoordinateTransform<Source, Intermediate>,
  second: InvertibleCoordinateTransform<Intermediate, Destination>,
): InvertibleCoordinateTransform<Source, Destination> {
  const forward = composeCoordinateTransforms(first, second);
  return Object.freeze({
    ...forward,
    inverse(destination: Destination): CoordinateOperationResult<Source> {
      const intermediate = second.inverse(destination);
      return intermediate.ok ? first.inverse(intermediate.value) : intermediate;
    },
  });
}

/** Conservative public round-trip allowance from ADR-0005, expressed in kilometers. */
export function getPublicRoundTripBoundKm(radius: WorldRadius): number {
  const radiusKm = worldRadiusToKilometers(radius);
  const onePlanetTickRad = (2 * Math.PI) / 2 ** 32;
  const oneRegionalTickKm = 1 / MILLIMETERS_PER_KILOMETER;
  const rawPhysicalAllowanceKm = radiusKm * 1e-12 + 1e-9;
  return 2 * radiusKm * onePlanetTickRad + 2 * oneRegionalTickKm + rawPhysicalAllowanceKm;
}

/** Create the version 1 world-to-region azimuthal-equidistant transform. */
export function createPlanetRegionalTransform(
  origin: PlanetPoint,
  radius: WorldRadius,
): PlanetRegionalTransform {
  const radiusKm = worldRadiusToKilometers(radius);
  const hemisphereRadiusMillimeters = Math.floor((radius.radiusMillimeters * Math.PI) / 2);

  function forward(source: PlanetPoint): CoordinateOperationResult<RegionalPoint> {
    const projected = projectPlanetAnglesContinuous(
      planetPointToAngles(origin),
      planetPointToAngles(source),
      radiusKm,
    );
    if (projected === undefined) {
      return transformFailure(
        TRANSFORM_DIAGNOSTIC_CODES.outsideHemisphere,
        "Planet point lies outside the transform's supported closed hemisphere.",
      );
    }

    const quantized = createRegionalPoint(projected.xKm, projected.yKm);
    if (!quantized.ok) {
      return quantized;
    }

    if (!isInHemisphereDisk(quantized.value, hemisphereRadiusMillimeters)) {
      return transformFailure(
        TRANSFORM_DIAGNOSTIC_CODES.outsideHemisphere,
        'Projected point rounds outside the deterministic inward hemisphere boundary.',
      );
    }

    return quantized;
  }

  function inverse(destination: RegionalPoint): CoordinateOperationResult<PlanetPoint> {
    if (!isInHemisphereDisk(destination, hemisphereRadiusMillimeters)) {
      return transformFailure(
        TRANSFORM_DIAGNOSTIC_CODES.outsideHemisphere,
        'Regional point lies outside the deterministic inward hemisphere boundary.',
      );
    }

    const angles = inverseRegionalKilometersContinuous(
      planetPointToAngles(origin),
      regionalPointToKilometers(destination),
      radiusKm,
    );
    if (angles === undefined) {
      return transformFailure(
        TRANSFORM_DIAGNOSTIC_CODES.outsideHemisphere,
        "Regional point lies outside the transform's supported closed hemisphere.",
      );
    }

    return createPlanetPoint(angles.longitudeRad, angles.latitudeRad);
  }

  return Object.freeze({
    id: PLANET_REGIONAL_TRANSFORM_ID,
    version: COORDINATE_TRANSFORM_VERSION,
    sourceSpace: 'planet',
    destinationSpace: 'regional',
    origin,
    radius,
    hemisphereRadiusMillimeters,
    forward,
    inverse,
  });
}

/** Validate that an extent remains inside the round-trip-safe inset of the transform disk. */
export function validateRoundTripSafeRegionalExtent(
  extent: RegionalExtent,
  transform: PlanetRegionalTransform,
): CoordinateOperationResult<RegionalExtent> {
  const insetMillimeters = Math.ceil(
    getPublicRoundTripBoundKm(transform.radius) * MILLIMETERS_PER_KILOMETER,
  );
  const safeRadiusMillimeters = transform.hemisphereRadiusMillimeters - insetMillimeters;
  if (safeRadiusMillimeters < 0) {
    return transformFailure(
      TRANSFORM_DIAGNOSTIC_CODES.unsafeRegionalExtent,
      'The transform hemisphere is smaller than its declared public round-trip inset.',
    );
  }
  const corners = [
    [extent.minXMillimeters, extent.minYMillimeters],
    [extent.minXMillimeters, extent.maxYMillimeters],
    [extent.maxXMillimeters, extent.minYMillimeters],
    [extent.maxXMillimeters, extent.maxYMillimeters],
  ] as const;
  const safeRadius = BigInt(safeRadiusMillimeters);
  const safeRadiusSquared = safeRadius * safeRadius;

  for (const [xMillimeters, yMillimeters] of corners) {
    const x = BigInt(xMillimeters);
    const y = BigInt(yMillimeters);
    if (x * x + y * y > safeRadiusSquared) {
      return transformFailure(
        TRANSFORM_DIAGNOSTIC_CODES.unsafeRegionalExtent,
        'Every regional extent corner must remain inside the transform round-trip-safe disk.',
      );
    }
  }

  return { ok: true, value: extent };
}

/** Validate unknown canonical points before applying the transform at a trust boundary. */
export function transformUnknownPlanetPoint(
  transform: PlanetRegionalTransform,
  input: unknown,
): CoordinateOperationResult<RegionalPoint> {
  const parsed = parsePlanetPoint(input);
  return parsed.ok ? transform.forward(parsed.value) : parsed;
}

/** Validate unknown canonical points before applying the inverse at a trust boundary. */
export function inverseUnknownRegionalPoint(
  transform: PlanetRegionalTransform,
  input: unknown,
): CoordinateOperationResult<PlanetPoint> {
  const parsed = parseRegionalPoint(input);
  return parsed.ok ? transform.inverse(parsed.value) : parsed;
}
