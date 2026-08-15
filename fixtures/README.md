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

- The fixed composition, permitted reroll changes, canonical comparison boundary, and visible
  workflow are defined by the
  [Milestone 1 kernel-proof contract](../docs/milestone-1-kernel-proof.md). Its registered
  fixture ID is `milestone-1-kernel-proof`, and its checkpoints are `baseline`, `rerolled`, and
  `reopened`.
