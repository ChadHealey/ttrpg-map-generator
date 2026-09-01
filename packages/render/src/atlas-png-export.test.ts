import type { RenderNode, RenderPolyline } from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import { ATLAS_DISPLAY_PROJECTION_METADATA } from './atlas-display-projection.js';
import {
  ATLAS_PNG_DEFAULT_DIMENSIONS,
  ATLAS_PNG_DIAGNOSTIC_CODES,
  ATLAS_PNG_EXPORT_PROFILE_ID,
  ATLAS_PNG_MAXIMUM_BYTES,
  ATLAS_PNG_PHYSICAL_OVERLAY_EXPORT_PROFILE_ID,
  ATLAS_PNG_SUPPORTED_DIMENSIONS,
  ATLAS_PNG_SUPPORTED_STYLE_ID,
  ATLAS_PNG_TILE_POLICY,
  type AtlasPngExportProgress,
  type AtlasPngExportRequest,
  type AtlasPngExportRuntime,
  type AtlasPngSceneInput,
  type AtlasPngStyleMetadata,
  exportAtlasSceneToPngAsync,
  exportAtlasSceneToPngWithPhysicalOverlaysAsync,
} from './atlas-png-export.js';
import { ATLAS_PNG_MAXIMUM_SCENE_STROKE_WIDTH_PX } from './atlas-png-rasterizer.js';
import {
  isSupportedAtlasPngDimensions,
  validateAtlasPngExportRequest,
  validateAtlasPngPhysicalOverlayExportRequest,
} from './atlas-png-validation.js';
import {
  ATLAS_SCENE_COMPOSITION_VERSION,
  ATLAS_SCENE_LEVELS_OF_DETAIL,
  type AtlasRenderScene,
} from './atlas-scene.js';

const STYLE: AtlasPngStyleMetadata = {
  styleId: ATLAS_PNG_SUPPORTED_STYLE_ID as AtlasPngStyleMetadata['styleId'],
  styleBehaviorVersion: 1,
  tokenVersion: 1,
};
const GALLERY_DIMENSIONS = ATLAS_PNG_SUPPORTED_DIMENSIONS[0];
const WORLD_MAP_ID = '11111111-1111-4111-8111-111111111111';
const PAPER_ENTITY_ID = '22222222-2222-4222-8222-222222222222';
const WATER_ENTITY_ID = '33333333-3333-4333-8333-333333333333';
const LAND_ENTITY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PAPER_ASPECT_ID = '55555555-5555-4555-8555-555555555555';
const WATER_ASPECT_ID = '66666666-6666-4666-8666-666666666666';
const LAND_ASPECT_ID = '77777777-7777-4777-8777-777777777777';
const PHYSICAL_ENTITY_ID = '88888888-8888-4888-8888-888888888888';
const PHYSICAL_ASPECT_ID = '99999999-9999-4999-8999-999999999999';

describe('atlas-png-v1 public exporter', () => {
  it.each(ATLAS_PNG_SUPPORTED_DIMENSIONS)(
    'accepts the fixed $widthPx × $heightPx profile dimensions without rasterizing',
    (dimensions) => {
      expect(isSupportedAtlasPngDimensions(dimensions)).toBe(true);
      const result = validateAtlasPngExportRequest({ scene: scene(), style: STYLE, dimensions });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.dimensions).toEqual(dimensions);
    },
  );

  it('fixes 8192 × 4096 as the default and rejects every unregistered dimension pair', () => {
    expect(ATLAS_PNG_DEFAULT_DIMENSIONS).toEqual({ widthPx: 8_192, heightPx: 4_096 });
    for (const dimensions of [
      { widthPx: 1_600, heightPx: 801 },
      { widthPx: 2_048, heightPx: 1_024 },
      { widthPx: 8_193, heightPx: 4_096 },
    ]) {
      expect(isSupportedAtlasPngDimensions(dimensions)).toBe(false);
      expect(validationCodes({ scene: scene(), style: STYLE, dimensions })).toContain(
        ATLAS_PNG_DIAGNOSTIC_CODES.dimensionsInvalid,
      );
    }
  });

  it.each([
    ['authority', { authority: 'accepted-geography' }],
    ['scene kind', { sceneKind: 'proof' }],
    ['scene version', { sceneCompositionVersion: ATLAS_SCENE_COMPOSITION_VERSION + 1 }],
    ['level of detail', { levelOfDetail: ATLAS_SCENE_LEVELS_OF_DETAIL.coarsePreview }],
    ['coordinate space', { coordinateSpace: 'render-pixel' }],
    ['logical width', { widthPx: 2_047 }],
    ['logical height', { heightPx: 1_023 }],
  ] as const)('rejects a non-accepted %s scene before raster allocation', (_label, patch) => {
    expect(validationCodes({ scene: patchedScene(patch), style: STYLE })).toContain(
      ATLAS_PNG_DIAGNOSTIC_CODES.sceneUnsupported,
    );
  });

  it('rejects stale projection/seam and style/token versions', () => {
    const staleProjection = patchedScene({
      projection: { ...ATLAS_DISPLAY_PROJECTION_METADATA, projectionVersion: 2 },
    });
    const staleSeam = patchedScene({
      projection: { ...ATLAS_DISPLAY_PROJECTION_METADATA, seamPolicyVersion: 2 },
    });

    for (const staleScene of [staleProjection, staleSeam]) {
      expect(validationCodes({ scene: staleScene, style: STYLE })).toContain(
        ATLAS_PNG_DIAGNOSTIC_CODES.sceneUnsupported,
      );
    }
    for (const style of [
      { ...STYLE, styleBehaviorVersion: 2 },
      { ...STYLE, tokenVersion: 2 },
      { ...STYLE, styleId: 'atlas-style.unknown' as AtlasPngStyleMetadata['styleId'] },
    ]) {
      expect(validationCodes({ scene: scene(), style })).toContain(
        ATLAS_PNG_DIAGNOSTIC_CODES.styleUnsupported,
      );
    }
  });

  it('rejects labels, incomplete scenes, invalid source links, duplicate IDs, and z-order drift', () => {
    const label: RenderNode = {
      id: 'atlas/paper/title',
      kind: 'label',
      sourceId: PAPER_ENTITY_ID,
      sourceAspectId: PAPER_ASPECT_ID,
      relatedSourceIds: [],
      text: 'Unsupported',
      position: { xPx: 20, yPx: 20 },
      fontFamily: 'ambient',
      fontSizePx: 12,
      fontWeight: 400,
      fillColor: '#282a24',
      textAnchor: 'start',
    };
    const labelled = scene(replaceNode(baseNodes(), 3, label));
    const incomplete = scene(baseNodes().filter(({ id }) => id !== 'atlas-water/mark/0000'));
    const invalidSource = patchedScene({ sourceWorldMapId: 'world-map-1' });
    const duplicated = scene([...baseNodes(), required(baseNodes()[6])]);
    const reordered = scene([
      baseNodes()[1],
      baseNodes()[0],
      ...baseNodes().slice(2),
    ] as RenderNode[]);
    const polygon: RenderNode = {
      id: 'atlas/land/land-1',
      kind: 'polygon',
      sourceId: LAND_ENTITY_ID,
      sourceAspectId: LAND_ASPECT_ID,
      relatedSourceIds: [WATER_ENTITY_ID],
      points: [
        { xPx: 2, yPx: 2 },
        { xPx: 6, yPx: 2 },
        { xPx: 4, yPx: 6 },
      ],
      paint: { fillColor: '#c9c39a', strokeColor: '#282a24', strokeWidthPx: 1 },
    };
    const unsupportedNode = scene(replaceNode(baseNodes(), 2, polygon));
    const background = required(baseNodes()[0]);
    if (background.kind !== 'rectangle') throw new Error('Expected background rectangle.');
    const malformedBackground = scene(
      replaceNode(baseNodes(), 0, { ...background, widthPx: 2_047 }),
    );

    expect(validationCodes({ scene: labelled, style: STYLE })).toContain(
      ATLAS_PNG_DIAGNOSTIC_CODES.fontUnsupported,
    );
    expect(validationCodes({ scene: incomplete, style: STYLE })).toContain(
      ATLAS_PNG_DIAGNOSTIC_CODES.sceneUnsupported,
    );
    expect(validationCodes({ scene: invalidSource, style: STYLE })).toContain(
      ATLAS_PNG_DIAGNOSTIC_CODES.sourceLinkInvalid,
    );
    expect(validationCodes({ scene: duplicated, style: STYLE })).toContain(
      ATLAS_PNG_DIAGNOSTIC_CODES.duplicateNodeId,
    );
    expect(validationCodes({ scene: reordered, style: STYLE })).toContain(
      ATLAS_PNG_DIAGNOSTIC_CODES.zOrderInvalid,
    );
    for (const invalidScene of [unsupportedNode, malformedBackground]) {
      expect(validationCodes({ scene: invalidScene, style: STYLE })).toContain(
        ATLAS_PNG_DIAGNOSTIC_CODES.nodeInvalid,
      );
    }
  });

  it('accepts the exact halo-supported stroke cap and rejects a wider stroke', () => {
    const capped = withCoastlineStrokeWidth(ATLAS_PNG_MAXIMUM_SCENE_STROKE_WIDTH_PX);
    const tooWide = withCoastlineStrokeWidth(ATLAS_PNG_MAXIMUM_SCENE_STROKE_WIDTH_PX + 0.001);

    expect(
      validateAtlasPngExportRequest({
        scene: capped,
        style: STYLE,
        dimensions: ATLAS_PNG_SUPPORTED_DIMENSIONS[2],
      }).ok,
    ).toBe(true);
    expect(validationCodes({ scene: tooWide, style: STYLE })).toContain(
      ATLAS_PNG_DIAGNOSTIC_CODES.nodeInvalid,
    );
    expect(ATLAS_PNG_TILE_POLICY.requiredHaloPx).toBeLessThanOrEqual(ATLAS_PNG_TILE_POLICY.haloPx);
  });

  it('emits deterministic bytes, bounded resources, monotonic progress, and no input mutation', async () => {
    const request = deepFreeze({
      scene: scene(),
      style: STYLE,
      dimensions: GALLERY_DIMENSIONS,
    } satisfies AtlasPngExportRequest);
    const before = JSON.stringify(request);
    const firstRuntime = runtimeRecorder('never');
    const first = await exportAtlasSceneToPngAsync(request, firstRuntime.runtime);
    const second = await exportAtlasSceneToPngAsync(request, runtimeRecorder('never').runtime);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.bytes).toEqual(second.value.bytes);
    expect(JSON.stringify(request)).toBe(before);
    expect(readPng(first.value.bytes)).toEqual({
      widthPx: 1_600,
      heightPx: 800,
      chunks: ['IHDR', 'sRGB', 'IDAT', 'IEND'],
    });
    expect(first.value).toMatchObject({
      profileId: ATLAS_PNG_EXPORT_PROFILE_ID,
      profileVersion: 1,
      widthPx: 1_600,
      heightPx: 800,
    });
    expect(first.value.byteLength).toBe(first.value.bytes.byteLength);
    expect(first.value.byteLength).toBeLessThanOrEqual(ATLAS_PNG_MAXIMUM_BYTES);
    expect(first.value.resources).toMatchObject({
      bandCoreHeightPx: 64,
      bandHaloPx: 8,
      samplePlaneCount: 4,
      maximumLiveBands: 1,
      outputPixelCount: 1_280_000,
      maximumRawRgbRowBytes: 4_800,
      maximumFilteredRowBytes: 4_801,
      maximumEncodedBytes: ATLAS_PNG_MAXIMUM_BYTES,
      hasFullSizeRasterSurface: false,
    });
    expect(first.value.resources.maximumObservedLiveRasterBytes).toBe(1_600 * 80 * 12);
    expect(first.value.resources.maximumObservedLiveRasterBytes).toBeLessThan(
      first.value.resources.outputPixelCount * 4,
    );
    expectProgressContract(firstRuntime.progress);
    expect(firstRuntime.yieldCount).toBe(2);
  });

  it.each(['early', 'middle', 'late'] as const)(
    'cancels at the %s safe point without returning partial bytes',
    async (cancelAt) => {
      const recorder = runtimeRecorder(cancelAt);
      const result = await exportAtlasSceneToPngAsync(
        { scene: scene(), style: STYLE, dimensions: GALLERY_DIMENSIONS },
        recorder.runtime,
      );

      expect(result.ok).toBe(false);
      expect('value' in result).toBe(false);
      expect(result.ok ? [] : result.diagnostics.map(({ code }) => code)).toEqual([
        ATLAS_PNG_DIAGNOSTIC_CODES.cancelled,
      ]);
      expect(recorder.progress.at(-1)).toMatchObject({ stage: 'cancelled', isTerminal: true });
      expectMonotonicProgress(recorder.progress);
      if (cancelAt === 'early')
        expect(recorder.progress.map(({ stage }) => stage)).toEqual(['validating', 'cancelled']);
      if (cancelAt === 'middle') expect(recorder.yieldCount).toBe(1);
      if (cancelAt === 'late') {
        expect(recorder.progress.at(-1)?.completedWork).toBeGreaterThan(800);
      }
    },
  );
});

type CancellationPoint = 'never' | 'early' | 'middle' | 'late';

interface RuntimeRecorder {
  readonly progress: AtlasPngExportProgress[];
  readonly runtime: AtlasPngExportRuntime;
  yieldCount: number;
}

function runtimeRecorder(cancelAt: CancellationPoint): RuntimeRecorder {
  let isCancelled = cancelAt === 'early';
  const recorder: RuntimeRecorder = {
    progress: [],
    yieldCount: 0,
    runtime: {
      isCancellationRequested: () => isCancelled,
      reportProgress(value) {
        recorder.progress.push(value);
        if (cancelAt === 'late' && value.stage === 'rasterizing' && value.completedWork > 850) {
          isCancelled = true;
        }
      },
      yieldControl() {
        recorder.yieldCount += 1;
        if (cancelAt === 'middle' && recorder.yieldCount === 1) isCancelled = true;
        return Promise.resolve();
      },
    },
  };
  return recorder;
}

function expectProgressContract(values: readonly AtlasPngExportProgress[]): void {
  expect([...new Set(values.map(({ stage }) => stage))]).toEqual([
    'validating',
    'preparing',
    'rasterizing',
    'verifying',
    'completed',
  ]);
  expect(values.at(-1)).toMatchObject({ stage: 'completed', isTerminal: true });
  expectMonotonicProgress(values);
}

function expectMonotonicProgress(values: readonly AtlasPngExportProgress[]): void {
  for (let index = 0; index < values.length; index += 1) {
    const value = required(values[index]);
    expect(value.profileId).toBe(ATLAS_PNG_EXPORT_PROFILE_ID);
    expect(value.completedWork).toBeLessThanOrEqual(value.totalWork);
    expect(value.isTerminal).toBe(index === values.length - 1);
    if (index > 0) {
      expect(value.completedWork).toBeGreaterThanOrEqual(required(values[index - 1]).completedWork);
      expect(value.totalWork).toBe(required(values[0]).totalWork);
    }
  }
}

describe('atlas-png-v2 physical-overlay export', () => {
  it('requires explicit v2 validation, preserves v1 rejection, and repeats exact bounded PNG bytes', async () => {
    const request = deepFreeze({
      scene: physicalScene(),
      style: STYLE,
      dimensions: GALLERY_DIMENSIONS,
    } satisfies AtlasPngExportRequest);
    const before = JSON.stringify(request);
    const v1 = validateAtlasPngExportRequest(request);
    const v2 = validateAtlasPngPhysicalOverlayExportRequest(request);
    const first = await exportAtlasSceneToPngWithPhysicalOverlaysAsync(
      request,
      pngV2Runtime('never'),
    );
    const second = await exportAtlasSceneToPngWithPhysicalOverlaysAsync(
      request,
      pngV2Runtime('never'),
    );

    expect(v1.ok).toBe(false);
    if (!v1.ok) {
      expect(v1.diagnostics.map(({ message }) => message).join('\n')).toContain('atlas-png-v2');
    }
    expect(v2.ok).toBe(true);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.profileId).toBe(ATLAS_PNG_PHYSICAL_OVERLAY_EXPORT_PROFILE_ID);
    expect(first.value.bytes).toEqual(second.value.bytes);
    expect(first.value.resources.hasFullSizeRasterSurface).toBe(false);
    expect(JSON.stringify(request)).toBe(before);
  });

  it.each([
    ['missing', scene(), ATLAS_PNG_DIAGNOSTIC_CODES.sceneUnsupported],
    [
      'malformed',
      physicalScene([{ ...physicalOverlay(), id: 'atlas/physical/Bad' }]),
      ATLAS_PNG_DIAGNOSTIC_CODES.zOrderInvalid,
    ],
    [
      'duplicate',
      physicalScene([physicalOverlay(), physicalOverlay()]),
      ATLAS_PNG_DIAGNOSTIC_CODES.duplicateNodeId,
    ],
    [
      'source-unlinked',
      physicalScene([{ ...physicalOverlay(), sourceAspectId: 'physical-aspect' }]),
      ATLAS_PNG_DIAGNOSTIC_CODES.sourceLinkInvalid,
    ],
    [
      'unsorted',
      physicalScene([
        { ...physicalOverlay(), id: 'atlas/physical/biome/0001' },
        { ...physicalOverlay(), id: 'atlas/physical/biome/0000' },
      ]),
      ATLAS_PNG_DIAGNOSTIC_CODES.zOrderInvalid,
    ],
    [
      'misplaced',
      physicalScene([physicalOverlay()], true),
      ATLAS_PNG_DIAGNOSTIC_CODES.zOrderInvalid,
    ],
  ] as const)('rejects %s physical-overlay nodes', (_label, physical, expectedCode) => {
    const result = validateAtlasPngPhysicalOverlayExportRequest({ scene: physical, style: STYLE });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics.map(({ code }) => code)).toContain(expectedCode);
  });

  it('keeps physical-overlay cancellation before any destination bytes are returned', async () => {
    const result = await exportAtlasSceneToPngWithPhysicalOverlaysAsync(
      { scene: physicalScene(), style: STYLE, dimensions: GALLERY_DIMENSIONS },
      pngV2Runtime('immediately'),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      ATLAS_PNG_DIAGNOSTIC_CODES.cancelled,
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
    rectangle('atlas/background/paper', PAPER_ENTITY_ID, PAPER_ASPECT_ID, '#eadcba'),
    rectangle('atlas/background/water', WATER_ENTITY_ID, WATER_ASPECT_ID, '#afbec0'),
    {
      id: 'atlas/land/land-1',
      kind: 'compoundPath',
      sourceId: LAND_ENTITY_ID,
      sourceAspectId: LAND_ASPECT_ID,
      relatedSourceIds: [WATER_ENTITY_ID],
      subpaths: [
        {
          points: [
            { xPx: 2, yPx: 2 },
            { xPx: 6, yPx: 2 },
            { xPx: 4, yPx: 6 },
          ],
        },
      ],
      fillColor: '#c9c39a',
      fillRule: 'evenodd',
    },
    polyline('atlas/paper/grain-0000', PAPER_ENTITY_ID, PAPER_ASPECT_ID, '#d9c8a3', 0.55, 30),
    polyline('atlas-water/echo/0000', WATER_ENTITY_ID, WATER_ASPECT_ID, '#718c8e', 0.75, 40, [
      LAND_ENTITY_ID,
    ]),
    polyline('atlas-water/mark/0000', WATER_ENTITY_ID, WATER_ASPECT_ID, '#718c8e', 0.6, 50),
    polyline('atlas/coastline/0000', LAND_ENTITY_ID, LAND_ASPECT_ID, '#282a24', 1.25, 2, [
      WATER_ENTITY_ID,
    ]),
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
          { xPx: 2, yPx: 2 },
          { xPx: 6, yPx: 2 },
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

function pngV2Runtime(cancellation: 'never' | 'immediately') {
  return {
    isCancellationRequested: () => cancellation === 'immediately',
    reportProgress: () => undefined,
    yieldControl: () => Promise.resolve(),
  };
}

function rectangle(
  id: string,
  sourceId: string,
  sourceAspectId: string,
  fillColor: string,
): RenderNode {
  return {
    id,
    kind: 'rectangle',
    sourceId,
    sourceAspectId,
    relatedSourceIds: [],
    xPx: 0,
    yPx: 0,
    widthPx: 2_048,
    heightPx: 1_024,
    fillColor,
  };
}

function polyline(
  id: string,
  sourceId: string,
  sourceAspectId: string,
  strokeColor: string,
  strokeWidthPx: number,
  offset: number,
  relatedSourceIds: readonly string[] = [],
): RenderPolyline {
  return {
    id,
    kind: 'polyline',
    sourceId,
    sourceAspectId,
    relatedSourceIds,
    points: [
      { xPx: offset, yPx: offset },
      { xPx: offset + 2, yPx: offset + 2 },
    ],
    strokeColor,
    strokeWidthPx,
  };
}

function withCoastlineStrokeWidth(strokeWidthPx: number): AtlasRenderScene {
  const coastline = required(baseNodes()[6]);
  if (coastline.kind !== 'polyline') throw new Error('Expected coastline polyline.');
  return scene(replaceNode(baseNodes(), 6, { ...coastline, strokeWidthPx }));
}

function patchedScene(patch: Readonly<Record<string, unknown>>): AtlasPngSceneInput {
  return { ...scene(), ...patch };
}

function replaceNode(
  nodes: readonly RenderNode[],
  index: number,
  replacement: RenderNode,
): readonly RenderNode[] {
  const result = [...nodes];
  result[index] = replacement;
  return result;
}

function validationCodes(request: AtlasPngExportRequest): readonly string[] {
  const result = validateAtlasPngExportRequest(request);
  return result.ok ? [] : result.diagnostics.map(({ code }) => code);
}

function readPng(bytes: Uint8Array): {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly chunks: readonly string[];
} {
  expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  let offset = 8;
  let widthPx = 0;
  let heightPx = 0;
  const chunks: string[] = [];
  while (offset < bytes.byteLength) {
    const length = readUint32(bytes, offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    chunks.push(type);
    if (type === 'IHDR') {
      widthPx = readUint32(bytes, offset + 8);
      heightPx = readUint32(bytes, offset + 12);
    }
    offset += 12 + length;
  }
  return { widthPx, heightPx, chunks };
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    (((bytes[offset] ?? 0) << 24) |
      ((bytes[offset + 1] ?? 0) << 16) |
      ((bytes[offset + 2] ?? 0) << 8) |
      (bytes[offset + 3] ?? 0)) >>>
    0
  );
}

function deepFreeze<Value>(value: Value): Value {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}

function required<Value>(value: Value | undefined): Value {
  if (value === undefined) throw new Error('Expected fixture value.');
  return value;
}
