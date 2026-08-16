import {
  parsePlanetPoint,
  PLANET_LONGITUDE_MIN_TICKS,
  type PlanetPoint,
  planetPointToAngles,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import { sampleAtlasAlgorithmSpikeField } from './atlas-algorithm-spike-field.js';
import { atlasPlanetContourExtractionAdapter } from './atlas-coastline-contours.js';
import { simplifyAtlasCoastlineRing } from './atlas-coastline-simplification.js';
import {
  atlasPlanetTopologyValidationAdapter,
  unwrapPlanetRing,
} from './atlas-coastline-topology.js';
import {
  createAtlasContourLevel,
  parseAtlasFieldValueTicks,
  quantizeAtlasFieldValue,
  WORLD_ATLAS_FULL_PROFILE,
  WORLD_ATLAS_PREVIEW_PROFILE,
} from './atlas-sampling-profiles.js';
import type {
  ProposedPlanetRing,
  QuantizedPlanetFieldAdapter,
} from './geography-algorithm-adapters.js';

describe('canonical coastline adversarial geometry', () => {
  it('keeps a deterministic matrix of ordinary, seam, and near-pole caps valid', () => {
    const centers = [
      [-Math.PI + 0.02, 0],
      [Math.PI - 0.02, 0.4],
      [-2.1, -0.8],
      [-1.2, 0.7],
      [-0.3, -0.4],
      [0.6, 0.2],
      [1.5, -0.9],
      [2.4, 0.8],
      [0, 1.45],
      [0, -1.45],
    ] as const;
    for (const [longitude, latitude] of centers) {
      const cosLatitude = Math.cos(latitude);
      const center = [
        cosLatitude * Math.cos(longitude),
        cosLatitude * Math.sin(longitude),
        Math.sin(latitude),
      ] as const;
      const contours = extract(
        (x, y, z) => x * center[0] + y * center[1] + z * center[2] - Math.cos(0.16),
      );
      expect(contours.diagnostics).toStrictEqual([]);
      expect(contours.rings).toHaveLength(1);
      expect(required(contours.rings[0]).points.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps seam crossings continuous with complete source provenance', () => {
    const contours = extract((x) => -x - 0.72);
    expect(contours.diagnostics).toStrictEqual([]);
    expect(contours.rings).toHaveLength(1);
    const ring = required(contours.rings[0]);
    expect(ring.sourceTransitions).toHaveLength(ring.points.length);
    expect(ring.leftLandSampleIndices).toHaveLength(ring.points.length);
    expect(
      ring.points.some((point, index) => {
        const next = ring.points[(index + 1) % ring.points.length];
        return next !== undefined && Math.abs(point.longitudeTicks - next.longitudeTicks) > 2 ** 31;
      }),
    ).toBe(true);
  });

  it('uses one explicit polar cap loop without duplicate pole vertices', () => {
    const contours = extract((_x, _y, z) => z - 0.72);
    expect(contours.diagnostics).toStrictEqual([]);
    expect(contours.rings).toHaveLength(1);
    const ring = required(contours.rings[0]);
    expect(new Set(ring.points.map(tickKey)).size).toBe(ring.points.length);
    expect(ring.points.every(({ latitudeTicks }) => latitudeTicks > 0)).toBe(true);
  });

  it('winds the outer and hole boundaries of a nested annulus in opposite directions', () => {
    const contours = extract((x) => 0.12 - Math.abs(x - 0.78));
    expect(contours.diagnostics).toStrictEqual([]);
    expect(contours.rings).toHaveLength(2);
    const signedAreas = contours.rings.map(signedArea);
    expect(signedAreas.some((area) => area > 0n)).toBe(true);
    expect(signedAreas.some((area) => area < 0n)).toBe(true);
  });

  it('retains a very small classified island as its own valid loop', () => {
    const contours = extract((x, y, z) => 0.04 - Math.hypot(x - 1, y, z));
    expect(contours.diagnostics).toStrictEqual([]);
    expect(contours.rings).toHaveLength(1);
    expect(required(contours.rings[0]).points.length).toBeGreaterThanOrEqual(3);
  });

  it('removes a bounded vertex only when its ear contains no classification anchor', () => {
    const removable = ring([
      [100_000, 100_000],
      [1_000_000, 200_000],
      [2_000_000, 100_000],
      [2_000_000, 1_500_000],
      [100_000, 1_500_000],
    ]);
    const guardedChannel = ring([
      [-1_000_000, -100_000],
      [0, 100_000],
      [1_000_000, -100_000],
      [1_000_000, 1_500_000],
      [-1_000_000, 1_500_000],
    ]);
    const simplified = simplifyAtlasCoastlineRing(removable, WORLD_ATLAS_FULL_PROFILE);
    expect(simplified.removedPointCount).toBe(1);
    expect(simplified.ring.points).toHaveLength(4);
    expect(
      simplifyAtlasCoastlineRing(guardedChannel, WORLD_ATLAS_FULL_PROFILE).removedPointCount,
    ).toBe(0);
  });

  it('protects seam anchors and never collapses a three-point retained island', () => {
    const seam = ring([
      [PLANET_LONGITUDE_MIN_TICKS + 500_000, -500_000],
      [PLANET_LONGITUDE_MIN_TICKS, 0],
      [2 ** 31 - 500_000, 500_000],
      [2 ** 31 - 1_000_000, -500_000],
    ]);
    const island = ring([
      [100_000, 100_000],
      [300_000, 200_000],
      [200_000, 400_000],
    ]);
    expect(simplifyAtlasCoastlineRing(seam, WORLD_ATLAS_FULL_PROFILE).ring.points).toContainEqual(
      point(PLANET_LONGITUDE_MIN_TICKS, 0),
    );
    expect(simplifyAtlasCoastlineRing(island, WORLD_ATLAS_FULL_PROFILE)).toStrictEqual({
      ring: island,
      removedPointCount: 0,
    });
  });

  it('rejects self-intersection and intersection between separately valid rings', () => {
    const bowTie = ring([
      [100_000, 100_000],
      [900_000, 900_000],
      [100_000, 900_000],
      [900_000, 100_000],
    ]);
    const first = ring([
      [100_000, 100_000],
      [900_000, 100_000],
      [500_000, 900_000],
    ]);
    const second = ring([
      [100_000, 700_000],
      [900_000, 700_000],
      [500_000, -100_000],
    ]);
    expect(atlasPlanetTopologyValidationAdapter.validate([bowTie])).toEqual([
      expect.objectContaining({ code: 'geography.contour.self-intersection' }),
    ]);
    expect(atlasPlanetTopologyValidationAdapter.validate([first, second])).toEqual([
      expect.objectContaining({ code: 'geography.contour.ring-intersection' }),
    ]);
  });
});

function extract(sample: (x: number, y: number, z: number) => number) {
  const field = sampleAtlasAlgorithmSpikeField(WORLD_ATLAS_PREVIEW_PROFILE, analyticField(sample));
  return atlasPlanetContourExtractionAdapter.extract(field, zeroContourLevel());
}

function analyticField(
  sample: (x: number, y: number, z: number) => number,
): QuantizedPlanetFieldAdapter {
  return Object.freeze({
    algorithmId: 'spherical-basis-field',
    algorithmVersion: 1,
    sample(value: PlanetPoint) {
      const { longitudeRad, latitudeRad } = planetPointToAngles(value);
      const cosLatitude = Math.cos(latitudeRad);
      const quantized = quantizeAtlasFieldValue(
        Math.max(
          -1,
          Math.min(
            1,
            sample(
              cosLatitude * Math.cos(longitudeRad),
              cosLatitude * Math.sin(longitudeRad),
              Math.sin(latitudeRad),
            ),
          ),
        ),
      );
      if (!quantized.ok) throw new Error(quantized.diagnostic.message);
      return quantized.value;
    },
  });
}

function zeroContourLevel() {
  const zero = parseAtlasFieldValueTicks(0);
  if (!zero.ok) throw new Error(zero.diagnostic.message);
  const contour = createAtlasContourLevel(zero.value);
  if (!contour.ok) throw new Error(contour.diagnostic.message);
  return contour.value;
}

function ring(points: readonly (readonly [number, number])[]): ProposedPlanetRing {
  return Object.freeze({ points: Object.freeze(points.map(([x, y]) => point(x, y))) });
}

function point(longitudeTicks: number, latitudeTicks: number): PlanetPoint {
  const parsed = parsePlanetPoint({ longitudeTicks, latitudeTicks });
  if (!parsed.ok) throw new Error(parsed.diagnostic.message);
  return parsed.value;
}

function signedArea(value: ProposedPlanetRing): bigint {
  const points = unwrapPlanetRing(value);
  let doubledArea = 0n;
  for (let index = 0; index < points.length - 1; index += 1) {
    const first = required(points[index]);
    const second = required(points[index + 1]);
    doubledArea +=
      BigInt(first.longitudeTicks) * BigInt(second.latitudeTicks) -
      BigInt(second.longitudeTicks) * BigInt(first.latitudeTicks);
  }
  return doubledArea;
}

function tickKey(value: PlanetPoint): string {
  return `${String(value.longitudeTicks)}:${String(value.latitudeTicks)}`;
}

function required<Value>(value: Value | undefined): Value {
  if (value === undefined) throw new Error('Expected adversarial fixture value.');
  return value;
}
