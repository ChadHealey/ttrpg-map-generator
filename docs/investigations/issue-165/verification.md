# Issue 165 verification receipt

## Evidence and focused checks

- Runtime: macOS arm64, Node 24.11.0, pnpm 11.19.0; V8/zlib versions in [runtime.json](comparison-r1/runtime.json). No Linux execution or numeric equality claim.
- One bounded construction revision, `issue-165-r1`; twelve pairs rendered twice. Complete scalar/owner bytes, masks, 1600 × 800 PNGs, 800 × 400 PNGs and every deterministic measurement matched exactly. Eight independent abundance probes also repeated exactly.
- The pre-result [experiment definitions](experiment.md), source files and immutable baseline receipt are SHA-256 bound in [results.json](comparison-r1/results.json). Before/after old/new owner/component shares, coverage and guard contact are included without replacing baseline files.
- Focused first: 1 file / 10 tests passed. Expanded evidence and unchanged baseline checks: **3 files / 21 tests passed**. Tests cover synthetic area/component/contact interpretation, geometry bounds, positive polar/island guard containment, forced pole land, seam continuity, nested anchors, bounded failures, contour limits, abundance construction/output, source receipts, failed-row disposition and exact simplified PNG pixel correspondence.
- Assistant inspection: all twelve native images and all twelve fixed half-size reads. Human review: **12/12 fail**, all listed rationales explicitly adopted by the maintainer. This is a valid no-selection discovery outcome.

## Broader verification

One repository-wide `corepack pnpm check` run passed these stages:

| Stage                             | Observed result                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------- |
| Prettier / ESLint                 | Passed.                                                                          |
| TypeScript / Svelte               | Passed; zero Svelte errors or warnings.                                          |
| Main Vitest pool                  | 100 files passed, 3 skipped; 768 tests passed, 4 skipped.                        |
| Serial physical-atlas integration | 1 file passed; 7 tests passed, 2 skipped (411.96 seconds).                       |
| Isolated semantic retention       | 1 test passed; 12 unrelated tests skipped by the named filter.                   |
| Rust format / Clippy              | Passed.                                                                          |
| Sandboxed Rust unit tests         | 47 passed, 4 existing Unix-socket binding tests failed; root command exited 101. |

The same four socket tests had the same documented sandbox failure in issue-164. No source repair
was made. A targeted `corepack pnpm rust:test` run outside the sandbox passed all 51 Rust unit tests,
including all four socket cases, all 28 native recovery/workflow tests, and 11 interoperability
unit tests. The retry exited **0**: **90 passed**, with two existing issue-121 Swift/Rust
qualification tests ignored. All required stages passed across the root run and targeted retry.
Unchanged JavaScript suites were not rerun for the environment retry. This is not a claim that the
sandboxed root command returned zero. Linux and separately named release/qualification lanes were
not run.

All 21 focused/evidence/baseline tests also passed with `GIT_DIR` pointing to nonexistent metadata.
This checks the stronger condition of no accessible Git history, keeping verification safe for
ordinary shallow CI checkouts without hidden candidate branches or network access. All 52 relative
Markdown links resolve. Prettier checks the complete investigation; `git diff --check` passes.
The source/evidence and documentation additions were reviewed for correctness, accidental scope
changes and public-repository hygiene. All 37 additions are issue-owned (about 708 KB); every tracked
path, including production, accepted fixtures, lockfiles, accepted ADRs and issue-164, is unchanged.

## Acceptance disposition

| Criterion                                                                                  | Evidence/disposition                                                                                                                                       |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pre-result bounded definitions; identical old/new measurement interpretation               | experiment.md and receipt source hash; initial zero contour and explicit baseline proxy; preview area and coastline traversal/weights/tolerances declared. |
| Two realizations, six unchanged inputs, exact twice-run scalar/owner/image/report receipts | 12 rows and 24 PNGs retained; independent input equality and full/half hash checks.                                                                        |
| Angular gap for every term, seam/poles and exact anchors                                   | geometry.md analytic proofs plus focused tests and per-row smoke receipts; no sampled-distance substitute.                                                 |
| Continuous scalar and finite calibration/infeasibility                                     | Continuous min/max field with zero analytic contour; fixed 24 steps; synthetic failures and three real failed envelope quotas preserved.                   |
| Realized-coast island relationship and independent controls                                | Per-satellite distances/statuses and eight repeated zero/100 probes; merged/vanished terms and semantic limits explicit.                                   |
| Human per-row review and separate default diversity                                        | visual-review.md: all twelve rejected with adopted rationales; both native and simplified views inspected.                                                 |
| Selection or explicit no selection                                                         | No selection: envelope coverage and morphology fail; cellular morphology fails despite coverage. No numeric contract weakened.                             |
| Selected spec or blocked C1–C3/follow-up                                                   | No selected production spec; child-plan.md keeps C1–C3 NOT READY and proposes a bounded design-only next decision.                                         |
| v1/v2/version/M3 boundaries and cross-platform honesty                                     | Production and accepted evidence untouched; compatibility/version/stream consequences in child-plan.md; Linux unproven.                                    |
| Issue-owned changes, focused/broader checks and review                                     | Focused and broader stage results above; dedicated read-only review completed with no actionable findings.                                                 |

## Execution and dedicated review

C4 Discovery, current task/model settings; no override, child agents, worktrees, branches or nested
Codex processes. One implementation pass, including initial lint/weighting corrections before any
render; no algorithm revision after inspection, no failed-test repair cycle, CI run or compaction.
One normal final diff review completed, with documentation clarifications only. No second
construction pass or reviewed-image regeneration. One targeted Rust environment retry; zero CI
reruns. The normal final diff review is separate from the dedicated gate.

Dedicated read-only review: **COMPLETED with no actionable findings**. The user ran the requested
review against issue #165 and the uncommitted additions. The review reran all 21 focused tests and
reconstructed full normal-01 renders for both families; every deterministic report measurement
matched the retained receipt exactly. No correctness, regression, security or test repair was needed.

```text
/review Review the branch diff, including current uncommitted additions, against issue #165 and its acceptance criteria, reporting only actionable correctness, regression, security, or test findings.
```

Following the completed review, the user explicitly authorized committing, pushing and closing
issue #165 if applicable. Its supported human-reviewed no-selection outcome satisfies discovery
completion. C1–C3 remain NOT READY; no successor issue mutation, accepted ADR or production adoption
is authorized by this publication. Reviewed source and image receipts remain unchanged.
