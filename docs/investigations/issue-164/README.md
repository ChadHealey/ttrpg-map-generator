# Issue 164 — macro-landmass morphology discovery

## Result

**No selection.** The maintainer rejected all twelve comparison images and adopted their per-image
rationales. Neither tested realization meets the proposed M2 whole-atlas morphology contract:
separated anisotropic envelopes still expose rounded lobes and circular support limits; independently
warped spherical cells replace those with slabs, wedges and conspicuous partition channels.
These results reject the tested bounded realizations, not every possible member of either family.
No production generator or accepted geography changes in this issue.

- [Visual contract, proposed version 1](visual-contract.md)
- [All eighteen preserved v2 images: inspection and exemplars](v2-review.md)
- [Twelve comparison images and adopted human decisions](visual-review.md)
- [Exact inputs, source revisions, hashes and measurements](comparison/results.json)
- [Proposed ADR and compatibility disposition](proposed-adr.md)
- [Ordered successor drafts](child-plan.md)

The next executable draft is D1: test whether explicit continental budgets and hierarchy survive
coverage calibration inside separated spherical owners. Its exact required evidence is in the child
plan. Production compatibility, generation, and adoption remain separately bounded conditional
drafts. No successor GitHub issue was created or modified.

## Readiness and provenance

Executed [issue 164](https://github.com/ChadHealey/ttrpg-map-generator/issues/164) as **READY Discovery**
on `main` at `14aca59708bfe71eb390d4de9393ba21ff226bf3`. The worktree was clean initially; no branch,
worktree or child agent was created. The preserved unaccepted v2 ref is
`investigation/issue-163-envelope-v2`, commit `736e1ddbbda804fa2c9e74e63d0d1ea3c99b83e1`.
All eighteen source PNGs were readable and their exact bytes/dimensions verified. See
[v2-provenance.json](v2-provenance.json), whose paths and seeds are pinned to that commit.
Byte-identical source PNGs are preserved in `v2-source/<row>.png`; routine tests verify these
issue-owned copies against the pinned hashes, including in shallow checkouts without that commit.

The issue was current and its predecessors were present. #162 had independently landed on `main`,
so the proposal preserves its v1/v2 compatibility instead of treating it as outstanding. The
[maintainer v2 rejection](https://github.com/ChadHealey/ttrpg-map-generator/issues/163#issuecomment-5544357502)
and [preservation record](https://github.com/ChadHealey/ttrpg-map-generator/issues/163#issuecomment-5544944531)
are the human source decisions. The existing accepted ADR-0029 is not edited by this proposal.

## Bounded experiment

Revision `issue-164-r2` comprises two deliberately small standalone Node modules:
[morphology.mjs](morphology.mjs) constructs/samples both fields;
[render-comparison.mjs](render-comparison.mjs) calibrates, renders, hashes, and repeats every case.
There are no production imports or new dependencies. The RGB diagnostic renderer paints only the
sampled land/water mask, with no labels, strokes, smoothing, styling or repair.

Inputs were selected before rendering: default-control seeds **1, 2, 3, 4**, then the existing
`connected-majority` and `fragmented-islands` controls with their original seeds. Every case has
identical inputs across both families. These are consecutive defaults and established control rows,
not seeds selected for favorable images. `results.json` records all nine public control values,
including controls whose complete production semantics are deliberately not implemented here.

The initial implementation inspection found that sea-level calibration expanded the signed-distance
island terms outside their intended small support, and that cellular fragmentation/circumference
needed explicit mappings. One normal review/repair pass gave islands finite support, made those
mappings explicit, fixed an independent `issue-164-stream-v1` scope namespace, and regenerated the
same full matrix twice. Only the final r2 matrix is delivered and human-reviewed. There was no
seed-search, third family, production adoption, or repeated tuning after that rejection.

### Family A: anisotropic separated envelopes

Each owner has an independently oriented broad elliptical core, three displaced unequal elliptical
lobes, and two elongated margin cuts. These use spherical tangent/log-map coordinates and great-circle
distance on unit vectors. Isolated islands and irregularly spaced groups share that owner's support.
Twenty-four fixed placement proposals per additional owner select a broadly separated but perturbed
arrangement with stable first-wins ties. A seeded primary-owner budget affects size but is explicitly
not a count of accepted semantic continents.

For distinct centers separated by angular distance `d(i,j)`, owner `i` has support radius
`r(i) = (min_j d(i,j) - g) / 2`, with `g = 0.05 rad`. Thus `r(i) + r(j) <= d(i,j) - g`.
Triangle inequality reserves at least `g` angular water between any retained points in distinct
supports, regardless of cuts, islands, poles or contour level. One owner uses a bounded 2-rad
support; its inter-owner guarantee is vacuous. Disjoint support is enforced before positive terms.

This is a viable bounded separation construction, but not a passing morphology result. All six
selected contours are negative: coverage grows the small owner templates outward, exposing their
circular bounds and flattening intended area differences. This measured interaction is a reason to
investigate coverage-aware hierarchy, rather than just adding more lobes or noise.

### Family B: independently warped spherical cellular regions

Each owner scores a unit vector with the maximum dot score of four biased sites, plus three
independent sinusoidal owner waves. Stable highest-score ownership, eight spherical water competitor
sites and one common contour form a weighted warped cellular partition. Sites are transient shape
construction data; neither site indices nor owner numbers define semantic landmass identity.
Islands are margin-oriented ellipses under the same owner competition guard.

An owner score's geodesic Lipschitz bound is at most
`1 + (0.065*3 + 0.035*6 + 0.01*11)*(0.65 + fragmentation/100) <= 1.84975`.
Use conservative `L = 1.86`. Land can exist only where the winning owner's score exceeds every
other owner by `L*g + 2/1_000_000`. For two retained points belonging to `i` and `j`, the difference
`score_i - score_j` changes from above `L*g` to below `-L*g`. Its Lipschitz bound is `2L`, so their
angular distance exceeds `g`. Maxima preserve Lipschitz bounds; dot vectors have unit norm;
sinusoidal derivative bounds apply globally. Ties and near-ties are water, not an ownership patch.

This proof concerns analytic scores in real arithmetic with a small implementation margin, not a
formal floating-point error proof or a production coastline guarantee. Tests independently check
wave derivative bounds and near-gap sample pairs. Island and polar terms cannot bypass the guard.
The test matrix retains separation but reveals broad geometric slabs and long partition channels.
Warping a cell does not automatically give it convincing subordinate continental anatomy.

## Measurements and interpretation

Each case samples a nested investigation grid: 400 by 200 preview intervals and 1600 by 800 full
intervals, one evaluation per pole, and no duplicate seam vertex. The raster repeats a pole's value
across its display row only. The final southern pole is hashed and tested even though the 800-row
PNG displays rows 0–799. Longitude and latitude are converted to unit vectors before field evaluation.
Twenty-four fixed integer bisection steps choose a contour from preview samples using spherical
cosine row weights. If the guard cannot hold the requested area, calibration reports `capacity-failed`.
This is not the production grid/weighting/classification contract.

| Family   | Case               | Preview water % | Full water % | Largest three preview component shares of land % |
| -------- | ------------------ | --------------: | -----------: | ------------------------------------------------ |
| Envelope | normal-01          |          64.999 |       65.016 | 31.49 / 29.76 / 20.79                            |
| Envelope | normal-02          |          65.000 |       64.985 | 33.61 / 26.38 / 23.90                            |
| Envelope | normal-03          |          64.999 |       64.985 | 32.87 / 31.19 / 24.65                            |
| Envelope | normal-04          |          65.001 |       65.004 | 27.57 / 26.95 / 26.70                            |
| Envelope | connected-majority |          60.000 |       60.031 | 19.48 / 19.25 / 17.45                            |
| Envelope | fragmented-islands |          70.000 |       70.008 | 33.11 / 27.58 / 16.72                            |
| Cellular | normal-01          |          65.000 |       65.015 | 41.05 / 34.53 / 22.83                            |
| Cellular | normal-02          |          65.000 |       65.023 | 40.09 / 29.68 / 14.33                            |
| Cellular | normal-03          |          64.999 |       65.007 | 48.87 / 23.85 / 22.84                            |
| Cellular | normal-04          |          65.001 |       65.000 | 47.14 / 18.30 / 17.30                            |
| Cellular | connected-majority |          60.000 |       59.986 | 27.80 / 24.14 / 16.52                            |
| Cellular | fragmented-islands |          70.000 |       69.993 | 30.82 / 29.91 / 26.97                            |

Shares come from a four-neighbor, seam-wrapped preview component traversal with cosine weights;
connected pole rows share one value. They are diagnostic approximations, not production semantic
classifications or a definition of “visually primary.” Cellular area variation improves, but its
visual grammar still fails. Envelope normal-04 illustrates why a seeded primary-owner budget alone
is insufficient: four similarly large components remain despite an intended budget of three.

All twelve cases calibrated and repeated identical **complete sampled grid/owner bytes**, mask bytes,
PNG bytes, and measurements. Grid hashing writes signed ticks as big-endian Int32 and owners as
Int8 in explicit row order, avoiding native-endian hashes. Exact source-file digests bind the receipt
to the prototype and inputs; `exactRepeat` is produced only after deep byte/report comparisons.

Per case: 80,400 shared grid slots matched exactly; 201 seam aliases and 722 pole aliases matched.
Every comparison case has retained land on the seam (14–142 preview latitude anchors in cellular,
47–126 in envelopes), so the matrix is not an ocean-only seam proof. Focused checks also compare
one-sided seam limits, exercise 500 near-gap pairs for each case/family, test geometric gap bounds,
and exercise explicit bounded capacity failure. Unique pole coordinate identity is tested at both
poles; this does not prove the production polar triangle fan or its coastline interpolation.

## Comparison beyond image preference

| Concern              | Envelope                                                                                    | Cellular                                                                                    | Production consequence                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Morphology range     | Unequal anisotropic lobes and cuts, but circular clipping and area equalization persist.    | More variable component shares, but slab/wedge forms and partition channels persist.        | Select neither tested realization.                                                                                                       |
| Separation           | Compact spherical caps with a triangle-inequality gap.                                      | Global score margin and independently bounded warps.                                        | Preserve an angular invariant; not a one-pixel or renderer gap.                                                                          |
| Seam/poles           | Unit-vector/log-map evaluation; hard outer support and tiny island steps.                   | Unit-vector site scores/warps; hard ownership/island masks.                                 | Analytic location identity passes; production continuous contour/interpolation proof remains missing.                                    |
| Bounded construction | 24 placement candidates per additional owner, finite lobes/cuts/islands.                    | Same placement budget; four sites and three waves per owner plus eight water sites.         | Fixed construction plus 24-step calibration, capacity failure; no retry-until-attractive loop.                                           |
| Preview/full         | Same analytic field and same preview-selected contour at nested anchors.                    | Same.                                                                                       | Investigation anchors pass; existing production sampling/weights/quantization must be reused and separately proven.                      |
| Semantic ownership   | Owner index can retain multiple disconnected components.                                    | Same, with warped competition ties deliberately water.                                      | Classify the accepted partition; never force semantic IDs/counts from construction owners.                                               |
| Islands/groups       | Unequal elliptical sizes and irregular spacing; clipped to support.                         | Same feature recipe guarded by cellular ownership.                                          | Orientation relates to a planned margin, not verified realized coast; some satellites merge or vanish. Not complete abundance semantics. |
| Performance          | Outside supports, only owner dot checks; one admitted owner's finite shape evaluations.     | Every sample evaluates all owners' sites/waves plus water competitors and admitted islands. | Cellular has higher expected per-sample cost; no reference-machine budget or benchmark claim is made.                                    |
| Portability          | `acos`, trigonometry, `hypot`, log-map divisions near antipodes.                            | Dot/max plus sinusoidal score differences near ties.                                        | Fixed RNG and quantization reduce risks but do not prove macOS/Linux equality. Numeric adapter tests are mandatory before adoption.      |
| Compatibility/cost   | Closer to the existing analytic adapter, but selection would still change canonical output. | More score-bound, tie, calibration and control policy to own.                               | Both need version 3, strict provenance support, additive evidence, and explicit creation/adoption.                                       |

### Control coverage and limits

`continentCountIntent` allocates `1..8` construction owners. `balanced` gives equal template sizes;
`varied` uses the seed's primary budget; `oneDominant` weights the first owner. Realized components
can differ and the visual review finds some intended hierarchy lost. No prototype claims production
count/distribution conformance. Circumference scales template extent by a bounded square-root factor;
this is a spike mapping, not a new public-control definition. Fragmentation widens envelope cuts or
increases cellular warp amplitude within the proven derivative bound. Separate abundance inputs
control isolated/group member construction budgets. Zero still creates no corresponding satellites.

Water target selects the common contour. Ocean-connectivity intent is recorded but **not implemented
or semantically verified**: it belongs to the unchanged downstream land/water/semantic pipeline.
`connected-majority` is an input row name, not an assertion that this spike proves a qualifying ocean.
Polar character adds a bounded owner-guarded bias; the comparison uses neutral controls and tests
unique pole evaluation, not the full land/ocean-biased extremes. Future adoption must test all
controls/extremes, cancellation, shape failure, production topology and semantic truth. These explicit
limitations are additional reasons not to promote either prototype.

## Reproduce and verify

Use the repository's Node 24.11.0 and pnpm 11.19.0. From the repository root:

```sh
# Writes only a disposable investigation comparison, runs each pair twice.
node docs/investigations/issue-164/render-comparison.mjs /tmp/issue-164-repeat
# Focused evidence, geometry, gap, repeat-receipt and PNG decoding tests.
corepack pnpm exec vitest run docs/investigations/issue-164/morphology.test.mjs
corepack pnpm check
```

Compare the temporary `results.json` and PNGs byte-for-byte against `comparison/`. Omitting the
output argument regenerates only this issue's unaccepted diagnostic evidence. Do not overwrite a
human-reviewed revision: change the revision and retain its review/provenance before new experiments.
The production fixture updater is not used because these are explicitly issue-owned investigation
artifacts, not registered fixtures or accepted geography.

Observed focused result: **1 file / 8 tests passed** on macOS, Node 24.11.0. The twelve-case renderer
completed its double runs with exact report/grid/mask/PNG equality. Human review: **12/12 fail**, with
all rationales explicitly adopted by the maintainer on 2026-09-05. Local evidence is not a Linux run.
Repository-wide verification and final scope-review results are recorded in [verification.md](verification.md).

## Acceptance disposition

| Issue criterion                                                                       | Disposition                                                                                                                |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Eighteen preserved v2 PNGs, provenance, successes/failures                            | Complete: read-only extraction, hash/dimension tests, all-row inspection and class/absence table.                          |
| Positive and negative versioned visual contract, atlas/regional boundary              | Complete as proposal; one-to-three co-primary masses, internal hierarchy, arrangement, waters and margin islands explicit. |
| Two bounded families / four default seeds / two control cases / exact repeats         | Complete: twelve final r2 images and exact inputs, full sampled hashes and repeat receipts.                                |
| Geometry, bounds, controls, ownership, cost, portability and compatibility comparison | Complete as investigation with stated unproven production semantics; no claim of production readiness.                     |
| Human decisions and family diversity                                                  | Complete: every image rejected and its rationale adopted; cohort diversity assessed separately.                            |
| Select a family or provide precise no-selection follow-up                             | Complete: no selection; bounded coverage/hierarchy investigation D1 drafted.                                               |
| Proposed superseding ADR and compatibility/M3 disposition                             | Complete as no-selection proposal; no family-specific v3 adoption authorized and accepted ADR unchanged.                   |
| Ordered bounded children with readiness/profiles                                      | Complete as drafts; D1 ready discovery, C1–C3 explicitly blocked on selection/predecessors.                                |
| Production, accepted fixtures/data and registered gallery untouched                   | Complete: all 42 additions are issue-owned; tracked production/fixture/ADR paths remain unchanged.                         |

Dedicated read-only review identified a shallow-checkout provenance-test failure; the correction
and focused verification are recorded in [verification.md](verification.md). No push, PR, commit,
issue-state change or external comment is included.
