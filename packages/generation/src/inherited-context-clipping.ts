/** Exact local-chart clipping for accepted planet-native inherited-context geometry. */

import {
  type AspectId,
  createRegionalFootprintTransform,
  deriveStableId,
  type EntityId,
  type InheritedContextBoundaryPortal,
  type InheritedContextBoundaryPortalKind,
  type InheritedContextGeometryAnchor,
  type InheritedContextGeometryAnchorKind,
  type MapId,
  parseSemanticKey,
  PLANET_ANGULAR_STEP_RAD,
  type PlanetPoint,
  planetPointToAngles,
  type RegionalExtent,
  type RegionalPoint,
  type RegionalRectangleFootprint,
  sha256,
} from '@ttrpg-map/core';

export interface InheritedContextPathSource {
  readonly sourceMapId: MapId;
  readonly sourceEntityId: EntityId;
  readonly sourceAspectId: AspectId;
  readonly sourceAnchorId: InheritedContextGeometryAnchor['sourceAnchorId'];
  readonly anchorKind: InheritedContextGeometryAnchorKind;
  readonly portalKind?: InheritedContextBoundaryPortalKind;
  readonly paths: readonly {
    readonly points: readonly PlanetPoint[];
    readonly closed: boolean;
  }[];
}

export type InheritedContextClipResult =
  | {
      readonly ok: true;
      readonly anchors: readonly InheritedContextGeometryAnchor[];
      readonly portals: readonly InheritedContextBoundaryPortal[];
      readonly intersectingAnchorIds: ReadonlySet<string>;
    }
  | { readonly ok: false; readonly message: string };

interface Fraction {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

interface ProjectedSegment {
  readonly start: RegionalPoint;
  readonly end: RegionalPoint;
}

interface ClippedSegment {
  readonly startParameter: Fraction;
  readonly endParameter: Fraction;
  readonly start: RegionalPoint;
  readonly end: RegionalPoint;
}

const ZERO = fraction(0n, 1n);
const ONE = fraction(1n, 1n);
/** Clip accepted geometry to the collar and derive exact footprint-boundary continuations. */
export function clipInheritedContextGeometry(
  sources: readonly InheritedContextPathSource[],
  footprint: RegionalRectangleFootprint,
  collar: RegionalExtent,
): InheritedContextClipResult {
  const transform = createRegionalFootprintTransform(footprint);
  const anchors: InheritedContextGeometryAnchor[] = [];
  const portalByIdentity = new Map<string, InheritedContextBoundaryPortal>();
  const intersectingAnchorIds = new Set<string>();

  for (const source of [...sources].sort(comparePathSources)) {
    const clippedPaths: (readonly PlanetPoint[])[] = [];
    for (const path of source.paths) {
      if (path.points.length === 0) continue;
      if (path.points.length === 1) {
        const point = path.points[0];
        if (point === undefined) continue;
        const projected = transform.forward(point);
        if (projected.ok && isInside(projected.value, collar)) {
          clippedPaths.push(Object.freeze([point]));
        }
        continue;
      }
      const segmentCount = path.closed ? path.points.length : path.points.length - 1;
      for (let index = 0; index < segmentCount; index += 1) {
        const startRoot = path.points[index];
        const endRoot = path.points[(index + 1) % path.points.length];
        if (startRoot === undefined || endRoot === undefined) continue;
        const start = transform.forward(startRoot);
        const end = transform.forward(endRoot);
        if (!start.ok || !end.ok) {
          if (segmentCannotReachCollar(startRoot, endRoot, footprint, collar)) continue;
          return {
            ok: false,
            message: `Accepted ${source.anchorKind} geometry may reach the collar but cannot be represented completely in its local chart.`,
          };
        }
        const projected = { start: start.value, end: end.value };
        const clipped = clipSegment(projected, collar);
        if (clipped !== undefined) {
          const rootSegment = rootPointsForClippedSegment(clipped, startRoot, endRoot, transform);
          if (rootSegment === undefined) {
            return {
              ok: false,
              message: `Accepted ${source.anchorKind} geometry cannot be inverted after collar clipping.`,
            };
          }
          clippedPaths.push(rootSegment);
        }
        if (source.portalKind === undefined) continue;
        const footprintClip = clipSegment(projected, footprint.extent);
        if (
          footprintClip === undefined ||
          fractionsEqual(footprintClip.startParameter, footprintClip.endParameter)
        ) {
          continue;
        }
        if (segmentLiesOnBoundary(projected, footprint.extent)) continue;
        for (const crossing of boundaryCrossings(footprintClip, projected, footprint.extent)) {
          const rootPoint = transform.inverse(crossing);
          if (!rootPoint.ok) {
            return {
              ok: false,
              message: `Accepted ${source.anchorKind} crossing cannot be inverted into planet coordinates.`,
            };
          }
          const portal = createPortal(source, source.portalKind, crossing, rootPoint.value);
          portalByIdentity.set(portal.portalId, portal);
        }
      }
    }
    const uniquePaths = uniquePlanetPaths(clippedPaths);
    if (uniquePaths.length === 0) continue;
    intersectingAnchorIds.add(source.sourceAnchorId);
    anchors.push(
      Object.freeze({
        sourceMapId: source.sourceMapId,
        sourceEntityId: source.sourceEntityId,
        sourceAspectId: source.sourceAspectId,
        sourceAnchorId: source.sourceAnchorId,
        anchorKind: source.anchorKind,
        paths: Object.freeze(uniquePaths),
      }),
    );
  }

  anchors.sort(
    (left, right) =>
      compareAscii(left.sourceAnchorId, right.sourceAnchorId) ||
      compareAscii(left.anchorKind, right.anchorKind),
  );
  const portals = [...portalByIdentity.values()].sort((left, right) =>
    comparePortals(left, right, footprint.extent),
  );
  return {
    ok: true,
    anchors: Object.freeze(anchors),
    portals: Object.freeze(portals),
    intersectingAnchorIds,
  };
}

function clipSegment(
  segment: ProjectedSegment,
  extent: RegionalExtent,
): ClippedSegment | undefined {
  let startParameter = ZERO;
  let endParameter = ONE;
  const axes = [
    [
      segment.start.xMillimeters,
      segment.end.xMillimeters,
      extent.minXMillimeters,
      extent.maxXMillimeters,
    ],
    [
      segment.start.yMillimeters,
      segment.end.yMillimeters,
      extent.minYMillimeters,
      extent.maxYMillimeters,
    ],
  ] as const;
  for (const [start, end, minimum, maximum] of axes) {
    const delta = BigInt(end) - BigInt(start);
    if (delta === 0n) {
      if (start < minimum || start > maximum) return undefined;
      continue;
    }
    const first = fraction(BigInt(minimum) - BigInt(start), delta);
    const second = fraction(BigInt(maximum) - BigInt(start), delta);
    const lower = compareFractions(first, second) <= 0 ? first : second;
    const upper = compareFractions(first, second) <= 0 ? second : first;
    if (compareFractions(lower, startParameter) > 0) startParameter = lower;
    if (compareFractions(upper, endParameter) < 0) endParameter = upper;
    if (compareFractions(startParameter, endParameter) > 0) return undefined;
  }
  const start = pointAt(segment, startParameter);
  const end = pointAt(segment, endParameter);
  return start === undefined || end === undefined
    ? undefined
    : { startParameter, endParameter, start, end };
}

function rootPointsForClippedSegment(
  clipped: ClippedSegment,
  startRoot: PlanetPoint,
  endRoot: PlanetPoint,
  transform: ReturnType<typeof createRegionalFootprintTransform>,
): readonly PlanetPoint[] | undefined {
  const start = fractionsEqual(clipped.startParameter, ZERO)
    ? { ok: true as const, value: startRoot }
    : transform.inverse(clipped.start);
  const end = fractionsEqual(clipped.endParameter, ONE)
    ? { ok: true as const, value: endRoot }
    : transform.inverse(clipped.end);
  if (!start.ok || !end.ok) return undefined;
  if (
    start.value.longitudeTicks === end.value.longitudeTicks &&
    start.value.latitudeTicks === end.value.latitudeTicks
  ) {
    return Object.freeze([start.value]);
  }
  return Object.freeze([start.value, end.value]);
}

function boundaryCrossings(
  clipped: ClippedSegment,
  segment: ProjectedSegment,
  extent: RegionalExtent,
): readonly RegionalPoint[] {
  const crossings: RegionalPoint[] = [];
  if (
    isOnBoundary(clipped.start, extent) &&
    (compareFractions(clipped.startParameter, ZERO) > 0 || isOnBoundary(segment.start, extent))
  ) {
    crossings.push(clipped.start);
  }
  if (
    isOnBoundary(clipped.end, extent) &&
    (compareFractions(clipped.endParameter, ONE) < 0 || isOnBoundary(segment.end, extent))
  ) {
    crossings.push(clipped.end);
  }
  return uniqueRegionalPoints(crossings);
}

function createPortal(
  source: InheritedContextPathSource,
  portalKind: InheritedContextBoundaryPortalKind,
  localPoint: RegionalPoint,
  rootPoint: PlanetPoint,
): InheritedContextBoundaryPortal {
  const keyInput = [
    portalKind,
    source.sourceMapId,
    source.sourceAspectId,
    source.sourceAnchorId,
    String(rootPoint.longitudeTicks),
    String(rootPoint.latitudeTicks),
  ].join('\n');
  const digest = hex(sha256(asciiBytes(keyInput)));
  const semanticKey = parseSemanticKey(`inherited-context-portal-${digest}`);
  if (!semanticKey.ok) throw new Error('Internal inherited-context portal key is invalid.');
  return Object.freeze({
    portalId: deriveStableId('boundary-portal', source.sourceAnchorId, semanticKey.value),
    portalKind,
    sourceMapId: source.sourceMapId,
    sourceEntityId: source.sourceEntityId,
    sourceAspectId: source.sourceAspectId,
    rootPoint,
    localPoint,
  });
}

function segmentCannotReachCollar(
  start: PlanetPoint,
  end: PlanetPoint,
  footprint: RegionalRectangleFootprint,
  collar: RegionalExtent,
): boolean {
  const origin = footprint.origin;
  const lowerAngularBound = Math.max(
    0,
    (angularDistance(origin, start) + angularDistance(origin, end) - angularDistance(start, end)) /
      2,
  );
  const radialLimitMillimeters = Math.hypot(
    Math.max(Math.abs(collar.minXMillimeters), Math.abs(collar.maxXMillimeters)),
    Math.max(Math.abs(collar.minYMillimeters), Math.abs(collar.maxYMillimeters)),
  );
  const collarAngularLimit = radialLimitMillimeters / footprint.worldRadius.radiusMillimeters;
  return lowerAngularBound > collarAngularLimit + 4 * PLANET_ANGULAR_STEP_RAD;
}

function angularDistance(left: PlanetPoint, right: PlanetPoint): number {
  const first = planetPointToAngles(left);
  const second = planetPointToAngles(right);
  const longitudeDelta = second.longitudeRad - first.longitudeRad;
  const cosine = Math.max(
    -1,
    Math.min(
      1,
      Math.sin(first.latitudeRad) * Math.sin(second.latitudeRad) +
        Math.cos(first.latitudeRad) * Math.cos(second.latitudeRad) * Math.cos(longitudeDelta),
    ),
  );
  const sine = Math.sqrt(Math.max(0, 1 - cosine * cosine));
  return Math.atan2(sine, cosine);
}

function pointAt(segment: ProjectedSegment, parameter: Fraction): RegionalPoint | undefined {
  const x = interpolate(segment.start.xMillimeters, segment.end.xMillimeters, parameter);
  const y = interpolate(segment.start.yMillimeters, segment.end.yMillimeters, parameter);
  if (x === undefined || y === undefined) return undefined;
  return Object.freeze({ xMillimeters: x, yMillimeters: y }) as RegionalPoint;
}

function interpolate(start: number, end: number, parameter: Fraction): number | undefined {
  const numerator =
    BigInt(start) * parameter.denominator + (BigInt(end) - BigInt(start)) * parameter.numerator;
  const rounded = roundFractionTiesAwayFromZero(numerator, parameter.denominator);
  const value = Number(rounded);
  return Number.isSafeInteger(value) ? (value === 0 ? 0 : value) : undefined;
}

function roundFractionTiesAwayFromZero(numerator: bigint, denominator: bigint): bigint {
  const sign = numerator < 0n ? -1n : 1n;
  const magnitude = numerator < 0n ? -numerator : numerator;
  const quotient = magnitude / denominator;
  const remainder = magnitude % denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
  return sign * rounded;
}

function fraction(numerator: bigint, denominator: bigint): Fraction {
  if (denominator === 0n) throw new RangeError('Fraction denominator cannot be zero.');
  return denominator < 0n
    ? { numerator: -numerator, denominator: -denominator }
    : { numerator, denominator };
}

function compareFractions(left: Fraction, right: Fraction): number {
  const difference = left.numerator * right.denominator - right.numerator * left.denominator;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

function fractionsEqual(left: Fraction, right: Fraction): boolean {
  return compareFractions(left, right) === 0;
}

function segmentLiesOnBoundary(segment: ProjectedSegment, extent: RegionalExtent): boolean {
  return (
    (segment.start.xMillimeters === segment.end.xMillimeters &&
      (segment.start.xMillimeters === extent.minXMillimeters ||
        segment.start.xMillimeters === extent.maxXMillimeters)) ||
    (segment.start.yMillimeters === segment.end.yMillimeters &&
      (segment.start.yMillimeters === extent.minYMillimeters ||
        segment.start.yMillimeters === extent.maxYMillimeters))
  );
}

function isInside(point: RegionalPoint, extent: RegionalExtent): boolean {
  return (
    point.xMillimeters >= extent.minXMillimeters &&
    point.xMillimeters <= extent.maxXMillimeters &&
    point.yMillimeters >= extent.minYMillimeters &&
    point.yMillimeters <= extent.maxYMillimeters
  );
}

function isOnBoundary(point: RegionalPoint, extent: RegionalExtent): boolean {
  return (
    isInside(point, extent) &&
    (point.xMillimeters === extent.minXMillimeters ||
      point.xMillimeters === extent.maxXMillimeters ||
      point.yMillimeters === extent.minYMillimeters ||
      point.yMillimeters === extent.maxYMillimeters)
  );
}

function comparePathSources(left: InheritedContextPathSource, right: InheritedContextPathSource) {
  return (
    compareAscii(left.sourceAnchorId, right.sourceAnchorId) ||
    compareAscii(left.anchorKind, right.anchorKind)
  );
}

function comparePortals(
  left: InheritedContextBoundaryPortal,
  right: InheritedContextBoundaryPortal,
  extent: RegionalExtent,
): number {
  const leftOffset = perimeterOffset(left.localPoint, extent);
  const rightOffset = perimeterOffset(right.localPoint, extent);
  if (leftOffset < rightOffset) return -1;
  if (leftOffset > rightOffset) return 1;
  return (
    left.rootPoint.longitudeTicks - right.rootPoint.longitudeTicks ||
    left.rootPoint.latitudeTicks - right.rootPoint.latitudeTicks ||
    compareAscii(left.sourceEntityId, right.sourceEntityId) ||
    compareAscii(left.portalId, right.portalId)
  );
}

function perimeterOffset(point: RegionalPoint, extent: RegionalExtent): bigint {
  const width = BigInt(extent.maxXMillimeters) - BigInt(extent.minXMillimeters);
  const height = BigInt(extent.maxYMillimeters) - BigInt(extent.minYMillimeters);
  if (point.yMillimeters === extent.minYMillimeters)
    return BigInt(point.xMillimeters) - BigInt(extent.minXMillimeters);
  if (point.xMillimeters === extent.maxXMillimeters)
    return width + BigInt(point.yMillimeters) - BigInt(extent.minYMillimeters);
  if (point.yMillimeters === extent.maxYMillimeters)
    return width + height + BigInt(extent.maxXMillimeters) - BigInt(point.xMillimeters);
  return 2n * width + height + BigInt(extent.maxYMillimeters) - BigInt(point.yMillimeters);
}

function uniquePlanetPaths(
  paths: readonly (readonly PlanetPoint[])[],
): readonly (readonly PlanetPoint[])[] {
  const byKey = new Map<string, readonly PlanetPoint[]>();
  for (const path of paths) {
    const key = path
      .map((point) => `${String(point.longitudeTicks)}/${String(point.latitudeTicks)}`)
      .join(';');
    byKey.set(key, path);
  }
  return [...byKey.entries()]
    .sort(([left], [right]) => compareAscii(left, right))
    .map(([, path]) => path);
}

function uniqueRegionalPoints(points: readonly RegionalPoint[]): readonly RegionalPoint[] {
  const byKey = new Map(
    points.map((point) => [`${String(point.xMillimeters)}/${String(point.yMillimeters)}`, point]),
  );
  return [...byKey.entries()]
    .sort(([left], [right]) => compareAscii(left, right))
    .map(([, point]) => point);
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function asciiBytes(value: string): Uint8Array {
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}
