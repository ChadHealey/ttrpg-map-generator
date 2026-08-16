# Milestone 2 connected majority — semantic classification acceptance

## Intended behavior

Accept version-1 connected-majority semantic evidence. The largest basin-rooted open-marine graph
must satisfy the 90% policy while every accepted land and water sample retains exactly one stable
semantic owner and all geographic relationships validate.

## Changed evidence

- `fixed-seeds/milestone-2-atlas-connected-majority/expected/baseline/atlas-land-water.kernel.canonical`

## Version and compatibility consequence

This accepts semantic-classification, semantic-generator-manifest, semantic-parameter-schema, and
semantic-policy version 1. Existing atlas field and partition versions remain unchanged. The
evidence remains pre-persistence and does not accept coastline or renderer output.

## Evidence reviewed

The canonical semantic primitive traversal, stable component/entity/aspect IDs, exact ownership,
landmass classification, connected-majority ocean root, marginal/enclosed sea relationships,
containment, reciprocal connectivity, dependency proposals, and canonical ordering were reviewed.
Coastline, SVG, visual, and authoritative package evidence are not applicable to issue #59.
