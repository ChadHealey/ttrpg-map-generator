import { sha256 } from '@ttrpg-map/core';
import {
  ATLAS_DISPLAY_PROJECTION_METADATA,
  ATLAS_SCENE_COMPOSITION_VERSION,
  ATLAS_SCENE_LEVELS_OF_DETAIL,
  ATLAS_SVG_DIAGNOSTIC_CODES,
} from '@ttrpg-map/render';
import { describe, expect, it } from 'vitest';

import {
  type AtlasSvgDestinationPort,
  exportAcceptedAtlasSvg,
} from './atlas-svg-export-orchestrator.js';
import type { AcceptedAtlasState } from './atlas-workflow-generation.js';

const WORLD_DOCUMENT_ID = '78b2157c-4f2c-5ac7-986b-76dc808f377e';
const WORLD_MAP_ID = 'a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7';
const PAPER_ENTITY_ID = '22222222-2222-4222-8222-222222222222';
const WATER_ENTITY_ID = '33333333-3333-4333-8333-333333333333';
const LAND_ENTITY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PAPER_ASPECT_ID = '55555555-5555-4555-8555-555555555555';
const WATER_ASPECT_ID = '66666666-6666-4666-8666-666666666666';
const LAND_ASPECT_ID = '77777777-7777-4777-8777-777777777777';

describe('accepted atlas SVG desktop export', () => {
  it('writes the scene bytes once and leaves every accepted reference unchanged', async () => {
    const accepted = acceptedState();
    const documentReference = accepted.document;
    const sceneReference = accepted.scene;
    const writes: Parameters<AtlasSvgDestinationPort['write']>[0][] = [];
    const destination = destinationPort(writes);
    const progress: string[] = [];

    const result = await exportAcceptedAtlasSvg(
      accepted,
      '/exports/world.svg',
      runtime(progress),
      destination,
    );

    expect(result).toMatchObject({
      ok: true,
      receipt: {
        targetPath: '/exports/world.svg',
        profileId: 'atlas-svg-v1',
        widthMillimeters: 400,
        heightMillimeters: 200,
      },
    });
    expect(writes).toHaveLength(1);
    expect(writes[0]?.bytes.at(0)).toBe(60);
    expect(writes[0]?.expectedSha256).toBe(hex(sha256(writes[0]?.bytes ?? new Uint8Array())));
    expect(accepted.document).toBe(documentReference);
    expect(accepted.scene).toBe(sceneReference);
    expect(progress).toContain('writing-atomically');
    expect(progress.at(-1)).toBe('completed');
  });

  it('is byte-identical on repeat and changes dependent SVG geometry with geography', async () => {
    const baselineWrites: Parameters<AtlasSvgDestinationPort['write']>[0][] = [];
    const changedWrites: Parameters<AtlasSvgDestinationPort['write']>[0][] = [];
    const accepted = acceptedState();

    await exportAcceptedAtlasSvg(
      accepted,
      '/exports/a.svg',
      runtime([]),
      destinationPort(baselineWrites),
    );
    await exportAcceptedAtlasSvg(
      accepted,
      '/exports/b.svg',
      runtime([]),
      destinationPort(baselineWrites),
    );
    await exportAcceptedAtlasSvg(
      acceptedState(42),
      '/exports/c.svg',
      runtime([]),
      destinationPort(changedWrites),
    );

    expect(baselineWrites[0]?.bytes).toEqual(baselineWrites[1]?.bytes);
    expect(changedWrites[0]?.bytes).not.toEqual(baselineWrites[0]?.bytes);
  });

  it('cancels before starting a destination commit and returns no partial output', async () => {
    let isCancelled = false;
    let writes = 0;
    const result = await exportAcceptedAtlasSvg(
      acceptedState(),
      '/exports/world.svg',
      {
        operationId: 'svg:cancel',
        isCancellationRequested: () => isCancelled,
        reportProgress: () => undefined,
        yieldControl: () => {
          isCancelled = true;
          return Promise.resolve();
        },
        beginNativeCommit: () => undefined,
      },
      {
        defaultTargetPath: () => Promise.resolve('/unused.svg'),
        write: () => {
          writes += 1;
          throw new Error('Destination write must not run after cancellation.');
        },
      },
    );

    expect(writes).toBe(0);
    expect(result).toMatchObject({
      ok: false,
      isCancelled: true,
      diagnosticCodes: [ATLAS_SVG_DIAGNOSTIC_CODES.cancelled],
    });
  });

  it('reports a terminal failure when the atomic destination rejects the write', async () => {
    const stages: { readonly stage: string; readonly isTerminal: boolean }[] = [];
    const result = await exportAcceptedAtlasSvg(
      acceptedState(),
      '/exports/world.svg',
      {
        operationId: 'svg:failure',
        isCancellationRequested: () => false,
        reportProgress: (value) => stages.push(value),
        yieldControl: () => Promise.resolve(),
        beginNativeCommit: () => undefined,
      },
      {
        defaultTargetPath: () => Promise.resolve('/unused.svg'),
        write: () =>
          Promise.resolve({
            ok: false,
            diagnostic: { code: 'atlas-svg.write.io', message: 'Destination unavailable.' },
          }),
      },
    );

    expect(result).toMatchObject({
      ok: false,
      diagnosticCodes: ['atlas-svg.write.io'],
    });
    expect(stages.at(-1)).toMatchObject({ stage: 'failed', isTerminal: true });
  });
});

function destinationPort(
  writes: Parameters<AtlasSvgDestinationPort['write']>[0][],
): AtlasSvgDestinationPort {
  return {
    defaultTargetPath: () => Promise.resolve('/exports/default.svg'),
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

function runtime(progress: string[]) {
  return {
    operationId: 'svg:test',
    isCancellationRequested: () => false,
    reportProgress: ({ stage }: { readonly stage: string }) => progress.push(stage),
    yieldControl: () => Promise.resolve(),
    beginNativeCommit: () => undefined,
  };
}

function acceptedState(landX = 10): AcceptedAtlasState {
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
        id: 'atlas/land/land',
        kind: 'compoundPath',
        sourceId: LAND_ENTITY_ID,
        sourceAspectId: LAND_ASPECT_ID,
        relatedSourceIds: [WATER_ENTITY_ID],
        subpaths: [
          {
            points: [
              { xPx: landX, yPx: 10 },
              { xPx: 20, yPx: 10 },
              { xPx: 20, yPx: 20 },
            ],
          },
        ],
        fillColor: '#c9c39a',
        fillRule: 'evenodd',
      },
      ...decorationNodes(),
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

function decorationNodes(): AcceptedAtlasState['scene']['nodes'] {
  return [
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
        { xPx: 10, yPx: 10 },
        { xPx: 20, yPx: 10 },
      ],
      strokeColor: '#282a24',
      strokeWidthPx: 1.25,
    },
  ];
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
