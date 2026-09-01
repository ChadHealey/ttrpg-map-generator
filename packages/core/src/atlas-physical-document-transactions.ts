/** Atomic validation and acceptance of complete Milestone 3 physical-atlas proposals. */

import { createAspectDependencyGraph } from './aspect-dependency-graph.js';
import { reconstructAcceptedAtlas } from './atlas-accepted-state.js';
import { acceptAtlasProposals } from './atlas-document-proposal-validation.js';
import {
  ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES,
  ATLAS_PHYSICAL_DOCUMENT_COMMAND_KIND,
  ATLAS_PHYSICAL_DOCUMENT_OPERATION_MODES,
  type AtlasDocumentTransactionDiagnostic,
  type CommitAtlasPhysicalProposalCommand,
  type CommitAtlasPhysicalProposalResult,
} from './atlas-document-transaction-model.js';
import {
  isWorldPhysicalContextAspectName,
  WORLD_PHYSICAL_CONTEXT_ASPECT_NAMES,
} from './atlas-physical-accepted-state.js';
import { incrementVariantRevision } from './compatibility.js';
import type { AcceptedAspectRecord, AspectReplacementProposal } from './generated-aspects.js';
import { type AspectId, compareStableReferences, type EntityId } from './identity.js';
import { createImmutableDomainSnapshot } from './immutable-domain-snapshot.js';
import type { WorldDocument, WorldMap } from './world-document.js';
import { validateWorldDocumentOwnership } from './world-document-ownership.js';
import { deepEqual } from './world-document-transaction-support.js';
import {
  getWorldPhysicalContextControlInvalidationRoots,
  WORLD_PHYSICAL_CONTEXT_ASPECT_DEFINITIONS,
  type WorldPhysicalContextAspectKind,
} from './world-physical-context-aspects.js';

/** Commit all nine physical aspects at once, or return the exact input document. */
export function commitAtlasPhysicalProposal(
  document: WorldDocument,
  command: CommitAtlasPhysicalProposalCommand,
): CommitAtlasPhysicalProposalResult {
  const diagnostics: AtlasDocumentTransactionDiagnostic[] = [];
  const currentMap = document.maps.find(({ mapId }) => mapId === command.targetMapId);
  if (currentMap?.mapKind !== 'world' || currentMap.mapId !== document.rootMapId) {
    diagnostics.push(
      diagnostic(
        ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.targetNotFound,
        [],
        [],
        [],
        'The physical proposal target is not the accepted root world map.',
        'Refresh the workflow and target the current root WorldMap identity.',
      ),
    );
    return rejection(document, diagnostics);
  }
  const accepted = reconstructAcceptedAtlas(document);
  if (
    accepted.status !== 'accepted' ||
    validateWorldDocumentOwnership(document).length > 0 ||
    !createAspectDependencyGraph(document).ok
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.invalidDocument,
        [],
        [],
        [],
        'The accepted atlas is invalid and cannot receive a physical proposal.',
        'Restore a complete accepted M2 or M3 atlas before retrying generation.',
      ),
    );
    return rejection(document, diagnostics);
  }
  validateStaleBoundary(document, currentMap, command, diagnostics);
  validateProposalShape(document, currentMap, command, diagnostics);
  if (diagnostics.length > 0) return rejection(document, diagnostics);

  const proposed = acceptAtlasProposals(command.proposedAspects, diagnostics);
  if (proposed === undefined) return rejection(document, diagnostics);
  validateOperation(currentMap, proposed, accepted.value.physical?.controls, command, diagnostics);
  validateLocksAndConstraints(currentMap, proposed, diagnostics);
  if (diagnostics.length > 0) return rejection(document, diagnostics);

  const previousById = new Map(currentMap.aspects.map((aspect) => [aspect.aspectId, aspect]));
  const committedPhysical = proposed.map((aspect) => {
    const previous = previousById.get(aspect.aspectId);
    return previous !== undefined && deepEqual(previous, aspect) ? previous : aspect;
  });
  const nextMap: WorldMap = Object.freeze({
    ...currentMap,
    aspects: Object.freeze(
      [
        ...currentMap.aspects.filter(
          ({ aspectName }) => !isWorldPhysicalContextAspectName(aspectName),
        ),
        ...committedPhysical,
      ].sort((left, right) => compareStableReferences(left.aspectId, right.aspectId)),
    ),
  });
  const candidate: WorldDocument = Object.freeze({
    ...document,
    maps: Object.freeze(document.maps.map((map) => (map.mapId === nextMap.mapId ? nextMap : map))),
  });
  const reconstructed = reconstructAcceptedAtlas(candidate);
  if (
    reconstructed.status !== 'accepted' ||
    reconstructed.value.physical === undefined ||
    !deepEqual(reconstructed.value.physical.controls, command.controls) ||
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
  });
}

function validateStaleBoundary(
  document: WorldDocument,
  map: WorldMap,
  command: CommitAtlasPhysicalProposalCommand,
  diagnostics: AtlasDocumentTransactionDiagnostic[],
): void {
  const expected = [...command.expectedAspectRevisions].sort((left, right) =>
    compareStableReferences(left.aspectId, right.aspectId),
  );
  const current = map.aspects
    .map(({ aspectId, variantRevision }) => ({ aspectId, variantRevision }))
    .sort((left, right) => compareStableReferences(left.aspectId, right.aspectId));
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
        [],
        'The accepted atlas changed after this physical proposal began.',
        'Discard the stale proposal and regenerate it from the latest accepted document.',
      ),
    );
  }
}

function validateProposalShape(
  document: WorldDocument,
  map: WorldMap,
  command: CommitAtlasPhysicalProposalCommand,
  diagnostics: AtlasDocumentTransactionDiagnostic[],
): void {
  const aspectIds = command.proposedAspects.map(({ target }) => target.aspect.aspectId);
  const names = command.proposedAspects.map(({ target }) => target.aspectName);
  const commandKind: unknown = command.kind;
  const mode: unknown = command.operationMode;
  const validMode = Object.values(ATLAS_PHYSICAL_DOCUMENT_OPERATION_MODES).some(
    (candidate) => candidate === mode,
  );
  const validProposals = command.proposedAspects.every((proposal) =>
    validProposalAddress(document, map, proposal),
  );
  if (
    commandKind !== ATLAS_PHYSICAL_DOCUMENT_COMMAND_KIND ||
    !validMode ||
    command.proposedAspects.length !== WORLD_PHYSICAL_CONTEXT_ASPECT_NAMES.size ||
    new Set(aspectIds).size !== aspectIds.length ||
    new Set(names).size !== WORLD_PHYSICAL_CONTEXT_ASPECT_NAMES.size ||
    names.some((name) => !WORLD_PHYSICAL_CONTEXT_ASPECT_NAMES.has(name)) ||
    !validProposals
  ) {
    diagnostics.push(invalidProposalFromIds(aspectIds));
  }
}

function validProposalAddress(
  document: WorldDocument,
  map: WorldMap,
  proposal: AspectReplacementProposal,
): boolean {
  const seed = proposal.seedMetadata;
  return (
    proposal.target.mapId === map.mapId &&
    map.entities.some(({ entityId }) => entityId === proposal.target.entityId) &&
    proposal.seedScope === 'map/entity' &&
    seed.seedScope === 'map/entity' &&
    seed.worldSeed === document.worldSeed &&
    seed.mapId === map.mapId &&
    seed.entityId === proposal.target.entityId &&
    seed.generatorId === proposal.generatorId &&
    seed.generatorVersion === proposal.generatorVersion &&
    seed.aspectName === proposal.target.aspectName &&
    seed.variantRevision === proposal.target.variantRevision &&
    proposal.diagnostics.every(
      ({ severity, target }) =>
        severity !== 'error' && target.aspectId === proposal.target.aspect.aspectId,
    )
  );
}

function validateOperation(
  map: WorldMap,
  proposed: readonly AcceptedAspectRecord[],
  previousControls: CommitAtlasPhysicalProposalCommand['controls'] | undefined,
  command: CommitAtlasPhysicalProposalCommand,
  diagnostics: AtlasDocumentTransactionDiagnostic[],
): void {
  const current = map.aspects.filter(({ aspectName }) =>
    isWorldPhysicalContextAspectName(aspectName),
  );
  const currentById = new Map(current.map((aspect) => [aspect.aspectId, aspect]));
  const proposedById = new Map(proposed.map((aspect) => [aspect.aspectId, aspect]));
  const explicit = [...new Set(command.explicitlyIncrementedAspectIds)].sort();
  const actualExplicit: AspectId[] = [];
  let revisionsValid = true;
  for (const aspect of proposed) {
    const previous = currentById.get(aspect.aspectId);
    if (previous === undefined) {
      if (aspect.variantRevision !== 0) revisionsValid = false;
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

  let affected = new Set<WorldPhysicalContextAspectKind>();
  let modeValid = true;
  switch (command.operationMode) {
    case ATLAS_PHYSICAL_DOCUMENT_OPERATION_MODES.initial:
      modeValid = current.length === 0 && explicit.length === 0;
      affected = new Set(WORLD_PHYSICAL_CONTEXT_ASPECT_DEFINITIONS.map(({ kind }) => kind));
      break;
    case ATLAS_PHYSICAL_DOCUMENT_OPERATION_MODES.controls: {
      const roots =
        previousControls === undefined
          ? []
          : getWorldPhysicalContextControlInvalidationRoots(previousControls, command.controls);
      modeValid = current.length === proposed.length && explicit.length === 0 && roots.length > 0;
      affected = transitiveKinds(roots);
      break;
    }
    case ATLAS_PHYSICAL_DOCUMENT_OPERATION_MODES.aspectReroll: {
      const root = proposedById.get(explicit[0] ?? ('' as AspectId));
      const rootKind =
        root !== undefined && isWorldPhysicalContextAspectName(root.aspectName)
          ? root.aspectName
          : undefined;
      modeValid =
        current.length === proposed.length &&
        explicit.length === 1 &&
        actualExplicit.length === 1 &&
        actualExplicit[0] === explicit[0] &&
        rootKind !== undefined;
      affected = rootKind === undefined ? new Set() : transitiveKinds([rootKind]);
      break;
    }
  }
  const isolationValid = current.every((before) => {
    if (affected.has(before.aspectName as WorldPhysicalContextAspectKind)) return true;
    const after = proposedById.get(before.aspectId);
    return after !== undefined && deepEqual(before, after);
  });
  const visible =
    current.length === 0 ||
    current.some((before) => {
      const after = proposedById.get(before.aspectId);
      return (
        affected.has(before.aspectName as WorldPhysicalContextAspectKind) &&
        after !== undefined &&
        !deepEqual(before.acceptedOutput, after.acceptedOutput)
      );
    });
  if (
    !modeValid ||
    !revisionsValid ||
    !deepEqual(explicit, actualExplicit.sort()) ||
    !isolationValid
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.invalidOperation,
        explicit,
        [],
        [],
        'The physical revisions or dependency-closed isolation boundary do not match the operation.',
        'Rebuild all nine proposals with only the selected root revision incremented.',
      ),
    );
  } else if (!visible) {
    diagnostics.push(
      diagnostic(
        ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.noVisibleAlternative,
        explicit,
        [],
        [],
        'The physical reroll did not produce a distinct accepted alternative.',
        'Retry from the unchanged accepted atlas or keep the current result.',
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
        [],
        locks.map(({ lockId }) => lockId),
        'The complete physical proposal would replace locked accepted output.',
        'Keep the accepted atlas until the listed locks are explicitly resolved.',
      ),
    );
  }
  if (constraints.length > 0) {
    diagnostics.push(
      diagnostic(
        ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.conflictingConstraint,
        constraints.map(({ target }) => target.aspectId),
        [],
        [],
        'The complete physical proposal would replace constrained accepted output.',
        'Keep the accepted atlas until each constraint is honored or explicitly removed.',
      ),
    );
  }
}

function transitiveKinds(
  roots: readonly WorldPhysicalContextAspectKind[],
): Set<WorldPhysicalContextAspectKind> {
  const affected = new Set(roots);
  let changed = true;
  while (changed) {
    changed = false;
    for (const definition of WORLD_PHYSICAL_CONTEXT_ASPECT_DEFINITIONS) {
      if (
        !affected.has(definition.kind) &&
        definition.directDependencyKinds.some(
          (kind) => isWorldPhysicalContextAspectName(kind) && affected.has(kind),
        )
      ) {
        affected.add(definition.kind);
        changed = true;
      }
    }
  }
  return affected;
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
    [],
    `The complete physical proposal failed ownership, dependency, provenance, or record validation.${detail === undefined ? '' : ` ${detail}`}`,
    'Discard it and regenerate all nine aspects from the same accepted source snapshot.',
  );
}

function diagnostic(
  code: AtlasDocumentTransactionDiagnostic['code'],
  aspectIds: readonly AspectId[],
  entityIds: readonly EntityId[],
  lockIds: readonly AtlasDocumentTransactionDiagnostic['lockIds'][number][],
  message: string,
  suggestedAction: string,
): AtlasDocumentTransactionDiagnostic {
  return Object.freeze({
    code,
    aspectIds: Object.freeze([...new Set(aspectIds)].sort()),
    entityIds: Object.freeze([...new Set(entityIds)].sort()),
    lockIds: Object.freeze([...new Set(lockIds)].sort()),
    message,
    suggestedAction,
  });
}

function rejection(
  document: WorldDocument,
  diagnostics: readonly AtlasDocumentTransactionDiagnostic[],
): CommitAtlasPhysicalProposalResult {
  return Object.freeze({ ok: false, document, diagnostics: Object.freeze([...diagnostics]) });
}
