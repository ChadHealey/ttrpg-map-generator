## Intended behavior

The normal atlas makes accepted biome, watershed, mountain, river, and lake records visually
distinct at gallery scale. Closed lake fills and outlines share one deterministic minimum
footprint, and coastline ink remains above all physical overlays.

## Changed evidence

- `canonical-svg/milestone-2-atlas-proof/baseline.svg`
- `fixed-seeds/milestone-2-atlas-proof/expected/baseline/atlas-render-scene.scene.canonical`
- `visual-gallery/milestone-2-atlas-proof/baseline.png`

## Version and compatibility consequence

Accepted M3 geometry is unchanged. This changes only disposable physical-overlay presentation
within the existing version-2 physical-overlay export profiles.

## Evidence reviewed

The source-linked normal physical scene, SVG ordering, and PNG hierarchy were reviewed. The
inset biome contours, watershed/rivers, and outlined lake footprint are visible without covering
coastline ink.
