import type { RenderNode, RenderRectangle } from '@ttrpg-map/core';
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
  ATLAS_SVG_PHYSICAL_OVERLAY_EXPORT_PROFILE_ID,
  ATLAS_SVG_SUPPORTED_STYLE_ID,
  type AtlasSvgSceneInput,
  type AtlasSvgStyleMetadata,
  exportAtlasSceneToSvg,
  exportAtlasSceneToSvgAsync,
  exportAtlasSceneToSvgWithPhysicalOverlays,
  exportAtlasSceneToSvgWithPhysicalOverlaysAsync,
} from './atlas-svg-export.js';
import { serializeAtlasSvgWithinByteLimit } from './atlas-svg-serialization.js';

const STYLE: AtlasSvgStyleMetadata = {
  styleId: ATLAS_SVG_SUPPORTED_STYLE_ID as AtlasSvgStyleMetadata['styleId'],
  styleBehaviorVersion: 1,
  tokenVersion: 1,
};
const WORLD_MAP_ID = '11111111-1111-4111-8111-111111111111';
const PAPER_ENTITY_ID = '22222222-2222-4222-8222-222222222222';
const WATER_ENTITY_ID = '33333333-3333-4333-8333-333333333333';
const LAND_ENTITY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PAPER_ASPECT_ID = '55555555-5555-4555-8555-555555555555';
const WATER_ASPECT_ID = '66666666-6666-4666-8666-666666666666';
const LAND_ASPECT_ID = '77777777-7777-4777-8777-777777777777';
const PHYSICAL_ENTITY_ID = '88888888-8888-4888-8888-888888888888';
const PHYSICAL_ASPECT_ID = '99999999-9999-4999-8999-999999999999';

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

  it('measures UTF-8 incrementally and refuses to assemble output beyond its byte ceiling', () => {
    const serialized = serializeAtlasSvgWithinByteLimit(
      {
        scene: scene(),
        style: STYLE,
        dimensions: ATLAS_SVG_DEFAULT_DIMENSIONS,
        profileId: ATLAS_SVG_EXPORT_PROFILE_ID,
        profileVersion: 1,
        fontPolicy: 'no-rendered-text-v1',
      },
      ATLAS_SVG_MAXIMUM_BYTES,
    );
    expect(serialized.ok).toBe(true);
    if (!serialized.ok) return;
    expect(serialized.value.byteLength).toBe(
      new TextEncoder().encode(serialized.value.svg).byteLength,
    );
    expect(
      serializeAtlasSvgWithinByteLimit(
        {
          scene: scene(),
          style: STYLE,
          dimensions: ATLAS_SVG_DEFAULT_DIMENSIONS,
          profileId: ATLAS_SVG_EXPORT_PROFILE_ID,
          profileVersion: 1,
          fontPolicy: 'no-rendered-text-v1',
        },
        serialized.value.byteLength - 1,
      ).ok,
    ).toBe(false);

    const longPrintableId = `atlas/coastline/${'a'.repeat(1_100_000)}`;
    const longIdScene = scene(
      baseNodes().map((node) =>
        node.id === 'atlas/coastline/0000' ? { ...node, id: longPrintableId } : node,
      ),
    );
    const longIdResult = serializeAtlasSvgWithinByteLimit(
      {
        scene: longIdScene,
        style: STYLE,
        dimensions: ATLAS_SVG_DEFAULT_DIMENSIONS,
        profileId: ATLAS_SVG_EXPORT_PROFILE_ID,
        profileVersion: 1,
        fontPolicy: 'no-rendered-text-v1',
      },
      ATLAS_SVG_MAXIMUM_BYTES,
    );
    expect(longIdResult.ok).toBe(true);
    if (!longIdResult.ok) return;
    expect(longIdResult.value.byteLength).toBeLessThan(ATLAS_SVG_MAXIMUM_BYTES);
    expect(longIdResult.value.byteLength).toBe(
      new TextEncoder().encode(longIdResult.value.svg).byteLength,
    );
  });

  it('rejects unsupported dimensions, fonts, source links, nodes, and z-order actionably', () => {
    const invalidScene = scene([
      ...scene().nodes.slice(0, 3),
      {
        id: 'atlas/title',
        kind: 'label',
        sourceId: LAND_ENTITY_ID,
        sourceAspectId: LAND_ASPECT_ID,
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
      sourceId: LAND_ENTITY_ID,
      sourceAspectId: LAND_ASPECT_ID,
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

  it('separates printable render-node IDs from canonical UUID source references', () => {
    const renderIdNodes = replaceNode(3, {
      ...required(baseNodes()[3]),
      id: 'atlas/paper/grain,0000',
    });
    const renderIdResult = exportAtlasSceneToSvg({ scene: scene(renderIdNodes), style: STYLE });
    const symbolicResult = exportAtlasSceneToSvg({
      scene: { ...scene(), sourceWorldMapId: 'world-map-1' },
      style: STYLE,
    });
    const uppercaseResult = exportAtlasSceneToSvg({
      scene: scene(
        replaceNode(2, {
          ...required(baseNodes()[2]),
          sourceId: LAND_ENTITY_ID.toUpperCase(),
        }),
      ),
      style: STYLE,
    });
    const nilResult = exportAtlasSceneToSvg({
      scene: scene(
        replaceNode(2, {
          ...required(baseNodes()[2]),
          sourceAspectId: '00000000-0000-0000-0000-000000000000',
        }),
      ),
      style: STYLE,
    });
    const commaResult = exportAtlasSceneToSvg({
      scene: scene(
        replaceNode(2, {
          ...required(baseNodes()[2]),
          relatedSourceIds: [`${WATER_ENTITY_ID},${LAND_ENTITY_ID}`],
        }),
      ),
      style: STYLE,
    });

    expect(renderIdResult.ok).toBe(true);
    for (const result of [symbolicResult, uppercaseResult, nilResult, commaResult]) {
      expect(failureCodes(result)).toContain(ATLAS_SVG_DIAGNOSTIC_CODES.sourceLinkInvalid);
    }
  });

  it.each([
    ['paper x offset', 0, { xPx: 1, widthPx: 2_047 }],
    ['paper y offset', 0, { yPx: 1, heightPx: 1_023 }],
    ['paper zero width', 0, { widthPx: 0 }],
    ['paper partial height', 0, { heightPx: 1_023 }],
    ['water x offset', 1, { xPx: 1, widthPx: 2_047 }],
    ['water y offset', 1, { yPx: 1, heightPx: 1_023 }],
    ['water partial width', 1, { widthPx: 2_047 }],
    ['water zero height', 1, { heightPx: 0 }],
  ] satisfies readonly [string, number, Partial<RenderRectangle>][])(
    'rejects a malformed %s background rectangle',
    (_description, index, patch) => {
      const result = exportAtlasSceneToSvg({
        scene: scene(mutateBackground(index, patch)),
        style: STYLE,
      });

      expect(failureCodes(result)).toContain(ATLAS_SVG_DIAGNOSTIC_CODES.nodeInvalid);
    },
  );

  it('observes cancellation between bounded batches without returning partial bytes', async () => {
    let isCancelled = false;
    const progress: string[] = [];
    const manyNodes = [
      ...scene().nodes.slice(0, 3),
      ...Array.from({ length: 300 }, (_, index): RenderNode => ({
        id: `atlas/paper/grain-${String(index).padStart(4, '0')}`,
        kind: 'polyline',
        sourceId: PAPER_ENTITY_ID,
        sourceAspectId: PAPER_ASPECT_ID,
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

describe('atlas-svg-v2 physical-overlay export', () => {
  it('requires an explicit profile, preserves v1 rejection, and serializes physical nodes below ink', () => {
    const physical = physicalScene();
    const v1 = exportAtlasSceneToSvg({ scene: physical, style: STYLE });
    const first = exportAtlasSceneToSvgWithPhysicalOverlays({ scene: physical, style: STYLE });
    const second = exportAtlasSceneToSvgWithPhysicalOverlays({ scene: physical, style: STYLE });

    expect(failureCodes(v1)).toContain(ATLAS_SVG_DIAGNOSTIC_CODES.sceneUnsupported);
    expect(v1.ok ? '' : v1.diagnostics.map(({ message }) => message).join('\n')).toContain(
      'atlas-svg-v2',
    );
    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.profileId).toBe(ATLAS_SVG_PHYSICAL_OVERLAY_EXPORT_PROFILE_ID);
    expect(first.value.svg).toContain('data-export-profile="atlas-svg-v2"');
    expect(first.value.svg).toContain(`data-source-aspect-id="${PHYSICAL_ASPECT_ID}"`);
    const svg = first.value.svg;
    expect(svg.indexOf('atlas/land/land-1')).toBeLessThan(svg.indexOf('atlas/physical/biome/0000'));
    expect(svg.indexOf('atlas/physical/biome/0000')).toBeLessThan(
      svg.indexOf('atlas/paper/grain-0000'),
    );
    expect(svg.indexOf('atlas/paper/grain-0000')).toBeLessThan(
      svg.indexOf('atlas-water/echo/0000'),
    );
    expect(svg.indexOf('atlas-water/echo/0000')).toBeLessThan(svg.indexOf('atlas/coastline/0000'));
  });

  it.each([
    ['missing', scene(), ATLAS_SVG_DIAGNOSTIC_CODES.sceneUnsupported],
    [
      'malformed',
      physicalScene([{ ...physicalOverlay(), id: 'atlas/physical/Bad' }]),
      ATLAS_SVG_DIAGNOSTIC_CODES.zOrderInvalid,
    ],
    [
      'duplicate',
      physicalScene([physicalOverlay(), physicalOverlay()]),
      ATLAS_SVG_DIAGNOSTIC_CODES.duplicateNodeId,
    ],
    [
      'source-unlinked',
      physicalScene([{ ...physicalOverlay(), sourceAspectId: 'physical-aspect' }]),
      ATLAS_SVG_DIAGNOSTIC_CODES.sourceLinkInvalid,
    ],
    [
      'unsorted',
      physicalScene([
        { ...physicalOverlay(), id: 'atlas/physical/biome/0001' },
        { ...physicalOverlay(), id: 'atlas/physical/biome/0000' },
      ]),
      ATLAS_SVG_DIAGNOSTIC_CODES.zOrderInvalid,
    ],
    [
      'misplaced',
      physicalScene([physicalOverlay()], true),
      ATLAS_SVG_DIAGNOSTIC_CODES.zOrderInvalid,
    ],
  ] as const)('rejects %s physical-overlay nodes', (_label, physical, expectedCode) => {
    const result = exportAtlasSceneToSvgWithPhysicalOverlays({ scene: physical, style: STYLE });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics.map(({ code }) => code)).toContain(expectedCode);
  });

  it('retains bounded-batch cancellation without returning partial v2 bytes', async () => {
    let isCancelled = false;
    const overlays = Array.from({ length: 130 }, (_, index) => ({
      ...physicalOverlay(),
      id: `atlas/physical/biome/${String(index).padStart(4, '0')}`,
    }));
    const result = await exportAtlasSceneToSvgWithPhysicalOverlaysAsync(
      { scene: physicalScene(overlays), style: STYLE },
      {
        isCancellationRequested: () => isCancelled,
        reportProgress: () => undefined,
        yieldControl: () => {
          isCancelled = true;
          return Promise.resolve();
        },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      ATLAS_SVG_DIAGNOSTIC_CODES.cancelled,
    ]);
  });
});

function scene(nodes: readonly RenderNode[] = baseNodes()): AtlasRenderScene {
  return {
    authority: 'disposable-render-scene',
    sceneKind: 'whole-world-atlas',
    sceneCompositionVersion: ATLAS_SCENE_COMPOSITION_VERSION,
    levelOfDetail: ATLAS_SCENE_LEVELS_OF_DETAIL.normalAtlas,
    coordinateSpace: 'atlas-display-equirectangular-v1',
    sourceWorldMapId: WORLD_MAP_ID,
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
      sourceId: PAPER_ENTITY_ID,
      sourceAspectId: PAPER_ASPECT_ID,
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
      sourceId: WATER_ENTITY_ID,
      sourceAspectId: WATER_ASPECT_ID,
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
      sourceId: LAND_ENTITY_ID,
      sourceAspectId: LAND_ASPECT_ID,
      relatedSourceIds: [WATER_ENTITY_ID],
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
      sourceId: PAPER_ENTITY_ID,
      sourceAspectId: PAPER_ASPECT_ID,
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
      sourceId: WATER_ENTITY_ID,
      sourceAspectId: WATER_ASPECT_ID,
      relatedSourceIds: [LAND_ENTITY_ID],
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
      sourceId: WATER_ENTITY_ID,
      sourceAspectId: WATER_ASPECT_ID,
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
      sourceId: LAND_ENTITY_ID,
      sourceAspectId: LAND_ASPECT_ID,
      relatedSourceIds: [WATER_ENTITY_ID],
      points: [
        { xPx: 1.123_456_7, yPx: 2.5 },
        { xPx: 3, yPx: 4 },
      ],
      strokeColor: '#282a24',
      strokeWidthPx: 1.25,
    },
  ];
}

function physicalOverlay(): RenderNode {
  return {
    id: 'atlas/physical/biome/0000',
    kind: 'compoundPath',
    sourceId: PHYSICAL_ENTITY_ID,
    sourceAspectId: PHYSICAL_ASPECT_ID,
    relatedSourceIds: [LAND_ENTITY_ID],
    subpaths: [
      {
        points: [
          { xPx: 1, yPx: 1 },
          { xPx: 6, yPx: 1 },
          { xPx: 4, yPx: 6 },
        ],
      },
    ],
    fillColor: '#718c8e',
    fillRule: 'evenodd',
  };
}

function physicalScene(
  overlays: readonly RenderNode[] = [physicalOverlay()],
  misplaced = false,
): AtlasRenderScene {
  const nodes = baseNodes();
  return scene(
    misplaced
      ? [...nodes.slice(0, 4), ...overlays, ...nodes.slice(4)]
      : [...nodes.slice(0, 3), ...overlays, ...nodes.slice(3)],
  );
}

function replaceNode(index: number, node: RenderNode): readonly RenderNode[] {
  const nodes = [...baseNodes()];
  nodes[index] = node;
  return nodes;
}

function mutateBackground(index: number, patch: Partial<RenderRectangle>): readonly RenderNode[] {
  const background = required(baseNodes()[index]);
  if (background.kind !== 'rectangle') throw new Error('Expected a background rectangle.');
  return replaceNode(index, { ...background, ...patch });
}

function failureCodes(result: ReturnType<typeof exportAtlasSceneToSvg>): readonly string[] {
  return result.ok ? [] : result.diagnostics.map(({ code }) => code);
}

function required<Value>(value: Value | undefined): Value {
  if (value === undefined) throw new Error('Expected fixture value.');
  return value;
}
