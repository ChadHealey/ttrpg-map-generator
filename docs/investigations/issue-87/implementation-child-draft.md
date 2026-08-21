# Draft issue: optimize exact preview threshold traversal if the foreground gate fails

## Outcome

Reduce packaged coarse-preview completion through first paint below the unchanged 750-ms limit for
all three gated fixtures by optimizing only the exact threshold-component traversal, while
preserving every selected threshold, connectivity proxy, deterministic artifact, progress event,
and cancellation aftermath.

## Background and evidence

Issue #87's temporary instrumented packaged build measured `selectAtlasLandWaterThreshold` as the
dominant valid foreground stage at 304–339 ms, evaluating 17–18 candidates. The three single
fresh-process diagnostic observations completed through first paint in 612–650 ms, so this
production child is conditional rather than ready now. The retained profile and decision are in
`docs/investigations/issue-87/raw-results.json` and
`docs/investigations/issue-87/preview-latency-decision.md`.

Issue #84 must first repeat the preview gate with one foreground-preserving harness lifetime. Open
this child only if that unchanged five-fresh-process gate has a repeatable valid failure attributable
to threshold computation rather than foreground timer throttling.

## In scope

- Optimize the per-candidate water-component traversal and its local disposable working storage in
  `packages/generation/src/atlas-land-water-classification.ts`.
- Preserve the exact ordered candidate set, comparison policy, selected contour, component count,
  largest-component percentage, and connectivity-support result for every registered fixture.
- Add focused exact-equivalence and cancellation/progress tests for the selected local boundary.
- Rebuild the packaged app and rerun only the affected Apple M5 preview gate before returning to
  issue #84.

## Out of scope

- Workers, message transport, UI scheduling policy, preview/full profile resolution, schemas,
  persistence, canonical fixtures, generator behavior versions, numeric budgets, and release
  protocol changes.
- Changing candidate count, candidate eligibility, threshold comparison, connectivity intent, or
  water-component topology.
- Issue #84's full-generation, export, RSS, or cancellation matrix beyond focused regression proof.

## Acceptance criteria

- [ ] All registered fixtures produce the exact pre-change candidate sequence, selected contour,
      water-coverage result, component count, largest-component percentage, and connectivity result.
- [ ] Every registered semantic, accepted-aspect, scene, SVG, PNG, and `.mapworld` byte/hash remains
      unchanged; fixture updates are absent.
- [ ] Existing preview progress remains monotonic and bounded, preview cancellation remains
      acknowledged within 100 ms on the reference Mac, and cancellation changes no later output.
- [ ] After one untimed warm-up, all five fresh foreground processes for each gated preview fixture
      complete through the labelled first paint within 750 ms on `Mac17,2` / Apple M5 / 24 GB under
      the unchanged issue #84 conditions; every run, median, worst, executable hash, and environment
      receipt is retained.
- [ ] Focused threshold, preview, determinism, progress/cancellation, and workflow tests pass, then
      `corepack pnpm test:cross-platform` and `corepack pnpm check` pass.
- [ ] No worker, public contract, persisted format, fixture, workload, hardware, or budget change is
      included.

## Start here

1. `docs/investigations/issue-87/preview-latency-decision.md` — measured attribution and stop
   conditions.
2. `docs/investigations/issue-87/raw-results.json` — exact candidates, proxy outcomes, and package
   identity.
3. `packages/generation/src/atlas-land-water-classification.ts#selectAtlasLandWaterThreshold` —
   only authorized production boundary.
4. `packages/generation/src/atlas-land-water-classification.ts#summarizeWaterComponents` — measured
   repeated traversal.
5. `docs/milestone-2-atlas-proof.md#performance-progress-cancellation-and-resource-budgets` —
   unchanged timing, progress, and cancellation contract.
6. #84 — required valid failure evidence and post-repair release protocol.

## Implementation constraints

- Establish the valid foreground failure and retain a before profile before editing.
- Optimize data access or reusable disposable traversal state without changing candidate membership
  or the order/precision of semantic calculations.
- Do not remove or coarsen cooperation points merely to avoid background timer throttling.
- Stop and return to design if exact outcomes change, a worker/public contract is required, or the
  repair crosses outside threshold classification plus its focused tests.

## Verification

- Focused: existing land/water generator contract, invariant, operation, progress, and atlas
  workflow tests plus exact candidate/selection equivalence coverage.
- Determinism: `corepack pnpm test:cross-platform` with no fixture updates.
- Broader: `corepack pnpm check`.
- Hardware: unchanged issue #84 packaged foreground preview gate on the designated Apple M5 host.

## Dependencies

- A valid, repeatable foreground preview failure in issue #84 attributable to threshold
  computation. This dependency is not currently satisfied.

## Risks and unknowns

- The current valid diagnostic observations already pass with only 100 ms worst-case headroom; a
  five-run protocol may pass without production work.
- An optimization that changes candidate membership or floating-point accumulation is semantic and
  must stop this issue for redesign rather than update fixtures.

## Readiness

- State: NOT READY
- Rationale: The required valid foreground failure has not been observed; issue #87's three
  diagnostic runs passed. Production work is unjustified until issue #84 reproduces the gate
  failure with the corrected method.
- Recommended labels: existing `bug`; `complexity:C3`, `risk:hardware`, and `risk:determinism` if
  those labels become available.

## Codex execution profile

- Complexity: C3 — Moderate
- Complexity score: 1 breadth + 1 uncertainty + 1 state-risk + 2 verification + 1 dependencies =
  6/10
- Complexity rationale: The change is one generation subsystem, but exact deterministic proxy
  equivalence and packaged hardware verification make the repair materially riskier than a routine
  local optimization.
- Critical risk flags: deterministic output; cancellation responsiveness; hardware/environment
- Execution class: Frontier (risk bump from Balanced-plus)
- Current recommendation: `gpt-5.6-sol` / high
- Recommendation date: 2026-08-20
- Context fit: PASS — one local production boundary, bounded source reading, exact fixtures, and one
  focused plus packaged validation pass leave repair headroom.
- Expected reading: Medium
- Change surface: threshold classification implementation and focused tests only.
- Verification surface: exact deterministic fixtures, progress/cancellation, root checks, and
  packaged Apple M5 timing.
- Split or escalation trigger: any need to change candidates, semantics, worker transport, public
  contracts, or more than the threshold-classification boundary.
