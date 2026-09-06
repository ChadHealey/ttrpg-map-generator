# Issue 177 — verification

The combined issue-169/170/172/174/176/177 suite passes **168 tests in 27 files**. New tests cover
complete paid six-row construction, deterministic cyclic layout preferences, subordinate diversity,
quota and primary invariants, bounded literal coast parameters, real exposed island edges and the
evidence verifier's source closure and revision handling. The frozen certificate regression suites
remain included.

Both the local gate and comparison verify against current sources: **38 captured sources and 68
runtime imports**, six complete rows, plus **12 PNGs** for the comparison. The runner captures
static imports, re-exports and dynamic literal imports recursively before execution. Known runtime
baseline data and owning experiment/design records are captured explicitly. Source integrity is
checked afterward. Every row repeats construction, placement, fields, masks, images and receipts
exactly within the local process. The separate verifier checks captured text, closure, receipt and
PNG consistency; it does not claim independent world rerendering or cross-platform equality.

The [local evidence verifier](verify-local.mjs) independently reconstructs its seven retained stages
from frozen source and compares reports/images in memory. Its distinction between the B intermediate
stage name and actual central-anatomy receipts is recorded in [local findings](local-findings.md).
Neither stage names nor layout indices are accepted as visual proof.

The main task and independent reviewer inspected all six native images and all six half images.
Their outcome is [visual rejection](visual-review.md). The [independent review](independent-review.md)
records actionable code/evidence findings separately from that product failure.

```sh
corepack pnpm exec vitest run docs/investigations/issue-169 docs/investigations/issue-170 docs/investigations/issue-172 docs/investigations/issue-174 docs/investigations/issue-176 docs/investigations/issue-177
node docs/investigations/issue-177/verify.mjs docs/investigations/issue-177/local-gate-r1 --require-current
node docs/investigations/issue-177/verify.mjs docs/investigations/issue-177/comparison-r1 --require-current
for stage in initial failed-b pre-diversity b-extent-rejected b-share-rejected b-share-corner-rejected final; do
  node docs/investigations/issue-177/verify-local.mjs "$stage"
done
corepack pnpm exec prettier --check docs/investigations/issue-177
corepack pnpm exec eslint docs/investigations/issue-177
```

The prior broad root check exceeded an existing five-second desktop test timeout; its focused retry
and the remaining native stages passed, as recorded in [issue-168 verification](../issue-168/verification.md).
Those unchanged production/native stages are reused here. This is not represented as one clean
`pnpm check` exit. No production/configuration/dependency or accepted-world source changed.
Formatting, lint, relative links, public-content and staged whitespace checks accompany the local
commit, including the repository precommit checks. No Git push is performed.
