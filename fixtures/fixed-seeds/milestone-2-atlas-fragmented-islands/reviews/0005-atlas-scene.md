## Intended behavior

Compose fragmented and island-heavy geography without losing retained land fills or deriving
render identity from source collection order.

## Changed evidence

- `canonical-svg/milestone-2-atlas-fragmented-islands/baseline.svg`
- `fixed-seeds/milestone-2-atlas-fragmented-islands/expected/baseline/atlas-land-water.kernel.canonical`
- `fixed-seeds/milestone-2-atlas-fragmented-islands/expected/baseline/atlas-render-scene.scene.canonical`

## Version and compatibility consequence

Atlas scene-composition version 1 is introduced. Accepted semantic, coastline, generator, seed,
and persistence versions remain unchanged because scenes and projected paths are disposable.

## Evidence reviewed

Semantic kernel evidence is unchanged except for new scene assertions. Canonical scene and SVG
structure, dense island ordering, retained source links, and coarse-LOD fill equality were
reviewed. PNG evidence is not applicable until the hand-ink style issue.
