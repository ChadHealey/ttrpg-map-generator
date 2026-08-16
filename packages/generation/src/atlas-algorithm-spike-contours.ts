/** Exact-grid spherical contour prototype used to select the Milestone 2 algorithm family. */

import {
  parsePlanetPoint,
  PLANET_LATITUDE_MAX_TICKS,
  PLANET_LATITUDE_MIN_TICKS,
  PLANET_LONGITUDE_MIN_TICKS,
  PLANET_TICKS_PER_TURN,
  type PlanetPoint,
} from '@ttrpg-map/core';

import { atlasAlgorithmSpikeTopologyAdapter } from './atlas-algorithm-spike-topology.js';
import { type AtlasContourLevel } from './atlas-sampling-profiles.js';
import {
  GEOGRAPHY_ADAPTER_DIAGNOSTIC_CODES,
  type GeographyAdapterDiagnostic,
  type PlanetContourExtraction,
  type PlanetContourExtractionAdapter,
  type ProposedPlanetRing,
  type QuantizedSphericalField,
} from './geography-algorithm-adapters.js';

interface Segment {
  readonly start: PlanetPoint;
  readonly end: PlanetPoint;
}

const contourAdapterDefinition: PlanetContourExtractionAdapter = Object.freeze({
  algorithmId: 'spherical-marching-cells',
  algorithmVersion: 1,
  extract: extractContours,
});

export const atlasAlgorithmSpikeContourAdapter = contourAdapterDefinition;

function extractContours(
  field: QuantizedSphericalField,
  contourLevel: AtlasContourLevel,
): PlanetContourExtraction {
  const segments: Segment[] = [];
  const diagnostics: GeographyAdapterDiagnostic[] = [];
  const seenSegments = new Set<string>();

  addPolarBandSegments(field, contourLevel, 'south', segments, seenSegments, diagnostics);
  for (
    let latitudeIndex = 1;
    latitudeIndex < field.profile.latitudeBandCount - 1;
    latitudeIndex += 1
  ) {
    for (
      let longitudeIndex = 0;
      longitudeIndex < field.profile.longitudeCellCount;
      longitudeIndex += 1
    ) {
      addQuadSegments(
        field,
        contourLevel,
        longitudeIndex,
        latitudeIndex,
        segments,
        seenSegments,
        diagnostics,
      );
    }
  }
  addPolarBandSegments(field, contourLevel, 'north', segments, seenSegments, diagnostics);

  const rings = stitchSegments(segments, diagnostics);
  diagnostics.push(...atlasAlgorithmSpikeTopologyAdapter.validate(rings));
  return Object.freeze({
    rings: Object.freeze(rings),
    segmentCount: segments.length,
    diagnostics: Object.freeze(diagnostics),
  });
}

function addQuadSegments(
  field: QuantizedSphericalField,
  contourLevel: AtlasContourLevel,
  longitudeIndex: number,
  latitudeIndex: number,
  segments: Segment[],
  seenSegments: Set<string>,
  diagnostics: GeographyAdapterDiagnostic[],
): void {
  const eastIndex = (longitudeIndex + 1) % field.profile.longitudeCellCount;
  const longitudeStep = PLANET_TICKS_PER_TURN / field.profile.longitudeCellCount;
  const latitudeStep = PLANET_TICKS_PER_TURN / 2 / field.profile.latitudeBandCount;
  const westLongitude = PLANET_LONGITUDE_MIN_TICKS + longitudeIndex * longitudeStep;
  const eastLongitude = westLongitude + longitudeStep;
  const southLatitude = PLANET_LATITUDE_MIN_TICKS + latitudeIndex * latitudeStep;
  const northLatitude = southLatitude + latitudeStep;
  const southWestValue = field.valueAt(longitudeIndex, latitudeIndex);
  const southEastValue = field.valueAt(eastIndex, latitudeIndex);
  const northEastValue = field.valueAt(eastIndex, latitudeIndex + 1);
  const northWestValue = field.valueAt(longitudeIndex, latitudeIndex + 1);
  const values = [southWestValue, southEastValue, northEastValue, northWestValue] as const;
  const signs = values.map((value) => value * 2 - contourLevel);
  const intersections = new Map<number, PlanetPoint>();

  if (hasDifferentSigns(signs[0], signs[1])) {
    intersections.set(
      0,
      canonicalPoint(
        interpolateTick(westLongitude, eastLongitude, signs[0] ?? 0, signs[1] ?? 0),
        southLatitude,
      ),
    );
  }
  if (hasDifferentSigns(signs[1], signs[2])) {
    intersections.set(
      1,
      canonicalPoint(
        eastLongitude,
        interpolateTick(southLatitude, northLatitude, signs[1] ?? 0, signs[2] ?? 0),
      ),
    );
  }
  if (hasDifferentSigns(signs[2], signs[3])) {
    intersections.set(
      2,
      canonicalPoint(
        interpolateTick(eastLongitude, westLongitude, signs[2] ?? 0, signs[3] ?? 0),
        northLatitude,
      ),
    );
  }
  if (hasDifferentSigns(signs[3], signs[0])) {
    intersections.set(
      3,
      canonicalPoint(
        westLongitude,
        interpolateTick(northLatitude, southLatitude, signs[3] ?? 0, signs[0] ?? 0),
      ),
    );
  }

  if (intersections.size === 2) {
    const points = [...intersections.values()];
    addSegment(points[0], points[1], segments, seenSegments, diagnostics);
    return;
  }
  if (intersections.size !== 4) return;

  const determinant =
    BigInt(signs[0] ?? 0) * BigInt(signs[2] ?? 0) - BigInt(signs[1] ?? 0) * BigInt(signs[3] ?? 0);
  const pairs =
    determinant >= 0n
      ? ([
          [0, 1],
          [2, 3],
        ] as const)
      : ([
          [3, 0],
          [1, 2],
        ] as const);
  for (const [firstEdge, secondEdge] of pairs) {
    addSegment(
      intersections.get(firstEdge),
      intersections.get(secondEdge),
      segments,
      seenSegments,
      diagnostics,
    );
  }
}

function addPolarBandSegments(
  field: QuantizedSphericalField,
  contourLevel: AtlasContourLevel,
  pole: 'south' | 'north',
  segments: Segment[],
  seenSegments: Set<string>,
  diagnostics: GeographyAdapterDiagnostic[],
): void {
  const rowLatitudeIndex = pole === 'south' ? 1 : field.profile.latitudeBandCount - 1;
  const poleLatitudeIndex = pole === 'south' ? 0 : field.profile.latitudeBandCount;
  const poleValue = field.valueAt(0, poleLatitudeIndex);
  const poleLatitude = pole === 'south' ? PLANET_LATITUDE_MIN_TICKS : PLANET_LATITUDE_MAX_TICKS;
  const longitudeStep = PLANET_TICKS_PER_TURN / field.profile.longitudeCellCount;
  const latitudeStep = PLANET_TICKS_PER_TURN / 2 / field.profile.latitudeBandCount;
  const rowLatitude = PLANET_LATITUDE_MIN_TICKS + rowLatitudeIndex * latitudeStep;

  for (
    let longitudeIndex = 0;
    longitudeIndex < field.profile.longitudeCellCount;
    longitudeIndex += 1
  ) {
    const eastIndex = (longitudeIndex + 1) % field.profile.longitudeCellCount;
    const westLongitude = PLANET_LONGITUDE_MIN_TICKS + longitudeIndex * longitudeStep;
    const eastLongitude = westLongitude + longitudeStep;
    const westValue = field.valueAt(longitudeIndex, rowLatitudeIndex);
    const eastValue = field.valueAt(eastIndex, rowLatitudeIndex);
    const westSign = westValue * 2 - contourLevel;
    const eastSign = eastValue * 2 - contourLevel;
    const poleSign = poleValue * 2 - contourLevel;
    const crossings: PlanetPoint[] = [];

    if (hasDifferentSigns(westSign, eastSign)) {
      crossings.push(
        canonicalPoint(
          interpolateTick(westLongitude, eastLongitude, westSign, eastSign),
          rowLatitude,
        ),
      );
    }
    if (hasDifferentSigns(eastSign, poleSign)) {
      crossings.push(
        canonicalPoint(
          eastLongitude,
          interpolateTick(rowLatitude, poleLatitude, eastSign, poleSign),
        ),
      );
    }
    if (hasDifferentSigns(poleSign, westSign)) {
      crossings.push(
        canonicalPoint(
          westLongitude,
          interpolateTick(poleLatitude, rowLatitude, poleSign, westSign),
        ),
      );
    }
    if (crossings.length === 2) {
      addSegment(crossings[0], crossings[1], segments, seenSegments, diagnostics);
    }
  }
}

function addSegment(
  first: PlanetPoint | undefined,
  second: PlanetPoint | undefined,
  segments: Segment[],
  seenSegments: Set<string>,
  diagnostics: GeographyAdapterDiagnostic[],
): void {
  if (first === undefined || second === undefined) {
    throw new Error('Marching-cell edge lookup did not produce both segment endpoints.');
  }
  const firstKey = pointKey(first);
  const secondKey = pointKey(second);
  if (firstKey === secondKey) return;
  const key = edgeKey(firstKey, secondKey);
  if (seenSegments.has(key)) {
    diagnostics.push(
      Object.freeze({
        code: GEOGRAPHY_ADAPTER_DIAGNOSTIC_CODES.duplicateContourEdge,
        message: `Contour edge ${key} was emitted more than once.`,
      }),
    );
    return;
  }
  seenSegments.add(key);
  segments.push(Object.freeze({ start: first, end: second }));
}

function stitchSegments(
  segments: readonly Segment[],
  diagnostics: GeographyAdapterDiagnostic[],
): ProposedPlanetRing[] {
  const points = new Map<string, PlanetPoint>();
  const adjacency = new Map<string, string[]>();
  for (const segment of segments) {
    const startKey = pointKey(segment.start);
    const endKey = pointKey(segment.end);
    points.set(startKey, segment.start);
    points.set(endKey, segment.end);
    addNeighbor(adjacency, startKey, endKey);
    addNeighbor(adjacency, endKey, startKey);
  }
  for (const [key, neighbors] of adjacency) {
    neighbors.sort();
    if (neighbors.length !== 2) {
      diagnostics.push(
        Object.freeze({
          code: GEOGRAPHY_ADAPTER_DIAGNOSTIC_CODES.contourDegreeMismatch,
          message: `Contour vertex ${key} has degree ${String(neighbors.length)} instead of 2.`,
        }),
      );
    }
  }
  if (
    diagnostics.some(
      ({ code }) => code === GEOGRAPHY_ADAPTER_DIAGNOSTIC_CODES.contourDegreeMismatch,
    )
  ) {
    return [];
  }

  const usedEdges = new Set<string>();
  const rings: ProposedPlanetRing[] = [];
  for (const startKey of [...adjacency.keys()].sort()) {
    const startNeighbors = adjacency.get(startKey) ?? [];
    for (const initialNeighbor of startNeighbors) {
      if (usedEdges.has(edgeKey(startKey, initialNeighbor))) continue;
      const ringKeys = [startKey];
      let previous = startKey;
      let current = initialNeighbor;
      usedEdges.add(edgeKey(previous, current));
      while (current !== startKey && ringKeys.length <= segments.length) {
        ringKeys.push(current);
        const neighbors = adjacency.get(current) ?? [];
        const next = neighbors.find(
          (candidate) => candidate !== previous && !usedEdges.has(edgeKey(current, candidate)),
        );
        if (next === undefined) {
          diagnostics.push(
            Object.freeze({
              code: GEOGRAPHY_ADAPTER_DIAGNOSTIC_CODES.openContour,
              message: `Contour beginning at ${startKey} did not close.`,
            }),
          );
          break;
        }
        previous = current;
        current = next;
        usedEdges.add(edgeKey(previous, current));
      }
      if (current === startKey) {
        const ringPoints = ringKeys.map((key) => points.get(key)).filter(isPlanetPoint);
        rings.push(canonicalizeRing(ringPoints));
      }
    }
  }
  rings.sort((left, right) => compareRings(left, right));
  return rings;
}

function canonicalizeRing(points: readonly PlanetPoint[]): ProposedPlanetRing {
  if (points.length === 0) return Object.freeze({ points: Object.freeze([]) });
  const keys = points.map(pointKey);
  let minimumIndex = 0;
  for (let index = 1; index < keys.length; index += 1) {
    if ((keys[index] ?? '') < (keys[minimumIndex] ?? '')) minimumIndex = index;
  }
  const forward = Array.from(
    { length: points.length },
    (_, offset) => points[(minimumIndex + offset) % points.length],
  ).filter(isPlanetPoint);
  const reverse = Array.from(
    { length: points.length },
    (_, offset) => points[(minimumIndex - offset + points.length) % points.length],
  ).filter(isPlanetPoint);
  const chosen = comparePointSequences(forward, reverse) <= 0 ? forward : reverse;
  return Object.freeze({ points: Object.freeze(chosen) });
}

function interpolateTick(
  startCoordinate: number,
  endCoordinate: number,
  startSign: number,
  endSign: number,
): number {
  const numerator = BigInt(-startSign) * BigInt(endCoordinate - startCoordinate);
  const denominator = BigInt(endSign - startSign);
  return startCoordinate + divideRoundTiesAway(numerator, denominator);
}

function divideRoundTiesAway(numeratorInput: bigint, denominatorInput: bigint): number {
  if (denominatorInput === 0n) throw new RangeError('Contour interpolation needs distinct signs.');
  const isNegative = numeratorInput < 0n !== denominatorInput < 0n;
  const numerator = numeratorInput < 0n ? -numeratorInput : numeratorInput;
  const denominator = denominatorInput < 0n ? -denominatorInput : denominatorInput;
  let quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder * 2n >= denominator) quotient += 1n;
  const signed = isNegative ? -quotient : quotient;
  const value = Number(signed);
  if (!Number.isSafeInteger(value)) throw new RangeError('Interpolated contour tick is unsafe.');
  return value;
}

function canonicalPoint(longitudeTicksInput: number, latitudeTicks: number): PlanetPoint {
  let longitudeTicks = longitudeTicksInput;
  if (longitudeTicks === -PLANET_LONGITUDE_MIN_TICKS) {
    longitudeTicks = PLANET_LONGITUDE_MIN_TICKS;
  }
  if (latitudeTicks === PLANET_LATITUDE_MIN_TICKS || latitudeTicks === PLANET_LATITUDE_MAX_TICKS) {
    longitudeTicks = 0;
  }
  const point = parsePlanetPoint({ longitudeTicks, latitudeTicks });
  if (!point.ok) throw new Error(point.diagnostic.message);
  return point.value;
}

function hasDifferentSigns(first: number | undefined, second: number | undefined): boolean {
  return first !== undefined && second !== undefined && first > 0 !== second > 0;
}

function addNeighbor(adjacency: Map<string, string[]>, point: string, neighbor: string): void {
  const neighbors = adjacency.get(point);
  if (neighbors === undefined) adjacency.set(point, [neighbor]);
  else neighbors.push(neighbor);
}

function pointKey(point: PlanetPoint): string {
  const longitude = String(point.longitudeTicks - PLANET_LONGITUDE_MIN_TICKS).padStart(10, '0');
  const latitude = String(point.latitudeTicks - PLANET_LATITUDE_MIN_TICKS).padStart(10, '0');
  return `${longitude}:${latitude}`;
}

function edgeKey(first: string, second: string): string {
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

function compareRings(left: ProposedPlanetRing, right: ProposedPlanetRing): number {
  return comparePointSequences(left.points, right.points);
}

function comparePointSequences(
  left: readonly PlanetPoint[],
  right: readonly PlanetPoint[],
): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftPoint = left[index];
    const rightPoint = right[index];
    const leftKey = leftPoint === undefined ? '' : pointKey(leftPoint);
    const rightKey = rightPoint === undefined ? '' : pointKey(rightPoint);
    if (leftKey < rightKey) return -1;
    if (leftKey > rightKey) return 1;
  }
  return left.length - right.length;
}

function isPlanetPoint(point: PlanetPoint | undefined): point is PlanetPoint {
  return point !== undefined;
}
