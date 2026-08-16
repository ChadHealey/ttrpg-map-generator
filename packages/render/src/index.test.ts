import { inkedProofScene, type RenderScene } from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import { renderSceneToCanvas, renderSceneToSvg } from './index.js';

describe('render scene backends', () => {
  it('interprets the fixed proof scene in Canvas node order', () => {
    const context = new RecordingCanvasContext();

    renderSceneToCanvas(context as unknown as CanvasRenderingContext2D, inkedProofScene);

    expect(context.operations).toEqual([
      'fillStyle:#f3e7c6',
      'fillRect:0,0,960,600',
      'beginPath',
      'moveTo:124,341',
      'lineTo:202,228',
      'lineTo:334,169',
      'lineTo:507,185',
      'lineTo:677,128',
      'lineTo:843,229',
      'lineTo:814,365',
      'lineTo:694,457',
      'lineTo:528,429',
      'lineTo:365,488',
      'lineTo:201,432',
      'closePath',
      'fillStyle:#cbd7a2',
      'fill',
      'strokeStyle:#2c2a20',
      'lineWidth:5',
      'lineJoin:round',
      'stroke',
      'beginPath',
      'moveTo:639,171',
      'lineTo:609,222',
      'lineTo:625,269',
      'lineTo:584,318',
      'lineTo:596,380',
      'lineTo:564,427',
      'strokeStyle:#2d6170',
      'lineWidth:7',
      'lineJoin:round',
      'lineCap:round',
      'stroke',
      'fillStyle:#302d21',
      'font:600 35px Georgia, serif',
      'textAlign:center',
      'fillText:The Verdant Reach,480,550',
    ]);
  });

  it('serializes the fixed proof scene as canonical SVG in node order', () => {
    expect(renderSceneToSvg(inkedProofScene)).toBe(
      `
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600" role="img" aria-label="Inked map scene">
  <rect data-render-node-id="proof-paper" data-source-id="proof:paper" x="0" y="0" width="960" height="600" fill="#f3e7c6"/>
  <polygon data-render-node-id="proof-island" data-source-id="proof:island" points="124,341 202,228 334,169 507,185 677,128 843,229 814,365 694,457 528,429 365,488 201,432" fill="#cbd7a2" stroke="#2c2a20" stroke-width="5" stroke-linejoin="round"/>
  <polyline data-render-node-id="proof-river" data-source-id="proof:river" points="639,171 609,222 625,269 584,318 596,380 564,427" fill="none" stroke="#2d6170" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <text data-render-node-id="proof-title" data-source-id="proof:label" x="480" y="550" fill="#302d21" font-family="Georgia, serif" font-size="35" font-weight="600" text-anchor="middle">The Verdant Reach</text>
</svg>`.trim(),
    );
  });

  it('escapes text and attribute content without changing node order', () => {
    const scene: RenderScene = {
      widthPx: 1,
      heightPx: 1,
      nodes: [
        {
          id: 'first&node',
          kind: 'label',
          sourceId: 'source<id',
          text: 'A < B & C',
          position: { xPx: 0, yPx: 1 },
          fontFamily: 'Example "Font"',
          fontSizePx: 1,
          fontWeight: 400,
          fillColor: '#000000',
          textAnchor: 'start',
        },
      ],
    };

    expect(renderSceneToSvg(scene)).toContain(
      'data-render-node-id="first&amp;node" data-source-id="source&lt;id"',
    );
    expect(renderSceneToSvg(scene)).toContain('font-family="Example &quot;Font&quot;"');
    expect(renderSceneToSvg(scene)).toContain('>A &lt; B &amp; C</text>');
  });

  it('fills one source-linked compound path with identical Canvas and SVG semantics', () => {
    const scene: RenderScene = {
      widthPx: 10,
      heightPx: 10,
      nodes: [
        {
          id: 'land',
          kind: 'compoundPath',
          sourceId: 'landmass-id',
          sourceAspectId: 'landmass-aspect-id',
          relatedSourceIds: ['water-body-id'],
          subpaths: [
            {
              points: [
                { xPx: 0, yPx: 0 },
                { xPx: 10, yPx: 0 },
                { xPx: 10, yPx: 10 },
              ],
            },
            {
              points: [
                { xPx: 2, yPx: 2 },
                { xPx: 3, yPx: 2 },
                { xPx: 3, yPx: 3 },
              ],
            },
          ],
          fillColor: '#d9d2a7',
          fillRule: 'evenodd',
        },
      ],
    };
    const context = new RecordingCanvasContext();

    renderSceneToCanvas(context as unknown as CanvasRenderingContext2D, scene);
    const svg = renderSceneToSvg(scene);

    expect(context.operations).toEqual([
      'beginPath',
      'moveTo:0,0',
      'lineTo:10,0',
      'lineTo:10,10',
      'closePath',
      'moveTo:2,2',
      'lineTo:3,2',
      'lineTo:3,3',
      'closePath',
      'fillStyle:#d9d2a7',
      'fill:evenodd',
    ]);
    expect(svg).toContain(
      '<path data-render-node-id="land" data-source-id="landmass-id" data-source-aspect-id="landmass-aspect-id" data-related-source-ids="water-body-id" d="M 0,0 L 10,0 L 10,10 Z M 2,2 L 3,2 L 3,3 Z" fill="#d9d2a7" fill-rule="evenodd"/>',
    );
  });
});

class RecordingCanvasContext {
  readonly operations: string[] = [];

  set fillStyle(value: string | CanvasGradient | CanvasPattern) {
    this.operations.push(`fillStyle:${formatCanvasPaint(value)}`);
  }

  set font(value: string) {
    this.operations.push(`font:${value}`);
  }

  set lineCap(value: CanvasLineCap) {
    this.operations.push(`lineCap:${value}`);
  }

  set lineJoin(value: CanvasLineJoin) {
    this.operations.push(`lineJoin:${value}`);
  }

  set lineWidth(value: number) {
    this.operations.push(`lineWidth:${String(value)}`);
  }

  set strokeStyle(value: string | CanvasGradient | CanvasPattern) {
    this.operations.push(`strokeStyle:${formatCanvasPaint(value)}`);
  }

  set textAlign(value: CanvasTextAlign) {
    this.operations.push(`textAlign:${value}`);
  }

  beginPath(): void {
    this.operations.push('beginPath');
  }

  closePath(): void {
    this.operations.push('closePath');
  }

  fill(fillRule?: CanvasFillRule): void {
    this.operations.push(fillRule === undefined ? 'fill' : `fill:${fillRule}`);
  }

  fillRect(xPx: number, yPx: number, widthPx: number, heightPx: number): void {
    this.operations.push(
      `fillRect:${String(xPx)},${String(yPx)},${String(widthPx)},${String(heightPx)}`,
    );
  }

  fillText(text: string, xPx: number, yPx: number): void {
    this.operations.push(`fillText:${text},${String(xPx)},${String(yPx)}`);
  }

  lineTo(xPx: number, yPx: number): void {
    this.operations.push(`lineTo:${String(xPx)},${String(yPx)}`);
  }

  moveTo(xPx: number, yPx: number): void {
    this.operations.push(`moveTo:${String(xPx)},${String(yPx)}`);
  }

  stroke(): void {
    this.operations.push('stroke');
  }
}

function formatCanvasPaint(value: string | CanvasGradient | CanvasPattern): string {
  return typeof value === 'string' ? value : 'non-string-paint';
}
