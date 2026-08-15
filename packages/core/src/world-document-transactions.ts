/** Pure validation and atomic replacement of accepted aspect proposals in a world document. */

import { createAspectDependencyGraph } from './aspect-dependency-graph.js';
import {
  ASPECT_DEPENDENCY_DIAGNOSTIC_CODES,
  ASPECT_INVALIDATION_EFFECTS,
  type AspectInvalidationResult,
  compareAspectIds,
} from './aspect-dependency-model.js';
import { getTransitiveAspectInvalidation } from './aspect-invalidation.js';
import { incrementVariantRevision } from './compatibility.js';
import {
  type AcceptedAspectRecord,
  type AspectReplacementProposal,
  orderGenerationDiagnostics,
} from './generated-aspects.js';
import type { AspectId } from './identity.js';
import { createImmutableDomainSnapshot } from './immutable-domain-snapshot.js';
import type { MapDocument, WorldDocument } from './world-document.js';
import { validateWorldDocumentOwnership } from './world-document-ownership.js';
import {
  type AspectProposalCommit,
  type CommitAspectProposalCommand,
  type CommitAspectProposalResult,
  DOCUMENT_DEPENDENCY_EFFECT_KINDS,
  DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES,
  type DocumentAspectTarget,
  type DocumentDependencyEffect,
  type DocumentTransactionDiagnostic,
} from './world-document-transaction-model.js';
import {
  conflictingLockDiagnostic,
  deepEqual,
  deepEqualExceptKey,
  dependencyDiagnostic,
  invalidEffectDiagnostic,
  invalidProposalDiagnostic,
  rejection,
  replaceAcceptedAspects,
  snapshotDependencyEffects,
  transactionDiagnostic,
} from './world-document-transaction-support.js';

interface ResolvedAspect {
  readonly aspect: AcceptedAspectRecord;
}

interface PreparedReplacement {
  readonly current: AcceptedAspectRecord;
  readonly candidate: AcceptedAspectRecord;
  readonly accepted: AcceptedAspectRecord;
}

/** Validate the complete command, then return one new immutable document or the exact input. */
export function commitAspectProposal(
  document: WorldDocument,
  command: CommitAspectProposalCommand,
): CommitAspectProposalResult {
  const diagnostics: DocumentTransactionDiagnostic[] = [];
  if (validateWorldDocumentOwnership(document).length > 0) {
    diagnostics.push(
      transactionDiagnostic(
        DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.invalidDocument,
        command.target,
        [command.target.aspectId],
        [],
        'The accepted world document has invalid ownership and cannot receive a transaction.',
        'Repair or restore the accepted ownership tree before retrying the command.',
      ),
    );
    return rejection(document, diagnostics);
  }

  const graphResult = createAspectDependencyGraph(document);
  if (!graphResult.ok) {
    const hasCycle = graphResult.diagnostics.some(
      ({ code }) => code === ASPECT_DEPENDENCY_DIAGNOSTIC_CODES.cycleDetected,
    );
    diagnostics.push(
      dependencyDiagnostic(
        command.target,
        hasCycle,
        'The accepted aspect dependency graph is invalid and cannot receive a transaction.',
      ),
    );
    return rejection(document, diagnostics);
  }

  const locks = document.maps.flatMap((map) => map.locks);
  const invalidation = getTransitiveAspectInvalidation(
    graphResult.graph,
    [command.target.aspectId],
    locks,
  );
  const dependentCommits = validateDeclaredEffects(command, invalidation, diagnostics);
  const commits = [command, ...dependentCommits];
  validateUniqueCommitTargets(commits, command.target, diagnostics);

  const prepared = commits.flatMap((commit): readonly PreparedReplacement[] => {
    const replacement = prepareReplacement(document, commit, locks, diagnostics);
    return replacement === undefined ? [] : [replacement];
  });

  if (diagnostics.length > 0 || prepared.length !== commits.length) {
    return rejection(document, diagnostics);
  }

  const candidateDocument = replaceAcceptedAspects(
    document,
    new Map(prepared.map(({ candidate }) => [candidate.aspectId, candidate] as const)),
  );
  if (validateWorldDocumentOwnership(candidateDocument).length > 0) {
    diagnostics.push(
      transactionDiagnostic(
        DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.invalidProposal,
        command.target,
        prepared.map(({ candidate }) => candidate.aspectId),
        [],
        'The proposed replacements would invalidate world-document ownership.',
        'Keep every proposal addressed to its existing owning map and entity.',
      ),
    );
  }

  const candidateGraph = createAspectDependencyGraph(candidateDocument);
  if (!candidateGraph.ok) {
    const hasCycle = candidateGraph.diagnostics.some(
      ({ code }) => code === ASPECT_DEPENDENCY_DIAGNOSTIC_CODES.cycleDetected,
    );
    diagnostics.push(
      dependencyDiagnostic(
        command.target,
        hasCycle,
        'The proposed replacements declare an invalid aspect dependency effect.',
      ),
    );
  } else {
    for (const replacement of prepared) {
      validatePreservedMetadata(document, replacement, command.target, diagnostics);
    }
  }

  if (diagnostics.length > 0) return rejection(document, diagnostics);

  const dependencyEffects = snapshotDependencyEffects(command.declaredDependencyEffects);
  if (!dependencyEffects.ok) {
    diagnostics.push(invalidProposalDiagnostic(command.target));
    return rejection(document, diagnostics);
  }

  const acceptedById = new Map(
    prepared.map(({ accepted }) => [accepted.aspectId, accepted] as const),
  );
  const committedDocument = replaceAcceptedAspects(document, acceptedById);
  return Object.freeze({
    ok: true,
    document: committedDocument,
    committedAspectIds: Object.freeze([...acceptedById.keys()].sort(compareAspectIds)),
    dependencyEffects: dependencyEffects.value,
  });
}

function validateDeclaredEffects(
  command: CommitAspectProposalCommand,
  invalidation: AspectInvalidationResult,
  diagnostics: DocumentTransactionDiagnostic[],
): readonly AspectProposalCommit[] {
  const actualById = new Map(
    invalidation.affectedAspects.map((affected) => [affected.aspectId, affected.effect] as const),
  );
  const declaredById = new Map<AspectId, DocumentDependencyEffect[]>();
  for (const effect of command.declaredDependencyEffects) {
    const group = declaredById.get(effect.aspectId);
    if (group === undefined) declaredById.set(effect.aspectId, [effect]);
    else group.push(effect);
  }

  for (const [aspectId, effects] of declaredById) {
    const actual = actualById.get(aspectId);
    const declared = effects[0];
    const isReplacement = declared?.effect === DOCUMENT_DEPENDENCY_EFFECT_KINDS.replace;
    const matches =
      effects.length === 1 &&
      actual !== undefined &&
      (isReplacement
        ? actual === ASPECT_INVALIDATION_EFFECTS.invalidated
        : declared?.effect === actual);
    const replacementTargetMatches =
      !isReplacement ||
      (declared.commit.target.aspectId === aspectId &&
        declared.commit.proposedReplacement.target.aspect.aspectId === aspectId);
    if (!matches || !replacementTargetMatches) {
      diagnostics.push(invalidEffectDiagnostic(command.target, aspectId));
    }
  }
  for (const aspectId of actualById.keys()) {
    if (!declaredById.has(aspectId)) {
      diagnostics.push(invalidEffectDiagnostic(command.target, aspectId));
    }
  }

  const lockedEffects = invalidation.affectedAspects.filter(
    ({ effect }) => effect === ASPECT_INVALIDATION_EFFECTS.lockedInconsistent,
  );
  for (const { aspectId } of lockedEffects) {
    const lockIds = invalidation.diagnostics
      .filter(
        (finding) =>
          finding.code === ASPECT_DEPENDENCY_DIAGNOSTIC_CODES.lockedOutputInconsistent &&
          finding.aspectIds.includes(aspectId),
      )
      .flatMap((finding) => finding.lockIds);
    diagnostics.push(conflictingLockDiagnostic(command.target, aspectId, lockIds));
  }

  return command.declaredDependencyEffects.flatMap((effect): readonly AspectProposalCommit[] =>
    effect.effect === DOCUMENT_DEPENDENCY_EFFECT_KINDS.replace ? [effect.commit] : [],
  );
}

function validateUniqueCommitTargets(
  commits: readonly AspectProposalCommit[],
  primaryTarget: DocumentAspectTarget,
  diagnostics: DocumentTransactionDiagnostic[],
): void {
  const counts = new Map<AspectId, number>();
  for (const commit of commits) {
    counts.set(commit.target.aspectId, (counts.get(commit.target.aspectId) ?? 0) + 1);
  }
  for (const [aspectId, count] of counts) {
    if (count > 1) diagnostics.push(invalidEffectDiagnostic(primaryTarget, aspectId));
  }
}

function prepareReplacement(
  document: WorldDocument,
  commit: AspectProposalCommit,
  locks: readonly MapDocument['locks'][number][],
  diagnostics: DocumentTransactionDiagnostic[],
): PreparedReplacement | undefined {
  const resolved = resolveAspect(document, commit.target);
  if (resolved === undefined) {
    diagnostics.push(
      transactionDiagnostic(
        DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.targetNotFound,
        commit.target,
        [commit.target.aspectId],
        [],
        'The command target does not identify one accepted aspect at the declared address.',
        'Refresh the document and retry with existing stable map, entity, and aspect IDs.',
      ),
    );
    return undefined;
  }

  const targetLocks = locks.filter((lock) => lock.target.aspectId === commit.target.aspectId);
  if (targetLocks.length > 0) {
    diagnostics.push(
      conflictingLockDiagnostic(
        commit.target,
        commit.target.aspectId,
        targetLocks.map(({ lockId }) => lockId),
      ),
    );
  }
  if (resolved.aspect.variantRevision !== commit.expectedPreviousRevision) {
    diagnostics.push(
      transactionDiagnostic(
        DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.staleRevision,
        commit.target,
        [commit.target.aspectId],
        [],
        `Expected revision ${String(commit.expectedPreviousRevision)} does not match accepted revision ${String(resolved.aspect.variantRevision)}.`,
        'Regenerate the proposal from the latest accepted aspect revision.',
      ),
    );
  }

  const nextRevision = incrementVariantRevision(resolved.aspect.variantRevision);
  const proposal = commit.proposedReplacement;
  const hasInvalidAddress = !proposalTargetsAspect(proposal, commit.target, resolved.aspect);
  const hasInvalidRevision =
    !nextRevision.ok || proposal.target.variantRevision !== nextRevision.value;
  const orderedDiagnostics = orderGenerationDiagnostics(commit.diagnostics);
  const hasErrorDiagnostic = [...proposal.diagnostics, ...orderedDiagnostics].some(
    ({ severity }) => severity === 'error',
  );
  const omitsProposalDiagnostic = proposal.diagnostics.some(
    (finding) => !orderedDiagnostics.some((candidate) => deepEqual(candidate, finding)),
  );
  const hasMisdirectedDiagnostic = orderedDiagnostics.some(
    (finding) => finding.target.aspectId !== commit.target.aspectId,
  );
  if (
    hasInvalidAddress ||
    hasInvalidRevision ||
    hasErrorDiagnostic ||
    omitsProposalDiagnostic ||
    hasMisdirectedDiagnostic ||
    proposal.seedMetadata.variantRevision !== proposal.target.variantRevision
  ) {
    diagnostics.push(invalidProposalDiagnostic(commit.target));
  }

  if (
    targetLocks.length > 0 ||
    resolved.aspect.variantRevision !== commit.expectedPreviousRevision ||
    hasInvalidAddress ||
    hasInvalidRevision ||
    hasErrorDiagnostic ||
    omitsProposalDiagnostic ||
    hasMisdirectedDiagnostic ||
    proposal.seedMetadata.variantRevision !== proposal.target.variantRevision
  ) {
    return undefined;
  }

  const candidate = acceptedFromProposal(resolved.aspect, proposal, orderedDiagnostics, false);
  const accepted = createImmutableDomainSnapshot(
    acceptedFromProposal(resolved.aspect, proposal, orderedDiagnostics, true),
  );
  if (!accepted.ok) {
    diagnostics.push(invalidProposalDiagnostic(commit.target));
    return undefined;
  }

  return Object.freeze({
    current: resolved.aspect,
    candidate,
    accepted: accepted.value,
  });
}

function validatePreservedMetadata(
  document: WorldDocument,
  replacement: PreparedReplacement,
  primaryTarget: DocumentAspectTarget,
  diagnostics: DocumentTransactionDiagnostic[],
): void {
  const current = replacement.current;
  const candidate = replacement.candidate;
  const metadataMatches =
    candidate.aspectName === current.aspectName &&
    candidate.generatorId === current.generatorId &&
    candidate.generatorVersion === current.generatorVersion &&
    candidate.parameterSchemaVersion === current.parameterSchemaVersion &&
    deepEqual(candidate.parameters, current.parameters) &&
    candidate.seedScope === current.seedScope &&
    deepEqualExceptKey(candidate.seedMetadata, current.seedMetadata, 'variantRevision') &&
    deepEqual(candidate.dependencyAspects, current.dependencyAspects) &&
    current.seedMetadata.variantRevision === current.variantRevision &&
    current.seedMetadata.worldSeed === document.worldSeed &&
    candidate.seedMetadata.worldSeed === document.worldSeed &&
    candidate.seedMetadata.generatorId === candidate.generatorId &&
    candidate.seedMetadata.generatorVersion === candidate.generatorVersion &&
    candidate.seedMetadata.aspectName === candidate.aspectName &&
    candidate.seedMetadata.seedScope === candidate.seedScope;
  if (!metadataMatches) {
    diagnostics.push(
      transactionDiagnostic(
        DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.invalidProposal,
        primaryTarget,
        [candidate.aspectId],
        [],
        'A reroll proposal changed accepted metadata outside revision, diagnostics, and output.',
        'Regenerate from the accepted parameters, seed scope, versions, and dependency references.',
      ),
    );
  }
}

function acceptedFromProposal(
  current: AcceptedAspectRecord,
  proposal: AspectReplacementProposal,
  diagnostics: readonly AcceptedAspectRecord['diagnostics'][number][],
  preserveMetadata: boolean,
): AcceptedAspectRecord {
  return Object.freeze({
    mapId: current.mapId,
    entityId: current.entityId,
    aspectId: current.aspectId,
    aspectName: preserveMetadata ? current.aspectName : proposal.target.aspectName,
    generatorId: preserveMetadata ? current.generatorId : proposal.generatorId,
    generatorVersion: preserveMetadata ? current.generatorVersion : proposal.generatorVersion,
    parameterSchemaVersion: preserveMetadata
      ? current.parameterSchemaVersion
      : proposal.parameterSchemaVersion,
    parameters: preserveMetadata ? current.parameters : proposal.parameters,
    seedScope: preserveMetadata ? current.seedScope : proposal.seedScope,
    seedMetadata: proposal.seedMetadata,
    variantRevision: proposal.target.variantRevision,
    dependencyAspects: preserveMetadata ? current.dependencyAspects : proposal.dependencyAspects,
    generationStatus: 'accepted',
    diagnostics,
    acceptedOutput: proposal.output,
  });
}

function resolveAspect(
  document: WorldDocument,
  target: DocumentAspectTarget,
): ResolvedAspect | undefined {
  const map = document.maps.find(({ mapId }) => mapId === target.mapId);
  if (!map?.entities.some(({ entityId }) => entityId === target.entityId)) {
    return undefined;
  }
  const aspect = map.aspects.find(({ aspectId }) => aspectId === target.aspectId);
  return aspect?.entityId === target.entityId ? { aspect } : undefined;
}

function proposalTargetsAspect(
  proposal: AspectReplacementProposal,
  target: DocumentAspectTarget,
  current: AcceptedAspectRecord,
): boolean {
  return (
    proposal.target.mapId === target.mapId &&
    proposal.target.entityId === target.entityId &&
    proposal.target.aspect.aspectId === target.aspectId &&
    proposal.target.aspectName === current.aspectName
  );
}
