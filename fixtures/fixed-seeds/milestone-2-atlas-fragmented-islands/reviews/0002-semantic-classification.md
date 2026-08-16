# Milestone 2 fragmented islands — semantic classification acceptance

## Intended behavior

Accept version-1 semantic evidence for fragmented but coherent land, including continents, major
islands, smaller islands, and disjoint archipelago and island-chain relationships. Exact accepted
sample ownership and marine relationships must remain valid and deterministic.

## Changed evidence

- `fixed-seeds/milestone-2-atlas-fragmented-islands/expected/baseline/atlas-land-water.kernel.canonical`

## Version and compatibility consequence

This accepts semantic-classification, semantic-generator-manifest, semantic-parameter-schema, and
semantic-policy version 1. Existing atlas field and partition versions remain unchanged. The
evidence remains pre-persistence and does not accept coastline or renderer output.

## Evidence reviewed

The canonical semantic primitive traversal, stable component/entity/aspect IDs, exact ownership,
major-island and island thresholds, mutually exclusive group kinds, disjoint membership, ordered
chain, containment, enclosure, connectivity, dependency proposals, and canonical ordering were
reviewed. Coastline, SVG, visual, and authoritative package evidence are not applicable to issue
#59.
