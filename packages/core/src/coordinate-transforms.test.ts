import { describe, expect, it } from 'vitest';

import {
  greatCircleAngularDistance,
  inverseRegionalKilometersContinuous,
  projectPlanetAnglesContinuous,
  regionalEuclideanDistanceKm,
} from './coordinate-transform-math.js';
import {
  composeCoordinateTransforms,
  composeInvertibleCoordinateTransforms,
  createPlanetRegionalTransform,
  createProofInputPoint,
  getPublicRoundTripBoundKm,
  proofInputToPlanetTransform,
  TRANSFORM_DIAGNOSTIC_CODES,
  validateRoundTripSafeRegionalExtent,
} from './coordinate-transforms.js';
import {
  createPlanetPoint,
  createRegionalExtent,
  createWorldRadius,
  parsePlanetPoint,
  parseRegionalPoint,
  type PlanetPoint,
  planetPointToAngles,
  type RegionalPoint,
  regionalPointToKilometers,
  type WorldRadius,
  worldRadiusToKilometers,
} from './coordinates.js';

function requireValue<Value>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly diagnostic: unknown },
): Value {
  if (!result.ok) {
    throw new Error('Expected transform operation to succeed.');
  }
  return result.value;
}

function planetPoint(longitudeTicks: number, latitudeTicks: number): PlanetPoint {
  return requireValue(parsePlanetPoint({ longitudeTicks, latitudeTicks }));
}

function regionalPoint(xMillimeters: number, yMillimeters: number): RegionalPoint {
  return requireValue(parseRegionalPoint({ xMillimeters, yMillimeters }));
}

const RADIUS: WorldRadius = requireValue(createWorldRadius(1_000));

describe('proof-input-to-planet transform', () => {
  const cases = [
    [0, 0, -327_680_000, -327_680_000],
    [5_000, 5_000, 0, 0],
    [10_000, 10_000, 327_680_000, 327_680_000],
    [10_000, 0, 327_680_000, -327_680_000],
  ] as const;

  for (const [x, y, longitudeTicks, latitudeTicks] of cases) {
    it(`maps and exactly inverts (${String(x)}, ${String(y)})`, () => {
      const source = requireValue(createProofInputPoint(x, y));
      const planet = requireValue(proofInputToPlanetTransform.forward(source));

      expect(planet).toStrictEqual({ longitudeTicks, latitudeTicks });
      expect(proofInputToPlanetTransform.inverse(planet)).toStrictEqual({
        ok: true,
        value: source,
      });
    });
  }

  it('rejects out-of-extent inputs and planet points outside its exact lattice image', () => {
    expect(createProofInputPoint(-1, 0)).toMatchObject({ ok: false });
    expect(createProofInputPoint(0.5, 0)).toMatchObject({ ok: false });
    expect(proofInputToPlanetTransform.inverse(planetPoint(1, 0))).toStrictEqual({
      ok: false,
      diagnostic: {
        code: TRANSFORM_DIAGNOSTIC_CODES.outsideProofImage,
        message: 'Planet point is not on the exact proof-input-to-planet version 1 lattice image.',
      },
    });
  });
});

describe('planet-regional azimuthal-equidistant transform', () => {
  const fixedCases = [
    [planetPoint(0, 0), planetPoint(536_870_912, 0), 785_398_163, 0],
    [planetPoint(0, 0), planetPoint(0, 536_870_912), 0, 785_398_163],
    [planetPoint(1_879_048_192, 0), planetPoint(-1_879_048_192, 0), 785_398_163, 0],
    [planetPoint(0, 1_073_741_824), planetPoint(0, 536_870_912), 0, -785_398_163],
    [planetPoint(0, 1_073_741_824), planetPoint(1_073_741_824, 536_870_912), 785_398_163, 0],
  ] as const;

  for (const [origin, target, xMillimeters, yMillimeters] of fixedCases) {
    it(`matches fixed vector (${String(origin.longitudeTicks)}, ${String(origin.latitudeTicks)})`, () => {
      const transform = createPlanetRegionalTransform(origin, RADIUS);
      expect(transform.forward(target)).toStrictEqual({
        ok: true,
        value: { xMillimeters, yMillimeters },
      });
    });
  }

  it('rejects the antipode and the forward point that quantizes outside the hemisphere disk', () => {
    const transform = createPlanetRegionalTransform(planetPoint(0, 0), RADIUS);

    expect(transform.forward(planetPoint(-2_147_483_648, 0))).toMatchObject({
      ok: false,
      diagnostic: { code: TRANSFORM_DIAGNOSTIC_CODES.outsideHemisphere },
    });
    expect(transform.forward(planetPoint(0, 1_073_741_824))).toMatchObject({
      ok: false,
      diagnostic: { code: TRANSFORM_DIAGNOSTIC_CODES.outsideHemisphere },
    });
  });

  it('uses the exact integer inward hemisphere boundary in the inverse', () => {
    const transform = createPlanetRegionalTransform(planetPoint(0, 0), RADIUS);

    expect(transform.hemisphereRadiusMillimeters).toBe(1_570_796_326);
    expect(transform.inverse(regionalPoint(0, 1_570_796_326))).toMatchObject({ ok: true });
    expect(transform.inverse(regionalPoint(0, 1_570_796_327))).toMatchObject({
      ok: false,
      diagnostic: { code: TRANSFORM_DIAGNOSTIC_CODES.outsideHemisphere },
    });
  });

  it('round-trips near a canonical pole without treating longitude as planar x', () => {
    const transform = createPlanetRegionalTransform(
      planetPoint(123_456_789, 1_073_741_800),
      RADIUS,
    );
    const source = regionalPoint(10_000_000, -20_000_000);
    const target = requireValue(transform.inverse(source));
    const restored = requireValue(transform.forward(target));

    expect(
      regionalEuclideanDistanceKm(
        regionalPointToKilometers(source),
        regionalPointToKilometers(restored),
      ),
    ).toBeLessThanOrEqual(getPublicRoundTripBoundKm(RADIUS));
  });

  it('accepts extents inside the public round-trip inset and rejects boundary-touching extents', () => {
    const transform = createPlanetRegionalTransform(planetPoint(0, 0), RADIUS);
    const interior = requireValue(createRegionalExtent(-1_000, 1_000, -2_000, 2_000));
    const boundary = requireValue(
      createRegionalExtent(
        0,
        0,
        transform.hemisphereRadiusMillimeters,
        transform.hemisphereRadiusMillimeters,
      ),
    );

    expect(validateRoundTripSafeRegionalExtent(interior, transform)).toStrictEqual({
      ok: true,
      value: interior,
    });
    expect(validateRoundTripSafeRegionalExtent(boundary, transform)).toMatchObject({
      ok: false,
      diagnostic: { code: TRANSFORM_DIAGNOSTIC_CODES.unsafeRegionalExtent },
    });

    const tinyTransform = createPlanetRegionalTransform(
      planetPoint(0, 0),
      requireValue(createWorldRadius(0.000_001)),
    );
    const originExtent = requireValue(createRegionalExtent(0, 0, 0, 0));
    expect(validateRoundTripSafeRegionalExtent(originExtent, tinyTransform)).toMatchObject({
      ok: false,
      diagnostic: { code: TRANSFORM_DIAGNOSTIC_CODES.unsafeRegionalExtent },
    });
  });
});

describe('transform round trips and composition', () => {
  it('keeps private continuous arithmetic within the raw ADR-0005 budgets', () => {
    const radiusKm = worldRadiusToKilometers(RADIUS);
    const origin = { longitudeRad: Math.PI - 0.1, latitudeRad: 0.7 };
    const samples = [
      { xKm: 0, yKm: 0 },
      { xKm: 500, yKm: -300 },
      { xKm: -900, yKm: 400 },
      { xKm: 1_200, yKm: 200 },
    ] as const;

    for (const regional of samples) {
      const planet = inverseRegionalKilometersContinuous(origin, regional, radiusKm);
      expect(planet).toBeDefined();
      if (planet === undefined) {
        continue;
      }

      const reprojected = projectPlanetAnglesContinuous(origin, planet, radiusKm);
      expect(reprojected).toBeDefined();
      if (reprojected === undefined) {
        continue;
      }

      expect(regionalEuclideanDistanceKm(regional, reprojected)).toBeLessThanOrEqual(
        radiusKm * 1e-12 + 1e-9,
      );

      const planetAgain = inverseRegionalKilometersContinuous(origin, reprojected, radiusKm);
      expect(planetAgain).toBeDefined();
      if (planetAgain !== undefined) {
        expect(greatCircleAngularDistance(planet, planetAgain)).toBeLessThanOrEqual(1e-12);
      }
    }
  });

  it('keeps deterministic public property samples within the post-quantization bound', () => {
    const transform = createPlanetRegionalTransform(
      planetPoint(1_900_000_000, 250_000_000),
      RADIUS,
    );
    const boundKm = getPublicRoundTripBoundKm(RADIUS);
    let state = 0x42_43_00_05;

    function nextSigned(limit: number): number {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return Math.trunc(((state / 0x1_0000_0000) * 2 - 1) * limit);
    }

    for (let index = 0; index < 200; index += 1) {
      const source = regionalPoint(nextSigned(900_000_000), nextSigned(900_000_000));
      const planet = requireValue(transform.inverse(source));
      const restored = requireValue(transform.forward(planet));
      expect(
        regionalEuclideanDistanceKm(
          regionalPointToKilometers(source),
          regionalPointToKilometers(restored),
        ),
      ).toBeLessThanOrEqual(boundKm);

      const planetRestored = requireValue(transform.inverse(restored));
      expect(
        greatCircleAngularDistance(
          planetPointToAngles(planet),
          planetPointToAngles(planetRestored),
        ),
      ).toBeLessThanOrEqual(boundKm / worldRadiusToKilometers(RADIUS));
    }
  });

  it('composes proof, planet, and regional types through canonical boundaries', () => {
    const regionalTransform = createPlanetRegionalTransform(
      requireValue(createPlanetPoint(0, 0)),
      RADIUS,
    );
    const composed = composeCoordinateTransforms(proofInputToPlanetTransform, regionalTransform);
    const source = requireValue(createProofInputPoint(6_000, 4_000));
    const planet = requireValue(proofInputToPlanetTransform.forward(source));

    expect(composed.forward(source)).toStrictEqual(regionalTransform.forward(planet));

    const invertibleComposition = composeInvertibleCoordinateTransforms(
      proofInputToPlanetTransform,
      regionalTransform,
    );
    const destination = requireValue(invertibleComposition.forward(source));
    expect(invertibleComposition.inverse(destination)).toStrictEqual({ ok: true, value: source });
  });
});
