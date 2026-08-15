import { z } from 'zod';

import { sha256Hex } from './canonical-json.js';
import { decodeMapworld } from './mapworld-decode.js';
import { parseMapworldRecoveryMarker } from './mapworld-recovery-marker.js';
import {
  MAPWORLD_NATIVE_LIMITS,
  MAPWORLD_RECOVERY_CODES,
  type MapworldRecoveryCode,
  type MapworldRecoveryResult,
  type MapworldRecoveryStep,
} from './mapworld-recovery-model.js';
import { recoveryFailure, recoverySuccess } from './mapworld-recovery-result.js';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const CONFIRMATION_TOKEN_PATTERN =
  /^(?:backup|marker|target|temporary)\|[a-f0-9]{64}(?:\|[a-f0-9]{64})?$/u;
const RECOVERY_CODE_VALUES: ReadonlySet<string> = new Set(Object.values(MAPWORLD_RECOVERY_CODES));
const recoveryCodeSchema = z.custom<MapworldRecoveryCode>(
  (value) => typeof value === 'string' && RECOVERY_CODE_VALUES.has(value),
);
const byteSchema = z.number().int().min(0).max(255);
const sha256Schema = z.string().regex(SHA256_PATTERN);
const platformSchema = z.enum(['linux', 'macos']);
const roleSchema = z.enum(['backup', 'marker', 'target', 'temporary']);
const packageRoleSchema = z.enum(['backup', 'target', 'temporary']);
const recoveryStepSchema = z.enum([
  'sync-target-commit',
  'rename-temporary-to-target',
  'rename-target-to-backup',
  'remove-temporary-exact-candidate',
  'remove-temporary-empty',
  'remove-backup-exact-previous',
  'remove-backup-empty',
  'rename-backup-to-target',
  'remove-confirmed-target',
  'remove-confirmed-temporary',
  'remove-confirmed-backup',
  'remove-confirmed-marker',
  'remove-marker',
]);

const nativeErrorSchema = z
  .strictObject({
    code: recoveryCodeSchema,
    message: z.string(),
    osErrorName: z.string().nullable(),
    osErrorNumber: z.number().int().nullable(),
    platform: platformSchema,
    primitive: z.string().min(1),
    role: roleSchema.nullable(),
  })
  .superRefine(({ osErrorName, osErrorNumber }, context) => {
    if ((osErrorName === null) !== (osErrorNumber === null)) {
      context.addIssue({
        code: 'custom',
        path: ['osErrorNumber'],
        message: 'OS error name and number must be both present or both absent.',
      });
    }
  });

const failureEnvelopeSchema = z.strictObject({ ok: z.literal(false), error: nativeErrorSchema });
const snapshotEnvelopeSchema = z.union([
  z.strictObject({ ok: z.literal(true), snapshot: z.unknown() }),
  failureEnvelopeSchema,
]);
const mutationEnvelopeSchema = z.union([
  z.strictObject({
    ok: z.literal(true),
    result: z.strictObject({
      kind: z.enum(['applied', 'saved']),
      platform: platformSchema,
      snapshotId: sha256Schema,
    }),
  }),
  failureEnvelopeSchema,
]);

const nativeSaveRequestShapeSchema = z.strictObject({
  candidateManifestSha256: z.string(),
  expectedPreviousManifestSha256: z.string().nullable(),
  expectedPreviousObservationToken: z.string().nullable(),
  files: z
    .array(
      z.strictObject({
        bytes: z.array(byteSchema).max(MAPWORLD_NATIVE_LIMITS.maximumFileBytes),
        path: z.string(),
      }),
    )
    .max(MAPWORLD_NATIVE_LIMITS.maximumPackageFiles),
  markerBytes: z.array(byteSchema).max(MAPWORLD_NATIVE_LIMITS.maximumMarkerBytes),
  operation: z.enum(['first-save', 'replacement-save']),
  targetPath: z.string().min(1),
});
const nativeSaveRequestSchema = z
  .custom<unknown>(hasBoundedAggregateFileBytes, {
    message: 'Native save request exceeds the aggregate package byte limit.',
  })
  .pipe(nativeSaveRequestShapeSchema);

const nativeApplyRequestSchema = z
  .strictObject({
    confirmationTokens: z.array(z.string().regex(CONFIRMATION_TOKEN_PATTERN)).max(4),
    expectedSnapshotId: z.string(),
    selectedManifestSha256: z.string().nullable(),
    selectedObservationToken: z.string().nullable(),
    selectedRole: packageRoleSchema.nullable(),
    steps: z.array(recoveryStepSchema).max(MAPWORLD_NATIVE_LIMITS.maximumRecoverySteps),
    targetPath: z.string().min(1),
  })
  .superRefine((request, context) => {
    const selectedFields = [
      request.selectedRole,
      request.selectedObservationToken,
      request.selectedManifestSha256,
    ];
    if (
      !selectedFields.every((value) => value === null) &&
      selectedFields.some((value) => value === null)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['selectedRole'],
        message: 'Selected candidate fields must be all present or all absent.',
      });
    }
  });

export type MapworldNativePlatformDto = z.infer<typeof platformSchema>;
export type MapworldNativeRoleDto = z.infer<typeof roleSchema>;
export type MapworldNativeErrorDto = z.infer<typeof nativeErrorSchema>;
export interface MapworldNativeMutationDto {
  readonly kind: 'applied' | 'saved';
  readonly platform: MapworldNativePlatformDto;
  readonly snapshotId: string;
}
export type MapworldNativeSaveRequestDto = Readonly<
  Omit<z.infer<typeof nativeSaveRequestSchema>, 'files' | 'markerBytes'> & {
    readonly files: readonly {
      readonly bytes: readonly number[];
      readonly path: string;
    }[];
    readonly markerBytes: readonly number[];
  }
>;
export interface MapworldNativeApplyRequestDto {
  readonly confirmationTokens: readonly string[];
  readonly expectedSnapshotId: string;
  readonly selectedManifestSha256: string | null;
  readonly selectedObservationToken: string | null;
  readonly selectedRole: 'backup' | 'target' | 'temporary' | null;
  readonly steps: readonly MapworldRecoveryStep[];
  readonly targetPath: string;
}

export type MapworldNativeTransportResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: MapworldNativeErrorDto };

export function parseMapworldNativeSaveRequestDto(
  input: unknown,
): MapworldNativeSaveRequestDto | null {
  const parsed = nativeSaveRequestSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

/** Prove that a runtime DTO contains one complete decoded package and its exact canonical marker. */
export function validateMapworldNativeSaveRequestDto(
  input: unknown,
): MapworldRecoveryResult<MapworldNativeSaveRequestDto> {
  const request = parseMapworldNativeSaveRequestDto(input);
  if (request === null) {
    return recoveryFailure(
      MAPWORLD_RECOVERY_CODES.artifactConflict,
      'Native save request fields are malformed or exceed a structural bound.',
      'Create the native request only from a validated immutable mapworld save plan.',
    );
  }
  const package_ = Object.freeze({
    files: Object.freeze(
      request.files.map(({ bytes, path }) =>
        Object.freeze({ bytes: Uint8Array.from(bytes), path }),
      ),
    ),
  });
  const decoded = decodeMapworld(package_);
  if (!decoded.ok) {
    return recoveryFailure(
      MAPWORLD_RECOVERY_CODES.fingerprintMismatch,
      'Native save request bytes are not a complete validated mapworld package.',
      'Recreate the request from createMapworldSavePlan without altering any file.',
      { diagnostics: Object.freeze([...decoded.diagnostics]) },
    );
  }
  const manifest = package_.files.find(({ path }) => path === 'manifest.json');
  if (manifest === undefined || sha256Hex(manifest.bytes) !== request.candidateManifestSha256) {
    return recoveryFailure(
      MAPWORLD_RECOVERY_CODES.fingerprintMismatch,
      'Native save request manifest bytes do not match the candidate fingerprint.',
      'Recreate the request from the same immutable save plan.',
    );
  }
  const targetName = unixBasename(request.targetPath);
  const marker = parseMapworldRecoveryMarker(request.markerBytes, targetName);
  if (!marker.ok) return marker;
  if (
    marker.value.operation !== request.operation ||
    marker.value.candidateManifestSha256 !== request.candidateManifestSha256 ||
    marker.value.previousManifestSha256 !== request.expectedPreviousManifestSha256 ||
    !hasConsistentPreviousIdentity(request)
  ) {
    return recoveryFailure(
      MAPWORLD_RECOVERY_CODES.markerInvalid,
      'Native save request intent does not match its exact recovery marker.',
      'Recreate the marker and native DTO from one immutable save plan.',
    );
  }
  return recoverySuccess(request);
}

export function parseMapworldNativeApplyRequestDto(
  input: unknown,
): MapworldNativeApplyRequestDto | null {
  const parsed = nativeApplyRequestSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function parseMapworldNativeSnapshotResponse(
  input: unknown,
): MapworldNativeTransportResult<unknown> | null {
  const parsedJson = parseJsonObject(input);
  if (parsedJson === null) return null;
  const parsed = snapshotEnvelopeSchema.safeParse(parsedJson);
  if (!parsed.success) return null;
  return parsed.data.ok
    ? Object.freeze({ ok: true, value: parsed.data.snapshot })
    : Object.freeze({ ok: false, error: Object.freeze(parsed.data.error) });
}

export function parseMapworldNativeMutationResponse(
  input: unknown,
): MapworldNativeTransportResult<MapworldNativeMutationDto> | null {
  const parsedJson = parseJsonObject(input);
  if (parsedJson === null) return null;
  const parsed = mutationEnvelopeSchema.safeParse(parsedJson);
  if (!parsed.success) return null;
  return parsed.data.ok
    ? Object.freeze({ ok: true, value: Object.freeze(parsed.data.result) })
    : Object.freeze({ ok: false, error: Object.freeze(parsed.data.error) });
}

function parseJsonObject(input: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof input !== 'string') return null;
  try {
    const parsed = JSON.parse(input) as unknown;
    return isObjectRecord(parsed) && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function hasConsistentPreviousIdentity(request: MapworldNativeSaveRequestDto): boolean {
  return request.operation === 'first-save'
    ? request.expectedPreviousManifestSha256 === null &&
        request.expectedPreviousObservationToken === null
    : sha256Schema.safeParse(request.expectedPreviousManifestSha256).success &&
        sha256Schema.safeParse(request.expectedPreviousObservationToken).success;
}

function unixBasename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function hasBoundedAggregateFileBytes(input: unknown): boolean {
  if (!isObjectRecord(input) || !Object.hasOwn(input, 'files')) return true;
  const files = input.files;
  if (!isUnknownArray(files)) return true;
  let total = 0;
  for (const file of files) {
    if (!isObjectRecord(file) || !Object.hasOwn(file, 'bytes')) return true;
    const bytes = file.bytes;
    if (!isUnknownArray(bytes)) return true;
    total += bytes.length;
    if (total > MAPWORLD_NATIVE_LIMITS.maximumPackageBytes) return false;
  }
  return true;
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}
