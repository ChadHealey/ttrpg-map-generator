/** Shared immutable records and canonical ordering for aspect dependency behavior. */

import type { InheritedContextDependencyProvenance } from './generated-aspects.js';
import { type AspectId, compareStableReferences, type LockId, type MapId } from './identity.js';

declare const VALIDATED_ASPECT_DEPENDENCY_GRAPH: unique symbol;

export const ASPECT_DEPENDENCY_DIAGNOSTIC_CODES = {
  cycleDetected: 'aspect-dependency.cycle.detected',
  duplicateNode: 'aspect-dependency.node.duplicate',
  invalidCrossMapEdge: 'aspect-dependency.cross-map.invalid',
  lockedOutputInconsistent: 'aspect-dependency.lock.inconsistent',
  missingNode: 'aspect-dependency.node.missing',
} as const;

export type AspectDependencyDiagnosticCode =
  (typeof ASPECT_DEPENDENCY_DIAGNOSTIC_CODES)[keyof typeof ASPECT_DEPENDENCY_DIAGNOSTIC_CODES];

/** A stable, actionable graph or invalidation finding. */
export interface AspectDependencyDiagnostic {
  readonly code: AspectDependencyDiagnosticCode;
  readonly severity: 'error' | 'warning';
  readonly aspectIds: readonly AspectId[];
  readonly mapIds: readonly MapId[];
  readonly lockIds: readonly LockId[];
  readonly message: string;
  readonly suggestedAction: string;
}

export type AspectDependencyNodeKind = 'accepted' | 'regional-context-status';

/** A graph node identified only by its opaque aspect ID. */
export interface AspectDependencyNode {
  readonly aspectId: AspectId;
  readonly mapId: MapId;
  readonly kind: AspectDependencyNodeKind;
}

/** A directed edge from one required upstream aspect to its dependent aspect. */
export interface AspectDependencyEdge {
  readonly dependencyAspectId: AspectId;
  readonly dependentAspectId: AspectId;
  readonly contextProvenance?: InheritedContextDependencyProvenance;
}

/** A validated DAG structurally separate from map/entity ownership and accepted output. */
export interface AspectDependencyGraph {
  readonly nodes: readonly AspectDependencyNode[];
  readonly edges: readonly AspectDependencyEdge[];
  readonly [VALIDATED_ASPECT_DEPENDENCY_GRAPH]: true;
}

export type AspectDependencyGraphResult =
  | { readonly ok: true; readonly graph: AspectDependencyGraph }
  | { readonly ok: false; readonly diagnostics: readonly AspectDependencyDiagnostic[] };

export const ASPECT_INVALIDATION_EFFECTS = {
  invalidated: 'invalidated',
  lockedInconsistent: 'locked-inconsistent',
  staleContext: 'stale-context',
} as const;

export type AspectInvalidationEffect =
  (typeof ASPECT_INVALIDATION_EFFECTS)[keyof typeof ASPECT_INVALIDATION_EFFECTS];

/** Query-time effect on one accepted aspect. No accepted record is changed. */
export interface AffectedAspect {
  readonly aspectId: AspectId;
  readonly effect: AspectInvalidationEffect;
}

/** Cross-map metadata reported when current parent input differs from accepted child context. */
export interface RegionalContextStaleness {
  readonly regionalMapId: MapId;
  readonly contextStatusAspectId: AspectId;
  readonly status: 'stale';
  readonly invalidatedParentAspectIds: readonly AspectId[];
}

/** Complete immutable result of a direct or transitive invalidation query. */
export interface AspectInvalidationResult {
  readonly changedAspectIds: readonly AspectId[];
  readonly affectedAspects: readonly AffectedAspect[];
  readonly staleContexts: readonly RegionalContextStaleness[];
  readonly diagnostics: readonly AspectDependencyDiagnostic[];
}

export function createAspectDependencyDiagnostic(
  code: AspectDependencyDiagnosticCode,
  severity: AspectDependencyDiagnostic['severity'],
  aspectIds: readonly AspectId[],
  mapIds: readonly MapId[],
  lockIds: readonly LockId[],
  message: string,
  suggestedAction: string,
): AspectDependencyDiagnostic {
  return Object.freeze({
    code,
    severity,
    aspectIds: uniqueSortedAspectIds(aspectIds),
    mapIds: Object.freeze([...new Set(mapIds)].sort(compareStableReferences)),
    lockIds: Object.freeze([...new Set(lockIds)].sort(compareStableReferences)),
    message,
    suggestedAction,
  });
}

export function compareAspectDependencyDiagnostics(
  left: AspectDependencyDiagnostic,
  right: AspectDependencyDiagnostic,
): number {
  return (
    compareAscii(left.code, right.code) ||
    compareAscii(left.severity, right.severity) ||
    compareAscii(left.aspectIds.join('\0'), right.aspectIds.join('\0')) ||
    compareAscii(left.mapIds.join('\0'), right.mapIds.join('\0')) ||
    compareAscii(left.lockIds.join('\0'), right.lockIds.join('\0')) ||
    compareAscii(left.message, right.message) ||
    compareAscii(left.suggestedAction, right.suggestedAction)
  );
}

export function aspectDependencyEdgeKey(edge: AspectDependencyEdge): string {
  const provenance = edge.contextProvenance;
  return [
    edge.dependencyAspectId,
    edge.dependentAspectId,
    provenance?.kind ?? '',
    provenance?.parentMapId ?? '',
    provenance?.childMapId ?? '',
  ].join('\0');
}

export function compareAspectDependencyEdges(
  left: AspectDependencyEdge,
  right: AspectDependencyEdge,
): number {
  return compareAscii(aspectDependencyEdgeKey(left), aspectDependencyEdgeKey(right));
}

export function compareAspectDependencyNodes(
  left: AspectDependencyNode,
  right: AspectDependencyNode,
): number {
  return compareAspectIds(left.aspectId, right.aspectId) || compareAscii(left.kind, right.kind);
}

export function compareAspectIds(left: AspectId, right: AspectId): -1 | 0 | 1 {
  return compareStableReferences(left, right);
}

export function uniqueSortedAspectIds(aspectIds: readonly AspectId[]): readonly AspectId[] {
  return Object.freeze([...new Set(aspectIds)].sort(compareAspectIds));
}

function compareAscii(left: string, right: string): -1 | 0 | 1 {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
