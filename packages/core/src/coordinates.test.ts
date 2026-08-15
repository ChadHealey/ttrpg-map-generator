import { describe, expect, it } from 'vitest';

import {
  COORDINATE_DIAGNOSTIC_CODES,
  createPhysicalDistance,
  createPlanetPoint,
  createRegionalExtent,
  createRegionalPoint,
  createWorldRadius,
  parsePhysicalDistance,
  parsePlanetPoint,
  parseRegionalExtent,
  parseRegionalPoint,
  parseWorldRadius,
  physicalDistanceToKilometers,
  PLANET_ANGULAR_STEP_RAD,
  PLANET_TICKS_PER_TURN,
  type RegionalExtent,
  regionalExtentContains,
  type RegionalPoint,
  worldRadiusToKilometers,
} from './coordinates.js';

function requireValue<Value>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly diagnostic: unknown },
): Value {
  if (!result.ok) {
    throw new Error('Expected coordinate construction to succeed.');
  }
  return result.value;
}

describe('planet coordinate quantization', () => {
  const tau = 2 * Math.PI;
  const cases = [
    [0, 0, 0, 0],
    [Math.PI, 0, -2_147_483_648, 0],
    [-Math.PI, 0, -2_147_483_648, 0],
    [Math.PI - tau / PLANET_TICKS_PER_TURN, 0, 2_147_483_647, 0],
    [-Math.PI + tau / PLANET_TICKS_PER_TURN, 0, -2_147_483_647, 0],
    [Math.PI / 2, Math.PI / 2, 0, 1_073_741_824],
    [-Math.PI / 2, -Math.PI / 2, 0, -1_073_741_824],
    [Math.PI / 2, Math.PI / 2 - tau / PLANET_TICKS_PER_TURN, 1_073_741_824, 1_073_741_823],
    [Math.PI / 2, Math.PI / 2 - tau / (4 * PLANET_TICKS_PER_TURN), 0, 1_073_741_824],
    [tau / (2 * PLANET_TICKS_PER_TURN), 0, 1, 0],
    [-tau / (2 * PLANET_TICKS_PER_TURN), 0, -1, 0],
    [(3 * tau) / (2 * PLANET_TICKS_PER_TURN), 0, 2, 0],
    [-0, -0, 0, 0],
  ] as const;

  for (const [longitudeRad, latitudeRad, longitudeTicks, latitudeTicks] of cases) {
    it(`quantizes (${String(longitudeRad)}, ${String(latitudeRad)}) to fixed ticks`, () => {
      expect(createPlanetPoint(longitudeRad, latitudeRad)).toStrictEqual({
        ok: true,
        value: { longitudeTicks, latitudeTicks },
      });
    });
  }

  it('rejects latitude outside the closed pole interval before quantization', () => {
    expect(createPlanetPoint(0, Math.PI / 2 + PLANET_ANGULAR_STEP_RAD)).toStrictEqual({
      ok: false,
      diagnostic: {
        code: COORDINATE_DIAGNOSTIC_CODES.invalidPlanetAngles,
        message:
          'Planet longitude must be finite and latitude must be finite within [-pi/2, pi/2].',
      },
    });
  });

  it('rejects noncanonical persisted seam, pole, fractional, and negative-zero values', () => {
    expect(parsePlanetPoint({ longitudeTicks: 2_147_483_648, latitudeTicks: 0 }).ok).toBe(false);
    expect(parsePlanetPoint({ longitudeTicks: 1, latitudeTicks: 1_073_741_824 }).ok).toBe(false);
    expect(parsePlanetPoint({ longitudeTicks: 0.5, latitudeTicks: 0 }).ok).toBe(false);
    expect(parsePlanetPoint({ longitudeTicks: -0, latitudeTicks: 0 }).ok).toBe(false);
  });

  it('returns immutable canonical records', () => {
    const point = requireValue(createPlanetPoint(0, 0));
    expect(Object.isFrozen(point)).toBe(true);
  });
});

describe('regional coordinates and physical distance', () => {
  const quantizationCases = [
    [0.000_000_5, 1],
    [0.000_001_5, 2],
    [-0.000_000_5, -1],
    [-0.000_001_5, -2],
    [-0, 0],
  ] as const;

  for (const [kilometers, millimeters] of quantizationCases) {
    it(`quantizes ${String(kilometers)} km to ${String(millimeters)} mm`, () => {
      expect(createRegionalPoint(kilometers, 0)).toStrictEqual({
        ok: true,
        value: { xMillimeters: millimeters, yMillimeters: 0 },
      });
    });
  }

  it('validates persisted regional points without repairing them', () => {
    expect(parseRegionalPoint({ xMillimeters: 4, yMillimeters: -7 })).toMatchObject({ ok: true });
    expect(parseRegionalPoint({ xMillimeters: -0, yMillimeters: 0 })).toMatchObject({ ok: false });
    expect(parseRegionalPoint({ xMillimeters: 1.25, yMillimeters: 0 })).toMatchObject({
      ok: false,
    });
  });

  it('uses closed extent edges and rejects inverted or noncanonical extents', () => {
    const extent: RegionalExtent = requireValue(createRegionalExtent(-1_000, 1_000, -2_000, 2_000));
    const corner: RegionalPoint = requireValue(
      parseRegionalPoint({
        xMillimeters: 1_000,
        yMillimeters: 2_000,
      }),
    );
    const beyond: RegionalPoint = requireValue(
      parseRegionalPoint({
        xMillimeters: 1_001,
        yMillimeters: 2_000,
      }),
    );

    expect(regionalExtentContains(extent, corner)).toBe(true);
    expect(regionalExtentContains(extent, beyond)).toBe(false);
    expect(createRegionalExtent(1, -1, 0, 0)).toMatchObject({ ok: false });
    expect(
      parseRegionalExtent({
        minXMillimeters: -0,
        maxXMillimeters: 1,
        minYMillimeters: 0,
        maxYMillimeters: 1,
      }),
    ).toMatchObject({ ok: false });
  });

  it('distinguishes general distance from a positive safely projectable world radius', () => {
    expect(createPhysicalDistance(0)).toStrictEqual({
      ok: true,
      value: { distanceMillimeters: 0 },
    });
    const distance = requireValue(createPhysicalDistance(12.5));
    expect(physicalDistanceToKilometers(distance)).toBe(12.5);
    expect(
      parsePhysicalDistance({ distanceMillimeters: distance.distanceMillimeters }),
    ).toMatchObject({ ok: true });
    expect(parsePhysicalDistance({ distanceMillimeters: -0 })).toMatchObject({ ok: false });
    expect(createWorldRadius(0)).toMatchObject({ ok: false });

    const radius = requireValue(createWorldRadius(1_000));
    expect(worldRadiusToKilometers(radius)).toBe(1_000);
    expect(parseWorldRadius({ radiusMillimeters: radius.radiusMillimeters })).toMatchObject({
      ok: true,
    });
    expect(parseWorldRadius({ radiusMillimeters: -0 })).toMatchObject({ ok: false });
  });
});
