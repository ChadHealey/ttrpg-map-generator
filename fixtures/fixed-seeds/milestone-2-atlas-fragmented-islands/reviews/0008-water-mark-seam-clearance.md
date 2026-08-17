## Intended behavior

Keep the restrained atlas style's complete water-mark paths outside the 14-pixel projection-seam
and pole exclusion margins. Reject a candidate when either endpoint enters an exclusion zone, then
continue the same deterministic bounded search for a safe source-linked water mark.

## Changed evidence

- `canonical-svg/milestone-2-atlas-fragmented-islands/baseline.svg`
- `fixed-seeds/milestone-2-atlas-fragmented-islands/expected/baseline/atlas-land-water.kernel.canonical`
- `fixed-seeds/milestone-2-atlas-fragmented-islands/expected/baseline/atlas-render-scene.scene.canonical`
- `visual-gallery/milestone-2-atlas-fragmented-islands/baseline.png`

## Version and compatibility consequence

No compatibility version changes. This corrects endpoint enforcement within the new, unreleased
version-1 appearance behavior introduced for issue #63. Semantic geography, canonical coastline,
projection, seed derivation, and persistence compatibility remain unchanged.

## Evidence reviewed

Review the kernel vector separately to confirm unchanged semantic, coastline, and projection
hashes. Review scene/SVG source links and the PNG seam and pole margins to confirm every complete
water mark remains outside the exclusion zones while the fragmented-island composition stays
legible.
