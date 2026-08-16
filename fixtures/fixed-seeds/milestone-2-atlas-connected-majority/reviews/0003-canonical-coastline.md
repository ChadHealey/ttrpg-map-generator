# Connected-majority atlas — canonical coastline acceptance

## Intended behavior

Accept version-1 canonical coastline evidence where one physical coast may reference multiple
segmented open-marine water bodies. Stable source provenance must preserve the connected-majority
semantics without adding water-water edges to coastline geometry.

## Changed evidence

- `fixed-seeds/milestone-2-atlas-connected-majority/expected/baseline/atlas-land-water.kernel.canonical`

## Version and compatibility consequence

This accepts coastline geometry, extraction, simplification-policy, topology-validation,
generator-manifest, and parameter-schema version 1. Existing field, partition, and semantic
versions remain unchanged. Evidence remains pre-persistence; projection and rendering are absent.

## Evidence reviewed

Ring/source identities, all adjacent water-body links, exact classified-boundary coverage,
land-left winding, guarded point reduction, topology, ordering, seam/pole values, and repeated
canonical primitive bytes were reviewed. Prior semantic connectivity and containment evidence is
unchanged; SVG, PNG, visual, and authoritative-file evidence are not applicable to issue #60.
