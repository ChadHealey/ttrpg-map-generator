/** Immutable command, dependency-effect, and result records for accepted-aspect transactions. */

import type { AspectInvalidationEffect } from './aspect-dependency-model.js';
import type { VariantRevision } from './compatibility.js';
import type { AspectReplacementProposal, GenerationDiagnostic } from './generated-aspects.js';
import type { AspectId, EntityId, LockId, MapId } from './identity.js';
import type { WorldDocument } from './world-document.js';

export const DOCUMENT_COMMAND_KINDS = {
  commitAspectProposal: 'commit-aspect-proposal',
} as const;

export const DOCUMENT_DEPENDENCY_EFFECT_KINDS = {
  replace: 'replace',
} as const;

export const DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES = {
  conflictingLock: 'document-transaction.lock.conflict',
  cyclicDependencyEffect: 'document-transaction.dependency-effect.cycle',
  invalidDependencyEffect: 'document-transaction.dependency-effect.invalid',
  invalidDocument: 'document-transaction.document.invalid',
  invalidProposal: 'document-transaction.proposal.invalid',
  staleRevision: 'document-transaction.revision.stale',
  targetNotFound: 'document-transaction.target.not-found',
} as const;

export type DocumentTransactionDiagnosticCode =
  (typeof DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES)[keyof typeof DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES];

/** Stable address repeated by the command so proposal redirection can be rejected. */
export interface DocumentAspectTarget {
  readonly mapId: MapId;
  readonly entityId: EntityId;
  readonly aspectId: AspectId;
}

/** One proposed accepted-record replacement with optimistic revision concurrency. */
export interface AspectProposalCommit {
  readonly target: DocumentAspectTarget;
  readonly expectedPreviousRevision: VariantRevision;
  readonly proposedReplacement: AspectReplacementProposal;
  readonly diagnostics: readonly GenerationDiagnostic[];
}

/** A downstream aspect retained while the transaction reports its query-time effect. */
export interface RetainedDocumentDependencyEffect {
  readonly aspectId: AspectId;
  readonly effect: AspectInvalidationEffect;
}

/** A downstream aspect explicitly selected for replacement in the same atomic transaction. */
export interface ReplacementDocumentDependencyEffect {
  readonly aspectId: AspectId;
  readonly effect: typeof DOCUMENT_DEPENDENCY_EFFECT_KINDS.replace;
  readonly commit: AspectProposalCommit;
}

export type DocumentDependencyEffect =
  RetainedDocumentDependencyEffect | ReplacementDocumentDependencyEffect;

/** The named command that accepts one primary proposal and declares every downstream effect. */
export interface CommitAspectProposalCommand extends AspectProposalCommit {
  readonly kind: typeof DOCUMENT_COMMAND_KINDS.commitAspectProposal;
  readonly declaredDependencyEffects: readonly DocumentDependencyEffect[];
}

/** A deterministic, actionable rejection from the document transaction boundary. */
export interface DocumentTransactionDiagnostic {
  readonly code: DocumentTransactionDiagnosticCode;
  readonly target: DocumentAspectTarget;
  readonly aspectIds: readonly AspectId[];
  readonly lockIds: readonly LockId[];
  readonly message: string;
  readonly suggestedAction: string;
}

export type CommitAspectProposalResult =
  | {
      readonly ok: true;
      readonly document: WorldDocument;
      readonly committedAspectIds: readonly AspectId[];
      readonly dependencyEffects: readonly DocumentDependencyEffect[];
    }
  | {
      readonly ok: false;
      /** The exact input reference; a rejection never exposes partial candidate state. */
      readonly document: WorldDocument;
      readonly diagnostics: readonly DocumentTransactionDiagnostic[];
    };
