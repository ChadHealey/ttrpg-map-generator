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
  type PlanetPoint,
  type RenderPoint,
  type RenderScene,
  roundTiesAwayFromZero,
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

/** One seam-safe disposable display path derived from canonical planet-native points. */
export interface AtlasProjectedDisplayPath {
  /** Closed paths repeat their first point exactly; seam-split paths remain open. */
  readonly isClosed: boolean;
  readonly points: readonly AtlasDisplayPoint[];
}

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
  invalidDisplayPoint: 'atlas-projection.display-point.invalid',
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

export type AtlasDisplayPointResult =
  | { readonly ok: true; readonly value: PlanetPoint }
  | { readonly ok: false; readonly diagnostic: AtlasProjectionDiagnostic };

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

/** Convert one canonical planet point into the disposable atlas display coordinate system. */
export function atlasDisplayPointFromPlanetPoint(point: PlanetPoint): AtlasDisplayPoint {
  return projectPoint(point);
}

/**
 * Convert one integer atlas-display location into a canonical planet point.
 *
 * The right display edge is the same canonical longitude as the left seam. Display coordinates
 * remain disposable and are never returned as part of the authoritative result.
 */
export function planetPointFromAtlasDisplayPoint(input: {
  readonly xDisplayTicks: number;
  readonly yDisplayTicks: number;
}): AtlasDisplayPointResult {
  if (
    !Number.isSafeInteger(input.xDisplayTicks) ||
    !Number.isSafeInteger(input.yDisplayTicks) ||
    input.xDisplayTicks < 0 ||
    input.xDisplayTicks > ATLAS_DISPLAY_WIDTH_TICKS ||
    input.yDisplayTicks < 0 ||
    input.yDisplayTicks > ATLAS_DISPLAY_HEIGHT_TICKS
  ) {
    return invalidDisplayPoint();
  }
  const latitudeTicks = PLANET_LATITUDE_MAX_TICKS - input.yDisplayTicks;
  const longitudeTicks =
    input.xDisplayTicks === ATLAS_DISPLAY_WIDTH_TICKS
      ? PLANET_LONGITUDE_MIN_TICKS
      : input.xDisplayTicks + PLANET_LONGITUDE_MIN_TICKS;
  const result = parsePlanetPoint({
    longitudeTicks: Math.abs(latitudeTicks) === PLANET_LATITUDE_MAX_TICKS ? 0 : longitudeTicks,
    latitudeTicks,
  });
  return result.ok ? { ok: true, value: result.value } : invalidDisplayPoint();
}

/** Convert a render-scene location through the version-1 disposable atlas display projection. */
export function planetPointFromAtlasScenePoint(
  point: RenderPoint,
  scene: Pick<RenderScene, 'widthPx' | 'heightPx'>,
): AtlasDisplayPointResult {
  if (
    !Number.isFinite(point.xPx) ||
    !Number.isFinite(point.yPx) ||
    !Number.isFinite(scene.widthPx) ||
    !Number.isFinite(scene.heightPx) ||
    scene.widthPx <= 0 ||
    scene.heightPx <= 0 ||
    point.xPx < 0 ||
    point.xPx > scene.widthPx ||
    point.yPx < 0 ||
    point.yPx > scene.heightPx
  ) {
    return invalidDisplayPoint();
  }
  return planetPointFromAtlasDisplayPoint({
    xDisplayTicks: roundTiesAwayFromZero((point.xPx * ATLAS_DISPLAY_WIDTH_TICKS) / scene.widthPx),
    yDisplayTicks: roundTiesAwayFromZero((point.yPx * ATLAS_DISPLAY_HEIGHT_TICKS) / scene.heightPx),
  });
}

/** Convert one disposable display point into renderer-owned scene pixel coordinates. */
export function atlasScenePointFromDisplayPoint(
  point: AtlasDisplayPoint,
  scene: Pick<RenderScene, 'widthPx' | 'heightPx'>,
): RenderPoint {
  return Object.freeze({
    xPx: (point.xDisplayTicks * scene.widthPx) / ATLAS_DISPLAY_WIDTH_TICKS,
    yPx: (point.yDisplayTicks * scene.heightPx) / ATLAS_DISPLAY_HEIGHT_TICKS,
  });
}

/** Project an open or closed planet-native path without allowing a seam-spanning display edge. */
export function projectAtlasPlanetPolyline(
  points: readonly PlanetPoint[],
  isClosed: boolean,
): readonly AtlasProjectedDisplayPath[] {
  const minimumLength = isClosed ? 3 : 2;
  if (points.length < minimumLength) return Object.freeze([]);

  const first = points[0];
  if (first === undefined) return Object.freeze([]);
  let current: AtlasDisplayPoint[] = [projectPoint(first)];
  const completed: AtlasDisplayPoint[][] = [];
  let crossingCount = 0;
  const segmentCount = isClosed ? points.length : points.length - 1;

  for (let index = 0; index < segmentCount; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    if (start === undefined || end === undefined) return Object.freeze([]);
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

  const paths =
    isClosed && crossingCount > 0
      ? mergeClosedTraversal(current, completed).filter(hasDrawableLength)
      : [...completed, current].filter(hasDrawableLength);
  return Object.freeze(
    paths.map((path) =>
      Object.freeze({
        isClosed: isClosed && crossingCount === 0,
        points: Object.freeze(path),
      }),
    ),
  );
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
  const pointPaths = projectAtlasPlanetPolyline(ring.points, true);
  return Object.freeze(
    pointPaths.map((path, sourcePathIndex) =>
      Object.freeze({
        pathId: projectedPathId(ring.ringId, sourcePathIndex),
        sourceRingId: ring.ringId,
        sourceBoundaryFingerprint: ring.sourceBoundaryFingerprint,
        sourceEntityId: ring.landmassId,
        landmassId: ring.landmassId,
        waterBodyIds: Object.freeze([...ring.waterBodyIds]),
        sourcePathIndex,
        isClosed: path.isClosed,
        points: path.points,
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

function invalidDisplayPoint(): AtlasDisplayPointResult {
  return {
    ok: false,
    diagnostic: diagnostic(
      ATLAS_PROJECTION_DIAGNOSTIC_CODES.invalidDisplayPoint,
      'Atlas display coordinates must be canonical integer ticks inside the version-1 display bounds.',
    ),
  };
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
