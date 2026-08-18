/** Native authoritative save/reopen operations for an accepted Milestone 2 atlas. */

import {
  type AtlasAcceptedCheckpoint,
  type AtlasAcceptedEvidence,
  type AtlasReopenComparison,
  compareAtlasReopenEvidence,
  createAtlasAcceptedEvidence,
} from './atlas-workflow-evidence.js';
import type { AcceptedAtlasState } from './atlas-workflow-generation.js';
import { reopenAcceptedAtlas } from './atlas-workflow-reopen.js';
import type { NativeMapworldInvoke, NativeMapworldPlatform } from './mapworld-native-boundary.js';
import {
  recoverMapworldDocument,
  saveMapworldDocument,
} from './mapworld-persistence-orchestrator.js';

export interface AtlasSavedCheckpoint {
  readonly evidence: AtlasAcceptedEvidence;
  readonly manifestSha256: string;
  readonly platform: NativeMapworldPlatform;
}

export interface AtlasReopenedCheckpoint {
  readonly accepted: AcceptedAtlasState;
  readonly evidence: AtlasAcceptedEvidence;
  readonly comparison: AtlasReopenComparison;
  readonly manifestSha256: string;
}

export type AtlasPersistenceResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly code: string; readonly message: string };

export interface AtlasWorkflowPersistencePort {
  readonly save: typeof saveAcceptedAtlasCheckpoint;
  readonly reopen: typeof reopenAcceptedAtlasCheckpoint;
}

export async function saveAcceptedAtlasCheckpoint(
  invoke: NativeMapworldInvoke,
  targetPath: string,
  targetName: string,
  accepted: AcceptedAtlasState,
  checkpoint: AtlasAcceptedCheckpoint,
): Promise<AtlasPersistenceResult<AtlasSavedCheckpoint>> {
  const evidence = await createAtlasAcceptedEvidence(accepted, checkpoint);
  if (!evidence.ok) return evidence;
  const saved = await saveMapworldDocument(invoke, targetPath, accepted.document, {
    operation: 'first-save',
    targetName,
    previousManifestSha256: null,
    expectedPreviousObservationToken: null,
  });
  if (!saved.ok) return failure(saved.error.code, saved.error.message);
  return success(
    Object.freeze({
      evidence: evidence.evidence,
      manifestSha256: saved.value.plan.candidateManifestSha256,
      platform: saved.value.nativeResult.platform,
    }),
  );
}

export async function reopenAcceptedAtlasCheckpoint(
  invoke: NativeMapworldInvoke,
  targetPath: string,
  savedEvidence: AtlasAcceptedEvidence,
  savedManifestSha256: string,
): Promise<AtlasPersistenceResult<AtlasReopenedCheckpoint>> {
  const recovered = await recoverMapworldDocument(invoke, targetPath);
  if (!recovered.ok) return failure(recovered.error.code, recovered.error.message);
  if (
    recovered.value.kind !== 'ready' ||
    recovered.value.selected?.classification !== 'valid' ||
    recovered.value.selected.document === undefined ||
    recovered.value.selected.fingerprint === undefined
  ) {
    return failure(
      'atlas.reopen.native-attention-required',
      'Native recovery did not select one clean, checksum-validated atlas package.',
    );
  }
  const reopened = reopenAcceptedAtlas(recovered.value.selected.document);
  if (!reopened.ok) {
    return failure(
      reopened.diagnosticCodes[0] ?? 'atlas.reopen.accepted-state-invalid',
      reopened.message,
    );
  }
  const evidence = await createAtlasAcceptedEvidence(reopened.accepted, 'reopened');
  if (!evidence.ok) return evidence;
  const manifestSha256 = recovered.value.selected.fingerprint;
  const comparison = compareAtlasReopenEvidence(
    savedEvidence,
    evidence.evidence,
    savedManifestSha256,
    manifestSha256,
  );
  if (!comparison.passed) {
    return failure(
      'atlas.reopen.evidence-mismatch',
      'Reopened semantic, coastline, scene, or manifest evidence did not match the saved atlas.',
    );
  }
  return success(
    Object.freeze({
      accepted: reopened.accepted,
      evidence: evidence.evidence,
      comparison,
      manifestSha256,
    }),
  );
}

export const productionAtlasWorkflowPersistence: AtlasWorkflowPersistencePort = Object.freeze({
  save: saveAcceptedAtlasCheckpoint,
  reopen: reopenAcceptedAtlasCheckpoint,
});

export function validateAtlasSaveTarget(
  targetPath: string,
): AtlasPersistenceResult<{ readonly targetName: string }> {
  const targetName = targetPath.slice(targetPath.lastIndexOf('/') + 1);
  if (
    !targetPath.startsWith('/') ||
    targetPath.includes('\0') ||
    targetName.length === 0 ||
    !targetName.endsWith('.mapworld')
  ) {
    return failure(
      'atlas.save.target-invalid',
      'Use an absolute .mapworld path whose parent directory already exists.',
    );
  }
  return success(Object.freeze({ targetName }));
}

function success<Value>(value: Value): AtlasPersistenceResult<Value> {
  return Object.freeze({ ok: true, value });
}

function failure<Value>(code: string, message: string): AtlasPersistenceResult<Value> {
  return Object.freeze({ ok: false, code, message });
}
