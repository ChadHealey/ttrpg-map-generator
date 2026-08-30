/** Validation and transform construction for the accepted ADR-0023 footprint contract. */

import {
  COORDINATE_TRANSFORM_VERSION,
  createPlanetRegionalTransform,
  PLANET_REGIONAL_TRANSFORM_ID,
  type PlanetRegionalTransform,
  TRANSFORM_DIAGNOSTIC_CODES,
  validateRoundTripSafeRegionalExtent,
} from './coordinate-transforms.js';
import {
  parsePlanetPoint,
  parseRegionalExtent,
  parseRegionalPoint,
  parseWorldRadius,
  type RegionalExtent,
} from './coordinates.js';
import { parseStableId } from './identity.js';
import {
  REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES,
  REGIONAL_RECTANGLE_FOOTPRINT_SHAPE_VERSION,
  type RegionalFootprintDiagnosticCode,
  type RegionalFootprintParseResult,
  type RegionalRectangleFootprint,
} from './regional-footprint-model.js';

type UnknownRecord = Readonly<Record<string, unknown>>;

/** Parse persisted/imported footprint input without canonicalizing or repairing it. */
export function parseRegionalRectangleFootprint(input: unknown): RegionalFootprintParseResult {
  if (!isUnknownRecord(input)) {
    return failure(
      REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES.unsupportedShape,
      'footprint',
      'Footprint must be an object with a supported shapeVersion.',
    );
  }
  if (input.shapeVersion !== REGIONAL_RECTANGLE_FOOTPRINT_SHAPE_VERSION) {
    return failure(
      REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES.unsupportedShape,
      'shapeVersion',
      `Footprint shapeVersion must be ${REGIONAL_RECTANGLE_FOOTPRINT_SHAPE_VERSION}.`,
    );
  }
  if (
    input.transformId !== PLANET_REGIONAL_TRANSFORM_ID ||
    input.transformVersion !== COORDINATE_TRANSFORM_VERSION
  ) {
    return failure(
      REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES.unsupportedShape,
      'transform',
      `Footprint transform must be ${PLANET_REGIONAL_TRANSFORM_ID} version ${String(COORDINATE_TRANSFORM_VERSION)}.`,
    );
  }
  return validateRegionalRectangleFootprint(input as unknown as RegionalRectangleFootprint);
}

/** Validate an already typed footprint, returning a frozen canonical record when valid. */
export function validateRegionalRectangleFootprint(
  footprint: RegionalRectangleFootprint,
): RegionalFootprintParseResult {
  const rootSurfaceId = parseStableId('root-surface', footprint.rootSurfaceId);
  const worldRadius = parseWorldRadius(footprint.worldRadius);
  if (!rootSurfaceId.ok || !worldRadius.ok) {
    return failure(
      REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES.invalidContext,
      !rootSurfaceId.ok ? 'rootSurfaceId' : 'worldRadius',
      'Footprint requires a canonical root-surface ID and positive canonical world radius.',
    );
  }

  const origin = parsePlanetPoint(footprint.origin);
  const extent = parseRegionalExtent(footprint.extent);
  if (!origin.ok || !extent.ok) {
    return failure(
      REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES.invalidCoordinate,
      !origin.ok ? 'origin' : 'extent',
      'Footprint origin and extent must use canonical planet and regional coordinate ticks.',
    );
  }
  if (
    extent.value.maxXMillimeters <= extent.value.minXMillimeters ||
    extent.value.maxYMillimeters <= extent.value.minYMillimeters
  ) {
    return failure(
      REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES.degenerateExtent,
      'extent',
      'Footprint extent must have strictly positive width and height.',
    );
  }
  const canonicalFootprint: RegionalRectangleFootprint = Object.freeze({
    shapeVersion: REGIONAL_RECTANGLE_FOOTPRINT_SHAPE_VERSION,
    rootSurfaceId: rootSurfaceId.value,
    worldRadius: worldRadius.value,
    origin: origin.value,
    extent: extent.value,
    transformId: PLANET_REGIONAL_TRANSFORM_ID,
    transformVersion: COORDINATE_TRANSFORM_VERSION,
  });
  const transform = createPlanetRegionalTransform(
    canonicalFootprint.origin,
    canonicalFootprint.worldRadius,
  );
  for (const point of extentCorners(canonicalFootprint.extent)) {
    const parsed = parseRegionalPoint(point);
    if (!parsed.ok || !transform.inverse(parsed.value).ok) {
      return failure(
        REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES.transformDomain,
        'extent',
        'Every footprint extent corner must remain inside the transform hemisphere.',
      );
    }
  }
  const safe = validateRoundTripSafeRegionalExtent(canonicalFootprint.extent, transform);
  if (!safe.ok) {
    return failure(
      safe.diagnostic.code === TRANSFORM_DIAGNOSTIC_CODES.unsafeRegionalExtent
        ? REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES.transformRoundTrip
        : REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES.transformDomain,
      'extent',
      'Every footprint extent corner must remain inside the declared transform round-trip-safe disk.',
    );
  }
  if (!isWithinHardExtentLimit(extent.value, worldRadius.value.radiusMillimeters)) {
    return failure(
      REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES.extentLimit,
      'extent',
      'Footprint extent exceeds the ADR-0023 45-degree-per-axis physical limit.',
    );
  }
  return { ok: true, value: canonicalFootprint };
}

/** Reconstruct the existing version-1 local chart from an accepted footprint. */
export function createRegionalFootprintTransform(
  footprint: RegionalRectangleFootprint,
): PlanetRegionalTransform {
  return createPlanetRegionalTransform(footprint.origin, footprint.worldRadius);
}

function isWithinHardExtentLimit(extent: RegionalExtent, radiusMillimeters: number): boolean {
  const axisLimit = Math.floor((radiusMillimeters * Math.PI) / 4);
  const width = BigInt(extent.maxXMillimeters) - BigInt(extent.minXMillimeters);
  const height = BigInt(extent.maxYMillimeters) - BigInt(extent.minYMillimeters);
  const limit = BigInt(axisLimit);
  return (
    BigInt(Math.abs(extent.minXMillimeters)) <= limit &&
    BigInt(Math.abs(extent.maxXMillimeters)) <= limit &&
    BigInt(Math.abs(extent.minYMillimeters)) <= limit &&
    BigInt(Math.abs(extent.maxYMillimeters)) <= limit &&
    width <= 2n * limit &&
    height <= 2n * limit
  );
}

function extentCorners(extent: RegionalExtent): readonly unknown[] {
  return [
    { xMillimeters: extent.minXMillimeters, yMillimeters: extent.minYMillimeters },
    { xMillimeters: extent.minXMillimeters, yMillimeters: extent.maxYMillimeters },
    { xMillimeters: extent.maxXMillimeters, yMillimeters: extent.minYMillimeters },
    { xMillimeters: extent.maxXMillimeters, yMillimeters: extent.maxYMillimeters },
  ];
}

function isUnknownRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function failure(
  code: RegionalFootprintDiagnosticCode,
  subject: string,
  message: string,
): RegionalFootprintParseResult {
  return { ok: false, diagnostic: { code, subject, message } };
}
