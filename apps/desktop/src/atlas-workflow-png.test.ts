import { DEFAULT_ATLAS_CONTROLS } from '@ttrpg-map/core';
import {
  ATLAS_DISPLAY_PROJECTION_METADATA,
  ATLAS_SCENE_COMPOSITION_VERSION,
  ATLAS_SCENE_LEVELS_OF_DETAIL,
} from '@ttrpg-map/render';
import { describe, expect, it } from 'vitest';

import type { AtlasPngDestinationPort } from './atlas-png-export-orchestrator.js';
import type { AtlasSvgDestinationPort } from './atlas-svg-export-orchestrator.js';
import { AtlasWorkflow, MILESTONE_TWO_ATLAS_PROOF_SEED } from './atlas-workflow.js';
import type {
  AcceptedAtlasState,
  AtlasWorkflowGenerationPort,
} from './atlas-workflow-generation.js';

describe('Milestone 2 atlas PNG workflow', () => {
  it('exports the exact accepted scene at the production dimensions without mutating state', async () => {
    const accepted = fixtureAcceptedState();
    const writes: Parameters<AtlasPngDestinationPort['write']>[0][] = [];
    const workflow = new AtlasWorkflow(
      generationPort([accepted]),
      unusedSvgDestination(),
      pngDestination(writes),
    );
    await workflow.acceptFull(MILESTONE_TWO_ATLAS_PROOF_SEED, DEFAULT_ATLAS_CONTROLS);
    const acceptedReference = workflow.snapshot.accepted;
    const sceneReference = workflow.snapshot.scene;

    expect(await workflow.exportPng('/exports/atlas.png')).toEqual({ ok: true });

    expect(workflow.snapshot.accepted).toBe(acceptedReference);
    expect(workflow.snapshot.scene).toBe(sceneReference);
    expect(workflow.snapshot.pngExportReceipt).toMatchObject({
      targetPath: '/exports/atlas.png',
      profileId: 'atlas-png-v1',
      profileVersion: 1,
      widthPx: 8_192,
      heightPx: 4_096,
      byteLength: writes[0]?.bytes.byteLength,
    });
    expect(writes).toHaveLength(1);
    expect(writes[0]?.bytes.subarray(0, 8)).toEqual(Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10));
  }, 120_000);

  it('uses PNG-specific diagnostics while native commit is non-cancellable', async () => {
    const accepted = fixtureAcceptedState();
    let writeStartedResolve: (() => void) | undefined;
    let finishWrite: (() => void) | undefined;
    const writeStarted = new Promise<void>((resolveStarted) => {
      writeStartedResolve = resolveStarted;
    });
    const destination: AtlasPngDestinationPort = {
      defaultTargetPath: () => Promise.resolve('/exports/default.png'),
      write(request) {
        writeStartedResolve?.();
        return new Promise((resolveWrite) => {
          finishWrite = () => {
            resolveWrite({
              ok: true,
              value: {
                targetPath: request.targetPath,
                sha256: request.expectedSha256,
                byteLength: request.bytes.byteLength,
                platform: 'macos',
              },
            });
          };
        });
      },
    };
    const workflow = new AtlasWorkflow(
      generationPort([accepted]),
      unusedSvgDestination(),
      destination,
    );
    await workflow.acceptFull(MILESTONE_TWO_ATLAS_PROOF_SEED, DEFAULT_ATLAS_CONTROLS);

    const exporting = workflow.exportPng('/exports/atlas.png');
    await writeStarted;

    expect(workflow.snapshot).toMatchObject({ isBusy: true, isCancellationAllowed: false });
    expect(workflow.cancelActiveOperation()).toMatchObject({
      ok: false,
      code: 'atlas-png.commit.non-cancellable',
    });
    expect(
      await workflow.acceptFull(MILESTONE_TWO_ATLAS_PROOF_SEED, DEFAULT_ATLAS_CONTROLS),
    ).toMatchObject({ ok: false, code: 'atlas-png.commit.non-cancellable' });

    finishWrite?.();
    expect(await exporting).toEqual({ ok: true });
    expect(workflow.snapshot.pngExportReceipt).toMatchObject({ targetPath: '/exports/atlas.png' });
  }, 120_000);
});

function generationPort(accepted: readonly AcceptedAtlasState[]): AtlasWorkflowGenerationPort {
  let index = 0;
  return {
    preview: () => Promise.reject(new Error('Preview is outside this PNG workflow test.')),
    commit: () => {
      const value = accepted[index];
      index += 1;
      return value === undefined
        ? Promise.resolve({
            ok: false,
            isCancelled: false,
            diagnosticCodes: ['atlas.test.no-accepted-state'],
            message: 'No accepted state remains.',
          })
        : Promise.resolve({ ok: true, accepted: value });
    },
  };
}

function pngDestination(
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

function unusedSvgDestination(): AtlasSvgDestinationPort {
  return {
    defaultTargetPath: () => Promise.resolve('/exports/unused.svg'),
    write: () => Promise.reject(new Error('SVG destination is outside this PNG workflow test.')),
  };
}

function fixtureAcceptedState(): AcceptedAtlasState {
  const paperEntityId = '22222222-2222-4222-8222-222222222222';
  const waterEntityId = '33333333-3333-4333-8333-333333333333';
  const landEntityId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const paperAspectId = '55555555-5555-4555-8555-555555555555';
  const waterAspectId = '66666666-6666-4666-8666-666666666666';
  const landAspectId = '77777777-7777-4777-8777-777777777777';
  const worldMapId = 'a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7';
  const source = (sourceId: string, sourceAspectId: string, relatedSourceIds: readonly string[]) =>
    ({ sourceId, sourceAspectId, relatedSourceIds }) as const;
  const line = (
    id: string,
    sourceId: string,
    sourceAspectId: string,
    relatedSourceIds: readonly string[],
    coordinate: number,
    strokeColor: string,
    strokeWidthPx: number,
  ) =>
    ({
      id,
      kind: 'polyline',
      ...source(sourceId, sourceAspectId, relatedSourceIds),
      points: [
        { xPx: coordinate, yPx: coordinate },
        { xPx: coordinate + 1, yPx: coordinate + 1 },
      ],
      strokeColor,
      strokeWidthPx,
    }) as const;
  const scene: AcceptedAtlasState['scene'] = {
    authority: 'disposable-render-scene',
    sceneKind: 'whole-world-atlas',
    sceneCompositionVersion: ATLAS_SCENE_COMPOSITION_VERSION,
    levelOfDetail: ATLAS_SCENE_LEVELS_OF_DETAIL.normalAtlas,
    coordinateSpace: 'atlas-display-equirectangular-v1',
    sourceWorldMapId: worldMapId,
    projection: ATLAS_DISPLAY_PROJECTION_METADATA,
    widthPx: 2_048,
    heightPx: 1_024,
    nodes: [
      {
        id: 'atlas/background/paper',
        kind: 'rectangle',
        ...source(paperEntityId, paperAspectId, []),
        xPx: 0,
        yPx: 0,
        widthPx: 2_048,
        heightPx: 1_024,
        fillColor: '#eadcba',
      },
      {
        id: 'atlas/background/water',
        kind: 'rectangle',
        ...source(waterEntityId, waterAspectId, []),
        xPx: 0,
        yPx: 0,
        widthPx: 2_048,
        heightPx: 1_024,
        fillColor: '#afbec0',
      },
      {
        id: 'atlas/land/land',
        kind: 'compoundPath',
        ...source(landEntityId, landAspectId, [waterEntityId]),
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
      line('atlas/paper/grain-0000', paperEntityId, paperAspectId, [], 30, '#d9c8a3', 0.55),
      line(
        'atlas-water/echo/0000',
        waterEntityId,
        waterAspectId,
        [landEntityId],
        40,
        '#718c8e',
        0.75,
      ),
      line('atlas-water/mark/0000', waterEntityId, waterAspectId, [], 50, '#718c8e', 0.6),
      line(
        'atlas/coastline/0000',
        landEntityId,
        landAspectId,
        [waterEntityId],
        10,
        '#282a24',
        1.25,
      ),
    ],
  };
  return {
    document: {
      worldDocumentId: '78b2157c-4f2c-5ac7-986b-76dc808f377e',
      displayName: 'PNG workflow fixture',
      worldSeed: MILESTONE_TWO_ATLAS_PROOF_SEED,
      rootMapId: worldMapId,
      maps: [],
    } as unknown as AcceptedAtlasState['document'],
    geography: { landmasses: [], waterBodies: [] } as unknown as AcceptedAtlasState['geography'],
    appearance: {} as AcceptedAtlasState['appearance'],
    scene,
  };
}
