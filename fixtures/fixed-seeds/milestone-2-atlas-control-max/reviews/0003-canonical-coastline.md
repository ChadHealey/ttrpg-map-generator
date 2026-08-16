# Maximum-control atlas — canonical coastline acceptance

## Intended behavior

Accept version-1 canonical coastline evidence for the maximum-control, multiple-basin atlas. All
retained landmasses, islands, enclosed seas, and independent ocean basins must keep exact source
links and valid planet-native boundary loops.

## Changed evidence

- `fixed-seeds/milestone-2-atlas-control-max/expected/baseline/atlas-land-water.kernel.canonical`

## Version and compatibility consequence

This accepts coastline geometry, extraction, simplification-policy, topology-validation,
generator-manifest, and parameter-schema version 1 without changing existing field, partition, or
semantic versions. Evidence remains pre-persistence and projection-neutral.

## Evidence reviewed

Canonical ring/source IDs, multiple-basin dependencies, exact boundary coverage, winding,
simplification counts, non-intersection, stable ordering, seam/pole values, and repeat bytes were
reviewed. Existing semantic evidence remains unchanged; SVG, PNG, visual, and authoritative-file
evidence are not applicable to issue #60.
