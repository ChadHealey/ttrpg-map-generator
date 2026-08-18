# Fixtures

This directory will hold small, durable inputs and expected outputs used to prove
determinism, persistence, recovery, geometry invariants, and world-to-region continuity.

Generated fixtures must document their provenance and update command. Never hand-edit a
generated golden file or add personal `.mapworld` projects here.

The binding layout, manifest, hashing, update, and review rules are defined by
[07 — Deterministic Fixture Conventions](../docs/07-fixture-conventions.md). The checked-in
[`registry.json`](registry.json) is the explicit, stable list of fixture sets. Run
`pnpm test:cross-platform` to verify every registered fixture; update exactly one fixture with
the targeted `pnpm fixtures:update` command documented there.

## Milestone 1

- The registered `seed-derivation-v1` fixture records ADR-0006 preimages, derived SHA-256 seeds,
  raw stream samples, revision isolation, and root/shared identity agreement across child
  contexts.

- The fixed composition, permitted reroll changes, canonical comparison boundary, and visible
  workflow are defined by the
  [Milestone 1 kernel-proof contract](../docs/milestone-1-kernel-proof.md). Its registered
  fixture ID is `milestone-1-kernel-proof`, and its checkpoints are `baseline`, `rerolled`, and
  `reopened`. The fixture records canonical aspect/output evidence, canonical SVG, three reviewed
  960 by 600 PNG checkpoints, plus the checksum-validated `rerolled` v1 saved package. Reopening is
  generator-free and compares semantic records with `rerolled` rather than duplicating identical
  semantic goldens; reopened SVG and PNG evidence remains explicit to show zero visible drift. Its
  latest accepted update command is:

  ```bash
  pnpm fixtures:update --fixture milestone-1-kernel-proof --review-record fixed-seeds/milestone-1-kernel-proof/reviews/0002-rendered-workflow-proof.md
  ```

## Milestone 2

The [Milestone 2 whole-world atlas-proof contract](../docs/milestone-2-atlas-proof.md) fixes six
registered fixture IDs, their seeds and controls, and semantic/geometry/visual assertions. Every
row records a persistence-owned digest index over the complete canonical accepted aspect and
output bytes at `baseline`; the retained kernel vector is historical generator evidence and no
longer substitutes for accepted state. The main fixture additionally owns
`geography-rerolled`, `appearance-rerolled`, and `reopened`, the authoritative
appearance-rerolled `.mapworld` package, explicit SVG/PNG checkpoints, and a generator-free reopen
comparison report instead of duplicate reopened semantic goldens.
