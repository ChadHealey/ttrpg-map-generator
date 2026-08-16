# Fragmented-islands atlas — canonical coastline acceptance

## Intended behavior

Accept version-1 canonical coastline evidence for the fragmented island-heavy atlas. Every
retained major island and small island must keep a distinct, closed source-linked loop, and
simplification must not erase narrow channels or accepted features.

## Changed evidence

- `fixed-seeds/milestone-2-atlas-fragmented-islands/expected/baseline/atlas-land-water.kernel.canonical`

## Version and compatibility consequence

This accepts coastline geometry, extraction, simplification-policy, topology-validation,
generator-manifest, and parameter-schema version 1. Existing field, partition, semantic, and
island-group versions remain unchanged. Evidence remains pre-persistence.

## Evidence reviewed

All ring/source identities, exact classified-edge coverage, small-island retention, channel
preservation, land-left winding, simplification counts, topology, ordering, seam/pole values, and
repeat bytes were reviewed. Existing semantic evidence is unchanged; projected, SVG, PNG, visual,
and authoritative-file evidence are not applicable to issue #60.
