import { DEFAULT_ATLAS_CONTROLS } from '@ttrpg-map/core';
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
    scene: { widthPx: 1, heightPx: 1, nodes: [] },
  };
}
