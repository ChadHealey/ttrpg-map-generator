/** Complete-proposal transaction records for the Milestone 2 atlas workflow. */

import type { AtlasControls } from './atlas-geography-model.js';
import type { VariantRevision } from './compatibility.js';
import type { AspectReplacementProposal } from './generated-aspects.js';
import type { AspectId, EntityId, LockId, MapId } from './identity.js';
import type { MapEntity, WorldDocument, WorldMapCoordinateSystem } from './world-document.js';

export const ATLAS_DOCUMENT_COMMAND_KIND = 'commit-atlas-proposal' as const;

export const ATLAS_DOCUMENT_OPERATION_MODES = Object.freeze({
  initial: 'initial-atlas',
  controls: 'control-driven-replacement',
  geographyReroll: 'geography-reroll',
  appearanceReroll: 'appearance-reroll',
} as const);

export type AtlasDocumentOperationMode =
  (typeof ATLAS_DOCUMENT_OPERATION_MODES)[keyof typeof ATLAS_DOCUMENT_OPERATION_MODES];

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
