## Intended behavior

Export the connected-majority registered atlas through canonical `atlas-svg-v1` from its existing
renderer-neutral scene with stable metadata, IDs, ordering, physical dimensions, and clipping.

## Changed evidence

- `canonical-svg/milestone-2-atlas-connected-majority/baseline.svg`

## Version and compatibility consequence

Introduce SVG export profile `atlas-svg-v1` version 1. No generator, semantic, coastline,
projection, scene, appearance, style, persistence, or accepted record version changes.

## Evidence reviewed

Canonical semantic kernel and render-scene evidence were reviewed separately and confirmed
unchanged. Canonical SVG structure, source links, marine/land fill parity, and file size were
reviewed. Visual evidence remains unchanged; authoritative package evidence is not affected.
