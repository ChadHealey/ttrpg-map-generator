import { DEFAULT_ATLAS_CONTROLS } from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import { AtlasWorkflow, MILESTONE_TWO_ATLAS_PROOF_SEED } from './atlas-workflow.js';
import type {
  AcceptedAtlasState,
  AtlasWorkflowGenerationPort,
  AtlasWorkflowRuntime,
} from './atlas-workflow-generation.js';

describe('Milestone 2 visible desktop workflow', () => {
  it('cancels/restarts preview, accepts full state, inspects identities, and commits both reviewed rerolls', async () => {
    let pendingPreview:
      | {
          readonly runtime: AtlasWorkflowRuntime;
          readonly resolve: (
            value: Awaited<ReturnType<AtlasWorkflowGenerationPort['preview']>>,
          ) => void;
        }
      | undefined;
    let previewCount = 0;
    const accepted = [state('baseline'), state('geography'), state('appearance')];
    const port: AtlasWorkflowGenerationPort = {
      preview(_request, runtime) {
        previewCount += 1;
        if (previewCount > 1) return Promise.resolve(previewResult());
        return new Promise((resolve) => {
          pendingPreview = { runtime, resolve };
        });
      },
      commit() {
        const next = accepted.shift();
        if (next === undefined) throw new Error('Unexpected extra atlas commit.');
        return Promise.resolve({ ok: true, accepted: next });
      },
    };
    const workflow = new AtlasWorkflow(port);

    const cancelledPreview = workflow.requestPreview(
      MILESTONE_TWO_ATLAS_PROOF_SEED,
      DEFAULT_ATLAS_CONTROLS,
    );
    expect(workflow.cancelActiveOperation()).toEqual({ ok: true });
    expect(pendingPreview?.runtime.isCancellationRequested()).toBe(true);
    pendingPreview?.resolve({
      ok: false,
      isCancelled: true,
      diagnosticCodes: ['atlas.operation.cancelled'],
      message: 'cancelled',
    });
    await cancelledPreview;

    expect(
      await workflow.requestPreview(MILESTONE_TWO_ATLAS_PROOF_SEED, DEFAULT_ATLAS_CONTROLS),
    ).toEqual({ ok: true });
    expect(workflow.snapshot).toMatchObject({ phase: 'preview', isPreviewState: true });
    expect(workflow.snapshot.accepted).toBeUndefined();

    expect(
      await workflow.acceptFull(MILESTONE_TWO_ATLAS_PROOF_SEED, DEFAULT_ATLAS_CONTROLS),
    ).toEqual({ ok: true });
    expect(workflow.snapshot.inspectionEntities[0]).toMatchObject({
      kind: 'continent',
      relationshipSummary: '1 adjacent water bodies',
    });

    expect(workflow.planReroll('geography')).toEqual({ ok: true });
    expect(await workflow.commitPlannedReroll()).toEqual({ ok: true });
    expect(workflow.planReroll('appearance')).toEqual({ ok: true });
    expect(await workflow.commitPlannedReroll()).toEqual({ ok: true });
    expect(workflow.snapshot).toMatchObject({ phase: 'accepted', pendingReroll: undefined });
  });
});

function previewResult() {
  return {
    ok: true as const,
    diagnosticCodes: [],
    preview: {
      previewKind: 'disposable-atlas-land-water' as const,
      previewVersion: 1 as const,
      profileId: 'world-atlas-preview-v1' as const,
      samplingPolicyVersion: 1 as const,
      longitudeCellCount: 512 as const,
      latitudeBandCount: 256 as const,
      canonicalTraversal: 'south-pole-then-rows-then-north-pole' as const,
      quantizationScale: (2 ** 24) as 16777216,
      authority: 'disposable' as const,
      isPromotable: false as const,
      controls: DEFAULT_ATLAS_CONTROLS,
      macroElevationValues: [],
      seaLevelContourDoubledTicks: 1,
      landWaterSamples: [],
    },
  };
}

function state(label: string): AcceptedAtlasState {
  return {
    document: {
      worldDocumentId: '78b2157c-4f2c-5ac7-986b-76dc808f377e',
      displayName: label,
      worldSeed: MILESTONE_TWO_ATLAS_PROOF_SEED,
      rootMapId: 'a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7',
      maps: [],
    } as unknown as AcceptedAtlasState['document'],
    geography: {
      landmasses: [
        {
          entityId: '11111111-1111-4111-8111-111111111111',
          kind: 'continent',
          adjacentWaterBodyIds: ['22222222-2222-4222-8222-222222222222'],
        },
      ],
      waterBodies: [],
    } as unknown as AcceptedAtlasState['geography'],
    appearance: {} as AcceptedAtlasState['appearance'],
    scene: { widthPx: 1, heightPx: 1, nodes: [] },
  };
}
