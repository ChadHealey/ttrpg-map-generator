import {
  createPlanetPoint,
  PLANET_ANGULAR_STEP_RAD,
  type PlanetPoint,
  planetPointToAngles,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import { runAtlasAlgorithmSpikeCase } from './atlas-algorithm-spike.js';
import { atlasAlgorithmSpikeContourAdapter } from './atlas-algorithm-spike-contours.js';
import {
  createAtlasAlgorithmSpikeField,
  MILESTONE_TWO_ATLAS_ALGORITHM_SPIKE_CASES,
  sampleAtlasAlgorithmSpikeField,
} from './atlas-algorithm-spike-field.js';
import {
  atlasAlgorithmSpikeTopologyAdapter,
  doesProposedRingCrossSeam,
} from './atlas-algorithm-spike-topology.js';
import {
  createAtlasContourLevel,
  getAtlasGridVertex,
  parseAtlasFieldValueTicks,
  quantizeAtlasFieldValue,
  WORLD_ATLAS_PREVIEW_PROFILE,
} from './atlas-sampling-profiles.js';
import type {
  ProposedPlanetRing,
  QuantizedPlanetFieldAdapter,
} from './geography-algorithm-adapters.js';

describe('Milestone 2 geography algorithm spike', () => {
  it('exercises all six accepted seed/control rows deterministically', () => {
    const reports = MILESTONE_TWO_ATLAS_ALGORITHM_SPIKE_CASES.map((spike) =>
      runAtlasAlgorithmSpikeCase(spike, WORLD_ATLAS_PREVIEW_PROFILE),
    );
    expect(reports.map(({ fixtureId }) => fixtureId)).toEqual(
      MILESTONE_TWO_ATLAS_ALGORITHM_SPIKE_CASES.map(({ fixtureId }) => fixtureId),
    );
    for (const report of reports) {
      expect(report.sampleCount).toBe(130_562);
      expect(report.ringCount).toBeGreaterThan(0);
      expect(report.landComponentCount).toBeGreaterThan(0);
      expect(report.waterComponentCount).toBeGreaterThan(0);
      expect(report.fieldFingerprint).toMatch(/^[0-9a-f]{16}$/u);
    }
    expect(runAtlasAlgorithmSpikeCase(defaultSpikeCase(), WORLD_ATLAS_PREVIEW_PROFILE)).toEqual(
      reports[0],
    );
  });

  it('evaluates the same physical seam point and canonical pole independently of chart longitude', () => {
    const adapter = createAtlasAlgorithmSpikeField(defaultSpikeCase());
    const positiveSeam = fixedPoint(Math.PI, 0.3);
    const negativeSeam = fixedPoint(-Math.PI, 0.3);
    expect(positiveSeam).toEqual(negativeSeam);
    expect(adapter.sample(positiveSeam)).toBe(adapter.sample(negativeSeam));

    const northAtPrime = fixedPoint(0, Math.PI / 2);
    const northAtQuarterTurn = fixedPoint(Math.PI / 2, Math.PI / 2);
    expect(northAtPrime).toEqual(northAtQuarterTurn);
    expect(adapter.sample(northAtPrime)).toBe(adapter.sample(northAtQuarterTurn));

    const east = adapter.sample(fixedPoint(Math.PI - PLANET_ANGULAR_STEP_RAD, 0.3));
    const west = adapter.sample(fixedPoint(-Math.PI + PLANET_ANGULAR_STEP_RAD, 0.3));
    expect(Math.abs(east - west)).toBeLessThanOrEqual(2);
  });

  it('extracts valid rings from a field centered across the horizontal seam', () => {
    const field = sampleAtlasAlgorithmSpikeField(
      WORLD_ATLAS_PREVIEW_PROFILE,
      analyticField((x) => -x - 0.72),
    );
    const contours = atlasAlgorithmSpikeContourAdapter.extract(field, zeroContourLevel());
    expect(contours.diagnostics).toEqual([]);
    expect(contours.rings).toHaveLength(1);
    expect(contours.rings.some(doesProposedRingCrossSeam)).toBe(true);
  });

  it('uses a single pole sample and triangular polar cells for a polar cap contour', () => {
    const field = sampleAtlasAlgorithmSpikeField(
      WORLD_ATLAS_PREVIEW_PROFILE,
      analyticField((_x, _y, z) => z - 0.72),
    );
    expect(field.valueAt(0, WORLD_ATLAS_PREVIEW_PROFILE.latitudeBandCount)).toBe(
      field.valueAt(511, WORLD_ATLAS_PREVIEW_PROFILE.latitudeBandCount),
    );
    const contours = atlasAlgorithmSpikeContourAdapter.extract(field, zeroContourLevel());
    expect(contours.diagnostics).toEqual([]);
    expect(contours.rings).toHaveLength(1);
    expect(contours.rings[0]?.points.every(({ latitudeTicks }) => latitudeTicks > 0)).toBe(true);
  });

  it('keeps both boundaries of a nested spherical annulus as valid separate rings', () => {
    const field = sampleAtlasAlgorithmSpikeField(
      WORLD_ATLAS_PREVIEW_PROFILE,
      analyticField((x) => 0.12 - Math.abs(x - 0.78)),
    );
    const contours = atlasAlgorithmSpikeContourAdapter.extract(field, zeroContourLevel());
    expect(contours.diagnostics).toEqual([]);
    expect(contours.rings).toHaveLength(2);
    expect(contours.rings.every((ring) => ring.points.length >= 3)).toBe(true);
  });

  it('rejects a self-intersecting quantized ring instead of repairing it silently', () => {
    const ring: ProposedPlanetRing = Object.freeze({
      points: Object.freeze([
        getAtlasGridVertex(WORLD_ATLAS_PREVIEW_PROFILE, 10, 100),
        getAtlasGridVertex(WORLD_ATLAS_PREVIEW_PROFILE, 20, 110),
        getAtlasGridVertex(WORLD_ATLAS_PREVIEW_PROFILE, 10, 110),
        getAtlasGridVertex(WORLD_ATLAS_PREVIEW_PROFILE, 20, 100),
      ]),
    });
    expect(atlasAlgorithmSpikeTopologyAdapter.validate([ring])).toEqual([
      expect.objectContaining({ code: 'geography.contour.self-intersection', ringIndex: 0 }),
    ]);
  });
});

function analyticField(
  sample: (x: number, y: number, z: number) => number,
): QuantizedPlanetFieldAdapter {
  return Object.freeze({
    algorithmId: 'spherical-basis-field',
    algorithmVersion: 1,
    sample(point: PlanetPoint) {
      const { longitudeRad, latitudeRad } = planetPointToAngles(point);
      const cosLatitude = Math.cos(latitudeRad);
      const value = Math.max(
        -1,
        Math.min(
          1,
          sample(
            cosLatitude * Math.cos(longitudeRad),
            cosLatitude * Math.sin(longitudeRad),
            Math.sin(latitudeRad),
          ),
        ),
      );
      const quantized = quantizeAtlasFieldValue(value);
      if (!quantized.ok) throw new Error(quantized.diagnostic.message);
      return quantized.value;
    },
  });
}

function zeroContourLevel() {
  const zero = parseAtlasFieldValueTicks(0);
  if (!zero.ok) throw new Error(zero.diagnostic.message);
  const level = createAtlasContourLevel(zero.value);
  if (!level.ok) throw new Error(level.diagnostic.message);
  return level.value;
}

function fixedPoint(longitudeRad: number, latitudeRad: number): PlanetPoint {
  const point = createPlanetPoint(longitudeRad, latitudeRad);
  if (!point.ok) throw new Error(point.diagnostic.message);
  return point.value;
}

function defaultSpikeCase() {
  const spike = MILESTONE_TWO_ATLAS_ALGORITHM_SPIKE_CASES[0];
  if (spike === undefined) throw new Error('The fixed atlas spike matrix is empty.');
  return spike;
}
