## Intended behavior

Export the fragmented-islands control case through canonical `atlas-svg-v1`, preserving its
retained channels, small islands, coastal echoes, water marks, and paper treatment from the same
renderer-neutral scene.

## Changed evidence

- `canonical-svg/milestone-2-atlas-fragmented-islands/baseline.svg`

## Version and compatibility consequence

Introduce SVG export profile `atlas-svg-v1` version 1 without changing generator, semantic,
coastline, projection, scene, appearance, style, persistence, or accepted record versions.

## Evidence reviewed

Canonical semantic kernel and render-scene evidence were reviewed separately and confirmed
unchanged. Canonical SVG structure, source links, retained island/channel geometry, and the 32 MiB
ceiling were reviewed. Visual evidence remains unchanged; authoritative package evidence is not
affected.
