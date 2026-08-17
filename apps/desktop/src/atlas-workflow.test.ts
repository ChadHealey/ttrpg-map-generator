import { DEFAULT_ATLAS_CONTROLS } from '@ttrpg-map/core';
import {
  ATLAS_DISPLAY_PROJECTION_METADATA,
  ATLAS_SCENE_COMPOSITION_VERSION,
  ATLAS_SCENE_LEVELS_OF_DETAIL,
} from '@ttrpg-map/render';
import { describe, expect, it } from 'vitest';

import { AtlasWorkflow, MILESTONE_TWO_ATLAS_PROOF_SEED } from './atlas-workflow.js';
import type {
  AcceptedAtlasState,
  AtlasWorkflowCommitResult,
  AtlasWorkflowGenerationPort,
  AtlasWorkflowPreviewResult,
} from './atlas-workflow-generation.js';

describe('Milestone 2 atlas desktop orchestration', () => {
  it('rejects invalid control values before dispatching preview or full work', async () => {
    let dispatchCount = 0;
    const workflow = new AtlasWorkflow({
      preview() {
        dispatchCount += 1;
        return Promise.resolve(previewResult('default'));
      },
      commit() {
        dispatchCount += 1;
        return Promise.resolve(failure('atlas.test.unexpected', false));
      },
    });
    const invalid = { ...DEFAULT_ATLAS_CONTROLS, targetWaterCoveragePercent: 81 };

    expect(await workflow.requestPreview(MILESTONE_TWO_ATLAS_PROOF_SEED, invalid)).toMatchObject({
      ok: false,
      code: 'atlas-geography.controls.invalid',
    });
    expect(await workflow.acceptFull(MILESTONE_TWO_ATLAS_PROOF_SEED, invalid)).toMatchObject({
      ok: false,
      code: 'atlas-geography.controls.invalid',
    });
    expect(dispatchCount).toBe(0);
  });

  it('keeps accepted state exact when full generation fails or is cancelled', async () => {
    const baseline = acceptedState('baseline');
    const failures: AtlasWorkflowCommitResult[] = [
      { ok: true, accepted: baseline },
      failure('atlas.test.failure', false),
      failure('atlas.test.cancelled', true),
    ];
    const workflow = new AtlasWorkflow(fakePort({ commits: failures }));

    expect(
      await workflow.acceptFull(MILESTONE_TWO_ATLAS_PROOF_SEED, DEFAULT_ATLAS_CONTROLS),
    ).toEqual({
      ok: true,
    });
    const acceptedReference = workflow.snapshot.accepted;

    expect(
      await workflow.acceptFull(MILESTONE_TWO_ATLAS_PROOF_SEED, DEFAULT_ATLAS_CONTROLS),
    ).toMatchObject({
      ok: false,
      code: 'atlas.test.failure',
    });
    expect(workflow.snapshot.accepted).toBe(acceptedReference);

    expect(
      await workflow.acceptFull(MILESTONE_TWO_ATLAS_PROOF_SEED, DEFAULT_ATLAS_CONTROLS),
    ).toMatchObject({
      ok: false,
      code: 'atlas.test.cancelled',
    });
    expect(workflow.snapshot.accepted).toBe(acceptedReference);
  });

  it('ignores stale preview completion order and never promotes preview state', async () => {
    const resolvers: ((result: AtlasWorkflowPreviewResult) => void)[] = [];
    const port = fakePort({
      preview() {
        return new Promise((resolve) => {
          resolvers.push(resolve);
        });
      },
    });
    const workflow = new AtlasWorkflow(port);
    const first = workflow.requestPreview(MILESTONE_TWO_ATLAS_PROOF_SEED, DEFAULT_ATLAS_CONTROLS);
    const second = workflow.requestPreview(MILESTONE_TWO_ATLAS_PROOF_SEED, {
      ...DEFAULT_ATLAS_CONTROLS,
      fragmentationPercent: 36,
    });
    resolvers[1]?.(previewResult('second'));
    await second;
    resolvers[0]?.(previewResult('first'));
    await first;

    expect(workflow.snapshot.preview?.previewVersion).toBe(1);
    expect(workflow.snapshot.preview?.controls.fragmentationPercent).toBe(36);
    expect(workflow.snapshot.controls.fragmentationPercent).toBe(35);
    expect(workflow.snapshot.accepted).toBeUndefined();
    expect(workflow.snapshot.isPreviewState).toBe(true);
  });

  it('discards preview controls without changing an accepted atlas', async () => {
    const baseline = acceptedState('baseline');
    const workflow = new AtlasWorkflow(
      fakePort({
        commits: [{ ok: true, accepted: baseline }],
        preview: () => Promise.resolve(previewResult('second')),
      }),
    );
    await workflow.acceptFull(MILESTONE_TWO_ATLAS_PROOF_SEED, DEFAULT_ATLAS_CONTROLS);
    const acceptedReference = workflow.snapshot.accepted;
    await workflow.requestPreview(MILESTONE_TWO_ATLAS_PROOF_SEED, {
      ...DEFAULT_ATLAS_CONTROLS,
      fragmentationPercent: 36,
    });

    expect(workflow.snapshot.preview?.controls.fragmentationPercent).toBe(36);
    expect(workflow.discardPreview()).toEqual({ ok: true });
    expect(workflow.snapshot.accepted).toBe(acceptedReference);
    expect(workflow.snapshot.controls.fragmentationPercent).toBe(35);
    expect(workflow.snapshot.preview).toBeUndefined();
    expect(workflow.snapshot.phase).toBe('accepted');
    expect(workflow.planReroll('geography')).toEqual({ ok: true });
  });

  it('requires a visible change-set plan before either independent reroll', async () => {
    const baseline = acceptedState('baseline');
    const geography = acceptedState('geography');
    const appearance = acceptedState('appearance');
    const operations: string[] = [];
    const port = fakePort({
      commits: [
        { ok: true, accepted: baseline },
        { ok: true, accepted: geography },
        { ok: true, accepted: appearance },
      ],
      onCommit(operation) {
        operations.push(operation);
      },
    });
    const workflow = new AtlasWorkflow(port);
    await workflow.acceptFull(MILESTONE_TWO_ATLAS_PROOF_SEED, DEFAULT_ATLAS_CONTROLS);

    expect(await workflow.commitPlannedReroll()).toMatchObject({
      ok: false,
      code: 'atlas.reroll.plan-required',
    });
    expect(workflow.planReroll('geography')).toEqual({ ok: true });
    expect(workflow.snapshot.pendingReroll?.remainsFixed).toContain(
      'paper treatment and style parameters',
    );
    expect(await workflow.commitPlannedReroll()).toEqual({ ok: true });
    expect(workflow.snapshot.accepted).toBe(geography);

    expect(workflow.planReroll('appearance')).toEqual({ ok: true });
    expect(workflow.snapshot.pendingReroll?.remainsFixed).toContain('canonical coastline bytes');
    expect(await workflow.commitPlannedReroll()).toEqual({ ok: true });
    expect(workflow.snapshot.accepted).toBe(appearance);
    expect(operations).toStrictEqual(['initial-atlas', 'geography-reroll', 'appearance-reroll']);
  });

  it('exports accepted scene bytes through the desktop destination without mutating accepted state', async () => {
    const baseline = exportableAcceptedState();
    let writtenPath = '';
    let writtenBytes = 0;
    const workflow = new AtlasWorkflow(fakePort({ commits: [{ ok: true, accepted: baseline }] }), {
      defaultTargetPath: () => Promise.resolve('/exports/default.svg'),
      write(request) {
        writtenPath = request.targetPath;
        writtenBytes = request.bytes.byteLength;
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
    });
    await workflow.acceptFull(MILESTONE_TWO_ATLAS_PROOF_SEED, DEFAULT_ATLAS_CONTROLS);
    const acceptedReference = workflow.snapshot.accepted;

    expect(await workflow.exportSvg('/exports/atlas.svg')).toEqual({ ok: true });

    expect(workflow.snapshot.accepted).toBe(acceptedReference);
    expect(workflow.snapshot.phase).toBe('accepted');
    expect(workflow.snapshot.svgExportReceipt).toMatchObject({
      targetPath: '/exports/atlas.svg',
      byteLength: writtenBytes,
      profileId: 'atlas-svg-v1',
    });
    expect(writtenPath).toBe('/exports/atlas.svg');
    expect(writtenBytes).toBeGreaterThan(0);
  });

  it('exposes and protects the non-cancellable native commit point', async () => {
    const baseline = exportableAcceptedState();
    let markWriteStarted: (() => void) | undefined;
    let finishWrite: (() => void) | undefined;
    const writeStarted = new Promise<void>((resolve) => {
      markWriteStarted = resolve;
    });
    const workflow = new AtlasWorkflow(fakePort({ commits: [{ ok: true, accepted: baseline }] }), {
      defaultTargetPath: () => Promise.resolve('/exports/default.svg'),
      write(request) {
        markWriteStarted?.();
        return new Promise((resolve) => {
          finishWrite = () => {
            resolve({
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
    });
    await workflow.acceptFull(MILESTONE_TWO_ATLAS_PROOF_SEED, DEFAULT_ATLAS_CONTROLS);

    const exporting = workflow.exportSvg('/exports/atlas.svg');
    await writeStarted;

    expect(workflow.snapshot).toMatchObject({ isBusy: true, isCancellationAllowed: false });
    expect(workflow.cancelActiveOperation()).toMatchObject({
      ok: false,
      code: 'atlas-svg.commit.non-cancellable',
    });
    expect(
      await workflow.acceptFull(MILESTONE_TWO_ATLAS_PROOF_SEED, DEFAULT_ATLAS_CONTROLS),
    ).toMatchObject({ ok: false, code: 'atlas-svg.commit.non-cancellable' });

    finishWrite?.();
    expect(await exporting).toEqual({ ok: true });
    expect(workflow.snapshot).toMatchObject({
      isBusy: false,
      isCancellationAllowed: false,
      svgExportReceipt: { targetPath: '/exports/atlas.svg' },
    });
  });
});

interface FakeOptions {
  readonly commits?: AtlasWorkflowCommitResult[];
  readonly preview?: AtlasWorkflowGenerationPort['preview'];
  readonly onCommit?: (operation: string) => void;
}

function fakePort(options: FakeOptions): AtlasWorkflowGenerationPort {
  const commits = [...(options.commits ?? [])];
  return {
    preview: options.preview ?? (() => Promise.resolve(previewResult('default'))),
    commit(request) {
      options.onCommit?.(request.operation);
      return Promise.resolve(commits.shift() ?? failure('atlas.test.unexpected', false));
    },
  };
}

function previewResult(label: string): AtlasWorkflowPreviewResult {
  return {
    ok: true,
    diagnosticCodes: [],
    preview: {
      previewKind: 'disposable-atlas-land-water',
      previewVersion: 1,
      profileId: 'world-atlas-preview-v1',
      samplingPolicyVersion: 1,
      longitudeCellCount: 512,
      latitudeBandCount: 256,
      canonicalTraversal: 'south-pole-then-rows-then-north-pole',
      quantizationScale: 2 ** 24,
      authority: 'disposable',
      isPromotable: false,
      controls: { ...DEFAULT_ATLAS_CONTROLS, fragmentationPercent: label === 'second' ? 36 : 35 },
      macroElevationValues: [],
      seaLevelContourDoubledTicks: 1,
      landWaterSamples: [],
    },
  };
}

function failure(code: string, isCancelled: boolean): AtlasWorkflowCommitResult {
  return {
    ok: false,
    isCancelled,
    diagnosticCodes: [code],
    message: `${code}: accepted state stays unchanged`,
  };
}

function acceptedState(label: string): AcceptedAtlasState {
  return {
    document: {
      worldDocumentId: '78b2157c-4f2c-5ac7-986b-76dc808f377e',
      displayName: label,
      worldSeed: MILESTONE_TWO_ATLAS_PROOF_SEED,
      rootMapId: 'a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7',
      maps: [],
    } as unknown as AcceptedAtlasState['document'],
    geography: {
      landmasses: [],
      waterBodies: [],
    } as unknown as AcceptedAtlasState['geography'],
    appearance: {} as AcceptedAtlasState['appearance'],
    scene: { widthPx: 1, heightPx: 1, nodes: [] } as unknown as AcceptedAtlasState['scene'],
  };
}

function exportableAcceptedState(): AcceptedAtlasState {
  return {
    ...acceptedState('exportable'),
    scene: {
      authority: 'disposable-render-scene',
      sceneKind: 'whole-world-atlas',
      sceneCompositionVersion: ATLAS_SCENE_COMPOSITION_VERSION,
      levelOfDetail: ATLAS_SCENE_LEVELS_OF_DETAIL.normalAtlas,
      coordinateSpace: 'atlas-display-equirectangular-v1',
      sourceWorldMapId: 'world-map',
      projection: ATLAS_DISPLAY_PROJECTION_METADATA,
      widthPx: 2_048,
      heightPx: 1_024,
      nodes: [
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
          id: 'atlas/land/land',
          kind: 'compoundPath',
          sourceId: 'land',
          sourceAspectId: 'land-aspect',
          relatedSourceIds: ['water'],
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
        ...exportDecorationNodes(),
      ],
    },
  };
}

function exportDecorationNodes(): AcceptedAtlasState['scene']['nodes'] {
  return [
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
      relatedSourceIds: ['land'],
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
      sourceId: 'land',
      sourceAspectId: 'land-aspect',
      relatedSourceIds: ['water'],
      points: [
        { xPx: 10, yPx: 10 },
        { xPx: 20, yPx: 10 },
      ],
      strokeColor: '#282a24',
      strokeWidthPx: 1.25,
    },
  ];
}
