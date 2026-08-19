/** Package-private deterministic helpers shared by the document transaction implementation. */

import { compareAspectIds } from './aspect-dependency-model.js';
import { atlasSampleReadersEqual, isAtlasSampleReader } from './atlas-sample-reader.js';
import type { AcceptedAspectRecord } from './generated-aspects.js';
import { type AspectId, compareStableReferences, type LockId } from './identity.js';
import {
  createImmutableDomainSnapshot,
  type ImmutableDomainSnapshotResult,
} from './immutable-domain-snapshot.js';
import type { WorldDocument } from './world-document.js';
import {
  type CommitAspectProposalResult,
  DOCUMENT_DEPENDENCY_EFFECT_KINDS,
  DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES,
  type DocumentAspectTarget,
  type DocumentDependencyEffect,
  type DocumentTransactionDiagnostic,
} from './world-document-transaction-model.js';

export function replaceAcceptedAspects(
  document: WorldDocument,
  replacements: ReadonlyMap<AspectId, AcceptedAspectRecord>,
): WorldDocument {
  const maps = document.maps.map((map) => {
    const hasReplacement = map.aspects.some(({ aspectId }) => replacements.has(aspectId));
    if (!hasReplacement) return map;
    return Object.freeze({
      ...map,
      aspects: Object.freeze(
        map.aspects.map((aspect) => replacements.get(aspect.aspectId) ?? aspect),
      ),
    });
  });
  return Object.freeze({ ...document, maps: Object.freeze(maps) });
}

export function rejection(
  document: WorldDocument,
  diagnostics: readonly DocumentTransactionDiagnostic[],
): CommitAspectProposalResult {
  return Object.freeze({
    ok: false,
    document,
    diagnostics: Object.freeze([...diagnostics].sort(compareTransactionDiagnostics)),
  });
}

export function invalidProposalDiagnostic(
  target: DocumentAspectTarget,
): DocumentTransactionDiagnostic {
  return transactionDiagnostic(
    DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.invalidProposal,
    target,
    [target.aspectId],
    [],
    'The proposed replacement did not pass complete generator and transaction validation.',
    'Correct the proposal diagnostics or metadata and regenerate it from accepted inputs.',
  );
}

export function invalidEffectDiagnostic(
  target: DocumentAspectTarget,
  aspectId: AspectId,
): DocumentTransactionDiagnostic {
  return dependencyDiagnostic(
    target,
    false,
    `Declared dependency effect for ${aspectId} does not match deterministic invalidation.`,
    [aspectId],
  );
}

export function dependencyDiagnostic(
  target: DocumentAspectTarget,
  hasCycle: boolean,
  message: string,
  aspectIds: readonly AspectId[] = [target.aspectId],
): DocumentTransactionDiagnostic {
  return transactionDiagnostic(
    hasCycle
      ? DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.cyclicDependencyEffect
      : DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.invalidDependencyEffect,
    target,
    aspectIds,
    [],
    message,
    'Rebuild the command effects from the current validated aspect dependency graph.',
  );
}

export function conflictingLockDiagnostic(
  target: DocumentAspectTarget,
  aspectId: AspectId,
  lockIds: readonly LockId[],
): DocumentTransactionDiagnostic {
  return transactionDiagnostic(
    DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.conflictingLock,
    target,
    [aspectId],
    lockIds,
    `Accepted lock protection conflicts with replacement or invalidation of aspect ${aspectId}.`,
    'Retain the accepted output until the user explicitly removes or resolves the lock.',
  );
}

export function transactionDiagnostic(
  code: DocumentTransactionDiagnostic['code'],
  target: DocumentAspectTarget,
  aspectIds: readonly AspectId[],
  lockIds: readonly LockId[],
  message: string,
  suggestedAction: string,
): DocumentTransactionDiagnostic {
  return Object.freeze({
    code,
    target: Object.freeze({ ...target }),
    aspectIds: Object.freeze([...new Set(aspectIds)].sort(compareAspectIds)),
    lockIds: Object.freeze([...new Set(lockIds)].sort(compareStableReferences)),
    message,
    suggestedAction,
  });
}

export function snapshotDependencyEffects(
  effects: readonly DocumentDependencyEffect[],
): ImmutableDomainSnapshotResult<readonly DocumentDependencyEffect[]> {
  return createImmutableDomainSnapshot(
    [...effects]
      .sort((left, right) => compareAspectIds(left.aspectId, right.aspectId))
      .map(projectDependencyEffect),
  );
}

function projectDependencyEffect(effect: DocumentDependencyEffect): DocumentDependencyEffect {
  if (effect.effect !== DOCUMENT_DEPENDENCY_EFFECT_KINDS.replace) {
    return { aspectId: effect.aspectId, effect: effect.effect };
  }
  return {
    aspectId: effect.aspectId,
    effect: effect.effect,
    commit: {
      target: {
        mapId: effect.commit.target.mapId,
        entityId: effect.commit.target.entityId,
        aspectId: effect.commit.target.aspectId,
      },
      expectedPreviousRevision: effect.commit.expectedPreviousRevision,
      proposedReplacement: effect.commit.proposedReplacement,
      diagnostics: effect.commit.diagnostics,
    },
  };
}

export function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (isAtlasSampleReader(left) || isAtlasSampleReader(right)) {
    return (
      isAtlasSampleReader(left) &&
      isAtlasSampleReader(right) &&
      atlasSampleReadersEqual(left, right)
    );
  }
  if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => deepEqual(value, right[index]))
    );
  }
  const leftRecord = left as Readonly<Record<string, unknown>>;
  const rightRecord = right as Readonly<Record<string, unknown>>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) => key === rightKeys[index] && deepEqual(leftRecord[key], rightRecord[key]),
    )
  );
}

export function deepEqualExceptKey(left: object, right: object, excludedKey: string): boolean {
  const withoutKey = (value: object): Readonly<Record<string, unknown>> =>
    Object.fromEntries(Object.entries(value).filter(([key]) => key !== excludedKey));
  return deepEqual(withoutKey(left), withoutKey(right));
}

function compareTransactionDiagnostics(
  left: DocumentTransactionDiagnostic,
  right: DocumentTransactionDiagnostic,
): number {
  return (
    compareAscii(left.code, right.code) ||
    compareAscii(left.target.mapId, right.target.mapId) ||
    compareAscii(left.target.entityId, right.target.entityId) ||
    compareAscii(left.target.aspectId, right.target.aspectId) ||
    compareAscii(left.aspectIds.join('\0'), right.aspectIds.join('\0')) ||
    compareAscii(left.lockIds.join('\0'), right.lockIds.join('\0')) ||
    compareAscii(left.message, right.message) ||
    compareAscii(left.suggestedAction, right.suggestedAction)
  );
}

function compareAscii(left: string, right: string): -1 | 0 | 1 {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
