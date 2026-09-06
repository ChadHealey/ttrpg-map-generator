# Issue 169 — verification and disposition

**Completed experiment: reject the candidate, retain all evidence, continue with issue 170.**
No production v3 field is selected; human visual decisions and macOS/Linux equality remain pending.
All implementation and evidence commits in this continuation are local, with no Git pushes.

## Automated and independent checks

The focused issue suite passed 33 tests across five files before the r2 comparison. Final boundary
regressions bring it to 35 tests. Cases include equal-area chart round trips and metric bounds,
polygon area/sign/topology, valid and invalid roles, protected water, first disks, narrow/long
features, overlap/contact, bounded placement, scalar continuity and negative extension, seam/pole
aliases, shared anchors, owner quotas, controls, complete primary construction and the retained
normal-01 fixed-cap insufficiency. Tests use repository Vitest; the initial Node-test plan was
corrected because the root suite discovers `*.test.mjs` through Vitest.

Independent implementation review found and repaired four certificate defects, each with a
regression: tolerance-created exterior positive scalar, a missed tiny-determinant crossing,
backward head intrusion into a certified collar, and an off-ray bay mouth accepted under exact
radial formulas. No target predicate was weakened. Independent mathematical review also confirmed
both r1 packing obstructions and the six-equal-cap bound. The r2 construction review found no new
blocking geometry error.

Both comparisons repeated each input exactly within the local process. R1 retains six no-proposal
receipts; r2 retains five image pairs and the failed balanced-control receipt. Independent read-only
evidence checks matched the r2 manifest's 13 hashes to its source snapshot and aggregate results,
six individual row receipts to the aggregate, and all ten PNG hashes. Recorded preview/full and
per-owner errors meet their limits for the five rendered rows. Every rendered row records 201 seam
checks, 722 pole aliases and 80,400 nested anchors; these are sampling identities, not a topology
or feature-survival proof. Both main and independent agents viewed all ten images and recommend
no selection; the [review](visual-review.md) preserves the distinction from human decisions.

## Final boundary-only repair and reproducibility

After the comparisons, review found that a non-string seed could reach the old stream's string
coercion. Both template entry points now reject missing, empty or non-string seeds through the
existing `invalid-input` receipt before stream use. No arbitrary numeric seed range was invented.
Regression tests failed before the repair and pass afterwards. All six r1 and all six r2 valid
construction results were reconstructed and compared with `deepStrictEqual` to their retained
construction receipts: 12/12 match. The evaluator, certified geometry and placement are unchanged;
rerendering another full matrix for malformed-input validation was unnecessary.

R2 snapshot hashes and final source hashes differ only at these two template entry points:

| Source           | Retained r2 SHA-256                                              | Final SHA-256                                                    |
| ---------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| templates.mjs    | 8d759ac35c6606a920d1ce6e2705dd318a05108fd9b4046f3c7758e7d83ee8a7 | b37b208fbe23d549c1019986a130c858a6fdb1c454f9f2f890445affbd84ea1e |
| templates-r2.mjs | eeaffbd2b070e110d1af754913f70878f2adaae7ccd193754dcf070799bf92dd | 6cb6df2d2b3f31b0098fba0a8c310d3eada2932d311cc6253f095ed6bfd107ed |

R1's exact source text is independently retained in its snapshot, including before harmless import
sorting and the r2 harness extension. No snapshot, manifest, result, image or failed candidate was
rewritten to hide those changes. Reproduce a historical revision using its source snapshot and
manifest rather than pretending every historical hash names the final working file.

## Repository checks and limits

The required root check and targeted recovery are recorded in [issue-168 verification](../issue-168/verification.md).
Formatting, ESLint, TypeScript, Svelte and all production test stages completed successfully across
those runs. The initial unchanged inherited-context test timeout and exact retry are disclosed;
the original root command did not exit zero. Rust's 51 unit, 28 native-recovery and 11 transport
tests passed, with pre-existing skips/ignores retained. No production source or configuration
changed during this investigation, so those passing stages remain applicable. New issue-owned
runtime/tests receive the focused Vitest, formatting, lint and evidence checks described here.
Final staged whitespace and public-content checks run before the local commit.

This implementation is private to an investigation directory. It does not prove production
quantization/extraction survival, actual polar bias, multiple-basin control semantics, performance
budgets or cross-platform canonical bytes. It preserves the nine control inputs and exact public
ranges, but does not claim that its local polar stretch implements a world-pole preference. All
six comparison inputs have neutral polar character. Future production input/provenance/invalidation
and accepted-state preservation remain separate gates.

The numerical work establishes a useful complete-role construction and a tractable compactness
repair. The visual work rejects its repeated manufactured anatomy. Issue 170 addresses that concrete
failure rather than increasing resolution, adding cosmetic noise or relaxing acceptance criteria.
