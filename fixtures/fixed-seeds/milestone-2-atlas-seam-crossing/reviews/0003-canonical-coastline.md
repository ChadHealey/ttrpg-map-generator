# Seam-crossing atlas — canonical coastline acceptance

## Intended behavior

Accept version-1 canonical coastline evidence for the dedicated seam-crossing atlas. At least one
retained landmass loop must cross the canonical longitude seam continuously, with protected seam
vertices, stable source identity, and no duplicate or world-spanning repair edge.

## Changed evidence

- `fixed-seeds/milestone-2-atlas-seam-crossing/expected/baseline/atlas-land-water.kernel.canonical`

## Version and compatibility consequence

This accepts coastline geometry, extraction, simplification-policy, topology-validation,
generator-manifest, and parameter-schema version 1. Existing field, partition, and semantic
versions remain unchanged. Projection and render compatibility are deferred to issue #61.

## Evidence reviewed

Seam-crossing ring count, protected canonical seam behavior, exact source-boundary coverage,
ring/source IDs, winding, simplification counts, topology, ordering, pole classifications, and
repeat bytes were reviewed. Existing semantic evidence is unchanged; SVG, PNG, visual, and
authoritative-file evidence are not applicable to issue #60.
