/**
 * Deterministic version-1 topology-guarded coastline simplification.
 *
 * Candidates use the accepted quarter-cell bound. A vertex is removable only when the replacement
 * chord cannot cross the current ring and the changed triangle contains no accepted sample anchor.
 * Adjacent candidates are never removed in the same pass, bounding every replacement to two raw
 * contour edges and preventing an iterative tolerance cascade.
 */

import {
  ATLAS_COASTLINE_SIMPLIFICATION_TOLERANCE_TICKS,
  PLANET_LATITUDE_MAX_TICKS,
  PLANET_LATITUDE_MIN_TICKS,
  PLANET_LONGITUDE_MIN_TICKS,
  PLANET_TICKS_PER_TURN,
  type PlanetPoint,
} from '@ttrpg-map/core';

import {
  exactOrientation,
  exactSegmentsIntersect,
  type UnwrappedTickPoint,
  unwrapPlanetRing,
} from './atlas-coastline-topology.js';
import type { AtlasSamplingProfile } from './atlas-sampling-profiles.js';
import type {
  ProposedCoastlineBoundaryTransition,
  ProposedPlanetRing,
} from './geography-algorithm-adapters.js';

export interface AtlasCoastlineSimplificationResult {
  readonly ring: ProposedPlanetRing;
  readonly removedPointCount: number;
}

interface Candidate {
  readonly index: number;
  readonly distanceNumerator: bigint;
  readonly distanceDenominator: bigint;
  readonly tieKey: string;
}

export function simplifyAtlasCoastlineRing(
  ring: ProposedPlanetRing,
  profile: AtlasSamplingProfile,
): AtlasCoastlineSimplificationResult {
  if (ring.points.length < 4) return Object.freeze({ ring, removedPointCount: 0 });
  const unwrappedClosed = unwrapPlanetRing(ring);
  const points = unwrappedClosed.slice(0, -1);
  const protectedVertices = points.map((_, index) => isProtectedVertex(ring.points, index));
  const candidates = points
    .map((point, index) => createCandidate(points, point, index, protectedVertices[index] ?? true))
    .filter(isCandidate)
    .sort(compareCandidates);
  const active = new Array<boolean>(points.length).fill(true);
  const blocked = new Array<boolean>(points.length).fill(false);
  const previous = points.map((_, index) => (index - 1 + points.length) % points.length);
  const next = points.map((_, index) => (index + 1) % points.length);
  let removedPointCount = 0;

  for (const candidate of candidates) {
    const index = candidate.index;
    const priorIndex = previous[index];
    const nextIndex = next[index];
    if (
      priorIndex === undefined ||
      nextIndex === undefined ||
      active[index] !== true ||
      blocked[index] === true ||
      blocked[priorIndex] === true ||
      blocked[nextIndex] === true
    ) {
      continue;
    }
    const priorPoint = points[priorIndex];
    const point = points[index];
    const followingPoint = points[nextIndex];
    if (
      priorPoint === undefined ||
      point === undefined ||
      followingPoint === undefined ||
      replacementIntersectsRing(
        priorPoint,
        followingPoint,
        points,
        active,
        previous,
        next,
        index,
      ) ||
      triangleContainsSampleAnchor(priorPoint, point, followingPoint, profile)
    ) {
      continue;
    }
    active[index] = false;
    next[priorIndex] = nextIndex;
    previous[nextIndex] = priorIndex;
    blocked[priorIndex] = true;
    blocked[nextIndex] = true;
    removedPointCount += 1;
  }

  if (removedPointCount === 0) return Object.freeze({ ring, removedPointCount });
  const simplifiedPoints: PlanetPoint[] = [];
  const simplifiedTransitions: ProposedCoastlineBoundaryTransition[] = [];
  for (let index = 0; index < ring.points.length; index += 1) {
    if (active[index] !== true) continue;
    const point = ring.points[index];
    const transition = ring.sourceTransitions?.[index];
    if (point !== undefined) simplifiedPoints.push(point);
    if (transition !== undefined) simplifiedTransitions.push(transition);
  }
  return Object.freeze({
    ring: Object.freeze({
      points: Object.freeze(simplifiedPoints),
      ...(ring.sourceTransitions === undefined
        ? {}
        : { sourceTransitions: Object.freeze(simplifiedTransitions) }),
    }),
    removedPointCount,
  });
}

function createCandidate(
  points: readonly UnwrappedTickPoint[],
  point: UnwrappedTickPoint,
  index: number,
  isProtected: boolean,
): Candidate | undefined {
  if (isProtected) return undefined;
  const prior = points[(index - 1 + points.length) % points.length];
  const following = points[(index + 1) % points.length];
  if (prior === undefined || following === undefined) return undefined;
  const dx = BigInt(following.longitudeTicks - prior.longitudeTicks);
  const dy = BigInt(following.latitudeTicks - prior.latitudeTicks);
  const px = BigInt(point.longitudeTicks - prior.longitudeTicks);
  const py = BigInt(point.latitudeTicks - prior.latitudeTicks);
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0n) return undefined;
  const projection = px * dx + py * dy;
  if (projection <= 0n || projection >= lengthSquared) return undefined;
  const cross = dx * py - dy * px;
  const distanceNumerator = cross * cross;
  const tolerance = BigInt(ATLAS_COASTLINE_SIMPLIFICATION_TOLERANCE_TICKS);
  if (distanceNumerator > tolerance * tolerance * lengthSquared) return undefined;
  return Object.freeze({
    index,
    distanceNumerator,
    distanceDenominator: lengthSquared,
    tieKey: `${tickKey(point)}/${String(index).padStart(8, '0')}`,
  });
}

function compareCandidates(left: Candidate, right: Candidate): number {
  const crossProduct =
    left.distanceNumerator * right.distanceDenominator -
    right.distanceNumerator * left.distanceDenominator;
  if (crossProduct < 0n) return -1;
  if (crossProduct > 0n) return 1;
  if (left.tieKey < right.tieKey) return -1;
  if (left.tieKey > right.tieKey) return 1;
  return 0;
}

function isProtectedVertex(points: readonly PlanetPoint[], index: number): boolean {
  const point = points[index];
  const prior = points[(index - 1 + points.length) % points.length];
  const following = points[(index + 1) % points.length];
  if (point === undefined || prior === undefined || following === undefined) return true;
  if (
    point.latitudeTicks === PLANET_LATITUDE_MIN_TICKS ||
    point.latitudeTicks === PLANET_LATITUDE_MAX_TICKS ||
    point.longitudeTicks === PLANET_LONGITUDE_MIN_TICKS
  ) {
    return true;
  }
  return crossesSeam(prior, point) || crossesSeam(point, following);
}

function crossesSeam(first: PlanetPoint, second: PlanetPoint): boolean {
  return Math.abs(first.longitudeTicks - second.longitudeTicks) > PLANET_TICKS_PER_TURN / 2;
}

function replacementIntersectsRing(
  start: UnwrappedTickPoint,
  end: UnwrappedTickPoint,
  points: readonly UnwrappedTickPoint[],
  active: readonly boolean[],
  previous: readonly number[],
  next: readonly number[],
  removedIndex: number,
): boolean {
  const removedPrevious = previous[removedIndex];
  const removedNext = next[removedIndex];
  if (removedPrevious === undefined || removedNext === undefined) return true;
  const candidateBounds = segmentBounds(start, end);
  for (let edgeStartIndex = 0; edgeStartIndex < points.length; edgeStartIndex += 1) {
    if (active[edgeStartIndex] !== true) continue;
    const edgeEndIndex = next[edgeStartIndex];
    if (
      edgeEndIndex === undefined ||
      edgeStartIndex === removedPrevious ||
      edgeStartIndex === removedIndex ||
      edgeEndIndex === removedPrevious ||
      edgeEndIndex === removedIndex ||
      edgeStartIndex === removedNext
    ) {
      continue;
    }
    const edgeStart = points[edgeStartIndex];
    const edgeEnd = points[edgeEndIndex];
    if (
      edgeStart !== undefined &&
      edgeEnd !== undefined &&
      boundsOverlap(candidateBounds, segmentBounds(edgeStart, edgeEnd)) &&
      exactSegmentsIntersect(start, end, edgeStart, edgeEnd)
    ) {
      return true;
    }
  }
  return false;
}

function triangleContainsSampleAnchor(
  first: UnwrappedTickPoint,
  removed: UnwrappedTickPoint,
  second: UnwrappedTickPoint,
  profile: AtlasSamplingProfile,
): boolean {
  const longitudeStep = PLANET_TICKS_PER_TURN / profile.longitudeCellCount;
  const latitudeStep = PLANET_TICKS_PER_TURN / 2 / profile.latitudeBandCount;
  const minLongitude = Math.min(
    first.longitudeTicks,
    removed.longitudeTicks,
    second.longitudeTicks,
  );
  const maxLongitude = Math.max(
    first.longitudeTicks,
    removed.longitudeTicks,
    second.longitudeTicks,
  );
  const minLatitude = Math.min(first.latitudeTicks, removed.latitudeTicks, second.latitudeTicks);
  const maxLatitude = Math.max(first.latitudeTicks, removed.latitudeTicks, second.latitudeTicks);
  const minimumX = Math.floor((minLongitude - PLANET_LONGITUDE_MIN_TICKS) / longitudeStep);
  const maximumX = Math.ceil((maxLongitude - PLANET_LONGITUDE_MIN_TICKS) / longitudeStep);
  const minimumY = Math.max(
    0,
    Math.floor((minLatitude - PLANET_LATITUDE_MIN_TICKS) / latitudeStep),
  );
  const maximumY = Math.min(
    profile.latitudeBandCount,
    Math.ceil((maxLatitude - PLANET_LATITUDE_MIN_TICKS) / latitudeStep),
  );
  for (let latitudeIndex = minimumY; latitudeIndex <= maximumY; latitudeIndex += 1) {
    const latitudeTicks = PLANET_LATITUDE_MIN_TICKS + latitudeIndex * latitudeStep;
    for (let longitudeIndex = minimumX; longitudeIndex <= maximumX; longitudeIndex += 1) {
      const longitudeTicks = PLANET_LONGITUDE_MIN_TICKS + longitudeIndex * longitudeStep;
      const anchor = Object.freeze({ longitudeTicks, latitudeTicks });
      if (pointInsideOrOnTriangle(anchor, first, removed, second)) return true;
    }
  }
  return false;
}

function pointInsideOrOnTriangle(
  point: UnwrappedTickPoint,
  first: UnwrappedTickPoint,
  second: UnwrappedTickPoint,
  third: UnwrappedTickPoint,
): boolean {
  const firstSide = exactOrientation(first, second, point);
  const secondSide = exactOrientation(second, third, point);
  const thirdSide = exactOrientation(third, first, point);
  const hasNegative = firstSide < 0n || secondSide < 0n || thirdSide < 0n;
  const hasPositive = firstSide > 0n || secondSide > 0n || thirdSide > 0n;
  return !(hasNegative && hasPositive);
}

interface SegmentBounds {
  readonly minLongitude: number;
  readonly maxLongitude: number;
  readonly minLatitude: number;
  readonly maxLatitude: number;
}

function segmentBounds(first: UnwrappedTickPoint, second: UnwrappedTickPoint): SegmentBounds {
  return Object.freeze({
    minLongitude: Math.min(first.longitudeTicks, second.longitudeTicks),
    maxLongitude: Math.max(first.longitudeTicks, second.longitudeTicks),
    minLatitude: Math.min(first.latitudeTicks, second.latitudeTicks),
    maxLatitude: Math.max(first.latitudeTicks, second.latitudeTicks),
  });
}

function boundsOverlap(first: SegmentBounds, second: SegmentBounds): boolean {
  return !(
    first.maxLongitude < second.minLongitude ||
    second.maxLongitude < first.minLongitude ||
    first.maxLatitude < second.minLatitude ||
    second.maxLatitude < first.minLatitude
  );
}

function tickKey(point: UnwrappedTickPoint): string {
  return `${String(point.longitudeTicks).padStart(12, '0')}:${String(point.latitudeTicks).padStart(12, '0')}`;
}

function isCandidate(candidate: Candidate | undefined): candidate is Candidate {
  return candidate !== undefined;
}
