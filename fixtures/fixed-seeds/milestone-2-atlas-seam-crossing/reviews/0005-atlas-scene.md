## Intended behavior

Compose seam-crossing geography into bounded compound fills and coast paths with no world-spanning
segment, seam gap, or source-identity loss.

## Changed evidence

- `canonical-svg/milestone-2-atlas-seam-crossing/baseline.svg`
- `fixed-seeds/milestone-2-atlas-seam-crossing/expected/baseline/atlas-land-water.kernel.canonical`
- `fixed-seeds/milestone-2-atlas-seam-crossing/expected/baseline/atlas-render-scene.scene.canonical`

## Version and compatibility consequence

Atlas scene-composition version 1 is introduced. Accepted semantic, coastline, generator, seed,
and persistence versions remain unchanged because scenes and projected paths are disposable.

## Evidence reviewed

Semantic kernel evidence is unchanged except for new scene assertions. Canonical scene and SVG
seam closures, bounded coordinates, stable source links, and cache-free reconstruction were
reviewed. PNG evidence is not applicable until the hand-ink style issue.
