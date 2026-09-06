# Issue 164 verification receipt

## Completed local evidence

- Final prototype revision: `issue-164-r2`, bound to source digests in
  [results.json](comparison/results.json).
- Platform/runtime: macOS, Node 24.11.0, pnpm 11.19.0. No Linux execution claimed.
- Evidence integrity: all eighteen preserved candidate PNGs read from exact commit
  `736e1ddbbda804fa2c9e74e63d0d1ea3c99b83e1`, SHA-256 and 1600-by-800 dimensions verified.
- Prototype repeats: twelve family/input pairs, two complete runs each; all sampled grid/owner,
  mask, PNG bytes and recorded measurements matched exactly.
- Focused: `corepack pnpm exec vitest run docs/investigations/issue-164/morphology.test.mjs`:
  **1 file / 8 tests passed**. Includes source/PNG receipt integrity, repeat sampling, nested
  anchors, seam aliases/limits, pole identity, angular gap construction/near-gap samples,
  bounded capacity failure, and independent diagnostic PNG scanline decoding.
- Targeted ESLint: passed for the three investigation modules.
- Human visual review: every final comparison image failed; the maintainer explicitly adopted all
  twelve listed decisions and rationales. The v2 cohort retains its original maintainer rejection.

## Final repository validation

Before the dedicated review correction below, all required `pnpm check` stages passed across the
full check and the targeted environment retry:

| Stage                                                      | Observed result                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| Formatting / ESLint                                        | Passed after repairing generated JSON formatting.                   |
| TypeScript / Svelte                                        | Passed; zero Svelte errors or warnings.                             |
| Main Vitest pool                                           | 98 files passed, 3 skipped; 755 tests passed, 4 skipped.            |
| Serial physical-atlas integration                          | 1 file passed; 7 tests passed, 2 skipped.                           |
| Isolated semantic-retention proof                          | 1 test passed; 12 unrelated tests skipped by the named test filter. |
| Rust formatting / Clippy                                   | Passed.                                                             |
| Rust unit, native recovery and interoperability unit tests | 90 passed; 2 existing interoperability qualification tests ignored. |

The sandboxed `corepack pnpm check` command itself exited 101 at four existing Rust Unix-socket
bind tests after all preceding stages passed. No source repair was made for those failures.
`corepack pnpm rust:test` was rerun with approved execution outside the sandbox and exited **0**:
all four socket failures passed, followed by 28 native recovery/workflow tests and 11 interoperability
unit tests. The two ignored Swift/Rust qualification tests retain their separate issue-121 gate.
The unchanged JavaScript suites were not rerun after this environment correction. This is a
passing staged gate with an explicit environment retry, not a claim that the sandboxed command
returned zero. Linux and separately named release/qualification lanes were not run.

The implementation audit passed: all 58 relative Markdown links resolved; the source/evidence diff
and public-repository hygiene were reviewed. All additions are inside this issue directory.
`git diff --check` passed; tracked production packages, desktop, persistence, accepted fixtures,
registered gallery, lockfiles and accepted ADRs are unchanged. No unrelated work was present.

## Execution and review

C4 discovery in the user's current task/model settings; no model override, agent delegation,
branch, worktree, nested Codex process or context compaction. One implementation pass and one
normal control/support review-and-repair pass; no CI runs or CI repairs. Focused tests were repeated
once after source lint/format verification. The first full check stopped at generated JSON
formatting; the writer now uses the existing repository formatter. The same twelve-case matrix was
regenerated twice and its reviewed PNG digest prefixes remained unchanged. The second full check
is the broader validation above; no registered production fixture regeneration or CI rerun was performed. There was one Rust
environment retry after the local sandbox blocked socket binding.
The two small scripts are investigation-only, not a public/headless production CLI.

Dedicated read-only review: **completed with one P1 finding**, subsequently corrected below.
The implementation skill requires it for C2–C4 and critical-risk work. User-run request:

```text
/review Review the branch diff, including current uncommitted additions, against issue #164 and its acceptance criteria, reporting only actionable correctness, regression, security, or test findings.
```

The task was run on the existing `main` checkout with uncommitted additions, so reviewing an empty
branch comparison would miss this work. Do not push, open a PR, accept the proposed ADR, modify
successor issues, close #164, or alter #163's disposition without separate authorization.

## Dedicated review correction

The review reproduced a P1 failure: the provenance test called `git show` for the separate
candidate commit, which is absent from CI's shallow checkout. Preserve all eighteen original
PNGs as byte-identical `v2-source/<row>.png` copies inside this issue directory, and verify them
against the unchanged hashes, byte lengths and dimensions in `v2-provenance.json`. Routine
verification now requires neither candidate Git history nor network access. The copies were
checked directly against their pinned commit during extraction (1,793,664 bytes total).

Regression verification used disposable shallow Git metadata fetched only from the current HEAD.
`git cat-file` confirmed the candidate commit was absent, then all **8 investigation tests passed**
with `GIT_DIR` pointing at that metadata. Targeted ESLint passed. The test still verifies all twelve
comparison PNG hashes and their source fingerprints; no prototype or reviewed comparison changed.
The expensive unchanged repository suites above were not repeated for this focused test/evidence
repair. No CI or Linux run is claimed. The complete issue now contains 42 files.
