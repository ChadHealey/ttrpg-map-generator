## Intended behavior

Use accepted landmass membership to choose the spherical land side of each projected coastline,
including cases where planar even-odd interior represents the water-side complement.

## Changed evidence

- `canonical-svg/milestone-2-atlas-proof/baseline.svg`
- `fixed-seeds/milestone-2-atlas-proof/expected/baseline/atlas-render-scene.scene.canonical`

## Version and compatibility consequence

None. This corrects fill selection during the uncommitted introduction of scene-composition
version 1 without moving canonical or projected coastline points.

## Evidence reviewed

Canonical scene and SVG land/water proportions, polar closure, holes, source links, and coastline
alignment were reviewed. Semantic and PNG evidence are unchanged.
