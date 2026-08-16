# Milestone 1 retrospective — Deterministic kernel

- **Status:** Complete
- **Completed:** 2026-08-15
- **Visible exit:** A fixed seed produces a repeatable composition; marker reroll leaves every
  unrelated accepted record byte-identical after native save, unload, and reopen.

## What shipped

- Typed identity, coordinate, seed, revision, generator, transaction, canonical persistence, and
  native atomic-save/recovery boundaries joined by one thin desktop proof.
- A fixed one-world-map composition with one outline aspect and nine stable marker identities,
  rendered through the shared Canvas/SVG `RenderScene` path.
- A user-visible **Reroll markers** transaction and complete canonical aspect/output, isolation,
  native reopen, render geometry, SVG, and PNG evidence.
- A real native desktop workflow test with an armed generator-free load tripwire and a registered,
  cross-platform deterministic fixture.

## What took longer or required iteration

- Canonical persistence and the interruption-safe native directory boundary needed to be proven
  before the visible save/reopen flow could be honest; the UI was intentionally the final thin
  layer rather than an early mock.
- The workflow needed separate semantic, authoritative-package, render-structure, and visual
  comparisons. Keeping those evidence classes distinct required another fixture review pass but
  prevented SVG or checksums from being misreported as semantic isolation.
- The real native test needed a small process bridge so TypeScript orchestration could invoke the
  released Rust commands without introducing a second filesystem implementation or new dependency.

## Deliberately cut or deferred

- The normative proof has no `RegionalMap`, geographic generation, atlas controls, or representative
  seed gallery. Those begin with Milestone 2 and later world-to-region milestones.
- General editor UX, file dialogs, Save As/overwrite flows, autosave, migrations, plugins, cloud
  features, a production CLI, and additional map scales remain out of scope.
- The fixed geometric PNG helper is evidence tooling only; production high-resolution PNG export,
  tiling, and perceptual tolerance infrastructure remain deferred.

## Next milestone proof

Milestone 2 must deliver the whole-world atlas postcard: an attractive geographic world with
recognizable continents and oceans that can be generated, saved, reopened, selectively rerolled,
and exported.

## Evidence

- The exact pinned local gates include `pnpm check`, `pnpm test:cross-platform`,
  `pnpm test:native-recovery`, `pnpm test:e2e`, `pnpm test:visual`, and `pnpm build`.
- The local native run proves macOS/APFS only. Linux and the second macOS cross-platform acceptance
  remain CI evidence until the branch's matrix completes; local results are not reported as a
  substitute.
- The reviewed gallery contains fixed 960 by 600 baseline, rerolled, and reopened evidence. The
  outline and all nine markers are visible, reroll movement is clear, and reopened bytes exactly
  match rerolled bytes.
