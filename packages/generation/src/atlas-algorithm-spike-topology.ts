/** Exact post-quantization topology checks for the issue #56 contour prototype. */

import { PLANET_TICKS_PER_TURN } from '@ttrpg-map/core';

import {
  GEOGRAPHY_ADAPTER_DIAGNOSTIC_CODES,
  type GeographyAdapterDiagnostic,
  type PlanetTopologyValidationAdapter,
  type ProposedPlanetRing,
} from './geography-algorithm-adapters.js';

interface TickPoint {
  readonly longitudeTicks: number;
  readonly latitudeTicks: number;
}

const topologyAdapterDefinition: PlanetTopologyValidationAdapter = Object.freeze({
  algorithmId: 'quantized-planet-ring-validation',
  algorithmVersion: 1,
  validate: validateRings,
});

export const atlasAlgorithmSpikeTopologyAdapter = topologyAdapterDefinition;

/** True when canonical longitude jumps reveal that a ring crosses the atlas chart seam. */
export function doesProposedRingCrossSeam(ring: ProposedPlanetRing): boolean {
  for (let index = 0; index < ring.points.length; index += 1) {
    const point = ring.points[index];
    const next = ring.points[(index + 1) % ring.points.length];
    if (
      point !== undefined &&
      next !== undefined &&
      Math.abs(point.longitudeTicks - next.longitudeTicks) > PLANET_TICKS_PER_TURN / 2
    ) {
      return true;
    }
  }
  return false;
}

function validateRings(
  rings: readonly ProposedPlanetRing[],
): readonly GeographyAdapterDiagnostic[] {
  const diagnostics: GeographyAdapterDiagnostic[] = [];
  rings.forEach((ring, ringIndex) => {
    if (ring.points.length < 3) {
      diagnostics.push(
        Object.freeze({
          code: GEOGRAPHY_ADAPTER_DIAGNOSTIC_CODES.contourTooShort,
          message: 'A proposed contour ring must contain at least three distinct points.',
          ringIndex,
        }),
      );
      return;
    }
    const seenVertices = new Set<string>();
    for (const point of ring.points) {
      const key = `${String(point.longitudeTicks)}:${String(point.latitudeTicks)}`;
      if (seenVertices.has(key)) {
        diagnostics.push(
          Object.freeze({
            code: GEOGRAPHY_ADAPTER_DIAGNOSTIC_CODES.contourDuplicateVertex,
            message: `Proposed contour ring ${String(ringIndex)} repeats a vertex.`,
            ringIndex,
          }),
        );
        return;
      }
      seenVertices.add(key);
    }
    const unwrapped = unwrapRing(ring);
    for (let firstIndex = 0; firstIndex < unwrapped.length - 1; firstIndex += 1) {
      const firstStart = unwrapped[firstIndex];
      const firstEnd = unwrapped[firstIndex + 1];
      if (firstStart === undefined || firstEnd === undefined) continue;
      for (let secondIndex = firstIndex + 2; secondIndex < unwrapped.length - 1; secondIndex += 1) {
        if (firstIndex === 0 && secondIndex === unwrapped.length - 2) continue;
        const secondStart = unwrapped[secondIndex];
        const secondEnd = unwrapped[secondIndex + 1];
        if (
          secondStart !== undefined &&
          secondEnd !== undefined &&
          segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)
        ) {
          diagnostics.push(
            Object.freeze({
              code: GEOGRAPHY_ADAPTER_DIAGNOSTIC_CODES.contourSelfIntersection,
              message: `Proposed contour ring ${String(ringIndex)} self-intersects after quantization.`,
              ringIndex,
            }),
          );
          return;
        }
      }
    }
  });
  return Object.freeze(diagnostics);
}

function unwrapRing(ring: ProposedPlanetRing): readonly TickPoint[] {
  const first = ring.points[0];
  if (first === undefined) return [];
  const unwrapped: TickPoint[] = [first];
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

function segmentsIntersect(
  firstStart: TickPoint,
  firstEnd: TickPoint,
  secondStart: TickPoint,
  secondEnd: TickPoint,
): boolean {
  const firstA = orientation(firstStart, firstEnd, secondStart);
  const firstB = orientation(firstStart, firstEnd, secondEnd);
  const secondA = orientation(secondStart, secondEnd, firstStart);
  const secondB = orientation(secondStart, secondEnd, firstEnd);
  if (firstA === 0n && isPointOnSegment(secondStart, firstStart, firstEnd)) return true;
  if (firstB === 0n && isPointOnSegment(secondEnd, firstStart, firstEnd)) return true;
  if (secondA === 0n && isPointOnSegment(firstStart, secondStart, secondEnd)) return true;
  if (secondB === 0n && isPointOnSegment(firstEnd, secondStart, secondEnd)) return true;
  return (
    ((firstA < 0n && firstB > 0n) || (firstA > 0n && firstB < 0n)) &&
    ((secondA < 0n && secondB > 0n) || (secondA > 0n && secondB < 0n))
  );
}

function isPointOnSegment(point: TickPoint, start: TickPoint, end: TickPoint): boolean {
  return (
    point.longitudeTicks >= Math.min(start.longitudeTicks, end.longitudeTicks) &&
    point.longitudeTicks <= Math.max(start.longitudeTicks, end.longitudeTicks) &&
    point.latitudeTicks >= Math.min(start.latitudeTicks, end.latitudeTicks) &&
    point.latitudeTicks <= Math.max(start.latitudeTicks, end.latitudeTicks)
  );
}

function orientation(start: TickPoint, end: TickPoint, point: TickPoint): bigint {
  return (
    BigInt(end.longitudeTicks - start.longitudeTicks) *
      BigInt(point.latitudeTicks - start.latitudeTicks) -
    BigInt(end.latitudeTicks - start.latitudeTicks) *
      BigInt(point.longitudeTicks - start.longitudeTicks)
  );
}
