import type { WorldDocument } from '@ttrpg-map/core';
import { decodeMapworld } from '@ttrpg-map/persistence';
import { describe, expect, it } from 'vitest';

import fixtureManifest from '../../../fixtures/saved-projects/v1/milestone-1-kernel-proof/rerolled.mapworld/manifest.json?raw';
import fixtureMap from '../../../fixtures/saved-projects/v1/milestone-1-kernel-proof/rerolled.mapworld/maps/a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7.json?raw';
import fixtureWorld from '../../../fixtures/saved-projects/v1/milestone-1-kernel-proof/rerolled.mapworld/world.json?raw';
import { NATIVE_MAPWORLD_COMMANDS, type NativeMapworldInvoke } from './mapworld-native-boundary.js';
import {
  confirmMapworldRecovery,
  MAXIMUM_AUTOMATIC_RECOVERY_SNAPSHOTS,
  recoverMapworldDocument,
  saveMapworldDocument,
} from './mapworld-persistence-orchestrator.js';

const TARGET_PATH = '/maps/World.mapworld';
const TARGET_NAME = 'World.mapworld';
const CANDIDATE_FINGERPRINT = token('a');
const SNAPSHOT_ID = token('b');
const EMPTY_TARGET = absent('1');
const EMPTY_TEMPORARY = absent('2');
const EMPTY_BACKUP = absent('3');
const EMPTY_MARKER = absent('4');

describe('desktop mapworld persistence orchestration', () => {
  it('passes an unknown snapshot directly to strict persistence validation', async () => {
    let calls = 0;
    const result = await recoverMapworldDocument(() => {
      calls += 1;
      return Promise.resolve(JSON.stringify({ ok: true, snapshot: { unbounded: true } }));
    }, TARGET_PATH);

    expect(calls).toBe(1);
    expect(result).toMatchObject({
      ok: false,
      source: 'persistence',
      error: { code: 'persistence.recovery.artifact-conflict' },
    });
  });

  it('applies an automatic plan with its snapshot id and re-enumerates before returning attention', async () => {
    const snapshots = [
      rawSnapshot({
        temporary: emptyDirectory('5'),
        marker: regular('6', firstSaveMarkerBytes()),
      }),
      rawSnapshot(),
    ];
    const calls: {
      readonly command: string;
      readonly arguments_: Readonly<Record<string, unknown>>;
    }[] = [];
    const invoke: NativeMapworldInvoke = (command, arguments_) => {
      calls.push({ command, arguments_ });
      if (command === NATIVE_MAPWORLD_COMMANDS.snapshot) {
        const snapshot = snapshots.shift();
        if (snapshot === undefined) throw new Error('Unexpected extra snapshot.');
        return Promise.resolve(JSON.stringify({ ok: true, snapshot }));
      }
      return Promise.resolve(mutationSuccess('applied'));
    };

    const result = await recoverMapworldDocument(invoke, TARGET_PATH);

    expect(result).toMatchObject({
      ok: true,
      value: {
        kind: 'attention',
        decision: { code: 'persistence.recovery.no-valid-package' },
      },
    });
    expect(calls.map(({ command }) => command)).toEqual([
      NATIVE_MAPWORLD_COMMANDS.snapshot,
      NATIVE_MAPWORLD_COMMANDS.apply,
      NATIVE_MAPWORLD_COMMANDS.snapshot,
    ]);
    expect(calls[1]?.arguments_).toMatchObject({
      expectedSnapshotId: SNAPSHOT_ID,
      steps: ['remove-temporary-empty', 'remove-marker'],
      confirmationTokens: [],
    });
  });

  it('preserves a native stale-plan error without retrying the mutation', async () => {
    const invoke: NativeMapworldInvoke = (command) =>
      Promise.resolve(
        command === NATIVE_MAPWORLD_COMMANDS.snapshot
          ? JSON.stringify({
              ok: true,
              snapshot: rawSnapshot({ marker: regular('6', firstSaveMarkerBytes()) }),
            })
          : JSON.stringify({
              ok: false,
              error: {
                code: 'persistence.recovery.target-changed',
                primitive: 'revalidate-snapshot',
                role: 'marker',
                osErrorNumber: null,
                osErrorName: null,
                message: 'The snapshot changed.',
                platform: 'linux',
              },
            }),
      );

    const result = await recoverMapworldDocument(invoke, TARGET_PATH);

    expect(result).toMatchObject({
      ok: false,
      source: 'native',
      error: { code: 'persistence.recovery.target-changed', primitive: 'revalidate-snapshot' },
    });
  });

  it('re-enumerates a candidate-specific marker confirmation and revalidates after applying it', async () => {
    const invalidMarkerSnapshot = rawSnapshot({ marker: regular('6', [0x7b, 0x7d, 0x0a]) });
    const snapshots = [invalidMarkerSnapshot, rawSnapshot()];
    const commands: string[] = [];
    const invoke: NativeMapworldInvoke = (command) => {
      commands.push(command);
      if (command === NATIVE_MAPWORLD_COMMANDS.snapshot) {
        return Promise.resolve(JSON.stringify({ ok: true, snapshot: snapshots.shift() }));
      }
      return Promise.resolve(mutationSuccess('applied'));
    };

    const result = await confirmMapworldRecovery(invoke, TARGET_PATH, {
      action: 'remove-marker',
      role: 'marker',
      observationToken: token('6'),
    });

    expect(result).toMatchObject({
      ok: true,
      value: { kind: 'attention', decision: { code: 'persistence.recovery.no-valid-package' } },
    });
    expect(commands).toEqual([
      NATIVE_MAPWORLD_COMMANDS.snapshot,
      NATIVE_MAPWORLD_COMMANDS.apply,
      NATIVE_MAPWORLD_COMMANDS.snapshot,
    ]);
  });

  it('rejects a stale confirmation before invoking native mutation', async () => {
    const commands: string[] = [];
    const result = await confirmMapworldRecovery(
      (command) => {
        commands.push(command);
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            snapshot: rawSnapshot({ marker: regular('6', [0x7b, 0x7d, 0x0a]) }),
          }),
        );
      },
      TARGET_PATH,
      { action: 'remove-marker', role: 'marker', observationToken: token('7') },
    );

    expect(result).toMatchObject({
      ok: false,
      source: 'persistence',
      error: { code: 'persistence.recovery.confirmation-required' },
    });
    expect(commands).toEqual([NATIVE_MAPWORLD_COMMANDS.snapshot]);
  });

  it('bounds automatic recovery snapshots when a faulty adapter never advances state', async () => {
    let snapshotCalls = 0;
    let applyCalls = 0;
    const result = await recoverMapworldDocument((command) => {
      if (command === NATIVE_MAPWORLD_COMMANDS.snapshot) {
        snapshotCalls += 1;
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            snapshot: rawSnapshot({ marker: regular('6', firstSaveMarkerBytes()) }),
          }),
        );
      }
      applyCalls += 1;
      return Promise.resolve(mutationSuccess('applied'));
    }, TARGET_PATH);

    expect(snapshotCalls).toBe(MAXIMUM_AUTOMATIC_RECOVERY_SNAPSHOTS);
    expect(applyCalls).toBe(MAXIMUM_AUTOMATIC_RECOVERY_SNAPSHOTS);
    expect(result).toMatchObject({
      ok: false,
      source: 'native',
      error: {
        code: 'persistence.recovery.io-failed',
        primitive: 'automatic-recovery-pass-limit',
      },
    });
  });

  it('does not invoke native save when immutable document validation fails', async () => {
    let calls = 0;
    const cyclicDocument: { maps?: unknown[] } = {};
    cyclicDocument.maps = [cyclicDocument];
    const result = await saveMapworldDocument(
      () => {
        calls += 1;
        return Promise.resolve('');
      },
      TARGET_PATH,
      cyclicDocument as never,
      {
        operation: 'first-save',
        targetName: TARGET_NAME,
        previousManifestSha256: null,
        expectedPreviousObservationToken: null,
      },
    );

    expect(calls).toBe(0);
    expect(result).toMatchObject({ ok: false, source: 'persistence' });
  });

  it('rejects a target-path and target-name mismatch before planning or invocation', async () => {
    let calls = 0;
    const result = await saveMapworldDocument(
      () => {
        calls += 1;
        return Promise.resolve('');
      },
      TARGET_PATH,
      fixtureDocument(),
      {
        operation: 'first-save',
        targetName: 'Other.mapworld',
        previousManifestSha256: null,
        expectedPreviousObservationToken: null,
      },
    );

    expect(calls).toBe(0);
    expect(result).toMatchObject({
      ok: false,
      source: 'persistence',
      error: { code: 'persistence.recovery.artifact-name-invalid' },
    });
  });

  it('sends both validated previous identity fields for a replacement save', async () => {
    const previousFingerprint = token('c');
    const previousObservationToken = token('d');
    let capturedArguments: Readonly<Record<string, unknown>> | undefined;
    const result = await saveMapworldDocument(
      (_command, arguments_) => {
        capturedArguments = arguments_;
        return Promise.resolve(mutationSuccess('saved'));
      },
      TARGET_PATH,
      fixtureDocument(),
      {
        operation: 'replacement-save',
        targetName: TARGET_NAME,
        previousManifestSha256: previousFingerprint,
        expectedPreviousObservationToken: previousObservationToken,
        overwriteAuthority: 'replace-last-opened',
      },
    );

    expect(result).toMatchObject({ ok: true, value: { nativeResult: { kind: 'saved' } } });
    expect(capturedArguments).toMatchObject({
      targetPath: TARGET_PATH,
      operation: 'replacement-save',
      expectedPreviousManifestSha256: previousFingerprint,
      expectedPreviousObservationToken: previousObservationToken,
    });
  });

  it('requires explicit replacement overwrite authority before native invocation', async () => {
    let calls = 0;
    const result = await saveMapworldDocument(
      () => {
        calls += 1;
        return Promise.resolve('');
      },
      TARGET_PATH,
      fixtureDocument(),
      {
        operation: 'replacement-save',
        targetName: TARGET_NAME,
        previousManifestSha256: token('c'),
        expectedPreviousObservationToken: token('d'),
        overwriteAuthority: 'unconfirmed',
      } as never,
    );

    expect(calls).toBe(0);
    expect(result).toMatchObject({
      ok: false,
      source: 'persistence',
      error: { code: 'persistence.recovery.confirmation-required' },
    });
  });
});

function rawSnapshot(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    targetName: TARGET_NAME,
    snapshotId: SNAPSHOT_ID,
    target: EMPTY_TARGET,
    temporary: EMPTY_TEMPORARY,
    backup: EMPTY_BACKUP,
    marker: EMPTY_MARKER,
    ...overrides,
  };
}

function absent(character: string) {
  return { kind: 'absent', observationToken: token(character) };
}

function emptyDirectory(character: string) {
  return { kind: 'empty-directory', observationToken: token(character) };
}

function regular(character: string, bytes: readonly number[]) {
  return { kind: 'regular-file', observationToken: token(character), bytes: [...bytes] };
}

function firstSaveMarkerBytes(): readonly number[] {
  return Array.from(
    new TextEncoder().encode(`{
  "backupName": ".World.mapworld.commit-v1.backup",
  "candidateManifestSha256": "${CANDIDATE_FINGERPRINT}",
  "checksumAlgorithm": "sha256",
  "operation": "first-save",
  "previousManifestSha256": null,
  "protocol": "mapworld-directory-commit",
  "protocolVersion": 1,
  "targetName": "World.mapworld",
  "temporaryName": ".World.mapworld.commit-v1.temporary"
}
`),
  );
}

function mutationSuccess(kind: 'applied' | 'saved'): string {
  return JSON.stringify({
    ok: true,
    result: { kind, platform: 'macos', snapshotId: token('f') },
  });
}

function fixtureDocument(): WorldDocument {
  const decoded = decodeMapworld({
    files: [
      { path: 'manifest.json', bytes: new TextEncoder().encode(fixtureManifest) },
      { path: 'world.json', bytes: new TextEncoder().encode(fixtureWorld) },
      {
        path: 'maps/a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7.json',
        bytes: new TextEncoder().encode(fixtureMap),
      },
    ],
  });
  if (!decoded.ok) throw new Error(JSON.stringify(decoded.diagnostics));
  return decoded.value;
}

function token(character: string): string {
  return character.repeat(64);
}
