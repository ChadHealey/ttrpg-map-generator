# Atlas physical-overlay profile v2 evidence

## Intended behavior

The explicit `atlas-svg-v2` and `atlas-png-v2` profiles accept one canonical,
source-linked `atlas/physical/` compound path between semantic land fill and coastline ink. The
legacy v1 profiles continue to reject that node.

## Changed evidence

- `canonical-svg/atlas-physical-overlay-profile-v2/baseline.svg`
- `fixed-seeds/atlas-physical-overlay-profile-v2/expected/baseline/atlas-physical-overlay.scene.canonical`
- `visual-gallery/atlas-physical-overlay-profile-v2/baseline.png`

## Version and compatibility consequence

This is a new, opt-in v2 export profile. It does not regenerate or alter any M2 v1 gallery,
canonical SVG, request validation, or byte contract.

## Evidence reviewed

The baseline PNG shows the blue physical overlay inside the tan landmass. The black coastline
remains continuously visible above that overlay. The matching canonical SVG records the physical
node's canonical entity and aspect source links and places it before coastline ink.
