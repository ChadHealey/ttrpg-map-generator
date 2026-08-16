/**
 * Disposable whole-world atlas projection and seam splitting.
 *
 * Canonical planet-native coastline remains authoritative. This adapter emits exact integer
 * display ticks for later scene composition and never repairs or mutates source geography.
 */

import {
  ATLAS_COASTLINE_EXTRACTION_ALGORITHM_VERSION,
  ATLAS_COASTLINE_GEOMETRY_BEHAVIOR_VERSION,
  ATLAS_COASTLINE_REPAIR_POLICY,
  ATLAS_COASTLINE_SIMPLIFICATION_POLICY_VERSION,
  ATLAS_COASTLINE_SIMPLIFICATION_TOLERANCE_TICKS,
  ATLAS_COASTLINE_TOPOLOGY_VALIDATION_VERSION,
  ATLAS_COASTLINE_WINDING,
  type CanonicalWorldCoastline,
  type CanonicalWorldCoastlineRing,
  type CoastlineRingId,
  type EntityId,
  parsePlanetPoint,
  parseStableId,
  PLANET_LATITUDE_MAX_TICKS,
  PLANET_LONGITUDE_MIN_TICKS,
  PLANET_TICKS_PER_TURN,
} from '@ttrpg-map/core';

declare const ATLAS_DISPLAY_POINT_BRAND: unique symbol;
declare const ATLAS_PROJECTED_PATH_ID_BRAND: unique symbol;

export const ATLAS_DISPLAY_PROJECTION_ID = 'atlas-equirectangular' as const;
export const ATLAS_DISPLAY_PROJECTION_VERSION = 1 as const;
export const ATLAS_DISPLAY_SEAM_POLICY_VERSION = 1 as const;
export const ATLAS_DISPLAY_COORDINATE_SPACE = 'atlas-display-equirectangular-v1' as const;
export const ATLAS_DISPLAY_WIDTH_TICKS = PLANET_TICKS_PER_TURN;
export const ATLAS_DISPLAY_HEIGHT_TICKS = PLANET_TICKS_PER_TURN / 2;
export const ATLAS_DISPLAY_SEAM_LONGITUDE_TICKS = PLANET_LONGITUDE_MIN_TICKS;
export const ATLAS_PROJECTION_SEMANTIC_TOLERANCE_TICKS = 0 as const;

/** Versioned disposable display metadata; it is never authoritative geography. */
export interface AtlasDisplayProjectionMetadata {
  readonly projectionId: typeof ATLAS_DISPLAY_PROJECTION_ID;
  readonly projectionVersion: typeof ATLAS_DISPLAY_PROJECTION_VERSION;
  readonly seamPolicyVersion: typeof ATLAS_DISPLAY_SEAM_POLICY_VERSION;
  readonly coordinateSpace: typeof ATLAS_DISPLAY_COORDINATE_SPACE;
  readonly authority: 'disposable-display';
  readonly seamLongitudeTicks: typeof ATLAS_DISPLAY_SEAM_LONGITUDE_TICKS;
  readonly widthDisplayTicks: number;
  readonly heightDisplayTicks: number;
  readonly logicalAspectRatio: 2;
  readonly xDirection: 'east-from-canonical-seam';
  readonly yDirection: 'south-from-north-pole';
  readonly semanticToleranceTicks: typeof ATLAS_PROJECTION_SEMANTIC_TOLERANCE_TICKS;
}

export const ATLAS_DISPLAY_PROJECTION_METADATA: AtlasDisplayProjectionMetadata = Object.freeze({
  projectionId: ATLAS_DISPLAY_PROJECTION_ID,
  projectionVersion: ATLAS_DISPLAY_PROJECTION_VERSION,
  seamPolicyVersion: ATLAS_DISPLAY_SEAM_POLICY_VERSION,
  coordinateSpace: ATLAS_DISPLAY_COORDINATE_SPACE,
  authority: 'disposable-display',
  seamLongitudeTicks: ATLAS_DISPLAY_SEAM_LONGITUDE_TICKS,
  widthDisplayTicks: ATLAS_DISPLAY_WIDTH_TICKS,
  heightDisplayTicks: ATLAS_DISPLAY_HEIGHT_TICKS,
  logicalAspectRatio: 2,
  xDirection: 'east-from-canonical-seam',
  yDirection: 'south-from-north-pole',
  semanticToleranceTicks: ATLAS_PROJECTION_SEMANTIC_TOLERANCE_TICKS,
});

/** An exact location in the version-1 derived atlas display rectangle. */
export type AtlasDisplayPoint = Readonly<{
  readonly xDisplayTicks: number;
  readonly yDisplayTicks: number;
  readonly [ATLAS_DISPLAY_POINT_BRAND]: true;
}>;

/** Stable identity of one derived path within a source ring and projection version. */
export type AtlasProjectedPathId = string & { readonly [ATLAS_PROJECTED_PATH_ID_BRAND]: true };

/** One renderer-ready drawing path derived from one canonical coastline ring. */
export interface AtlasProjectedCoastlinePath {
  readonly pathId: AtlasProjectedPathId;
  readonly sourceRingId: CoastlineRingId;
  readonly sourceBoundaryFingerprint: string;
  readonly sourceEntityId: EntityId;
  readonly landmassId: EntityId;
  readonly waterBodyIds: readonly EntityId[];
  readonly sourcePathIndex: number;
  /** Closed paths repeat their first point exactly; seam-split paths remain open. */
  readonly isClosed: boolean;
  readonly points: readonly AtlasDisplayPoint[];
}

/** Complete disposable projection output in stable source-ring/path order. */
export interface AtlasProjectedCoastline {
  readonly authority: 'disposable';
  readonly projection: AtlasDisplayProjectionMetadata;
  readonly sourceGeometryBehaviorVersion: typeof ATLAS_COASTLINE_GEOMETRY_BEHAVIOR_VERSION;
  readonly paths: readonly AtlasProjectedCoastlinePath[];
}

export const ATLAS_PROJECTION_DIAGNOSTIC_CODES = {
  invalidSourceIdentity: 'atlas-projection.source-identity.invalid',
  invalidSourceRing: 'atlas-projection.source-ring.invalid',
  unsupportedGeometry: 'atlas-projection.geometry.unsupported',
} as const;

export type AtlasProjectionDiagnosticCode =
  (typeof ATLAS_PROJECTION_DIAGNOSTIC_CODES)[keyof typeof ATLAS_PROJECTION_DIAGNOSTIC_CODES];

export interface AtlasProjectionDiagnostic {
  readonly code: AtlasProjectionDiagnosticCode;
  readonly message: string;
  readonly sourceRingId?: string;
}

export type AtlasProjectionResult =
  | { readonly ok: true; readonly value: AtlasProjectedCoastline }
  | { readonly ok: false; readonly diagnostics: readonly AtlasProjectionDiagnostic[] };

/**
 * Project validated canonical rings into the initial 2:1 atlas rectangle.
 *
 * Output is deterministic for canonical source bytes. Invalid or unsupported geometry is rejected
 * before any renderer sees it; this adapter performs no topology repair.
 */
export function projectAtlasCanonicalCoastline(
  coastline: CanonicalWorldCoastline,
): AtlasProjectionResult {
  const diagnostics = validateProjectionSource(coastline);
  if (diagnostics.length > 0) return { ok: false, diagnostics };

  const rings = [...coastline.rings].sort((left, right) => compareText(left.ringId, right.ringId));
  const paths = rings.flatMap(projectRing);
  return {
    ok: true,
    value: Object.freeze({
      authority: 'disposable',
      projection: ATLAS_DISPLAY_PROJECTION_METADATA,
      sourceGeometryBehaviorVersion: coastline.geometryBehaviorVersion,
      paths: Object.freeze(paths),
    }),
  };
}

function validateProjectionSource(
  coastline: CanonicalWorldCoastline,
): readonly AtlasProjectionDiagnostic[] {
  const metadata = coastline as unknown as Readonly<Record<string, unknown>>;
  if (
    metadata.geometryBehaviorVersion !== ATLAS_COASTLINE_GEOMETRY_BEHAVIOR_VERSION ||
    metadata.extractionAlgorithmVersion !== ATLAS_COASTLINE_EXTRACTION_ALGORITHM_VERSION ||
    metadata.simplificationPolicyVersion !== ATLAS_COASTLINE_SIMPLIFICATION_POLICY_VERSION ||
    metadata.simplificationToleranceTicks !== ATLAS_COASTLINE_SIMPLIFICATION_TOLERANCE_TICKS ||
    metadata.topologyValidationVersion !== ATLAS_COASTLINE_TOPOLOGY_VALIDATION_VERSION ||
    metadata.winding !== ATLAS_COASTLINE_WINDING ||
    metadata.repairPolicy !== ATLAS_COASTLINE_REPAIR_POLICY
  ) {
    return [
      diagnostic(
        ATLAS_PROJECTION_DIAGNOSTIC_CODES.unsupportedGeometry,
        'Atlas projection supports only accepted canonical coastline geometry policy version 1.',
      ),
    ];
  }

  const diagnostics: AtlasProjectionDiagnostic[] = [];
  if (coastline.rings.length === 0) {
    diagnostics.push(
      diagnostic(
        ATLAS_PROJECTION_DIAGNOSTIC_CODES.invalidSourceRing,
        'Canonical coastline projection requires at least one source ring.',
      ),
    );
  }
  const ringIds = new Set<string>();
  for (const ring of coastline.rings) {
    if (ringIds.has(ring.ringId)) {
      diagnostics.push(
        diagnostic(
          ATLAS_PROJECTION_DIAGNOSTIC_CODES.invalidSourceIdentity,
          `Coastline ring ${ring.ringId} must have one unique source identity before projection.`,
          ring.ringId,
        ),
      );
    }
    ringIds.add(ring.ringId);
  }
  for (const ring of coastline.rings) validateProjectionRing(ring, diagnostics);
  return Object.freeze(
    diagnostics.sort(
      (left, right) =>
        compareText(left.sourceRingId ?? '', right.sourceRingId ?? '') ||
        compareText(left.code, right.code) ||
        compareText(left.message, right.message),
    ),
  );
}

function validateProjectionRing(
  ring: CanonicalWorldCoastlineRing,
  diagnostics: AtlasProjectionDiagnostic[],
): void {
  const ringId = String(ring.ringId);
  const identitiesValid =
    parseStableId('coastline-ring', ring.ringId).ok &&
    parseStableId('entity', ring.landmassId).ok &&
    ring.waterBodyIds.length > 0 &&
    ring.waterBodyIds.every((id) => parseStableId('entity', id).ok) &&
    ring.waterBodyIds.every((id, index) => {
      const prior = ring.waterBodyIds[index - 1];
      return prior === undefined || prior < id;
    }) &&
    /^[0-9a-f]{64}$/.test(ring.sourceBoundaryFingerprint);
  if (!identitiesValid) {
    diagnostics.push(
      diagnostic(
        ATLAS_PROJECTION_DIAGNOSTIC_CODES.invalidSourceIdentity,
        `Coastline ring ${ringId} must retain canonical ring, landmass, water-body, and source-boundary identity.`,
        ringId,
      ),
    );
  }

  const uniquePoints = new Set(
    ring.points.map((point) => `${String(point.longitudeTicks)}:${String(point.latitudeTicks)}`),
  );
  if (
    ring.points.length < 3 ||
    uniquePoints.size !== ring.points.length ||
    ring.points.some((point) => !parsePlanetPoint(point).ok)
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_PROJECTION_DIAGNOSTIC_CODES.invalidSourceRing,
        `Coastline ring ${ringId} must contain at least three unique canonical planet-native points and use implicit closure.`,
        ringId,
      ),
    );
  }
}

function projectRing(ring: CanonicalWorldCoastlineRing): readonly AtlasProjectedCoastlinePath[] {
  const first = ring.points[0];
  if (first === undefined) return [];
  let current: AtlasDisplayPoint[] = [projectPoint(first)];
  const completed: AtlasDisplayPoint[][] = [];
  let crossingCount = 0;

  for (let index = 0; index < ring.points.length; index += 1) {
    const start = ring.points[index];
    const end = ring.points[(index + 1) % ring.points.length];
    if (start === undefined || end === undefined) return [];
    const crossing = seamCrossing(start, end);
    if (crossing === undefined) {
      appendDistinct(current, projectPoint(end));
      continue;
    }

    crossingCount += 1;
    appendDistinct(current, displayPoint(crossing.sourceXDisplayTicks, crossing.yDisplayTicks));
    completed.push(current);
    current = [displayPoint(crossing.destinationXDisplayTicks, crossing.yDisplayTicks)];
    appendDistinct(current, projectPoint(end));
  }

  const pointPaths =
    crossingCount === 0
      ? [current]
      : mergeClosedTraversal(current, completed).filter(hasDrawableLength);
  return Object.freeze(
    pointPaths.map((points, sourcePathIndex) =>
      Object.freeze({
        pathId: projectedPathId(ring.ringId, sourcePathIndex),
        sourceRingId: ring.ringId,
        sourceBoundaryFingerprint: ring.sourceBoundaryFingerprint,
        sourceEntityId: ring.landmassId,
        landmassId: ring.landmassId,
        waterBodyIds: Object.freeze([...ring.waterBodyIds]),
        sourcePathIndex,
        isClosed: crossingCount === 0,
        points: Object.freeze(points),
      }),
    ),
  );
}

function mergeClosedTraversal(
  tail: AtlasDisplayPoint[],
  completed: readonly AtlasDisplayPoint[][],
): readonly AtlasDisplayPoint[][] {
  const first = completed[0];
  if (first === undefined) return [tail];
  const merged = [...tail];
  for (const point of first.slice(1)) appendDistinct(merged, point);
  return [merged, ...completed.slice(1)];
}

interface SeamCrossing {
  readonly sourceXDisplayTicks: number;
  readonly destinationXDisplayTicks: number;
  readonly yDisplayTicks: number;
}

function seamCrossing(
  start: { readonly longitudeTicks: number; readonly latitudeTicks: number },
  end: { readonly longitudeTicks: number; readonly latitudeTicks: number },
): SeamCrossing | undefined {
  const canonicalDelta = end.longitudeTicks - start.longitudeTicks;
  if (Math.abs(canonicalDelta) <= PLANET_TICKS_PER_TURN / 2) return undefined;

  const crossesEastward = canonicalDelta < 0;
  const unwrappedEndLongitude =
    end.longitudeTicks + (crossesEastward ? PLANET_TICKS_PER_TURN : -PLANET_TICKS_PER_TURN);
  const seamLongitude = crossesEastward ? -PLANET_LONGITUDE_MIN_TICKS : PLANET_LONGITUDE_MIN_TICKS;
  const latitudeNumerator =
    BigInt(end.latitudeTicks - start.latitudeTicks) * BigInt(seamLongitude - start.longitudeTicks);
  const latitudeDenominator = BigInt(unwrappedEndLongitude - start.longitudeTicks);
  const seamLatitude =
    start.latitudeTicks + roundRationalTiesAwayFromZero(latitudeNumerator, latitudeDenominator);
  const yDisplayTicks = PLANET_LATITUDE_MAX_TICKS - seamLatitude;
  return crossesEastward
    ? {
        sourceXDisplayTicks: ATLAS_DISPLAY_WIDTH_TICKS,
        destinationXDisplayTicks: 0,
        yDisplayTicks,
      }
    : {
        sourceXDisplayTicks: 0,
        destinationXDisplayTicks: ATLAS_DISPLAY_WIDTH_TICKS,
        yDisplayTicks,
      };
}

function roundRationalTiesAwayFromZero(numerator: bigint, denominator: bigint): number {
  const isNegative = numerator < 0n !== denominator < 0n;
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;
  let magnitude = absoluteNumerator / absoluteDenominator;
  if ((absoluteNumerator % absoluteDenominator) * 2n >= absoluteDenominator) magnitude += 1n;
  return Number(isNegative ? -magnitude : magnitude);
}

function projectPoint(point: {
  readonly longitudeTicks: number;
  readonly latitudeTicks: number;
}): AtlasDisplayPoint {
  return displayPoint(
    point.longitudeTicks - PLANET_LONGITUDE_MIN_TICKS,
    PLANET_LATITUDE_MAX_TICKS - point.latitudeTicks,
  );
}

function displayPoint(xDisplayTicks: number, yDisplayTicks: number): AtlasDisplayPoint {
  return Object.freeze({ xDisplayTicks, yDisplayTicks }) as AtlasDisplayPoint;
}

function appendDistinct(points: AtlasDisplayPoint[], point: AtlasDisplayPoint): void {
  const prior = points.at(-1);
  if (prior?.xDisplayTicks !== point.xDisplayTicks || prior.yDisplayTicks !== point.yDisplayTicks) {
    points.push(point);
  }
}

function hasDrawableLength(points: readonly AtlasDisplayPoint[]): boolean {
  const first = points[0];
  return (
    first !== undefined &&
    points.some(
      (point) =>
        point.xDisplayTicks !== first.xDisplayTicks || point.yDisplayTicks !== first.yDisplayTicks,
    )
  );
}

function projectedPathId(ringId: CoastlineRingId, pathIndex: number): AtlasProjectedPathId {
  return `${ringId}/${ATLAS_DISPLAY_PROJECTION_ID}-v${String(ATLAS_DISPLAY_PROJECTION_VERSION)}/path-${String(pathIndex).padStart(4, '0')}` as AtlasProjectedPathId;
}

function diagnostic(
  code: AtlasProjectionDiagnosticCode,
  message: string,
  sourceRingId?: string,
): AtlasProjectionDiagnostic {
  return sourceRingId === undefined ? { code, message } : { code, message, sourceRingId };
}

function compareText(left: string, right: string): -1 | 0 | 1 {
  return left < right ? -1 : left > right ? 1 : 0;
}
