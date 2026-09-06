# Issue 172 — verification and rejected disposition

**Both comparisons pass numeric gates; neither passes the visual contract.** All four ordinary
rows and both controls remain provisionally assistant-rejected. Human visual decisions, production
selection, accepted ADR and cross-platform equality remain pending. Accepted v1/v2 and production
sources are unchanged. No Git push was performed.

## Construction and independent review

The issue-private certificate implements the independently reviewed issue-171 general collar.
Ten focused certificate tests cover the valid curved case, separating-chain bottleneck despite a
wide root, extra bridge, invalid far cut, disk outside the collar, ambiguous contact and malformed
witnesses. Independent mathematical/code review found no actionable remaining defect. The
[certificate notes](certificate-notes.md) distinguish analytic sufficient bounds from the existing
binary64 tolerance policy; this is not a formal interval-arithmetic implementation.

The exact six retained inputs all construct complete owners with paid islands, role shares, disks,
bay/peninsula dimensions, zero-displacement coast and certified envelopes. Local readiness checks
require unique complete owner slots, three actual ordinary layouts and applicable pair, triple,
four-cap and high-count necessary packing bounds. They do not confuse a control-only layout with
ordinary diversity or use a largest-radius shortcut to reject unequal high-count caps.

R1 preserves material failed local construction stages in its [local findings](local-findings.md).
R2's [findings](local-findings-r2.md) retain the initial torso failure and final layout-specific
rejections, including explicit balanced fallback. The [whole-coast partition](coast-partition.mjs)
declares roles before fitting and retains the unchanged full certificate as the acceptance gate.
Independent review and positive/negative tests cover cyclic intervals, overlap, far-cut indices,
exact stitching, bounded inputs and actual seed-dependent geometry. Passing fallback tests do not
assert that every literal layout is valid at every quota.

## Numeric and visual evidence

Each comparison uses the exact six issue-165 inputs, 400×200 preview and 1600×800 full grids,
native and 800×400 half images. Every row repeats the construction, scalar grids, owners, geometry
receipts and PNG bytes exactly in the local process. Every row passes the fixed seam/pole checks,
the total preview/full water tolerance of 0.25 percentage points and the preview owner tolerance
of 0.25/count percentage points. All final source-integrity receipts pass.

R2 water errors and maximum absolute preview owner errors, in percentage points:

| Input              | Preview water |  Full water | Maximum preview owner |
| ------------------ | ------------: | ----------: | --------------------: |
| normal-01          |   +0.02490181 | −0.00019267 |            0.02103398 |
| normal-02          |   −0.00933232 | +0.00064702 |            0.01002890 |
| normal-03          |   +0.03020658 | +0.00036039 |            0.01641233 |
| normal-04          |   −0.00580500 | −0.00055563 |            0.01155485 |
| connected-majority |   −0.02497983 | +0.00421447 |            0.01705799 |
| fragmented-islands |   −0.00440533 | −0.00361647 |            0.01131213 |

The retained JSON contains unrounded values, all owners, failed finite attempts and applicable
limits. Exact polygon area accounting and sampled coverage remain different evidence. Legacy
control mappings and these six inputs do not establish the full public control sweep, production
topology policy, runtime budget or macOS/Linux canonical equality.

The main task and independent reviewer each viewed all 12 images per revision. The
[r1 review](visual-review-independent-r1.md) and [r2 review](visual-review-independent-r2.md)
record every positive criterion and R1–R6 per row. Primary counts are 2/3/3/3/6/3 in both. R2
has smoother joins and substantially more varied compact islands. Repeated fan/club terminals,
slots and block-like stretches remain legible at half size, so all six rows still fail R2/R3.
Polar projection is not misreported as an extra primary or a ribbon. R1's decisive island
failures are not automatically assigned to r2; residual dense clustering is recorded separately.

The final r2 wrapper received an import-order-only lint correction. A fresh complete rerender
then proved every row, local gate, geometry/grid hash and all 12 PNG bytes identical to the first
run. The retained r2 snapshot and manifest name that corrected source. This is the same geometric
revision, not a third candidate comparison or manual rewriting of old hashes.

## Verification commands and limits

The combined issue-169/170/172 suite passes **107 tests in 19 files**. Formatting and ESLint pass.
The two read-only local diagnostic verifiers reconstruct 18 reports/3 PNGs (r1) and 9 reports/2
PNGs (r2). The independent world-evidence verifier passes both comparisons with current source
matching: 23 captured sources/35 runtime imports/12 images for r1, and 30/51/12 for r2. It checks
captured transitive imports, exact cohort completeness, receipt consistency, numeric arithmetic,
source/PNG hashes, dimensions and path boundaries. It does not itself rerender scalar grids or
establish a human decision; the frozen runners supply the recorded exact local repetitions.

```sh
corepack pnpm exec vitest run docs/investigations/issue-169 docs/investigations/issue-170 docs/investigations/issue-172
node docs/investigations/issue-172/local-diagnostics/verify.mjs
node docs/investigations/issue-172/local-diagnostics-r2/verify.mjs
node docs/investigations/issue-172/verify.mjs docs/investigations/issue-172/comparison-r1 --require-current
node docs/investigations/issue-172/verify.mjs docs/investigations/issue-172/comparison-r2 --require-current
corepack pnpm exec prettier --check docs/investigations/issue-172
corepack pnpm exec eslint docs/investigations/issue-172
```

The required broader `pnpm check` and recovery are documented in
[issue-168 verification](../issue-168/verification.md). The original root command exited nonzero
after one unchanged inherited-context test exceeded its existing five-second timeout. Its exact
retry passed; format/lint/type/Svelte, the remaining main suite, serial physical integration,
retention, Rust format/Clippy and all native stages passed across the documented runs. No
production code, configuration, accepted fixture or dependency has changed since those checks.
The new private investigation code has the focused coverage above. Expensive unchanged native
stages were reused, and the original root command is not described as a clean single run.

Final relative-link, public-content, staged whitespace and repository precommit checks accompany
the local commit. A bounded general-mouth design is the next hypothesis; failed visual evidence
is retained and cannot authorize production adoption.
