/**
 * Version-1 spherical marching-cell coastline extraction selected by ADR-0009.
 *
 * Segments are oriented in their local unwrapped cell so every ring keeps land on the left.
 * Each point also retains the exact classified sample transition that produced it.
 */

import {
  PLANET_LATITUDE_MAX_TICKS,
  PLANET_LATITUDE_MIN_TICKS,
  PLANET_LONGITUDE_MIN_TICKS,
  PLANET_TICKS_PER_TURN,
  type PlanetPoint,
} from '@ttrpg-map/core';

import {
  addContourOutgoing,
  canonicalContourPoint,
  compareContourRings,
  contourEdgeKey,
  type ContourLocalPoint,
  contourOrientation,
  contourPointKey,
  contourStorageIndex,
  contourVertexKey,
  hasDifferentContourSigns,
  interpolateContourTick,
  isContourNumber,
  isContourPlanetPoint,
  isContourTransition,
} from './atlas-coastline-contour-geometry.js';
import { atlasPlanetTopologyValidationAdapter } from './atlas-coastline-topology.js';
import type { AtlasContourLevel } from './atlas-sampling-profiles.js';
import {
  GEOGRAPHY_ADAPTER_DIAGNOSTIC_CODES,
  type GeographyAdapterDiagnostic,
  type PlanetContourExtraction,
  type PlanetContourExtractionAdapter,
  type ProposedCoastlineBoundaryTransition,
  type ProposedPlanetRing,
  type QuantizedSphericalField,
} from './geography-algorithm-adapters.js';

interface CellVertex extends ContourLocalPoint {
  readonly isLand: boolean;
  readonly sampleIndex: number;
}

interface Crossing extends ContourLocalPoint {
  readonly point: PlanetPoint;
  readonly transition: ProposedCoastlineBoundaryTransition;
}

interface Segment {
  readonly start: Crossing;
  readonly end: Crossing;
  readonly leftLandSampleIndex: number;
}

const contourAdapterDefinition: PlanetContourExtractionAdapter = Object.freeze({
  algorithmId: 'spherical-marching-cells',
  algorithmVersion: 1,
  extract: extractContours,
});

export const atlasPlanetContourExtractionAdapter = contourAdapterDefinition;

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
  diagnostics.push(...atlasPlanetTopologyValidationAdapter.validate(rings));
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
  const sampleIndices = [
    contourStorageIndex(field, longitudeIndex, latitudeIndex),
    contourStorageIndex(field, eastIndex, latitudeIndex),
    contourStorageIndex(field, eastIndex, latitudeIndex + 1),
    contourStorageIndex(field, longitudeIndex, latitudeIndex + 1),
  ] as const;
  const values = [
    field.valueAt(longitudeIndex, latitudeIndex),
    field.valueAt(eastIndex, latitudeIndex),
    field.valueAt(eastIndex, latitudeIndex + 1),
    field.valueAt(longitudeIndex, latitudeIndex + 1),
  ] as const;
  const signs = values.map((value) => value * 2 - contourLevel);
  const vertices: readonly CellVertex[] = [
    vertex(westLongitude, southLatitude, signs[0] ?? 0, sampleIndices[0]),
    vertex(eastLongitude, southLatitude, signs[1] ?? 0, sampleIndices[1]),
    vertex(eastLongitude, northLatitude, signs[2] ?? 0, sampleIndices[2]),
    vertex(westLongitude, northLatitude, signs[3] ?? 0, sampleIndices[3]),
  ];
  const intersections = new Map<number, Crossing>();
  addCrossing(intersections, 0, vertices[0], vertices[1], signs[0], signs[1]);
  addCrossing(intersections, 1, vertices[1], vertices[2], signs[1], signs[2]);
  addCrossing(intersections, 2, vertices[2], vertices[3], signs[2], signs[3]);
  addCrossing(intersections, 3, vertices[3], vertices[0], signs[3], signs[0]);

  if (intersections.size === 2) {
    const entries = [...intersections.entries()];
    addOrientedSegment(entries[0], entries[1], vertices, segments, seenSegments, diagnostics);
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
    addOrientedSegment(
      [firstEdge, intersections.get(firstEdge)],
      [secondEdge, intersections.get(secondEdge)],
      vertices,
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
  const poleIndex = contourStorageIndex(field, 0, poleLatitudeIndex);

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
    const signs = [
      westValue * 2 - contourLevel,
      eastValue * 2 - contourLevel,
      poleValue * 2 - contourLevel,
    ] as const;
    const vertices: readonly CellVertex[] = [
      vertex(
        westLongitude,
        rowLatitude,
        signs[0],
        contourStorageIndex(field, longitudeIndex, rowLatitudeIndex),
      ),
      vertex(
        eastLongitude,
        rowLatitude,
        signs[1],
        contourStorageIndex(field, eastIndex, rowLatitudeIndex),
      ),
      vertex((westLongitude + eastLongitude) / 2, poleLatitude, signs[2], poleIndex),
    ];
    const intersections = new Map<number, Crossing>();
    const poleVertex = vertices[2];
    if (poleVertex === undefined) throw new Error('Polar contour cell is incomplete.');
    addCrossing(intersections, 0, vertices[0], vertices[1], signs[0], signs[1]);
    addCrossing(
      intersections,
      1,
      vertices[1],
      { ...poleVertex, longitudeTicks: eastLongitude },
      signs[1],
      signs[2],
    );
    addCrossing(
      intersections,
      2,
      { ...poleVertex, longitudeTicks: westLongitude },
      vertices[0],
      signs[2],
      signs[0],
    );
    const entries = [...intersections.entries()];
    if (entries.length === 2) {
      addOrientedSegment(entries[0], entries[1], vertices, segments, seenSegments, diagnostics);
    }
  }
}

function vertex(
  longitudeTicks: number,
  latitudeTicks: number,
  sign: number,
  sampleIndex: number,
): CellVertex {
  return Object.freeze({ longitudeTicks, latitudeTicks, isLand: sign > 0, sampleIndex });
}

function addCrossing(
  crossings: Map<number, Crossing>,
  edgeIndex: number,
  first: CellVertex | undefined,
  second: CellVertex | undefined,
  firstSign: number | undefined,
  secondSign: number | undefined,
): void {
  if (
    first === undefined ||
    second === undefined ||
    firstSign === undefined ||
    secondSign === undefined ||
    !hasDifferentContourSigns(firstSign, secondSign)
  ) {
    return;
  }
  const longitudeTicks = interpolateContourTick(
    first.longitudeTicks,
    second.longitudeTicks,
    firstSign,
    secondSign,
  );
  const latitudeTicks = interpolateContourTick(
    first.latitudeTicks,
    second.latitudeTicks,
    firstSign,
    secondSign,
  );
  const land = first.isLand ? first.sampleIndex : second.sampleIndex;
  const water = first.isLand ? second.sampleIndex : first.sampleIndex;
  crossings.set(
    edgeIndex,
    Object.freeze({
      longitudeTicks,
      latitudeTicks,
      point: canonicalContourPoint(longitudeTicks, latitudeTicks),
      transition: Object.freeze({ landSampleIndex: land, waterSampleIndex: water }),
    }),
  );
}

function addOrientedSegment(
  firstEntry: readonly [number, Crossing | undefined] | undefined,
  secondEntry: readonly [number, Crossing | undefined] | undefined,
  vertices: readonly CellVertex[],
  segments: Segment[],
  seenSegments: Set<string>,
  diagnostics: GeographyAdapterDiagnostic[],
): void {
  const first = firstEntry?.[1];
  const second = secondEntry?.[1];
  const firstEdge = firstEntry?.[0];
  const secondEdge = secondEntry?.[0];
  if (
    first === undefined ||
    second === undefined ||
    firstEdge === undefined ||
    secondEdge === undefined
  ) {
    throw new Error('Marching-cell edge lookup did not produce both segment endpoints.');
  }
  const isolated = sharedVertex(firstEdge, secondEdge, vertices.length);
  const reference =
    isolated === undefined ? vertices.find(({ isLand }) => isLand) : vertices[isolated];
  if (reference === undefined) throw new Error('Contour segment has no land-side reference.');
  const side = contourOrientation(first, second, reference);
  const landIsLeft = reference.isLand ? side > 0n : side < 0n;
  const leftLandSampleIndex = reference.isLand
    ? reference.sampleIndex
    : vertices.find(({ isLand }) => isLand)?.sampleIndex;
  if (leftLandSampleIndex === undefined) throw new Error('Contour segment has no land sample.');
  addSegment(
    landIsLeft ? first : second,
    landIsLeft ? second : first,
    leftLandSampleIndex,
    segments,
    seenSegments,
    diagnostics,
  );
}

function sharedVertex(
  firstEdge: number,
  secondEdge: number,
  vertexCount: number,
): number | undefined {
  const firstVertices = [firstEdge, (firstEdge + 1) % vertexCount];
  const secondVertices = [secondEdge, (secondEdge + 1) % vertexCount];
  return firstVertices.find((candidate) => secondVertices.includes(candidate));
}

function addSegment(
  first: Crossing,
  second: Crossing,
  leftLandSampleIndex: number,
  segments: Segment[],
  seenSegments: Set<string>,
  diagnostics: GeographyAdapterDiagnostic[],
): void {
  const firstKey = contourPointKey(first.point);
  const secondKey = contourPointKey(second.point);
  if (firstKey === secondKey) return;
  const key = contourEdgeKey(firstKey, secondKey);
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
  segments.push(Object.freeze({ start: first, end: second, leftLandSampleIndex }));
}

function stitchSegments(
  segments: readonly Segment[],
  diagnostics: GeographyAdapterDiagnostic[],
): ProposedPlanetRing[] {
  const outgoing = new Map<string, Segment[]>();
  const incoming = new Map<string, number>();
  for (const segment of segments) {
    addContourOutgoing(outgoing, contourPointKey(segment.start.point), segment);
    const endKey = contourPointKey(segment.end.point);
    incoming.set(endKey, (incoming.get(endKey) ?? 0) + 1);
  }
  for (const key of new Set([...outgoing.keys(), ...incoming.keys()])) {
    const outDegree = outgoing.get(key)?.length ?? 0;
    const inDegree = incoming.get(key) ?? 0;
    if (outDegree !== 1 || inDegree !== 1) {
      diagnostics.push(
        Object.freeze({
          code: GEOGRAPHY_ADAPTER_DIAGNOSTIC_CODES.contourDegreeMismatch,
          message: `Contour vertex ${key} has directed degree ${String(inDegree)}/${String(outDegree)} instead of 1/1.`,
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

  const usedStarts = new Set<string>();
  const rings: ProposedPlanetRing[] = [];
  for (const startKey of [...outgoing.keys()].sort()) {
    if (usedStarts.has(startKey)) continue;
    const points: PlanetPoint[] = [];
    const transitions: ProposedCoastlineBoundaryTransition[] = [];
    const leftLandSampleIndices: number[] = [];
    let current = startKey;
    while (!usedStarts.has(current) && points.length <= segments.length) {
      const segment = outgoing.get(current)?.[0];
      if (segment === undefined) break;
      usedStarts.add(current);
      points.push(segment.start.point);
      transitions.push(segment.start.transition);
      leftLandSampleIndices.push(segment.leftLandSampleIndex);
      current = contourPointKey(segment.end.point);
    }
    if (current !== startKey) {
      diagnostics.push(
        Object.freeze({
          code: GEOGRAPHY_ADAPTER_DIAGNOSTIC_CODES.openContour,
          message: `Contour beginning at ${startKey} did not close.`,
        }),
      );
      continue;
    }
    rings.push(canonicalizeRing(points, transitions, leftLandSampleIndices));
  }
  rings.sort(compareContourRings);
  return rings;
}

function canonicalizeRing(
  points: readonly PlanetPoint[],
  transitions: readonly ProposedCoastlineBoundaryTransition[],
  leftLandSampleIndices: readonly number[],
): ProposedPlanetRing {
  if (points.length === 0) {
    return Object.freeze({
      points: Object.freeze([]),
      sourceTransitions: Object.freeze([]),
      leftLandSampleIndices: Object.freeze([]),
    });
  }
  let minimumIndex = 0;
  for (let index = 1; index < points.length; index += 1) {
    if (
      contourVertexKey(points[index], transitions[index]) <
      contourVertexKey(points[minimumIndex], transitions[minimumIndex])
    ) {
      minimumIndex = index;
    }
  }
  return Object.freeze({
    points: Object.freeze(
      Array.from(
        { length: points.length },
        (_, offset) => points[(minimumIndex + offset) % points.length],
      ).filter(isContourPlanetPoint),
    ),
    sourceTransitions: Object.freeze(
      Array.from(
        { length: transitions.length },
        (_, offset) => transitions[(minimumIndex + offset) % transitions.length],
      ).filter(isContourTransition),
    ),
    leftLandSampleIndices: Object.freeze(
      Array.from(
        { length: leftLandSampleIndices.length },
        (_, offset) =>
          leftLandSampleIndices[(minimumIndex + offset) % leftLandSampleIndices.length],
      ).filter(isContourNumber),
    ),
  });
}
