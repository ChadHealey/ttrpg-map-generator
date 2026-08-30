import {
  createWorldRadius,
  parseStableId,
  type RootSurfaceId,
  type WorldRadius,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import {
  activateAtlasFootprintSelector,
  ATLAS_FOOTPRINT_SELECTOR_CURSOR_STEP_PX,
  type AtlasFootprintSelectorSource,
  cancelAtlasFootprintSelector,
  moveAtlasFootprintSelectorCursor,
  selectAtlasFootprintAt,
} from './atlas-footprint-selector.js';
import {
  INITIAL_VIEWPORT,
  panViewport,
  scaleClientDeltaToCanvas,
  scenePointFromCanvasPoint,
  zoomViewport,
} from './viewport.js';

const SCENE = { widthPx: 2_048, heightPx: 1_024 };
const SOURCE: AtlasFootprintSelectorSource = {
  rootSurfaceId: requiredRootSurfaceId('00000000-0000-4000-8000-0000000003ab'),
  worldRadius: requiredWorldRadius(6_366),
};

describe('transient atlas footprint selector', () => {
  it('creates the same frozen canonical candidate for pointer and keyboard scene locations', () => {
    const pointer = selectAtlasFootprintAt(activateAtlasFootprintSelector(SCENE), SOURCE, SCENE, {
      xPx: 1_088,
      yPx: 448,
    });
    const keyboard = selectAtlasFootprintAt(
      moveAtlasFootprintSelectorCursor(
        activateAtlasFootprintSelector(SCENE),
        ATLAS_FOOTPRINT_SELECTOR_CURSOR_STEP_PX,
        -ATLAS_FOOTPRINT_SELECTOR_CURSOR_STEP_PX,
        SCENE,
      ),
      SOURCE,
      SCENE,
      { xPx: 1_088, yPx: 448 },
    );

    expect(pointer.candidate).toEqual(keyboard.candidate);
    expect(pointer.candidate?.footprint.origin).toMatchObject({
      longitudeTicks: 134_217_728,
      latitudeTicks: 134_217_728,
    });
    expect(Object.isFrozen(pointer.candidate?.footprint)).toBe(true);
    expect(pointer.candidate?.entityId).toMatch(/^.{8}-.{4}-.{4}-.{4}-.{12}$/);
  });

  it('uses a conservative square extent and keeps its seam overlay display-safe', () => {
    const selected = selectAtlasFootprintAt(activateAtlasFootprintSelector(SCENE), SOURCE, SCENE, {
      xPx: SCENE.widthPx - 1,
      yPx: SCENE.heightPx / 2,
    });
    const footprint = selected.candidate?.footprint;

    expect(footprint).toBeDefined();
    if (footprint === undefined) throw new Error('Expected a valid selector footprint.');
    expect(footprint.extent.minXMillimeters).toBe(-footprint.extent.maxXMillimeters);
    expect(footprint.extent.minYMillimeters).toBe(-footprint.extent.maxYMillimeters);
    expect(footprint.extent.maxXMillimeters).toBeLessThanOrEqual(
      Math.floor((SOURCE.worldRadius.radiusMillimeters * Math.PI) / 4),
    );
    expect(selected.candidate?.overlayPaths.length).toBeGreaterThan(1);
    for (const path of selected.candidate?.overlayPaths ?? []) {
      for (let index = 1; index < path.points.length; index += 1) {
        const prior = path.points[index - 1];
        const point = path.points[index];
        expect(prior).toBeDefined();
        expect(point).toBeDefined();
        if (prior === undefined || point === undefined) {
          throw new Error('Expected each overlay path segment to have two points.');
        }
        expect(Math.abs(point.xPx - prior.xPx)).toBeLessThanOrEqual(SCENE.widthPx / 2);
      }
    }
  });

  it('keeps the candidate canonical across CSS scaling and viewport pan or zoom', () => {
    const scenePoint = { xPx: 1_088, yPx: 448 };
    const viewport = panViewport(zoomViewport(INITIAL_VIEWPORT, 1.2, SCENE, 0.5, 3), 64, -32);
    const canvasPoint = {
      xPx: scenePoint.xPx * viewport.zoomRatio + viewport.offsetXPx,
      yPx: scenePoint.yPx * viewport.zoomRatio + viewport.offsetYPx,
    };
    const clientPoint = { xPx: canvasPoint.xPx / 2, yPx: canvasPoint.yPx / 2 };
    const recoveredScenePoint = scenePointFromCanvasPoint(
      scaleClientDeltaToCanvas(clientPoint.xPx, clientPoint.yPx, 2_048, 1_024, 1_024, 512),
      viewport,
    );
    const direct = selectAtlasFootprintAt(
      activateAtlasFootprintSelector(SCENE),
      SOURCE,
      SCENE,
      scenePoint,
    );
    const transformed = selectAtlasFootprintAt(
      activateAtlasFootprintSelector(SCENE),
      SOURCE,
      SCENE,
      recoveredScenePoint,
    );

    expect(transformed.candidate).toEqual(direct.candidate);
  });

  it('creates a valid pole-origin candidate without retaining a display longitude', () => {
    const selected = selectAtlasFootprintAt(activateAtlasFootprintSelector(SCENE), SOURCE, SCENE, {
      xPx: 640,
      yPx: 0,
    });

    expect(selected.candidate?.footprint.origin).toMatchObject({
      longitudeTicks: 0,
      latitudeTicks: 2 ** 30,
    });
    expect(selected.candidate?.overlayPaths.length).toBeGreaterThan(0);
  });

  it('retains the prior candidate on invalid revision and cancellation discards only selector state', () => {
    const accepted = selectAtlasFootprintAt(activateAtlasFootprintSelector(SCENE), SOURCE, SCENE, {
      xPx: SCENE.widthPx / 2,
      yPx: SCENE.heightPx / 2,
    });
    const invalid = selectAtlasFootprintAt(accepted, SOURCE, SCENE, {
      xPx: SCENE.widthPx + 0.1,
      yPx: 0,
    });

    expect(invalid.candidate).toEqual(accepted.candidate);
    expect(invalid.diagnostic?.code).toBe('atlas-projection.display-point.invalid');
    expect(cancelAtlasFootprintSelector()).toEqual({
      mode: 'inactive',
      cursor: undefined,
      candidate: undefined,
      diagnostic: undefined,
    });
  });

  it('clamps keyboard cursor movement to the atlas boundary', () => {
    const state = moveAtlasFootprintSelectorCursor(
      activateAtlasFootprintSelector(SCENE),
      -10_000,
      10_000,
      SCENE,
    );

    expect(state.cursor).toEqual({ xPx: 0, yPx: SCENE.heightPx });
  });
});

function requiredRootSurfaceId(value: string): RootSurfaceId {
  const result = parseStableId('root-surface', value);
  if (!result.ok) throw new Error(result.diagnostic.message);
  return result.value;
}

function requiredWorldRadius(value: number): WorldRadius {
  const result = createWorldRadius(value);
  if (!result.ok) throw new Error(result.diagnostic.message);
  return result.value;
}
