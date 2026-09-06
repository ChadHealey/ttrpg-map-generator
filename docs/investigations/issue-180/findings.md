# Issue 180 findings

The frozen issue-179 r2 family is not ready for general v3 use. Of 128 additional
default seeds, 90 construct and place successfully; 38 exhaust construction.
The 32 declared control probes yield 25 construction/placement passes, five
construction failures and two bounded placement failures. These are geometric
results, not visual, semantic, production or human acceptance.

| Final corpus        | Pass | Construction no-proposal | Placement no-proposal | Checker failure |
| ------------------- | ---: | -----------------------: | --------------------: | --------------: |
| Additional defaults |   90 |                       38 |                     0 |               0 |
| Controls            |   25 |                        5 |                     2 |               0 |
| Total               |  115 |                       43 |                     2 |               0 |

The [final manifest](evidence-final/manifest.json) names every input before the
run; [summary](evidence-final/summary.json) and [completion](evidence-final/completion.json)
retain counts and byte hashes. Each compressed row contains the entire input,
independent expected owner ledger, construction attempts/failures, accepted
geometry/certificates, placement attempts/failures and frames, audit findings,
and hashes of two strictly equal calls. No partial owner set was placed. No
input, quota, failed candidate or failed placement attempt was substituted.
No raster was evaluated. All source checks and both full replays pass through
the [read-only verifier](verify.mjs).

## Default branch failure

| Initial primary count | Seeds | Construction and placement pass | Construction failures |
| --------------------- | ----: | ------------------------------: | --------------------: |
| 1                     |    38 |                               0 |                    38 |
| 2                     |    41 |                              41 |                     0 |
| 3                     |    49 |                              49 |                     0 |

Every default failure exhausts all 12 candidates for owner-0, with quota
0.17451657458563533. For example, `default-001`, seed `180000000000000001`,
retains peninsula extent/width upper-limit, peninsula ratio and bay opening
upper-limit rejections, plus candidate construction failures. Its three paid
subordinates are retained; they cannot replace the missing primary. The same
shape family succeeds at the smaller primary quotas in the two/three-primary
branches. This supports a bounded quota-aware geometry repair, not an increase
in candidate retries or a smaller paid owner quota.

## Control outcomes

Five construction failures are `control-water-min`, `control-count-min`,
`control-distribution-dominant`, `control-combined-min`, and
`control-eight-balanced-high-water`. Their exact attempts remain in the named
receipts. Large owners encounter upper extent/width or chart limits; the eight
balanced high-water owners each have quota approximately 0.025 and fail lower
interior/disk/width/extent/bay floors.

`control-count-max` and `control-eight-balanced-low-water` construct all eight
owners but exhaust 64 placement attempts (12,372 and 10,505 center evaluations,
respectively). Their terminal receipt explicitly says
`search-only-not-infeasibility`. The audit does not convert search exhaustion
into an impossibility proof.

| Control               | Actual private stage effect                                                           | What is not established                           |
| --------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Water coverage        | Sets total paid land quota before exact fitting                                       | Raster coverage or production tolerance           |
| Count                 | Sets the number of paid owners                                                        | Placement over the full public domain             |
| Distribution          | Sets squared-size quota shares and primary classification                             | Broad-domain anatomy feasibility                  |
| Island abundance      | Changes paid share and finite detached member count; zero removes the category        | Production island semantics                       |
| Archipelago abundance | Changes its independent paid share and finite member count; zero removes the category | Production archipelago grouping                   |
| Fragmentation         | Computes metadata band passed to layouts, but no layout or subordinate consumes it    | Any fragmentation realization                     |
| Ocean connectivity    | Echoed in the recipe; no construction, placement or scalar-field consumer             | Any requested marine semantic mode                |
| Polar character       | Local chart-y stretch 0.96/1/1.04 followed by quota refit; can alter guard/placement  | A globe-latitude bias or monotonic polar coverage |
| Circumference         | Records physical km per radian; angular geometry/placement does not consume it        | Production coordinate/physical-radius behavior    |

The seed-1 baseline, both circumference endpoints, both other ocean enums, and
all eight fragmentation probes have exactly identical owner and placed-owner
fingerprints. Only recipe/input metadata is excluded from those comparisons;
geometry, certificates, paid quotas and frames are included. Fragmentation is
a complete geometry no-op here, not merely coarse quantization into four bands.
Both polar probes change geometry and placement fingerprints. Placement frames
are independently oriented from seed/owner streams; no global-z or latitude
objective consumes polar character, so changed visible coverage would be an
incidental shape/placement consequence.

These conclusions come from [controlRecipe](../issue-170/templates.mjs), the
[frozen constructor](../issue-179/templates-r2.mjs), all three imported literal
layouts, [placement](../issue-170/placement.mjs), and the
[fixed-zero field](../issue-169/field.mjs), not merely the sampled hash equality.
The field retains input as metadata and evaluates the same polygon boundary.

## Restricted structural limits

Every primary uses the wedge-geodesic bay certificate with maximum chart angle
alpha at most 1.4 radians. The certificate bounds all named polygon vertices,
including detached paid islands, in the convex LAEA chart disk. Hence all
positive polygons lie inside that disk and their disjoint total paid area is
bounded by the spherical cap fraction:

`q <= (1 - cos(1.4)) / 2 = 0.41501642854987947`.

For the one-owner, water-45 endpoint, `q = 0.55`, exceeding this limit by
0.13498357145012058. This is impossible for this frozen chart/certificate family,
even with a different coastline inside that chart. A one-owner water fraction
of at least 58.49835714501206 percent is necessary under this restriction, not
sufficient. This is not an impossibility result for the adopted v3 targets or
other representations. The `control-combined-min` failure retains the concrete
chart and feature failures; the area bound includes the whole owner, not just B.

Simple disjoint positive polygon disks in disjoint spherical guards also leave
a connected raw continuous water complement. This does **not** make production
`multipleBasins` impossible: the [M2 proof contract](../../milestone-2-atlas-proof.md)
and [water policy](../../../packages/core/src/atlas-geography-water-policy.ts)
define marine roots from disconnected clearance cores inside a connected
primary raw-water component. Such semantic cores could arise in connected raw
water. This audit neither constructs nor evaluates that production adapter;
missing enum consumption and unproved semantic realization are the finding.

## Evidence corrections and limits

The [first capture](evidence/manifest.json) is retained unchanged as a checker
diagnostic. It initially reported two control checker failures because exact
certificate receipts were recomputed with a mathematically equal quota whose
floating-point multiplication association differed. The corrected checker
first independently validates owner quota within 1e-12, then re-certifies with
that owner's exact declared quota, matching the original certificate call.
The same 160 inputs were declared and replayed again; no geometry source or
budget changed. Those two rows now pass. This is an audit correction, not a
constructor repair. Both raw checker versions and complete captures remain.

The historical writers' embedded `--verify` comparison also failed on optional
`undefined` summary fields omitted by JSON. The separate verifier normalizes
only that persisted summary comparison; every raw per-probe repeat still uses
strict deep equality. Use `verify.mjs --initial` and `--final`, not the historical
writer verifier. No evidence bytes were changed to repair verification.

There are 51 terminal owner construction failures across 43 inputs. Summary
candidate/placement failure-code totals count occurrences, including earlier
failed attempts before eventual success; they are not failed-world counts.
The 128 seeds are a fixed finite corpus, not random sampling, a failure-rate
estimate, or exhaustive seed coverage. No contour extraction, raster profile,
semantic marine/polar proof, visual diversity judgment, Linux/macOS equality,
or broad production qualification follows. Existing issue-179 visual rejection
remains in force. Unchanged broad-check timeout/recovery is documented in
[issue-179 verification](../issue-179/verification.md); this audit adds focused
checks and replay, not a new claim that the historical broad run was clean.

The smallest next implementation step is a separately bounded repair for the
ordinary one-primary quota, retaining the same target floors and all 38 failed
seeds. A separate control-support contract must make unsupported ocean,
fragmentation and polar intent explicit before a product adapter can claim
support. Low/high quota and eight-owner placement extremes need their own
bounded design evidence; increasing search or silently weakening controls is
not justified by this audit.
