/** Transient, accessible atlas footprint selection state with no accepted-document mutation. */

import {
  createRegionalExtent,
  createRegionalFootprintTransform,
  deriveRegionalFootprintEntityId,
  type EntityId,
  parseRegionalPoint,
  parseRegionalRectangleFootprint,
  type PlanetPoint,
  REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES,
  type RegionalExtent,
  type RegionalRectangleFootprint,
  type RenderPoint,
  type RenderScene,
  type RootSurfaceId,
  type WorldRadius,
} from '@ttrpg-map/core';
import {
  atlasScenePointFromDisplayPoint,
  planetPointFromAtlasScenePoint,
  projectAtlasPlanetPolyline,
} from '@ttrpg-map/render';

export const ATLAS_FOOTPRINT_SELECTOR_CURSOR_STEP_PX = 64;

export interface AtlasFootprintSelectorSource {
  readonly rootSurfaceId: RootSurfaceId;
  readonly worldRadius: WorldRadius;
}

export interface AtlasFootprintOverlayPath {
  readonly isClosed: boolean;
  readonly points: readonly RenderPoint[];
}

export interface AtlasFootprintCandidate {
  readonly footprint: RegionalRectangleFootprint;
  readonly entityId: EntityId;
  readonly overlayPaths: readonly AtlasFootprintOverlayPath[];
}

export interface AtlasFootprintSelectorDiagnostic {
  readonly code: string;
  readonly message: string;
}

export interface AtlasFootprintSelectorState {
  readonly mode: 'inactive' | 'active';
  readonly cursor: RenderPoint | undefined;
  readonly candidate: AtlasFootprintCandidate | undefined;
  readonly diagnostic: AtlasFootprintSelectorDiagnostic | undefined;
}

/** Start a transient selector at the current atlas centre without selecting a footprint. */
export function activateAtlasFootprintSelector(
  scene: Pick<RenderScene, 'widthPx' | 'heightPx'>,
): AtlasFootprintSelectorState {
  return Object.freeze({
    mode: 'active',
    cursor: Object.freeze({ xPx: scene.widthPx / 2, yPx: scene.heightPx / 2 }),
    candidate: undefined,
    diagnostic: undefined,
  });
}

/** Discard all selector-only state without mutating the accepted atlas. */
export function cancelAtlasFootprintSelector(): AtlasFootprintSelectorState {
  return Object.freeze({
    mode: 'inactive',
    cursor: undefined,
    candidate: undefined,
    diagnostic: undefined,
  });
}

/** Move the keyboard cursor in scene pixels while preserving the candidate until revision. */
export function moveAtlasFootprintSelectorCursor(
  state: AtlasFootprintSelectorState,
  deltaXPx: number,
  deltaYPx: number,
  scene: Pick<RenderScene, 'widthPx' | 'heightPx'>,
): AtlasFootprintSelectorState {
  if (state.mode !== 'active' || state.cursor === undefined) return state;
  return Object.freeze({
    ...state,
    cursor: Object.freeze({
      xPx: clamp(state.cursor.xPx + deltaXPx, 0, scene.widthPx),
      yPx: clamp(state.cursor.yPx + deltaYPx, 0, scene.heightPx),
    }),
    diagnostic: undefined,
  });
}

/**
 * Create or revise a transient candidate from either pointer or keyboard scene coordinates.
 *
 * A failed revision retains the prior valid candidate and reports only a stable diagnostic.
 */
export function selectAtlasFootprintAt(
  state: AtlasFootprintSelectorState,
  source: AtlasFootprintSelectorSource,
  scene: Pick<RenderScene, 'widthPx' | 'heightPx'>,
  scenePoint: RenderPoint,
): AtlasFootprintSelectorState {
  if (state.mode !== 'active') return state;
  const result = createCandidate(source, scene, scenePoint);
  if (!result.ok) {
    return Object.freeze({
      ...state,
      cursor: scenePoint,
      diagnostic: result.diagnostic,
    });
  }
  return Object.freeze({
    mode: 'active',
    cursor: scenePoint,
    candidate: result.value,
    diagnostic: undefined,
  });
}

function createCandidate(
  source: AtlasFootprintSelectorSource,
  scene: Pick<RenderScene, 'widthPx' | 'heightPx'>,
  scenePoint: RenderPoint,
):
  | { readonly ok: true; readonly value: AtlasFootprintCandidate }
  | { readonly ok: false; readonly diagnostic: AtlasFootprintSelectorDiagnostic } {
  const origin = planetPointFromAtlasScenePoint(scenePoint, scene);
  if (!origin.ok) return { ok: false, diagnostic: origin.diagnostic };

  const extent = conservativeSquareExtent(source.worldRadius);
  if (!extent.ok) return extent;
  const footprint = parseRegionalRectangleFootprint({
    shapeVersion: 'regional-rectangle-v1',
    rootSurfaceId: source.rootSurfaceId,
    worldRadius: source.worldRadius,
    origin: origin.value,
    extent: extent.value,
    transformId: 'planet-regional-azimuthal-equidistant',
    transformVersion: 1,
  });
  if (!footprint.ok) return { ok: false, diagnostic: footprint.diagnostic };

  const boundary = footprintBoundary(footprint.value);
  if (!boundary.ok) return boundary;
  const overlayPaths = projectAtlasPlanetPolyline(boundary.value, true).map((path) =>
    Object.freeze({
      isClosed: path.isClosed,
      points: Object.freeze(
        path.points.map((point) => atlasScenePointFromDisplayPoint(point, scene)),
      ),
    }),
  );
  return {
    ok: true,
    value: Object.freeze({
      footprint: footprint.value,
      entityId: deriveRegionalFootprintEntityId(footprint.value),
      overlayPaths: Object.freeze(overlayPaths),
    }),
  };
}

function conservativeSquareExtent(
  radius: WorldRadius,
):
  | { readonly ok: true; readonly value: RegionalExtent }
  | { readonly ok: false; readonly diagnostic: AtlasFootprintSelectorDiagnostic } {
  const axisLimitMillimeters = Math.floor((radius.radiusMillimeters * Math.PI) / 4);
  const halfSideMillimeters = Math.floor(axisLimitMillimeters / 8);
  if (halfSideMillimeters <= 0) {
    return selectorFailure(
      REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES.extentLimit,
      'The accepted world radius cannot form the minimum selector footprint.',
    );
  }
  const extent = createRegionalExtent(
    -halfSideMillimeters,
    halfSideMillimeters,
    -halfSideMillimeters,
    halfSideMillimeters,
  );
  return extent.ok
    ? { ok: true, value: extent.value }
    : selectorFailure(REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES.extentLimit, extent.diagnostic.message);
}

function footprintBoundary(
  footprint: RegionalRectangleFootprint,
):
  | { readonly ok: true; readonly value: readonly PlanetPoint[] }
  | { readonly ok: false; readonly diagnostic: AtlasFootprintSelectorDiagnostic } {
  const transform = createRegionalFootprintTransform(footprint);
  const extent = footprint.extent;
  const corners = [
    parseRegionalPoint({
      xMillimeters: extent.minXMillimeters,
      yMillimeters: extent.minYMillimeters,
    }),
    parseRegionalPoint({
      xMillimeters: extent.maxXMillimeters,
      yMillimeters: extent.minYMillimeters,
    }),
    parseRegionalPoint({
      xMillimeters: extent.maxXMillimeters,
      yMillimeters: extent.maxYMillimeters,
    }),
    parseRegionalPoint({
      xMillimeters: extent.minXMillimeters,
      yMillimeters: extent.maxYMillimeters,
    }),
  ];
  const regionalCorners = [];
  for (const corner of corners) {
    if (!corner.ok) {
      return selectorFailure(
        REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES.transformDomain,
        'The selector could not reconstruct a canonical footprint boundary.',
      );
    }
    regionalCorners.push(corner.value);
  }
  const boundaryPoints = [];
  for (const corner of regionalCorners) {
    const point = transform.inverse(corner);
    if (!point.ok) {
      return selectorFailure(
        REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES.transformDomain,
        'The selector footprint boundary lies outside the approved transform domain.',
      );
    }
    boundaryPoints.push(point.value);
  }
  return { ok: true, value: Object.freeze(boundaryPoints) };
}

function selectorFailure(
  code: string,
  message: string,
): { readonly ok: false; readonly diagnostic: AtlasFootprintSelectorDiagnostic } {
  return { ok: false, diagnostic: Object.freeze({ code, message }) };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
