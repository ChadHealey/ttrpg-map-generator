# Issue 92 packaged-preview attribution evidence

This directory contains the sanitized discovery evidence for issue #92 on clean commit
`c10d6c158319a50cc11e99fd1d89005b5906c4da`.

- [Attribution decision](preview-attribution-decision.md) — disposition A and its bounded reasoning.
- [Structured results](raw-results.json) — exact identities, run order, stage intervals,
  reconciliation, RSS, qualification, and private-retention locators.
- [Measurement commands](measurement-commands.md) — sanitized compilation, build, fresh-process,
  fixture-configuration, observer, retention, and verification transcript with per-run mapping.
- [Temporary instrumentation patch](instrumentation.patch) — inspectable probes that were removed
  from production and observer sources after measurement.
- [Updated #89 draft](implementation-child-draft.md) — execution-ready threshold-only repair body;
  it was not posted to GitHub by this discovery.
- [`receipts/`](receipts/) — 13 exact sanitized observer receipts and 13 exact sanitized issue #91
  retention receipts.

## Evidence status

- Decision: **A — make the threshold-component repair executable**.
- Valid matrix: one untimed warm-up plus three valid fresh processes for each of the three gated
  fixtures.
- Invalid attempts: three control-maximum screen-capture invalidations, retained without timing or
  RSS conclusions and repeated only for their recorded reason.
- Private retention: 13 of 13 raw PID-bearing CSVs retained successfully; private paths and raw
  contents are absent here.
- Production restoration: complete; recorded clean source hashes match.
- Fixture updates: none.

## Verification

| Check                                                                    | Result                                                                |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Probe-enabled TypeScript/Svelte typecheck                                | **PASS**                                                              |
| Probe-enabled observer compilation, warnings as errors                   | **PASS**                                                              |
| Probe-enabled focused preview/threshold/progress/dispatch/workflow tests | **PASS** — 54 tests                                                   |
| Issue #91 retention/security tests and utility compilation               | **PASS**                                                              |
| Instrumentation reversal and clean source hashes                         | **PASS**                                                              |
| Mixed post-canvas/observer authority classification                      | **PASS** — unisolated probe publication remains explicit              |
| Sanitized command transcript and per-run mapping                         | **PASS** — private root remains operator-only                         |
| Restored `corepack pnpm test:cross-platform`                             | **PASS** — 8 fixture sets                                             |
| Restored `corepack pnpm check`                                           | **PASS** — 552 TS/JS passed, 1 skipped; semantic proof; 52 Rust tests |
| Privacy review of all durable artifacts                                  | **PASS** — receipt matrix and private-path scan                       |

The three-run diagnostic is not the five-run issue #84 release gate. It neither changes nor waives
the 750 ms wall-clock and 256 MiB additional process-tree RSS limits.
