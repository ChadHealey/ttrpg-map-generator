# Milestone 2 seam crossing — semantic classification acceptance

## Intended behavior

Accept version-1 semantic evidence that treats seam-adjacent samples as one globe-aware component.
Stable membership, identity, containment, enclosure, and connectivity must be independent of the
atlas chart cut and cover every accepted sample exactly once.

## Changed evidence

- `fixed-seeds/milestone-2-atlas-seam-crossing/expected/baseline/atlas-land-water.kernel.canonical`

## Version and compatibility consequence

This accepts semantic-classification, semantic-generator-manifest, semantic-parameter-schema, and
semantic-policy version 1. Existing atlas field and partition versions remain unchanged. The
evidence remains pre-persistence and does not accept coastline or renderer output.

## Evidence reviewed

The canonical semantic primitive traversal, stable component/entity/aspect IDs, seam-crossing
land ownership, single-pole topology, containment, sea enclosure, ocean connectivity, dependency
proposals, and canonical ordering were reviewed. Coastline, SVG, visual, and authoritative package
evidence are not applicable to issue #59.
