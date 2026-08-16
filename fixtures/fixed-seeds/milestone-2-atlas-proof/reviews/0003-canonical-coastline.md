# Milestone 2 atlas proof — canonical coastline acceptance

## Intended behavior

Accept version-1 canonical planet-native coastline evidence for the default fixed atlas. The
coastline must cover every accepted land/water adjacency exactly once, retain stable semantic
source links, use land-left winding, remain valid across the canonical seam, and simplify only
within the reviewed quarter-cell guard.

## Changed evidence

- `fixed-seeds/milestone-2-atlas-proof/expected/baseline/atlas-land-water.kernel.canonical`

## Version and compatibility consequence

This accepts coastline geometry, extraction, simplification-policy, topology-validation,
generator-manifest, and parameter-schema version 1. Existing field, partition, and semantic
classification versions and bytes remain unchanged. The evidence remains pre-persistence and
does not accept projected, render, SVG, PNG, or authoritative package output.

## Evidence reviewed

The canonical coastline primitive traversal, ring/source identities, complete dependency list,
raw and simplified point counts, stable ordering, seam continuity, pole classifications,
reject-only repair metadata, and generator-free accepted-record validation were reviewed. Existing
macro field, classification, semantic ownership, containment, and connectivity evidence remains
present and unchanged; visual and authoritative-file evidence are not applicable to issue #60.
