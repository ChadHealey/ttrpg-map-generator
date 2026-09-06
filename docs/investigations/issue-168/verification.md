# Issue 168 — verification and design disposition

**Design recommendation: proceed to a bounded local construction/certificate experiment.**
A full six-row comparison is conditional on a complete primary passing every adopted continuous
certificate. No template, input, image or production field is accepted by this design result.

## Sources and independent review

The prerequisite proposal is commit `9a9b37aed5d538fd0b4ea50e91462ae57343578c`. The maintainer's
subsequent explicit adoption is recorded in local commit `7c73e6b`; the continuation is authorized
for local commits and issue updates with **no pushes**. [Issue 167](../issue-167/README.md) supplies
the unchanged target values; [issue 166](../issue-166/capacity-audit.md) supplies the fixed-cap
negative case; the [visual contract](../issue-164/visual-contract.md) remains unchanged.

An independent read-only agent reviewed both design documents and independently derived the
Lambert metric and global chord bounds, quota normalization, role/collar/extent/bay predicates,
continuous scalar extension and fixed-zero limitations. It found no blocking mathematical error.
One actionable clarification made the head-template origin explicit as the root midpoint;
`m+w α t+(h+H β)n` now matches the collar's endpoints. No target or policy changed.

The review also checked the material production dependency: target water coverage currently
belongs to classification and is omitted from macro parameters. Future coverage-dependent v3
must explicitly version its input/provenance and invalidation behavior while retaining the legacy
v1/v2 contracts. The new field cannot silently reuse the current sampled threshold selector.

## Focused checks

Bounded scratch arithmetic reproduced the values in [geometry.md](geometry.md):

- `q=.35*.9025/2.41=.13106846473029043`.
- At usable-cap occupancy `.75`, nominal radius `.912574695380873` gives pair requirement
  `1.875149390761746`; at `.65`, radius `.9813983957306062` gives `2.0127967914612124`.
- `acos(-1/3)=1.9106332362490186`; occupancy arithmetic demonstrates sensitivity, not a
  successful embedding or permission to enlarge the retained caps at fixed centers.
- The proposed `.70/.15/.09/.06` surviving body partition sums to one; both lobe shares,
  their sum and their ratio exceed the adopted minima.
- Eighty-one fixed point pairs spanning cap radii `.7`, `1.5` and `2.6` radians corroborated
  the distance sandwich. The real-arithmetic derivation, not those samples, supports the bound.

The ledger uses verified disjoint interiors and shared root edges before summing areas. The
singleton contour interval makes `D=0` a construction property, not a claim about the old ±4
scalar calibration or the later quantized/interpolated production contour. All missing template,
control, sampling, packing, visual and production proofs are enumerated in geometry.md.

Focused formatting and relative-link checks passed: all 14 relative links resolve. The staged
whitespace check also runs before the local commit. No new behavior tests, image matrix, fixture
regeneration or production changes belong to this design-only issue.

The repository-required `corepack pnpm check` passed formatting, ESLint, TypeScript and Svelte
(zero errors/warnings). Its main Vitest run passed 767 tests but one unchanged inherited-context
preview test exceeded its existing five-second timeout. The exact failing test passed a targeted
retry without source or timeout changes. The remaining stages, originally not reached, then passed:
seven serial physical-state integration tests, the semantic-retention test, Rust formatting and
Clippy, 51 Rust unit tests, all 28 native recovery tests, and 11 observer transport tests. Existing
skips/ignored tests remain unchanged. The recovery command exited zero. This is combined stage
completion, not a claim that the original root command exited zero or a Linux equality result.

Investigation-only issue-169 files were developed during this longer baseline verification and
receive their own focused tests, formatting, lint and evidence checks. No production source changed
after the passing baseline stages; repeating those expensive unchanged suites is not necessary for
this Markdown-only design package.

## Acceptance map

| Requirement                                                    | Evidence                                                                                                                                        |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Constructive roles, area and angular certificate predicates    | README attachment recipe; geometry chart, root, disk, lobe, peninsula and geodesic-mouth bounds                                                 |
| Immutable quotas, complete accounting, gap and adopted margins | README normalization/search; geometry containment; no redistribution or guard filling                                                           |
| Fixed contour and sampled tolerance distinction                | Exact interval `{0}`, continuous extension, independent preview/full and owner checks; production quantization remains a separate proof         |
| Finite deterministic search and failures                       | 16 templates/owner, 256 vertices/owner, 64 placement attempts with 128 directions/owner, stable named streams and terminal reason classes       |
| All controls and compatibility                                 | README controls/version boundary; explicit coverage-input/invalidation consequence                                                              |
| Negative and illustrative arithmetic                           | Pinned normal-01 rejection plus occupancy calculation, explicitly not a passing world                                                           |
| Recommendation and next readiness                              | Local construction/certificate experiment justified; comparison requires a passing complete primary; no production selection or C1–C3 promotion |
| Verification and review                                        | Independent read-only review complete; focused and broader results recorded here                                                                |

The implementation experiment must freeze its template/control recipe before rendering and retain
all failed evidence. A candidate whose conservative certificates cannot pass needs a bounded
construction/design repair; a different support policy or weaker target is not an implicit fallback.

## Execution

C3 design discovery; two bounded agents supplied the design and independent review while the main
task handled adoption, issue state and verification. One design pass and one midpoint clarification;
no production repair, CI rerun, new matrix or claimed human visual decision. Current task settings
were retained. All commits in this continuation remain local; no Git push was performed.
