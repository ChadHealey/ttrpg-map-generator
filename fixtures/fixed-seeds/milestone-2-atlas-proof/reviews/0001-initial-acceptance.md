# Milestone 2 atlas proof — initial generator acceptance

## Intended behavior

Accept version-1 macro-elevation and land/water generator evidence for the default fixed world seed
and controls. The complete full-profile records must validate, share every preview anchor exactly,
remain seam-continuous, use one sample per pole, and realize water coverage within tolerance.

## Changed evidence

- `fixed-seeds/milestone-2-atlas-proof/expected/baseline/atlas-land-water.kernel.canonical`

## Version and compatibility consequence

This accepts atlas field, classification, generator-manifest, parameter-schema, preview,
realization, sampling-policy, seed-derivation, and deterministic-stream version 1. It does not
accept a persistence encoding or canonical accepted-aspect byte contract.

## Evidence reviewed

The full macro tick traversal, packed land/water traversal, proposal primitive hash, controls,
identities, versions, realization, diagnostics, preview nesting, seam, poles, and progress were
reviewed. The vector is explicitly pre-persistence and is not canonical aspect or aspect-output
bytes. Semantic entities, coastline geometry, SVG, visual, and authoritative package evidence are
not applicable to issue #58.
