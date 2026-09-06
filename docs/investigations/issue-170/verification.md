# Issue 170 — checks and rejected disposition

**The implementation checks pass; the candidate requirements fail.** The local gate refuses a
world comparison because the balanced radii violate a necessary packing bound and fallback removes
one of the three required layouts. Local planar review also retains a manufactured tab-like
silhouette. No acceptable v3, human decision, production adoption or Linux equality is claimed.

## Reviewed implementation and tests

The main task independently reviewed the curved-role/finite-placement design before implementation.
It corrected the proposed pentagonal-bipyramid ordering (72-degree equatorial neighbors are closer
than pole/equator neighbors) and required an explicit numerical gap slack. These corrections left
all adopted targets unchanged.

Independent placement/runner review found and resolved two actionable boundary defects: integer
seeds could reach string coercion, and an empty/short owner list could pass an `every()`-only gate.
Placement now accepts nonempty strings without coercion. The gate requires exact owner count,
unique IDs, complete certificates and a primary. Final placement returns independent copies, checks
every cap pair, and records finite search/refinement counts. The retained six-equal-radius witness
places through seeded octahedral candidates; feasible refinement produces actual pair-distance
variation, not only rotation.

Focused Vitest passes 23 tests across four files; the combined issue-169/170 suite passes 58.
The eight placement tests cover repeats, ordering, copies, frames, final gaps, near-tight six-cap
placement, variation, bounded exhaustion and malformed seeds. Template tests retain all six exact
inputs, certificate/area invariants, control boundaries and explicit **rejection** observations:
only two actual layouts survive, and the balanced radius exceeds the unchanged necessary ceiling.
Readiness tests preserve those desired thresholds and confirm that individually certified owners
cannot unlock comparison after these failures. Four runner tests include missing owner slots and
the earlier retained fixed-cap insufficiency. Passing rejection tests do not make the candidate
meet the failed design targets.

A final independent review found that a control-only layout could count toward ordinary-row
diversity. The gate now restricts that inventory to the four exact normal rows, with a regression.
This boundary-only correction leaves the retained rejected result unchanged. `local-gate-r1`
preserves the original source snapshot; `local-gate-r2` records the corrected source and same outcome.

## Retained evidence and review

The [local gate](local-gate-r1/local-gate.json) repeats every construction exactly, snapshots source
text/hashes before evaluation, and checks those hashes again in an explicit integrity receipt.
It records all owner geometry and failed local candidates. Complete continuous role certification
is true, while readiness is false. No world sampling, coverage, native/half atlas image or human
visual decision is invented for this stopped run.

The [local diagnostic manifest](local-diagnostics/manifest.json) retains before/after source text,
all six inputs and receipts, panel identities, source/dependency hashes and planar image hashes.
The safe verifier reconstructs both stages and compares full report/image/manifest bytes read-only.
The original `generate.mjs` is retained as the historical writer named by that manifest, not the
recommended verification command. Exploratory images are labeled separately; an intermediate
image without a paired exact source is not treated as reproducible acceptance evidence.

The main task viewed both paired images and additional local construction diagnostics directly.
The constructor author independently identified the same tab/club silhouettes before freezing.
The [findings](local-findings.md) retain the attempted repair and measured cap/layout consequences.
Those local observations are not a six-row world review or human rejection record. The resulting
recommendation is a bounded design successor, not another comparison of known unready geometry.

## Repository verification and compatibility

Formatting, ESLint, relative links, source/image hashes and public-content checks pass for this
issue. Final staged whitespace and the repository precommit checks run before committing.
The required broader production check stages are recorded in [issue-168 verification](../issue-168/verification.md):
format/lint/type/Svelte, the main suite plus its exact unchanged-test timeout retry, serial physical
integration, retention, Rust format/Clippy and all native stages passed across the documented runs.
No production code, configuration, accepted fixture, dependency or shared issue-169 geometry source
changed after those checks; the new investigation modules are covered by the focused suite above.
Repeating the expensive unchanged production/native stages adds no evidence to this rejected local
recipe. The original root command's nonzero timeout exit is not described as a clean single run.

All new commits remain local on `codex/v3-certified-anatomy`; no Git push was performed. Accepted
v1/v2 worlds, version selection, input/invalidation ownership and registered evidence remain intact.
Issue 171 reviews a more flexible collar certificate before a separate implementation can resume.
