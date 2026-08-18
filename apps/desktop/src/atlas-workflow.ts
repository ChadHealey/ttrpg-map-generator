/**
 * User-facing Milestone 2 atlas state machine.
 *
 * The complete transition surface stays together so preview, accepted, saved, closed, and reopened
 * states change atomically through one private owner. Canonical evidence, native persistence,
 * generation, presentation, and export implementations remain extracted behind typed ports.
 */

import {
  type AtlasControls,
  DEFAULT_ATLAS_CONTROLS,
  formatWorldSeed,
  parseAtlasControls,
  parseWorldSeed,
} from '@ttrpg-map/core';
import type { AtlasGenerationProgress, AtlasLandWaterPreview } from '@ttrpg-map/generation';

import {
  type AtlasPngDestinationPort,
  type AtlasPngWorkflowProgress,
  type AtlasPngWorkflowReceipt,
  exportAcceptedAtlasPng,
  productionAtlasPngDestination,
} from './atlas-png-export-orchestrator.js';
import {
  type AtlasSvgDestinationPort,
  type AtlasSvgWorkflowProgress,
  type AtlasSvgWorkflowReceipt,
  exportAcceptedAtlasSvg,
  productionAtlasSvgDestination,
} from './atlas-svg-export-orchestrator.js';
import type {
  AtlasRerollChangeSet,
  AtlasRerollKind,
  AtlasWorkflowPhase,
  AtlasWorkflowProgress,
  AtlasWorkflowResult,
  AtlasWorkflowSnapshot,
} from './atlas-workflow-contract.js';
import { atlasEditingPhaseDiagnostic } from './atlas-workflow-contract.js';
import {
  type AtlasAcceptedCheckpoint,
  type AtlasAcceptedEvidence,
  type AtlasReopenComparison,
} from './atlas-workflow-evidence.js';
import {
  type AcceptedAtlasState,
  type AtlasWorkflowGenerationPort,
  type AtlasWorkflowGenerationRequest,
  type AtlasWorkflowOperation,
  productionAtlasWorkflowGeneration,
} from './atlas-workflow-generation.js';
import {
  type AtlasWorkflowPersistencePort,
  productionAtlasWorkflowPersistence,
  validateAtlasSaveTarget,
} from './atlas-workflow-persistence.js';
import { atlasInspectionEntities, atlasRerollChangeSet } from './atlas-workflow-presentation.js';
import type { NativeMapworldInvoke } from './mapworld-native-boundary.js';
import { tauriMapworldInvoke } from './tauri-mapworld-invoke.js';

export const MILESTONE_TWO_ATLAS_PROOF_SEED = '81985529216486895' as const;

export type {
  AtlasInspectionEntity,
  AtlasRerollChangeSet,
  AtlasRerollKind,
  AtlasWorkflowPhase,
  AtlasWorkflowProgress,
  AtlasWorkflowResult,
  AtlasWorkflowSnapshot,
} from './atlas-workflow-contract.js';
export { atlasEditingPhaseDiagnostic, isAtlasEditingPhase } from './atlas-workflow-contract.js';

interface ActiveOperation {
  readonly sequence: number;
  readonly operationId: string;
  readonly label: string;
  isCancellationRequested: boolean;
  isCancellationAllowed: boolean;
}

export class AtlasWorkflow {
  readonly #generation: AtlasWorkflowGenerationPort;
  readonly #pngDestination: AtlasPngDestinationPort;
  readonly #svgDestination: AtlasSvgDestinationPort;
  readonly #nativeInvoke: NativeMapworldInvoke;
  readonly #persistence: AtlasWorkflowPersistencePort;
  #phase: AtlasWorkflowPhase = 'empty';
  #controls: AtlasControls = DEFAULT_ATLAS_CONTROLS;
  #accepted: AcceptedAtlasState | undefined;
  #preview: AtlasLandWaterPreview | undefined;
  #isBusy = false;
  #progress: AtlasWorkflowProgress | undefined;
  #pngExportReceipt: AtlasPngWorkflowReceipt | undefined;
  #svgExportReceipt: AtlasSvgWorkflowReceipt | undefined;
  #acceptedCheckpoint: AtlasAcceptedCheckpoint | undefined;
  #savedEvidence: AtlasAcceptedEvidence | undefined;
  #reopenedEvidence: AtlasAcceptedEvidence | undefined;
  #reopenComparison: AtlasReopenComparison | undefined;
  #savedManifestSha256: string | undefined;
  #reopenedManifestSha256: string | undefined;
  #targetPath = '';
  #generationInvocationCount = 0;
  #reopenGenerationInvocationCount: number | undefined;
  #pendingReroll: AtlasRerollChangeSet | undefined;
  #diagnosticCodes: readonly string[] = Object.freeze([]);
  #statusMessage = 'Configure a seed and request a disposable coarse preview.';
  #active: ActiveOperation | undefined;
  #operationSequence = 0;

  constructor(
    generation: AtlasWorkflowGenerationPort = productionAtlasWorkflowGeneration,
    svgDestination: AtlasSvgDestinationPort = productionAtlasSvgDestination,
    pngDestination: AtlasPngDestinationPort = productionAtlasPngDestination,
    nativeInvoke: NativeMapworldInvoke = tauriMapworldInvoke,
    persistence: AtlasWorkflowPersistencePort = productionAtlasWorkflowPersistence,
  ) {
    this.#generation = generation;
    this.#svgDestination = svgDestination;
    this.#pngDestination = pngDestination;
    this.#nativeInvoke = nativeInvoke;
    this.#persistence = persistence;
  }

  get snapshot(): AtlasWorkflowSnapshot {
    return Object.freeze({
      phase: this.#phase,
      controls: this.#controls,
      accepted: this.#accepted,
      scene: this.#accepted?.scene,
      preview: this.#preview,
      isPreviewState: this.#preview !== undefined,
      isBusy: this.#isBusy,
      isCancellationAllowed: this.#active?.isCancellationAllowed ?? false,
      progress: this.#progress,
      pngExportReceipt: this.#pngExportReceipt,
      svgExportReceipt: this.#svgExportReceipt,
      acceptedCheckpoint: this.#acceptedCheckpoint,
      savedEvidence: this.#savedEvidence,
      reopenedEvidence: this.#reopenedEvidence,
      reopenComparison: this.#reopenComparison,
      savedManifestSha256: this.#savedManifestSha256,
      reopenedManifestSha256: this.#reopenedManifestSha256,
      targetPath: this.#targetPath,
      generationInvocationCount: this.#generationInvocationCount,
      reopenGenerationInvocationCount: this.#reopenGenerationInvocationCount,
      pendingReroll: this.#pendingReroll,
      diagnosticCodes: this.#diagnosticCodes,
      statusMessage: this.#statusMessage,
      inspectionEntities: atlasInspectionEntities(this.#accepted),
    });
  }

  validateInputs(seed: string, controls: unknown): AtlasWorkflowResult {
    const parsedSeed = parseWorldSeed(seed);
    if (!parsedSeed.ok)
      return this.#failure(parsedSeed.diagnostic.code, parsedSeed.diagnostic.message);
    const parsedControls = parseAtlasControls(controls);
    if (!parsedControls.ok) {
      const finding = parsedControls.diagnostics[0];
      return this.#failure(
        finding?.code ?? 'atlas.controls.invalid',
        finding?.message ?? 'Atlas controls are invalid.',
      );
    }
    if (
      this.#accepted !== undefined &&
      formatWorldSeed(parsedSeed.value) !== formatWorldSeed(this.#accepted.document.worldSeed)
    ) {
      return this.#failure(
        'atlas.seed.accepted-change-requires-new-document',
        'Changing the accepted world seed requires starting a new atlas; rerolls retain it.',
      );
    }
    return Object.freeze({ ok: true });
  }

  async requestPreview(seed: string, controls: unknown): Promise<AtlasWorkflowResult> {
    const blocked = this.#rejectDuringNativeCommit();
    if (blocked !== undefined) return blocked;
    const lifecycleBlocked = this.#rejectOutsideEditingPhase();
    if (lifecycleBlocked !== undefined) return lifecycleBlocked;
    const validated = this.validateInputs(seed, controls);
    if (!validated.ok) return validated;
    const operation = this.#begin('preview');
    const request = this.#request(
      seed,
      controls as AtlasControls,
      this.#accepted === undefined ? 'initial-atlas' : 'control-driven-replacement',
      operation.operationId,
    );
    this.#generationInvocationCount += 1;
    const result = await this.#generation.preview(request, this.#runtime(operation));
    if (!this.#isCurrent(operation)) return Object.freeze({ ok: true });
    this.#finish();
    this.#diagnosticCodes = result.diagnosticCodes;
    if (!result.ok) {
      this.#statusMessage = result.message;
      return Object.freeze({
        ok: false,
        code: result.diagnosticCodes[0] ?? 'atlas.preview.failed',
        message: result.message,
      });
    }
    this.#phase = 'preview';
    this.#preview = result.preview;
    this.#pendingReroll = undefined;
    this.#statusMessage =
      'Disposable coarse preview ready. Accept full atlas runs a separate full-resolution proposal.';
    return Object.freeze({ ok: true });
  }

  async acceptFull(seed: string, controls: unknown): Promise<AtlasWorkflowResult> {
    const blocked = this.#rejectDuringNativeCommit();
    if (blocked !== undefined) return blocked;
    const lifecycleBlocked = this.#rejectOutsideEditingPhase();
    if (lifecycleBlocked !== undefined) return lifecycleBlocked;
    const validated = this.validateInputs(seed, controls);
    if (!validated.ok) return validated;
    const operation = this.#begin('full');
    const request = this.#request(
      seed,
      controls as AtlasControls,
      this.#accepted === undefined ? 'initial-atlas' : 'control-driven-replacement',
      operation.operationId,
    );
    return this.#commit(
      request,
      operation,
      'Full-resolution atlas validated and accepted atomically.',
    );
  }

  discardPreview(): AtlasWorkflowResult {
    if (this.#isBusy) {
      return this.#failure(
        'atlas.preview.operation-active',
        'Cancel the active atlas operation before discarding its preview.',
      );
    }
    if (this.#preview === undefined) {
      return this.#failure('atlas.preview.none', 'There is no disposable preview to discard.');
    }
    this.#preview = undefined;
    this.#phase = this.#accepted === undefined ? 'empty' : 'accepted';
    this.#progress = undefined;
    this.#diagnosticCodes = Object.freeze([]);
    this.#statusMessage =
      this.#accepted === undefined
        ? 'Disposable preview discarded; no atlas has been accepted.'
        : 'Disposable preview discarded; the previous accepted atlas remains active.';
    return Object.freeze({ ok: true });
  }

  planReroll(kind: AtlasRerollKind): AtlasWorkflowResult {
    const lifecycleBlocked = this.#rejectOutsideEditingPhase();
    if (lifecycleBlocked !== undefined) return lifecycleBlocked;
    if (
      this.#phase !== 'accepted' ||
      this.#accepted === undefined ||
      this.#isBusy ||
      this.#preview !== undefined
    ) {
      return this.#failure(
        'atlas.reroll.accepted-clean-state-required',
        'Accept an atlas and discard any disposable preview before planning a selective reroll.',
      );
    }
    this.#pendingReroll = atlasRerollChangeSet(kind);
    this.#statusMessage = `Review what remains fixed before committing the ${kind} reroll.`;
    return Object.freeze({ ok: true });
  }

  async commitPlannedReroll(): Promise<AtlasWorkflowResult> {
    const blocked = this.#rejectDuringNativeCommit();
    if (blocked !== undefined) return blocked;
    const lifecycleBlocked = this.#rejectOutsideEditingPhase();
    if (lifecycleBlocked !== undefined) return lifecycleBlocked;
    const pending = this.#pendingReroll;
    const accepted = this.#accepted;
    if (pending === undefined || accepted === undefined) {
      return this.#failure(
        'atlas.reroll.plan-required',
        'Preview the reroll change set before committing it.',
      );
    }
    const operation = this.#begin(`${pending.kind}-reroll`);
    const request = this.#request(
      formatWorldSeed(accepted.document.worldSeed),
      accepted.geography.controls,
      pending.kind === 'geography' ? 'geography-reroll' : 'appearance-reroll',
      operation.operationId,
    );
    return this.#commit(
      request,
      operation,
      `${pending.kind === 'geography' ? 'Geography' : 'Appearance'} reroll accepted with its declared isolation boundary intact.`,
    );
  }

  async save(targetPath: string): Promise<AtlasWorkflowResult> {
    const accepted = this.#accepted;
    const path = validateAtlasSaveTarget(targetPath);
    if (!path.ok) return this.#failure(path.code, path.message);
    if (
      accepted === undefined ||
      this.#phase !== 'accepted' ||
      this.#isBusy ||
      this.#preview !== undefined ||
      this.#acceptedCheckpoint === undefined
    ) {
      return this.#failure(
        'atlas.save.accepted-clean-state-required',
        'Accept the reviewed atlas and discard disposable preview state before saving it.',
      );
    }
    const operation = this.#begin('save');
    operation.isCancellationAllowed = false;
    this.#statusMessage =
      'Canonicalizing accepted evidence before the non-cancellable native atomic package commit.';
    const saved = await this.#persistence.save(
      this.#nativeInvoke,
      targetPath,
      path.value.targetName,
      accepted,
      this.#acceptedCheckpoint,
    );
    if (!this.#isCurrent(operation)) return Object.freeze({ ok: true });
    this.#finish();
    if (!saved.ok) return this.#failure(saved.code, saved.message);
    this.#phase = 'saved';
    this.#targetPath = targetPath;
    this.#savedEvidence = saved.value.evidence;
    this.#reopenedEvidence = undefined;
    this.#reopenComparison = undefined;
    this.#savedManifestSha256 = saved.value.manifestSha256;
    this.#reopenedManifestSha256 = undefined;
    this.#reopenGenerationInvocationCount = undefined;
    this.#diagnosticCodes = Object.freeze([]);
    this.#statusMessage = `Accepted atlas saved through the native ${saved.value.platform} boundary. Unload it before reopening.`;
    return Object.freeze({ ok: true });
  }

  close(): AtlasWorkflowResult {
    if (
      this.#phase !== 'saved' ||
      this.#isBusy ||
      this.#accepted === undefined ||
      this.#savedEvidence === undefined ||
      this.#savedManifestSha256 === undefined
    ) {
      return this.#failure(
        'atlas.close.save-required',
        'Save the accepted atlas before unloading its document and RenderScene.',
      );
    }
    this.#accepted = undefined;
    this.#preview = undefined;
    this.#pendingReroll = undefined;
    this.#pngExportReceipt = undefined;
    this.#svgExportReceipt = undefined;
    this.#phase = 'closed';
    this.#acceptedCheckpoint = undefined;
    this.#diagnosticCodes = Object.freeze([]);
    this.#statusMessage =
      'Atlas unloaded: no accepted document, RenderScene, preview, or export intermediate remains active.';
    return Object.freeze({ ok: true });
  }

  async reopen(): Promise<AtlasWorkflowResult> {
    if (this.#phase !== 'closed' || this.#targetPath.length === 0 || this.#isBusy) {
      return this.#failure(
        'atlas.reopen.closed-state-required',
        'Unload a successfully saved atlas before reopening it from native authoritative bytes.',
      );
    }
    const savedEvidence = this.#savedEvidence;
    const savedManifestSha256 = this.#savedManifestSha256;
    if (savedEvidence === undefined || savedManifestSha256 === undefined) {
      return this.#failure(
        'atlas.reopen.audit-missing',
        'Saved semantic and authoritative-package evidence is unavailable.',
      );
    }
    const generationCountBefore = this.#generationInvocationCount;
    const operation = this.#begin('reopen');
    operation.isCancellationAllowed = false;
    this.#statusMessage =
      'Reopening native authoritative bytes with the generator-free restoration path armed.';
    const reopened = await this.#persistence.reopen(
      this.#nativeInvoke,
      this.#targetPath,
      savedEvidence,
      savedManifestSha256,
    );
    if (!this.#isCurrent(operation)) return Object.freeze({ ok: true });
    if (!reopened.ok) {
      this.#finish();
      return this.#failure(reopened.code, reopened.message);
    }
    this.#reopenGenerationInvocationCount = this.#generationInvocationCount - generationCountBefore;
    if (this.#reopenGenerationInvocationCount !== 0) {
      this.#finish();
      return this.#failure(
        'atlas.reopen.evidence-mismatch',
        'The generator-free reopen tripwire observed an unexpected generation call.',
      );
    }
    this.#accepted = reopened.value.accepted;
    this.#controls = reopened.value.accepted.geography.controls;
    this.#acceptedCheckpoint = 'reopened';
    this.#reopenedEvidence = reopened.value.evidence;
    this.#reopenComparison = reopened.value.comparison;
    this.#reopenedManifestSha256 = reopened.value.manifestSha256;
    this.#finish();
    this.#phase = 'reopened';
    this.#diagnosticCodes = Object.freeze([]);
    this.#statusMessage =
      'Reopened exact accepted atlas from native bytes with zero generator calls; SVG and PNG export are ready.';
    return Object.freeze({ ok: true });
  }

  async exportSvg(targetPath?: string): Promise<AtlasWorkflowResult> {
    if (
      this.#phase !== 'reopened' ||
      this.#accepted === undefined ||
      this.#isBusy ||
      this.#preview !== undefined
    ) {
      return this.#failure(
        'atlas-svg.accepted-clean-state-required',
        'Reopen the saved atlas and discard disposable preview state before exporting SVG.',
      );
    }
    const acceptedBefore = this.#accepted;
    const operation = this.#begin('svg-export');
    const result = await exportAcceptedAtlasSvg(
      acceptedBefore,
      targetPath,
      {
        operationId: operation.operationId,
        isCancellationRequested: () => operation.isCancellationRequested,
        reportProgress: (progress: AtlasSvgWorkflowProgress) => {
          if (this.#isCurrent(operation)) this.#progress = progress;
        },
        yieldControl: () => new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0)),
        beginNativeCommit: () => {
          operation.isCancellationAllowed = false;
          this.#statusMessage =
            'Canonical SVG verified; the atomic destination commit is now non-cancellable.';
        },
      },
      this.#svgDestination,
    );
    if (!this.#isCurrent(operation)) return Object.freeze({ ok: true });
    this.#finish();
    this.#accepted = acceptedBefore;
    if (!result.ok) {
      this.#diagnosticCodes = result.diagnosticCodes;
      this.#statusMessage = result.message;
      return Object.freeze({
        ok: false,
        code: result.diagnosticCodes[0] ?? 'atlas-svg.export.failed',
        message: result.message,
      });
    }
    this.#svgExportReceipt = result.receipt;
    this.#diagnosticCodes = Object.freeze([]);
    this.#statusMessage = `Deterministic SVG written and verified at ${result.receipt.targetPath}.`;
    return Object.freeze({ ok: true });
  }

  async exportPng(targetPath?: string): Promise<AtlasWorkflowResult> {
    if (
      this.#phase !== 'reopened' ||
      this.#accepted === undefined ||
      this.#isBusy ||
      this.#preview !== undefined
    ) {
      return this.#failure(
        'atlas-png.accepted-clean-state-required',
        'Reopen the saved atlas and discard disposable preview state before exporting PNG.',
      );
    }
    const acceptedBefore = this.#accepted;
    const operation = this.#begin('png-export');
    const result = await exportAcceptedAtlasPng(
      acceptedBefore,
      targetPath,
      {
        operationId: operation.operationId,
        isCancellationRequested: () => operation.isCancellationRequested,
        reportProgress: (progress: AtlasPngWorkflowProgress) => {
          if (this.#isCurrent(operation)) this.#progress = progress;
        },
        yieldControl: () => new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0)),
        beginNativeCommit: () => {
          operation.isCancellationAllowed = false;
          this.#statusMessage =
            'Canonical PNG verified; the atomic destination commit is now non-cancellable.';
        },
      },
      this.#pngDestination,
    );
    if (!this.#isCurrent(operation)) return Object.freeze({ ok: true });
    this.#finish();
    this.#accepted = acceptedBefore;
    if (!result.ok) {
      this.#diagnosticCodes = result.diagnosticCodes;
      this.#statusMessage = result.message;
      return Object.freeze({
        ok: false,
        code: result.diagnosticCodes[0] ?? 'atlas-png.export.failed',
        message: result.message,
      });
    }
    this.#pngExportReceipt = result.receipt;
    this.#diagnosticCodes = Object.freeze([]);
    this.#statusMessage = `Deterministic PNG written and verified at ${result.receipt.targetPath}.`;
    return Object.freeze({ ok: true });
  }

  cancelActiveOperation(): AtlasWorkflowResult {
    if (this.#active === undefined) {
      return this.#failure(
        'atlas.operation.none-active',
        'There is no active atlas operation to cancel.',
      );
    }
    if (!this.#active.isCancellationAllowed) {
      const { code, message } = nativeCommitDiagnostic(this.#active, 'cancel');
      return this.#failure(code, message);
    }
    this.#active.isCancellationRequested = true;
    this.#statusMessage = 'Cancellation requested; the previous accepted atlas remains active.';
    return Object.freeze({ ok: true });
  }

  async #commit(
    request: AtlasWorkflowGenerationRequest,
    operation: ActiveOperation,
    successMessage: string,
  ): Promise<AtlasWorkflowResult> {
    const acceptedBefore = this.#accepted;
    this.#generationInvocationCount += 1;
    const result = await this.#generation.commit(request, this.#runtime(operation));
    if (!this.#isCurrent(operation)) return Object.freeze({ ok: true });
    this.#finish();
    this.#diagnosticCodes = result.ok ? Object.freeze([]) : result.diagnosticCodes;
    if (!result.ok) {
      this.#accepted = acceptedBefore;
      if (this.#progress !== undefined) {
        this.#progress = Object.freeze({
          ...this.#progress,
          stage: result.isCancelled ? 'cancelled' : 'failed',
          isCancellationRequested: result.isCancelled,
          isTerminal: true,
        });
      }
      this.#statusMessage = result.message;
      return Object.freeze({
        ok: false,
        code: result.diagnosticCodes[0] ?? 'atlas.operation.failed',
        message: result.message,
      });
    }
    this.#accepted = result.accepted;
    this.#pngExportReceipt = undefined;
    this.#svgExportReceipt = undefined;
    this.#savedEvidence = undefined;
    this.#reopenedEvidence = undefined;
    this.#reopenComparison = undefined;
    this.#savedManifestSha256 = undefined;
    this.#reopenedManifestSha256 = undefined;
    this.#targetPath = '';
    this.#reopenGenerationInvocationCount = undefined;
    this.#controls = request.controls;
    this.#phase = 'accepted';
    this.#acceptedCheckpoint =
      request.operation === 'initial-atlas'
        ? 'baseline'
        : request.operation === 'geography-reroll'
          ? 'geography-rerolled'
          : request.operation === 'appearance-reroll'
            ? 'appearance-rerolled'
            : 'baseline';
    this.#preview = undefined;
    this.#pendingReroll = undefined;
    this.#statusMessage = successMessage;
    return Object.freeze({ ok: true });
  }

  #request(
    worldSeed: string,
    controls: AtlasControls,
    operation: AtlasWorkflowOperation,
    operationId: string,
  ): AtlasWorkflowGenerationRequest {
    return Object.freeze({
      operationId,
      operation,
      worldSeed,
      controls: Object.freeze({ ...controls }),
      accepted: this.#accepted,
    });
  }

  #begin(label: string): ActiveOperation {
    if (this.#active !== undefined) this.#active.isCancellationRequested = true;
    const sequence = ++this.#operationSequence;
    const operation = {
      sequence,
      operationId: `atlas:${label}:${String(sequence)}`,
      label,
      isCancellationRequested: false,
      isCancellationAllowed: true,
    };
    this.#active = operation;
    this.#isBusy = true;
    this.#progress = undefined;
    this.#diagnosticCodes = Object.freeze([]);
    this.#statusMessage = `${label} operation in progress.`;
    return operation;
  }

  #runtime(operation: ActiveOperation) {
    return Object.freeze({
      isCancellationRequested: () => operation.isCancellationRequested,
      reportProgress: (progress: AtlasGenerationProgress) => {
        if (this.#isCurrent(operation)) this.#progress = progress;
      },
      yieldControl: () => new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0)),
    });
  }

  #isCurrent(operation: ActiveOperation): boolean {
    return this.#active?.sequence === operation.sequence;
  }

  #finish(): void {
    this.#active = undefined;
    this.#isBusy = false;
  }

  #rejectDuringNativeCommit(): AtlasWorkflowResult | undefined {
    if (this.#active?.isCancellationAllowed !== false) return undefined;
    const { code, message } = nativeCommitDiagnostic(this.#active, 'start');
    return this.#failure(code, message);
  }

  #rejectOutsideEditingPhase(): AtlasWorkflowResult | undefined {
    const diagnostic = atlasEditingPhaseDiagnostic(this.#phase);
    return diagnostic === undefined
      ? undefined
      : this.#failure(diagnostic.code, diagnostic.message);
  }

  #failure(code: string, message: string): AtlasWorkflowResult {
    this.#diagnosticCodes = Object.freeze([code]);
    this.#statusMessage = `${code}: ${message}`;
    return Object.freeze({ ok: false, code, message });
  }
}

function nativeCommitDiagnostic(
  operation: ActiveOperation,
  action: 'cancel' | 'start',
): { readonly code: string; readonly message: string } {
  if (operation.label === 'save' || operation.label === 'reopen') {
    const actionLabel = operation.label === 'save' ? 'save commit' : 'recovery read/apply';
    return Object.freeze({
      code: `atlas.${operation.label}.native-operation-non-cancellable`,
      message:
        action === 'cancel'
          ? `The native ${actionLabel} is already active and cannot be cancelled safely.`
          : `The native ${actionLabel} is active; wait for its validated result before starting other work.`,
    });
  }
  const isPng = operation.label === 'png-export';
  const format = isPng ? 'PNG' : 'SVG';
  const code = isPng ? 'atlas-png.commit.non-cancellable' : 'atlas-svg.commit.non-cancellable';
  const message =
    action === 'cancel'
      ? `The verified ${format} is already in its atomic destination commit and can no longer be cancelled safely.`
      : `The verified ${format} is already in its atomic destination commit; wait for its verified result before starting other work.`;
  return Object.freeze({ code, message });
}
