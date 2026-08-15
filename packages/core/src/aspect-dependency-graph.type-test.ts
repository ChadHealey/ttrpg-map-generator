import type {
  AspectDependencyGraph,
  AspectDependencyNode,
  AspectInvalidationResult,
} from './aspect-dependency-model.js';

declare const graph: AspectDependencyGraph;
declare const node: AspectDependencyNode;
declare const invalidation: AspectInvalidationResult;
declare const otherAspectId: AspectDependencyNode['aspectId'];
declare const nodes: AspectDependencyGraph['nodes'];
declare const edges: AspectDependencyGraph['edges'];

// @ts-expect-error Only validation can construct a branded dependency graph.
const fabricatedGraph: AspectDependencyGraph = { nodes, edges };

// @ts-expect-error Graph topology is readonly after validation.
graph.nodes = [];
// @ts-expect-error Stable aspect identity cannot be replaced on a graph node.
node.aspectId = otherAspectId;
// @ts-expect-error Query results cannot mutate accepted dependency state.
invalidation.affectedAspects = [];
// @ts-expect-error Dependency nodes contain no ownership-tree parent pointer.
node.ownerEntityId = 'display-name';

void [graph, node, invalidation, otherAspectId, fabricatedGraph];
