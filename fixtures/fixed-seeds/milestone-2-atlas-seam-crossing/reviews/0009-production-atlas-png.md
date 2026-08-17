## Intended behavior

Replace the provisional visual-evidence raster with the 1600 × 800 `atlas-png-v1` production
export of the exact accepted seam-crossing scene. Preserve split fills and tapered coastline
endpoints without a duplicated seam stroke, clipped ink, or a band-boundary discontinuity.

## Changed evidence

- `visual-gallery/milestone-2-atlas-seam-crossing/baseline.png`

## Version and compatibility consequence

Introduce PNG export profile `atlas-png-v1` version 1. Generator, semantic, coastline, projection,
scene-composition, appearance, style, SVG, persistence, and accepted record versions remain
unchanged.

## Evidence reviewed

Review the full image and focused world-seam, both poles, split-island, tapered-ink, echo,
water-mark, and 64-row raster-band crops. Canonical kernel, render-scene, SVG, and authoritative
package evidence were separately byte-confirmed unchanged.
