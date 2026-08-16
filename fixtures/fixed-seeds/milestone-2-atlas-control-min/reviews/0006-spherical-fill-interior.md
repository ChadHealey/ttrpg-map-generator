## Intended behavior

Select the accepted land side of the minimum-control coastline so its land-heavy classification
is represented rather than its planar complement.

## Changed evidence

- `canonical-svg/milestone-2-atlas-control-min/baseline.svg`
- `fixed-seeds/milestone-2-atlas-control-min/expected/baseline/atlas-render-scene.scene.canonical`

## Version and compatibility consequence

None. This corrects fill selection during the uncommitted introduction of scene-composition
version 1 without changing accepted geography or projection behavior.

## Evidence reviewed

Canonical scene and SVG land dominance, polar boundaries, source links, and coastline alignment
were reviewed. Semantic and PNG evidence are unchanged.
