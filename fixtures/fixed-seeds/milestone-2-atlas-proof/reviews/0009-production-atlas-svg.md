## Intended behavior

Replace the provisional generic scene SVG with canonical `atlas-svg-v1` output from the same
accepted renderer-neutral atlas scene. Preserve accepted geography, appearance, and scene bytes
while adding physical dimensions, export metadata, stable element IDs, and the shared clip
definition/reference required by issue #66.

## Changed evidence

- `canonical-svg/milestone-2-atlas-proof/baseline.svg`

## Version and compatibility consequence

Introduce SVG export profile `atlas-svg-v1` version 1. Generator, semantic-classification,
coastline, projection, scene-composition, appearance, style, persistence, and accepted record
versions remain unchanged. Existing Milestone 0/1 generic SVG bytes remain compatible.

## Evidence reviewed

Canonical semantic kernel and render-scene evidence were reviewed separately and confirmed
unchanged. The canonical SVG structural change and source links were reviewed. Visual evidence
was regenerated from the unchanged scene and confirmed unchanged; authoritative package evidence
is not affected.
