/** Lightweight validated-boundary doubles for focused atlas lifecycle and export tests. */

import type { AtlasWorkflow } from './atlas-workflow.js';
import type {
  AtlasAcceptedCheckpoint,
  AtlasAcceptedEvidence,
  AtlasReopenComparison,
} from './atlas-workflow-evidence.js';
import type { AcceptedAtlasState } from './atlas-workflow-generation.js';
import type { AtlasWorkflowPersistencePort } from './atlas-workflow-persistence.js';

const MANIFEST_SHA256 = 'a'.repeat(64);
const EVIDENCE_SHA256 = 'b'.repeat(64);

export function successfulAtlasPersistence(
  accepted: AcceptedAtlasState,
): AtlasWorkflowPersistencePort {
  const save: AtlasWorkflowPersistencePort['save'] = (
    invoke,
    targetPath,
    targetName,
    acceptedState,
    checkpoint,
  ) => {
    void invoke;
    void targetPath;
    void targetName;
    void acceptedState;
    return Promise.resolve({
      ok: true,
      value: {
        evidence: acceptedEvidence(checkpoint),
        manifestSha256: MANIFEST_SHA256,
        platform: 'macos',
      },
    });
  };
  const reopen: AtlasWorkflowPersistencePort['reopen'] = (
    invoke,
    targetPath,
    savedEvidence,
    savedManifestSha256,
  ) => {
    void invoke;
    void targetPath;
    void savedEvidence;
    void savedManifestSha256;
    return Promise.resolve({
      ok: true,
      value: {
        accepted,
        evidence: acceptedEvidence('reopened'),
        comparison: passingReopenComparison(),
        manifestSha256: MANIFEST_SHA256,
      },
    });
  };
  return Object.freeze({ save, reopen });
}

export async function advanceAcceptedWorkflowToReopened(
  workflow: AtlasWorkflow,
  targetPath = '/proofs/focused-atlas.mapworld',
): Promise<void> {
  const saved = await workflow.save(targetPath);
  if (!saved.ok) throw new Error(`${saved.code}: ${saved.message}`);
  const closed = workflow.close();
  if (!closed.ok) throw new Error(`${closed.code}: ${closed.message}`);
  const reopened = await workflow.reopen();
  if (!reopened.ok) throw new Error(`${reopened.code}: ${reopened.message}`);
}

export function acceptedEvidence(checkpoint: AtlasAcceptedCheckpoint): AtlasAcceptedEvidence {
  return Object.freeze({
    checkpoint,
    aspects: Object.freeze([]),
    canonicalAspectSetSha256: EVIDENCE_SHA256,
    canonicalOutputSetSha256: EVIDENCE_SHA256,
    canonicalCoastlineOutputSha256: EVIDENCE_SHA256,
    renderSceneSha256: EVIDENCE_SHA256,
  });
}

export function passingReopenComparison(): AtlasReopenComparison {
  return Object.freeze({
    passed: true,
    canonicalAspectsRestored: true,
    canonicalOutputsRestored: true,
    canonicalCoastlineRestored: true,
    renderSceneRestored: true,
    manifestFingerprintRestored: true,
  });
}
