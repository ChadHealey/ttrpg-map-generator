# Milestone 2 seam-crossing row — initial generator acceptance

## Intended behavior

Accept version-1 generator evidence for the fixed seam-crossing seed. At this layer the analytic
field must have exact canonical seam identity, bounded adjacent-seam variation, one sample at each
pole, and a valid full land/water partition.

## Changed evidence

- `fixed-seeds/milestone-2-atlas-seam-crossing/expected/baseline/atlas-land-water.kernel.canonical`

## Version and compatibility consequence

This accepts atlas field, classification, generator-manifest, parameter-schema, preview,
realization, sampling-policy, seed-derivation, and deterministic-stream version 1 for the seam
row. It does not accept vector coastline or persistence compatibility.

## Evidence reviewed

The full-profile primitive traversal hashes, canonical and adjacent seam observations, poles,
controls, identities, versions, realization, diagnostics, preview nesting, and progress were
reviewed. A semantic seam-crossing landmass and canonical coastline ring are later #59/#60 proof,
so semantic, coastline, SVG, visual, and authoritative package evidence were not applicable here.
