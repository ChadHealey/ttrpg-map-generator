## Intended behavior

Compose the minimum-control single-continent geography with exact shared fill boundaries and
stable renderer-neutral provenance.

## Changed evidence

- `canonical-svg/milestone-2-atlas-control-min/baseline.svg`
- `fixed-seeds/milestone-2-atlas-control-min/expected/baseline/atlas-land-water.kernel.canonical`
- `fixed-seeds/milestone-2-atlas-control-min/expected/baseline/atlas-render-scene.scene.canonical`

## Version and compatibility consequence

Atlas scene-composition version 1 is introduced. Accepted semantic, coastline, generator, seed,
and persistence versions remain unchanged because scenes and projected paths are disposable.

## Evidence reviewed

Semantic kernel evidence is unchanged except for new scene assertions. Canonical scene and SVG
structure, minimal-case bounds, source links, and Canvas/SVG parity were reviewed. PNG evidence is
not applicable until the hand-ink style issue.
