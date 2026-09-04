# milestone-2-atlas-v2-normal-01 — separated macro field v2 acceptance

## Intended behavior

Accept additive version-2 evidence for this row. Four broad ordinary land areas remain separated by open water and retain two island groups.

## Changed evidence

- `canonical-svg/milestone-2-atlas-v2-normal-01/baseline.svg`
- `fixed-seeds/milestone-2-atlas-v2-normal-01/expected/baseline/accepted-aspects.aspects.index.canonical`
- `fixed-seeds/milestone-2-atlas-v2-normal-01/expected/baseline/atlas-land-water.kernel.canonical`
- `fixed-seeds/milestone-2-atlas-v2-normal-01/expected/baseline/atlas-render-scene.scene.canonical`
- `visual-gallery/milestone-2-atlas-v2-normal-01/baseline.png`

## Version and compatibility consequence

This row records macro-elevation generator and field behavior version 2 with generator manifest version 2. Sampling, quantization, classification, semantic, coastline, appearance, scene, persistence, stream, and seed-derivation versions remain unchanged. Existing version-1 fixtures and accepted packages remain byte-identical and generator-free on reopen.

## Evidence reviewed

The unlabelled 1600 by 800 production atlas PNG was inspected at whole-atlas scale and accepted as **broad continents**, not a rejected ribbon. Full-profile semantic evidence records 20 retained land components, 26.463928% largest-land share, and 2 retained island groups. Canonical macro/classification bytes, accepted-aspect persistence, semantic identities, coastline topology, SVG composition, and PNG output were generated through the normal fixture path.
