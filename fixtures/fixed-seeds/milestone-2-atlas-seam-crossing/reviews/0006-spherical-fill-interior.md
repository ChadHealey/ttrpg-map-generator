## Intended behavior

Select the accepted land side across the canonical seam without moving split endpoints or
creating a visible seam-aligned classification inversion.

## Changed evidence

- `canonical-svg/milestone-2-atlas-seam-crossing/baseline.svg`
- `fixed-seeds/milestone-2-atlas-seam-crossing/expected/baseline/atlas-render-scene.scene.canonical`

## Version and compatibility consequence

None. This corrects fill selection during the uncommitted introduction of scene-composition
version 1 without changing accepted geography or projection behavior.

## Evidence reviewed

Canonical scene and SVG seam continuity, land/water proportions, source links, and coastline
alignment were reviewed. Semantic and PNG evidence are unchanged.
