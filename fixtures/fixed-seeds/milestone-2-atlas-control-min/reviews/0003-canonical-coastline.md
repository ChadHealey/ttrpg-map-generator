# Minimum-control atlas — canonical coastline acceptance

## Intended behavior

Accept version-1 canonical coastline evidence for the minimum-control atlas, including its
explicit polar land behavior. The large retained forms and every smaller loop must remain
continuous, source-linked, and topologically valid without renderer repair.

## Changed evidence

- `fixed-seeds/milestone-2-atlas-control-min/expected/baseline/atlas-land-water.kernel.canonical`

## Version and compatibility consequence

This accepts coastline geometry, extraction, simplification-policy, topology-validation,
generator-manifest, and parameter-schema version 1. Field, partition, and semantic versions stay
unchanged. Evidence remains pre-persistence and does not select a display projection.

## Evidence reviewed

Polar classifications, canonical ring/source IDs, exact boundary coverage, winding, protected
seam/pole behavior, guarded point reduction, topology, ordering, and repeat bytes were reviewed.
Prior semantic evidence remains unchanged; SVG, PNG, visual, and authoritative files are not
applicable to issue #60.
