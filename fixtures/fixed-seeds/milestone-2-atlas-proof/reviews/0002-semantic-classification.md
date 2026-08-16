# Milestone 2 atlas proof — semantic classification acceptance

## Intended behavior

Accept version-1 semantic classification evidence for the default fixed atlas. Every accepted
sample must have exactly one stable landmass or water-body owner, and containment, enclosure,
connectivity, identity, and order must validate without changing the accepted #58 partition.

## Changed evidence

- `fixed-seeds/milestone-2-atlas-proof/expected/baseline/atlas-land-water.kernel.canonical`

## Version and compatibility consequence

This accepts semantic-classification, semantic-generator-manifest, semantic-parameter-schema, and
semantic-policy version 1. Existing atlas field and partition versions remain unchanged. The
evidence remains pre-persistence and does not accept coastline or renderer output.

## Evidence reviewed

The canonical semantic primitive traversal, stable component/entity/aspect IDs, exact ownership,
landmass kinds, water-body kinds, island containment, sea enclosure, ocean connectivity,
dependency proposals, and canonical ordering were reviewed. Coastline, SVG, visual, and
authoritative package evidence are not applicable to issue #59.
