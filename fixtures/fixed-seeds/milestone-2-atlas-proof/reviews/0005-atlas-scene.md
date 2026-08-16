## Intended behavior

Compose the default accepted whole-world geography into one deterministic, source-linked 2:1
RenderScene shared by Canvas and SVG, with cache-free reconstruction and stable layer order.

## Changed evidence

- `canonical-svg/milestone-2-atlas-proof/baseline.svg`
- `fixed-seeds/milestone-2-atlas-proof/expected/baseline/atlas-land-water.kernel.canonical`
- `fixed-seeds/milestone-2-atlas-proof/expected/baseline/atlas-render-scene.scene.canonical`

## Version and compatibility consequence

Atlas scene-composition version 1 is introduced. Accepted semantic, coastline, generator, seed,
and persistence versions remain unchanged because scenes and projected paths are disposable.

## Evidence reviewed

Semantic kernel evidence is unchanged except for new scene assertions. Canonical scene and SVG
structure, source links, seam closures, and z-order were reviewed. PNG evidence is not applicable
until the hand-ink style issue.
