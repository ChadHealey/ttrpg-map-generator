/**
 * Deterministic aspect dependency validation and traversal.
 *
 * The graph is a disposable structural view over accepted aspect metadata. It does not own
 * maps or entities and never contains accepted output or a document mutation capability.
 */

import {
  ASPECT_DEPENDENCY_DIAGNOSTIC_CODES,
  type AspectDependencyDiagnostic,
  type AspectDependencyEdge,
  aspectDependencyEdgeKey,
  type AspectDependencyGraph,
  type AspectDependencyGraphResult,
  type AspectDependencyNode,
  compareAspectDependencyDiagnostics,
  compareAspectDependencyEdges,
  compareAspectDependencyNodes,
  compareAspectIds,
  createAspectDependencyDiagnostic,
} from './aspect-dependency-model.js';
import {
  ASPECT_DEPENDENCY_PROVENANCE_KINDS,
  type AspectDependencyReference,
} from './generated-aspects.js';
import type { AspectId, MapId } from './identity.js';
import { MAP_KINDS, type MapDocument, type WorldDocument } from './world-document.js';

interface NodeOccurrence {
  readonly node: AspectDependencyNode;
  readonly dependencyAspects: readonly AspectDependencyReference[];
}

interface GraphAnalysis {
  readonly diagnostics: readonly AspectDependencyDiagnostic[];
  readonly graph?: AspectDependencyGraph;
}

/** Validate aspect dependencies and return findings in canonical order. */
export function validateAspectDependencyGraph(
  document: WorldDocument,
): readonly AspectDependencyDiagnostic[] {
  return analyzeGraph(document).diagnostics;
}

/** Build a validated immutable DAG from accepted aspect metadata. */
export function createAspectDependencyGraph(document: WorldDocument): AspectDependencyGraphResult {
  const analysis = analyzeGraph(document);
  if (analysis.graph === undefined) {
    return Object.freeze({ ok: false, diagnostics: analysis.diagnostics });
  }
  return Object.freeze({ ok: true, graph: analysis.graph });
}

/** Return a stable dependency-before-dependent topological traversal. */
export function getCanonicalAspectDependencyTraversal(
  graph: AspectDependencyGraph,
): readonly AspectId[] {
  const indegrees = new Map<AspectId, number>(
    graph.nodes.map((node) => [node.aspectId, 0] as const),
  );
  const dependents = adjacencyByDependency(graph);
  for (const edge of graph.edges) {
    indegrees.set(edge.dependentAspectId, (indegrees.get(edge.dependentAspectId) ?? 0) + 1);
  }

  const ready = graph.nodes
    .filter((node) => indegrees.get(node.aspectId) === 0)
    .map((node) => node.aspectId)
    .sort(compareAspectIds);
  const traversal: AspectId[] = [];

  while (ready.length > 0) {
    const aspectId = ready.shift();
    if (aspectId === undefined) break;
    traversal.push(aspectId);
    for (const edge of dependents.get(aspectId) ?? []) {
      const nextIndegree = (indegrees.get(edge.dependentAspectId) ?? 0) - 1;
      indegrees.set(edge.dependentAspectId, nextIndegree);
      if (nextIndegree === 0) {
        ready.push(edge.dependentAspectId);
        ready.sort(compareAspectIds);
      }
    }
  }

  return Object.freeze(traversal);
}

function analyzeGraph(document: WorldDocument): GraphAnalysis {
  const diagnostics: AspectDependencyDiagnostic[] = [];
  const occurrences = collectNodeOccurrences(document);
  const occurrencesById = groupOccurrencesById(occurrences);
  const nodes: AspectDependencyNode[] = [];
  const uniqueOccurrences = new Map<AspectId, NodeOccurrence>();

  for (const [aspectId, group] of [...occurrencesById].sort(([left], [right]) =>
    compareAspectIds(left, right),
  )) {
    if (group.length !== 1) {
      diagnostics.push(
        createAspectDependencyDiagnostic(
          ASPECT_DEPENDENCY_DIAGNOSTIC_CODES.duplicateNode,
          'error',
          [aspectId],
          group.map((occurrence) => occurrence.node.mapId),
          [],
          `Aspect ${aspectId} appears more than once in the dependency graph.`,
          'Give every accepted aspect one stable ID and one owning record.',
        ),
      );
      continue;
    }
    const occurrence = group[0];
    if (occurrence === undefined) continue;
    nodes.push(occurrence.node);
    uniqueOccurrences.set(aspectId, occurrence);
  }

  nodes.sort(compareAspectDependencyNodes);
  const nodesById = new Map(nodes.map((node) => [node.aspectId, node] as const));
  const mapsById = uniqueMapsById(document.maps);
  diagnostics.push(...missingContextStatusDiagnostics(document, nodesById));

  const edges = collectEdges(uniqueOccurrences);
  for (const edge of edges) {
    const dependencyNode = nodesById.get(edge.dependencyAspectId);
    const dependentNode = nodesById.get(edge.dependentAspectId);
    if (dependencyNode === undefined) {
      diagnostics.push(
        createAspectDependencyDiagnostic(
          ASPECT_DEPENDENCY_DIAGNOSTIC_CODES.missingNode,
          'error',
          [edge.dependencyAspectId, edge.dependentAspectId],
          dependentNode === undefined ? [] : [dependentNode.mapId],
          [],
          `Aspect ${edge.dependentAspectId} requires missing aspect ${edge.dependencyAspectId}.`,
          'Restore the required accepted aspect or remove the dependency declaration.',
        ),
      );
      continue;
    }
    if (dependentNode === undefined) continue;
    if (!isValidEdgeBoundary(edge, dependencyNode, dependentNode, mapsById)) {
      diagnostics.push(invalidCrossMapDiagnostic(dependencyNode, dependentNode));
    }
  }

  diagnostics.push(...cycleDiagnostics(nodes, edges));
  const orderedDiagnostics = Object.freeze(diagnostics.sort(compareAspectDependencyDiagnostics));
  if (orderedDiagnostics.length > 0) return Object.freeze({ diagnostics: orderedDiagnostics });

  return Object.freeze({
    diagnostics: orderedDiagnostics,
    graph: Object.freeze({
      nodes: freezeNodes(nodes),
      edges: freezeEdges(edges),
    }) as AspectDependencyGraph,
  });
}

function collectNodeOccurrences(document: WorldDocument): readonly NodeOccurrence[] {
  const contextStatusIds = new Map<MapId, AspectId>();
  for (const map of document.maps) {
    if (map.mapKind === MAP_KINDS.regional) {
      contextStatusIds.set(map.mapId, map.parent.contextStatusAspectId);
    }
  }

  const occurrences: NodeOccurrence[] = [];
  for (const map of document.maps) {
    for (const aspect of map.aspects) {
      occurrences.push({
        node: Object.freeze({
          aspectId: aspect.aspectId,
          mapId: map.mapId,
          kind:
            contextStatusIds.get(map.mapId) === aspect.aspectId
              ? 'regional-context-status'
              : 'accepted',
        }),
        dependencyAspects: aspect.dependencyAspects,
      });
    }
  }
  return occurrences;
}

function groupOccurrencesById(
  occurrences: readonly NodeOccurrence[],
): ReadonlyMap<AspectId, readonly NodeOccurrence[]> {
  const grouped = new Map<AspectId, NodeOccurrence[]>();
  for (const occurrence of occurrences) {
    const group = grouped.get(occurrence.node.aspectId);
    if (group === undefined) grouped.set(occurrence.node.aspectId, [occurrence]);
    else group.push(occurrence);
  }
  return grouped;
}

function collectEdges(
  occurrences: ReadonlyMap<AspectId, NodeOccurrence>,
): readonly AspectDependencyEdge[] {
  const edges = new Map<string, AspectDependencyEdge>();
  for (const occurrence of occurrences.values()) {
    for (const dependency of occurrence.dependencyAspects) {
      const edge = Object.freeze({
        dependencyAspectId: dependency.aspectId,
        dependentAspectId: occurrence.node.aspectId,
        ...(dependency.contextProvenance === undefined
          ? {}
          : { contextProvenance: dependency.contextProvenance }),
      });
      edges.set(aspectDependencyEdgeKey(edge), edge);
    }
  }
  return [...edges.values()].sort(compareAspectDependencyEdges);
}

function missingContextStatusDiagnostics(
  document: WorldDocument,
  nodesById: ReadonlyMap<AspectId, AspectDependencyNode>,
): readonly AspectDependencyDiagnostic[] {
  const diagnostics: AspectDependencyDiagnostic[] = [];
  for (const map of document.maps) {
    if (map.mapKind !== MAP_KINDS.regional) continue;
    const node = nodesById.get(map.parent.contextStatusAspectId);
    if (node?.mapId === map.mapId && node.kind === 'regional-context-status') continue;
    diagnostics.push(
      createAspectDependencyDiagnostic(
        ASPECT_DEPENDENCY_DIAGNOSTIC_CODES.missingNode,
        'error',
        [map.parent.contextStatusAspectId],
        [map.mapId],
        [],
        `Regional map ${map.mapId} requires context-status aspect ${map.parent.contextStatusAspectId}.`,
        'Restore the regional map context-status aspect named by its parent record.',
      ),
    );
  }
  return diagnostics;
}

function isValidEdgeBoundary(
  edge: AspectDependencyEdge,
  dependencyNode: AspectDependencyNode,
  dependentNode: AspectDependencyNode,
  mapsById: ReadonlyMap<MapId, MapDocument>,
): boolean {
  const crossesMaps = dependencyNode.mapId !== dependentNode.mapId;
  const provenance = edge.contextProvenance;
  if (!crossesMaps) return provenance === undefined;
  if (provenance?.kind !== ASPECT_DEPENDENCY_PROVENANCE_KINDS.inheritedContext) return false;

  const parentMap = mapsById.get(dependencyNode.mapId);
  const childMap = mapsById.get(dependentNode.mapId);
  return (
    parentMap?.mapKind === MAP_KINDS.world &&
    childMap?.mapKind === MAP_KINDS.regional &&
    provenance.parentMapId === dependencyNode.mapId &&
    provenance.childMapId === dependentNode.mapId &&
    childMap.parent.parentMapId === dependencyNode.mapId &&
    childMap.parent.contextStatusAspectId === dependentNode.aspectId &&
    dependentNode.kind === 'regional-context-status'
  );
}

function invalidCrossMapDiagnostic(
  dependencyNode: AspectDependencyNode,
  dependentNode: AspectDependencyNode,
): AspectDependencyDiagnostic {
  return createAspectDependencyDiagnostic(
    ASPECT_DEPENDENCY_DIAGNOSTIC_CODES.invalidCrossMapEdge,
    'error',
    [dependencyNode.aspectId, dependentNode.aspectId],
    [dependencyNode.mapId, dependentNode.mapId],
    [],
    `Dependency ${dependencyNode.aspectId} -> ${dependentNode.aspectId} does not use a valid parent-to-child context-status boundary.`,
    'Route cross-map invalidation through the regional child context-status aspect with declared inherited-context provenance.',
  );
}

function cycleDiagnostics(
  nodes: readonly AspectDependencyNode[],
  edges: readonly AspectDependencyEdge[],
): readonly AspectDependencyDiagnostic[] {
  const nodeIds = new Set(nodes.map((node) => node.aspectId));
  const adjacency = new Map<AspectId, AspectId[]>();
  for (const edge of edges) {
    if (!nodeIds.has(edge.dependencyAspectId) || !nodeIds.has(edge.dependentAspectId)) continue;
    const targets = adjacency.get(edge.dependencyAspectId);
    if (targets === undefined) adjacency.set(edge.dependencyAspectId, [edge.dependentAspectId]);
    else targets.push(edge.dependentAspectId);
  }
  for (const targets of adjacency.values()) targets.sort(compareAspectIds);

  const indexes = new Map<AspectId, number>();
  const lowLinks = new Map<AspectId, number>();
  const stack: AspectId[] = [];
  const onStack = new Set<AspectId>();
  const components: AspectId[][] = [];
  let nextIndex = 0;

  function connect(aspectId: AspectId): void {
    const index = nextIndex;
    nextIndex += 1;
    indexes.set(aspectId, index);
    lowLinks.set(aspectId, index);
    stack.push(aspectId);
    onStack.add(aspectId);

    for (const dependentId of adjacency.get(aspectId) ?? []) {
      if (!indexes.has(dependentId)) {
        connect(dependentId);
        lowLinks.set(
          aspectId,
          Math.min(lowLinks.get(aspectId) ?? index, lowLinks.get(dependentId) ?? index),
        );
      } else if (onStack.has(dependentId)) {
        lowLinks.set(
          aspectId,
          Math.min(lowLinks.get(aspectId) ?? index, indexes.get(dependentId) ?? index),
        );
      }
    }

    if (lowLinks.get(aspectId) !== indexes.get(aspectId)) return;
    const component: AspectId[] = [];
    while (stack.length > 0) {
      const member = stack.pop();
      if (member === undefined) break;
      onStack.delete(member);
      component.push(member);
      if (member === aspectId) break;
    }
    component.sort(compareAspectIds);
    components.push(component);
  }

  for (const node of [...nodes].sort(compareAspectDependencyNodes)) {
    if (!indexes.has(node.aspectId)) connect(node.aspectId);
  }

  const nodesById = new Map(nodes.map((node) => [node.aspectId, node] as const));
  return components
    .filter(
      (component) =>
        component.length > 1 ||
        (component[0] !== undefined && (adjacency.get(component[0]) ?? []).includes(component[0])),
    )
    .map((component) =>
      createAspectDependencyDiagnostic(
        ASPECT_DEPENDENCY_DIAGNOSTIC_CODES.cycleDetected,
        'error',
        component,
        component.flatMap((aspectId) => {
          const node = nodesById.get(aspectId);
          return node === undefined ? [] : [node.mapId];
        }),
        [],
        `Aspect dependencies contain a cycle among ${component.join(', ')}.`,
        'Remove at least one dependency edge so every aspect has an acyclic upstream path.',
      ),
    );
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

function uniqueMapsById(maps: readonly MapDocument[]): ReadonlyMap<MapId, MapDocument> {
  const grouped = new Map<MapId, MapDocument[]>();
  for (const map of maps) {
    const group = grouped.get(map.mapId);
    if (group === undefined) grouped.set(map.mapId, [map]);
    else group.push(map);
  }
  const unique = new Map<MapId, MapDocument>();
  for (const [mapId, group] of grouped) {
    const map = group.length === 1 ? group[0] : undefined;
    if (map !== undefined) unique.set(mapId, map);
  }
  return unique;
}

function freezeNodes(nodes: readonly AspectDependencyNode[]): readonly AspectDependencyNode[] {
  return Object.freeze(nodes.map((node) => Object.freeze({ ...node })));
}

function freezeEdges(nodes: readonly AspectDependencyEdge[]): readonly AspectDependencyEdge[] {
  return Object.freeze(
    nodes.map((edge) =>
      Object.freeze({
        dependencyAspectId: edge.dependencyAspectId,
        dependentAspectId: edge.dependentAspectId,
        ...(edge.contextProvenance === undefined
          ? {}
          : { contextProvenance: Object.freeze({ ...edge.contextProvenance }) }),
      }),
    ),
  );
}
