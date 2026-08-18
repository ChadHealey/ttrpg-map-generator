# Fixture review: accepted aspect persistence

## Intended behavior

Add persistence-owned canonical aspect and output evidence for the complete accepted baseline atlas while retaining the previously reviewed generator, scene, SVG, and PNG artifacts byte-for-byte.

## Changed evidence

- `fixed-seeds/milestone-2-atlas-control-min/expected/baseline/accepted-aspects.aspects.index.canonical`

## Version and compatibility consequence

Fixture-definition version 2 moves the comparison boundary from temporary pre-persistence generator evidence to persistence schema version 1. No generator, semantic, geometry, style, SVG, or PNG compatibility version changes.

## Evidence reviewed

The complete per-aspect canonical byte lengths and SHA-256 digests and the separate accepted-output lengths and digests were reviewed. Existing SVG and visual evidence remain unchanged; authoritative package evidence is not required for this baseline-only row.
