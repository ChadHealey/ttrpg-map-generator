import type { RenderPoint, RenderScene } from '@ttrpg-map/core';

/** Transient Canvas viewport state in render-pixel units. */
export interface ViewportState {
  readonly offsetXPx: number;
  readonly offsetYPx: number;
  readonly zoomRatio: number;
}

export const INITIAL_VIEWPORT: ViewportState = { offsetXPx: 0, offsetYPx: 0, zoomRatio: 1 };

/** Canvas backing-store dimensions, kept in the same render-pixel space as an accepted scene. */
export function canvasBackingStoreDimensions(
  scene: Pick<RenderScene, 'widthPx' | 'heightPx'> | undefined,
  fallback: Readonly<{ widthPx: number; heightPx: number }>,
): Readonly<{ widthPx: number; heightPx: number }> {
  return scene === undefined
    ? fallback
    : Object.freeze({ widthPx: scene.widthPx, heightPx: scene.heightPx });
}

/** Moves the rendered scene by a delta measured in Canvas backing-store pixels. */
export function panViewport(
  viewport: ViewportState,
  deltaXPx: number,
  deltaYPx: number,
): ViewportState {
  return {
    ...viewport,
    offsetXPx: viewport.offsetXPx + deltaXPx,
    offsetYPx: viewport.offsetYPx + deltaYPx,
  };
}

/** Zooms around the scene's visual centre without changing the point beneath it. */
export function zoomViewport(
  viewport: ViewportState,
  factor: number,
  scene: Pick<RenderScene, 'widthPx' | 'heightPx'>,
  minimumZoomRatio: number,
  maximumZoomRatio: number,
): ViewportState {
  const zoomRatio = clamp(viewport.zoomRatio * factor, minimumZoomRatio, maximumZoomRatio);
  const centerXPx = scene.widthPx / 2;
  const centerYPx = scene.heightPx / 2;
  const sceneCenterXPx = (centerXPx - viewport.offsetXPx) / viewport.zoomRatio;
  const sceneCenterYPx = (centerYPx - viewport.offsetYPx) / viewport.zoomRatio;

  return {
    zoomRatio,
    offsetXPx: centerXPx - sceneCenterXPx * zoomRatio,
    offsetYPx: centerYPx - sceneCenterYPx * zoomRatio,
  };
}

/** Converts a pointer delta from CSS pixels to Canvas backing-store pixels. */
export function scaleClientDeltaToCanvas(
  deltaXClientPx: number,
  deltaYClientPx: number,
  canvasWidthPx: number,
  canvasHeightPx: number,
  clientWidthPx: number,
  clientHeightPx: number,
): RenderPoint {
  return {
    xPx: deltaXClientPx * (canvasWidthPx / clientWidthPx),
    yPx: deltaYClientPx * (canvasHeightPx / clientHeightPx),
  };
}

/** Converts a Canvas backing-store point to the untransformed render-scene space. */
export function scenePointFromCanvasPoint(
  canvasPoint: RenderPoint,
  viewport: ViewportState,
): RenderPoint {
  return {
    xPx: (canvasPoint.xPx - viewport.offsetXPx) / viewport.zoomRatio,
    yPx: (canvasPoint.yPx - viewport.offsetYPx) / viewport.zoomRatio,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
