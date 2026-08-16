# Minimum-control atlas — display projection acceptance

## Intended behavior

Accept version-1 disposable equirectangular projection evidence for the land-biased minimum-control
atlas, including its near-pole coastline paths.

## Changed evidence

- `fixed-seeds/milestone-2-atlas-control-min/expected/baseline/atlas-land-water.kernel.canonical`

## Version and compatibility consequence

This introduces display-projection version 1 and seam-policy version 1. Accepted field,
classification, semantic, coastline, seed, persistence, and style versions remain unchanged.

## Evidence reviewed

Projection metadata, polar-adjacent paths, stable path ordering and identity, source provenance,
source immutability, seam-split counts, display bounds, zero preview/full semantic tolerance, and
projected traversal hash were reviewed. Canonical coastline evidence remains unchanged; SVG, PNG,
visual, and authoritative-file evidence are not yet owned by this fixture.
