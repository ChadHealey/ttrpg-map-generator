# Issue 165 — coverage-aware continental hierarchy discovery

**No selection.** The maintainer rejected all twelve `issue-165-r1` comparison images and adopted
their listed rationales. Explicit owner quotas preserve area ratios in feasible cases, but do
not preserve convincing internal hierarchy. Envelopes also fail the fixed coverage contract on
normal-01 and both controls. Cellular meets coverage on all six inputs, yet all six images fail.
This result rejects the two bounded realizations, not every possible algorithm in either family.

Executed the READY discovery [issue #165](https://github.com/ChadHealey/ttrpg-map-generator/issues/165)
on the existing clean `main` checkout containing prerequisite commit
`d7b0755e9bf77e62dee0bc080a7048e111046b47`. Fetch confirmed HEAD and origin/main both at that commit.
All new files are inside this investigation; production, accepted data and issue-164 remain unchanged.

- [Pre-result experiment and measurement contract](experiment.md)
- [All-row human decisions, rationales and images](visual-review.md)
- [Exact inputs, source/grid/image hashes, old/new measures and probes](comparison-r1/results.json)
- [Geometric and continuous-field argument](geometry.md)
- [Proposed decision and bounded successor drafts](child-plan.md)
- [Verification, limitations and dedicated-review handoff](verification.md)

## Findings

Both continuations normalize squared baseline size weights into fixed owner quotas. Normal-01
requests about 37.45/37.45/12.55/12.55 percent of land; normal-02..04 request about
29.98/29.98/29.98/10.05 percent. These are transient owner shares, not semantic or visual counts.
The baseline had no area quotas; its corresponding shares are explicitly an inferred proxy.

Normal-01's first two envelope quotas each require 13.107 percent of the sphere, but their guarded
capacities are 12.372 and 11.710 percent. Independent quotas therefore fail deterministically.
The global baseline contour meets total coverage by allocating different proportions elsewhere.
The fixed policy forbids that redistribution. Connected-majority has two insufficient owner caps;
fragmented-islands has one. All three failures retain their best bounded diagnostic images.

On feasible envelope defaults, owner ratios are retained but confirmed guard-contact fractions
increase: normal-02 about 25.44% to 45.30%, normal-03 13.18% to 23.39%, normal-04 27.95% to 49.03%.
Quotas constrain total owner area; they do not keep growing contours inside the intended lobe and
embayment hierarchy. Some owners lose almost all internal shape as their support fills.

Cellular quotas improve area balance and reduce confirmed guard contact in defaults 02–04, yet
slabs, pointed shoulders, narrow channels and geometric recesses remain. A scalar quota does not
specify where within an owner land must survive. See the separate default/control diversity review.
No formula is selected for implementation, and no third realization or visual tuning followed rejection.

The continuity repair changes field values as well as calibration. Initial measured land areas are
nearly identical on this cohort, but this is not a controlled proof that all final changes are
caused solely by quotas. Component areas and guard contact explain outcomes; they do not judge
visual quality. Coast measurements are preview-resolution estimates with declared uncertainty.

## Coverage before and after calibration

All columns are percentages. Before/after measurements use the same 400 × 200 diagnostic grid;
full-after uses 1600 × 800. Full error is signed percentage points relative to the unchanged target.
All twelve new pairs repeated byte-for-byte, including sampled scalar/owner bytes and both images.

| Family / input              | Old before → after | New before → after | Full after | Full error | Quota result |
| --------------------------- | ------------------ | ------------------ | ---------- | ---------- | ------------ |
| envelope/normal-01          | 87.807 → 64.999    | 87.807 → 67.132    | 67.143     | +2.143     | infeasible   |
| envelope/normal-02          | 84.655 → 65.000    | 84.657 → 65.001    | 65.017     | +0.017     | calibrated   |
| envelope/normal-03          | 82.840 → 64.999    | 82.840 → 65.000    | 65.014     | +0.014     | calibrated   |
| envelope/normal-04          | 85.898 → 65.001    | 85.898 → 65.000    | 65.017     | +0.017     | calibrated   |
| envelope/connected-majority | 83.956 → 60.000    | 83.956 → 60.525    | 60.547     | +0.547     | infeasible   |
| envelope/fragmented-islands | 89.287 → 70.000    | 89.287 → 72.466    | 72.474     | +2.474     | infeasible   |
| cellular/normal-01          | 67.809 → 65.000    | 67.809 → 64.998    | 65.001     | +0.001     | calibrated   |
| cellular/normal-02          | 64.613 → 65.000    | 64.613 → 65.001    | 65.009     | +0.009     | calibrated   |
| cellular/normal-03          | 64.377 → 64.999    | 64.377 → 65.002    | 65.017     | +0.017     | calibrated   |
| cellular/normal-04          | 58.592 → 65.001    | 58.592 → 65.000    | 64.999     | -0.001     | calibrated   |
| cellular/connected-majority | 62.904 → 60.000    | 62.904 → 59.999    | 60.023     | +0.023     | calibrated   |
| cellular/fragmented-islands | 55.955 → 70.000    | 55.955 → 69.998    | 69.974     | -0.026     | calibrated   |

## Contact with construction guards

Fractions below are percentages of estimated coastline length. Cellular intervals run from
confirmed to confirmed-plus-unresolved; they are not confidence intervals or exact nearest-distance
measurements. All use delta = 0.02 rad and the same edge traversal/dual length denominator.
Complete component and owner shares for both phases are retained in the JSON (not truncated to top three).

| Family / input              | Old before → after confirmed | New before → after confirmed | New after upper bound |
| --------------------------- | ---------------------------- | ---------------------------- | --------------------- |
| envelope/normal-01          | 0.00 → 31.13                 | 0.00 → 58.10                 | 58.10                 |
| envelope/normal-02          | 2.53 → 25.44                 | 2.53 → 45.30                 | 45.30                 |
| envelope/normal-03          | 1.84 → 13.18                 | 1.84 → 23.39                 | 23.39                 |
| envelope/normal-04          | 0.65 → 27.95                 | 0.65 → 49.03                 | 49.03                 |
| envelope/connected-majority | 3.54 → 30.25                 | 3.54 → 38.02                 | 38.02                 |
| envelope/fragmented-islands | 6.04 → 28.31                 | 6.04 → 28.84                 | 28.84                 |
| cellular/normal-01          | 13.20 → 13.39                | 13.20 → 13.89                | 16.79                 |
| cellular/normal-02          | 25.53 → 25.10                | 25.53 → 21.90                | 26.87                 |
| cellular/normal-03          | 35.33 → 35.19                | 35.33 → 23.21                | 28.54                 |
| cellular/normal-04          | 38.05 → 34.47                | 38.05 → 30.98                | 37.84                 |
| cellular/connected-majority | 23.37 → 25.83                | 23.37 → 24.13                | 35.48                 |
| cellular/fragmented-islands | 27.91 → 17.42                | 27.91 → 17.73                | 22.39                 |

## Island-control evidence against the realized coast

These eight twice-run previews use normal-01's unchanged seed and independently replace just the
named control. “Related” counts constructed centers within 0.2 rad of their owner's largest realized
component coast; it includes vanished/merged terms and is not a visual pass. Per-satellite distances,
winning samples and status are retained in the receipt. Zero removes the corresponding construction
category; increasing abundance changes output but many terms merge or vanish at the selected contour.
The inherited shared island stream means changing isolated count also shifts later grouped geometry;
these prototypes do not prove production selective-reroll or complete abundance semantics.

| Family   | Control                     | Value | Isolated / grouped | Vanished / merged / detached | Related centers |
| -------- | --------------------------- | ----- | ------------------ | ---------------------------- | --------------- |
| envelope | islandAbundancePercent      | 0     | 0 / 8              | 6 / 1 / 1                    | 8 / 8           |
| envelope | islandAbundancePercent      | 100   | 16 / 8             | 18 / 3 / 3                   | 24 / 24         |
| envelope | archipelagoAbundancePercent | 0     | 8 / 0              | 7 / 1 / 0                    | 8 / 8           |
| envelope | archipelagoAbundancePercent | 100   | 8 / 28             | 28 / 4 / 4                   | 36 / 36         |
| cellular | islandAbundancePercent      | 0     | 0 / 8              | 5 / 1 / 2                    | 5 / 8           |
| cellular | islandAbundancePercent      | 100   | 16 / 8             | 15 / 2 / 7                   | 18 / 24         |
| cellular | archipelagoAbundancePercent | 0     | 8 / 0              | 5 / 0 / 3                    | 7 / 8           |
| cellular | archipelagoAbundancePercent | 100   | 8 / 28             | 21 / 4 / 11                  | 23 / 36         |

## Control and numeric portability disposition

| Public control              | Investigation responsibility and limit                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| worldCircumferenceKm        | Inherits bounded sqrt(40000/circumference) template scaling from r2; not a new physical-unit contract.                                                             |
| targetWaterCoveragePercent  | Sets total land budget distributed by explicit shares; fixed 24-step owner contours; 0.25 percentage-point preview/full tolerance.                                 |
| continentCountIntent        | Keeps all 1..8 construction owners; never silently clamps to three or equates owners with semantic continents.                                                     |
| continentDistribution       | Balanced uses equal shares; varied uses seeded primary/minor sizes squared; oneDominant squares its inherited 1/0.55 weighting. No production conformance claimed. |
| fragmentationPercent        | Inherited envelope cuts or bounded cellular waves; no downstream splitting or coastline repair.                                                                    |
| islandAbundancePercent      | Inherited ceil(value/25) isolated terms per owner, fixed zero island contour; retained effects measured.                                                           |
| archipelagoAbundancePercent | Inherited ceil(value/15) grouped members per owner; group semantics/relationships are not accepted entities.                                                       |
| oceanConnectivity           | Recorded only. Existing downstream classification responsibility remains; neither input row names nor unsegmented masks prove its semantics.                       |
| polarCharacter              | Neutral/±0.1 z² broad and satellite bias inside each continuous guard; forced north/south land tested. Full extreme-control semantics remain unproven.             |

The macro proof uses real-valued analytic fields and Int32 output ticks, SHA-256 counter scopes inherited
read-only from r2, and stable first-wins ties. It is not a production stream or grid implementation.
`sin`, `cos`, `acos`, `hypot`, threshold ties, floating cosine weights and PNG/zlib versions remain
numeric portability risks. Real-arithmetic gap proofs include a small margin, not a formally verified
floating-point error bound. Only macOS arm64 local repeats were run. Production adoption must prove
macOS/Linux canonical equality at the existing production sampling/quantization boundaries.

## Reproduce

Use Node 24.11.0 and pnpm 11.19.0 from the repository root. The output directory must not exist;
the runner refuses to replace a reviewed revision. Runtime metadata is separate from deterministic
receipts. These are investigation scripts, not a headless production CLI.

```sh
node docs/investigations/issue-165/run.mjs /tmp/issue-165-repeat
corepack pnpm exec vitest run docs/investigations/issue-165 docs/investigations/issue-164/morphology.test.mjs
corepack pnpm check
```

Compare results.json and PNGs byte-for-byte with comparison-r1; compare runtime.json separately.
Tests verify tracked receipt sources and PNG bytes without Git branch objects or network access.
The runner imports baseline files read-only and never regenerates accepted fixtures.
