# Issue 183 verification scope

All nine [comparison rows](comparison-r1/results.json) report
`numeric-gates-passed`, exact local repeats, pending human decisions and false
production selection. The read-only world verifier confirms54 captured sources,
116 relative runtime imports, all18 PNG hashes/dimensions, nine exact inputs and
the condensed134-input gate, with all captured sources still matching current
files. It verifies receipt/coverage arithmetic and source closure; it does not
independently rerender scalar grids or establish visual acceptance.

Separately, each of the three local states retains45 body-size/anatomy-corner
certificates and134 actual complete paid construction/placement rows. All local
source/receipt/PNG replays and all three134-input readiness replays pass. The
final focused constructor/gate suite passes nine tests, covering exact fixed
inputs, preserved raw role geometry, explicitly relocated B witness, unchanged
A/C and subordinate anatomy, exact frozen182 fallback, full owner sets and
closed gates for missing, substituted or failed rows. The independent world
verifier adds seven failure-path tests. The main task's final combined run passes
259 tests in 43 files. A separate final readiness replay verifies 134 inputs and
268 strict calls, with all artifacts and sources exact and no raster calls.

Run from the repository root:

```sh
corepack pnpm exec vitest run docs/investigations/issue-183
node docs/investigations/issue-183/verify-world.mjs docs/investigations/issue-183/comparison-r1 --require-current
node docs/investigations/issue-183/local-evidence.mjs --verify baseline
node docs/investigations/issue-183/local-evidence.mjs --verify recipe-1
node docs/investigations/issue-183/local-evidence.mjs --verify recipe-2
node docs/investigations/issue-183/local-evidence.mjs --verify recipe-3
node docs/investigations/issue-183/readiness.mjs --verify recipe-1
node docs/investigations/issue-183/readiness.mjs --verify recipe-2
node docs/investigations/issue-183/readiness.mjs --verify recipe-3
corepack pnpm exec prettier --check docs/investigations/issue-183
corepack pnpm exec eslint docs/investigations/issue-183
```

These are read-only evidence checks. Do not rerun historical writers against
retained directories. The runner captured the full source/input closure before
the world run, repeated every result and image, and checked source integrity
afterward. Earlier recipe sources remain pinned separately and are checked
before replay execution. No failed local recipe or declared world row is omitted.

Preview/full total coverage and preview-owner tolerances, zero contour, sampled
seam/pole/shared-anchor checks and all certificate/placement bounds remain
unchanged. No raster was evaluated for128 seeds. These tests do not prove
production extraction, continuous topology, requested ocean/fragmentation/polar
semantics, human acceptance or cross-platform equality. The main task's
[world rejection](README.md) remains decisive despite numeric success.

Formatting, lint, public-content, relative-link and whitespace checks accompany
local commits and repository precommit. Unchanged broad production/native stages
reuse the earlier [timeout and focused/native recovery record](../issue-168/verification.md),
as summarized in [issue-179 verification](../issue-179/verification.md). This is
not a claim of a new clean root `pnpm check` exit. No production, dependency,
accepted data, historical runtime or prior evidence was changed. No push.
