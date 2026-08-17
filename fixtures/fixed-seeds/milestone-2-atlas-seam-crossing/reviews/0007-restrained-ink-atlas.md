## Intended behavior

Accept the restrained version-1 limited-color atlas style: near-black coastline ink, muted
blue-gray water, quiet parchment-olive land, warm paper grain, source-linked coastal echoes, and
water marks. Appearance generation must remain deterministic and independently rerollable without
changing semantic geography or canonical coastline geometry.

## Changed evidence

- `canonical-svg/milestone-2-atlas-seam-crossing/baseline.svg`
- `fixed-seeds/milestone-2-atlas-seam-crossing/expected/baseline/atlas-land-water.kernel.canonical`
- `fixed-seeds/milestone-2-atlas-seam-crossing/expected/baseline/atlas-render-scene.scene.canonical`
- `visual-gallery/milestone-2-atlas-seam-crossing/baseline.png`

## Version and compatibility consequence

Introduce atlas style behavior and token version 1, the three appearance behavior versions at 1,
and appearance-generator manifest/parameter-schema version 1. Advance disposable atlas scene
composition from version 1 to 2. Geography, semantic classification, canonical coastline,
projection, seed derivation, and persistence compatibility versions remain unchanged.

## Evidence reviewed

Reviewed the kernel vector separately to confirm the pre-existing semantic, classification,
coastline, and projection hashes remain unchanged while new appearance/isolation evidence is
added. Reviewed canonical scene ordering and source links, canonical SVG structure, and the PNG at
normal size plus seam, pole, narrow-channel, small-island, echo-line, and grain areas.
