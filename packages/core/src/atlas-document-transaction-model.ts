/** Complete-proposal transaction records for the Milestone 2 atlas workflow. */

import type { AtlasControls } from './atlas-geography-model.js';
import type { VariantRevision } from './compatibility.js';
import type { AspectReplacementProposal } from './generated-aspects.js';
import type { AspectId, EntityId, LockId, MapId } from './identity.js';
import type { MapEntity, WorldDocument, WorldMapCoordinateSystem } from './world-document.js';
import type { WorldPhysicalContextControls } from './world-physical-context-model.js';

export const ATLAS_DOCUMENT_COMMAND_KIND = 'commit-atlas-proposal' as const;
export const ATLAS_PHYSICAL_DOCUMENT_COMMAND_KIND = 'commit-atlas-physical-proposal' as const;
export const ATLAS_LABEL_DOCUMENT_COMMAND_KIND = 'commit-atlas-label-proposal' as const;

export const ATLAS_DOCUMENT_OPERATION_MODES = Object.freeze({
  initial: 'initial-atlas',
  controls: 'control-driven-replacement',
  geographyReroll: 'geography-reroll',
  appearanceReroll: 'appearance-reroll',
} as const);

export type AtlasDocumentOperationMode =
  (typeof ATLAS_DOCUMENT_OPERATION_MODES)[keyof typeof ATLAS_DOCUMENT_OPERATION_MODES];

export const ATLAS_PHYSICAL_DOCUMENT_OPERATION_MODES = Object.freeze({
  initial: 'initial-physical-atlas',
  controls: 'physical-control-driven-replacement',
  aspectReroll: 'physical-aspect-reroll',
} as const);

export type AtlasPhysicalDocumentOperationMode =
  (typeof ATLAS_PHYSICAL_DOCUMENT_OPERATION_MODES)[keyof typeof ATLAS_PHYSICAL_DOCUMENT_OPERATION_MODES];

export const ATLAS_LABEL_DOCUMENT_OPERATION_MODES = Object.freeze({
  initial: 'initial-atlas-labels',
  replacement: 'atlas-label-replacement',
} as const);

export type AtlasLabelDocumentOperationMode =
  (typeof ATLAS_LABEL_DOCUMENT_OPERATION_MODES)[keyof typeof ATLAS_LABEL_DOCUMENT_OPERATION_MODES];

export const ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES = Object.freeze({
  conflictingConstraint: 'atlas-transaction.constraint.conflict',
  conflictingLock: 'atlas-transaction.lock.conflict',
  invalidDocument: 'atlas-transaction.document.invalid',
  invalidOperation: 'atlas-transaction.operation.invalid',
  invalidProposal: 'atlas-transaction.proposal.invalid',
  noVisibleAlternative: 'atlas-transaction.alternative.not-visible',
  staleInput: 'atlas-transaction.input.stale',
  targetNotFound: 'atlas-transaction.target.not-found',
} as const);

export type AtlasDocumentTransactionDiagnosticCode =
  (typeof ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES)[keyof typeof ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES];

export interface ExpectedAtlasAspectRevision {
  readonly aspectId: AspectId;
  readonly variantRevision: VariantRevision;
}

/** One complete, unaccepted root-map replacement assembled from generator proposals. */
export interface CommitAtlasProposalCommand {
  readonly kind: typeof ATLAS_DOCUMENT_COMMAND_KIND;
  readonly operationMode: AtlasDocumentOperationMode;
  readonly targetMapId: MapId;
  readonly expectedWorldSeed: WorldDocument['worldSeed'];
  readonly expectedAspectRevisions: readonly ExpectedAtlasAspectRevision[];
  readonly controls: AtlasControls;
  readonly proposedCoordinateSystem: WorldMapCoordinateSystem;
  readonly proposedEntities: readonly MapEntity[];
  readonly proposedAspects: readonly AspectReplacementProposal[];
  readonly explicitlyIncrementedAspectIds: readonly AspectId[];
}

/** One complete nine-aspect M3 proposal assembled from the accepted M2 root atlas. */
export interface CommitAtlasPhysicalProposalCommand {
  readonly kind: typeof ATLAS_PHYSICAL_DOCUMENT_COMMAND_KIND;
  readonly operationMode: AtlasPhysicalDocumentOperationMode;
  readonly targetMapId: MapId;
  readonly expectedWorldSeed: WorldDocument['worldSeed'];
  readonly expectedAspectRevisions: readonly ExpectedAtlasAspectRevision[];
  readonly controls: WorldPhysicalContextControls;
  readonly proposedAspects: readonly AspectReplacementProposal[];
  readonly explicitlyIncrementedAspectIds: readonly AspectId[];
}

/** One complete name set and its resolved placement subset for the accepted root atlas. */
export interface CommitAtlasLabelProposalCommand {
  readonly kind: typeof ATLAS_LABEL_DOCUMENT_COMMAND_KIND;
  readonly operationMode: AtlasLabelDocumentOperationMode;
  readonly targetMapId: MapId;
  readonly expectedWorldSeed: WorldDocument['worldSeed'];
  readonly expectedAspectRevisions: readonly ExpectedAtlasAspectRevision[];
  readonly proposedAspects: readonly AspectReplacementProposal[];
  readonly explicitlyIncrementedAspectIds: readonly AspectId[];
}

export interface AtlasDocumentTransactionDiagnostic {
  readonly code: AtlasDocumentTransactionDiagnosticCode;
  readonly aspectIds: readonly AspectId[];
  readonly entityIds: readonly EntityId[];
  readonly lockIds: readonly LockId[];
  readonly message: string;
  readonly suggestedAction: string;
}

export type CommitAtlasProposalResult =
  | {
      readonly ok: true;
      readonly document: WorldDocument;
      readonly committedAspectIds: readonly AspectId[];
      readonly addedEntityIds: readonly EntityId[];
      readonly removedEntityIds: readonly EntityId[];
    }
  | {
      readonly ok: false;
      /** Rejection returns the exact accepted input reference. */
      readonly document: WorldDocument;
      readonly diagnostics: readonly AtlasDocumentTransactionDiagnostic[];
    };

export type CommitAtlasPhysicalProposalResult =
  | {
      readonly ok: true;
      readonly document: WorldDocument;
      readonly committedAspectIds: readonly AspectId[];
    }
  | {
      readonly ok: false;
      /** Rejection returns the exact accepted input reference. */
      readonly document: WorldDocument;
      readonly diagnostics: readonly AtlasDocumentTransactionDiagnostic[];
    };

export type CommitAtlasLabelProposalResult =
  | {
      readonly ok: true;
      readonly document: WorldDocument;
      readonly committedAspectIds: readonly AspectId[];
      readonly addedEntityIds: readonly EntityId[];
    }
  | {
      readonly ok: false;
      /** Rejection returns the exact accepted input reference. */
      readonly document: WorldDocument;
      readonly diagnostics: readonly AtlasDocumentTransactionDiagnostic[];
    };
