## Intended behavior

Export the seam-crossing registered atlas through canonical `atlas-svg-v1` while preserving the
shared scene's split fills, tapered coastline endpoints, stable source links, and absence of a
visible or duplicated seam stroke.

## Changed evidence

- `canonical-svg/milestone-2-atlas-seam-crossing/baseline.svg`

## Version and compatibility consequence

Introduce SVG export profile `atlas-svg-v1` version 1 without changing any semantic, coastline,
projection, scene-composition, appearance, style, persistence, or accepted record version.

## Evidence reviewed

Canonical semantic kernel and render-scene evidence were reviewed separately and confirmed
unchanged. Canonical SVG seam paths, source links, clip reference, ordering, and file size were
reviewed. Visual evidence remains unchanged; authoritative package evidence is not affected.
