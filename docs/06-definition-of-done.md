# 06 — Definition of Done

The project is visually and architecturally ambitious. "Basically finished" work
is a larger risk than a missing feature because it consumes attention while still
failing the product promise.

## Before starting

Ask these questions in order:

1. Which current milestone and visible product proof does this serve?
2. Which map, entity, and aspect owns the result?
3. What accepted state must remain unchanged?
4. Which seed scope, coordinate spaces, and dependencies are involved?
5. What evidence will show that the change works—semantic, integration, visual,
   or all three?
6. What is explicitly out of scope?

If the finished state cannot be described in one or two concrete sentences, split
the work before starting.

## A commit is done when

- [ ] It contains one logical, safely revertible change.
- [ ] Its message follows [05 — Git workflow](05-git-workflow.md) and explains
      non-obvious reasons or consequences.
- [ ] The relevant formatting, linting, type, test, and Rust checks pass.
- [ ] It introduces no unexplained warning or suppression.
- [ ] It contains no debug output, commented-out code, temporary export, secret,
      or unreferenced TODO/FIXME.
- [ ] A bug fix includes its regression test.
- [ ] A schema change includes its migration and fixture.
- [ ] An output-changing behavior includes its correct version change and fixture
      review.
- [ ] Documentation and vocabulary still describe the code.

## A change is done when

- [ ] It meets the issue acceptance criteria and works in the application or
      appropriate development harness.
- [ ] Package dependencies still point in the allowed direction.
- [ ] Domain, persistence, worker, Tauri, and third-party boundaries validate
      untrusted values.
- [ ] Stable identity never relies on display names or array positions.
- [ ] Coordinate spaces and units are explicit.
- [ ] Deterministic output has no ambient input and stable ordering is deliberate.
- [ ] Accepted state, constraints, locks, and unrelated aspect revisions remain
      unchanged unless the operation explicitly includes them.
- [ ] Proposed generation output is validated before transactional commit.
- [ ] Expected failures return actionable diagnostics with stable codes.
- [ ] High-risk domain behavior has Tier-1 tests.
- [ ] Boundary behavior has integration evidence where pure tests are insufficient.
- [ ] A rendered change has been inspected across the relevant visual gallery.
- [ ] The implementation does not silently expand the current milestone.

## A generator is done when

- [ ] Its manifest identifies it and versions output-changing behavior.
- [ ] Its parameter schema documents units, defaults, ranges, and compatibility.
- [ ] Its inputs, outputs, aspect dependencies, seed scope, and invalidation
      behavior are documented.
- [ ] It accepts immutable inputs and explicit deterministic streams.
- [ ] It performs no save, UI mutation, DOM rendering, or hidden cache lookup.
- [ ] It returns proposed output and actionable diagnostics.
- [ ] Its invariants are validated before commit.
- [ ] It has fixed-seed determinism and isolation tests.
- [ ] It has relevant property and adversarial-geometry tests.
- [ ] It has cross-map context, seam, pole, or shared-boundary tests when applicable.
- [ ] Its accepted output survives save/reopen without regeneration.
- [ ] Costly work supports tested progress and cancellation.
- [ ] Interactive work has a coarse-preview strategy.
- [ ] Rendered output has a reviewed visual example.

## A persistence change is done when

- [ ] The authoritative/disposable boundary remains explicit.
- [ ] The world document can be loaded without invoking generators.
- [ ] Serialization order and quantization are canonical.
- [ ] IDs, revisions, versions, source lineage, transforms, seed scopes, context
      snapshots, and checksums survive round trip when relevant.
- [ ] The save operates on an immutable snapshot and commits atomically.
- [ ] Interrupted-save recovery is tested.
- [ ] Every released source schema has a migration fixture.
- [ ] Unknown or corrupt required content fails without discarding user work.
- [ ] A newer generator is offered as an upgrade, not applied during load.

## A world-to-region change is done when

- [ ] The regional result adds detail without violating inherited classification,
      anchors, or boundary portals.
- [ ] The accepted context snapshot records exact source provenance.
- [ ] Planet-native and regional transforms round-trip within tolerance.
- [ ] Adjacent regional children agree wherever shared physical fields or crossing
      features require it.
- [ ] Parent edits mark affected child context stale without rewriting the child.
- [ ] Keep, reconcile, and regenerate consequences are previewable when relevant.
- [ ] Seam and near-pole cases are covered if the affected code can reach them.

## A rendered change is done when

- [ ] Canvas and export consume the same `RenderScene` semantics.
- [ ] Canonical geometry remains separate from styled paths.
- [ ] Hand-drawn distortion is applied once from canonical geometry.
- [ ] Stable element ordering and source entity links remain intact.
- [ ] Semantic, SVG, and PNG fixture changes have been reviewed separately.
- [ ] The change has been judged across representative seeds and world/region pairs,
      not one favorable screenshot.
- [ ] Large-output memory and tiling behavior remain within declared budgets when
      relevant.

## A milestone is done when

- [ ] Its visible exit in [`PROJECT_PLAN.md`](PROJECT_PLAN.md) is demonstrably
      complete.
- [ ] Every included issue is closed or explicitly moved out.
- [ ] `pnpm check` and the release test gate pass.
- [ ] Deterministic fixtures pass on macOS and Linux.
- [ ] Previous released world documents open without drift.
- [ ] The reviewed visual gallery has been inspected.
- [ ] A packaged macOS build has been exercised when the milestone requires it.
- [ ] Documentation, user guidance, and ADRs match the delivered behavior.
- [ ] A short retrospective records what took longer, what should be cut, and what
      the next milestone should prove.

## Anti-patterns

Name these patterns during review; recognizing them early is cheaper than fixing
their results.

### Silent regeneration

Opening, migrating, rendering, or editing causes a generator to replace accepted
state. The defense is materialized accepted output, explicit upgrade operations,
and tests that load without generation.

### The sequential-RNG cascade

One random stream feeds the whole map, so inserting one draw changes everything
after it. The defense is versioned aspect seed scopes and isolation tests.

### Projection leakage

Display-projection or screen coordinates become authoritative geography. The
defense is planet-native authority, typed transforms, and seam/pole fixtures.

### Parent reach-through

A child generator imports or queries parent-generator internals instead of its
versioned context snapshot. The defense is the scale-generic inherited-context
contract.

### Renderer split-brain

Canvas and SVG independently reconstruct geography and slowly disagree. The
defense is one renderer-neutral scene and backend comparison fixtures.

### Cache promotion

A fast derived index, preview mesh, or rendered path becomes the only copy of user
work. The defense is the cache deletion test and an explicit persistence contract.

### Golden blindness

Snapshots are updated until CI turns green without inspecting semantic or visual
changes. The defense is separate semantic/SVG/PNG evidence and an update checklist.

### Parameter tourism

Many seeds and controls are adjusted without a written visual goal. State the
problem first, judge a representative gallery, and stop when it is solved.

### Premature scale generality

Settlement, continent, dungeon, building, battle-map, or plugin abstractions are
built before the world-to-region MVP proves the contract. Preserve a clean path in
types; do not implement the future node.

### The refactor spiral

Working code is reorganized because a cleaner abstraction is imaginable. Refactor
when it unblocks the current milestone, protects a demonstrated boundary, or pays
down a measured recurring cost.

### Tool-building

Time is spent on a universal editor, custom lint framework, plugin registry, or
benchmark dashboard before a concrete product need exists. Add the smallest tool
that closes a demonstrated feedback loop.

### Silent scope creep

"While here" work expands the current issue. Record the follow-up separately and
finish the selected product proof.

### Documentation drift

The rules describe a project that the code has deliberately stopped following.
Fix the code or the owning document immediately. A stale binding rule trains every
reader to ignore the suite.
