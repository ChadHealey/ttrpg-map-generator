import { describe, expect, it } from 'vitest';

import { renderSceneToDeterministicPng } from './render-scene-png.mjs';

const scene = Object.freeze({
  widthPx: 4,
  heightPx: 3,
  nodes: Object.freeze([
    Object.freeze({
      id: 'paper',
      kind: 'rectangle',
      sourceId: 'source',
      xPx: 0,
      yPx: 0,
      widthPx: 4,
      heightPx: 3,
      fillColor: '#ffffff',
    }),
    Object.freeze({
      id: 'shape',
      kind: 'polygon',
      sourceId: 'source',
      points: Object.freeze([
        Object.freeze({ xPx: 0.5, yPx: 0.5 }),
        Object.freeze({ xPx: 3.5, yPx: 0.5 }),
        Object.freeze({ xPx: 2, yPx: 2.5 }),
      ]),
      paint: Object.freeze({ fillColor: '#d7dfb3', strokeColor: '#27261f', strokeWidthPx: 1 }),
    }),
  ]),
});

describe('deterministic visual evidence rasterizer', () => {
  it('emits stable RGBA PNG bytes with the RenderScene dimensions', () => {
    const first = renderSceneToDeterministicPng(scene);
    const second = renderSceneToDeterministicPng(scene);

    expect(first).toEqual(second);
    expect([...first.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(first.readUInt32BE(16)).toBe(4);
    expect(first.readUInt32BE(20)).toBe(3);
    expect(first[24]).toBe(2);
    expect(first[25]).toBe(3);
  });
});
