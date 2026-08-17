import type { CommitAtlasProposalCommand } from './atlas-document-transaction-model.js';
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
declare const atlasCommand: CommitAtlasProposalCommand;

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
// @ts-expect-error Complete topology membership cannot change after proposal validation.
atlasCommand.proposedEntities = [];
// @ts-expect-error Explicit reroll targets are immutable transaction metadata.
atlasCommand.explicitlyIncrementedAspectIds = [];

void [aspectId, atlasCommand, command, effect, entityId, mapId, proposal, revision];
