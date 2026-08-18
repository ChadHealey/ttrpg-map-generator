/** Exact visible Milestone 2 workflow exercise over production-generated accepted checkpoints. */

import { DEFAULT_ATLAS_CONTROLS } from '@ttrpg-map/core';
import { expect } from 'vitest';

import {
  AtlasWorkflow,
  type AtlasWorkflowSnapshot,
  MILESTONE_TWO_ATLAS_PROOF_SEED,
} from './atlas-workflow.js';
import {
  type AcceptedAtlasState,
  type AtlasWorkflowGenerationPort,
  productionAtlasWorkflowGeneration,
} from './atlas-workflow-generation.js';
import { NATIVE_MAPWORLD_COMMANDS, type NativeMapworldInvoke } from './mapworld-native-boundary.js';

export interface VisibleAtlasWorkflowExercise {
  readonly snapshot: AtlasWorkflowSnapshot;
  readonly nativeCommands: readonly string[];
}

export async function exerciseVisibleAtlasWorkflow(states: {
  readonly baseline: AcceptedAtlasState;
  readonly geography: AcceptedAtlasState;
  readonly appearance: AcceptedAtlasState;
}): Promise<VisibleAtlasWorkflowExercise> {
  let generationAllowed = true;
  const commits = [states.baseline, states.geography, states.appearance];
  const generation: AtlasWorkflowGenerationPort = {
    preview(request, runtime) {
      if (!generationAllowed) throw new Error('generator-free reopen tripwire fired');
      return productionAtlasWorkflowGeneration.preview(request, runtime);
    },
    commit() {
      if (!generationAllowed) throw new Error('generator-free reopen tripwire fired');
      const accepted = commits.shift();
      if (accepted === undefined) throw new Error('Unexpected visible-workflow atlas commit.');
      return Promise.resolve({ ok: true as const, accepted });
    },
  };
  const native = statefulAtlasNativeInvoke();
  const svgDestination = Object.freeze({
    defaultTargetPath: () => Promise.resolve('/exports/milestone-two.svg'),
    write(request: {
      readonly targetPath: string;
      readonly bytes: Uint8Array;
      readonly expectedSha256: string;
    }) {
      return Promise.resolve({
        ok: true as const,
        value: Object.freeze({
          targetPath: request.targetPath,
          sha256: request.expectedSha256,
          byteLength: request.bytes.byteLength,
          platform: 'macos' as const,
        }),
      });
    },
  });
  const pngDestination = Object.freeze({
    defaultTargetPath: () => Promise.resolve('/exports/milestone-two.png'),
    write(request: {
      readonly targetPath: string;
      readonly bytes: Uint8Array;
      readonly expectedSha256: string;
    }) {
      return Promise.resolve({
        ok: true as const,
        value: Object.freeze({
          targetPath: request.targetPath,
          sha256: request.expectedSha256,
          byteLength: request.bytes.byteLength,
          platform: 'macos' as const,
        }),
      });
    },
  });
  const workflow = new AtlasWorkflow(generation, svgDestination, pngDestination, native.invoke);

  const cancelledPreview = workflow.requestPreview(
    MILESTONE_TWO_ATLAS_PROOF_SEED,
    DEFAULT_ATLAS_CONTROLS,
  );
  expect(workflow.cancelActiveOperation()).toEqual({ ok: true });
  expect(await cancelledPreview).toMatchObject({
    ok: false,
    code: 'atlas.land-water.cancelled',
  });
  expect(
    await workflow.requestPreview(MILESTONE_TWO_ATLAS_PROOF_SEED, DEFAULT_ATLAS_CONTROLS),
  ).toEqual({ ok: true });
  expect(await workflow.acceptFull(MILESTONE_TWO_ATLAS_PROOF_SEED, DEFAULT_ATLAS_CONTROLS)).toEqual(
    { ok: true },
  );
  expect(workflow.snapshot.acceptedCheckpoint).toBe('baseline');
  expect(workflow.snapshot.inspectionEntities.length).toBeGreaterThan(0);
  expect(workflow.planReroll('geography')).toEqual({ ok: true });
  expect(await workflow.commitPlannedReroll()).toEqual({ ok: true });
  expect(workflow.planReroll('appearance')).toEqual({ ok: true });
  expect(await workflow.commitPlannedReroll()).toEqual({ ok: true });
  expect(workflow.snapshot.acceptedCheckpoint).toBe('appearance-rerolled');
  expect(await workflow.save('/proofs/Milestone-Two.mapworld')).toEqual({ ok: true });
  generationAllowed = false;
  await expectEditingRejected(workflow, 'saved', 'atlas.workflow.saved-unload-required');
  expect(workflow.close()).toEqual({ ok: true });
  expect(workflow.snapshot).toMatchObject({
    phase: 'closed',
    accepted: undefined,
    scene: undefined,
    preview: undefined,
  });
  await expectEditingRejected(workflow, 'closed', 'atlas.workflow.closed-reopen-required');

  expect(await workflow.reopen()).toEqual({ ok: true });
  await expectEditingRejected(workflow, 'reopened', 'atlas.workflow.reopened-read-only');
  expect(await workflow.exportSvg()).toEqual({ ok: true });
  expect(await workflow.exportPng()).toEqual({ ok: true });
  expect(commits).toHaveLength(0);
  return Object.freeze({ snapshot: workflow.snapshot, nativeCommands: native.commands });
}

async function expectEditingRejected(
  workflow: AtlasWorkflow,
  phase: 'saved' | 'closed' | 'reopened',
  code:
    | 'atlas.workflow.saved-unload-required'
    | 'atlas.workflow.closed-reopen-required'
    | 'atlas.workflow.reopened-read-only',
): Promise<void> {
  const before = workflow.snapshot;
  expect(
    await workflow.requestPreview(MILESTONE_TWO_ATLAS_PROOF_SEED, DEFAULT_ATLAS_CONTROLS),
  ).toMatchObject({ ok: false, code });
  expect(
    await workflow.acceptFull(MILESTONE_TWO_ATLAS_PROOF_SEED, DEFAULT_ATLAS_CONTROLS),
  ).toMatchObject({ ok: false, code });
  expect(workflow.planReroll('geography')).toMatchObject({ ok: false, code });
  expect(await workflow.commitPlannedReroll()).toMatchObject({ ok: false, code });
  expect(workflow.snapshot).toMatchObject({
    phase,
    generationInvocationCount: before.generationInvocationCount,
    targetPath: before.targetPath,
    savedManifestSha256: before.savedManifestSha256,
    reopenedManifestSha256: before.reopenedManifestSha256,
  });
  expect(workflow.snapshot.accepted).toBe(before.accepted);
  expect(workflow.snapshot.savedEvidence).toBe(before.savedEvidence);
  expect(workflow.snapshot.reopenedEvidence).toBe(before.reopenedEvidence);
}

function statefulAtlasNativeInvoke(): {
  readonly invoke: NativeMapworldInvoke;
  readonly commands: readonly string[];
} {
  const commands: string[] = [];
  let relativePaths: readonly string[] = [];
  let fileBytesBase64: readonly string[] = [];
  const invoke: NativeMapworldInvoke = (command, arguments_) => {
    commands.push(command);
    if (command === NATIVE_MAPWORLD_COMMANDS.save) {
      relativePaths = asStringArray(arguments_.relativePaths);
      fileBytesBase64 = asStringArray(arguments_.fileBytesBase64);
      return Promise.resolve(
        JSON.stringify({
          ok: true,
          result: { kind: 'saved', platform: 'macos', snapshotId: 'a'.repeat(64) },
        }),
      );
    }
    if (command === NATIVE_MAPWORLD_COMMANDS.snapshot) {
      return Promise.resolve(
        JSON.stringify({
          ok: true,
          snapshot: {
            targetName: 'Milestone-Two.mapworld',
            snapshotId: 'a'.repeat(64),
            target: {
              kind: 'directory',
              observationToken: 'b'.repeat(64),
              entries: relativePaths
                .map((path, index) => ({ path, bytes: fileBytesBase64[index] ?? '' }))
                .sort(({ path: left }, { path: right }) =>
                  left < right ? -1 : left > right ? 1 : 0,
                ),
            },
            temporary: absent('c'),
            backup: absent('d'),
            marker: absent('e'),
          },
        }),
      );
    }
    throw new Error(`Unexpected native command ${command}`);
  };
  return { invoke, commands };
}

function absent(character: string) {
  return { kind: 'absent', observationToken: character.repeat(64) };
}

function asStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error('Expected a native string array.');
  }
  return value;
}
