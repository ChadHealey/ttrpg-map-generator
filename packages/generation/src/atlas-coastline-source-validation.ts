/** Source-ownership, adjacency-coverage, and raw-winding proofs for canonical coastlines. */

import {
  type AtlasSemanticGeographyRecords,
  forEachAtlasSurfaceNeighbor,
  type LandWaterSampleReader,
  PLANET_LATITUDE_MAX_TICKS,
  PLANET_LATITUDE_MIN_TICKS,
  PLANET_TICKS_PER_TURN,
} from '@ttrpg-map/core';

import { exactOrientation, unwrapPlanetRing } from './atlas-coastline-topology.js';
import { WORLD_ATLAS_FULL_PROFILE } from './atlas-sampling-profiles.js';
import type { ProposedPlanetRing } from './geography-algorithm-adapters.js';

export interface AtlasCoastlineSourceMaps {
  readonly landBySample: Int32Array;
  readonly waterBySample: Int32Array;
}

export function buildAtlasCoastlineSourceMaps(
  records: AtlasSemanticGeographyRecords,
): AtlasCoastlineSourceMaps {
  const sampleCount = records.landWaterClassification.samples.length;
  const landBySample = new Int32Array(sampleCount);
  const waterBySample = new Int32Array(sampleCount);
  landBySample.fill(-1);
  waterBySample.fill(-1);
  records.landmasses.forEach((landmass, entityIndex) => {
    fillMembership(landBySample, landmass.membership.sampleRanges, entityIndex);
  });
  records.waterBodies.forEach((waterBody, entityIndex) => {
    fillMembership(waterBySample, waterBody.membership.sampleRanges, entityIndex);
  });
  return Object.freeze({ landBySample, waterBySample });
}

export function validateAtlasCoastlineSourceCoverage(
  samples: LandWaterSampleReader,
  rings: readonly ProposedPlanetRing[],
): boolean {
  const expected = new Set<string>();
  for (let index = 0; index < samples.length; index += 1) {
    if (samples.at(index) !== 'land') continue;
    forEachAtlasSurfaceNeighbor(index, (neighborIndex) => {
      if (samples.at(neighborIndex) === 'water') expected.add(transitionKey(index, neighborIndex));
    });
  }
  const actual = new Set<string>();
  for (const ring of rings) {
    if (ring.sourceTransitions === undefined) return false;
    for (const transition of ring.sourceTransitions) {
      const key = transitionKey(transition.landSampleIndex, transition.waterSampleIndex);
      if (actual.has(key)) return false;
      actual.add(key);
    }
  }
  return actual.size === expected.size && [...actual].every((key) => expected.has(key));
}

export function validateAtlasRawCoastlineWinding(rings: readonly ProposedPlanetRing[]): boolean {
  for (const ring of rings) {
    if (ring.leftLandSampleIndices?.length !== ring.points.length) return false;
    const unwrapped = unwrapPlanetRing(ring);
    for (let index = 0; index < ring.points.length; index += 1) {
      const start = unwrapped[index];
      const end = unwrapped[index + 1];
      const landIndex = ring.leftLandSampleIndices[index];
      const land = landIndex === undefined ? undefined : samplePoint(landIndex);
      if (start === undefined || end === undefined || land === undefined) return false;
      if (
        land.latitudeTicks === PLANET_LATITUDE_MIN_TICKS ||
        land.latitudeTicks === PLANET_LATITUDE_MAX_TICKS
      ) {
        continue;
      }
      const alignedLand = alignLongitude(land, (start.longitudeTicks + end.longitudeTicks) / 2);
      if (exactOrientation(start, end, alignedLand) <= 0n) return false;
    }
  }
  return true;
}

function fillMembership(
  output: Int32Array,
  ranges: readonly Readonly<{ startIndex: number; endIndexExclusive: number }>[],
  entityIndex: number,
): void {
  for (const { startIndex, endIndexExclusive } of ranges)
    output.fill(entityIndex, startIndex, endIndexExclusive);
}

function samplePoint(index: number): Readonly<{ longitudeTicks: number; latitudeTicks: number }> {
  if (index === 0)
    return Object.freeze({ longitudeTicks: 0, latitudeTicks: PLANET_LATITUDE_MIN_TICKS });
  const northPoleIndex =
    WORLD_ATLAS_FULL_PROFILE.longitudeCellCount * (WORLD_ATLAS_FULL_PROFILE.latitudeBandCount - 1) +
    1;
  if (index === northPoleIndex) {
    return Object.freeze({ longitudeTicks: 0, latitudeTicks: PLANET_LATITUDE_MAX_TICKS });
  }
  const offset = index - 1;
  const latitudeIndex = Math.floor(offset / WORLD_ATLAS_FULL_PROFILE.longitudeCellCount) + 1;
  const longitudeIndex = offset % WORLD_ATLAS_FULL_PROFILE.longitudeCellCount;
  const longitudeStep = PLANET_TICKS_PER_TURN / WORLD_ATLAS_FULL_PROFILE.longitudeCellCount;
  const latitudeStep = PLANET_TICKS_PER_TURN / 2 / WORLD_ATLAS_FULL_PROFILE.latitudeBandCount;
  return Object.freeze({
    longitudeTicks: -PLANET_TICKS_PER_TURN / 2 + longitudeIndex * longitudeStep,
    latitudeTicks: PLANET_LATITUDE_MIN_TICKS + latitudeIndex * latitudeStep,
  });
}

function alignLongitude(
  point: Readonly<{ longitudeTicks: number; latitudeTicks: number }>,
  targetLongitude: number,
): Readonly<{ longitudeTicks: number; latitudeTicks: number }> {
  const shift = Math.round((targetLongitude - point.longitudeTicks) / PLANET_TICKS_PER_TURN);
  return Object.freeze({
    longitudeTicks: point.longitudeTicks + shift * PLANET_TICKS_PER_TURN,
    latitudeTicks: point.latitudeTicks,
  });
}

function transitionKey(landSampleIndex: number, waterSampleIndex: number): string {
  return `${String(landSampleIndex)}:${String(waterSampleIndex)}`;
}
