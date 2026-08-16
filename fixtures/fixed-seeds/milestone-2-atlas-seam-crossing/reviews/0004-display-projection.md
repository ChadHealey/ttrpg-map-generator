# Seam-crossing atlas — display projection acceptance

## Intended behavior

Accept version-1 disposable equirectangular projection evidence for the dedicated seam-crossing
atlas. Canonical rings crossing in either direction split into stable open display paths with paired
edge endpoints and no world-spanning stroke.

## Changed evidence

- `fixed-seeds/milestone-2-atlas-seam-crossing/expected/baseline/atlas-land-water.kernel.canonical`

## Version and compatibility consequence

This introduces display-projection version 1 and seam-policy version 1. Accepted field,
classification, semantic, coastline, seed, persistence, and style versions remain unchanged.

## Evidence reviewed

Projection metadata, both seam directions, stable path ordering and identity, source provenance,
source immutability, paired seam endpoints, no world-spanning segments, display bounds, zero
preview/full semantic tolerance, and projected traversal hash were reviewed. Canonical coastline
evidence remains unchanged; SVG, PNG, visual, and authoritative-file evidence are not yet owned by
this fixture.
