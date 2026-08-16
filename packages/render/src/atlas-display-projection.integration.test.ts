import {
  ATLAS_COASTLINE_EXTRACTION_ALGORITHM_VERSION,
  ATLAS_COASTLINE_GEOMETRY_BEHAVIOR_VERSION,
  ATLAS_COASTLINE_REPAIR_POLICY,
  ATLAS_COASTLINE_SIMPLIFICATION_POLICY_VERSION,
  ATLAS_COASTLINE_SIMPLIFICATION_TOLERANCE_TICKS,
  ATLAS_COASTLINE_TOPOLOGY_VALIDATION_VERSION,
  ATLAS_COASTLINE_WINDING,
  type CanonicalWorldCoastline,
  parsePlanetPoint,
  parseStableId,
  type RenderPoint,
  type RenderScene,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import {
  ATLAS_DISPLAY_HEIGHT_TICKS,
  ATLAS_DISPLAY_WIDTH_TICKS,
  ATLAS_PROJECTION_SEMANTIC_TOLERANCE_TICKS,
  type AtlasProjectedCoastlinePath,
  projectAtlasCanonicalCoastline,
} from './atlas-display-projection.js';
import { renderSceneToCanvas, renderSceneToSvg } from './index.js';

describe('seam-split RenderScene backend integration', () => {
  it('gives Canvas and SVG the same paths at preview and full-resolution semantics', () => {
    const result = projectAtlasCanonicalCoastline(seamCrossingCoastline());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.paths).toHaveLength(2);
    expect(ATLAS_PROJECTION_SEMANTIC_TOLERANCE_TICKS).toBe(0);

    const preview = sceneFromProjection(result.value.paths, 512);
    const full = sceneFromProjection(result.value.paths, 2_048);
    expect(full.nodes).toHaveLength(preview.nodes.length);
    for (const [nodeIndex, previewNode] of preview.nodes.entries()) {
      const fullNode = required(full.nodes[nodeIndex], 'Expected corresponding full scene node.');
      if (previewNode.kind !== 'polyline' || fullNode.kind !== 'polyline') {
        throw new Error('Expected projection evidence to contain only coastline polylines.');
      }
      expect(fullNode.id).toBe(previewNode.id);
      expect(fullNode.sourceId).toBe(previewNode.sourceId);
      expect(fullNode.points).toEqual(
        previewNode.points.map(({ xPx, yPx }) => ({ xPx: xPx * 4, yPx: yPx * 4 })),
      );
    }

    const canvas = new RecordingCanvasContext();
    renderSceneToCanvas(canvas as unknown as CanvasRenderingContext2D, preview);
    const svg = renderSceneToSvg(preview);
    const expectedPaths = preview.nodes.map((node) => {
      if (node.kind !== 'polyline') throw new Error('Expected coastline polyline.');
      expect(svg).toContain(`data-render-node-id="${node.id}" data-source-id="${node.sourceId}"`);
      return node.points;
    });
    expect(canvas.paths).toEqual(expectedPaths);
    expect(svgPolylinePoints(svg)).toEqual(expectedPaths);
  });
});

function sceneFromProjection(
  paths: readonly AtlasProjectedCoastlinePath[],
  widthPx: number,
): RenderScene {
  const heightPx = widthPx / 2;
  return {
    widthPx,
    heightPx,
    nodes: paths.map((path) => ({
      id: path.pathId,
      kind: 'polyline',
      sourceId: path.sourceRingId,
      points: path.points.map(({ xDisplayTicks, yDisplayTicks }) => ({
        xPx: (xDisplayTicks * widthPx) / ATLAS_DISPLAY_WIDTH_TICKS,
        yPx: (yDisplayTicks * heightPx) / ATLAS_DISPLAY_HEIGHT_TICKS,
      })),
      strokeColor: '#000000',
      strokeWidthPx: 1,
    })),
  };
}

function seamCrossingCoastline(): CanonicalWorldCoastline {
  return {
    geometryBehaviorVersion: ATLAS_COASTLINE_GEOMETRY_BEHAVIOR_VERSION,
    extractionAlgorithmVersion: ATLAS_COASTLINE_EXTRACTION_ALGORITHM_VERSION,
    simplificationPolicyVersion: ATLAS_COASTLINE_SIMPLIFICATION_POLICY_VERSION,
    simplificationToleranceTicks: ATLAS_COASTLINE_SIMPLIFICATION_TOLERANCE_TICKS,
    topologyValidationVersion: ATLAS_COASTLINE_TOPOLOGY_VALIDATION_VERSION,
    winding: ATLAS_COASTLINE_WINDING,
    repairPolicy: ATLAS_COASTLINE_REPAIR_POLICY,
    rings: [
      {
        ringId: stableId('coastline-ring', '11111111-1111-4111-8111-111111111111'),
        sourceBoundaryFingerprint: '1'.repeat(64),
        landmassId: stableId('entity', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
        waterBodyIds: [stableId('entity', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')],
        points: [
          point(2_147_483_646, -100),
          point(-2_147_483_646, -100),
          point(-2_147_483_646, 100),
          point(2_147_483_646, 100),
        ],
      },
    ],
  };
}

function stableId<Kind extends 'coastline-ring' | 'entity'>(kind: Kind, input: string) {
  const result = parseStableId(kind, input);
  if (!result.ok) throw new Error(result.diagnostic.message);
  return result.value;
}

function point(longitudeTicks: number, latitudeTicks: number) {
  const result = parsePlanetPoint({ longitudeTicks, latitudeTicks });
  if (!result.ok) throw new Error(result.diagnostic.message);
  return result.value;
}

function svgPolylinePoints(svg: string): readonly (readonly RenderPoint[])[] {
  return [...svg.matchAll(/<polyline [^>]* points="([^"]*)"/gu)].map((match) =>
    required(match[1], 'Expected SVG point attribute.')
      .split(' ')
      .map((pair) => {
        const [x, y] = pair.split(',');
        return { xPx: Number(x), yPx: Number(y) };
      }),
  );
}

class RecordingCanvasContext {
  readonly paths: RenderPoint[][] = [];
  #active: RenderPoint[] = [];

  set lineCap(value: CanvasLineCap) {
    void value;
  }
  set lineJoin(value: CanvasLineJoin) {
    void value;
  }
  set lineWidth(value: number) {
    void value;
  }
  set strokeStyle(value: string | CanvasGradient | CanvasPattern) {
    void value;
  }

  beginPath(): void {
    this.#active = [];
  }

  moveTo(xPx: number, yPx: number): void {
    this.#active.push({ xPx, yPx });
  }

  lineTo(xPx: number, yPx: number): void {
    this.#active.push({ xPx, yPx });
  }

  stroke(): void {
    this.paths.push(this.#active);
  }
}

function required<Value>(value: Value | undefined, message: string): Value {
  if (value === undefined) throw new Error(message);
  return value;
}
