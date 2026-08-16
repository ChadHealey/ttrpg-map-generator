/** Seam-, pole-, and membership-safe land-fill geometry for whole-world atlas scenes. */

import {
  ATLAS_FULL_LATITUDE_BAND_COUNT,
  ATLAS_FULL_LONGITUDE_CELL_COUNT,
  ATLAS_FULL_SAMPLE_COUNT,
  type Landmass,
  type RenderPoint,
  type RenderSubpath,
} from '@ttrpg-map/core';

import {
  ATLAS_DISPLAY_HEIGHT_TICKS,
  ATLAS_DISPLAY_WIDTH_TICKS,
  type AtlasDisplayPoint,
  type AtlasProjectedCoastlinePath,
} from './atlas-display-projection.js';

export type AtlasLandFillSubpathsResult =
  | { readonly ok: true; readonly value: readonly RenderSubpath[] }
  | { readonly ok: false; readonly sourceId: string; readonly message: string };

/** Close projected ring pieces and select the spherical side containing accepted land. */
export function createAtlasLandFillSubpaths(
  landmass: Landmass,
  paths: readonly AtlasProjectedCoastlinePath[],
  widthPx: number,
  heightPx: number,
): AtlasLandFillSubpathsResult {
  const subpaths: RenderSubpath[] = [];
  for (const path of paths) {
    const closed = closeProjectedFillPath(path, widthPx, heightPx);
    if (!closed.ok) return closed;
    subpaths.push(closed.value);
  }
  if (subpaths.length === 0) {
    return invalid(
      landmass.entityId,
      `Landmass ${landmass.entityId} has no source-linked projected coastline path.`,
    );
  }

  const witness = landmassWitnessPoint(landmass, widthPx, heightPx);
  if (!isPointInSubpaths(witness, subpaths)) {
    subpaths.unshift(fullSceneSubpath(widthPx, heightPx));
  }
  if (!isPointInSubpaths(witness, subpaths)) {
    return invalid(
      landmass.entityId,
      `Landmass ${landmass.entityId} fill does not contain its accepted membership witness.`,
    );
  }
  return { ok: true, value: Object.freeze(subpaths) };
}

export function atlasDisplayPointToRenderPoint(
  point: AtlasDisplayPoint,
  widthPx: number,
  heightPx: number,
): RenderPoint {
  return Object.freeze({
    xPx: (point.xDisplayTicks * widthPx) / ATLAS_DISPLAY_WIDTH_TICKS,
    yPx: (point.yDisplayTicks * heightPx) / ATLAS_DISPLAY_HEIGHT_TICKS,
  });
}

function closeProjectedFillPath(
  path: AtlasProjectedCoastlinePath,
  widthPx: number,
  heightPx: number,
):
  | { readonly ok: true; readonly value: RenderSubpath }
  | { readonly ok: false; readonly sourceId: string; readonly message: string } {
  const points = path.points.map((point) =>
    atlasDisplayPointToRenderPoint(point, widthPx, heightPx),
  );
  if (points.length < 2) return invalid(path.pathId, `Projected path ${path.pathId} is too short.`);
  if (path.isClosed) {
    const first = points[0];
    const last = points.at(-1);
    if (first !== undefined && last !== undefined && samePoint(first, last)) points.pop();
  } else {
    const start = path.points[0];
    const end = path.points.at(-1);
    if (start === undefined || end === undefined || !isSeamPoint(start) || !isSeamPoint(end)) {
      return invalid(
        path.pathId,
        `Open projected path ${path.pathId} must terminate at the canonical display seam.`,
      );
    }
    if (start.xDisplayTicks !== end.xDisplayTicks) {
      const boundaryY =
        start.xDisplayTicks === 0 && end.xDisplayTicks === ATLAS_DISPLAY_WIDTH_TICKS ? 0 : heightPx;
      points.push(
        Object.freeze({ xPx: points.at(-1)?.xPx ?? 0, yPx: boundaryY }),
        Object.freeze({ xPx: points[0]?.xPx ?? 0, yPx: boundaryY }),
      );
    }
  }
  if (new Set(points.map(pointKey)).size < 3) {
    return invalid(path.pathId, `Projected path ${path.pathId} does not enclose a fill area.`);
  }
  return { ok: true, value: Object.freeze({ points: Object.freeze(points) }) };
}

function landmassWitnessPoint(landmass: Landmass, widthPx: number, heightPx: number): RenderPoint {
  let fallback: number | undefined;
  for (const range of landmass.membership.sampleRanges) {
    const candidates = [
      range.startIndex,
      Math.floor((range.startIndex + range.endIndexExclusive - 1) / 2),
      range.endIndexExclusive - 1,
    ];
    for (const index of candidates) {
      if (index <= 0 || index >= ATLAS_FULL_SAMPLE_COUNT - 1) continue;
      fallback ??= index;
      if ((index - 1) % ATLAS_FULL_LONGITUDE_CELL_COUNT !== 0) {
        return sampleIndexToRenderPoint(index, widthPx, heightPx);
      }
    }
  }
  if (fallback !== undefined) return sampleIndexToRenderPoint(fallback, widthPx, heightPx);
  const ownsSouthPole = landmass.membership.sampleRanges.some(
    ({ startIndex, endIndexExclusive }) => startIndex === 0 && endIndexExclusive > 0,
  );
  return Object.freeze({ xPx: widthPx / 2, yPx: ownsSouthPole ? heightPx : 0 });
}

function sampleIndexToRenderPoint(index: number, widthPx: number, heightPx: number): RenderPoint {
  const interiorIndex = index - 1;
  const latitudeIndex = Math.floor(interiorIndex / ATLAS_FULL_LONGITUDE_CELL_COUNT) + 1;
  const longitudeIndex = interiorIndex % ATLAS_FULL_LONGITUDE_CELL_COUNT;
  return Object.freeze({
    xPx: (longitudeIndex * widthPx) / ATLAS_FULL_LONGITUDE_CELL_COUNT,
    yPx:
      ((ATLAS_FULL_LATITUDE_BAND_COUNT - latitudeIndex) * heightPx) /
      ATLAS_FULL_LATITUDE_BAND_COUNT,
  });
}

function fullSceneSubpath(widthPx: number, heightPx: number): RenderSubpath {
  return Object.freeze({
    points: Object.freeze([
      Object.freeze({ xPx: 0, yPx: 0 }),
      Object.freeze({ xPx: widthPx, yPx: 0 }),
      Object.freeze({ xPx: widthPx, yPx: heightPx }),
      Object.freeze({ xPx: 0, yPx: heightPx }),
    ]),
  });
}

function isPointInSubpaths(point: RenderPoint, subpaths: readonly RenderSubpath[]): boolean {
  return subpaths.reduce(
    (isInside, subpath) => isPointInPolygon(point, subpath.points) !== isInside,
    false,
  );
}

function isPointInPolygon(point: RenderPoint, points: readonly RenderPoint[]): boolean {
  let isInside = false;
  for (
    let currentIndex = 0, previousIndex = points.length - 1;
    currentIndex < points.length;
    previousIndex = currentIndex, currentIndex += 1
  ) {
    const current = points[currentIndex];
    const previous = points[previousIndex];
    if (current === undefined || previous === undefined) continue;
    const intersects =
      current.yPx > point.yPx !== previous.yPx > point.yPx &&
      point.xPx <
        ((previous.xPx - current.xPx) * (point.yPx - current.yPx)) / (previous.yPx - current.yPx) +
          current.xPx;
    if (intersects) isInside = !isInside;
  }
  return isInside;
}

function isSeamPoint(point: AtlasDisplayPoint): boolean {
  return point.xDisplayTicks === 0 || point.xDisplayTicks === ATLAS_DISPLAY_WIDTH_TICKS;
}

function samePoint(left: RenderPoint, right: RenderPoint): boolean {
  return left.xPx === right.xPx && left.yPx === right.yPx;
}

function pointKey(point: RenderPoint): string {
  return `${String(point.xPx)}:${String(point.yPx)}`;
}

function invalid(sourceId: string, message: string) {
  return { ok: false, sourceId, message } as const;
}
