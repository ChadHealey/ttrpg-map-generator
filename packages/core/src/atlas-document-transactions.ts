/** Atomic validation and acceptance of complete Milestone 2 atlas proposals. */

import { createAspectDependencyGraph } from './aspect-dependency-graph.js';
import { reconstructAcceptedAtlas } from './atlas-accepted-state.js';
import {
  acceptAtlasProposals,
  invalidAtlasProposalDiagnostic,
  validateAtlasProposalShape,
  validateCompleteAtlasProposal,
} from './atlas-document-proposal-validation.js';
import {
  ATLAS_DOCUMENT_OPERATION_MODES,
  ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES,
  type AtlasDocumentTransactionDiagnostic,
  type CommitAtlasProposalCommand,
  type CommitAtlasProposalResult,
} from './atlas-document-transaction-model.js';
import { incrementVariantRevision } from './compatibility.js';
import { type AcceptedAspectRecord } from './generated-aspects.js';
import { type AspectId, compareStableReferences, type EntityId } from './identity.js';
import { createImmutableDomainSnapshot } from './immutable-domain-snapshot.js';
import type { MapEntity, WorldDocument, WorldMap } from './world-document.js';
import { validateWorldDocumentOwnership } from './world-document-ownership.js';
import { deepEqual } from './world-document-transaction-support.js';

const GEOGRAPHY_ROOT = 'worldTerrain.macroElevation';
const APPEARANCE_ASPECT_NAMES = Object.freeze([
  'atlas.coastlineAppearance',
  'atlas.paperTreatment',
  'atlas.waterDecoration',
] as const);

/** Commit all proposed entity/aspect membership at once, or return the exact input document. */
export function commitAtlasProposal(
  document: WorldDocument,
  command: CommitAtlasProposalCommand,
): CommitAtlasProposalResult {
  const diagnostics: AtlasDocumentTransactionDiagnostic[] = [];
  const currentMap = document.maps.find(({ mapId }) => mapId === command.targetMapId);
  if (currentMap?.mapKind !== 'world') {
    diagnostics.push(
      diagnostic(
        ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.targetNotFound,
        [],
        [],
        [],
        'The atlas proposal target is not the accepted root world map.',
        'Refresh the workflow and target the current root WorldMap identity.',
      ),
    );
    return rejection(document, diagnostics);
  }
  if (validateWorldDocumentOwnership(document).length > 0) {
    diagnostics.push(
      diagnostic(
        ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.invalidDocument,
        [],
        [],
        [],
        'The accepted world document is invalid and cannot receive an atlas proposal.',
        'Restore a valid accepted ownership tree before retrying generation.',
      ),
    );
    return rejection(document, diagnostics);
  }
  validateStaleBoundary(document, currentMap, command, diagnostics);
  validateAtlasProposalShape(currentMap, command, diagnostics);
  if (diagnostics.length > 0) return rejection(document, diagnostics);

  const proposedAspects = acceptAtlasProposals(command.proposedAspects, diagnostics);
  if (proposedAspects === undefined) return rejection(document, diagnostics);
  validateOperation(currentMap, proposedAspects, command, diagnostics);
  validateLocksAndConstraints(currentMap, proposedAspects, command.proposedEntities, diagnostics);
  validateCompleteAtlasProposal(proposedAspects, command, diagnostics);
  if (diagnostics.length > 0) return rejection(document, diagnostics);

  const appearanceReferences = proposedAspects
    .filter(({ aspectName }) => isAppearanceAspectName(aspectName))
    .map(({ aspectId }) => Object.freeze({ aspectId }))
    .sort((left, right) => compareStableReferences(left.aspectId, right.aspectId));
  const proposedAspectIds = new Set(proposedAspects.map(({ aspectId }) => aspectId));
  const decorationReferences = [
    ...new Map(
      [
        ...currentMap.decoration.aspectReferences.filter(({ aspectId }) =>
          proposedAspectIds.has(aspectId),
        ),
        ...appearanceReferences,
      ].map((reference) => [reference.aspectId, reference]),
    ).values(),
  ].sort((left, right) => compareStableReferences(left.aspectId, right.aspectId));
  const currentEntitiesById = new Map(
    currentMap.entities.map((entity) => [entity.entityId, entity] as const),
  );
  const committedEntities = command.proposedEntities.map(
    (entity) => currentEntitiesById.get(entity.entityId) ?? entity,
  );
  const proposedMap: WorldMap = Object.freeze({
    ...currentMap,
    coordinateSystem: command.proposedCoordinateSystem,
    entities: Object.freeze(committedEntities),
    aspects: Object.freeze(proposedAspects),
    decoration: Object.freeze({ aspectReferences: Object.freeze(decorationReferences) }),
  });
  const candidate: WorldDocument = Object.freeze({
    ...document,
    maps: Object.freeze(
      document.maps.map((map) => (map.mapId === proposedMap.mapId ? proposedMap : map)),
    ),
  });
  let reconstructed: ReturnType<typeof reconstructAcceptedAtlas>;
  try {
    reconstructed = reconstructAcceptedAtlas(candidate);
  } catch {
    diagnostics.push(
      diagnostic(
        ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.invalidProposal,
        proposedAspects.map(({ aspectId }) => aspectId),
        command.proposedEntities.map(({ entityId }) => entityId),
        [],
        'The complete atlas proposal contains invalid accepted-state data.',
        'Regenerate every proposal from the same accepted source snapshot and stable IDs.',
      ),
    );
    return rejection(document, diagnostics);
  }
  if (
    validateWorldDocumentOwnership(candidate).length > 0 ||
    !createAspectDependencyGraph(candidate).ok ||
    reconstructed.status !== 'accepted'
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.invalidProposal,
        proposedAspects.map(({ aspectId }) => aspectId),
        command.proposedEntities.map(({ entityId }) => entityId),
        [],
        'The complete atlas proposal has invalid ownership or dependency topology.',
        'Regenerate every proposal from the same accepted source snapshot and stable IDs.',
      ),
    );
    return rejection(document, diagnostics);
  }
  const snapshot = createImmutableDomainSnapshot(candidate);
  if (!snapshot.ok) {
    diagnostics.push(invalidAtlasProposalDiagnostic(proposedAspects));
    return rejection(document, diagnostics);
  }
  const previousIds = new Set(currentMap.entities.map(({ entityId }) => entityId));
  const nextIds = new Set(command.proposedEntities.map(({ entityId }) => entityId));
  return Object.freeze({
    ok: true,
    document: snapshot.value,
    committedAspectIds: Object.freeze(proposedAspects.map(({ aspectId }) => aspectId).sort()),
    addedEntityIds: Object.freeze([...nextIds].filter((id) => !previousIds.has(id)).sort()),
    removedEntityIds: Object.freeze([...previousIds].filter((id) => !nextIds.has(id)).sort()),
  });
}

function validateStaleBoundary(
  document: WorldDocument,
  currentMap: WorldMap,
  command: CommitAtlasProposalCommand,
  diagnostics: AtlasDocumentTransactionDiagnostic[],
): void {
  const expected = [...command.expectedAspectRevisions].sort((a, b) =>
    compareStableReferences(a.aspectId, b.aspectId),
  );
  const current = currentMap.aspects
    .map(({ aspectId, variantRevision }) => ({ aspectId, variantRevision }))
    .sort((a, b) => compareStableReferences(a.aspectId, b.aspectId));
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
        'The accepted atlas changed after this proposal began.',
        'Discard the stale proposal and regenerate it from the latest accepted document.',
      ),
    );
  }
}

function validateOperation(
  currentMap: WorldMap,
  proposed: readonly AcceptedAspectRecord[],
  command: CommitAtlasProposalCommand,
  diagnostics: AtlasDocumentTransactionDiagnostic[],
): void {
  const currentById = new Map(
    currentMap.aspects.map((aspect) => [aspect.aspectId, aspect] as const),
  );
  const proposedById = new Map(proposed.map((aspect) => [aspect.aspectId, aspect] as const));
  const explicit = [...new Set(command.explicitlyIncrementedAspectIds)].sort();
  const actualExplicit: AspectId[] = [];
  for (const aspect of proposed) {
    const previous = currentById.get(aspect.aspectId);
    if (previous === undefined) {
      if (aspect.variantRevision !== 0) diagnostics.push(invalidAtlasProposalDiagnostic(proposed));
      continue;
    }
    const incremented = incrementVariantRevision(previous.variantRevision);
    if (incremented.ok && aspect.variantRevision === incremented.value)
      actualExplicit.push(aspect.aspectId);
    else if (aspect.variantRevision !== previous.variantRevision)
      diagnostics.push(invalidAtlasProposalDiagnostic(proposed));
    if (
      aspect.generatorId !== previous.generatorId ||
      aspect.generatorVersion !== previous.generatorVersion ||
      aspect.parameterSchemaVersion !== previous.parameterSchemaVersion ||
      aspect.seedScope !== previous.seedScope ||
      aspect.aspectName !== previous.aspectName ||
      (command.operationMode !== ATLAS_DOCUMENT_OPERATION_MODES.controls &&
        !deepEqual(aspect.parameters, previous.parameters))
    ) {
      diagnostics.push(invalidAtlasProposalDiagnostic(proposed));
    }
  }
  const expectedNames = expectedExplicitNames(command.operationMode);
  const actualNames = actualExplicit
    .map((aspectId) => proposedById.get(aspectId)?.aspectName)
    .filter((name): name is AcceptedAspectRecord['aspectName'] => name !== undefined)
    .sort();
  const currentIds = new Set(currentMap.aspects.map(({ aspectId }) => aspectId));
  const removedIds = [...currentIds].filter((aspectId) => !proposedById.has(aspectId));
  const isInitialValid =
    command.operationMode !== ATLAS_DOCUMENT_OPERATION_MODES.initial ||
    (currentMap.aspects.length === 0 && explicit.length === 0);
  const isExplicitValid =
    deepEqual(explicit, actualExplicit.sort()) && deepEqual(actualNames, expectedNames);
  const isAppearanceIsolated =
    command.operationMode !== ATLAS_DOCUMENT_OPERATION_MODES.appearanceReroll ||
    [...currentById.values()].every((current) => {
      const next = proposedById.get(current.aspectId);
      return (
        isAppearanceAspectName(current.aspectName) ||
        (next !== undefined && deepEqual(current, next))
      );
    });
  const macroCurrent = [...currentById.values()].find(
    ({ aspectName }) => aspectName === GEOGRAPHY_ROOT,
  );
  const macroNext = [...proposedById.values()].find(
    ({ aspectName }) => aspectName === GEOGRAPHY_ROOT,
  );
  const paperCurrent = [...currentById.values()].find(
    ({ aspectName }) => aspectName === 'atlas.paperTreatment',
  );
  const paperNext = [...proposedById.values()].find(
    ({ aspectName }) => aspectName === 'atlas.paperTreatment',
  );
  const hasChangedGeographyDependent =
    proposed.some((aspect) => {
      if (aspect.aspectName === GEOGRAPHY_ROOT || isAppearanceAspectName(aspect.aspectName)) {
        return false;
      }
      const previous = currentById.get(aspect.aspectId);
      return previous === undefined || !deepEqual(previous.acceptedOutput, aspect.acceptedOutput);
    }) ||
    currentMap.aspects.some(
      (aspect) =>
        aspect.aspectName !== GEOGRAPHY_ROOT &&
        !isAppearanceAspectName(aspect.aspectName) &&
        !proposedById.has(aspect.aspectId),
    );
  const isGeographyVisible =
    command.operationMode !== ATLAS_DOCUMENT_OPERATION_MODES.geographyReroll ||
    (macroCurrent !== undefined &&
      macroNext !== undefined &&
      !deepEqual(macroCurrent.acceptedOutput, macroNext.acceptedOutput) &&
      hasChangedGeographyDependent &&
      paperCurrent !== undefined &&
      paperNext !== undefined &&
      deepEqual(paperCurrent, paperNext));
  const isAppearanceVisible =
    command.operationMode !== ATLAS_DOCUMENT_OPERATION_MODES.appearanceReroll ||
    APPEARANCE_ASPECT_NAMES.every((name) => {
      const before = [...currentById.values()].find(({ aspectName }) => aspectName === name);
      const after = [...proposedById.values()].find(({ aspectName }) => aspectName === name);
      return (
        before !== undefined &&
        after !== undefined &&
        !deepEqual(before.acceptedOutput, after.acceptedOutput)
      );
    });
  if (
    !isInitialValid ||
    !isExplicitValid ||
    !isAppearanceIsolated ||
    removedIds.some((id) => explicit.includes(id))
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.invalidOperation,
        explicit,
        [],
        [],
        'The proposed revisions or isolation boundary do not match the selected atlas operation.',
        'Rebuild the complete proposal with only the operation’s explicit targets incremented.',
      ),
    );
  }
  if (!isGeographyVisible || !isAppearanceVisible) {
    diagnostics.push(
      diagnostic(
        ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.noVisibleAlternative,
        explicit,
        [],
        [],
        'The reroll did not produce a distinct accepted alternative at its comparison boundary.',
        'Retry from the unchanged accepted atlas or keep the current result.',
      ),
    );
  }
}

function validateLocksAndConstraints(
  currentMap: WorldMap,
  proposed: readonly AcceptedAspectRecord[],
  proposedEntities: readonly MapEntity[],
  diagnostics: AtlasDocumentTransactionDiagnostic[],
): void {
  const proposedById = new Map(proposed.map((aspect) => [aspect.aspectId, aspect] as const));
  const currentById = new Map(
    currentMap.aspects.map((aspect) => [aspect.aspectId, aspect] as const),
  );
  const conflictingLocks = currentMap.locks.filter(({ target }) => {
    const current = currentById.get(target.aspectId);
    const next = proposedById.get(target.aspectId);
    return current === undefined || next === undefined || !deepEqual(current, next);
  });
  const proposedEntityIds = new Set(proposedEntities.map(({ entityId }) => entityId));
  const conflictingConstraints = currentMap.constraints.filter(({ target }) => {
    const current = currentById.get(target.aspectId);
    const next = proposedById.get(target.aspectId);
    return current === undefined || next === undefined || !deepEqual(current, next);
  });
  if (conflictingLocks.length > 0) {
    diagnostics.push(
      diagnostic(
        ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.conflictingLock,
        conflictingLocks.map(({ target }) => target.aspectId),
        currentMap.entities
          .filter(({ entityId }) => !proposedEntityIds.has(entityId))
          .map(({ entityId }) => entityId),
        conflictingLocks.map(({ lockId }) => lockId),
        'The complete proposal would replace locked accepted output.',
        'Keep the accepted atlas until the user explicitly resolves the listed locks.',
      ),
    );
  }
  if (conflictingConstraints.length > 0) {
    diagnostics.push(
      diagnostic(
        ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.conflictingConstraint,
        conflictingConstraints.map(({ target }) => target.aspectId),
        currentMap.entities
          .filter(({ entityId }) => !proposedEntityIds.has(entityId))
          .map(({ entityId }) => entityId),
        [],
        'The complete proposal would replace output protected by an accepted constraint.',
        'Keep the accepted atlas until the constraint can be honored or explicitly removed.',
      ),
    );
  }
}

function expectedExplicitNames(
  mode: CommitAtlasProposalCommand['operationMode'],
): readonly string[] {
  if (mode === ATLAS_DOCUMENT_OPERATION_MODES.geographyReroll) return [GEOGRAPHY_ROOT];
  if (mode === ATLAS_DOCUMENT_OPERATION_MODES.appearanceReroll)
    return [...APPEARANCE_ASPECT_NAMES].sort();
  return [];
}

function isAppearanceAspectName(name: string): boolean {
  return APPEARANCE_ASPECT_NAMES.some((candidate) => candidate === name);
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
): CommitAtlasProposalResult {
  return Object.freeze({ ok: false, document, diagnostics: Object.freeze([...diagnostics]) });
}
