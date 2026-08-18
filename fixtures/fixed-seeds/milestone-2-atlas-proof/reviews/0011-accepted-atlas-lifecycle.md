# Fixture review: accepted atlas lifecycle

## Intended behavior

Move the main atlas proof to the persistence-owned accepted boundary and add the normative geography reroll, appearance reroll, authoritative save, generator-free reopen, and deterministic export checkpoints without replacing its previously reviewed baseline artifacts.

## Changed evidence

- `canonical-svg/milestone-2-atlas-proof/appearance-rerolled.svg`
- `canonical-svg/milestone-2-atlas-proof/geography-rerolled.svg`
- `canonical-svg/milestone-2-atlas-proof/reopened.svg`
- `fixed-seeds/milestone-2-atlas-proof/expected/appearance-rerolled/accepted-aspects.aspects.index.canonical`
- `fixed-seeds/milestone-2-atlas-proof/expected/appearance-rerolled/atlas-render-scene.scene.canonical`
- `fixed-seeds/milestone-2-atlas-proof/expected/baseline/accepted-aspects.aspects.index.canonical`
- `fixed-seeds/milestone-2-atlas-proof/expected/geography-rerolled/accepted-aspects.aspects.index.canonical`
- `fixed-seeds/milestone-2-atlas-proof/expected/geography-rerolled/atlas-render-scene.scene.canonical`
- `fixed-seeds/milestone-2-atlas-proof/expected/reopened/accepted-atlas.reopen.canonical`
- `saved-projects/v1/milestone-2-atlas-proof/appearance-rerolled.mapworld/manifest.json`
- `saved-projects/v1/milestone-2-atlas-proof/appearance-rerolled.mapworld/maps/a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7.json`
- `saved-projects/v1/milestone-2-atlas-proof/appearance-rerolled.mapworld/world.json`
- `visual-gallery/milestone-2-atlas-proof/appearance-rerolled.png`
- `visual-gallery/milestone-2-atlas-proof/geography-rerolled.png`
- `visual-gallery/milestone-2-atlas-proof/reopened.png`

## Version and compatibility consequence

Fixture-definition version 2 moves the accepted comparison boundary to persistence schema version 1 and expands the reviewed checkpoints. Generator, semantic, coastline, projection, style, SVG, and PNG compatibility versions remain unchanged.

## Evidence reviewed

Canonical semantic indexes, selective-reroll fixed/change sets, authoritative package checksums, scene/SVG structure, and baseline/reroll/reopen visual evidence were reviewed separately. Reopen reproduces the appearance-rerolled accepted records and exports without generator invocation; it does not add duplicate reopened semantic goldens.
