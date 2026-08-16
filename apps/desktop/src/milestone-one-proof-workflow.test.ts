import {
  createMilestoneOneProofDocument,
  MILESTONE_ONE_PROOF_SEED,
  rerollMilestoneOneMarkers,
} from '@ttrpg-map/generation';
import { describe, expect, it } from 'vitest';

import { NATIVE_MAPWORLD_COMMANDS, type NativeMapworldInvoke } from './mapworld-native-boundary.js';
import {
  type MilestoneOneProofGenerationPort,
  MilestoneOneProofWorkflow,
} from './milestone-one-proof-workflow.js';

const TARGET_PATH = '/proofs/Milestone-One.mapworld';
const TARGET_NAME = 'Milestone-One.mapworld';
const SNAPSHOT_ID = 'a'.repeat(64);

describe('Milestone 1 desktop workflow', () => {
  it('generates, rerolls, saves, unloads, and reopens without invoking generation during load', async () => {
    let generationAllowed = true;
    let generationCalls = 0;
    const generation: MilestoneOneProofGenerationPort = {
      createBaseline(seed) {
        if (!generationAllowed) throw new Error('generator-free load tripwire');
        generationCalls += 1;
        return createMilestoneOneProofDocument(seed);
      },
      rerollMarkers(document) {
        if (!generationAllowed) throw new Error('generator-free load tripwire');
        generationCalls += 1;
        return rerollMilestoneOneMarkers(document);
      },
    };
    const native = statefulNativeInvoke();
    const workflow = new MilestoneOneProofWorkflow(generation);

    expect(workflow.generate(MILESTONE_ONE_PROOF_SEED)).toEqual({ ok: true });
    expect(workflow.rerollMarkers()).toEqual({ ok: true });
    expect(await workflow.save(native.invoke, TARGET_PATH)).toEqual({ ok: true });
    expect(workflow.close()).toEqual({ ok: true });
    expect(workflow.snapshot).toMatchObject({
      phase: 'closed',
      document: undefined,
      scene: undefined,
      evidence: undefined,
    });

    generationAllowed = false;
    expect(await workflow.reopen(native.invoke)).toEqual({ ok: true });
    expect(workflow.snapshot).toMatchObject({
      phase: 'reopened',
      reopen: { passed: true, manifestFingerprintRestored: true },
      reopenGenerationInvocationCount: 0,
    });
    expect(workflow.snapshot.document).toBeDefined();
    expect(workflow.snapshot.scene?.nodes).toHaveLength(11);
    expect(generationCalls).toBe(2);
    expect(native.commands).toStrictEqual([
      NATIVE_MAPWORLD_COMMANDS.save,
      NATIVE_MAPWORLD_COMMANDS.snapshot,
    ]);
  });

  it('rejects non-registered seeds and invalid workflow ordering with actionable codes', async () => {
    const workflow = new MilestoneOneProofWorkflow();
    const native = statefulNativeInvoke();

    expect(workflow.generate('1')).toMatchObject({ ok: false, code: 'proof.seed.not-registered' });
    expect(workflow.rerollMarkers()).toMatchObject({
      ok: false,
      code: 'proof.workflow.baseline-required',
    });
    expect(await workflow.save(native.invoke, 'relative.mapworld')).toMatchObject({
      ok: false,
      code: 'proof.target.invalid',
    });
    expect(workflow.close()).toMatchObject({
      ok: false,
      code: 'proof.workflow.save-required',
    });
    expect(native.commands).toStrictEqual([]);
  });
});

function statefulNativeInvoke(): {
  readonly invoke: NativeMapworldInvoke;
  readonly commands: string[];
} {
  const commands: string[] = [];
  let relativePaths: readonly string[] = [];
  let fileBytes: readonly (readonly number[])[] = [];
  const invoke: NativeMapworldInvoke = (command, arguments_) => {
    commands.push(command);
    if (command === NATIVE_MAPWORLD_COMMANDS.save) {
      relativePaths = asStringArray(arguments_.relativePaths);
      fileBytes = asNumberArrays(arguments_.fileBytes);
      return Promise.resolve(
        JSON.stringify({
          ok: true,
          result: { kind: 'saved', platform: 'macos', snapshotId: SNAPSHOT_ID },
        }),
      );
    }
    if (command === NATIVE_MAPWORLD_COMMANDS.snapshot) {
      return Promise.resolve(
        JSON.stringify({
          ok: true,
          snapshot: {
            targetName: TARGET_NAME,
            snapshotId: SNAPSHOT_ID,
            target: {
              kind: 'directory',
              observationToken: 'b'.repeat(64),
              entries: relativePaths
                .map((path, index) => ({ path, bytes: [...(fileBytes[index] ?? [])] }))
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
    throw new Error('Expected native relativePaths array.');
  }
  return value;
}

function asNumberArrays(value: unknown): readonly (readonly number[])[] {
  if (
    !Array.isArray(value) ||
    !value.every((item) => Array.isArray(item) && item.every((byte) => typeof byte === 'number'))
  ) {
    throw new Error('Expected native fileBytes arrays.');
  }
  return value;
}
