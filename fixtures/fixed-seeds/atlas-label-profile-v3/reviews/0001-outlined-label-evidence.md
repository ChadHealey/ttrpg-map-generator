# Atlas outlined-label profile v3 evidence

## Intended behavior

The explicit `atlas-svg-v3` and `atlas-png-v3` profiles render accepted ASCII label placements as
shared, exact outlined contours after coastline ink. The legacy v1 and physical-overlay v2
profiles remain separate contracts.

## Changed evidence

- `canonical-svg/atlas-label-profile-v3/dense.svg`
- `canonical-svg/atlas-label-profile-v3/sparse.svg`
- `fixed-seeds/atlas-label-profile-v3/expected/dense/atlas-label.scene.canonical`
- `fixed-seeds/atlas-label-profile-v3/expected/sparse/atlas-label.scene.canonical`
- `visual-gallery/atlas-label-profile-v3/dense.png`
- `visual-gallery/atlas-label-profile-v3/sparse.png`

## Version and compatibility consequence

This is a new opt-in v3 export profile and scene-composition version 4. It does not regenerate or
alter any accepted v1 or physical-overlay v2 scene, SVG, PNG, diagnostic, or byte contract.

## Evidence reviewed

The sparse row shows `A`, `Ava Vale`, `The Verdant Reach`, and `Eldermere II` with readable
counters and joins. The dense matrix remains legible, ordered, and clipped inside the atlas. In
both rows the matching canonical SVG retains exact accessibility titles and source links, emits no
visible text element, and paints outlined labels after continuous coastline ink. A disposable
8192 by 4096 dense export was also sampled at raster-band boundaries without a visible seam.
