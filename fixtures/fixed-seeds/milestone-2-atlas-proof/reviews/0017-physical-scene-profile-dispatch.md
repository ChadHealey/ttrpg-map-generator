# Physical scene profile dispatch

## Intended behavior

The accepted physical M3 atlas scene is rendered and exported with the existing v2 physical-overlay
profiles after geography reroll, appearance reroll, and generator-free reopen. The legacy fixture
continues to exclude label aspects from its Milestone 2 evidence boundary.

## Changed evidence

- `canonical-svg/milestone-2-atlas-proof/appearance-rerolled.svg`
- `canonical-svg/milestone-2-atlas-proof/geography-rerolled.svg`
- `canonical-svg/milestone-2-atlas-proof/reopened.svg`
- `fixed-seeds/milestone-2-atlas-proof/expected/appearance-rerolled/atlas-render-scene.scene.canonical`
- `fixed-seeds/milestone-2-atlas-proof/expected/geography-rerolled/atlas-render-scene.scene.canonical`
- `fixed-seeds/milestone-2-atlas-proof/expected/reopened/accepted-atlas.reopen.canonical`
- `visual-gallery/milestone-2-atlas-proof/appearance-rerolled.png`
- `visual-gallery/milestone-2-atlas-proof/geography-rerolled.png`
- `visual-gallery/milestone-2-atlas-proof/reopened.png`

## Version and compatibility consequence

The M2-only v1 scene and export evidence remain unchanged. Complete M3 scenes use the already
released `atlas-svg-v2` and `atlas-png-v2` profiles; no accepted semantic or persistence format
changes.

## Evidence reviewed

Reviewed the canonical scenes and SVG profile metadata for each affected checkpoint. The v2 PNG
evidence retains physical context above land fill while keeping coastline ink visible above it.
Accepted aspect indexes and saved-project files are not expected to change.
