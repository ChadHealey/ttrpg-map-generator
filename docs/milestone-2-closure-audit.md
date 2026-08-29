# Milestone 2 closure audit

**Status:** Independent assessment; advisory, not a contract change. Prepared 2026-08-29 from
`codex/m2-finalization` at `fb5e259103251b7e884bd0221dc72aa5765c6fe2`, the unintegrated issue #126
evidence at `21f2dff718f12a6cf3c0585d58a89037d58a1be6`, GitHub issues #70–#126,
[PROJECT_PLAN.md](PROJECT_PLAN.md), [milestone-2-atlas-proof.md](milestone-2-atlas-proof.md), and
[milestone-2-release-evidence.md](milestone-2-release-evidence.md). No packaged app was launched, no
qualification attempt was created or consumed, and no GitHub state was mutated during this audit.

## Executive conclusion

- **Milestone 2 is product-complete.** All eleven contract product requirements are implemented with
  automated test evidence, and the packaged ten-step visible workflow passes end to end. There is no
  TODO/FIXME debt in M2-relevant product code.
- **Milestone 2 is not evidence-complete.** Sixteen of eighteen acceptance-matrix rows in the
  release-evidence report are `PASS`. The two blocking rows are **Apple M5/24-GB budgets**
  (`OUTSTANDING`) and **Milestone issue state** (`EXTERNAL`).
- **The blocker is qualification instrumentation, not the product.** Every outstanding measurement
  funnels through issue #104's unconsumed preview/early cancellation replacement row, which is
  gated behind a zero-command observer qualification that has now failed three times (#122, #124,
  #126). The recurring `observer-client.cleanup` failure is a controller state-model defect, not a
  resource leak (see [Cleanup-failure assessment](#cleanup-failure-assessment)).
- **Recommendation: Path B.** Defer the packaged cancellation-acknowledgement and remaining
  reference-machine matrices to Milestone 9 release hardening via a new ADR, and close Milestone 2
  on the visible product exit plus the evidence that already passed. Keep the observer channel and
  repair the controller as a no-launch Milestone 9 seed task.
- **Disproportionality finding.** Roughly twenty consumed qualification attempts across four
  mechanisms (#98 through #126), more than a dozen issues, and a complete compile-time IPC subsystem
  now exist to measure millisecond-level acknowledgement latency on one reference machine, for a
  cancellation mechanism the CI suite already proves functionally. The acceptance corpus contains no
  repeated-failure escape; its only response to each failure is another one-shot successor attempt.

## Exit-criteria matrix

Classifications: **complete** (valid evidence exists), **deferrable** (product-complete,
evidence-incomplete, and arguably outside the visible M2 exit), **consumed** (only invalid/consumed
evidence exists), **external** (blocked on remote closure work).

| Criterion                                                               | Classification | Supporting evidence                                                                                                                                                         |
| ----------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Macro elevation                                                         | Complete       | `packages/generation/src/atlas-macro-elevation-field.ts`; invariants and operation tests; acceptance row `PASS`                                                             |
| Continents, major islands, archipelagos, oceans, seas                   | Complete       | `packages/generation/src/atlas-semantic-classifier.ts` and policy; six fixed-seed fixture sets; classifier/water/group tests                                                |
| Seam-safe global coastline                                              | Complete       | `packages/generation/src/atlas-coastline-topology.ts`; `atlas-coastline-adversarial.test.ts`; `milestone-2-atlas-seam-crossing` fixture; ADR-0011/ADR-0012                  |
| Stable semantic entities                                                | Complete       | `packages/core/src/atlas-geography-identity.ts`; ADR-0004/ADR-0010; byte-for-byte identity-order tests                                                                      |
| Ink-atlas rendering, coastal echoes, paper treatment                    | Complete       | `packages/assets/src/restrained-ink-atlas-style.ts`; ADR-0014; visual gallery `PASS`; twelve human review records                                                           |
| Atlas controls and coarse previews                                      | Complete       | Nine contract controls in `apps/desktop/src/App.svelte`; preview profile; issue #89 proof: 15/15 fresh runs within 900 ms (ADR-0019), worst 809.40 ms, worst RSS 157.72 MiB |
| Persistence of accepted geometry and generator versions                 | Complete       | `packages/persistence`; saved-project fixtures carry per-record `generatorVersion`; generator-free reopen tripwire test (`apps/desktop/src/atlas-workflow-reopen.test.ts`)  |
| Reroll (geography and appearance)                                       | Complete       | `selective-reroll.integration.test.ts`; checkpoint goldens; e2e commit path                                                                                                 |
| Deterministic SVG export                                                | Complete       | `atlas-svg-v1` (ADR-0015); byte-identical export tests; acceptance row `PASS`                                                                                               |
| Deterministic high-resolution PNG export                                | Complete       | `atlas-png-v1` (ADR-0016); run-1/run-2 byte-identical at 8192×4096; `pnpm test:png-export` lane                                                                             |
| Visible exit workflow (create/save/reopen/reroll/export)                | Complete       | Packaged ten-step workflow record: all steps `PASS`; four packaged artifacts with SHA-256s                                                                                  |
| Product cancellation mechanism                                          | Complete       | Cooperative cancellation in the generator and both exporters; cancel-before-commit tests; non-cancellable native-commit boundary modeled and tested                         |
| Apple M5 full-generation five-run matrix                                | Deferrable     | `NOT RUN`; issue #95 stopped pre-dispatch on the observer-authority blocker; issue #94 qualified the path only                                                              |
| Apple M5 SVG/PNG export five-run matrices                               | Deferrable     | `NOT RUN`; issue #101 qualified the export-completion authority only (6/6 valid, no budget claim)                                                                           |
| Preview cancellation acknowledgement ≤100 ms (packaged)                 | Consumed       | #98/#102/#103 rows `INVALID, CONSUMED`; #104 replacement `UNCONSUMED`; zero-command attempts #122/#124/#126 all `INVALID/CONSUMED`                                          |
| Full-generation/SVG/PNG cancellation acknowledgement ≤500 ms (packaged) | Deferrable     | `NOT RUN`; the issue #99 export-cancellation observer was never implemented                                                                                                 |
| Milestone issue state                                                   | External       | Fourteen M2 issues open; remote mutation was prohibited during evidence preparation                                                                                         |

None of the deferrable or consumed rows is named in PROJECT_PLAN.md's Milestone 2 bullets. They
enter Milestone 2 only through the visible-exit sentence's delegation to the atlas-proof contract,
whose release-status header keeps every acceptance requirement "in force until their evidence is
complete."

## Issue classification

| Issue     | Classification                            | Disposition                                                                                                                                                                     |
| --------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #70       | Tracking-only; stale                      | Body still blocks on the retired issue #110 owner-click report. Update or absorb into #95; close with a move note under Path B                                                  |
| #72       | Tracking / release administration         | The audit task itself is current closure work; blocker-chain wording is stale. Update, then execute                                                                             |
| #73       | Tracking / closeout                       | Correctly ordered last; blocker text stale. Update, then execute after #72                                                                                                      |
| #95       | Current release-protocol execution; stale | Background still cites the retired focus path. Move to Milestone 9 under Path B                                                                                                 |
| #98       | Current tracking parent                   | Ledger accurate except "#125 READY" and the missing #126 outcome. Minor update; move the remainder to Milestone 9 under Path B                                                  |
| #99       | Current implementation (held); stale      | The export-cancellation observer was never built; body still cites retired Computer-Use issue #111. Do not assign as written; move to Milestone 9 under Path B                  |
| #104      | Current qualification owner               | Accurate except the #125/#126 lag. Never consume it without a repaired controller; move to Milestone 9 under Path B                                                             |
| #105–#110 | Historical/consumed; superseded           | The retired focus/Accessibility/operator chain, superseded by ADR-0020. Issue #98 itself declares them "completed/consumed records, not work to assign." Ready to close         |
| #126      | Consumed qualification; stale             | The GitHub body still reads READY/armed; the attempt is `INVALID/CONSUMED`. Record the terminal outcome. Its successor is the controller-repair task, not another qualification |

Closed issues #111–#125 were verified as consistent historical records; #118–#121 and #123/#125 are
the completed process-bound observer chain, and #122/#124 are the first two consumed zero-command
attempts.

## Observer necessity decision

The strict packaged matrix is normative today only because of two clauses: the atlas-proof
release-status header ("every other acceptance requirement below remain[s] in force until their
evidence is complete") and the release-evidence blocking rule ("Milestone 2 cannot be called
complete while any contract row is `FAIL`, `NOT RUN`, `PENDING`, `OUTSTANDING`, or `EXTERNAL`").
The corpus contains a budget-adjustment clause (used by ADR-0019) but no de-scope procedure and no
provision for repeated evidence failure. The only movement lever is
[06-definition-of-done.md](06-definition-of-done.md): "Every included issue is closed or explicitly
moved out."

### Path A — preserve the strict contract

Now cheaper than before because the failure is diagnosed. The smallest no-launch correction:

1. Split the collapsed `observer-client.cleanup` result into typed component results
   (`observer-client.cleanup.candidate`, `observer-client.cleanup.endpoint`).
2. Stop the cleanup throw from masking a pending `operationError`, so the record can prove whether
   mutual authentication and frontend READY were reached.
3. Ground candidate-death detection in kernel truth (the existing run-loop-independent
   `processPathSnapshot` / `proc_pidpath` primitive) instead of the KVO-frozen retained handle,
   keeping every fail-closed identity check.
4. Land deterministic no-launch reproduction and the acceptance tests below before any new live
   authority.

Even after that fix, Path A still requires several one-shot live sessions in sequence: the
zero-command gate, issue #104's six rows, the unbuilt issue #99 observer plus its qualification, and
issue #95's five-fresh-process matrices. Each session runs under single-consumption rules and can
fail on a new edge.

### Path B — revise the contract (recommended)

Move the packaged cancellation-acknowledgement lanes and the remaining reference-machine matrices
(full generation, SVG export, PNG export) to Milestone 9 release hardening, which already owns
"Test large SVG/PNG exports and memory limits" and "Package and test the macOS application."
Milestone 2 closes on: the packaged visible-exit workflow (`PASS`), the complete local and CI gate
record, deterministic export evidence, the reviewed visual gallery, and the passed issue #89 preview
budget. Transparency is preserved: no row is deleted or silently waived — deferred rows are
relabeled with pointers to their new owner, the three `INVALID/CONSUMED` qualification records stay
byte-identical, and a new ADR records the decision and its reasoning.

Documents requiring edits under Path B:

- `docs/PROJECT_PLAN.md` — narrow the Milestone 2 visible-exit delegation; add the moved items to
  Milestone 9 and its acceptance criteria (Section 15).
- `docs/milestone-2-atlas-proof.md` — the release-status ratchet header; the performance, progress,
  cancellation, and resource-budget section (protocol paragraph, budget table, the issue #68
  outstanding-work sentence, the 100 ms/500 ms acknowledgement and 3×5 safe-point trial
  requirements); demote the observer-authority stop records in place as history. The functional
  cancellation semantics in the preview/acceptance boundary stay in Milestone 2.
- `docs/milestone-2-release-evidence.md` — the blocking rule; the `OUTSTANDING` acceptance row; the
  reference-performance lane (also fix its stale "base-M1" wording); the issue #89 per-operation
  table; the final-owner action list.
- ADRs — a new deferral ADR; scope amendments or supersession notes for ADR-0017, ADR-0019
  (its "protocol remains incomplete" consequence), and ADR-0020 framing; the residual issue #70
  references in ADR-0018.
- `docs/retrospectives/milestone-2.md` — status and completion-condition language.

### Tradeoff

|                           | Path A                                                                    | Path B                                                                        |
| ------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Time to close Milestone 2 | Weeks; several one-shot live sessions must all succeed                    | Days; documentation and issue work only                                       |
| Risk carried              | Schedule risk; further consumed attempts                                  | Acknowledgement-latency budgets unproven on packaged builds until Milestone 9 |
| Evidence integrity        | Full strict matrix inside Milestone 2                                     | Same matrix, later milestone, explicit ADR trail                              |
| Product risk controlled   | Identical — the product cancellation mechanism is CI-proven in both paths | Identical                                                                     |

**Recommendation: Path B**, with the controller repair retained as a Milestone 9 seed so the
observer channel is trustworthy when the deferred matrix runs. The deferred measurements protect
release quality, not atlas correctness; Milestones 3–8 product work should not queue behind a
millisecond-latency proof on one machine.

## Remaining work, dependency-ordered (Path B)

1. **Stop/go — owner decision.** Approve the Milestone 9 deferral. No code, no evidence; everything
   below waits on this.
2. **Integrate the issue #126 evidence.** Fast-forward `codex/m2-finalization` to `21f2dff`.
   Evidence-only; no fresh task needed. Do this before any documentation edits, because `21f2dff`
   already edits both normative documents.
3. **Scope ADR and documentation edits.** One fresh no-launch task covering the document list above.
4. **Controller repair (optional Milestone 9 seed).** One fresh no-launch task: typed cleanup
   results, kernel-truth termination, faithful frozen-handle tests, stub-bundle harness. No live
   packaged-app attempt; not a Milestone 2 gate.
5. **Issue audit (issue #72).** The first GitHub mutation; requires owner approval. Record issue
   #126's terminal outcome; close #105–#110 as superseded; move #95, #99, #104, and the #98
   remainder to Milestone 9 with pointers; refresh or absorb #70; refresh #73.
6. **Push, merge, and close (issue #73).** Push `codex/m2-finalization`, merge to `main`
   (fast-forward-clean), update the retrospective and release records, flip release-pending to
   complete, close the milestone last.

Do not assign: #105–#110 (superseded), #99 as currently written, any new qualification attempt, or
anything that consumes issue #104. Live packaged-app attempts required on Path B: none. On Path A,
a live attempt is permitted only after every controller-repair acceptance test passes.

## Cleanup-failure assessment

**Failing component: candidate process cleanup** (very high confidence). In the terminal collapse
(`observer-client-controller.swift:126–131`) both cleanup booleans always evaluate, and the private
runtime directory is removed only by the controller's own `endpoint.cleanup()`. Both #124 and #126
found zero runtime directories with no independent removal recorded, so the endpoint-socket and
directory components returned true; the false conjunct is `terminalCandidateCleanup()`.

**Mechanism.** `terminateAndWait` (post-#125, `observer-qualification-wrapper.swift:185–259`)
requires the state pair `(.terminated, .absent)`. The fresh exact-bundle scan reaches `.absent`, but
the retained side reads the same `NSRunningApplication` instance's `isTerminated`, which updates
only via KVO delivered on the observing process's run loop — and the controller busy-polls with
`usleep` on the main actor without ever returning to the run loop. The pair therefore freezes at
`(.live, .absent)`, re-polls to the 5-second deadline, and fails closed as the generic
`observer-client.cleanup`. The #125 correction legalized `(.terminated, .absent)`, a state the live
tool cannot reach under this execution model; the 14/14 injected wrapper tests pass because the test
double drives both state sources from one flag, so the exact live skew (scan absent, handle frozen
live) is untested. Candidate cleanup has plausibly never once succeeded in a live run.

- **Real resource leak?** No. Independent zero state (processes, sockets, runtime directories) was
  proven in both #124 and #126 with nothing removed independently.
- **Should independent zero state count as successful cleanup?** Under the intended threat model —
  prove the exact candidate is gone and nothing persists — kernel-truth process absence plus the
  fail-closed exact-bundle scan is the stronger signal, and the controller already owns a
  run-loop-independent primitive (`processPathSnapshot` via `proc_pidpath`). The state model should
  be grounded in that; the strict identity validation stays.
- **Diagnosis class.** An overly strict controller state model combined with insufficient diagnostic
  granularity: one opaque public result covers two components, is thrown before `operationError`,
  and the sanitization policy records no component detail, so the evidence cannot even assert
  whether READY was reached.

**Reproduction without a packaged-app qualification:**

- An injected no-launch test whose fake handle's `isTerminated()` stays false permanently while the
  injected scan returns empty after `terminate()`. On `fb5e259` this deterministically produces
  `observer-client.cleanup` with `commandCount: 0`.
- A live stub harness using a trivial non-product `.app` with its own bundle identifier: launch via
  `NSWorkspace`, terminate, busy-poll on the main thread and observe the frozen handle; spin the run
  loop once and observe it flip. No observer channel, socket, or product code is involved.

**Acceptance tests required before any new target authority:**

1. The frozen-handle regression passes (it fails on current `fb5e259` code).
2. Kernel-alive plus scan-absent keeps waiting, then yields the typed
   `observer-client.cleanup.candidate` at the deadline.
3. Replacement, multiple-candidate, wrong-PID, wrong-digest, and PID-reuse cases remain fail-closed.
4. Component-typed errors cover candidate-only, endpoint-only, and both; a pending `operationError`
   is no longer masked by a cleanup failure.
5. The new error tokens pass the privacy guard and every sanitization gate; the
   candidate-before-endpoint cleanup ordering test still passes.
6. The stub-app harness passes end to end on the target machine before a qualification attempt is
   consumed.

## Git and evidence state

- `codex/m2-finalization` at `fb5e259` is 63 commits ahead of and 0 behind `main`; it merges as a
  clean fast-forward.
- The issue #126 commits `f42319d` (Phase A) and `21f2dff` (Phase B) are evidence-only and sit
  directly on `fb5e259`. They should be integrated even though the attempt is invalid: the contract
  requires recording consumed attempts, and `21f2dff` already carries the corresponding updates to
  `milestone-2-atlas-proof.md` and `milestone-2-release-evidence.md`.
- Eventually push: `codex/m2-finalization` including the #126 evidence, followed by the Path B
  documentation commits.
- GitHub issue bodies currently contradicting the latest evidence: #126 (reads READY; is
  `INVALID/CONSUMED`), #70 and #95 (block on the resolved #110 owner report), #99 (cites the retired
  #111 Computer-Use path), and #98/#104 (list #125 as READY and omit #126).
- All historical evidence is preserved: the #122/#124/#126 sanitized records remain byte-identical,
  no invalid attempt is reinterpreted as valid, and no mutual-authentication or frontend-READY claim
  is made for any consumed attempt.
