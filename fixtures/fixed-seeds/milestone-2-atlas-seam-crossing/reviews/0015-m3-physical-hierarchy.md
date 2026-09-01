## Intended behavior

The seam-crossing atlas keeps source-linked biome contours seam-safe while making accepted
biome, watershed, mountain, river, and lake records visibly distinct at gallery scale. Closed
lake fills and outlines share one deterministic minimum footprint beneath coastline ink.

## Changed evidence

- `canonical-svg/milestone-2-atlas-seam-crossing/baseline.svg`
- `fixed-seeds/milestone-2-atlas-seam-crossing/expected/baseline/atlas-render-scene.scene.canonical`
- `visual-gallery/milestone-2-atlas-seam-crossing/baseline.png`

## Version and compatibility consequence

Accepted M3 geometry is unchanged. This changes only disposable physical-overlay presentation
within the existing version-2 physical-overlay export profiles.

## Evidence reviewed

The seam-safe physical scene, SVG ordering, and PNG hierarchy were reviewed. The inset biome
contours and strengthened hydrology remain visible without joining across the chart seam or
covering coastline ink.
