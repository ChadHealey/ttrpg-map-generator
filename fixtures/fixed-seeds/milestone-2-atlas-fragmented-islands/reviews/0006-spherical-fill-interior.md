## Intended behavior

Select each accepted fragmented landmass interior independently so islands remain land while the
surrounding high-water classification remains water.

## Changed evidence

- `canonical-svg/milestone-2-atlas-fragmented-islands/baseline.svg`
- `fixed-seeds/milestone-2-atlas-fragmented-islands/expected/baseline/atlas-render-scene.scene.canonical`

## Version and compatibility consequence

None. This corrects fill selection during the uncommitted introduction of scene-composition
version 1 without changing accepted geography or projection behavior.

## Evidence reviewed

Canonical scene and SVG island fills, holes, source links, and coastline alignment were reviewed.
Semantic and PNG evidence are unchanged.
