import {
  createDeterministicRandomStream,
  createPlanetPoint,
  planetPointToAngles,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import { atlasMacroElevationParameters } from './atlas-land-water-generator-contract.js';
import { fixedAtlasInput } from './atlas-land-water-test-support.js';
import type { SampledAtlasMacroElevationField } from './atlas-macro-elevation-field.js';
import {
  ATLAS_SEPARATED_FIELD_MINIMUM_OCEAN_GAP_RAD,
  createSeparatedAtlasMacroElevationFieldAdapter,
  inspectSeparatedAtlasMacroField,
  type SeparatedAtlasMacroElevationFieldAdapter,
} from './atlas-macro-elevation-field-v2.js';
import {
  createAtlasContourLevel,
  getAtlasGridVertex,
  getAtlasSampleAnchorCount,
  quantizeAtlasFieldValue,
  WORLD_ATLAS_FULL_PROFILE,
  WORLD_ATLAS_PREVIEW_PROFILE,
} from './atlas-sampling-profiles.js';

describe('separated atlas macro elevation field v2', () => {
  it('constructs deterministic separated owners and remains identical at seam and poles', () => {
    const input = fixedAtlasInput(undefined, undefined, 2);
    const parameters = atlasMacroElevationParameters(input.controls, 2);
    const first = createSeparatedAtlasMacroElevationFieldAdapter(
      parameters,
      stream(input.macroElevationSeedMetadata),
    );
    const second = createSeparatedAtlasMacroElevationFieldAdapter(
      parameters,
      stream(input.macroElevationSeedMetadata),
    );
    expect(first.minimumOceanGapRad).toBeGreaterThanOrEqual(
      ATLAS_SEPARATED_FIELD_MINIMUM_OCEAN_GAP_RAD,
    );
    expect(first.ownerCount).toBe(input.controls.continentCountIntent);
    for (const [longitude, latitude] of [
      [-Math.PI, 0.31],
      [Math.PI, 0.31],
      [0, Math.PI / 2],
      [Math.PI / 2, Math.PI / 2],
      [0.7, -0.9],
    ] as const) {
      const point = createPlanetPoint(longitude, latitude);
      if (!point.ok) throw new Error(point.diagnostic.message);
      expect(first.sample(point.value)).toBe(second.sample(point.value));
    }
    const eastSeam = createPlanetPoint(Math.PI, 0.31);
    const westSeam = createPlanetPoint(-Math.PI, 0.31);
    const northPrime = createPlanetPoint(0, Math.PI / 2);
    const northQuarter = createPlanetPoint(Math.PI / 2, Math.PI / 2);
    if (!eastSeam.ok || !westSeam.ok || !northPrime.ok || !northQuarter.ok) {
      throw new Error('Fixed seam and pole probes must parse.');
    }
    expect(first.sample(eastSeam.value)).toBe(first.sample(westSeam.value));
    expect(first.sample(northPrime.value)).toBe(first.sample(northQuarter.value));
  });

  it('rejects a quantization-width gap and a sampled corridor owner', async () => {
    const land = ticks(0.8);
    const water = ticks(-0.8);
    const contour = createAtlasContourLevel(ticks(0));
    if (!contour.ok) throw new Error(contour.diagnostic.message);
    const field: SampledAtlasMacroElevationField = {
      profile: WORLD_ATLAS_PREVIEW_PROFILE,
      sampleCount: getAtlasSampleAnchorCount(WORLD_ATLAS_PREVIEW_PROFILE),
      valueAt(longitudeIndex, latitudeIndex) {
        return latitudeIndex === WORLD_ATLAS_PREVIEW_PROFILE.latitudeBandCount / 2 &&
          longitudeIndex >= 80 &&
          longitudeIndex <= 430
          ? land
          : water;
      },
      copyValues: () => [],
      compactValues: () => {
        throw new Error('The diagnostic does not request compact storage.');
      },
    };
    const adapter: SeparatedAtlasMacroElevationFieldAdapter = {
      algorithmId: 'separated-continent-envelope-field',
      algorithmVersion: 2,
      gapPolicyVersion: 1,
      shapePolicyVersion: 1,
      minimumOceanGapRad: 0.001,
      oceanFloorTicks: water,
      ownerCount: 1,
      sample: () => water,
      sampleCartesian: () => water,
      ownerIndexAtCartesian: () => 0,
      ownerShapeCoordinateAtCartesian: (_ownerIndex, x) => [x, 0],
      broadValueAtCartesian: () => land,
    };
    const result = await inspectSeparatedAtlasMacroField(adapter, field, contour.value);
    if (result.status !== 'completed') throw new Error('Inspection unexpectedly cancelled.');
    expect(result.report.findings.map(({ code }) => code)).toEqual([
      'atlas.macro-v2.gap-unsatisfied',
      'atlas.macro-v2.owner-shape-unsatisfied',
    ]);
  });

  it.each([
    ['one full-profile anchor', (Math.PI * 2) / WORLD_ATLAS_FULL_PROFILE.longitudeCellCount],
    ['sub-anchor quantization-only', Math.PI / WORLD_ATLAS_FULL_PROFILE.longitudeCellCount],
  ])('rejects a %s owner gap during full-profile verification', async (_name, minimumGapRad) => {
    const water = ticks(-0.8);
    const contour = createAtlasContourLevel(ticks(0));
    if (!contour.ok) throw new Error(contour.diagnostic.message);
    const field: SampledAtlasMacroElevationField = {
      profile: WORLD_ATLAS_FULL_PROFILE,
      sampleCount: getAtlasSampleAnchorCount(WORLD_ATLAS_FULL_PROFILE),
      valueAt: () => water,
      copyValues: () => [],
      compactValues: () => {
        throw new Error('The diagnostic does not request compact storage.');
      },
    };
    const adapter: SeparatedAtlasMacroElevationFieldAdapter = {
      algorithmId: 'separated-continent-envelope-field',
      algorithmVersion: 2,
      gapPolicyVersion: 1,
      shapePolicyVersion: 1,
      minimumOceanGapRad: minimumGapRad,
      oceanFloorTicks: water,
      ownerCount: 2,
      sample: () => water,
      sampleCartesian: () => water,
      ownerIndexAtCartesian: () => undefined,
      ownerShapeCoordinateAtCartesian: () => [0, 0],
      broadValueAtCartesian: () => water,
    };
    const result = await inspectSeparatedAtlasMacroField(adapter, field, contour.value);
    if (result.status !== 'completed') throw new Error('Inspection unexpectedly cancelled.');
    expect(result.report.findings.map(({ code }) => code)).toContain(
      'atlas.macro-v2.gap-unsatisfied',
    );
  });

  it('rejects a symmetric chain of substantial lobes joined by narrow necks', async () => {
    const land = ticks(0.8);
    const water = ticks(-0.8);
    const contour = createAtlasContourLevel(ticks(0));
    if (!contour.ok) throw new Error(contour.diagnostic.message);
    const field = syntheticCartesianField(
      (x, z) => {
        const radius = Math.hypot(x, z);
        if (Math.abs(radius - 0.55) <= 0.025) return true;
        for (let index = 0; index < 6; index += 1) {
          const bearing = (index * Math.PI * 2) / 6;
          if (Math.hypot(x - 0.55 * Math.cos(bearing), z - 0.55 * Math.sin(bearing)) <= 0.13) {
            return true;
          }
        }
        return false;
      },
      land,
      water,
    );
    const adapter: SeparatedAtlasMacroElevationFieldAdapter = {
      algorithmId: 'separated-continent-envelope-field',
      algorithmVersion: 2,
      gapPolicyVersion: 1,
      shapePolicyVersion: 1,
      minimumOceanGapRad: ATLAS_SEPARATED_FIELD_MINIMUM_OCEAN_GAP_RAD,
      oceanFloorTicks: water,
      ownerCount: 1,
      sample: () => water,
      sampleCartesian: () => water,
      ownerIndexAtCartesian: () => 0,
      ownerShapeCoordinateAtCartesian: (_ownerIndex, x, _y, z) => [x, z],
      broadValueAtCartesian: () => land,
    };
    const result = await inspectSeparatedAtlasMacroField(adapter, field, contour.value);
    if (result.status !== 'completed') throw new Error('Inspection unexpectedly cancelled.');
    expect(result.report.findings.map(({ code }) => code)).toEqual([
      'atlas.macro-v2.owner-shape-unsatisfied',
    ]);
  });
});

function syntheticCartesianField(
  isLand: (x: number, z: number) => boolean,
  land: ReturnType<typeof ticks>,
  water: ReturnType<typeof ticks>,
): SampledAtlasMacroElevationField {
  return {
    profile: WORLD_ATLAS_PREVIEW_PROFILE,
    sampleCount: getAtlasSampleAnchorCount(WORLD_ATLAS_PREVIEW_PROFILE),
    valueAt(longitudeIndex, latitudeIndex) {
      const point = getAtlasGridVertex(WORLD_ATLAS_PREVIEW_PROFILE, longitudeIndex, latitudeIndex);
      const { longitudeRad, latitudeRad } = planetPointToAngles(point);
      const x = Math.cos(latitudeRad) * Math.cos(longitudeRad);
      return isLand(x, Math.sin(latitudeRad)) ? land : water;
    },
    copyValues: () => [],
    compactValues: () => {
      throw new Error('The diagnostic does not request compact storage.');
    },
  };
}

function stream(input: Parameters<typeof createDeterministicRandomStream>[0]) {
  const result = createDeterministicRandomStream(input);
  if (!result.ok) throw new Error(result.diagnostic.message);
  return result.value;
}

function ticks(value: number) {
  const result = quantizeAtlasFieldValue(value);
  if (!result.ok) throw new Error(result.diagnostic.message);
  return result.value;
}
