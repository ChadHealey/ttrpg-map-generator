/** Exact, repair-free validation for quantized planet-native coastline rings. */

import { PLANET_TICKS_PER_TURN } from '@ttrpg-map/core';

import {
  GEOGRAPHY_ADAPTER_DIAGNOSTIC_CODES,
  type GeographyAdapterDiagnostic,
  type PlanetTopologyValidationAdapter,
  type ProposedPlanetRing,
} from './geography-algorithm-adapters.js';

export interface UnwrappedTickPoint {
  readonly longitudeTicks: number;
  readonly latitudeTicks: number;
}

const topologyAdapterDefinition: PlanetTopologyValidationAdapter = Object.freeze({
  algorithmId: 'quantized-planet-ring-validation',
  algorithmVersion: 1,
  validate: validateRings,
});

export const atlasPlanetTopologyValidationAdapter = topologyAdapterDefinition;

/** Preserve local continuity while keeping the closing point explicit for edge iteration. */
export function unwrapPlanetRing(ring: ProposedPlanetRing): readonly UnwrappedTickPoint[] {
  const first = ring.points[0];
  if (first === undefined) return [];
  const unwrapped: UnwrappedTickPoint[] = [first];
  let priorLongitude = first.longitudeTicks;
  for (let index = 1; index <= ring.points.length; index += 1) {
    const point = ring.points[index % ring.points.length];
    if (point === undefined) continue;
    let longitude = point.longitudeTicks;
    while (longitude - priorLongitude > PLANET_TICKS_PER_TURN / 2) {
      longitude -= PLANET_TICKS_PER_TURN;
    }
    while (longitude - priorLongitude < -PLANET_TICKS_PER_TURN / 2) {
      longitude += PLANET_TICKS_PER_TURN;
    }
    unwrapped.push(
      Object.freeze({ longitudeTicks: longitude, latitudeTicks: point.latitudeTicks }),
    );
    priorLongitude = longitude;
  }
  return Object.freeze(unwrapped);
}

export function exactOrientation(
  start: UnwrappedTickPoint,
  end: UnwrappedTickPoint,
  point: UnwrappedTickPoint,
): bigint {
  return (
    BigInt(end.longitudeTicks - start.longitudeTicks) *
      BigInt(point.latitudeTicks - start.latitudeTicks) -
    BigInt(end.latitudeTicks - start.latitudeTicks) *
      BigInt(point.longitudeTicks - start.longitudeTicks)
  );
}

export function exactSegmentsIntersect(
  firstStart: UnwrappedTickPoint,
  firstEnd: UnwrappedTickPoint,
  secondStart: UnwrappedTickPoint,
  secondEnd: UnwrappedTickPoint,
): boolean {
  const firstA = exactOrientation(firstStart, firstEnd, secondStart);
  const firstB = exactOrientation(firstStart, firstEnd, secondEnd);
  const secondA = exactOrientation(secondStart, secondEnd, firstStart);
  const secondB = exactOrientation(secondStart, secondEnd, firstEnd);
  if (firstA === 0n && isPointOnSegment(secondStart, firstStart, firstEnd)) return true;
  if (firstB === 0n && isPointOnSegment(secondEnd, firstStart, firstEnd)) return true;
  if (secondA === 0n && isPointOnSegment(firstStart, secondStart, secondEnd)) return true;
  if (secondB === 0n && isPointOnSegment(firstEnd, secondStart, secondEnd)) return true;
  return (
    ((firstA < 0n && firstB > 0n) || (firstA > 0n && firstB < 0n)) &&
    ((secondA < 0n && secondB > 0n) || (secondA > 0n && secondB < 0n))
  );
}

function validateRings(
  rings: readonly ProposedPlanetRing[],
): readonly GeographyAdapterDiagnostic[] {
  const diagnostics: GeographyAdapterDiagnostic[] = [];
  const unwrapped = rings.map(unwrapPlanetRing);
  rings.forEach((ring, ringIndex) => {
    validateOneRing(ring, unwrapped[ringIndex] ?? [], ringIndex, diagnostics);
  });
  validateRingIntersections(unwrapped, diagnostics);
  return Object.freeze(diagnostics);
}

function validateOneRing(
  ring: ProposedPlanetRing,
  points: readonly UnwrappedTickPoint[],
  ringIndex: number,
  diagnostics: GeographyAdapterDiagnostic[],
): void {
  if (ring.points.length < 3) {
    diagnostics.push(
      diagnostic(
        GEOGRAPHY_ADAPTER_DIAGNOSTIC_CODES.contourTooShort,
        'A proposed contour ring must contain at least three distinct points.',
        ringIndex,
      ),
    );
    return;
  }
  if (
    ring.sourceTransitions !== undefined &&
    ring.sourceTransitions.length !== ring.points.length
  ) {
    diagnostics.push(
      diagnostic(
        GEOGRAPHY_ADAPTER_DIAGNOSTIC_CODES.contourSourceMissing,
        `Proposed contour ring ${String(ringIndex)} does not have one source transition per point.`,
        ringIndex,
      ),
    );
  }
  const seenVertices = new Set<string>();
  for (const point of ring.points) {
    const key = `${String(point.longitudeTicks)}:${String(point.latitudeTicks)}`;
    if (seenVertices.has(key)) {
      diagnostics.push(
        diagnostic(
          GEOGRAPHY_ADAPTER_DIAGNOSTIC_CODES.contourDuplicateVertex,
          `Proposed contour ring ${String(ringIndex)} repeats a vertex.`,
          ringIndex,
        ),
      );
      return;
    }
    seenVertices.add(key);
  }
  for (let firstIndex = 0; firstIndex < points.length - 1; firstIndex += 1) {
    const firstStart = points[firstIndex];
    const firstEnd = points[firstIndex + 1];
    if (firstStart === undefined || firstEnd === undefined) continue;
    for (let secondIndex = firstIndex + 2; secondIndex < points.length - 1; secondIndex += 1) {
      if (firstIndex === 0 && secondIndex === points.length - 2) continue;
      const secondStart = points[secondIndex];
      const secondEnd = points[secondIndex + 1];
      if (
        secondStart !== undefined &&
        secondEnd !== undefined &&
        exactSegmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)
      ) {
        diagnostics.push(
          diagnostic(
            GEOGRAPHY_ADAPTER_DIAGNOSTIC_CODES.contourSelfIntersection,
            `Proposed contour ring ${String(ringIndex)} self-intersects after quantization.`,
            ringIndex,
          ),
        );
        return;
      }
    }
  }
}

function validateRingIntersections(
  rings: readonly (readonly UnwrappedTickPoint[])[],
  diagnostics: GeographyAdapterDiagnostic[],
): void {
  for (let firstRingIndex = 0; firstRingIndex < rings.length; firstRingIndex += 1) {
    const first = rings[firstRingIndex] ?? [];
    const firstBounds = bounds(first);
    for (
      let secondRingIndex = firstRingIndex + 1;
      secondRingIndex < rings.length;
      secondRingIndex += 1
    ) {
      const second = rings[secondRingIndex] ?? [];
      const shift = nearestPeriodicShift(firstBounds, bounds(second));
      const shiftedSecond = shiftRing(second, shift);
      if (!boundsOverlap(firstBounds, bounds(shiftedSecond))) continue;
      if (ringsIntersect(first, shiftedSecond)) {
        diagnostics.push(
          diagnostic(
            GEOGRAPHY_ADAPTER_DIAGNOSTIC_CODES.contourRingIntersection,
            `Proposed contour rings ${String(firstRingIndex)} and ${String(secondRingIndex)} intersect after quantization.`,
            firstRingIndex,
          ),
        );
      }
    }
  }
}

function ringsIntersect(
  first: readonly UnwrappedTickPoint[],
  second: readonly UnwrappedTickPoint[],
): boolean {
  for (let firstIndex = 0; firstIndex < first.length - 1; firstIndex += 1) {
    const firstStart = first[firstIndex];
    const firstEnd = first[firstIndex + 1];
    if (firstStart === undefined || firstEnd === undefined) continue;
    for (let secondIndex = 0; secondIndex < second.length - 1; secondIndex += 1) {
      const secondStart = second[secondIndex];
      const secondEnd = second[secondIndex + 1];
      if (
        secondStart !== undefined &&
        secondEnd !== undefined &&
        exactSegmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)
      ) {
        return true;
      }
    }
  }
  return false;
}

interface TickBounds {
  readonly minLongitude: number;
  readonly maxLongitude: number;
  readonly minLatitude: number;
  readonly maxLatitude: number;
}

function bounds(points: readonly UnwrappedTickPoint[]): TickBounds {
  return Object.freeze({
    minLongitude: Math.min(...points.map(({ longitudeTicks }) => longitudeTicks)),
    maxLongitude: Math.max(...points.map(({ longitudeTicks }) => longitudeTicks)),
    minLatitude: Math.min(...points.map(({ latitudeTicks }) => latitudeTicks)),
    maxLatitude: Math.max(...points.map(({ latitudeTicks }) => latitudeTicks)),
  });
}

function nearestPeriodicShift(first: TickBounds, second: TickBounds): number {
  const firstCenter = (first.minLongitude + first.maxLongitude) / 2;
  const secondCenter = (second.minLongitude + second.maxLongitude) / 2;
  return Math.round((firstCenter - secondCenter) / PLANET_TICKS_PER_TURN) * PLANET_TICKS_PER_TURN;
}

function shiftRing(
  points: readonly UnwrappedTickPoint[],
  longitudeShift: number,
): readonly UnwrappedTickPoint[] {
  if (longitudeShift === 0) return points;
  return Object.freeze(
    points.map(({ longitudeTicks, latitudeTicks }) =>
      Object.freeze({ longitudeTicks: longitudeTicks + longitudeShift, latitudeTicks }),
    ),
  );
}

function boundsOverlap(first: TickBounds, second: TickBounds): boolean {
  return !(
    first.maxLongitude < second.minLongitude ||
    second.maxLongitude < first.minLongitude ||
    first.maxLatitude < second.minLatitude ||
    second.maxLatitude < first.minLatitude
  );
}

function isPointOnSegment(
  point: UnwrappedTickPoint,
  start: UnwrappedTickPoint,
  end: UnwrappedTickPoint,
): boolean {
  return (
    point.longitudeTicks >= Math.min(start.longitudeTicks, end.longitudeTicks) &&
    point.longitudeTicks <= Math.max(start.longitudeTicks, end.longitudeTicks) &&
    point.latitudeTicks >= Math.min(start.latitudeTicks, end.latitudeTicks) &&
    point.latitudeTicks <= Math.max(start.latitudeTicks, end.latitudeTicks)
  );
}

function diagnostic(
  code: GeographyAdapterDiagnostic['code'],
  message: string,
  ringIndex: number,
): GeographyAdapterDiagnostic {
  return Object.freeze({ code, message, ringIndex });
}
