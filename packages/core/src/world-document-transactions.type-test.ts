import type { VariantRevision } from './compatibility.js';
import type { AspectReplacementProposal } from './generated-aspects.js';
import type { AspectId, EntityId, MapId } from './identity.js';
import type {
  CommitAspectProposalCommand,
  DocumentDependencyEffect,
} from './world-document-transaction-model.js';

declare const aspectId: AspectId;
declare const entityId: EntityId;
declare const mapId: MapId;
declare const proposal: AspectReplacementProposal;
declare const revision: VariantRevision;
declare const command: CommitAspectProposalCommand;
declare const effect: DocumentDependencyEffect;

// @ts-expect-error A document command cannot be redirected after validation.
command.target.aspectId = aspectId;
// @ts-expect-error Optimistic concurrency metadata is immutable.
command.expectedPreviousRevision = revision;
// @ts-expect-error Proposed accepted output is deeply readonly.
command.proposedReplacement.output = {};
// @ts-expect-error Dependency-effect selection cannot be changed during commit.
command.declaredDependencyEffects = [];
// @ts-expect-error A dependent aspect ID is not a containing map ID.
effect.aspectId = mapId;

void [aspectId, command, effect, entityId, mapId, proposal, revision];
