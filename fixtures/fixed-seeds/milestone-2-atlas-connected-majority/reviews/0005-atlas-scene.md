## Intended behavior

Compose the connected-majority atlas into the same deterministic scene layers while preserving
all accepted marine segmentation and semantic source identities.

## Changed evidence

- `canonical-svg/milestone-2-atlas-connected-majority/baseline.svg`
- `fixed-seeds/milestone-2-atlas-connected-majority/expected/baseline/atlas-land-water.kernel.canonical`
- `fixed-seeds/milestone-2-atlas-connected-majority/expected/baseline/atlas-render-scene.scene.canonical`

## Version and compatibility consequence

Atlas scene-composition version 1 is introduced. Accepted semantic, coastline, generator, seed,
and persistence versions remain unchanged because scenes and projected paths are disposable.

## Evidence reviewed

Semantic kernel evidence is unchanged except for new scene assertions. Canonical scene and SVG
structure, marine source links, cache reconstruction, and stable ordering were reviewed. PNG
evidence is not applicable until the hand-ink style issue.
