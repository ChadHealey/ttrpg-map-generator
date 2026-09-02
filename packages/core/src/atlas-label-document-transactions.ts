/** Atomic acceptance of complete world-feature name and atlas-label placement proposal sets. */

import { createAspectDependencyGraph } from './aspect-dependency-graph.js';
import { reconstructAcceptedAtlas } from './atlas-accepted-state.js';
import { acceptAtlasProposals } from './atlas-document-proposal-validation.js';
import {
  ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES,
  ATLAS_LABEL_DOCUMENT_COMMAND_KIND,
  ATLAS_LABEL_DOCUMENT_OPERATION_MODES,
  type AtlasDocumentTransactionDiagnostic,
  type CommitAtlasLabelProposalCommand,
  type CommitAtlasLabelProposalResult,
} from './atlas-document-transaction-model.js';
import { isAtlasLabelAcceptedAspectName } from './atlas-label-accepted-state.js';
import { incrementVariantRevision } from './compatibility.js';
import type { AcceptedAspectRecord, AspectReplacementProposal } from './generated-aspects.js';
import { type AspectId, compareStableReferences, type EntityId } from './identity.js';
import { createImmutableDomainSnapshot } from './immutable-domain-snapshot.js';
import { DETERMINISTIC_STREAM_VERSION, SEED_DERIVATION_VERSION } from './seed-input.js';
import type { MapEntity, WorldDocument, WorldMap } from './world-document.js';
import { validateWorldDocumentOwnership } from './world-document-ownership.js';
import { deepEqual } from './world-document-transaction-support.js';
import { collectWorldFeatureNameSources } from './world-feature-name-model.js';

/** Commit a complete name set and its resolved placement subset, or return the exact input. */
export function commitAtlasLabelProposal(
  document: WorldDocument,
  command: CommitAtlasLabelProposalCommand,
): CommitAtlasLabelProposalResult {
  const diagnostics: AtlasDocumentTransactionDiagnostic[] = [];
  const currentMap = document.maps.find(({ mapId }) => mapId === command.targetMapId);
  if (currentMap?.mapKind !== 'world' || currentMap.mapId !== document.rootMapId) {
    return reject(
      document,
      diagnostics,
      diagnostic(
        ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.targetNotFound,
        [],
        [],
        'The label proposal target is not the accepted root world map.',
        'Refresh the workflow and target the current root WorldMap identity.',
      ),
    );
  }
  const accepted = reconstructAcceptedAtlas(document);
  if (
    accepted.status !== 'accepted' ||
    accepted.value.physical === undefined ||
    validateWorldDocumentOwnership(document).length > 0 ||
    !createAspectDependencyGraph(document).ok
  ) {
    return reject(
      document,
      diagnostics,
      diagnostic(
        ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.invalidDocument,
        [],
        [],
        'The accepted physical atlas is invalid and cannot receive names or placements.',
        'Restore a complete accepted M3 physical atlas before retrying.',
      ),
    );
  }

  validateStaleBoundary(document, currentMap, command, diagnostics);
  validateProposalAddresses(document, currentMap, accepted.value, command, diagnostics);
  if (diagnostics.length > 0) return rejection(document, diagnostics);
  const proposed = acceptAtlasProposals(command.proposedAspects, diagnostics);
  if (proposed === undefined) return rejection(document, diagnostics);
  validateOperation(currentMap, proposed, command, diagnostics);
  validateLocksAndConstraints(currentMap, proposed, diagnostics);
  if (diagnostics.length > 0) return rejection(document, diagnostics);

  const currentById = new Map(currentMap.aspects.map((aspect) => [aspect.aspectId, aspect]));
  const committed = proposed.map((aspect) => {
    const previous = currentById.get(aspect.aspectId);
    return previous !== undefined && deepEqual(previous, aspect) ? previous : aspect;
  });
  const proposedNameByEntity = new Map(
    committed
      .filter(({ aspectName }) => aspectName === 'worldFeature.nameContent')
      .map((aspect) => [aspect.entityId, aspect] as const),
  );
  const addedEntities: MapEntity[] = [];
  const entities = [...currentMap.entities];
  for (const source of collectWorldFeatureNameSources(
    accepted.value.geography,
    accepted.value.physical,
  )) {
    if (!proposedNameByEntity.has(source.entityId)) continue;
    if (entities.some(({ entityId }) => entityId === source.entityId)) continue;
    const entity = Object.freeze({
      entityId: source.entityId,
      displayName: `World ${source.nameKind} feature`,
    });
    entities.push(entity);
    addedEntities.push(entity);
  }
  entities.sort((left, right) => compareStableReferences(left.entityId, right.entityId));

  const placementReferences = committed
    .filter(({ aspectName }) => aspectName === 'label.placement')
    .map(({ aspectId }) => Object.freeze({ aspectId }));
  const retainedDecoration = currentMap.decoration.aspectReferences.filter((reference) => {
    const aspect = currentById.get(reference.aspectId);
    return aspect?.aspectName !== 'label.placement';
  });
  const nextMap: WorldMap = Object.freeze({
    ...currentMap,
    entities: Object.freeze(entities),
    aspects: Object.freeze(
      [
        ...currentMap.aspects.filter(
          ({ aspectName }) => !isAtlasLabelAcceptedAspectName(aspectName),
        ),
        ...committed,
      ].sort((left, right) => compareStableReferences(left.aspectId, right.aspectId)),
    ),
    decoration: Object.freeze({
      aspectReferences: Object.freeze(
        [...retainedDecoration, ...placementReferences].sort((left, right) =>
          compareStableReferences(left.aspectId, right.aspectId),
        ),
      ),
    }),
  });
  const candidate: WorldDocument = Object.freeze({
    ...document,
    maps: Object.freeze(document.maps.map((map) => (map.mapId === nextMap.mapId ? nextMap : map))),
  });
  const reconstructed = reconstructAcceptedAtlas(candidate);
  if (
    reconstructed.status !== 'accepted' ||
    reconstructed.value.labels === undefined ||
    validateWorldDocumentOwnership(candidate).length > 0 ||
    !createAspectDependencyGraph(candidate).ok
  ) {
    diagnostics.push(
      invalidProposal(
        proposed,
        reconstructed.status === 'invalid' ? reconstructed.diagnostics[0]?.message : undefined,
      ),
    );
    return rejection(document, diagnostics);
  }
  const snapshot = createImmutableDomainSnapshot(candidate);
  if (!snapshot.ok) {
    diagnostics.push(invalidProposal(proposed));
    return rejection(document, diagnostics);
  }
  return Object.freeze({
    ok: true,
    document: snapshot.value,
    committedAspectIds: Object.freeze(proposed.map(({ aspectId }) => aspectId).sort()),
    addedEntityIds: Object.freeze(addedEntities.map(({ entityId }) => entityId).sort()),
  });
}

function validateStaleBoundary(
  document: WorldDocument,
  map: WorldMap,
  command: CommitAtlasLabelProposalCommand,
  diagnostics: AtlasDocumentTransactionDiagnostic[],
): void {
  const expected = [...command.expectedAspectRevisions].sort(compareRevision);
  const current = map.aspects
    .map(({ aspectId, variantRevision }) => ({ aspectId, variantRevision }))
    .sort(compareRevision);
  if (
    document.worldSeed !== command.expectedWorldSeed ||
    document.rootMapId !== command.targetMapId ||
    !deepEqual(expected, current)
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.staleInput,
        current.map(({ aspectId }) => aspectId),
        [],
        'The accepted atlas changed after this name/placement proposal began.',
        'Discard the stale proposal and rebuild it from the latest accepted document.',
      ),
    );
  }
}

function validateProposalAddresses(
  document: WorldDocument,
  map: WorldMap,
  accepted: Extract<
    ReturnType<typeof reconstructAcceptedAtlas>,
    { readonly status: 'accepted' }
  >['value'],
  command: CommitAtlasLabelProposalCommand,
  diagnostics: AtlasDocumentTransactionDiagnostic[],
): void {
  if (accepted.physical === undefined) {
    diagnostics.push(invalidProposalFromIds([]));
    return;
  }
  const sourceIds = new Set(
    collectWorldFeatureNameSources(accepted.geography, accepted.physical).map(
      ({ entityId }) => entityId,
    ),
  );
  const aspectIds = command.proposedAspects.map(({ target }) => target.aspect.aspectId);
  const commandKind: unknown = command.kind;
  const mode: unknown = command.operationMode;
  const validMode = Object.values(ATLAS_LABEL_DOCUMENT_OPERATION_MODES).some(
    (candidate) => candidate === mode,
  );
  const valid = command.proposedAspects.every((proposal) =>
    validProposalAddress(document, map, proposal, sourceIds),
  );
  if (
    commandKind !== ATLAS_LABEL_DOCUMENT_COMMAND_KIND ||
    !validMode ||
    new Set(aspectIds).size !== aspectIds.length ||
    !valid
  ) {
    diagnostics.push(invalidProposalFromIds(aspectIds));
  }
}

function validProposalAddress(
  document: WorldDocument,
  map: WorldMap,
  proposal: AspectReplacementProposal,
  sourceIds: ReadonlySet<EntityId>,
): boolean {
  const seed: unknown = proposal.seedMetadata;
  const proposalDiagnostics: unknown = proposal.diagnostics;
  if (!isRecord(seed) || !Array.isArray(proposalDiagnostics)) return false;
  return (
    proposal.target.mapId === map.mapId &&
    sourceIds.has(proposal.target.entityId) &&
    isAtlasLabelAcceptedAspectName(proposal.target.aspectName) &&
    proposal.seedScope === 'map/entity' &&
    seed.seedDerivationVersion === SEED_DERIVATION_VERSION &&
    seed.deterministicStreamVersion === DETERMINISTIC_STREAM_VERSION &&
    seed.seedScope === 'map/entity' &&
    seed.worldSeed === document.worldSeed &&
    seed.mapId === map.mapId &&
    seed.entityId === proposal.target.entityId &&
    seed.generatorId === proposal.generatorId &&
    seed.generatorVersion === proposal.generatorVersion &&
    seed.aspectName === proposal.target.aspectName &&
    seed.variantRevision === proposal.target.variantRevision &&
    proposalDiagnostics.every(
      (diagnostic) =>
        isRecord(diagnostic) &&
        diagnostic.severity !== 'error' &&
        isRecord(diagnostic.target) &&
        diagnostic.target.aspectId === proposal.target.aspect.aspectId,
    )
  );
}

function validateOperation(
  map: WorldMap,
  proposed: readonly AcceptedAspectRecord[],
  command: CommitAtlasLabelProposalCommand,
  diagnostics: AtlasDocumentTransactionDiagnostic[],
): void {
  const current = map.aspects.filter(({ aspectName }) =>
    isAtlasLabelAcceptedAspectName(aspectName),
  );
  const currentById = new Map(current.map((aspect) => [aspect.aspectId, aspect]));
  const proposedById = new Map(proposed.map((aspect) => [aspect.aspectId, aspect]));
  const explicit = [...new Set(command.explicitlyChangedAspectIds)].sort();
  const actualExplicit: AspectId[] = [];
  let revisionsValid = explicit.length === command.explicitlyChangedAspectIds.length;
  for (const aspect of proposed) {
    const previous = currentById.get(aspect.aspectId);
    if (previous === undefined) {
      if (command.operationMode === ATLAS_LABEL_DOCUMENT_OPERATION_MODES.initial) {
        if (aspect.variantRevision !== 0) revisionsValid = false;
      } else if (aspect.aspectName !== 'label.placement' || aspect.variantRevision !== 0) {
        revisionsValid = false;
      } else {
        actualExplicit.push(aspect.aspectId);
      }
      continue;
    }
    const incremented = incrementVariantRevision(previous.variantRevision);
    if (incremented.ok && aspect.variantRevision === incremented.value) {
      actualExplicit.push(aspect.aspectId);
    } else if (aspect.variantRevision !== previous.variantRevision) {
      revisionsValid = false;
    }
    if (
      aspect.aspectName !== previous.aspectName ||
      aspect.generatorId !== previous.generatorId ||
      aspect.generatorVersion !== previous.generatorVersion ||
      aspect.parameterSchemaVersion !== previous.parameterSchemaVersion ||
      aspect.seedScope !== previous.seedScope
    ) {
      revisionsValid = false;
    }
  }
  for (const aspect of current) {
    if (proposedById.has(aspect.aspectId)) continue;
    if (aspect.aspectName !== 'label.placement') revisionsValid = false;
    else actualExplicit.push(aspect.aspectId);
  }
  const currentNameIds = current
    .filter(({ aspectName }) => aspectName === 'worldFeature.nameContent')
    .map(({ aspectId }) => aspectId)
    .sort();
  const proposedNameIds = proposed
    .filter(({ aspectName }) => aspectName === 'worldFeature.nameContent')
    .map(({ aspectId }) => aspectId)
    .sort();
  const sameNameIds = deepEqual(currentNameIds, proposedNameIds);
  const modeValid =
    command.operationMode === ATLAS_LABEL_DOCUMENT_OPERATION_MODES.initial
      ? current.length === 0 && explicit.length === 0
      : current.length > 0 && sameNameIds && explicit.length > 0;
  const unchangedIsolated = current.every((before) => {
    if (explicit.includes(before.aspectId)) return true;
    const after = proposedById.get(before.aspectId);
    return after !== undefined && deepEqual(before, after);
  });
  const visible = current.length === 0 || actualExplicit.length > 0;
  if (
    !modeValid ||
    !revisionsValid ||
    !deepEqual(explicit, [...new Set(actualExplicit)].sort()) ||
    !unchangedIsolated
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.invalidOperation,
        explicit,
        [],
        'Name/placement revisions or selected-target isolation do not match the operation.',
        'Rebuild the complete proposal set and increment only explicitly selected targets.',
      ),
    );
  } else if (!visible) {
    diagnostics.push(
      diagnostic(
        ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.noVisibleAlternative,
        explicit,
        [],
        'The selected name/placement replacement produced no distinct accepted output.',
        'Keep the current accepted labels or build a different alternative.',
      ),
    );
  }
}

function validateLocksAndConstraints(
  map: WorldMap,
  proposed: readonly AcceptedAspectRecord[],
  diagnostics: AtlasDocumentTransactionDiagnostic[],
): void {
  const current = new Map(map.aspects.map((aspect) => [aspect.aspectId, aspect]));
  const next = new Map(proposed.map((aspect) => [aspect.aspectId, aspect]));
  const changed = (aspectId: AspectId): boolean => {
    const before = current.get(aspectId);
    const after = next.get(aspectId);
    return before !== undefined && (after === undefined || !deepEqual(before, after));
  };
  const locks = map.locks.filter(({ target }) => changed(target.aspectId));
  const constraints = map.constraints.filter(({ target }) => changed(target.aspectId));
  if (locks.length > 0) {
    diagnostics.push(
      diagnostic(
        ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.conflictingLock,
        locks.map(({ target }) => target.aspectId),
        locks.map(({ lockId }) => lockId),
        'The name/placement proposal would replace locked accepted output.',
        'Resolve the listed locks before replacing accepted labels.',
      ),
    );
  }
  if (constraints.length > 0) {
    diagnostics.push(
      diagnostic(
        ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.conflictingConstraint,
        constraints.map(({ target }) => target.aspectId),
        [],
        'The name/placement proposal would replace constrained accepted output.',
        'Honor or remove the listed constraints before replacing accepted labels.',
      ),
    );
  }
}

function invalidProposal(
  aspects: readonly AcceptedAspectRecord[],
  detail?: string,
): AtlasDocumentTransactionDiagnostic {
  return invalidProposalFromIds(
    aspects.map(({ aspectId }) => aspectId),
    detail,
  );
}

function invalidProposalFromIds(
  aspectIds: readonly AspectId[],
  detail?: string,
): AtlasDocumentTransactionDiagnostic {
  return diagnostic(
    ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.invalidProposal,
    aspectIds,
    [],
    `The complete name/placement proposal failed ownership, dependency, provenance, or record validation.${detail === undefined ? '' : ` ${detail}`}`,
    'Discard it and rebuild all name and placement proposals from one accepted source snapshot.',
  );
}

function diagnostic(
  code: AtlasDocumentTransactionDiagnostic['code'],
  aspectIds: readonly AspectId[],
  lockIds: readonly AtlasDocumentTransactionDiagnostic['lockIds'][number][],
  message: string,
  suggestedAction: string,
): AtlasDocumentTransactionDiagnostic {
  return Object.freeze({
    code,
    aspectIds: Object.freeze([...new Set(aspectIds)].sort()),
    entityIds: Object.freeze([]),
    lockIds: Object.freeze([...new Set(lockIds)].sort()),
    message,
    suggestedAction,
  });
}

function reject(
  document: WorldDocument,
  diagnostics: AtlasDocumentTransactionDiagnostic[],
  finding: AtlasDocumentTransactionDiagnostic,
): CommitAtlasLabelProposalResult {
  diagnostics.push(finding);
  return rejection(document, diagnostics);
}

function rejection(
  document: WorldDocument,
  diagnostics: readonly AtlasDocumentTransactionDiagnostic[],
): CommitAtlasLabelProposalResult {
  return Object.freeze({ ok: false, document, diagnostics: Object.freeze([...diagnostics]) });
}

function compareRevision(
  left: CommitAtlasLabelProposalCommand['expectedAspectRevisions'][number],
  right: CommitAtlasLabelProposalCommand['expectedAspectRevisions'][number],
): number {
  return compareStableReferences(left.aspectId, right.aspectId);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
