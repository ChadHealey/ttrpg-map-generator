/** Validated desktop boundary for atomically committing one canonical atlas PNG file. */

import { encodeBase64Bytes } from '@ttrpg-map/persistence';
import { ATLAS_PNG_MAXIMUM_BYTES } from '@ttrpg-map/render';

import type { NativeMapworldInvoke } from './mapworld-native-boundary.js';

export const ATLAS_PNG_NATIVE_COMMAND = 'atlas_png_write_base64' as const;

export const ATLAS_PNG_NATIVE_DIAGNOSTIC_CODES = Object.freeze({
  artifactConflict: 'atlas-png.native.artifact-conflict',
  fingerprintMismatch: 'atlas-png.native.fingerprint-mismatch',
  invalidRequest: 'atlas-png.native.invalid-request',
  ioFailed: 'atlas-png.native.io-failed',
} as const);

export type AtlasPngNativeDiagnosticCode =
  (typeof ATLAS_PNG_NATIVE_DIAGNOSTIC_CODES)[keyof typeof ATLAS_PNG_NATIVE_DIAGNOSTIC_CODES];

export interface AtlasPngNativeWriteRequest {
  readonly targetPath: string;
  readonly bytes: Uint8Array;
  readonly expectedSha256: string;
}

export interface AtlasPngNativeWriteReceipt {
  readonly targetPath: string;
  readonly sha256: string;
  readonly byteLength: number;
  readonly platform: 'macos' | 'linux';
}

export interface AtlasPngNativeDiagnostic {
  readonly code: AtlasPngNativeDiagnosticCode;
  readonly message: string;
  readonly primitive: string;
  readonly osErrorNumber: number | null;
  readonly osErrorName: string | null;
}

export type AtlasPngNativeWriteResult =
  | { readonly ok: true; readonly value: AtlasPngNativeWriteReceipt }
  | { readonly ok: false; readonly diagnostic: AtlasPngNativeDiagnostic };

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const UTF8_ENCODER = new TextEncoder();

/** Send bounded canonical bytes to the native atomic writer and validate its readback receipt. */
export async function requestNativeAtlasPngWrite(
  invoke: NativeMapworldInvoke,
  request: AtlasPngNativeWriteRequest,
): Promise<AtlasPngNativeWriteResult> {
  const requestDiagnostic = validateRequest(request);
  if (requestDiagnostic !== undefined) return { ok: false, diagnostic: requestDiagnostic };
  try {
    const response = await invoke(
      ATLAS_PNG_NATIVE_COMMAND,
      Object.freeze({
        targetPath: request.targetPath,
        pngBase64: encodeBase64Bytes(request.bytes),
        expectedSha256: request.expectedSha256,
      }),
    );
    return parseResponse(response, request);
  } catch {
    return failure(
      ATLAS_PNG_NATIVE_DIAGNOSTIC_CODES.ioFailed,
      'Native atlas PNG export failed before a validated response was returned.',
      'invoke-native-atlas-png-write',
    );
  }
}

function validateRequest(
  request: AtlasPngNativeWriteRequest,
): AtlasPngNativeDiagnostic | undefined {
  const basename = request.targetPath.replaceAll('\\', '/').split('/').at(-1) ?? '';
  if (
    request.targetPath.length === 0 ||
    request.targetPath.includes('\0') ||
    UTF8_ENCODER.encode(request.targetPath).byteLength > 4_096 ||
    basename.length === 0 ||
    basename === '.' ||
    basename === '..' ||
    !basename.endsWith('.png') ||
    request.bytes.byteLength === 0 ||
    request.bytes.byteLength > ATLAS_PNG_MAXIMUM_BYTES ||
    !SHA256_PATTERN.test(request.expectedSha256)
  ) {
    return failure(
      ATLAS_PNG_NATIVE_DIAGNOSTIC_CODES.invalidRequest,
      'Choose a valid .png destination and canonical atlas-png-v1 bytes within the 64 MiB limit.',
      'validate-atlas-png-write-request',
    ).diagnostic;
  }
  return undefined;
}

function parseResponse(
  input: unknown,
  request: AtlasPngNativeWriteRequest,
): AtlasPngNativeWriteResult {
  let value: unknown = input;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return invalidResponse();
    }
  }
  if (!isRecord(value) || typeof value.ok !== 'boolean') return invalidResponse();
  if (!value.ok) {
    const error = value.error;
    if (
      !isRecord(error) ||
      !isDiagnosticCode(error.code) ||
      typeof error.message !== 'string' ||
      typeof error.primitive !== 'string' ||
      !isNullableNumber(error.osErrorNumber) ||
      !isNullableString(error.osErrorName)
    ) {
      return invalidResponse();
    }
    return {
      ok: false,
      diagnostic: Object.freeze({
        code: error.code,
        message: error.message,
        primitive: error.primitive,
        osErrorNumber: error.osErrorNumber,
        osErrorName: error.osErrorName,
      }),
    };
  }
  const result = value.result;
  if (
    !isRecord(result) ||
    result.kind !== 'atlas-png-written' ||
    result.targetPath !== request.targetPath ||
    result.sha256 !== request.expectedSha256 ||
    result.byteLength !== request.bytes.byteLength ||
    (result.platform !== 'macos' && result.platform !== 'linux')
  ) {
    return invalidResponse();
  }
  return {
    ok: true,
    value: Object.freeze({
      targetPath: result.targetPath,
      sha256: result.sha256,
      byteLength: result.byteLength,
      platform: result.platform,
    }),
  };
}

function invalidResponse(): AtlasPngNativeWriteResult {
  return failure(
    ATLAS_PNG_NATIVE_DIAGNOSTIC_CODES.ioFailed,
    'Native atlas PNG export returned an invalid or unverified receipt.',
    'validate-native-atlas-png-response',
  );
}

function failure(
  code: AtlasPngNativeDiagnosticCode,
  message: string,
  primitive: string,
): Extract<AtlasPngNativeWriteResult, { readonly ok: false }> {
  return Object.freeze({
    ok: false,
    diagnostic: Object.freeze({
      code,
      message,
      primitive,
      osErrorNumber: null,
      osErrorName: null,
    }),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDiagnosticCode(value: unknown): value is AtlasPngNativeDiagnosticCode {
  return Object.values(ATLAS_PNG_NATIVE_DIAGNOSTIC_CODES).some((code) => code === value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isInteger(value));
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}
