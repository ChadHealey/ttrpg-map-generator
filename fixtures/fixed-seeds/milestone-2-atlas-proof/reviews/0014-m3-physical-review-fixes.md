## Intended behavior

The normal atlas gallery row reconstructs its physical overlay only after a persistence
round-trip of the accepted M3 document. Closed biome contours remain seam-safe, and sub-pixel
relief, watershed, river, and lake records receive deterministic atlas-scale footprints.

## Changed evidence

- `canonical-svg/milestone-2-atlas-proof/baseline.svg`
- `fixed-seeds/milestone-2-atlas-proof/expected/baseline/accepted-aspects.aspects.index.canonical`
- `fixed-seeds/milestone-2-atlas-proof/expected/baseline/atlas-render-scene.scene.canonical`
- `visual-gallery/milestone-2-atlas-proof/baseline.png`

## Version and compatibility consequence

The baseline accepted-aspect index now contains the accepted M3 aspects used by the physical
overlay. The disposable scene, SVG, and PNG continue to use the version-2 physical-overlay
profiles.

## Evidence reviewed

The persisted-and-reopened M3 state, source-linked scene, SVG ordering, and normal PNG were
reviewed. Coastline ink remains above all physical overlays.
