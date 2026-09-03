import { sha256 } from '@ttrpg-map/core';
import {
  ATLAS_DISPLAY_PROJECTION_METADATA,
  ATLAS_PNG_DIAGNOSTIC_CODES,
  ATLAS_SCENE_COMPOSITION_VERSION,
  ATLAS_SCENE_LEVELS_OF_DETAIL,
} from '@ttrpg-map/render';
import { describe, expect, it } from 'vitest';

import {
  type AtlasPngDestinationPort,
  type AtlasPngWorkflowProgress,
  exportAcceptedAtlasPng,
} from './atlas-png-export-orchestrator.js';
import type { AcceptedAtlasState } from './atlas-workflow-generation.js';

const TEST_DIMENSIONS = Object.freeze({ widthPx: 1_600, heightPx: 800 });
const WORLD_DOCUMENT_ID = '78b2157c-4f2c-5ac7-986b-76dc808f377e';
const WORLD_MAP_ID = 'a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7';
const PAPER_ENTITY_ID = '22222222-2222-4222-8222-222222222222';
const WATER_ENTITY_ID = '33333333-3333-4333-8333-333333333333';
const LAND_ENTITY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PAPER_ASPECT_ID = '55555555-5555-4555-8555-555555555555';
const WATER_ASPECT_ID = '66666666-6666-4666-8666-666666666666';
const LAND_ASPECT_ID = '77777777-7777-4777-8777-777777777777';

describe('accepted atlas PNG desktop export', () => {
  it('writes deterministic bytes with an exact receipt and leaves accepted references unchanged', async () => {
    const accepted = acceptedState();
    const references = {
      document: accepted.document,
      geography: accepted.geography,
      appearance: accepted.appearance,
      scene: accepted.scene,
    };
    const writes: Parameters<AtlasPngDestinationPort['write']>[0][] = [];
    const progress: AtlasPngWorkflowProgress[] = [];
    let commits = 0;
    const runtime = workflowRuntime(progress, () => {
      commits += 1;
    });
    const destination = destinationPort(writes);

    const first = await exportAcceptedAtlasPng(
      accepted,
      '/exports/world-a.png',
      runtime,
      destination,
      TEST_DIMENSIONS,
    );
    const second = await exportAcceptedAtlasPng(
      accepted,
      '/exports/world-b.png',
      workflowRuntime([], () => {
        commits += 1;
      }),
      destination,
      TEST_DIMENSIONS,
    );

    expect(first).toEqual({
      ok: true,
      receipt: {
        targetPath: '/exports/world-a.png',
        sha256: writes[0]?.expectedSha256,
        byteLength: writes[0]?.bytes.byteLength,
        platform: 'macos',
        profileId: 'atlas-png-v1',
        profileVersion: 1,
        widthPx: 1_600,
        heightPx: 800,
      },
    });
    expect(second).toMatchObject({ ok: true, receipt: { targetPath: '/exports/world-b.png' } });
    expect(writes).toHaveLength(2);
    expect(writes[0]?.bytes.subarray(0, 8)).toEqual(Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10));
    expect(writes[0]?.bytes).toEqual(writes[1]?.bytes);
    expect(writes[0]?.expectedSha256).toBe(hex(sha256(writes[0]?.bytes ?? new Uint8Array())));
    expect(commits).toBe(2);
    expect(accepted.document).toBe(references.document);
    expect(accepted.geography).toBe(references.geography);
    expect(accepted.appearance).toBe(references.appearance);
    expect(accepted.scene).toBe(references.scene);
    expectProgress(progress);
  });

  it('cancels before native commit and returns no partial destination output', async () => {
    let writes = 0;
    let commits = 0;
    const progress: AtlasPngWorkflowProgress[] = [];
    const result = await exportAcceptedAtlasPng(
      acceptedState(),
      '/exports/world.png',
      {
        operationId: 'png:cancel',
        isCancellationRequested: () => true,
        reportProgress: (value) => progress.push(value),
        yieldControl: () => Promise.resolve(),
        beginNativeCommit: () => {
          commits += 1;
        },
      },
      {
        defaultTargetPath: () => Promise.resolve('/unused.png'),
        write: () => {
          writes += 1;
          throw new Error('Destination write must not run after cancellation.');
        },
      },
      TEST_DIMENSIONS,
    );

    expect(writes).toBe(0);
    expect(commits).toBe(0);
    expect(result).toMatchObject({
      ok: false,
      isCancelled: true,
      diagnosticCodes: [ATLAS_PNG_DIAGNOSTIC_CODES.cancelled],
    });
    expect(progress).toHaveLength(2);
    const totalWork = progress[0]?.totalWork;
    expect(totalWork).toBeGreaterThan(1);
    expect(progress).toEqual([
      {
        operationId: 'png:cancel',
        stage: 'png-validating',
        completedWork: 0,
        totalWork,
        isCancellationRequested: true,
        isTerminal: false,
      },
      {
        operationId: 'png:cancel',
        stage: 'png-cancelled',
        completedWork: 0,
        totalWork,
        isCancellationRequested: true,
        isTerminal: true,
      },
    ]);
  });

  it('begins the non-cancellable commit and reports terminal native failure exactly', async () => {
    const progress: AtlasPngWorkflowProgress[] = [];
    let commits = 0;
    const result = await exportAcceptedAtlasPng(
      acceptedState(),
      '/exports/world.png',
      workflowRuntime(progress, () => {
        commits += 1;
      }),
      {
        defaultTargetPath: () => Promise.resolve('/unused.png'),
        write: () =>
          Promise.resolve({
            ok: false,
            diagnostic: {
              code: 'atlas-png.native.io-failed',
              message: 'Destination unavailable.',
            },
          }),
      },
      TEST_DIMENSIONS,
    );

    expect(commits).toBe(1);
    expect(result).toEqual({
      ok: false,
      isCancelled: false,
      diagnosticCodes: ['atlas-png.native.io-failed'],
      message: 'Destination unavailable.',
    });
    expect(progress.at(-1)).toMatchObject({
      operationId: 'png:test',
      stage: 'failed',
      isCancellationRequested: false,
      isTerminal: true,
    });
  });

  it('selects the v2 physical-overlay profile from scene nodes and preserves v1 for M2 scenes', async () => {
    const writes: Parameters<AtlasPngDestinationPort['write']>[0][] = [];
    const physical = await exportAcceptedAtlasPng(
      acceptedState(true),
      '/exports/physical.png',
      workflowRuntime([], () => undefined),
      destinationPort(writes),
      TEST_DIMENSIONS,
    );
    const m2 = await exportAcceptedAtlasPng(
      acceptedState(),
      '/exports/m2.png',
      workflowRuntime([], () => undefined),
      destinationPort(writes),
      TEST_DIMENSIONS,
    );

    expect(physical).toMatchObject({ ok: true, receipt: { profileId: 'atlas-png-v2' } });
    expect(m2).toMatchObject({ ok: true, receipt: { profileId: 'atlas-png-v1' } });
  });
});

function destinationPort(
  writes: Parameters<AtlasPngDestinationPort['write']>[0][],
): AtlasPngDestinationPort {
  return {
    defaultTargetPath: () => Promise.resolve('/exports/default.png'),
    write(request) {
      writes.push(request);
      return Promise.resolve({
        ok: true,
        value: {
          targetPath: request.targetPath,
          sha256: request.expectedSha256,
          byteLength: request.bytes.byteLength,
          platform: 'macos',
        },
      });
    },
  };
}

function workflowRuntime(progress: AtlasPngWorkflowProgress[], beginNativeCommit: () => void) {
  return {
    operationId: 'png:test',
    isCancellationRequested: () => false,
    reportProgress: (value: AtlasPngWorkflowProgress) => progress.push(value),
    yieldControl: () => Promise.resolve(),
    beginNativeCommit,
  };
}

function expectProgress(progress: readonly AtlasPngWorkflowProgress[]): void {
  const first = progress[0];
  const writing = progress.find(({ stage }) => stage === 'writing-atomically');
  const renderCompleted = progress.find(({ stage }) => stage === 'png-completed');
  const completed = progress.at(-1);
  expect(first).toMatchObject({
    operationId: 'png:test',
    stage: 'png-validating',
    completedWork: 0,
    isCancellationRequested: false,
    isTerminal: false,
  });
  expect(writing).toEqual({
    operationId: 'png:test',
    stage: 'writing-atomically',
    completedWork: (writing?.totalWork ?? 0) - 1,
    totalWork: writing?.totalWork,
    isCancellationRequested: false,
    isTerminal: false,
  });
  expect(renderCompleted).toMatchObject({ isTerminal: false });
  expect(completed).toEqual({
    operationId: 'png:test',
    stage: 'completed',
    completedWork: completed?.totalWork,
    totalWork: completed?.totalWork,
    isCancellationRequested: false,
    isTerminal: true,
  });
}

function acceptedState(withPhysicalOverlay = false): AcceptedAtlasState {
  const scene: AcceptedAtlasState['scene'] = {
    authority: 'disposable-render-scene',
    sceneKind: 'whole-world-atlas',
    sceneCompositionVersion: ATLAS_SCENE_COMPOSITION_VERSION,
    levelOfDetail: ATLAS_SCENE_LEVELS_OF_DETAIL.normalAtlas,
    coordinateSpace: 'atlas-display-equirectangular-v1',
    sourceWorldMapId: WORLD_MAP_ID,
    projection: ATLAS_DISPLAY_PROJECTION_METADATA,
    widthPx: 2_048,
    heightPx: 1_024,
    nodes: [
      rectangle('atlas/background/paper', PAPER_ENTITY_ID, PAPER_ASPECT_ID, '#eadcba'),
      rectangle('atlas/background/water', WATER_ENTITY_ID, WATER_ASPECT_ID, '#afbec0'),
      {
        id: 'atlas/land/land',
        kind: 'compoundPath',
        sourceId: LAND_ENTITY_ID,
        sourceAspectId: LAND_ASPECT_ID,
        relatedSourceIds: [WATER_ENTITY_ID],
        subpaths: [
          {
            points: [
              { xPx: 10, yPx: 10 },
              { xPx: 20, yPx: 10 },
              { xPx: 20, yPx: 20 },
            ],
          },
        ],
        fillColor: '#c9c39a',
        fillRule: 'evenodd',
      },
      ...(withPhysicalOverlay ? [physicalOverlayNode()] : []),
      polyline('atlas/paper/grain-0000', PAPER_ENTITY_ID, PAPER_ASPECT_ID, [], 30, '#d9c8a3', 0.55),
      polyline(
        'atlas-water/echo/0000',
        WATER_ENTITY_ID,
        WATER_ASPECT_ID,
        [LAND_ENTITY_ID],
        40,
        '#718c8e',
        0.75,
      ),
      polyline('atlas-water/mark/0000', WATER_ENTITY_ID, WATER_ASPECT_ID, [], 50, '#718c8e', 0.6),
      polyline(
        'atlas/coastline/0000',
        LAND_ENTITY_ID,
        LAND_ASPECT_ID,
        [WATER_ENTITY_ID],
        10,
        '#282a24',
        1.25,
      ),
    ],
  };
  return {
    document: {
      worldDocumentId: WORLD_DOCUMENT_ID,
      displayName: 'Atlas',
      worldSeed: '81985529216486895',
      rootMapId: WORLD_MAP_ID,
      maps: [],
    } as unknown as AcceptedAtlasState['document'],
    geography: {} as AcceptedAtlasState['geography'],
    appearance: {} as AcceptedAtlasState['appearance'],
    scene,
  };
}

function physicalOverlayNode(): AcceptedAtlasState['scene']['nodes'][number] {
  return polyline(
    'atlas/physical/03-mountain/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/0000',
    LAND_ENTITY_ID,
    LAND_ASPECT_ID,
    [],
    12,
    '#805936',
    1,
  );
}

function rectangle(
  id: string,
  sourceId: string,
  sourceAspectId: string,
  fillColor: string,
): AcceptedAtlasState['scene']['nodes'][number] {
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
  relatedSourceIds: readonly string[],
  coordinate: number,
  strokeColor: string,
  strokeWidthPx: number,
): AcceptedAtlasState['scene']['nodes'][number] {
  return {
    id,
    kind: 'polyline',
    sourceId,
    sourceAspectId,
    relatedSourceIds,
    points: [
      { xPx: coordinate, yPx: coordinate },
      { xPx: coordinate + 1, yPx: coordinate + 1 },
    ],
    strokeColor,
    strokeWidthPx,
  };
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
