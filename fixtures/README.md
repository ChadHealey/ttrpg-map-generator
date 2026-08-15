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
  `reopened`. The fixture records canonical aspect/output evidence plus the checksum-validated
  `rerolled` v1 saved package; reopening is generator-free and compares with `rerolled` rather
  than duplicating identical golden files. Its accepted update command is:

  ```bash
  pnpm fixtures:update --fixture milestone-1-kernel-proof --review-record fixed-seeds/milestone-1-kernel-proof/reviews/0001-initial-acceptance.md
  ```
