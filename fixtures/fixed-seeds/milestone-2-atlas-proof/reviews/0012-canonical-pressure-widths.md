# Fixture review: canonical pressure widths

## Intended behavior

Represent pressure-derived coastline stroke widths at fixed six-decimal pixel precision before they enter the disposable canonical render scene.

## Changed evidence

- `canonical-svg/milestone-2-atlas-proof/appearance-rerolled.svg`
- `canonical-svg/milestone-2-atlas-proof/baseline.svg`
- `canonical-svg/milestone-2-atlas-proof/geography-rerolled.svg`
- `canonical-svg/milestone-2-atlas-proof/reopened.svg`
- `fixed-seeds/milestone-2-atlas-proof/expected/appearance-rerolled/atlas-render-scene.scene.canonical`
- `fixed-seeds/milestone-2-atlas-proof/expected/baseline/atlas-land-water.kernel.canonical`
- `fixed-seeds/milestone-2-atlas-proof/expected/baseline/atlas-render-scene.scene.canonical`
- `fixed-seeds/milestone-2-atlas-proof/expected/geography-rerolled/atlas-render-scene.scene.canonical`
- `fixed-seeds/milestone-2-atlas-proof/expected/reopened/accepted-atlas.reopen.canonical`

## Version and compatibility consequence

Atlas scene composition version 3 defines the deterministic pressure-width representation. Accepted semantic data and PNG visual output remain unchanged; canonical SVG metadata records the new scene version.

## Evidence reviewed

Canonical scene and kernel evidence record the explicit width representation and scene version. The SVG metadata version and reopen scene digest were reviewed; semantic and visual output remain unchanged.
