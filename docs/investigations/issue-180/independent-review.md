# Issue 180 independent audit review

No actionable correctness, provenance or conclusion finding remains in the reviewed
[corpus](corpus.mjs), [final checker](audit-final.mjs), [runner](run-final.mjs),
[read-only verifier](verify.mjs) and [findings](findings.md). The outcome is a bounded
failure audit of frozen issue-179 r2, not general v3 qualification or visual selection.

## Corpus, arithmetic and replay

Independently verified the exact 128 distinct additional default seeds and 32 declared
same-seed control probes. The corpus covers every enum, count/water/circumference
endpoints, detached-category endpoints, fragmentation band boundaries and the declared
combined extremes. Inputs are fixed before execution, and the additional seeds exclude
the retained issue-179 comparison seeds. This is neither exhaustive combinations nor a
statistical failure-rate estimate.

Ran both commands successfully, without writing retained artifacts:

```sh
node docs/investigations/issue-180/verify.mjs --initial
node docs/investigations/issue-180/verify.mjs --final
```

Each verifies all 160 rows and performs 320 strict repeated construction/check/placement
calls. Each capture has 20 source records, with 17 matches to frozen issue-179 runtime
sources. The verifier establishes exact equality with the trusted current source closure,
source/hash inventories, fixed runner/helper dependencies and frozen authority before
executing any captured source. It then checks the exact artifact inventory and hashes,
every persisted row against replay, summary arithmetic and final source integrity.

Independent direct receipt counts confirm:

| Cohort                  | Construction and placement pass | Construction no-proposal | Placement no-proposal |
| ----------------------- | ------------------------------: | -----------------------: | --------------------: |
| 128 additional defaults |                              90 |                       38 |                     0 |
| 32 controls             |                              25 |                        5 |                     2 |
| Total                   |                             115 |                       43 |                     2 |

There are no final checker failures. The default primary-count split is exact: all
38 one-primary branches fail construction, all 41 two-primary branches pass, and all
49 three-primary branches pass. Exhausted construction retains partial accepted owners
and all twelve failed attempts for each missing owner; partial sets are not placed.
The two placement failures are finite search exhaustion, not analytic infeasibility.
Failure-code occurrence totals include prior attempts and must not be read as world counts.

Directly compared every initial/final receipt: all 160 constructor outputs are identical.
Only `control-water-max` and `control-distribution-balanced` change status, from checker
failure to pass; all other placement results are identical. The checker correction uses
the owner's already independently checked quota for exact certificate reproduction,
avoiding a different floating-point association in the receipt argument. The independent
quota tolerance and paid-area checks remain. Both complete captures are preserved.

The separate verifier corrects the historical writer's comparison of optional summary
fields omitted by JSON. Only persisted summary comparison is normalized; the per-probe
repeat still requires strict deep equality before serialization. No third capture or
rewriting of prior evidence is needed for that correction.

## Control and structural conclusions

The successful identical-fingerprint group consists of the seed-1 baseline,
circumference endpoints, both other ocean enums and all eight fragmentation probes.
Source inspection confirms that fragmentation is passed as metadata but unused by the
three literal layouts and subordinate construction. Ocean connectivity is echoed but
not consumed by construction, placement or field evaluation. Circumference records a
physical conversion without changing these angular polygons or placement. Common
empty-owner digests from unrelated failed controls are not evidence of a semantic no-op.

Polar character changes local chart-y scale before quota refitting and can consequently
change guards and placement. The independently oriented placement frames have no
global-latitude or polar-coverage objective. The changed fingerprints are a real shape
effect, but do not prove monotonic or intended global polar bias.

The chart-area obstruction is valid for this frozen family. Successful primaries use
the wedge certificate with angular cap at most 1.4 radians. All owner polygon vertices,
including islands, lie within its convex planar chart disk; their disjoint interiors
therefore fit within that disk. Equal-area mapping bounds total owner quota by
`(1 - cos(1.4))/2 = 0.41501642854987947`. A single owner at water 45% requires quota
0.55 and cannot satisfy that bound. The necessary one-owner water threshold of
58.49835714501206% is not sufficient, nor an impossibility result for the adopted targets
under another representation.

Disjoint simple land disks leave a connected raw continuous water complement. This does
not rule out production `multipleBasins`: the existing
[water policy](../../../packages/core/src/atlas-geography-water-policy.ts) derives
semantic roots from disconnected clearance cores within connected raw water. No such
adapter was evaluated here. The findings correctly distinguish missing enum consumption
from a general topological impossibility of semantic basins.

## Review corrections and checks

Initial review identified missing selection/exhaustion ledger validation, invalid numeric
placement counters passing upper-bound-only checks, missing frame handedness, and snapshot
execution before provenance validation. These were corrected before the final review.
The checker now validates contiguous attempt ledgers, exact selected-owner linkage,
explicit exhaustion, finite integer bounds, right-handed orthonormal frames and final
pair-distance receipts.

Independently ran both focused test files: **13 tests pass**. They cover missing receipts,
changed quotas, retained partial failures, bounded placement failures, malformed counters,
reflected frames, collisions, unequal repeats, the quota-association regression and the
successful control fingerprint groups.
Disposable shadow-evidence tests reject coherently rehashed injected source before it
executes, omitted artifact hashes, altered rows and replaced inputs. No tests mutate the
retained captures.

The quota-aware one-primary successor is supported by the observed default failure class;
increasing retries or lowering paid quotas is not justified. Control-support and extreme
quota/placement design remain separate work. This audit performs no scalar grid, raster,
contour extraction, semantic classification, visual acceptance or cross-platform proof.
Issue-179's balanced-control visual rejection remains in force; human selection and
production adoption remain pending.
