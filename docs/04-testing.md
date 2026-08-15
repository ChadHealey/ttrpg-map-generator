# 04 — Testing

Procedural cartography needs several kinds of evidence. A semantic hash cannot say
whether a map is attractive, and a pleasing screenshot cannot say whether a river
is valid or a reroll changed unrelated state. Keep those questions separate.

Vitest is the default TypeScript test runner. Playwright covers a small number of
critical desktop/webview workflows. Rust tests cover the native adapter. Fixtures
live under `fixtures/` when they are shared, persisted, adversarial, visual, or
cross-package evidence.

The generated-fixture layout, manifest, integrity, targeted update command, and review-record
requirements are owned by
[07 — Deterministic Fixture Conventions](07-fixture-conventions.md).

## Tier 1 — Test always

These tests are fast, deterministic, and primarily exercise pure logic.

### Determinism and isolation

- Same inputs, versions, parameters, and seed metadata produce the same canonical
  result.
- Map/entity-scoped rerolls change only the selected aspect and declared
  dependents.
- Root-coordinate seeds agree at the same physical location across adjacent
  regions.
- Shared-boundary seeds preserve matching portals and continuations.
- Stable output does not depend on insertion order, worker scheduling, or supported
  thread count.
- Generation neither reads nor disturbs an unrelated random stream.
- Canonical serialization, SVG ordering, and hash input are stable.

Test randomized claims over a matrix of seeds. A claim about a distribution,
average, or isolation boundary should not depend on one lucky sample.

### Identity, transforms, and context

- Stable IDs survive rename, reorder, save, and reopen.
- Ownership and dependency relationships remain distinct and valid.
- World-to-region transforms round-trip within declared error bounds.
- Seam and pole footprints use the correct projection and planet-native topology.
- Inherited-context snapshots preserve lineage, source versions, transforms,
  collars, anchors, portals, seed scopes, and checksums.
- Parent changes produce the correct non-conflicting, reconcilable, or conflicting
  state without rewriting the child.

### Geometry and geography invariants

- Coast rings are closed, consistently wound, and non-self-intersecting.
- World fields and coasts remain continuous across the horizontal seam.
- Landmass and water-body classification obey connectivity and containment rules.
- Land and water do not overlap improperly.
- Rivers join instead of crossing, end at a valid sink, and respect downstream
  width rules.
- Forest motifs remain within permitted regions.
- Roads cross impassable features only through explicit crossings.
- Regional output preserves inherited classifications, anchors, and boundary
  continuations within declared tolerances.
- Adjacent regional fixtures agree on shared fields and portals.
- Quantization and canonical serialization preserve the tolerance for each
  coordinate space.

Property-style tests are preferred for mathematical invariants. Record the seed
and minimized counterexample for every failure so it becomes a permanent fixture.

### Persistence and migration

- Save/load round trips preserve accepted semantic state, decoration, constraints,
  locks, and generation metadata.
- Loading never invokes generators merely because versions changed.
- Deleted caches rebuild without changing authoritative state.
- Every released schema migrates from a captured fixture.
- Unknown or corrupt required data produces an actionable failure.
- Canonical serialization order and authoritative checksums are stable.

### Regression tests

Every bug fix includes a test that fails for the reported reason before the fix and
passes afterward. Name the behavior, not the issue number alone.

## Tier 2 — Integration and boundary tests

These tests cross a process, filesystem, worker, renderer, or UI boundary. Add them
for critical workflows and for failures that pure tests cannot represent.

- Atomic save, interrupted replacement, backup, and recovery, using the complete P00–P17 matrix
  and platform contract in [ADR-0008](adr/0008-mapworld-directory-commit-recovery.md).
- Worker request validation, progress, cancellation, failure, and scheduling.
- Tauri file-dialog and native atomic-save adapters.
- Canvas and SVG interpretation of the same `RenderScene`.
- PNG tiling and memory limits at representative large sizes.
- World footprint selection through accepted regional creation.
- Save, close, reopen, and navigate between linked world and regional maps.
- Parent-context change, stale notification, preview, keep/reconcile/regenerate.
- Undo/redo around a transactional coastline or river edit.
- Accessibility and keyboard operation for the primary workflow.

Playwright tests only high-value user journeys. Do not reproduce every component
unit test through the browser.

System- or platform-dependent tests must state their requirements. A skipped test
is visible and fails a release gate when that platform capability is required for
the release.

Run `pnpm test:native-recovery` on both supported development platforms. The suite prints the
native platform it exercised, while CI separately records the filesystem used for its checked-out
workspace test parent. Reopened native DTOs cross a test-only process bridge into the released
`classifyMapworldRecoverySnapshot`/`decideMapworldRecovery` policy, and the selected package must pass
complete `decodeMapworld` validation. The matrix names injected OS errors and asserts their stable
code, primitive, role, number/name context, and immediate filesystem state. macOS evidence must come
from the macOS job and Linux evidence from the Linux job; a successful local macOS run cannot be
reported as Linux evidence. Fault injection and process termination model documented interruption
points, not sudden power loss or every storage device's firmware behavior.
The real-filesystem suite creates differently cased spellings for every recovery role. On a case-
or normalization-insensitive filesystem the derived lookup must be an unreadable exact-name
conflict and remain untouched; on a case-sensitive filesystem the differently named sibling must
remain outside the protocol while the exact role is absent.

## Tier 3 — Visual and human judgment

Automated tests cannot decide:

- whether a world atlas is attractive;
- whether a regional map visibly belongs to its parent;
- whether a coastline feels natural rather than noisy;
- whether motif density, labels, hatching, or paper treatment read well;
- whether controls make selective regeneration understandable;
- whether interaction remains pleasant at real map sizes.

Use a reviewed gallery containing:

- standard world seeds with different landmass controls;
- paired world/region drill-downs;
- adjacent regional children;
- seam and near-pole footprints;
- sparse and dense forest/motif cases;
- labels at several densities;
- small and large export sizes;
- clean-print and ink styles once both exist.

Any visual change is judged across the gallery, not on one favorable seed. Record
what the review intended to improve before tuning, and stop when that goal is met.

## Snapshot policy

Keep three forms of regression evidence separate:

1. **Canonical semantic snapshots or hashes** detect world-model changes.
2. **Canonical SVG snapshots or hashes** detect render-scene/backend changes.
3. **PNG visual comparisons** detect perceptual rendering changes.

Do not update all three simply because CI failed. For every update:

- identify the intended behavior change;
- inspect the semantic diff;
- inspect the SVG structural diff when relevant;
- look at the rendered images;
- confirm unrelated aspects and paired maps did not change;
- record the generator/style version consequence.

Generated fixture updates additionally use one append-only review record and the targeted
`pnpm fixtures:update` command. Canonical aspect/output hashes, authoritative `.mapworld` file
checksums, and fixture-integrity hashes have distinct inputs and meanings even when they use
the same digest algorithm. Review them under their owning evidence class rather than treating
one passing hash as proof for another.

Visual comparisons use an explicit tolerance and deterministic fonts/assets.
Intentional style changes may update PNGs without changing semantic fixtures.

## Test organization and naming

Co-locate focused unit tests with their source:

```text
seed-derivation.ts
seed-derivation.test.ts
```

Use shared locations for workflows and durable evidence:

```text
tests/integration/
tests/e2e/
fixtures/fixed-seeds/
fixtures/saved-projects/
fixtures/adversarial-geometry/
fixtures/world-region-pairs/
fixtures/visual-gallery/
```

Test names read as sentences and identify the broken promise:

```ts
it('keeps an accepted regional child unchanged when its parent becomes stale');
it('derives the same boundary sample for adjacent regional maps');
it('rejects a coast ring that self-intersects after quantization');
```

Avoid names such as `works`, `test one`, or `handles edge cases`.

## Fakes, clocks, and randomness

- Inject deterministic random streams, clocks, filesystem adapters, and worker
  scheduling where those dependencies are legitimate.
- Use small handwritten fakes for project interfaces. Do not mock private
  implementation details.
- Test public outputs and invariants rather than call counts unless interaction is
  itself the contract.
- A fixture builder states every value relevant to the behavior; hidden defaults
  must not make the test pass accidentally.

## Coverage

There is no repository-wide percentage target. Coverage is a diagnostic, not a
definition of quality.

The practical rule is:

> If a silent failure could corrupt accepted work, break reproducibility or
> cross-map continuity, invalidate geography, or take more than an hour to
> diagnose, it gets an automated test.

Pure domain and migration code should naturally be heavily covered. Do not add
tests for trivial getters or generated framework code to improve a number.

## Generator completion evidence

A generator is not complete until it has:

- a manifest and independently meaningful versions;
- documented inputs, outputs, units, seed scope, and invalidation edges;
- validation with stable diagnostic codes;
- fixed-seed determinism and isolation tests;
- relevant property/invariant tests;
- context and boundary tests when it participates in drill-down;
- save/reopen evidence for accepted output;
- cancellation/progress tests when costly;
- a coarse-preview strategy when interactive;
- at least one reviewed visual fixture when it affects rendering.

## Release test gate

Before a milestone tag:

1. `pnpm check` passes.
2. Cross-platform canonical fixtures pass on macOS and Linux.
3. Required native recovery evidence passes on macOS and Linux with the filesystem recorded.
4. Required integration and Playwright workflows pass.
5. Migration fixtures from every released schema pass.
6. The reviewed visual gallery has been inspected.
7. A previous-version world document opens without regeneration or drift.
8. A fixed previous-version generator result remains stable unless an explicit
   upgrade path is under test.
