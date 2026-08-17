/** User-facing Milestone 2 atlas preview, acceptance, reroll, and inspection workflow. */

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
import {
  type AcceptedAtlasState,
  type AtlasWorkflowGenerationPort,
  type AtlasWorkflowGenerationRequest,
  type AtlasWorkflowOperation,
  productionAtlasWorkflowGeneration,
} from './atlas-workflow-generation.js';
import { atlasInspectionEntities, atlasRerollChangeSet } from './atlas-workflow-presentation.js';

export const MILESTONE_TWO_ATLAS_PROOF_SEED = '81985529216486895' as const;

export type AtlasWorkflowPhase = 'empty' | 'preview' | 'accepted';
export type AtlasRerollKind = 'geography' | 'appearance';

export interface AtlasRerollChangeSet {
  readonly kind: AtlasRerollKind;
  readonly remainsFixed: readonly string[];
  readonly changes: readonly string[];
}

export interface AtlasInspectionEntity {
  readonly entityId: string;
  readonly kind: string;
  readonly relationshipSummary: string;
}

export interface AtlasWorkflowSnapshot {
  readonly phase: AtlasWorkflowPhase;
  readonly controls: AtlasControls;
  readonly accepted: AcceptedAtlasState | undefined;
  readonly scene: AcceptedAtlasState['scene'] | undefined;
  readonly preview: AtlasLandWaterPreview | undefined;
  readonly isPreviewState: boolean;
  readonly isBusy: boolean;
  readonly isCancellationAllowed: boolean;
  readonly progress: AtlasWorkflowProgress | undefined;
  readonly pngExportReceipt: AtlasPngWorkflowReceipt | undefined;
  readonly svgExportReceipt: AtlasSvgWorkflowReceipt | undefined;
  readonly pendingReroll: AtlasRerollChangeSet | undefined;
  readonly diagnosticCodes: readonly string[];
  readonly statusMessage: string;
  readonly inspectionEntities: readonly AtlasInspectionEntity[];
}

export type AtlasWorkflowResult =
  { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string };

interface ActiveOperation {
  readonly sequence: number;
  readonly operationId: string;
  readonly label: string;
  isCancellationRequested: boolean;
  isCancellationAllowed: boolean;
}

export interface AtlasWorkflowProgress {
  readonly operationId: string;
  readonly stage: string;
  readonly completedWork: number;
  readonly totalWork: number;
  readonly isCancellationRequested: boolean;
  readonly isTerminal: boolean;
}

export class AtlasWorkflow {
  readonly #generation: AtlasWorkflowGenerationPort;
  readonly #pngDestination: AtlasPngDestinationPort;
  readonly #svgDestination: AtlasSvgDestinationPort;
  #phase: AtlasWorkflowPhase = 'empty';
  #controls: AtlasControls = DEFAULT_ATLAS_CONTROLS;
  #accepted: AcceptedAtlasState | undefined;
  #preview: AtlasLandWaterPreview | undefined;
  #isBusy = false;
  #progress: AtlasWorkflowProgress | undefined;
  #pngExportReceipt: AtlasPngWorkflowReceipt | undefined;
  #svgExportReceipt: AtlasSvgWorkflowReceipt | undefined;
  #pendingReroll: AtlasRerollChangeSet | undefined;
  #diagnosticCodes: readonly string[] = Object.freeze([]);
  #statusMessage = 'Configure a seed and request a disposable coarse preview.';
  #active: ActiveOperation | undefined;
  #operationSequence = 0;

  constructor(
    generation: AtlasWorkflowGenerationPort = productionAtlasWorkflowGeneration,
    svgDestination: AtlasSvgDestinationPort = productionAtlasSvgDestination,
    pngDestination: AtlasPngDestinationPort = productionAtlasPngDestination,
  ) {
    this.#generation = generation;
    this.#svgDestination = svgDestination;
    this.#pngDestination = pngDestination;
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
    const validated = this.validateInputs(seed, controls);
    if (!validated.ok) return validated;
    const operation = this.#begin('preview');
    const request = this.#request(
      seed,
      controls as AtlasControls,
      this.#accepted === undefined ? 'initial-atlas' : 'control-driven-replacement',
      operation.operationId,
    );
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
    if (this.#accepted === undefined || this.#isBusy || this.#preview !== undefined) {
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

  async exportSvg(targetPath?: string): Promise<AtlasWorkflowResult> {
    if (this.#accepted === undefined || this.#isBusy || this.#preview !== undefined) {
      return this.#failure(
        'atlas-svg.accepted-clean-state-required',
        'Accept or reopen an atlas and discard disposable preview state before exporting SVG.',
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
    if (this.#accepted === undefined || this.#isBusy || this.#preview !== undefined) {
      return this.#failure(
        'atlas-png.accepted-clean-state-required',
        'Accept or reopen an atlas and discard disposable preview state before exporting PNG.',
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
    this.#controls = request.controls;
    this.#phase = 'accepted';
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
  const isPng = operation.label === 'png-export';
  const format = isPng ? 'PNG' : 'SVG';
  const code = isPng ? 'atlas-png.commit.non-cancellable' : 'atlas-svg.commit.non-cancellable';
  const message =
    action === 'cancel'
      ? `The verified ${format} is already in its atomic destination commit and can no longer be cancelled safely.`
      : `The verified ${format} is already in its atomic destination commit; wait for its verified result before starting other work.`;
  return Object.freeze({ code, message });
}
