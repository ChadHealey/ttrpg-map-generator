## Intended behavior

Use accepted landmass membership to select the spherical land interior while preserving the
connected-majority marine partition and exact projected coastlines.

## Changed evidence

- `canonical-svg/milestone-2-atlas-connected-majority/baseline.svg`
- `fixed-seeds/milestone-2-atlas-connected-majority/expected/baseline/atlas-render-scene.scene.canonical`

## Version and compatibility consequence

None. This corrects fill selection during the uncommitted introduction of scene-composition
version 1 without changing accepted geography or projection behavior.

## Evidence reviewed

Canonical scene and SVG land/water proportions, holes, source links, and coastline alignment were
reviewed. Semantic and PNG evidence are unchanged.
