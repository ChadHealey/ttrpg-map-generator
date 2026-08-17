import { describe, expect, it } from 'vitest';

import {
  ATLAS_SVG_NATIVE_COMMAND,
  ATLAS_SVG_NATIVE_DIAGNOSTIC_CODES,
  requestNativeAtlasSvgWrite,
} from './atlas-svg-native-boundary.js';

const SHA256 = 'a'.repeat(64);

describe('native atlas SVG desktop boundary', () => {
  it('sends bounded canonical base64 and accepts only an exact verified receipt', async () => {
    const calls: { command: string; arguments_: Readonly<Record<string, unknown>> }[] = [];
    const result = await requestNativeAtlasSvgWrite(
      (command, arguments_) => {
        calls.push({ command, arguments_ });
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            result: {
              kind: 'atlas-svg-written',
              targetPath: '/maps/atlas.svg',
              sha256: SHA256,
              byteLength: 3,
              platform: 'macos',
            },
          }),
        );
      },
      { targetPath: '/maps/atlas.svg', bytes: Uint8Array.of(1, 2, 3), expectedSha256: SHA256 },
    );

    expect(result).toEqual({
      ok: true,
      value: {
        targetPath: '/maps/atlas.svg',
        sha256: SHA256,
        byteLength: 3,
        platform: 'macos',
      },
    });
    expect(calls).toEqual([
      {
        command: ATLAS_SVG_NATIVE_COMMAND,
        arguments_: {
          targetPath: '/maps/atlas.svg',
          svgBase64: 'AQID',
          expectedSha256: SHA256,
        },
      },
    ]);
  });

  it('rejects malformed requests before native invocation', async () => {
    let calls = 0;
    const result = await requestNativeAtlasSvgWrite(
      () => {
        calls += 1;
        return Promise.resolve(undefined);
      },
      { targetPath: '/maps/atlas.png', bytes: new Uint8Array(), expectedSha256: 'invalid' },
    );

    expect(calls).toBe(0);
    expect(result).toMatchObject({
      ok: false,
      diagnostic: { code: ATLAS_SVG_NATIVE_DIAGNOSTIC_CODES.invalidRequest },
    });
  });

  it('rejects a native receipt that does not verify the requested bytes and path', async () => {
    const result = await requestNativeAtlasSvgWrite(
      () =>
        Promise.resolve({
          ok: true,
          result: {
            kind: 'atlas-svg-written',
            targetPath: '/maps/other.svg',
            sha256: SHA256,
            byteLength: 3,
            platform: 'linux',
          },
        }),
      { targetPath: '/maps/atlas.svg', bytes: Uint8Array.of(1, 2, 3), expectedSha256: SHA256 },
    );

    expect(result).toMatchObject({
      ok: false,
      diagnostic: { code: ATLAS_SVG_NATIVE_DIAGNOSTIC_CODES.ioFailed },
    });
  });
});
