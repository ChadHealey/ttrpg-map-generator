import type { RenderNode } from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import { ATLAS_DISPLAY_PROJECTION_METADATA } from './atlas-display-projection.js';
import {
  ATLAS_SCENE_COMPOSITION_VERSION,
  ATLAS_SCENE_LEVELS_OF_DETAIL,
  type AtlasRenderScene,
} from './atlas-scene.js';
import {
  ATLAS_SVG_DEFAULT_DIMENSIONS,
  ATLAS_SVG_DIAGNOSTIC_CODES,
  ATLAS_SVG_EXPORT_PROFILE_ID,
  ATLAS_SVG_MAXIMUM_BYTES,
  ATLAS_SVG_SUPPORTED_STYLE_ID,
  type AtlasSvgSceneInput,
  type AtlasSvgStyleMetadata,
  exportAtlasSceneToSvg,
  exportAtlasSceneToSvgAsync,
} from './atlas-svg-export.js';

const STYLE: AtlasSvgStyleMetadata = {
  styleId: ATLAS_SVG_SUPPORTED_STYLE_ID as AtlasSvgStyleMetadata['styleId'],
  styleBehaviorVersion: 1,
  tokenVersion: 1,
};

describe('atlas-svg-v1 export', () => {
  it('serializes physical units, metadata, stable IDs, definitions, references, and z-order', () => {
    const result = exportAtlasSceneToSvg({ scene: scene(), style: STYLE });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      profileId: ATLAS_SVG_EXPORT_PROFILE_ID,
      profileVersion: 1,
      ...ATLAS_SVG_DEFAULT_DIMENSIONS,
    });
    expect(result.value.byteLength).toBe(new TextEncoder().encode(result.value.svg).byteLength);
    expect(result.value.byteLength).toBeLessThan(ATLAS_SVG_MAXIMUM_BYTES);
    expect(result.value.svg).toContain('width="400mm" height="200mm"');
    expect(result.value.svg).toContain('viewBox="0 0 2048 1024"');
    expect(result.value.svg).toContain('id="atlas-svg-v1-clip"');
    expect(result.value.svg).toContain('clip-path="url(#atlas-svg-v1-clip)"');
    expect(result.value.svg).toContain(
      'id="node-atlas_x2fbackground_x2fpaper" data-render-node-id="atlas/background/paper"',
    );
    expect(result.value.svg).toContain('&quot;fontPolicy&quot;:&quot;no-rendered-text-v1&quot;');
    expect(result.value.svg.indexOf('atlas/background/paper')).toBeLessThan(
      result.value.svg.indexOf('atlas/background/water'),
    );
    expect(result.value.svg.indexOf('atlas/background/water')).toBeLessThan(
      result.value.svg.indexOf('atlas/land/land-1'),
    );
    expect(result.value.svg).toContain('d="M 1.123457,2.5 L 3,4 L 5,6 Z"');
    expect(result.value.svg.endsWith('\n')).toBe(true);
  });

  it('produces byte-identical output from the same scene, style, and dimensions', () => {
    const request = {
      scene: scene(),
      style: STYLE,
      dimensions: { widthMillimeters: 800, heightMillimeters: 400 },
    } as const;

    const first = exportAtlasSceneToSvg(request);
    const second = exportAtlasSceneToSvg(request);

    expect(first).toEqual(second);
  });

  it('rejects unsupported dimensions, fonts, source links, nodes, and z-order actionably', () => {
    const invalidScene = scene([
      ...scene().nodes.slice(0, 3),
      {
        id: 'atlas/title',
        kind: 'label',
        sourceId: 'title',
        sourceAspectId: 'title-aspect',
        relatedSourceIds: [],
        text: 'Unsupported',
        position: { xPx: Number.NaN, yPx: 0 },
        fontFamily: 'ambient',
        fontSizePx: 12,
        fontWeight: 400,
        fillColor: '#000000',
        textAnchor: 'start',
      },
      required(scene().nodes[1]),
    ]);
    const result = exportAtlasSceneToSvg({
      scene: invalidScene,
      style: STYLE,
      dimensions: { widthMillimeters: 401, heightMillimeters: 200 },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        ATLAS_SVG_DIAGNOSTIC_CODES.dimensionsInvalid,
        ATLAS_SVG_DIAGNOSTIC_CODES.fontUnsupported,
        ATLAS_SVG_DIAGNOSTIC_CODES.duplicateNodeId,
        ATLAS_SVG_DIAGNOSTIC_CODES.zOrderInvalid,
      ]),
    );
    expect(
      result.diagnostics.find(({ code }) => code === ATLAS_SVG_DIAGNOSTIC_CODES.fontUnsupported)
        ?.message,
    ).toContain('embeds no fonts');
  });

  it('rejects undeclared styles and scene node categories', () => {
    const polygon: RenderNode = {
      id: 'atlas/unsupported/polygon',
      kind: 'polygon',
      sourceId: 'unsupported',
      sourceAspectId: 'unsupported-aspect',
      relatedSourceIds: [],
      points: [
        { xPx: 1, yPx: 1 },
        { xPx: 2, yPx: 1 },
        { xPx: 2, yPx: 2 },
      ],
      paint: { fillColor: '#c9c39a', strokeColor: '#282a24', strokeWidthPx: 1 },
    };
    const result = exportAtlasSceneToSvg({
      scene: scene([...scene().nodes, polygon]),
      style: { ...STYLE, styleId: 'atlas-style.unknown' as AtlasSvgStyleMetadata['styleId'] },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        ATLAS_SVG_DIAGNOSTIC_CODES.styleUnsupported,
        ATLAS_SVG_DIAGNOSTIC_CODES.nodeInvalid,
        ATLAS_SVG_DIAGNOSTIC_CODES.zOrderInvalid,
      ]),
    );
  });

  it('rejects stale projection metadata and an incomplete normal-detail scene', () => {
    const staleProjection = {
      ...scene(),
      projection: { ...ATLAS_DISPLAY_PROJECTION_METADATA, projectionVersion: 999 },
    } as unknown as AtlasSvgSceneInput;
    const staleResult = exportAtlasSceneToSvg({ scene: staleProjection, style: STYLE });
    const incompleteResult = exportAtlasSceneToSvg({
      scene: scene(scene().nodes.slice(0, 3)),
      style: STYLE,
    });

    expect(staleResult.ok).toBe(false);
    expect(incompleteResult.ok).toBe(false);
    if (staleResult.ok || incompleteResult.ok) return;
    expect(staleResult.diagnostics.map(({ code }) => code)).toContain(
      ATLAS_SVG_DIAGNOSTIC_CODES.sceneUnsupported,
    );
    expect(incompleteResult.diagnostics.map(({ code }) => code)).toContain(
      ATLAS_SVG_DIAGNOSTIC_CODES.sceneUnsupported,
    );
  });

  it('observes cancellation between bounded batches without returning partial bytes', async () => {
    let isCancelled = false;
    const progress: string[] = [];
    const manyNodes = [
      ...scene().nodes.slice(0, 3),
      ...Array.from({ length: 300 }, (_, index): RenderNode => ({
        id: `atlas/paper/grain-${String(index).padStart(4, '0')}`,
        kind: 'polyline',
        sourceId: 'paper',
        sourceAspectId: 'paper-aspect',
        relatedSourceIds: [],
        points: [
          { xPx: index, yPx: 10 },
          { xPx: index + 1, yPx: 11 },
        ],
        strokeColor: '#d9c8a3',
        strokeWidthPx: 0.55,
      })),
      ...scene().nodes.slice(4),
    ];

    const result = await exportAtlasSceneToSvgAsync(
      { scene: scene(manyNodes), style: STYLE },
      {
        isCancellationRequested: () => isCancelled,
        reportProgress: ({ stage }) => progress.push(stage),
        yieldControl: () => {
          isCancelled = true;
          return Promise.resolve();
        },
      },
    );

    expect(result).toEqual({
      ok: false,
      diagnostics: [
        {
          code: ATLAS_SVG_DIAGNOSTIC_CODES.cancelled,
          message: 'Atlas SVG export was cancelled before any destination file was committed.',
        },
      ],
    });
    expect(progress).toEqual(['validating', 'serializing', 'cancelled']);
  });
});

function scene(nodes: readonly RenderNode[] = baseNodes()): AtlasRenderScene {
  return {
    authority: 'disposable-render-scene',
    sceneKind: 'whole-world-atlas',
    sceneCompositionVersion: ATLAS_SCENE_COMPOSITION_VERSION,
    levelOfDetail: ATLAS_SCENE_LEVELS_OF_DETAIL.normalAtlas,
    coordinateSpace: 'atlas-display-equirectangular-v1',
    sourceWorldMapId: 'world-map-1',
    projection: ATLAS_DISPLAY_PROJECTION_METADATA,
    widthPx: 2_048,
    heightPx: 1_024,
    nodes,
  };
}

function baseNodes(): readonly RenderNode[] {
  return [
    {
      id: 'atlas/background/paper',
      kind: 'rectangle',
      sourceId: 'paper',
      sourceAspectId: 'paper-aspect',
      relatedSourceIds: [],
      xPx: 0,
      yPx: 0,
      widthPx: 2_048,
      heightPx: 1_024,
      fillColor: '#eadcba',
    },
    {
      id: 'atlas/background/water',
      kind: 'rectangle',
      sourceId: 'water',
      sourceAspectId: 'water-aspect',
      relatedSourceIds: [],
      xPx: 0,
      yPx: 0,
      widthPx: 2_048,
      heightPx: 1_024,
      fillColor: '#afbec0',
    },
    {
      id: 'atlas/land/land-1',
      kind: 'compoundPath',
      sourceId: 'land-1',
      sourceAspectId: 'land-aspect',
      relatedSourceIds: ['water'],
      subpaths: [
        {
          points: [
            { xPx: 1.123_456_7, yPx: 2.5 },
            { xPx: 3, yPx: 4 },
            { xPx: 5, yPx: 6 },
          ],
        },
      ],
      fillColor: '#c9c39a',
      fillRule: 'evenodd',
    },
    {
      id: 'atlas/paper/grain-0000',
      kind: 'polyline',
      sourceId: 'paper',
      sourceAspectId: 'paper-aspect',
      relatedSourceIds: [],
      points: [
        { xPx: 30, yPx: 30 },
        { xPx: 31, yPx: 31 },
      ],
      strokeColor: '#d9c8a3',
      strokeWidthPx: 0.55,
    },
    {
      id: 'atlas-water/echo/0000',
      kind: 'polyline',
      sourceId: 'water',
      sourceAspectId: 'water-aspect',
      relatedSourceIds: ['land-1'],
      points: [
        { xPx: 40, yPx: 40 },
        { xPx: 41, yPx: 41 },
      ],
      strokeColor: '#718c8e',
      strokeWidthPx: 0.75,
    },
    {
      id: 'atlas-water/mark/0000',
      kind: 'polyline',
      sourceId: 'water',
      sourceAspectId: 'water-aspect',
      relatedSourceIds: [],
      points: [
        { xPx: 50, yPx: 50 },
        { xPx: 51, yPx: 51 },
      ],
      strokeColor: '#718c8e',
      strokeWidthPx: 0.6,
    },
    {
      id: 'atlas/coastline/0000',
      kind: 'polyline',
      sourceId: 'land-1',
      sourceAspectId: 'land-aspect',
      relatedSourceIds: ['water'],
      points: [
        { xPx: 1.123_456_7, yPx: 2.5 },
        { xPx: 3, yPx: 4 },
      ],
      strokeColor: '#282a24',
      strokeWidthPx: 1.25,
    },
  ];
}

function required<Value>(value: Value | undefined): Value {
  if (value === undefined) throw new Error('Expected fixture value.');
  return value;
}
