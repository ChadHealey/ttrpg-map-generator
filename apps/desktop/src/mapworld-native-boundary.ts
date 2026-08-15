/** Validated, injected Tauri boundary for native `.mapworld` filesystem operations. */

import {
  MAPWORLD_NATIVE_LIMITS,
  MAPWORLD_RECOVERY_CODES,
  type MapworldNativeApplyRequestDto,
  type MapworldNativeErrorDto,
  type MapworldNativeMutationDto,
  type MapworldNativePlatformDto,
  type MapworldNativeRoleDto,
  type MapworldNativeSaveRequestDto,
  type MapworldRecoveryCode,
  parseMapworldNativeApplyRequestDto,
  parseMapworldNativeMutationResponse,
  parseMapworldNativeSaveRequestDto,
  parseMapworldNativeSnapshotResponse,
  validateMapworldNativeSaveRequestDto,
} from '@ttrpg-map/persistence';

/** The desktop and persistence boundaries intentionally share one public native-limit contract. */
export const NATIVE_MAPWORLD_LIMITS = MAPWORLD_NATIVE_LIMITS;

export const NATIVE_MAPWORLD_COMMANDS = Object.freeze({
  apply: 'mapworld_native_apply',
  save: 'mapworld_native_save',
  snapshot: 'mapworld_native_snapshot',
});

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const UTF8_ENCODER = new TextEncoder();

export type NativeMapworldInvoke = (
  command: string,
  arguments_: Readonly<Record<string, unknown>>,
) => Promise<unknown>;

export type NativeMapworldRole = MapworldNativeRoleDto;
export type NativeMapworldPlatform = MapworldNativePlatformDto;
export type NativeMapworldError = Readonly<
  Omit<MapworldNativeErrorDto, 'platform'> & {
    readonly platform: NativeMapworldPlatform | null;
  }
>;

export type NativeMapworldResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: NativeMapworldError };

export type NativeMapworldMutationResult = Readonly<MapworldNativeMutationDto>;
export type NativeMapworldSaveRequest = MapworldNativeSaveRequestDto;
export type NativeMapworldApplyRequest = MapworldNativeApplyRequestDto;

/** Return the raw snapshot unchanged so persistence owns its strict role/package schema. */
export async function requestNativeMapworldSnapshot(
  invoke: NativeMapworldInvoke,
  targetPath: string,
): Promise<NativeMapworldResult<unknown>> {
  try {
    const response = await invoke(NATIVE_MAPWORLD_COMMANDS.snapshot, Object.freeze({ targetPath }));
    return (
      parseMapworldNativeSnapshotResponse(response) ??
      invalidBoundaryResult('validate-native-response', 'Native snapshot response DTO is invalid.')
    );
  } catch {
    return invalidBoundaryResult(
      'invoke-native-snapshot',
      'Native snapshot invocation failed before a validated response was returned.',
    );
  }
}

export async function requestNativeMapworldSave(
  invoke: NativeMapworldInvoke,
  request: unknown,
): Promise<NativeMapworldResult<NativeMapworldMutationResult>> {
  try {
    const parsed = parseMapworldNativeSaveRequestDto(request);
    if (parsed === null) {
      return invalidBoundaryResult(
        'validate-native-save-request',
        'Native save request DTO is malformed.',
        MAPWORLD_RECOVERY_CODES.artifactConflict,
      );
    }
    const snapshot = immutableSaveRequest(parsed);
    const limitError = validateSaveRequestLimits(snapshot);
    if (limitError !== undefined) return limitError;
    const validated = validateMapworldNativeSaveRequestDto(snapshot);
    if (!validated.ok) {
      return invalidBoundaryResult(
        'validate-native-save-request',
        validated.error.message,
        validated.error.code,
      );
    }
    const response = await invoke(
      NATIVE_MAPWORLD_COMMANDS.save,
      Object.freeze({
        targetPath: snapshot.targetPath,
        operation: snapshot.operation,
        expectedPreviousManifestSha256: snapshot.expectedPreviousManifestSha256,
        expectedPreviousObservationToken: snapshot.expectedPreviousObservationToken,
        candidateManifestSha256: snapshot.candidateManifestSha256,
        markerBytes: snapshot.markerBytes,
        relativePaths: Object.freeze(snapshot.files.map(({ path }) => path)),
        fileBytes: Object.freeze(snapshot.files.map(({ bytes }) => bytes)),
      }),
    );
    return parseMutationResponse(response, 'saved');
  } catch {
    return invalidBoundaryResult(
      'invoke-native-save',
      'Native save invocation failed before a validated response was returned.',
    );
  }
}

export async function requestNativeMapworldApply(
  invoke: NativeMapworldInvoke,
  input: unknown,
): Promise<NativeMapworldResult<NativeMapworldMutationResult>> {
  try {
    const request = parseMapworldNativeApplyRequestDto(input);
    if (request === null) {
      return invalidBoundaryResult(
        'validate-native-apply-request',
        'Native recovery request DTO is malformed.',
        MAPWORLD_RECOVERY_CODES.artifactConflict,
      );
    }
    const hasSelectedCandidate = request.selectedRole !== null;
    if (!SHA256_PATTERN.test(request.expectedSnapshotId)) {
      return invalidBoundaryResult(
        'validate-apply-snapshot-token',
        'Invalid snapshot token.',
        MAPWORLD_RECOVERY_CODES.fingerprintMismatch,
      );
    }
    if (request.steps.length > NATIVE_MAPWORLD_LIMITS.maximumRecoverySteps) {
      return invalidBoundaryResult(
        'validate-apply-step-limit',
        'The recovery plan exceeds the native operation limit.',
        MAPWORLD_RECOVERY_CODES.artifactConflict,
      );
    }
    if (
      hasSelectedCandidate !== (request.selectedObservationToken !== null) ||
      hasSelectedCandidate !== (request.selectedManifestSha256 !== null) ||
      (request.selectedObservationToken !== null &&
        !SHA256_PATTERN.test(request.selectedObservationToken)) ||
      (request.selectedManifestSha256 !== null &&
        !SHA256_PATTERN.test(request.selectedManifestSha256)) ||
      request.confirmationTokens.length > 4
    ) {
      return invalidBoundaryResult(
        'validate-apply-operation-token',
        'The recovery plan contains an invalid operation or confirmation token.',
        MAPWORLD_RECOVERY_CODES.artifactConflict,
      );
    }
    const response = await invoke(
      NATIVE_MAPWORLD_COMMANDS.apply,
      Object.freeze({
        targetPath: request.targetPath,
        expectedSnapshotId: request.expectedSnapshotId,
        selectedRole: request.selectedRole,
        selectedObservationToken: request.selectedObservationToken,
        selectedManifestSha256: request.selectedManifestSha256,
        steps: Object.freeze([...request.steps]),
        confirmationTokens: Object.freeze([...request.confirmationTokens]),
      }),
    );
    return parseMutationResponse(response, 'applied');
  } catch {
    return invalidBoundaryResult(
      'invoke-native-apply',
      'Native recovery invocation failed before a validated response was returned.',
    );
  }
}

function validateSaveRequestLimits(
  request: NativeMapworldSaveRequest,
): NativeMapworldResult<never> | undefined {
  if (
    !SHA256_PATTERN.test(request.candidateManifestSha256) ||
    (request.operation === 'first-save' &&
      (request.expectedPreviousManifestSha256 !== null ||
        request.expectedPreviousObservationToken !== null)) ||
    (request.operation === 'replacement-save' &&
      (request.expectedPreviousManifestSha256 === null ||
        !SHA256_PATTERN.test(request.expectedPreviousManifestSha256) ||
        request.expectedPreviousObservationToken === null ||
        !SHA256_PATTERN.test(request.expectedPreviousObservationToken)))
  ) {
    return invalidBoundaryResult(
      'validate-save-fingerprint',
      'Invalid save fingerprint intent.',
      MAPWORLD_RECOVERY_CODES.fingerprintMismatch,
    );
  }
  if (
    request.markerBytes.length === 0 ||
    request.markerBytes.length > NATIVE_MAPWORLD_LIMITS.maximumMarkerBytes ||
    !request.markerBytes.every(isByte)
  ) {
    return invalidBoundaryResult(
      'validate-save-marker-limit',
      'The recovery marker exceeds the native byte limit.',
      MAPWORLD_RECOVERY_CODES.artifactConflict,
    );
  }
  if (
    request.files.length === 0 ||
    request.files.length > NATIVE_MAPWORLD_LIMITS.maximumPackageFiles
  ) {
    return invalidBoundaryResult(
      'validate-save-file-count',
      'The package is empty or exceeds the native file-count limit.',
      MAPWORLD_RECOVERY_CODES.artifactConflict,
    );
  }
  let totalBytes = 0;
  const paths = new Set<string>();
  for (const file of request.files) {
    if (!isSafeRelativePath(file.path)) {
      return invalidBoundaryResult(
        'validate-save-path-limit',
        'A package path exceeds the native path or directory-depth limit.',
        MAPWORLD_RECOVERY_CODES.artifactConflict,
      );
    }
    if (paths.has(file.path)) {
      return invalidBoundaryResult(
        'validate-save-path-duplicate',
        'Package paths must be unique.',
        MAPWORLD_RECOVERY_CODES.artifactConflict,
      );
    }
    paths.add(file.path);
    if (file.bytes.length > NATIVE_MAPWORLD_LIMITS.maximumFileBytes || !file.bytes.every(isByte)) {
      return invalidBoundaryResult(
        'validate-save-file-byte-limit',
        'A package file exceeds the native byte limit.',
        MAPWORLD_RECOVERY_CODES.artifactConflict,
      );
    }
    totalBytes += file.bytes.length;
    if (totalBytes > NATIVE_MAPWORLD_LIMITS.maximumPackageBytes) {
      return invalidBoundaryResult(
        'validate-save-package-byte-limit',
        'The package exceeds the native aggregate byte limit.',
        MAPWORLD_RECOVERY_CODES.artifactConflict,
      );
    }
  }
  return undefined;
}

function parseMutationResponse(
  input: unknown,
  expectedKind: NativeMapworldMutationResult['kind'],
): NativeMapworldResult<NativeMapworldMutationResult> {
  const parsed = parseMapworldNativeMutationResponse(input);
  if (parsed === null || (parsed.ok && parsed.value.kind !== expectedKind)) {
    return invalidBoundaryResult(
      'validate-native-response',
      'Native mutation response DTO is invalid.',
    );
  }
  return parsed;
}

function invalidBoundaryResult<Value>(
  primitive: string,
  message: string,
  code: MapworldRecoveryCode = MAPWORLD_RECOVERY_CODES.ioFailed,
): NativeMapworldResult<Value> {
  return Object.freeze({
    ok: false,
    error: Object.freeze({
      code,
      message,
      osErrorName: null,
      osErrorNumber: null,
      platform: null,
      primitive,
      role: null,
    }),
  });
}

function isSafeRelativePath(path: string): boolean {
  const encodedLength = UTF8_ENCODER.encode(path).byteLength;
  const segments = path.split('/');
  return (
    encodedLength > 0 &&
    encodedLength <= NATIVE_MAPWORLD_LIMITS.maximumRelativePathBytes &&
    !path.includes('\0') &&
    !path.includes('\\') &&
    !path.startsWith('/') &&
    segments.length - 1 <= NATIVE_MAPWORLD_LIMITS.maximumDirectoryDepth &&
    segments.every(
      (segment) =>
        segment.length > 0 &&
        segment !== '.' &&
        segment !== '..' &&
        UTF8_ENCODER.encode(segment).byteLength <= NATIVE_MAPWORLD_LIMITS.maximumBasenameBytes,
    )
  );
}

function immutableSaveRequest(request: NativeMapworldSaveRequest): NativeMapworldSaveRequest {
  return Object.freeze({
    targetPath: request.targetPath,
    operation: request.operation,
    expectedPreviousManifestSha256: request.expectedPreviousManifestSha256,
    expectedPreviousObservationToken: request.expectedPreviousObservationToken,
    candidateManifestSha256: request.candidateManifestSha256,
    markerBytes: Object.freeze([...request.markerBytes]),
    files: Object.freeze(
      request.files.map(({ path, bytes }) =>
        Object.freeze({ path, bytes: Object.freeze([...bytes]) }),
      ),
    ),
  });
}

function isByte(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 255;
}
