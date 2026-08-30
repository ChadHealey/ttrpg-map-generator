import { describe, expect, it } from 'vitest';

import {
  createPlanetPoint,
  createRegionalFootprintTransform,
  createRegionalPoint,
  deriveRegionalFootprintEntityId,
  encodeRegionalFootprintIdentityInput,
  getPublicRoundTripBoundKm,
  parseRegionalRectangleFootprint,
  REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES,
  REGIONAL_RECTANGLE_FOOTPRINT_SHAPE_VERSION,
} from './index.js';

const ROOT_SURFACE_ID = '00000000-0000-4000-8000-0000000002ab';
const WORLD_RADIUS_MILLIMETERS = 1_000_000_000;
const AXIS_LIMIT_MILLIMETERS = Math.floor((WORLD_RADIUS_MILLIMETERS * Math.PI) / 4);
const HEMISPHERE_RADIUS_MILLIMETERS = Math.floor((WORLD_RADIUS_MILLIMETERS * Math.PI) / 2);
const SEAM_CROSSING_HALF_WIDTH_MILLIMETERS = 200_000;

describe('ADR-0023 regional rectangle footprint', () => {
  it('accepts immutable ordinary, seam-crossing, near-pole, and exact-pole footprints', () => {
    const ordinary = required(parseRegionalRectangleFootprint(validInput()));
    const seam = required(
      parseRegionalRectangleFootprint(
        validInput({
          origin: required(createPlanetPoint(Math.PI - 0.0001, 0)),
          extent: {
            minXMillimeters: -SEAM_CROSSING_HALF_WIDTH_MILLIMETERS,
            maxXMillimeters: SEAM_CROSSING_HALF_WIDTH_MILLIMETERS,
            minYMillimeters: -1_000,
            maxYMillimeters: 1_000,
          },
        }),
      ),
    );
    const northPole = required(
      parseRegionalRectangleFootprint(
        validInput({ origin: { longitudeTicks: 0, latitudeTicks: 2 ** 30 } }),
      ),
    );
    const nearNorthPole = required(
      parseRegionalRectangleFootprint(
        validInput({ origin: required(createPlanetPoint(0.25, Math.PI / 2 - 0.001)) }),
      ),
    );

    expect(Object.isFrozen(ordinary)).toBe(true);
    expect(Object.isFrozen(ordinary.origin)).toBe(true);
    expect(Object.isFrozen(ordinary.extent)).toBe(true);
    expect(seam.origin.longitudeTicks).toBeGreaterThan(0);
    expect(northPole.origin).toStrictEqual({ longitudeTicks: 0, latitudeTicks: 2 ** 30 });
    for (const footprint of [ordinary, seam, nearNorthPole, northPole]) {
      const transform = createRegionalFootprintTransform(footprint);
      expect(
        required(transform.inverse(required(transform.forward(footprint.origin)))),
      ).toStrictEqual(footprint.origin);
    }
    expect(
      required(
        createRegionalFootprintTransform(seam).inverse(required(createRegionalPoint(0.2, 0))),
      ).longitudeTicks,
    ).toBeLessThan(0);
  });

  it('constructs the version-1 transform and round-trips approved vectors within its bound', () => {
    const footprint = required(parseRegionalRectangleFootprint(validInput()));
    const transform = createRegionalFootprintTransform(footprint);
    const target = required(createPlanetPoint(0.001, -0.001));
    const regional = required(transform.forward(target));
    const recovered = required(transform.inverse(regional));
    const boundKm = getPublicRoundTripBoundKm(footprint.worldRadius);

    expect(transform.id).toBe('planet-regional-azimuthal-equidistant');
    expect(transform.version).toBe(1);
    expect(
      angularDistanceKm(target, recovered, footprint.worldRadius.radiusMillimeters),
    ).toBeLessThanOrEqual(boundKm);
  });

  it('accepts the exact hard-limit corner and rejects one millimeter beyond it', () => {
    const edge = required(
      parseRegionalRectangleFootprint(
        validInput({
          extent: {
            minXMillimeters: -AXIS_LIMIT_MILLIMETERS,
            maxXMillimeters: AXIS_LIMIT_MILLIMETERS,
            minYMillimeters: -AXIS_LIMIT_MILLIMETERS,
            maxYMillimeters: AXIS_LIMIT_MILLIMETERS,
          },
        }),
      ),
    );
    const beyond = parseRegionalRectangleFootprint(
      validInput({
        extent: {
          minXMillimeters: -AXIS_LIMIT_MILLIMETERS,
          maxXMillimeters: AXIS_LIMIT_MILLIMETERS + 1,
          minYMillimeters: -1,
          maxYMillimeters: 1,
        },
      }),
    );

    expect(edge.extent.maxXMillimeters).toBe(AXIS_LIMIT_MILLIMETERS);
    expectDiagnostic(beyond, REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES.extentLimit, 'extent');
  });

  it('returns stable diagnostics without repairing invalid selection input', () => {
    expectDiagnostic(
      parseRegionalRectangleFootprint(validInput({ shapeVersion: 'regional-rectangle-v2' })),
      REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES.unsupportedShape,
      'shapeVersion',
    );
    expectDiagnostic(
      parseRegionalRectangleFootprint(
        validInput({
          extent: {
            minXMillimeters: 0,
            maxXMillimeters: 0,
            minYMillimeters: 0,
            maxYMillimeters: 1,
          },
        }),
      ),
      REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES.degenerateExtent,
      'extent',
    );
    expectDiagnostic(
      parseRegionalRectangleFootprint(
        validInput({ origin: { longitudeTicks: 1, latitudeTicks: 2 ** 30 } }),
      ),
      REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES.invalidCoordinate,
      'origin',
    );
    expectDiagnostic(
      parseRegionalRectangleFootprint(validInput({ rootSurfaceId: ROOT_SURFACE_ID.toUpperCase() })),
      REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES.invalidContext,
      'rootSurfaceId',
    );
    expectDiagnostic(
      parseRegionalRectangleFootprint(
        validInput({
          extent: {
            minXMillimeters: 0,
            maxXMillimeters: HEMISPHERE_RADIUS_MILLIMETERS + 1,
            minYMillimeters: 0,
            maxYMillimeters: 1,
          },
        }),
      ),
      REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES.transformDomain,
      'extent',
    );
    const safeRadiusMillimeters =
      HEMISPHERE_RADIUS_MILLIMETERS -
      Math.ceil(
        getPublicRoundTripBoundKm(
          required(parseRegionalRectangleFootprint(validInput())).worldRadius,
        ) * 1_000_000,
      );
    expectDiagnostic(
      parseRegionalRectangleFootprint(
        validInput({
          extent: {
            minXMillimeters: 0,
            maxXMillimeters: safeRadiusMillimeters + 1,
            minYMillimeters: 0,
            maxYMillimeters: 1,
          },
        }),
      ),
      REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES.transformRoundTrip,
      'extent',
    );
  });

  it('derives identity only from the canonical ADR-0023 tuple', () => {
    const first = required(parseRegionalRectangleFootprint(validInput()));
    const equivalent = required(
      parseRegionalRectangleFootprint({
        transformVersion: 1,
        extent: {
          minYMillimeters: -1_000,
          maxYMillimeters: 1_000,
          maxXMillimeters: 1_000,
          minXMillimeters: -1_000,
        },
        rootSurfaceId: ROOT_SURFACE_ID,
        shapeVersion: REGIONAL_RECTANGLE_FOOTPRINT_SHAPE_VERSION,
        worldRadius: { radiusMillimeters: WORLD_RADIUS_MILLIMETERS },
        transformId: 'planet-regional-azimuthal-equidistant',
        origin: { latitudeTicks: 0, longitudeTicks: 0 },
      }),
    );
    const changedOrigin = required(
      parseRegionalRectangleFootprint(
        validInput({ origin: required(createPlanetPoint(0.001, 0)) }),
      ),
    );

    expect(encodeRegionalFootprintIdentityInput(first)).toBe(
      [
        'regional-rectangle-v1',
        ROOT_SURFACE_ID,
        String(WORLD_RADIUS_MILLIMETERS),
        '0',
        '0',
        '-1000',
        '1000',
        '-1000',
        '1000',
        'planet-regional-azimuthal-equidistant',
        '1',
      ].join('\n'),
    );
    expect(deriveRegionalFootprintEntityId(equivalent)).toBe(
      deriveRegionalFootprintEntityId(first),
    );
    expect(deriveRegionalFootprintEntityId(changedOrigin)).not.toBe(
      deriveRegionalFootprintEntityId(first),
    );
  });
});

function validInput(overrides: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    shapeVersion: REGIONAL_RECTANGLE_FOOTPRINT_SHAPE_VERSION,
    rootSurfaceId: ROOT_SURFACE_ID,
    worldRadius: { radiusMillimeters: WORLD_RADIUS_MILLIMETERS },
    origin: { longitudeTicks: 0, latitudeTicks: 0 },
    extent: {
      minXMillimeters: -1_000,
      maxXMillimeters: 1_000,
      minYMillimeters: -1_000,
      maxYMillimeters: 1_000,
    },
    transformId: 'planet-regional-azimuthal-equidistant',
    transformVersion: 1,
    ...overrides,
  };
}

function required<Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false },
): Value {
  if (!result.ok) throw new Error('Expected valid footprint test input.');
  return result.value;
}

function expectDiagnostic(
  result:
    | { readonly ok: true }
    | { readonly ok: false; readonly diagnostic: { code: string; subject: string } },
  code: string,
  subject: string,
): void {
  if (result.ok) throw new Error('Expected an invalid footprint result.');
  expect(result.diagnostic.code).toBe(code);
  expect(result.diagnostic.subject).toBe(subject);
}

function angularDistanceKm(
  first: { readonly longitudeTicks: number; readonly latitudeTicks: number },
  second: { readonly longitudeTicks: number; readonly latitudeTicks: number },
  radiusMillimeters: number,
): number {
  const tickRadians = (2 * Math.PI) / 2 ** 32;
  const longitude = (first.longitudeTicks - second.longitudeTicks) * tickRadians;
  const latitude = (first.latitudeTicks - second.latitudeTicks) * tickRadians;
  const sineLatitude = Math.sin(latitude / 2);
  const sineLongitude = Math.sin(longitude / 2);
  const a =
    sineLatitude * sineLatitude +
    Math.cos(first.latitudeTicks * tickRadians) *
      Math.cos(second.latitudeTicks * tickRadians) *
      sineLongitude *
      sineLongitude;
  return (radiusMillimeters / 1_000_000) * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
