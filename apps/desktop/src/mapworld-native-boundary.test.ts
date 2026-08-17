import { describe, expect, it } from 'vitest';

import {
  NATIVE_MAPWORLD_COMMANDS,
  NATIVE_MAPWORLD_LIMITS,
  type NativeMapworldInvoke,
  requestNativeMapworldApply,
  requestNativeMapworldSave,
  requestNativeMapworldSnapshot,
} from './mapworld-native-boundary.js';
import { validNativeSaveRequest } from './mapworld-native-test-support.js';

const OLD_FINGERPRINT = '1'.repeat(64);
const NEW_FINGERPRINT = '2'.repeat(64);
const SNAPSHOT_ID = '3'.repeat(64);

describe('desktop native mapworld boundary', () => {
  it('passes the raw bounded snapshot to persistence without interpreting candidate roles', async () => {
    const snapshot = Object.freeze({ arbitraryNativeSnapshot: true });
    const calls: unknown[] = [];
    const invoke: NativeMapworldInvoke = (command, arguments_) => {
      calls.push({ command, arguments_, argumentsAreFrozen: Object.isFrozen(arguments_) });
      return Promise.resolve(JSON.stringify({ ok: true, snapshot }));
    };

    const result = await requestNativeMapworldSnapshot(invoke, '/maps/World.mapworld');

    expect(result).toEqual({ ok: true, value: snapshot });
    expect(calls).toEqual([
      {
        command: NATIVE_MAPWORLD_COMMANDS.snapshot,
        arguments_: { targetPath: '/maps/World.mapworld' },
        argumentsAreFrozen: true,
      },
    ]);
  });

  it('rejects malformed or extended native envelopes with one stable boundary code', async () => {
    for (const response of [
      1,
      '{',
      '[]',
      JSON.stringify({ ok: true, snapshot: {}, unexpected: true }),
      JSON.stringify({ ok: false, error: { code: 'made-up' } }),
    ]) {
      const result = await requestNativeMapworldSnapshot(
        () => Promise.resolve(response),
        '/target',
      );
      expect(result).toMatchObject({
        ok: false,
        error: { code: 'persistence.recovery.io-failed' },
      });
    }
  });

  it('maps rejected native invocations to stable results instead of throwing', async () => {
    const invoke: NativeMapworldInvoke = () => Promise.reject(new Error('transport failed'));
    const snapshot = await requestNativeMapworldSnapshot(invoke, '/maps/World.mapworld');
    const save = await requestNativeMapworldSave(invoke, validNativeSaveRequest());
    const apply = await requestNativeMapworldApply(invoke, {
      targetPath: '/maps/World.mapworld',
      expectedSnapshotId: SNAPSHOT_ID,
      selectedRole: null,
      selectedObservationToken: null,
      selectedManifestSha256: null,
      steps: [],
      confirmationTokens: [],
    });

    for (const result of [snapshot, save, apply]) {
      expect(result).toMatchObject({
        ok: false,
        error: { code: 'persistence.recovery.io-failed' },
      });
    }
  });

  it('sends an independently owned immutable save plan and expected previous fingerprint', async () => {
    const request = validNativeSaveRequest('replacement-save');
    const markerBefore = request.markerBase64;
    const firstFileBefore = request.files[0]?.bytesBase64;
    let capturedArguments: Readonly<Record<string, unknown>> | undefined;
    const invoke: NativeMapworldInvoke = (command, arguments_) => {
      expect(command).toBe(NATIVE_MAPWORLD_COMMANDS.save);
      capturedArguments = arguments_;
      return Promise.resolve(
        JSON.stringify({
          ok: true,
          result: { kind: 'saved', platform: 'macos', snapshotId: SNAPSHOT_ID },
        }),
      );
    };

    const result = await requestNativeMapworldSave(invoke, request);
    request.markerBase64 = 'altered';
    if (request.files[0] !== undefined) request.files[0].bytesBase64 = 'altered';

    expect(result).toEqual({
      ok: true,
      value: { kind: 'saved', platform: 'macos', snapshotId: SNAPSHOT_ID },
    });
    expect(capturedArguments).toMatchObject({
      expectedPreviousManifestSha256: OLD_FINGERPRINT,
      markerBase64: markerBefore,
    });
    const capturedFileBytes = capturedArguments?.fileBytesBase64;
    expect(Array.isArray(capturedFileBytes) ? capturedFileBytes[0] : undefined).toEqual(
      firstFileBefore,
    );
    expect(Object.isFrozen(capturedArguments)).toBe(true);
    expect(typeof capturedArguments?.markerBase64).toBe('string');
    expect(Object.isFrozen(capturedArguments?.fileBytesBase64)).toBe(true);
  });

  it('rejects inconsistent first/replacement intent before invoking native code', async () => {
    let invocationCount = 0;
    const invoke: NativeMapworldInvoke = () => {
      invocationCount += 1;
      return Promise.resolve('');
    };
    const invalidFirst = await requestNativeMapworldSave(invoke, {
      ...validNativeSaveRequest(),
      expectedPreviousManifestSha256: OLD_FINGERPRINT,
    });
    const invalidReplacement = await requestNativeMapworldSave(invoke, {
      ...validNativeSaveRequest('replacement-save'),
      expectedPreviousManifestSha256: null,
    });

    expect(invocationCount).toBe(0);
    expect(invalidFirst).toMatchObject({ ok: false });
    expect(invalidReplacement).toMatchObject({ ok: false });
  });

  it('mirrors every native save bound and fails before invocation', async () => {
    let invocationCount = 0;
    const invoke: NativeMapworldInvoke = () => {
      invocationCount += 1;
      return Promise.resolve('');
    };
    const base = {
      targetPath: '/target',
      operation: 'first-save' as const,
      expectedPreviousManifestSha256: null,
      expectedPreviousObservationToken: null,
      candidateManifestSha256: NEW_FINGERPRINT,
    };
    const requests = [
      {
        ...base,
        markerBase64: 'AAAA'.repeat(Math.ceil((NATIVE_MAPWORLD_LIMITS.maximumMarkerBytes + 1) / 3)),
        files: [],
      },
      {
        ...base,
        markerBase64: '',
        files: Array.from(
          { length: NATIVE_MAPWORLD_LIMITS.maximumPackageFiles + 1 },
          (_, index) => ({
            path: `maps/${String(index)}.json`,
            bytesBase64: '',
          }),
        ),
      },
      {
        ...base,
        markerBase64: '',
        files: [
          {
            path: 'a'.repeat(NATIVE_MAPWORLD_LIMITS.maximumRelativePathBytes + 1),
            bytesBase64: '',
          },
        ],
      },
    ];

    for (const request of requests) {
      const result = await requestNativeMapworldSave(invoke, request);
      expect(result).toMatchObject({
        ok: false,
        error: { code: 'persistence.recovery.artifact-conflict' },
      });
    }
    expect(invocationCount).toBe(0);
  });

  it('rejects incomplete, duplicate, mismatched, and runtime-invalid save DTOs', async () => {
    let invocationCount = 0;
    const invoke: NativeMapworldInvoke = () => {
      invocationCount += 1;
      return Promise.resolve('');
    };
    const base = {
      targetPath: '/maps/World.mapworld',
      operation: 'first-save' as const,
      expectedPreviousManifestSha256: null,
      expectedPreviousObservationToken: null,
      candidateManifestSha256: NEW_FINGERPRINT,
      markerBase64: 'AQ==',
    };
    const requests = [
      { ...base, files: [] },
      {
        ...base,
        files: [
          { path: 'manifest.json', bytesBase64: 'AQ==' },
          { path: 'manifest.json', bytesBase64: 'AQ==' },
        ],
      },
      { ...base, files: [{ path: `${'a'.repeat(256)}/file`, bytesBase64: 'AQ==' }] },
      { ...base, files: [{ path: 'world.json', bytesBase64: 'AQ==' }] },
      { ...base, files: [{ path: 'manifest.json', bytesBase64: 'AQ==' }] },
      {
        ...base,
        operation: 'unsupported',
        files: [{ path: 'manifest.json', bytesBase64: 'AQ==' }],
      },
    ];

    for (const request of requests) {
      const result = await requestNativeMapworldSave(invoke, request);
      expect(result).toMatchObject({ ok: false });
    }
    expect(invocationCount).toBe(0);
  });

  it('rejects altered package or marker bytes before invoking the native writer', async () => {
    let invocationCount = 0;
    const invoke: NativeMapworldInvoke = () => {
      invocationCount += 1;
      return Promise.resolve('');
    };
    const alteredPackage = validNativeSaveRequest();
    const world = alteredPackage.files.find(({ path }) => path === 'world.json');
    if (world === undefined) throw new Error('Expected complete package fixture.');
    world.bytesBase64 = mutateBase64(world.bytesBase64);
    const alteredMarker = validNativeSaveRequest();
    alteredMarker.markerBase64 = mutateBase64(alteredMarker.markerBase64);

    await expect(requestNativeMapworldSave(invoke, alteredPackage)).resolves.toMatchObject({
      ok: false,
      error: { code: 'persistence.recovery.fingerprint-mismatch' },
    });
    await expect(requestNativeMapworldSave(invoke, alteredMarker)).resolves.toMatchObject({
      ok: false,
      error: { code: 'persistence.recovery.marker-invalid' },
    });
    expect(invocationCount).toBe(0);
  });

  it('carries snapshot and confirmation tokens and preserves a stale-plan failure', async () => {
    let capturedArguments: Readonly<Record<string, unknown>> | undefined;
    const invoke: NativeMapworldInvoke = (_command, arguments_) => {
      capturedArguments = arguments_;
      return Promise.resolve(
        JSON.stringify({
          ok: false,
          error: {
            code: 'persistence.recovery.target-changed',
            primitive: 'revalidate-snapshot',
            role: 'temporary',
            osErrorNumber: null,
            osErrorName: null,
            message: 'The recovery snapshot changed before plan application.',
            platform: 'linux',
          },
        }),
      );
    };

    const result = await requestNativeMapworldApply(invoke, {
      targetPath: '/maps/World.mapworld',
      expectedSnapshotId: SNAPSHOT_ID,
      selectedRole: 'target',
      selectedObservationToken: SNAPSHOT_ID,
      selectedManifestSha256: OLD_FINGERPRINT,
      steps: ['remove-confirmed-temporary'],
      confirmationTokens: [`temporary|${SNAPSHOT_ID}`],
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'persistence.recovery.target-changed',
        role: 'temporary',
      },
    });
    expect(capturedArguments).toMatchObject({
      expectedSnapshotId: SNAPSHOT_ID,
      selectedRole: 'target',
      selectedObservationToken: SNAPSHOT_ID,
      selectedManifestSha256: OLD_FINGERPRINT,
      confirmationTokens: [`temporary|${SNAPSHOT_ID}`],
    });
    expect(Object.isFrozen(capturedArguments?.steps)).toBe(true);
    expect(Object.isFrozen(capturedArguments?.confirmationTokens)).toBe(true);
  });

  it('rejects oversized plans and malformed confirmation tokens before native invocation', async () => {
    let invocationCount = 0;
    const result = await requestNativeMapworldApply(
      () => {
        invocationCount += 1;
        return Promise.resolve('');
      },
      {
        targetPath: '/target',
        expectedSnapshotId: SNAPSHOT_ID,
        selectedRole: null,
        selectedObservationToken: null,
        selectedManifestSha256: null,
        steps: Array.from(
          { length: NATIVE_MAPWORLD_LIMITS.maximumRecoverySteps + 1 },
          () => 'sync-target-commit' as const,
        ),
        confirmationTokens: [],
      },
    );
    const malformedToken = await requestNativeMapworldApply(
      () => {
        invocationCount += 1;
        return Promise.resolve('');
      },
      {
        targetPath: '/target',
        expectedSnapshotId: SNAPSHOT_ID,
        selectedRole: null,
        selectedObservationToken: null,
        selectedManifestSha256: null,
        steps: ['remove-confirmed-temporary'],
        confirmationTokens: ['temporary|not-a-snapshot-token'],
      },
    );

    expect(invocationCount).toBe(0);
    expect(result).toMatchObject({ ok: false });
    expect(malformedToken).toMatchObject({ ok: false });
  });

  it('returns stable failures for malformed runtime request objects and partial survivor identity', async () => {
    let invocationCount = 0;
    const invoke: NativeMapworldInvoke = () => {
      invocationCount += 1;
      return Promise.resolve('');
    };
    const malformedSave = await requestNativeMapworldSave(invoke, null);
    const malformedApply = await requestNativeMapworldApply(invoke, { steps: null });
    const partialSelected = await requestNativeMapworldApply(invoke, {
      targetPath: '/maps/World.mapworld',
      expectedSnapshotId: SNAPSHOT_ID,
      selectedRole: 'target',
      selectedObservationToken: null,
      selectedManifestSha256: OLD_FINGERPRINT,
      steps: [],
      confirmationTokens: [],
    });

    for (const result of [malformedSave, malformedApply, partialSelected]) {
      expect(result).toMatchObject({ ok: false });
    }
    expect(invocationCount).toBe(0);
  });
});

function mutateBase64(value: string): string {
  if (value.length === 0) return 'AQ==';
  return `${value.startsWith('A') ? 'B' : 'A'}${value.slice(1)}`;
}
