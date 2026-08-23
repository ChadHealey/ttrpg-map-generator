# Proposed updated body for issue #89

## Outcome

Reduce packaged coarse-preview completion through the approved labelled first-paint receipt below
the unchanged 750 ms limit by optimizing only the exact repeated water-component traversal inside
threshold selection, while preserving every candidate, selected threshold, connectivity proxy,
deterministic artifact, progress event, cancellation boundary, and observer qualification rule.

## Background and evidence

Issue #92 measured the exact post-#91 candidate at clean commit
`c10d6c158319a50cc11e99fd1d89005b5906c4da`. Its clean packaged executable SHA-256 is
`931235e8a989a3980533c7ba5387ba3622520762f3a05ae551856eb6eec116ee`, byte-identical to
the executable retained by issue #84. After one untimed warm-up, all nine issue #90-valid fresh
processes exceeded 750 ms:

- proof: 829.59–886.91 ms;
- fragmented islands: 871.85–936.59 ms;
- control maximum: 876.36–878.51 ms.

Temporary observational probes measured threshold selection as the dominant application stage in
every run at 304–356 ms. The repeated `summarizeWaterComponents` calls alone consumed 169–207 ms
for the unchanged 17–18 candidates. Sampling remained 63–68 ms, classification 159–161 ms,
preview-value materialization 52–55 ms, and canvas presentation 3–4 ms. Mixed post-canvas-to-
receipt time was separately measured at 212.55–267.75 ms and is not assigned to product code: its
147.89–191.35 ms canvas-to-frame segment includes unisolated profile publication and browser paint,
while only the 58.85–76.40 ms after the qualifying frame is observer-owned.

The decision, exact sanitized receipts, reconciliation, run order, probe patch, and private raw-CSV
retention locators are under `docs/investigations/issue-92/`. That evidence selects disposition A:
the repeated local component traversal is the smallest product boundary with enough measured cost
to repair the repeatable 79.59–186.59 ms wall-clock overage.

## In scope

- Optimize the per-candidate water-component traversal and its local disposable working storage in
  `packages/generation/src/atlas-land-water-classification.ts`.
- Reuse safe local traversal state only when it preserves the exact candidate-by-candidate result
  and cancellation/cooperation boundary.
- Add focused exact-equivalence coverage for every threshold candidate, not only the final selected
  contour.
- Rebuild the packaged candidate and run the unchanged issue #90/#91 preview gate after focused and
  repository verification pass.

## Out of scope

- Workers, message transport, UI scheduling, observer or Accessibility behavior, ScreenCaptureKit
  calibration, preview/full resolution, workload, hardware, or numeric budgets.
- Schemas, persistence, public contracts, fixtures, generator behavior versions, or dependencies.
- Changing candidate eligibility, count, order, comparison, contour precision, connectivity intent,
  component topology, component-percentage arithmetic, or selected results.
- Removing, combining, or coarsening cooperation points to reduce foreground or background timer
  waits.
- Optimizing sampling, classification, preview materialization, canvas rendering, the mixed
  post-canvas interval, or observer-owned intervals.
- Issue #84's full hardware/UI release rerun beyond the affected preview gate. Existing automated
  generation, export, save/reopen, and cancellation suites remain in scope solely as deterministic
  equivalence and regression gates for the threshold-only change.

## Acceptance criteria

- [ ] Before editing, retain issue #92's clean candidate, executable, observer, sampler, host, and
      stage-attribution identities as the authoritative before evidence.
- [ ] For every registered fixture and every ordered threshold candidate, pre-change and post-change
      contour, weighted water coverage, coverage error, component count, largest-component
      percentage, connectivity-support result, and comparison order are exactly equal.
- [ ] The selected contour and complete preview output are byte-for-byte unchanged for every
      registered fixture. Every semantic, accepted-aspect, scene, SVG, PNG, and `.mapworld`
      byte/hash remains unchanged; fixture updates are absent.
- [ ] Existing threshold cooperation counts and order remain exact, progress remains monotonic and
      bounded, cancellation is acknowledged within 100 ms on the reference Mac, and cancellation
      schedules no later output.
- [ ] Focused measurement demonstrates that only the component-traversal boundary materially
      changed; sampling, classification, materialization, presentation, observer authority, and
      visible result remain unchanged.
- [ ] After one untimed warm-up, all five fresh foreground processes for each gated preview fixture
      complete through the issue #90 labelled first-paint/Accessibility endpoint within 750 ms and
      256 MiB additional process-tree RSS on `Mac17,2` / Apple M5 / 24 GB / macOS 26.5.1
      (`25F80`). Every observer receipt and PID-bearing CSV is retained through issue #91 before
      cleanup; median, worst, executable/observer/sampler hashes, run order, commands, and sanitized
      retention locator are recorded.
- [ ] Focused threshold, preview, determinism, progress/cancellation, packaged-dispatch, and atlas
      workflow tests pass, followed by `corepack pnpm test:cross-platform` and
      `corepack pnpm check` with no fixture updates.
- [ ] No worker, dependency, public contract, persisted format, fixture, workload, resolution,
      observer, hardware, or budget change is included.

## Start here

1. `docs/investigations/issue-92/preview-attribution-decision.md` — current-candidate attribution,
   measured observer overhead, disposition, and stop conditions.
2. `docs/investigations/issue-92/raw-results.json` — exact nine-run stages, candidates, RSS,
   reconciliations, identities, and retention locators.
3. `docs/investigations/issue-92/instrumentation.patch` — temporary current-source stage boundaries;
   use for before/after evidence only and do not leave probes in production.
4. `docs/investigations/issue-92/measurement-commands.md` — sanitized build, observer, fixture
   setup, retention, and restoration command transcript to adapt for before/after evidence.
5. `packages/generation/src/atlas-land-water-classification.ts#selectAtlasLandWaterThreshold` —
   only authorized production boundary.
6. `packages/generation/src/atlas-land-water-classification.ts#summarizeWaterComponents` — exact
   repeated traversal to optimize.
7. `packages/generation/src/atlas-land-water-generator-operation.test.ts` and
   `packages/generation/src/atlas-land-water-progress.test.ts` — deterministic aftermath,
   cooperation, and cancellation coverage.
8. `docs/investigations/issue-90/README.md` — unchanged foreground observer and qualification
   protocol.
9. `docs/milestone-2-atlas-proof.md#performance-progress-cancellation-and-resource-budgets` —
   unchanged time, memory, progress, and cancellation contract.

## Implementation constraints

- Work only inside threshold classification plus focused tests unless a test-owned profiling helper
  is required for exact before/after evidence.
- Prefer reusable typed arrays, visitation stamps, or another project-owned disposable traversal
  representation that avoids repeated allocation/clearing without changing canonical visit order
  or floating-point accumulation.
- Preserve each cooperation call after the same completed candidate. Do not trade cancellation or
  progress responsiveness for timing headroom.
- Do not add a dependency. Do not hide a semantic change behind fixture updates or a generator
  version bump; any changed candidate or output stops this issue for redesign.
- Remove temporary probes before final source verification and prove restored measurement sources
  match their clean identities when before/after instrumentation is used.
- The issue #92 diagnostic recorded two fragmented-islands RSS deltas above 256 MiB. The post-repair
  release gate remains authoritative. If RSS repeatedly fails and cannot be attributed to local
  component-traversal storage, stop and draft a separate bounded attribution issue rather than
  expanding this implementation.

## Verification

- Focused equivalence: threshold selection/component summaries across all registered fixtures,
  including every ordered candidate and the selected result.
- Focused behavior: land/water generator contract, invariant, operation, progress/cancellation,
  packaged-dispatch, and atlas workflow tests.
- Exact focused command:

  ```sh
  corepack pnpm vitest run \
    packages/generation/src/atlas-land-water-generator-contract.test.ts \
    packages/generation/src/atlas-land-water-generator-invariants.test.ts \
    packages/generation/src/atlas-land-water-generator-operation.test.ts \
    packages/generation/src/atlas-land-water-progress.test.ts \
    apps/desktop/src/packaged-preview-dispatch.test.ts \
    apps/desktop/src/atlas-workflow.test.ts \
    apps/desktop/src/atlas-workflow-generation.integration.test.ts
  ```

- Deterministic artifact equivalence, with no fixture updates or changed hashes:
  `corepack pnpm test:cross-platform`, `corepack pnpm test:visual`,
  `corepack pnpm test:png-export`, `corepack pnpm test:e2e`, and
  `corepack pnpm test:native-recovery`.
- Broader: `corepack pnpm check`.
- Hardware/UI: unchanged issue #90 observer and issue #91 private-retention protocol, one warm-up plus
  five valid fresh processes per fixture, followed by explicit median/worst and privacy review.

## Dependencies

- Complete evidence: issue #92 disposition A, after its sanitized evidence change is integrated.
- Complete infrastructure: issue #90 observer and issue #91 private-retention boundary.
- Downstream: issue #84 may resume its unchanged release protocol only after this repair and its
  affected preview gate pass.

## Risks and unknowns

- Eliminating the full 169–207 ms traversal cost is not assumed; the implementation must measure
  achieved headroom and stop if the bounded local optimization cannot satisfy the fixed gate.
- Reused traversal state can introduce stale visitation, candidate-order, cancellation, or
  component-arithmetic defects even when the final selected contour appears unchanged.
- Mixed post-canvas time varies by roughly 55 ms and remains part of the fixed endpoint. Its
  unisolated application-probe/browser-paint portion is not a product optimization target for #89;
  product work must provide sufficient worst-run headroom without changing the observer authority.
- Two fragmented-islands diagnostic runs exceeded the RSS limit. A distinct repeatable memory-only
  failure may require separate attribution after the local traversal allocation is measured.

## Readiness

- State: READY
- Execution kind: Implementation
- Rationale: issue #84 supplies one clean fresh-process failure plus its clean warm-up on an
  executable byte-identical to issue #92's clean candidate; issue #92 adds nine valid
  current-source instrumented fresh-process failures, exact stage attribution, one local production
  boundary, unchanged semantic outputs, and the approved post-repair verification protocol.
- Code changes: Authorized only for threshold classification and focused tests described above.
- Recommended labels: existing `bug`; `complexity:C3`, `risk:hardware`, `risk:determinism`, and
  `risk:memory` would be useful if available.

## Codex execution profile

- Complexity: C3 — Moderate
- Complexity score: 1 breadth + 1 uncertainty + 1 state-risk + 2 verification + 1 dependencies =
  6/10
- Complexity rationale: The code surface is one local traversal, but exact candidate equivalence,
  cancellation responsiveness, deterministic artifacts, and packaged hardware verification make
  the repair materially riskier than routine optimization.
- Critical risk flags: deterministic output; cancellation responsiveness; hardware/environment;
  UI paint endpoint; diagnostic RSS variability
- Execution class: Frontier
- Current recommendation: `gpt-5.6-sol` / high
- Recommendation date: 2026-08-22
- Context fit: PASS — one production module, bounded focused tests, and one affected packaged gate
  leave review and repair headroom.
- Expected reading: Medium
- Change surface: threshold-classification implementation and focused tests only.
- Verification surface: exact candidate equivalence, deterministic fixtures, progress/cancellation,
  root checks, and packaged Apple M5 timing/RSS/first-paint evidence.
- Split or escalation trigger: any changed candidate or output, required worker/observer/public
  contract/dependency change, persistent RSS failure outside local traversal storage, or inability
  to meet the fixed wall-clock gate within the threshold-only boundary.
