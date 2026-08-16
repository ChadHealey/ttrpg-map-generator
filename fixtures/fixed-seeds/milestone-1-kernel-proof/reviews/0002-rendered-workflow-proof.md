# Fixture review: rendered workflow proof

## Intended behavior

Add the fixed-size RenderScene, canonical SVG, and deterministic visual-gallery evidence for the
Milestone 1 baseline, marker-rerolled, and generator-free reopened checkpoints. The accepted
outline remains fixed while the nine marker positions visibly change, and reopened render output
exactly matches the saved rerolled checkpoint.

## Changed evidence

- `canonical-svg/milestone-1-kernel-proof/baseline.svg`
- `canonical-svg/milestone-1-kernel-proof/reopened.svg`
- `canonical-svg/milestone-1-kernel-proof/rerolled.svg`
- `visual-gallery/milestone-1-kernel-proof/baseline.png`
- `visual-gallery/milestone-1-kernel-proof/reopened.png`
- `visual-gallery/milestone-1-kernel-proof/rerolled.png`

## Version and compatibility consequence

None. The generator, parameter, seed-derivation, transform, canonical persistence, package, and
render-scene contract versions are unchanged. This review adds previously absent derived render
evidence and does not change accepted semantic or authoritative package bytes.

## Evidence reviewed

Semantic aspect and output evidence was reviewed and remains byte-identical to the prior accepted
fixture. Canonical SVG and visual evidence were reviewed for the stable outline, all nine markers,
visible marker-only reroll, fixed 960 by 600 layout, and zero reopen drift. The authoritative
rerolled `.mapworld` evidence was reviewed and remains byte-identical. Constraint, lock, ownership,
stable IDs, and every unrelated accepted record remain unchanged.
