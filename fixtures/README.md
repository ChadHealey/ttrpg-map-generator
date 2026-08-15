# Fixtures

This directory will hold small, durable inputs and expected outputs used to prove
determinism, persistence, recovery, geometry invariants, and world-to-region continuity.

Generated fixtures must document their provenance and update command. Never hand-edit a
generated golden file or add personal `.mapworld` projects here.

## Milestone 1

- The fixed composition, permitted reroll changes, canonical comparison boundary, and visible
  workflow are defined by the
  [Milestone 1 kernel-proof contract](../docs/milestone-1-kernel-proof.md). Issue #53 owns the
  fixture layout and update conventions; do not create an ad hoc layout that preempts it.
