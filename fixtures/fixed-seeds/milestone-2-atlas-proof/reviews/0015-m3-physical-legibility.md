## Intended behavior

The normal atlas scene makes short accepted M3 relief, watershed, river, and lake records
legible with deterministic footprints and restrained mountain hatches, while keeping closed biome
contours and continuous coastline ink seam-safe.

## Changed evidence

- `canonical-svg/milestone-2-atlas-proof/baseline.svg`
- `fixed-seeds/milestone-2-atlas-proof/expected/baseline/atlas-render-scene.scene.canonical`
- `visual-gallery/milestone-2-atlas-proof/baseline.png`

## Version and compatibility consequence

Accepted M3 geometry is unchanged. The scene changes only its disposable physical presentation
and continues to use the version-2 physical-overlay export profiles.

## Evidence reviewed

The physical scene, SVG source links and ordering, and normal atlas PNG were reviewed. Coastline
ink remains above physical overlays.
