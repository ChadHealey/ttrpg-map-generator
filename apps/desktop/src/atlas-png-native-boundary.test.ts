import { describe, expect, it } from 'vitest';

import {
  ATLAS_PNG_NATIVE_COMMAND,
  ATLAS_PNG_NATIVE_DIAGNOSTIC_CODES,
  requestNativeAtlasPngWrite,
} from './atlas-png-native-boundary.js';

const SHA256 = 'a'.repeat(64);

describe('native atlas PNG desktop boundary', () => {
  it('sends bounded canonical base64 and accepts only an exact verified receipt', async () => {
    const calls: { command: string; arguments_: Readonly<Record<string, unknown>> }[] = [];
    const result = await requestNativeAtlasPngWrite(
      (command, arguments_) => {
        calls.push({ command, arguments_ });
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            result: {
              kind: 'atlas-png-written',
              targetPath: '/maps/atlas.png',
              sha256: SHA256,
              byteLength: 3,
              platform: 'macos',
            },
          }),
        );
      },
      { targetPath: '/maps/atlas.png', bytes: Uint8Array.of(1, 2, 3), expectedSha256: SHA256 },
    );

    expect(result).toEqual({
      ok: true,
      value: {
        targetPath: '/maps/atlas.png',
        sha256: SHA256,
        byteLength: 3,
        platform: 'macos',
      },
    });
    expect(calls).toEqual([
      {
        command: ATLAS_PNG_NATIVE_COMMAND,
        arguments_: {
          targetPath: '/maps/atlas.png',
          pngBase64: 'AQID',
          expectedSha256: SHA256,
        },
      },
    ]);
  });

  it('rejects malformed requests before native invocation', async () => {
    let calls = 0;
    const result = await requestNativeAtlasPngWrite(
      () => {
        calls += 1;
        return Promise.resolve(undefined);
      },
      { targetPath: '/maps/atlas.svg', bytes: new Uint8Array(), expectedSha256: 'invalid' },
    );

    expect(calls).toBe(0);
    expect(result).toMatchObject({
      ok: false,
      diagnostic: { code: ATLAS_PNG_NATIVE_DIAGNOSTIC_CODES.invalidRequest },
    });
  });

  it('rejects a native receipt that does not verify the requested bytes and path', async () => {
    const result = await requestNativeAtlasPngWrite(
      () =>
        Promise.resolve({
          ok: true,
          result: {
            kind: 'atlas-png-written',
            targetPath: '/maps/other.png',
            sha256: SHA256,
            byteLength: 3,
            platform: 'linux',
          },
        }),
      { targetPath: '/maps/atlas.png', bytes: Uint8Array.of(1, 2, 3), expectedSha256: SHA256 },
    );

    expect(result).toMatchObject({
      ok: false,
      diagnostic: {
        code: ATLAS_PNG_NATIVE_DIAGNOSTIC_CODES.ioFailed,
        primitive: 'validate-native-atlas-png-response',
      },
    });
  });

  it('accepts only the declared stable PNG-native diagnostic family', async () => {
    const result = await requestNativeAtlasPngWrite(
      () =>
        Promise.resolve({
          ok: false,
          error: {
            code: 'atlas-svg.native.io-failed',
            message: 'Wrong diagnostic family.',
            primitive: 'write',
            osErrorNumber: null,
            osErrorName: null,
          },
        }),
      { targetPath: '/maps/atlas.png', bytes: Uint8Array.of(1), expectedSha256: SHA256 },
    );

    expect(result).toMatchObject({
      ok: false,
      diagnostic: { code: ATLAS_PNG_NATIVE_DIAGNOSTIC_CODES.ioFailed },
    });
  });
});
