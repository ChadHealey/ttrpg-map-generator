# Issue 167 — arithmetic, verification and decision record

Proposal: [README.md](README.md). **Targets adopted for design investigation; adoption ACCEPTED; dedicated user-run
acceptance review COMPLETED with no actionable findings.** The subsequent maintainer decision is recorded below. The issue is a
READY discovery; new issue-owned Markdown is the complete authorized change surface.

## Source trace and scope

Starting clean `main` HEAD is `09fadb5f403f54ad77864c83a8c82b0de1401ef2`, exactly the published
issue-166 prerequisite. Issue 167 was open and READY when read, updated 2026-09-06. Its referenced
paths and symbols are present; no scope-changing drift or unmet predecessor was found.

| Claim or requirement                                                             | Pinned repository source at starting HEAD                                                                                                                                           |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2 outcome and semantic/disposable boundaries                                    | [Project plan M2](../../PROJECT_PLAN.md#milestone-2--whole-world-atlas-postcard), [atlas proof](../../milestone-2-atlas-proof.md)                                                   |
| Missing feature requirements; reserve-before-placement policy; no v3 selection   | [166 decision](../issue-166/README.md), [166 policy](../issue-166/policy.md)                                                                                                        |
| Normal-01 quotas, analytic cap mismatch, cut erasure and scalar-unit distinction | [166 capacity audit](../issue-166/capacity-audit.md), [165 receipt](../issue-165/comparison-r1/results.json), `budgetShares` and `calibrate` in [165 field](../issue-165/field.mjs) |
| 0.05-rad gap, continuous analytic field, finite old budgets, coverage limits     | [165 geometry](../issue-165/geometry.md), [165 experiment](../issue-165/experiment.md)                                                                                              |
| Nine controls, exact ranges, steps and defaults                                  | [core model](../../../packages/core/src/atlas-geography-model.ts), [core validation](../../../packages/core/src/atlas-geography-validation.ts), atlas proof control table           |
| Six positive observations, R1–R6 and all twelve continuing human failures        | [164 visual contract](../issue-164/visual-contract.md), [165 human decision/rationale table](../issue-165/visual-review.md)                                                         |
| Historical validation limits and later readiness/compatibility gates             | [166 verification](../issue-166/verification.md), [165 child plan](../issue-165/child-plan.md), 166 decision                                                                        |

Everything else numerical in the candidate table, role ratio and ordinary audit domain is an
explicit design recommendation in this proposal. The 0.04/0.05/0.01-rad clearance/motion choices
are new judgments, not adoption of the old 0.02-rad contact diagnostic. No external survey,
image inspection, comparison rerun, executable helper, production edit or fixture change is used.

## Bounded arithmetic and threshold evaluation

All synthetic examples below illustrate **rule evaluation only**. They are not feasible generated
worlds, feature-survival certificates or visual passes. Numbers represent stipulated exact inputs
unless identified as rounded results. Reproduce with ordinary arithmetic and radian trig; binary64
results are approximate, not formal floating-point enclosures or cross-platform equality evidence.

Unit checks: integrate a cap to obtain `A(r) = (1 − cos(r))/2` of sphere area. Thus a primary
interior disk of radius 0.15 has area 0.005614461032 (0.5614461032% of sphere), and the subordinate
0.075-rad disk has area 0.001405590944. These are **radii** for widths 0.30 and 0.15.
For `C = 40000`, a 0.30-rad width is `40000 × 0.30/(2π) = 1909.859317` km; a 0.01 sphere fraction
is `0.01 × 40000²/π = 5092958.178941` km². Multiplying a body share by `Q`, not by 4π, yields a
sphere fraction. Multiplying a sphere fraction by 4π yields steradians.

| Rule under test (other conditions held passing) | Boundary passing illustration                                                         | Failing illustration                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Primary role audit                              | Largest body Q = 0.10; declared primary at 0.0500 receives full primary requirements  | Undeclared primary-sized body at 0.0500 cannot pass as subordinate; 0.0499 may be subordinate only if not declared/visually primary |
| Primary interior                                | Width 0.3000 rad, surviving B/Q = 0.5500                                              | Width 0.2999 or share 0.5499                                                                                                        |
| Subordinate interior                            | Width 0.1500 rad                                                                      | Width 0.1499                                                                                                                        |
| Two lobe contributions and inequality           | Shares 0.08 and 0.12: sum 0.20, ratio 1.5                                             | 0.0799 and 0.1201 fail the individual floor; 0.0801 and 0.1199 fail ratio (≈1.49688); 0.08 and 0.1199 fail sum                      |
| Lobe attachment                                 | Both minimum collar crosscuts 0.1000 rad                                              | Either has minimum 0.0999, even if its chosen widest root is 0.12                                                                   |
| Peninsula lower bounds                          | Extent 0.20, root 0.10 rad, share 0.05: ratio 2                                       | Extent 0.1999, root 0.0799, share 0.0499, or extent 0.20/root 0.1001 (ratio ≈1.99800)                                               |
| Peninsula upper bounds                          | Extent 0.45, root 0.16 rad: ratio 2.8125                                              | Extent 0.4501 or root 0.1601                                                                                                        |
| Embayment                                       | Depth 0.15, opening 0.30 rad, removed share 0.02: ratio 0.5; opening 0.12 also passes | Depth 0.1499, opening 0.1199 or 0.3001, or removed share 0.0199                                                                     |
| Guard and motion                                | Final clearance 0.04, nominal 0.05, certified motion ceiling 0.01 rad                 | Final 0.0399, nominal 0.0499, or required motion 0.0101; writing a ceiling alone is no certificate                                  |
| Pairwise gap                                    | Radii 0.50 and 0.40, center distance 0.95 rad: gap 0.05                               | Same radii, distance 0.9499: gap 0.0499                                                                                             |
| Sample coverage (count 4)                       | Total error ±0.25 pp separately on preview/full; owner error ±0.0625 pp               | Total error 0.2501 pp at either scale or owner error 0.0626 pp                                                                      |
| Input validation versus no proposal             | Count 4 is valid input, subject to feasibility checks                                 | Count 0 is invalid input; it is not a capacity failure                                                                              |

For motion headroom at the proposed ceiling, nominal lower bounds become primary width 0.32,
lobe root 0.12, peninsula extent 0.22, and embayment depth 0.17 rad by adding `2 × 0.01`.
For bounded widths, nominal peninsula root 0.10..0.14 and embayment opening 0.14..0.28 leave
0.02 headroom on both ends. The allowed intervals are nonempty; ratios, areas, topology and all
contour values still need independent checks. These additions do not derive a real displacement
bound for any field, and are not sufficient for feature survival.

### Overlap ledger illustration

Stipulate pre-cut sphere fractions `b = 0.060`, marginal lobes `0.015` and `0.010`, and marginal
peninsula `0.010`. Their union is 0.095. Let embayment subtraction `e = 0.005` occur within B
away from its certified disk and roots; this stipulation supplies no construction proof. The body
then has `Q = 0.090`, surviving B = 0.055 and lobe/peninsula contributions unchanged.
The surviving shares are `0.055/0.09 = 0.611111...`, `0.015/0.09 = 0.166666...`,
`0.010/0.09 = 0.111111...` for the second lobe and peninsula; lobe ratio is 1.5 and sum is
0.277777.... Removed water is `0.005/0.09 = 0.055555...`. All area-share rules pass arithmetically.

An island/group union of 0.012 overlapping surviving U by 0.005 adds only 0.007. A finite polar
reserve of 0.008 overlapping the previous land union by 0.005 adds only 0.003. Neither overlaps E.
Owner quota is `0.060 + 0.015 + 0.010 + 0.010 − 0.005 + 0.007 + 0.003 = 0.100`.
Here the peninsula is 10% of owner land and 11.111...% of body land, but 1% of the sphere.
Counting full islands/polar reserves would incorrectly yield 0.110. Any positive term entering
protected E fails even if the global total is subsequently reduced somewhere else.

For a separate capacity-only example take `r = 0.50`, `m = 0.04` and water reserve `μ(W) = 0.005`
inside K. Then `A(0.46) = 0.051973751237` and available area is 0.046973751237.
Quota 0.0469 passes this necessary check, 0.0470 fails, and the exact boundary
`q = (1 − cos(0.46))/2 − 0.005` passes by equality. Even the passing case might be disconnected:
water can divide K into many pieces, none containing a 0.15-rad interior disk or the required
root collars. Adequate aggregate area is insufficient for connected hierarchy.

### Mandatory retained rejection: normal-01

Read only the envelope/normal-01 entry of the retained receipt. Seed 1, default controls and size
weights `0.95², 0.95², 0.55², 0.55²` give total weight 2.41. Each first owner's quota is
`0.35 × 0.9025/2.41 = 0.13106846473029043`, or 13.106846473029% of sphere. Rounded radii below
come from the pinned capacity audit; using those 12-decimal inputs changes only trailing digits.

| Owner |    Radius, rad | Analytic cap sphere fraction | Requested minus cap, pp | Cap eroded by proposed 0.04, sphere fraction |
| ----- | -------------: | ---------------------------: | ----------------------: | -------------------------------------------: |
| 0     | 0.718621905077 |               0.123643145186 |          0.742531954422 |                               0.110780741706 |
| 1     | 0.698415653018 |               0.117069054365 |          1.399941036522 |                               0.104518685288 |

Even `q − 0.000625` exceeds each **uneroded** cap. Required radius without water or shape reserves
is `acos(1 − 2q) = 0.740897525854`, larger than both. Sampled endpoint capacities are separately
0.12372378143624992 and 0.1170959739131866; deficits are 0.7344683294040519 and
1.3972490817103833 pp. Do not substitute those sampled capacities for the analytic cap integral.
The retained selected threshold is −4000000 ticks = −4 scalar units for both; the pinned audit
proves their fields saturate the guards and erase the cuts. This is mandatory rejection of the
fixed caps and quotas, even before the new reserves. It does not reject all placements or the
envelope family. No recalibration, rendering or parameter search was run.

## Acceptance and checks

| Issue criterion                                                      | Evidence / disposition                                                                                                                    |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Full measurable target table; inherited/proposed/unproved separation | README authority, frame and candidate table; all seven requested quantities have object, stage, units, value, applicability and rationale |
| Roles, overlap and count intent                                      | README role witnesses and primary audit; 1..8 retained; ordinary 1..3 visual check; no relabeling; main versus detached applicability     |
| Spherical units and two display sizes                                | README measurement frame; unit arithmetic above; no pixel authority or polar-width shortcut                                               |
| Ledger, protected water, gap and contour budget                      | README reserve ledger and certificate obligations; overlap example and boundary checks above                                              |
| Reproducible arithmetic and mandatory failure                        | Equations and passing/failing thresholds above; retained cap rejection; adequate area explicitly insufficient                             |
| Nine controls, tolerances and valid-input failure policy             | README nine-row control table and no-proposal policy; no measured success/failure rate claimed                                            |
| Six positives and R1–R6                                              | README twelve-row cross-check; all historical human failures remain failures                                                              |
| One recommendation; independent adoption status                      | Adopted for design investigation by subsequent explicit instruction; no production or visual acceptance                                   |
| Conditional next task and later gates                                | README decision: design issue only after adoption, comparison not READY, C1–C3 NOT READY, all production/compatibility gates retained     |
| Focused/broader verification and dedicated review                    | Local results below; dedicated user-run review completed with no actionable findings                                                      |

Focused checks passed: all seven retained receipt source SHA-256 values match; all 27 relative
Markdown links and their anchors resolve; all 15 distinct cited repository files match the pinned
HEAD byte-for-byte. Scratch arithmetic checked the cap integrals, quota deficits, unit conversions,
area ledger, boundary ratios and capacity examples. Exhaustive Boolean membership accounting
checked the ledger identity for all permitted combinations of B/L1/L2/P/E/I/Z, excluding positive
island/polar overlap with protected E. The proposal includes all nine control names, six positive
requirements and R1–R6. Focused Prettier passed. No scratch helper was saved in the repository.

One local acceptance/diff review clarified the subordinate interior share exemption and the
owner-land denominator, distinguished the selected-contour quota equality from other interval
values, and corrected a review-handoff link label. No policy expansion or code repair was needed.

Runtime: macOS arm64, Node 24.11.0, pnpm 11.19.0. One repository-required
`corepack pnpm check` ran with the observed results below.

| Stage                             | Result                                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| Prettier / ESLint                 | Passed.                                                                                      |
| TypeScript / Svelte               | Passed; zero Svelte errors or warnings.                                                      |
| Main Vitest pool                  | 100 files passed, 3 skipped; 768 tests passed, 4 skipped.                                    |
| Serial physical-atlas integration | 1 file passed; 7 tests passed, 2 skipped; command duration 414.29 seconds.                   |
| Isolated semantic retention       | 1 test passed; 12 unrelated tests skipped by the named filter.                               |
| Rust format / Clippy              | Passed.                                                                                      |
| Sandboxed Rust unit tests         | 47 passed; 4 socket-binding tests failed with `bound endpoint: Io`; root command exited 101. |

The four socket-binding failures match the limitation documented in issue 166. One targeted
`corepack pnpm rust:test` retry outside the sandbox exited **0**: all 51 unit tests passed,
including the four socket tests; native recovery/workflow passed 28/28; interoperability passed
11/11, with two existing issue-121 qualification tests ignored. Total: **90 passed**. All required
stages passed across the root run and targeted retry; the sandboxed root command itself exited 101. The unchanged JavaScript suites were not repeated. No local check establishes Linux canonical
equality or production acceptance.

Final focused Prettier and whitespace checks passed on both new Markdown files, including these
result updates. Only the issue-167 directory is added; no tracked production, test, fixture,
configuration or historical evidence file changed.
No behavior tests or screenshots are required for this Markdown-only proposal.

## Execution and completed dedicated review

C3 / Balanced-plus discovery, using the current task's model/reasoning settings without override.
One documentation pass, one normal local review/repair pass and one targeted Rust environment
retry. No source/test repair or algorithm experiment. No agents,
branches, worktrees, nested Codex processes, CI reruns or compaction. Maintainer adoption is
separate from acceptance review.

[Issue 167](https://github.com/ChadHealey/ttrpg-map-generator/issues/167) and the invoked
implement-bounded-github-issue skill require a user-run dedicated review before publication. The user ran the following read-only review against both uncommitted documents:

```text
/review Review the branch diff, including current uncommitted additions, against issue #167 and its acceptance criteria, reporting only actionable correctness, regression, security, or test findings.
```

Dedicated review: **COMPLETED with no actionable correctness, regression, security or test
findings against issue 167’s acceptance criteria.** The review independently checked all 27
relative links, 15 pinned cited files and seven receipt source hashes; evaluated the area ledger
across all 80 permitted Boolean membership combinations; reproduced the normal-01 analytic cap
rejections, unit conversions and exact-decimal boundary arithmetic; checked all nine controls and
the unchanged visual contract; reran focused formatting/whitespace checks; and confirmed the
recorded stage results against the retained local logs. No material repair or second dedicated
review was needed.

After review, the user explicitly authorized committing, pushing, closing issue 167 if appropriate,
and updating tracking issue 161. The reviewed requirements proposal satisfies the discovery
outcome. Publication and issue closure do not adopt the proposed targets, select v3, amend an ADR
or make construction/comparison work or C1–C3 READY. At that publication, maintainer adoption remained pending.

## Subsequent maintainer adoption

After publication the maintainer explicitly instructed, “Adopt the proposed targets for the design
investigation,” and authorized continued v3 iteration, agents, local commits, and issue updates,
with **no pushes**. Adoption is now **ACCEPTED for design investigation**. This is a separate
product decision after the completed discovery review. It does not retroactively prove geometry
feasible, accept any image, select a production field, or alter accepted v1/v2 worlds. The next
construction/certificate investigation proceeds against the unchanged numeric targets.
