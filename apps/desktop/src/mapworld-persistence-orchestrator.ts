/** Desktop orchestration for validated `.mapworld` save and recovery DTOs. */

import type { WorldDocument } from '@ttrpg-map/core';
import {
  type ClassifiedMapworldPackageCandidate,
  type ClassifiedMapworldRecoverySnapshot,
  classifyMapworldRecoverySnapshot,
  createMapworldSavePlan,
  decideMapworldRecovery,
  MAPWORLD_RECOVERY_CODES,
  type MapworldRecoveryConfirmation,
  type MapworldRecoveryDecision,
  type MapworldRecoveryError,
  type MapworldRecoveryNativePlan,
  type MapworldSaveIntent,
  type MapworldSavePlan,
  planConfirmedMapworldRecovery,
} from '@ttrpg-map/persistence';

import {
  type NativeMapworldError,
  type NativeMapworldInvoke,
  type NativeMapworldMutationResult,
  requestNativeMapworldApply,
  requestNativeMapworldSave,
  requestNativeMapworldSnapshot,
} from './mapworld-native-boundary.js';

/** Prevent a faulty adapter from driving an unbounded enumerate/apply cycle. */
export const MAXIMUM_AUTOMATIC_RECOVERY_SNAPSHOTS = 8;

export type DesktopMapworldFailure =
  | {
      readonly ok: false;
      readonly source: 'native';
      readonly error: NativeMapworldError;
    }
  | {
      readonly ok: false;
      readonly source: 'persistence';
      readonly error: MapworldRecoveryError;
    };

export type DesktopMapworldResult<Value> =
  { readonly ok: true; readonly value: Value } | DesktopMapworldFailure;

export type DesktopMapworldRecoveryOutcome =
  | {
      readonly kind: 'ready';
      readonly snapshot: ClassifiedMapworldRecoverySnapshot;
      readonly selected: ClassifiedMapworldPackageCandidate | null;
      readonly canSave: boolean;
    }
  | {
      readonly kind: 'attention';
      readonly snapshot: ClassifiedMapworldRecoverySnapshot;
      readonly decision: Extract<MapworldRecoveryDecision, { readonly kind: 'attention' }>;
    }
  | {
      readonly kind: 'selected-read-only';
      readonly snapshot: ClassifiedMapworldRecoverySnapshot;
      readonly selected: ClassifiedMapworldPackageCandidate;
    };

export type DesktopMapworldSaveIntent =
  | (Extract<MapworldSaveIntent, { readonly operation: 'first-save' }> & {
      readonly expectedPreviousObservationToken: null;
    })
  | (Extract<MapworldSaveIntent, { readonly operation: 'replacement-save' }> & {
      readonly expectedPreviousObservationToken: string;
      readonly overwriteAuthority: 'confirmed-save-as-overwrite' | 'replace-last-opened';
    });

export interface DesktopMapworldSaveResult {
  readonly plan: MapworldSavePlan;
  readonly nativeResult: NativeMapworldMutationResult;
}

/**
 * Snapshot the complete document into a validated immutable plan before invoking native code.
 * Native receives both the last-opened manifest fingerprint and observation token for replacement.
 */
export async function saveMapworldDocument(
  invoke: NativeMapworldInvoke,
  targetPath: string,
  document: WorldDocument,
  intent: DesktopMapworldSaveIntent,
): Promise<DesktopMapworldResult<DesktopMapworldSaveResult>> {
  if (intent.operation === 'replacement-save' && !isOverwriteAuthority(intent.overwriteAuthority)) {
    return persistenceFailure(
      Object.freeze({
        code: MAPWORLD_RECOVERY_CODES.confirmationRequired,
        message: 'Replacement save lacks explicit overwrite authority.',
        suggestedAction: 'Reopen the target or explicitly confirm the selected Save As overwrite.',
      }),
    );
  }
  if (unixBasename(targetPath) !== intent.targetName) {
    return persistenceFailure(
      Object.freeze({
        code: MAPWORLD_RECOVERY_CODES.artifactNameInvalid,
        message: 'The save target path basename does not match the recovery intent target name.',
        suggestedAction: 'Create a new save intent from the exact selected target path.',
      }),
    );
  }
  const planned = createMapworldSavePlan(document, intent);
  if (!planned.ok) return persistenceFailure(planned.error);
  const saved = await requestNativeMapworldSave(invoke, {
    targetPath,
    operation: planned.value.operation,
    expectedPreviousManifestSha256: planned.value.expectedPreviousManifestSha256,
    expectedPreviousObservationToken: intent.expectedPreviousObservationToken,
    candidateManifestSha256: planned.value.candidateManifestSha256,
    markerBase64: planned.value.markerBase64,
    files: planned.value.files,
  });
  if (!saved.ok) return nativeFailure(saved.error);
  return success(
    Object.freeze({
      plan: planned.value,
      nativeResult: saved.value,
    }),
  );
}

/** Enumerate, classify, apply only persistence-owned automatic plans, and revalidate. */
export async function recoverMapworldDocument(
  invoke: NativeMapworldInvoke,
  targetPath: string,
): Promise<DesktopMapworldResult<DesktopMapworldRecoveryOutcome>> {
  for (let pass = 0; pass < MAXIMUM_AUTOMATIC_RECOVERY_SNAPSHOTS; pass += 1) {
    const observed = await readClassifiedSnapshot(invoke, targetPath);
    if (!observed.ok) return observed;
    const decision = decideMapworldRecovery(observed.value);
    if (decision.kind === 'clean') {
      return success(
        Object.freeze({
          kind: 'ready' as const,
          snapshot: observed.value,
          selected: decision.selected,
          canSave: decision.canSave,
        }),
      );
    }
    if (decision.kind === 'attention') {
      return success(
        Object.freeze({ kind: 'attention' as const, snapshot: observed.value, decision }),
      );
    }
    const applied = await applyNativePlan(invoke, targetPath, decision.plan);
    if (!applied.ok) return applied;
  }
  return nativeFailure(
    Object.freeze({
      code: MAPWORLD_RECOVERY_CODES.ioFailed,
      primitive: 'automatic-recovery-pass-limit',
      role: null,
      osErrorNumber: null,
      osErrorName: null,
      message: 'Native recovery did not converge within the bounded snapshot count.',
      platform: null,
    }),
  );
}

/** Re-enumerate before accepting a candidate-specific confirmation, then revalidate after mutation. */
export async function confirmMapworldRecovery(
  invoke: NativeMapworldInvoke,
  targetPath: string,
  confirmation: MapworldRecoveryConfirmation,
): Promise<DesktopMapworldResult<DesktopMapworldRecoveryOutcome>> {
  const observed = await readClassifiedSnapshot(invoke, targetPath);
  if (!observed.ok) return observed;
  const planned = planConfirmedMapworldRecovery(observed.value, confirmation);
  if (!planned.ok) return persistenceFailure(planned.error);
  if (planned.value.steps.length === 0) {
    const selected = candidateForRole(observed.value, planned.value.selectedRole);
    if (selected?.classification !== 'valid') {
      return persistenceFailure(
        Object.freeze({
          code: MAPWORLD_RECOVERY_CODES.confirmationRequired,
          message: 'The confirmed read-only candidate is no longer valid.',
          suggestedAction: 'Enumerate again and confirm the current candidate.',
        }),
      );
    }
    return success(
      Object.freeze({
        kind: 'selected-read-only' as const,
        snapshot: observed.value,
        selected,
      }),
    );
  }
  const applied = await applyNativePlan(invoke, targetPath, planned.value);
  if (!applied.ok) return applied;
  return recoverMapworldDocument(invoke, targetPath);
}

async function readClassifiedSnapshot(
  invoke: NativeMapworldInvoke,
  targetPath: string,
): Promise<DesktopMapworldResult<ClassifiedMapworldRecoverySnapshot>> {
  const native = await requestNativeMapworldSnapshot(invoke, targetPath);
  if (!native.ok) return nativeFailure(native.error);
  const classified = classifyMapworldRecoverySnapshot(native.value);
  return classified.ok ? success(classified.value) : persistenceFailure(classified.error);
}

async function applyNativePlan(
  invoke: NativeMapworldInvoke,
  targetPath: string,
  plan: MapworldRecoveryNativePlan,
): Promise<DesktopMapworldResult<NativeMapworldMutationResult>> {
  const applied = await requestNativeMapworldApply(invoke, {
    targetPath,
    expectedSnapshotId: plan.snapshotId,
    selectedRole: plan.selectedRole,
    selectedObservationToken: plan.selectedObservationToken,
    selectedManifestSha256: plan.selectedManifestSha256,
    steps: plan.steps,
    confirmationTokens: plan.confirmationTokens,
  });
  return applied.ok ? success(applied.value) : nativeFailure(applied.error);
}

function candidateForRole(
  snapshot: ClassifiedMapworldRecoverySnapshot,
  role: 'backup' | 'target' | 'temporary' | null,
): ClassifiedMapworldPackageCandidate | null {
  if (role === null) return null;
  return snapshot[role];
}

function success<Value>(value: Value): DesktopMapworldResult<Value> {
  return Object.freeze({ ok: true, value });
}

function nativeFailure<Value>(error: NativeMapworldError): DesktopMapworldResult<Value> {
  return Object.freeze({ ok: false, source: 'native', error });
}

function persistenceFailure<Value>(error: MapworldRecoveryError): DesktopMapworldResult<Value> {
  return Object.freeze({ ok: false, source: 'persistence', error });
}

function unixBasename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function isOverwriteAuthority(
  value: unknown,
): value is 'confirmed-save-as-overwrite' | 'replace-last-opened' {
  return value === 'replace-last-opened' || value === 'confirmed-save-as-overwrite';
}
