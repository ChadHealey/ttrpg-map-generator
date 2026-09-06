# Issue 166 verification and review handoff

## Focused evidence

- Read the current open READY discovery issue and its specified reading sequence. Starting HEAD
  is the exact prerequisite `283b096e3045a23710b5cc01cd532cbfd1f318cd`; no scope-changing drift found.
- Verified all seven source SHA-256 entries in the retained issue-165 receipt. Reconstructed only
  normal-01's unchanged owner descriptors and independently calculated quotas, analytic cap
  integrals, deficits, eroded capacities and the minimum radius. No calibration, new grid or image
  was generated. The executable arithmetic is embedded in [capacity-audit.md](capacity-audit.md),
  not committed as a helper or new generator.
- Source audit distinguishes sampled endpoint capacity from analytic cap area, demonstrates
  guard saturation for the failed contours, and preserves the continuity-change limitation.
- [policy.md](policy.md) checks disjoint area accounting, every positive term's guard, and why
  continuity, finite old loops and an upper Lipschitz bound cannot certify the proposed hierarchy.
  Its explicit negative case replaces an unjustified successful example.
- The embedded arithmetic ran successfully, including assertions for quota agreement, the
  tolerance-adjusted negative cases, axes/radius bounds and the selected neutral-polar contour.
  All 24 relative Markdown links (including the project-plan anchor) resolve. Eleven directly
  cited historical source/evidence files match the pinned prerequisite byte-for-byte.
- One local acceptance review covered all four new documents, all six positive visual requirements
  and R1–R6. It corrected a Markdown list and clarified that suggested displacement margins are
  conservative design requirements, not proven necessary conditions. No policy change was made.

## Broader verification

Runtime: macOS arm64, Node 24.11.0, pnpm 11.19.0. Focused
`corepack pnpm exec prettier --check docs/investigations/issue-166/` passed. One broader
`corepack pnpm check` ran with these observed results:

| Stage                             | Result                                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| Prettier / ESLint                 | Passed.                                                                                      |
| TypeScript / Svelte               | Passed; zero Svelte errors or warnings.                                                      |
| Main Vitest pool                  | 100 files passed, 3 skipped; 768 tests passed, 4 skipped.                                    |
| Serial physical-atlas integration | 1 file passed; 7 tests passed, 2 skipped; 402.69 seconds.                                    |
| Isolated semantic retention       | 1 test passed; 12 unrelated tests skipped by the named filter.                               |
| Rust format / Clippy              | Passed.                                                                                      |
| Sandboxed Rust unit tests         | 47 passed, 4 socket-binding tests failed with `bound endpoint: Io`; root command exited 101. |

The four failures match the sandbox limitation retained in
[issue-165 verification](../issue-165/verification.md). One targeted `corepack pnpm rust:test`
retry outside the sandbox passed all 51 unit tests, including those four; the remaining native
recovery/workflow tests passed 28/28 (440.34 seconds), and interoperability tests passed 11/11
with two existing issue-121 qualification tests ignored. The retry exited **0**, with **90 passed**
in total. All required stages passed across the root run and targeted retry. No source repair
or repeat of unchanged JavaScript suites was needed. The sandboxed root command itself exited 101.

Final focused Prettier and whitespace checks passed on all four new Markdown files, including
the verification-result updates. Only this issue-owned directory is added; tracked production,
accepted fixtures, historical evidence and configuration remain unchanged.

No new tests, screenshots, fixture updates, Linux run or production acceptance are claimed.

## Acceptance disposition

| Issue criterion                                               | Evidence / disposition                                                                                                                                                     |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audit two normal-01 capacity failures                         | capacity-audit.md: exact quota/endpoint trace, analytic bound, tolerances, continuity limitation and fixed-allocation scope.                                               |
| Evaluate one construction policy with area/feature accounting | policy.md: envelope reserve-before-placement policy; explicit marginal role ledger and the missing numeric construction certificates. Insufficiency path.                  |
| Feasible/rejected case, gap, tolerance and no redistribution  | Rejected retained caps even without reserves; no invented feasible case. Gap remains 0.05 rad and all original numeric tolerances remain.                                  |
| Displacement and continuous scalar                            | Retained continuous guarded field; missing inverse-slope/topology certificate and analytic cut-erasure counterexample. No survival claim.                                  |
| Determinism, identities, bounds and nine controls             | policy.md separates retained fixed loops/ties from unsupported solver, identities and public-control realization.                                                          |
| Decision and conditional next step                            | README.md: insufficiency; explicit geometric-feature contract is the next decision; C1–C3 NOT READY.                                                                       |
| Preserve comparison and production gates                      | README.md and policy.md: exact six inputs, repeats, analytic continuous geometry, failures, human native/half reviews, all rejection classes and full production evidence. |
| Verification and dedicated review                             | Local checks recorded here; dedicated user-run review completed with no actionable findings. All discovery acceptance criteria are satisfied.                              |

## Execution and dedicated review

C3 / Balanced-plus discovery; current task/model settings retained without override. One documentation pass and
one normal local acceptance/diff review; no agents, branches, worktrees or nested Codex processes.
One targeted Rust environment retry; no algorithm implementation, tuning cycle, CI rerun or compaction. This negative research result
is complete evidence of insufficiency, not a blocked investigation or permission to lower the bar.

Dedicated review: **COMPLETED with no actionable findings**. The user ran the requested read-only
review against issue #166 and all four uncommitted documents. It independently reproduced both
sampled capacities using cap-only weighted arithmetic, checked the area-ledger identity across
all 128 membership combinations, reran the embedded calculations and focused formatting, verified
all 24 relative links and eleven pinned historical files, and checked the retained validation logs.
No correctness, regression, security or test repair was needed.

```text
/review Review the branch diff, including current uncommitted additions, against issue #166 and its acceptance criteria, reporting only actionable correctness, regression, security, or test findings.
```

After review, the user explicitly authorized committing, pushing and closing issue #166 if
appropriate. The reviewed insufficiency finding satisfies the discovery outcome. Publication
does not select v3, change an accepted ADR, authorize production adoption or make C1–C3 READY.
