# milestone-2-atlas-v2-normal-02 — separated macro field v2 acceptance

## Intended behavior

Accept additive version-2 evidence for this row. Ordinary broad land areas are visibly separated by open water with no ribbon-like dominant chain.

## Changed evidence

- `canonical-svg/milestone-2-atlas-v2-normal-02/baseline.svg`
- `fixed-seeds/milestone-2-atlas-v2-normal-02/expected/baseline/accepted-aspects.aspects.index.canonical`
- `fixed-seeds/milestone-2-atlas-v2-normal-02/expected/baseline/atlas-land-water.kernel.canonical`
- `fixed-seeds/milestone-2-atlas-v2-normal-02/expected/baseline/atlas-render-scene.scene.canonical`
- `visual-gallery/milestone-2-atlas-v2-normal-02/baseline.png`

## Version and compatibility consequence

This row records macro-elevation generator and field behavior version 2 with generator manifest version 2. Sampling, quantization, classification, semantic, coastline, appearance, scene, persistence, stream, and seed-derivation versions remain unchanged. Existing version-1 fixtures and accepted packages remain byte-identical and generator-free on reopen.

## Evidence reviewed

The unlabelled 1600 by 800 production atlas PNG was inspected at whole-atlas scale and accepted as **separated landmasses**, not a rejected ribbon. Full-profile semantic evidence records 19 retained land components, 27.494205% largest-land share, and 0 retained island groups. Canonical macro/classification bytes, accepted-aspect persistence, semantic identities, coastline topology, SVG composition, and PNG output were generated through the normal fixture path.
