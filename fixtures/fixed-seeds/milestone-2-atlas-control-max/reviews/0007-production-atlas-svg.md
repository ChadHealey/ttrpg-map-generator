## Intended behavior

Export the maximum-control, multiple-basin registered extreme through canonical `atlas-svg-v1`
and prove its largest accepted scene remains comfortably within the 32 MiB SVG ceiling.

## Changed evidence

- `canonical-svg/milestone-2-atlas-control-max/baseline.svg`

## Version and compatibility consequence

Introduce SVG export profile `atlas-svg-v1` version 1 without changing generator, semantic,
coastline, projection, scene, appearance, style, persistence, or accepted record versions.

## Evidence reviewed

Canonical semantic kernel and render-scene evidence were reviewed separately and confirmed
unchanged. Canonical SVG structure, stable IDs/source links, maximum-control geometry, and byte
size were reviewed. Visual evidence remains unchanged; authoritative package evidence is not
affected.
