import { inkedProofScene } from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import { findTopmostNodeAt } from './scene-selection.js';
import {
  INITIAL_VIEWPORT,
  panViewport,
  scaleClientDeltaToCanvas,
  scenePointFromCanvasPoint,
  zoomViewport,
} from './viewport.js';

describe('desktop viewport interactions', () => {
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
});
