import type { RenderNode, RenderPoint } from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import {
  ATLAS_DISPLAY_COORDINATE_SPACE,
  ATLAS_DISPLAY_PROJECTION_METADATA,
} from './atlas-display-projection.js';
import {
  ATLAS_PNG_BAND_CORE_HEIGHT_PX,
  ATLAS_PNG_BAND_HALO_PX,
  ATLAS_PNG_MAXIMUM_LIVE_RASTER_BYTES,
  ATLAS_PNG_MAXIMUM_NODES,
  ATLAS_PNG_MAXIMUM_POINTS,
  ATLAS_PNG_REQUIRED_BAND_HALO_PX,
  atlasPngMaximumLiveRasterBytes,
  type AtlasPngRasterBandPolicy,
  type AtlasPngRasterDimensions,
  type AtlasPngRasterResult,
  atlasPngRasterTestSupport,
  atlasPngRasterTotalWork,
  rasterizeAtlasPngRows,
} from './atlas-png-rasterizer.js';
import {
  ATLAS_SCENE_COMPOSITION_VERSION,
  ATLAS_SCENE_LEVELS_OF_DETAIL,
  type AtlasRenderScene,
} from './atlas-scene.js';

const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];
const RED = [255, 0, 0];
const BLUE = [0, 0, 255];

describe('atlas-png-v1 bounded rasterizer', () => {
  it('quantizes positive ties upward and paints exact first/last rows and corners', async () => {
    expect(atlasPngRasterTestSupport.quantize(1 / 512)).toBe(1 / 256);
    expect(atlasPngRasterTestSupport.quantize(3 / 512)).toBe(2 / 256);
    const value = testScene(8, 4, [
      rectangle('top-left', 0, 0, 2, 1, '#000000'),
      rectangle('bottom-right', 7, 3, 1, 1, '#ff0000'),
    ]);
    const run = await raster(value);

    expect(run.result.ok).toBe(true);
    expect(pixel(run.rows, 0, 0)).toEqual(BLACK);
    expect(pixel(run.rows, 1, 0)).toEqual(BLACK);
    expect(pixel(run.rows, 2, 0)).toEqual(WHITE);
    expect(pixel(run.rows, 6, 3)).toEqual(WHITE);
    expect(pixel(run.rows, 7, 3)).toEqual(RED);
  });

  it('applies compound paths with exact even-odd holes', async () => {
    const value = testScene(8, 4, [
      compound('donut', '#000000', [
        [point(1, 0), point(7, 0), point(7, 4), point(1, 4)],
        [point(3, 1), point(5, 1), point(5, 3), point(3, 3)],
      ]),
    ]);
    const run = await raster(value);

    expect(run.result.ok).toBe(true);
    expect(pixel(run.rows, 1, 0)).toEqual(BLACK);
    expect(pixel(run.rows, 6, 0)).toEqual(BLACK);
    expect(pixel(run.rows, 2, 2)).toEqual(BLACK);
    expect(pixel(run.rows, 3, 2)).toEqual(WHITE);
    expect(pixel(run.rows, 4, 2)).toEqual(WHITE);
    expect(pixel(run.rows, 5, 2)).toEqual(BLACK);
  });

  it('rasterizes round segment capsules and retains deterministic half-covered fine ink', async () => {
    const capsule = await raster(
      testScene(8, 4, [polyline('capsule', '#000000', 1, [point(2, 2), point(5, 2)])]),
    );
    const fine = await raster(
      testScene(8, 4, [polyline('fine', '#000000', 0.5, [point(2, 1.25), point(6, 1.25)])]),
    );

    expect(capsule.result.ok).toBe(true);
    expect(pixel(capsule.rows, 0, 1)).toEqual(WHITE);
    expect(pixel(capsule.rows, 1, 1)).toEqual([191, 191, 191]);
    expect(pixel(capsule.rows, 2, 1)).toEqual([128, 128, 128]);
    expect(pixel(capsule.rows, 5, 2)).toEqual([191, 191, 191]);
    expect(pixel(capsule.rows, 6, 2)).toEqual(WHITE);
    expect(fine.result.ok).toBe(true);
    expect(pixel(fine.rows, 3, 0)).toEqual(WHITE);
    expect(pixel(fine.rows, 3, 1)).toEqual([128, 128, 128]);
  });

  it('preserves opaque painter order and repeats identical rows', async () => {
    const base = rectangle('base-ink', 1, 1, 6, 2, '#000000');
    const line = polyline('red-line', '#ff0000', 2, [point(1, 2), point(7, 2)]);
    const top = rectangle('blue-top', 3, 1, 1, 1, '#0000ff');
    const ordered = testScene(8, 4, [base, line, top]);
    const first = await raster(ordered);
    const second = await raster(ordered);
    const reversed = await raster(testScene(8, 4, [base, top, line]));

    expect(first.result.ok).toBe(true);
    expect(first.rows).toEqual(second.rows);
    expect(pixel(first.rows, 3, 1)).toEqual(BLUE);
    expect(pixel(reversed.rows, 3, 1)).toEqual(RED);
  });

  it('matches production bands to a small one-band reference across row 64', async () => {
    const value = testScene(160, 80, [
      compound('boundary-fill', '#000000', [
        [point(20, 55), point(140, 55), point(140, 70), point(20, 70)],
      ]),
      polyline('boundary-ink', '#ff0000', 1, [point(10, 64.25), point(150, 64.25)]),
    ]);
    const production = await raster(value);
    const reference = await raster(value, {
      policy: { coreHeightPx: 80, haloPx: ATLAS_PNG_BAND_HALO_PX },
    });

    expect(production.result.ok).toBe(true);
    expect(reference.result.ok).toBe(true);
    expect(production.rows).toEqual(reference.rows);
    expect(pixel(production.rows, 50, 63)).toEqual([128, 0, 0]);
    expect(pixel(production.rows, 50, 64)).not.toEqual(WHITE);
    if (production.result.ok && reference.result.ok) {
      expect(production.result.resources.totalBands).toBe(2);
      expect(reference.result.resources.totalBands).toBe(1);
    }
  });

  it('proves the production halo margin and rejects an insufficient alternate halo', async () => {
    expect(ATLAS_PNG_REQUIRED_BAND_HALO_PX).toBe(5);
    expect(ATLAS_PNG_BAND_HALO_PX - ATLAS_PNG_REQUIRED_BAND_HALO_PX).toBe(3);
    const rejected = await raster(testScene(16, 8), {
      policy: {
        coreHeightPx: ATLAS_PNG_BAND_CORE_HEIGHT_PX,
        haloPx: ATLAS_PNG_REQUIRED_BAND_HALO_PX - 1,
      },
    });

    expect(rejected.rows).toHaveLength(0);
    expect(rejected.result).toMatchObject({
      ok: false,
      failure: { reason: 'resource-limit' },
    });
  });

  it('checks cancellation within long-polyline preparation before any band allocation', async () => {
    const repeated = new Array<RenderPoint>(5_000).fill(point(2, 2));
    const run = await raster(testScene(8, 4, [polyline('long-path', '#000000', 1, repeated)]), {
      cancelAtCheckpoint: 3,
    });

    expect(run.result).toMatchObject({ ok: false, failure: { reason: 'cancelled' } });
    expect(run.checkpoints).toEqual([1, 2, 2]);
    expect(run.rows).toHaveLength(0);
  });

  it('checks cancellation inside long compound-path painting before row emission', async () => {
    const run = await raster(
      testScene(128, 64, [
        compound('long-fill', '#000000', [
          [point(0, 0), point(128, 0), point(128, 64), point(0, 64)],
        ]),
      ]),
      { cancelAtCheckpoint: 5 },
    );

    expect(run.result).toMatchObject({ ok: false, failure: { reason: 'cancelled' } });
    expect(run.checkpoints).toEqual([1, 2, 3, 4, 4]);
    expect(run.rows).toHaveLength(0);
  });

  it('reports exact live-surface, row reuse, band, and total-work invariants', async () => {
    const run = await raster(testScene(160, 80));

    expect(run.result.ok).toBe(true);
    expect(run.rows).toHaveLength(80);
    expect(run.rowReferences.size).toBe(1);
    expect(ATLAS_PNG_MAXIMUM_LIVE_RASTER_BYTES).toBe(7_864_320);
    expect(
      atlasPngMaximumLiveRasterBytes({
        coreHeightPx: ATLAS_PNG_BAND_CORE_HEIGHT_PX,
        haloPx: ATLAS_PNG_BAND_HALO_PX,
      }),
    ).toBe(ATLAS_PNG_MAXIMUM_LIVE_RASTER_BYTES);
    if (!run.result.ok) return;
    expect(run.result.resources).toMatchObject({
      maximumLiveBands: 1,
      maximumObservedLiveBands: 1,
      maximumLiveRasterBytes: 7_864_320,
      maximumObservedLiveRasterBytes: 160 * 72 * 4 * 3,
      totalBands: 2,
    });
    expect(run.checkpoints.at(-1)).toBe(atlasPngRasterTotalWork(2, 80));
  });

  it.each([
    {
      name: 'node budget',
      scene: testScene(
        8,
        4,
        Array.from({ length: ATLAS_PNG_MAXIMUM_NODES - 1 }, (_, index) =>
          rectangle(`excess-${String(index)}`, 0, 0, 1, 1, '#000000'),
        ),
      ),
      dimensions: { widthPx: 8, heightPx: 4 },
    },
    {
      name: 'point budget',
      scene: testScene(8, 4, [
        polyline(
          'excess-points',
          '#000000',
          1,
          new Array<RenderPoint>(ATLAS_PNG_MAXIMUM_POINTS + 1).fill(point(2, 2)),
        ),
      ]),
      dimensions: { widthPx: 8, heightPx: 4 },
    },
    {
      name: 'stroke sample budget',
      scene: testScene(2_048, 1_024, [
        polyline('adversarial-diagonal', '#000000', 2, [point(0, 0), point(2_048, 1_024)]),
      ]),
      dimensions: { widthPx: 8_192, heightPx: 4_096 },
    },
    {
      name: 'dimension budget',
      scene: testScene(8_194, 4_097),
      dimensions: { widthPx: 8_194, heightPx: 4_097 },
    },
  ])('rejects the adversarial $name before emitting rows', async ({ scene, dimensions }) => {
    const run = await raster(scene, { dimensions });

    expect(run.rows).toHaveLength(0);
    expect(run.result).toMatchObject({
      ok: false,
      failure: { reason: 'resource-limit' },
    });
  });
});

interface RasterOptions {
  readonly policy?: AtlasPngRasterBandPolicy;
  readonly dimensions?: AtlasPngRasterDimensions;
  readonly cancelAtCheckpoint?: number;
}

async function raster(
  scene: AtlasRenderScene,
  options: RasterOptions = {},
): Promise<{
  readonly result: AtlasPngRasterResult;
  readonly rows: readonly Uint8Array[];
  readonly rowReferences: ReadonlySet<Uint8Array>;
  readonly checkpoints: readonly number[];
}> {
  const rows: Uint8Array[] = [];
  const rowReferences = new Set<Uint8Array>();
  const checkpoints: number[] = [];
  let cancelled = false;
  const request = {
    scene,
    dimensions: options.dimensions ?? { widthPx: scene.widthPx, heightPx: scene.heightPx },
    initialCompletedWork: 0,
    writeRow(row: Uint8Array): boolean {
      rowReferences.add(row);
      rows.push(row.slice());
      return true;
    },
    runtime: {
      isCancellationRequested: (): boolean => cancelled,
      checkpoint(completedWork: number): Promise<void> {
        checkpoints.push(completedWork);
        if (checkpoints.length === options.cancelAtCheckpoint) cancelled = true;
        return Promise.resolve();
      },
    },
  };
  const result =
    options.policy === undefined
      ? await rasterizeAtlasPngRows(request)
      : await atlasPngRasterTestSupport.rasterizeWithBandPolicy(request, options.policy);
  return { result, rows, rowReferences, checkpoints };
}

function testScene(
  widthPx: number,
  heightPx: number,
  nodes: readonly RenderNode[] = [],
): AtlasRenderScene {
  return {
    authority: 'disposable-render-scene',
    sceneKind: 'whole-world-atlas',
    sceneCompositionVersion: ATLAS_SCENE_COMPOSITION_VERSION,
    levelOfDetail: ATLAS_SCENE_LEVELS_OF_DETAIL.normalAtlas,
    coordinateSpace: ATLAS_DISPLAY_COORDINATE_SPACE,
    sourceWorldMapId: 'test-world',
    projection: ATLAS_DISPLAY_PROJECTION_METADATA,
    widthPx,
    heightPx,
    nodes: [
      rectangle('atlas/background/paper', 0, 0, widthPx, heightPx, '#eeeeee'),
      rectangle('atlas/background/water', 0, 0, widthPx, heightPx, '#ffffff'),
      ...nodes,
    ],
  };
}

function rectangle(
  id: string,
  xPx: number,
  yPx: number,
  widthPx: number,
  heightPx: number,
  fillColor: string,
): RenderNode {
  return { id, kind: 'rectangle', sourceId: id, xPx, yPx, widthPx, heightPx, fillColor };
}

function compound(
  id: string,
  fillColor: string,
  subpaths: readonly (readonly RenderPoint[])[],
): RenderNode {
  return {
    id,
    kind: 'compoundPath',
    sourceId: id,
    fillColor,
    fillRule: 'evenodd',
    subpaths: subpaths.map((points) => ({ points })),
  };
}

function polyline(
  id: string,
  strokeColor: string,
  strokeWidthPx: number,
  points: readonly RenderPoint[],
): RenderNode {
  return { id, kind: 'polyline', sourceId: id, strokeColor, strokeWidthPx, points };
}

function point(xPx: number, yPx: number): RenderPoint {
  return { xPx, yPx };
}

function pixel(rows: readonly Uint8Array[], x: number, y: number): readonly number[] {
  return [...(rows[y]?.subarray(x * 3, x * 3 + 3) ?? [])];
}
