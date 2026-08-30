import { inkedProofScene, type RenderScene } from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import { findTopmostNodeAt } from './scene-selection.js';
import {
  canvasBackingStoreDimensions,
  INITIAL_VIEWPORT,
  panViewport,
  scaleClientDeltaToCanvas,
  scenePointFromCanvasPoint,
  zoomViewport,
} from './viewport.js';

describe('desktop viewport interactions', () => {
  it('uses the accepted scene dimensions for the Canvas backing store', () => {
    const atlasScene: Pick<RenderScene, 'widthPx' | 'heightPx'> = {
      widthPx: 2_048,
      heightPx: 1_024,
    };
    const previewDimensions = { widthPx: 1_600, heightPx: 800 };

    expect(canvasBackingStoreDimensions(atlasScene, previewDimensions)).toEqual(atlasScene);
    expect(canvasBackingStoreDimensions(undefined, previewDimensions)).toBe(previewDimensions);
  });

  it('converts responsive drag deltas into Canvas backing-store pixels', () => {
    expect(scaleClientDeltaToCanvas(100, 50, 960, 600, 480, 300)).toEqual({
      xPx: 200,
      yPx: 100,
    });
  });

  it('zooms around the scene centre and clamps the permitted scale', () => {
    expect(zoomViewport(INITIAL_VIEWPORT, 1.2, inkedProofScene, 0.5, 3)).toEqual({
      offsetXPx: -96,
      offsetYPx: -60,
      zoomRatio: 1.2,
    });
    expect(zoomViewport(INITIAL_VIEWPORT, 20, inkedProofScene, 0.5, 3).zoomRatio).toBe(3);
  });

  it('maps a Canvas point through the viewport before selecting its topmost node', () => {
    const viewport = panViewport(
      zoomViewport(INITIAL_VIEWPORT, 1.2, inkedProofScene, 0.5, 3),
      64,
      0,
    );
    const canvasPoint = { xPx: 712, yPx: 252 };
    const scenePoint = scenePointFromCanvasPoint(canvasPoint, viewport);

    expect(findTopmostNodeAt(inkedProofScene, scenePoint)?.id).toBe('proof-river');
  });

  it('chooses labels over the lower scene nodes in render order', () => {
    expect(findTopmostNodeAt(inkedProofScene, { xPx: 480, yPx: 550 })?.id).toBe('proof-title');
  });

  it('selects compound land fills without selecting their even-odd water holes', () => {
    const scene: RenderScene = {
      widthPx: 10,
      heightPx: 10,
      nodes: [
        {
          id: 'land',
          kind: 'compoundPath',
          sourceId: 'landmass-id',
          subpaths: [
            {
              points: [
                { xPx: 0, yPx: 0 },
                { xPx: 10, yPx: 0 },
                { xPx: 10, yPx: 10 },
                { xPx: 0, yPx: 10 },
              ],
            },
            {
              points: [
                { xPx: 4, yPx: 4 },
                { xPx: 6, yPx: 4 },
                { xPx: 6, yPx: 6 },
                { xPx: 4, yPx: 6 },
              ],
            },
          ],
          fillColor: '#d9d2a7',
          fillRule: 'evenodd',
        },
      ],
    };

    expect(findTopmostNodeAt(scene, { xPx: 2, yPx: 2 })?.sourceId).toBe('landmass-id');
    expect(findTopmostNodeAt(scene, { xPx: 5, yPx: 5 })).toBeUndefined();
  });
});
