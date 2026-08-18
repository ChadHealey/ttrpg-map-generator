/** Public snapshot and result vocabulary for the Milestone 2 desktop atlas workflow. */

import type { AtlasControls } from '@ttrpg-map/core';
import type { AtlasLandWaterPreview } from '@ttrpg-map/generation';

import type { AtlasPngWorkflowReceipt } from './atlas-png-export-orchestrator.js';
import type { AtlasSvgWorkflowReceipt } from './atlas-svg-export-orchestrator.js';
import type {
  AtlasAcceptedCheckpoint,
  AtlasAcceptedEvidence,
  AtlasReopenComparison,
} from './atlas-workflow-evidence.js';
import type { AcceptedAtlasState } from './atlas-workflow-generation.js';

export type AtlasWorkflowPhase = 'empty' | 'preview' | 'accepted' | 'saved' | 'closed' | 'reopened';
export type AtlasRerollKind = 'geography' | 'appearance';

export interface AtlasEditingPhaseDiagnostic {
  readonly code:
    | 'atlas.workflow.saved-unload-required'
    | 'atlas.workflow.closed-reopen-required'
    | 'atlas.workflow.reopened-read-only';
  readonly message: string;
}

export function isAtlasEditingPhase(
  phase: AtlasWorkflowPhase,
): phase is 'empty' | 'preview' | 'accepted' {
  return phase === 'empty' || phase === 'preview' || phase === 'accepted';
}

export function atlasEditingPhaseDiagnostic(
  phase: AtlasWorkflowPhase,
): AtlasEditingPhaseDiagnostic | undefined {
  if (phase === 'saved') {
    return Object.freeze({
      code: 'atlas.workflow.saved-unload-required',
      message: 'The accepted package is saved; unload it before editing or exporting.',
    });
  }
  if (phase === 'closed') {
    return Object.freeze({
      code: 'atlas.workflow.closed-reopen-required',
      message: 'The atlas is unloaded; reopen its native authoritative package before continuing.',
    });
  }
  if (phase === 'reopened') {
    return Object.freeze({
      code: 'atlas.workflow.reopened-read-only',
      message:
        'The reopened proof checkpoint is read-only: export it or begin a separate atlas in a new application session.',
    });
  }
  return undefined;
}

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

export interface AtlasWorkflowProgress {
  readonly operationId: string;
  readonly stage: string;
  readonly completedWork: number;
  readonly totalWork: number;
  readonly isCancellationRequested: boolean;
  readonly isTerminal: boolean;
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
  readonly acceptedCheckpoint: AtlasAcceptedCheckpoint | undefined;
  readonly savedEvidence: AtlasAcceptedEvidence | undefined;
  readonly reopenedEvidence: AtlasAcceptedEvidence | undefined;
  readonly reopenComparison: AtlasReopenComparison | undefined;
  readonly savedManifestSha256: string | undefined;
  readonly reopenedManifestSha256: string | undefined;
  readonly targetPath: string;
  readonly generationInvocationCount: number;
  readonly reopenGenerationInvocationCount: number | undefined;
  readonly pendingReroll: AtlasRerollChangeSet | undefined;
  readonly diagnosticCodes: readonly string[];
  readonly statusMessage: string;
  readonly inspectionEntities: readonly AtlasInspectionEntity[];
}

export type AtlasWorkflowResult =
  { readonly ok: true } | { readonly ok: false; readonly code: string; readonly message: string };
