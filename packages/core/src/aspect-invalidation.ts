/** Pure direct and transitive invalidation queries over a validated aspect dependency DAG. */

import { getCanonicalAspectDependencyTraversal } from './aspect-dependency-graph.js';
import {
  type AffectedAspect,
  ASPECT_DEPENDENCY_DIAGNOSTIC_CODES,
  ASPECT_INVALIDATION_EFFECTS,
  type AspectDependencyDiagnostic,
  type AspectDependencyEdge,
  type AspectDependencyGraph,
  type AspectInvalidationEffect,
  type AspectInvalidationResult,
  compareAspectDependencyDiagnostics,
  compareAspectDependencyEdges,
  compareAspectIds,
  createAspectDependencyDiagnostic,
  type RegionalContextStaleness,
  uniqueSortedAspectIds,
} from './aspect-dependency-model.js';
import { type AspectId, compareStableReferences } from './identity.js';
import type { AspectLock } from './world-document.js';

/** Query only immediate dependents of the changed aspects. */
export function getDirectAspectInvalidation(
  graph: AspectDependencyGraph,
  changedAspectIds: readonly AspectId[],
  locks: readonly AspectLock[],
): AspectInvalidationResult {
  return queryInvalidation(graph, changedAspectIds, locks, false);
}

/** Query all reachable dependents, stopping at retained locks and stale child contexts. */
export function getTransitiveAspectInvalidation(
  graph: AspectDependencyGraph,
  changedAspectIds: readonly AspectId[],
  locks: readonly AspectLock[],
): AspectInvalidationResult {
  return queryInvalidation(graph, changedAspectIds, locks, true);
}

function queryInvalidation(
  graph: AspectDependencyGraph,
  changedAspectIds: readonly AspectId[],
  locks: readonly AspectLock[],
  isTransitive: boolean,
): AspectInvalidationResult {
  const changed = uniqueSortedAspectIds(changedAspectIds);
  const changedSet = new Set(changed);
  const nodesById = new Map(graph.nodes.map((node) => [node.aspectId, node] as const));
  const dependents = adjacencyByDependency(graph);
  const locksByAspect = groupLocksByAspect(locks);
  const diagnostics: AspectDependencyDiagnostic[] = [];
  const effects = new Map<AspectId, AspectInvalidationEffect>();
  const lockCauses = new Map<AspectId, Set<AspectId>>();
  const staleCauses = new Map<AspectId, Set<AspectId>>();
  const pending = changed.filter((aspectId) => nodesById.has(aspectId));
  const propagated = new Set(pending);

  for (const aspectId of changed) {
    if (nodesById.has(aspectId)) continue;
    diagnostics.push(
      createAspectDependencyDiagnostic(
        ASPECT_DEPENDENCY_DIAGNOSTIC_CODES.missingNode,
        'error',
        [aspectId],
        [],
        [],
        `Invalidation source ${aspectId} is not present in the dependency graph.`,
        'Refresh the graph from the accepted world document and retry with an existing aspect ID.',
      ),
    );
  }

  while (pending.length > 0) {
    const sourceAspectId = pending.shift();
    if (sourceAspectId === undefined) break;
    for (const edge of dependents.get(sourceAspectId) ?? []) {
      const targetAspectId = edge.dependentAspectId;
      if (changedSet.has(targetAspectId)) continue;
      const targetLocks = locksByAspect.get(targetAspectId) ?? [];
      const isContextStale = edge.contextProvenance !== undefined;
      const effect =
        targetLocks.length > 0
          ? ASPECT_INVALIDATION_EFFECTS.lockedInconsistent
          : isContextStale
            ? ASPECT_INVALIDATION_EFFECTS.staleContext
            : ASPECT_INVALIDATION_EFFECTS.invalidated;
      effects.set(targetAspectId, strongerEffect(effects.get(targetAspectId), effect));

      if (targetLocks.length > 0) appendCause(lockCauses, targetAspectId, sourceAspectId);
      if (isContextStale) appendCause(staleCauses, targetAspectId, sourceAspectId);

      if (
        isTransitive &&
        targetLocks.length === 0 &&
        !isContextStale &&
        !propagated.has(targetAspectId)
      ) {
        propagated.add(targetAspectId);
        pending.push(targetAspectId);
      }
    }
  }

  for (const [aspectId, causes] of lockCauses) {
    const node = nodesById.get(aspectId);
    diagnostics.push(
      createAspectDependencyDiagnostic(
        ASPECT_DEPENDENCY_DIAGNOSTIC_CODES.lockedOutputInconsistent,
        'warning',
        [...causes, aspectId],
        node === undefined ? [] : [node.mapId],
        (locksByAspect.get(aspectId) ?? []).map((lock) => lock.lockId),
        `Locked aspect ${aspectId} is inconsistent with an upstream invalidation.`,
        'Keep the accepted locked output and ask the user to resolve or remove the conflicting lock.',
      ),
    );
  }

  const traversal = getCanonicalAspectDependencyTraversal(graph);
  const affectedAspects = traversal.flatMap((aspectId): readonly AffectedAspect[] => {
    const effect = effects.get(aspectId);
    return effect === undefined ? [] : [Object.freeze({ aspectId, effect })];
  });

  return Object.freeze({
    changedAspectIds: changed,
    affectedAspects: Object.freeze(affectedAspects),
    staleContexts: createStaleContexts(staleCauses, nodesById),
    diagnostics: Object.freeze(diagnostics.sort(compareAspectDependencyDiagnostics)),
  });
}

function adjacencyByDependency(
  graph: AspectDependencyGraph,
): ReadonlyMap<AspectId, readonly AspectDependencyEdge[]> {
  const adjacency = new Map<AspectId, AspectDependencyEdge[]>();
  for (const edge of graph.edges) {
    const edges = adjacency.get(edge.dependencyAspectId);
    if (edges === undefined) adjacency.set(edge.dependencyAspectId, [edge]);
    else edges.push(edge);
  }
  for (const edges of adjacency.values()) edges.sort(compareAspectDependencyEdges);
  return adjacency;
}

function createStaleContexts(
  causesByAspect: ReadonlyMap<AspectId, ReadonlySet<AspectId>>,
  nodesById: ReadonlyMap<AspectId, AspectDependencyGraph['nodes'][number]>,
): readonly RegionalContextStaleness[] {
  const contexts: RegionalContextStaleness[] = [];
  for (const [contextStatusAspectId, causes] of causesByAspect) {
    const node = nodesById.get(contextStatusAspectId);
    if (node === undefined) continue;
    contexts.push(
      Object.freeze({
        regionalMapId: node.mapId,
        contextStatusAspectId,
        status: 'stale',
        invalidatedParentAspectIds: uniqueSortedAspectIds([...causes]),
      }),
    );
  }
  contexts.sort(
    (left, right) =>
      compareStableReferences(left.regionalMapId, right.regionalMapId) ||
      compareAspectIds(left.contextStatusAspectId, right.contextStatusAspectId),
  );
  return Object.freeze(contexts);
}

function groupLocksByAspect(
  locks: readonly AspectLock[],
): ReadonlyMap<AspectId, readonly AspectLock[]> {
  const grouped = new Map<AspectId, AspectLock[]>();
  for (const lock of locks) {
    const group = grouped.get(lock.target.aspectId);
    if (group === undefined) grouped.set(lock.target.aspectId, [lock]);
    else group.push(lock);
  }
  for (const group of grouped.values()) {
    group.sort((left, right) => compareStableReferences(left.lockId, right.lockId));
  }
  return grouped;
}

function appendCause(
  causes: Map<AspectId, Set<AspectId>>,
  targetAspectId: AspectId,
  causeAspectId: AspectId,
): void {
  const current = causes.get(targetAspectId);
  if (current === undefined) causes.set(targetAspectId, new Set([causeAspectId]));
  else current.add(causeAspectId);
}

function strongerEffect(
  current: AspectInvalidationEffect | undefined,
  candidate: AspectInvalidationEffect,
): AspectInvalidationEffect {
  if (current === ASPECT_INVALIDATION_EFFECTS.lockedInconsistent) return current;
  if (candidate === ASPECT_INVALIDATION_EFFECTS.lockedInconsistent) return candidate;
  if (current === ASPECT_INVALIDATION_EFFECTS.staleContext) return current;
  return candidate;
}
