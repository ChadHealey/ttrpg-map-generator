# Issue 176 — verification and scope

The main task reviewed the new segment and mouth helpers plus the private dispatch boundary.
The [independent proof-to-code review](independent-review.md) found no actionable correctness
or regression finding. The implementation follows the fixed issue-175 clipping recipe, with
different treatment for ordinary edges and exact structural shoulder edges. It checks every
positive component, preserves the origin/pocket/witness/cap conditions, and cannot fall back
after a failed wedge check.

Twenty-two focused tests pass across the two new test files. They exercise whole-edge crossings
with both endpoints outside, tangent and entering directions, the affine-derivative trap,
near-parallel and unresolved clips, actual lens and farther-wedge intrusion, a seaward island
outside the sector, role/island shoulder contacts, ring reversal and rotations, all prior
pocket/witness/cap failures, malformed bounds, mode dispatch and the largest primary bay floor.
Missing primary anatomy still rejects in the full owner certificate.

The combined issue-169/170/172/174/176 suite passes **140 tests in 22 files**. All **54 saved
radial owner receipts** from the frozen issue-172 comparisons match the new certificate exactly.
The independent reviewer checked the saved receipts directly without invoking an old writer or
constructor. Supporting-mode results also match issue 174, including twelve rotated examples.

An additional independent check enumerated **14,520 directed lattice segments** and compared
the implementation with exact BigInt rational clipping against the closed wedge. All **13,166
accepted exclusions** were disjoint in that separate calculation. This finite check supports
the proof review; it does not establish an exhaustive or formally rounded floating-point proof.

```sh
corepack pnpm exec vitest run docs/investigations/issue-169 docs/investigations/issue-170 docs/investigations/issue-172 docs/investigations/issue-174 docs/investigations/issue-176
corepack pnpm exec prettier --check docs/investigations/issue-176
corepack pnpm exec eslint docs/investigations/issue-176
```

Formatting, lint, relative links and public-content checks pass; staged whitespace and repository
precommit checks accompany the local commit. The original broader root-check timeout and
successful recovery remain documented in [issue-168 verification](../issue-168/verification.md).
Unchanged production/native stages are reused, not described as a clean single root run.
No production code, dependency, accepted data or frozen evidence changed, and no Git push was
performed.

The conservative unbounded wedge can still reject land outside the actual finite lens. The
implementation also retains the existing binary64 EPS/slack assurance. Neither this predicate
nor the passing local bay examples establish a complete primary or acceptable v3. The next
constructor must independently satisfy all existing local, packing, coverage and visual gates.
