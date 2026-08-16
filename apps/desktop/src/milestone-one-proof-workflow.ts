/** User-driven Milestone 1 proof workflow over generation, transaction, and native persistence. */

import type { RenderScene, WorldDocument } from '@ttrpg-map/core';
import {
  createMilestoneOneProofDocument,
  isMilestoneOneProofSeed,
  MILESTONE_ONE_PROOF_ENTITY_ID,
  milestoneOneProofAspects,
  type MilestoneOneProofSeed,
  rerollMilestoneOneMarkers,
} from '@ttrpg-map/generation';

import type { NativeMapworldInvoke } from './mapworld-native-boundary.js';
import {
  recoverMapworldDocument,
  saveMapworldDocument,
} from './mapworld-persistence-orchestrator.js';
import {
  compareMilestoneOneIsolation,
  compareMilestoneOneReopenEvidence,
  createMilestoneOneProofEvidence,
  type MilestoneOneIsolationComparison,
  type MilestoneOneProofEvidence,
  type MilestoneOneReopenComparison,
} from './milestone-one-proof-evidence.js';
import { createMilestoneOneProofScene } from './milestone-one-proof-scene.js';

export type MilestoneOneWorkflowPhase =
  'empty' | 'baseline' | 'rerolled' | 'saved' | 'closed' | 'reopened';

export interface MilestoneOneProofGenerationPort {
  readonly createBaseline: (seed: MilestoneOneProofSeed) => WorldDocument;
  readonly rerollMarkers: (document: WorldDocument) => ReturnType<typeof rerollMilestoneOneMarkers>;
}

export interface MilestoneOneWorkflowSnapshot {
  readonly phase: MilestoneOneWorkflowPhase;
  readonly document: WorldDocument | undefined;
  readonly scene: RenderScene | undefined;
  readonly evidence: MilestoneOneProofEvidence | undefined;
  readonly baselineEvidence: MilestoneOneProofEvidence | undefined;
  readonly rerolledEvidence: MilestoneOneProofEvidence | undefined;
  readonly isolation: MilestoneOneIsolationComparison | undefined;
  readonly reopen:
    | (Omit<MilestoneOneReopenComparison, 'packageBytesRestored'> & {
        readonly manifestFingerprintRestored: boolean;
      })
    | undefined;
  readonly savedManifestSha256: string | undefined;
  readonly reopenedManifestSha256: string | undefined;
  readonly targetPath: string;
  readonly generationInvocationCount: number;
  readonly reopenGenerationInvocationCount: number | undefined;
  readonly statusMessage: string;
}

export type MilestoneOneWorkflowResult =
  { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string };

const DEFAULT_GENERATION_PORT: MilestoneOneProofGenerationPort = Object.freeze({
  createBaseline: createMilestoneOneProofDocument,
  rerollMarkers: rerollMilestoneOneMarkers,
});

export class MilestoneOneProofWorkflow {
  readonly #generation: MilestoneOneProofGenerationPort;
  #phase: MilestoneOneWorkflowPhase = 'empty';
  #document: WorldDocument | undefined;
  #scene: RenderScene | undefined;
  #evidence: MilestoneOneProofEvidence | undefined;
  #baselineEvidence: MilestoneOneProofEvidence | undefined;
  #rerolledEvidence: MilestoneOneProofEvidence | undefined;
  #isolation: MilestoneOneIsolationComparison | undefined;
  #reopen: MilestoneOneWorkflowSnapshot['reopen'];
  #savedManifestSha256: string | undefined;
  #reopenedManifestSha256: string | undefined;
  #targetPath = '';
  #generationInvocationCount = 0;
  #reopenGenerationInvocationCount: number | undefined;
  #statusMessage = 'Enter the registered seed to generate the baseline proof.';

  constructor(generation: MilestoneOneProofGenerationPort = DEFAULT_GENERATION_PORT) {
    this.#generation = generation;
  }

  get snapshot(): MilestoneOneWorkflowSnapshot {
    return Object.freeze({
      phase: this.#phase,
      document: this.#document,
      scene: this.#scene,
      evidence: this.#evidence,
      baselineEvidence: this.#baselineEvidence,
      rerolledEvidence: this.#rerolledEvidence,
      isolation: this.#isolation,
      reopen: this.#reopen,
      savedManifestSha256: this.#savedManifestSha256,
      reopenedManifestSha256: this.#reopenedManifestSha256,
      targetPath: this.#targetPath,
      generationInvocationCount: this.#generationInvocationCount,
      reopenGenerationInvocationCount: this.#reopenGenerationInvocationCount,
      statusMessage: this.#statusMessage,
    });
  }

  generate(seed: string): MilestoneOneWorkflowResult {
    if (!isMilestoneOneProofSeed(seed)) {
      return this.#failure(
        'proof.seed.not-registered',
        'This proof accepts only the registered Milestone 1 fixture seed.',
      );
    }
    this.#generationInvocationCount += 1;
    const document = this.#generation.createBaseline(seed);
    const evidence = createMilestoneOneProofEvidence(document, 'baseline');
    this.#phase = 'baseline';
    this.#document = document;
    this.#scene = sceneFor(document);
    this.#evidence = evidence;
    this.#baselineEvidence = evidence;
    this.#rerolledEvidence = undefined;
    this.#isolation = undefined;
    this.#reopen = undefined;
    this.#savedManifestSha256 = undefined;
    this.#reopenedManifestSha256 = undefined;
    this.#targetPath = '';
    this.#reopenGenerationInvocationCount = undefined;
    this.#statusMessage = 'Baseline accepted at outline revision 0 and marker revision 0.';
    return Object.freeze({ ok: true });
  }

  rerollMarkers(): MilestoneOneWorkflowResult {
    const baselineDocument = this.#document;
    const baselineEvidence = this.#baselineEvidence;
    if (
      this.#phase !== 'baseline' ||
      baselineDocument === undefined ||
      baselineEvidence === undefined
    ) {
      return this.#failure(
        'proof.workflow.baseline-required',
        'Generate the baseline before rerolling markers.',
      );
    }
    this.#generationInvocationCount += 1;
    const result = this.#generation.rerollMarkers(baselineDocument);
    if (!result.ok) {
      return this.#failure(
        result.diagnostics[0]?.code ?? 'proof.workflow.reroll-rejected',
        result.diagnostics[0]?.message ?? 'The marker reroll transaction was rejected.',
      );
    }
    const evidence = createMilestoneOneProofEvidence(result.document, 'rerolled');
    const isolation = compareMilestoneOneIsolation(
      baselineDocument,
      result.document,
      baselineEvidence,
      evidence,
    );
    if (!isolation.passed) {
      return this.#failure(
        'proof.workflow.isolation-failed',
        'The reroll changed evidence outside the permitted marker boundary.',
      );
    }
    this.#phase = 'rerolled';
    this.#document = result.document;
    this.#scene = sceneFor(result.document);
    this.#evidence = evidence;
    this.#rerolledEvidence = evidence;
    this.#isolation = isolation;
    this.#statusMessage = 'Markers rerolled to revision 1; every isolation assertion passes.';
    return Object.freeze({ ok: true });
  }

  async save(
    invoke: NativeMapworldInvoke,
    targetPath: string,
  ): Promise<MilestoneOneWorkflowResult> {
    const document = this.#document;
    const pathResult = validateTargetPath(targetPath);
    if (!pathResult.ok) return this.#failure(pathResult.code, pathResult.message);
    if (this.#phase !== 'rerolled' || document === undefined || this.#isolation?.passed !== true) {
      return this.#failure(
        'proof.workflow.reroll-required',
        'Reroll markers and pass isolation evidence before saving.',
      );
    }
    const result = await saveMapworldDocument(invoke, targetPath, document, {
      operation: 'first-save',
      targetName: pathResult.targetName,
      previousManifestSha256: null,
      expectedPreviousObservationToken: null,
    });
    if (!result.ok) return this.#failure(result.error.code, result.error.message);
    this.#phase = 'saved';
    this.#targetPath = targetPath;
    this.#savedManifestSha256 = result.value.plan.candidateManifestSha256;
    this.#statusMessage = `Saved through the native ${result.value.nativeResult.platform} boundary. Close the proof before reopening it.`;
    return Object.freeze({ ok: true });
  }

  close(): MilestoneOneWorkflowResult {
    if (this.#phase !== 'saved' || this.#savedManifestSha256 === undefined) {
      return this.#failure(
        'proof.workflow.save-required',
        'Save the rerolled proof before closing it.',
      );
    }
    this.#phase = 'closed';
    this.#document = undefined;
    this.#scene = undefined;
    this.#evidence = undefined;
    this.#statusMessage = 'Proof closed: accepted document and RenderScene are unloaded.';
    return Object.freeze({ ok: true });
  }

  async reopen(invoke: NativeMapworldInvoke): Promise<MilestoneOneWorkflowResult> {
    if (this.#phase !== 'closed' || this.#targetPath.length === 0) {
      return this.#failure(
        'proof.workflow.close-required',
        'Close a successfully saved proof before reopening it.',
      );
    }
    const generationCountBefore = this.#generationInvocationCount;
    const result = await recoverMapworldDocument(invoke, this.#targetPath);
    if (!result.ok) return this.#failure(result.error.code, result.error.message);
    if (
      result.value.kind !== 'ready' ||
      result.value.selected?.classification !== 'valid' ||
      result.value.selected.document === undefined ||
      result.value.selected.fingerprint === undefined
    ) {
      return this.#failure(
        'proof.workflow.reopen-attention',
        'Native recovery did not select one clean, fully decoded proof package.',
      );
    }
    const reopenedDocument = result.value.selected.document;
    const evidence = createMilestoneOneProofEvidence(reopenedDocument, 'reopened');
    const rerolledEvidence = this.#rerolledEvidence;
    if (rerolledEvidence === undefined) {
      return this.#failure(
        'proof.workflow.audit-missing',
        'Rerolled audit evidence is unavailable after close.',
      );
    }
    const reopen = compareMilestoneOneReopenEvidence(rerolledEvidence, evidence);
    const fingerprintRestored =
      result.value.selected.fingerprint === this.#savedManifestSha256 &&
      evidence.packageManifestSha256 === this.#savedManifestSha256;
    this.#reopenGenerationInvocationCount = this.#generationInvocationCount - generationCountBefore;
    if (!reopen.passed || !fingerprintRestored || this.#reopenGenerationInvocationCount !== 0) {
      return this.#failure(
        'proof.workflow.reopen-evidence-failed',
        'Reopened evidence, native fingerprint, or the generator-free load tripwire failed.',
      );
    }
    this.#phase = 'reopened';
    this.#document = reopenedDocument;
    this.#scene = sceneFor(reopenedDocument);
    this.#evidence = evidence;
    this.#reopen = reopen;
    this.#reopenedManifestSha256 = result.value.selected.fingerprint;
    this.#statusMessage = 'Reopened from authoritative native bytes with zero generator calls.';
    return Object.freeze({ ok: true });
  }

  #failure(code: string, message: string): MilestoneOneWorkflowResult {
    this.#statusMessage = `${code}: ${message}`;
    return Object.freeze({ ok: false, code, message });
  }
}

function sceneFor(document: WorldDocument): RenderScene {
  const aspects = milestoneOneProofAspects(document);
  return createMilestoneOneProofScene({
    sourceEntityId: MILESTONE_ONE_PROOF_ENTITY_ID,
    outline: aspects.outline.acceptedOutput.points,
    markers: aspects.markers.acceptedOutput.markers,
  });
}

function validateTargetPath(
  targetPath: string,
):
  | { readonly ok: true; readonly targetName: string }
  | { readonly ok: false; readonly code: string; readonly message: string } {
  const targetName = targetPath.slice(targetPath.lastIndexOf('/') + 1);
  if (
    !targetPath.startsWith('/') ||
    targetPath.includes('\0') ||
    targetName.length === 0 ||
    !targetName.endsWith('.mapworld')
  ) {
    return Object.freeze({
      ok: false,
      code: 'proof.target.invalid',
      message: 'Use an absolute path with a .mapworld basename and an existing parent directory.',
    });
  }
  return Object.freeze({ ok: true, targetName });
}
