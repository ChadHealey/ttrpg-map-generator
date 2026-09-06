# Issue 167 — proposed continental feature requirements

**Recommendation: adopt the targets below for a subsequent bounded design investigation of
the same separated spherical envelope policy. Maintainer adoption: ACCEPTED for design investigation.** These are explicit
product-design judgments, not measured survival limits, an achievable construction, an accepted
architecture, or human visual approval. This proposal supplies the decision requested by
[issue 167](https://github.com/ChadHealey/ttrpg-map-generator/issues/167), following the reviewed
[issue-166 insufficiency finding](../issue-166/README.md). Verification and the separate review
gate are recorded in [verification.md](verification.md).

## Authority and measurement frame

The [M2 visible exit](../../PROJECT_PLAN.md#milestone-2--whole-world-atlas-postcard), public
[atlas controls](../../milestone-2-atlas-proof.md#atlas-controls), and all six positive requirements
and R1–R6 of the [unchanged visual contract](../issue-164/visual-contract.md) remain the authorities.
All twelve [human-rejected issue-165 images](../issue-165/visual-review.md) remain failed.
This document proposes engineering targets supporting those observations, without amending them.

Distances are shortest great-circle distances on the unit sphere in **radians**; areas use
`μ(S) = area(S)/(4π)`, the fraction of the **whole sphere**. An owner quota `q_i` includes every
land component assigned to that construction owner. A body's land area `Q` excludes its detached
islands and other bodies; `μ(feature)/Q` is **body-land-relative**, not sphere-relative or total
owner-land-relative. Owner-land-relative share is `μ(feature)/μ(all owner land)`, equal to `μ(feature)/q_i` at exact quota. Reports must supply all three denominators when comparing them. The enclosing
cap radius `r_i` is a radius, never a feature width. Guards and role witnesses are temporary design
objects, not semantic continents, peninsulas or bays.

For circumference `C` km, radius is `C/(2π)` km, distance is `Cθ/(2π)` km, and physical area is
`μ(S) C²/π` km². Proposed angular floors stay the same throughout the public circumference range;
they intentionally scale physically with the world. Display resolution does not alter geometry.
At the equator, 0.08 rad spans about 20.37 native or 10.19 half-size pixels, and 0.30 rad spans
76.39 or 38.20. These are scale illustrations using 1600/(2π) and 800/(2π), not measurement rules.
Equirectangular horizontal distortion increases toward poles; seam pieces form one spherical
body and a unique pole is not an area reserve. Human native 1600 × 800 and half 800 × 400 review
remains necessary for directions, projection effects and recognizability.

## Roles and applicability

Before placement, declare intended connected bodies, immutable owner quotas, body-area budgets,
primary/subordinate roles, and ordered geometric role witnesses. Preserve all requested owner
slots for public count intent 1..8. Slots are construction bookkeeping; their realization still
needs the public semantic classification and visual-count checks. No silent count clamp, dropped
owner, quota transfer or relabeling of a failed primary is permitted.

As a **proposed audit rule**, a main body whose final area is at least half the largest main
body's area must be treated as primary. Every declared primary must meet the primary targets even
if it finishes below that ratio. Any undeclared body reaching the ratio invalidates the proposal;
it must not be retroactively labeled subordinate. Human-observed primaries must also receive the
primary checks; numeric role assignment cannot overrule visual primary count. Detached islands
cannot be called primary-body anatomy, nor may an intended main body be renamed an island to pass.
Equal large bodies all trigger primary treatment; no global dominant body is required.

For this proposal, the **ordinary-control audit domain** includes default water/distribution/
fragmentation/island/archipelago/ocean/polar values, all circumferences, seeds and count intents.
It therefore includes all four retained normal rows. It requires one to three visually primary
masses and at least one declared primary. Count 4..8 must still realize the full intent through
an explicitly justified primary/subordinate composition, not a clamp. This domain is a proposed
minimum test domain, not a claim that every other combination is extraordinary: later work must
justify additional applicability against the visual contract. Explicit `balanced` high-count
and fragmented control cases may expose more primaries; each must retain primary anatomy, and
controls cannot excuse R1–R6. A family still needs interpretable control rows as well as ordinary
passes. Realization across these domains is unverified.

A future certificate must identify role sets in the continuous, post-cut/post-polar land, before
sampling or rendering, throughout its permitted calibration interval:

- `B` is the connected interior anchor containing a declared geodesic disk. Required lobes and
  peninsula connect to that anchor through land; an unrelated disk elsewhere cannot qualify it.
- Two ordered secondary lobes have distinct exterior coast arcs and positive area outside `B`
  and earlier lobes. Each has one declared attachment to the preceding body. A peninsula is a
  separate terminal extension, credited only outside `B` and every lobe, with a tip and one root.
- Each attachment is witnessed by a simple coast-to-coast crosscut through land. Removing that
  crosscut separates the feature's exterior portion from the anchor; an alternate land bridge
  disqualifies the single-attachment witness. Specify a collar covering the root to the feature's
  first interior disk of radius half its required attachment width. Attachment width is the
  infimum of lengths of separating crosscuts in that collar, not the widest chosen chord.
  Each credited exterior is connected. Ambiguous roots, an empty collar, double attachments,
  or multiple interchangeable role decompositions without a fixed declared choice fail certification.
- An embayment has two declared coastal shoulders and a shortest geodesic mouth arc between
  them, with interior in water. Its water pocket lies on the body-facing side, bounded by that
  arc and a connected coastal arc, and connects through the mouth to exterior water. Opening is
  mouth-arc length; depth is the maximum shortest spherical distance from pocket points to that
  mouth arc. The pocket must remove positive area from the intended land union. An inland hole
  or offshore water patch cannot qualify. Ambiguous mouth/side or antipodal endpoints fail.

These are witness obligations, not a feature-extraction algorithm. A fixed witness prevents
searching for a favorable decomposition after a failed calibration. Overlap is allowed but never
double credited. Two lobes plus a peninsula must be distinct roles; assigning three names to the
same protrusion fails. Subordinate main bodies need a connected interior and safe attachments
where such features exist; they need not carry the complete primary inventory. Detached islands
need containment and protected water, not continent anatomy.

## Candidate requirements table

All values in this table are **adopted targets for the design investigation**, following the decision below. Lower and upper bounds are inclusive.
Measure the surviving geometry at every allowed contour value; the nominal construction alone
cannot pass. `Q` is the body's actual land area at that value. Algorithmic proofs remain unresolved.

| Feature / object and stage                                                                                                                                                | Candidate target                                                                                                                               | Applicability and rationale                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Broad interior: largest certified disk inside surviving `B`; width is twice its radius                                                                                    | Primary: width ≥ 0.30 rad (radius ≥ 0.15) and surviving `B` area ≥ 0.55 Q. Subordinate: width ≥ 0.15 rad (radius ≥ 0.075), no area-share floor | Every intended main body. A two-dimensional anchor and majority interior resist a hierarchy consisting only of thin chains; they cannot exclude every ribbon.                                                                             |
| Secondary lobes: surviving disjoint marginal areas outside `B` and earlier lobes; root collars after all water cuts                                                       | At least two per primary; each ≥ 0.08 Q, their sum ≥ 0.20 Q; larger/smaller ≥ 1.5 for the two required lobes. Each root width ≥ 0.10 rad       | Primary inventory; any declared subordinate lobe retains the 0.10-rad root floor but has no required area share. Unequal contributions support size hierarchy; direction and curvature still require visual judgment.                     |
| Peninsula: surviving marginal area outside interior/lobes; extent from root crosscut to farthest point of its exterior, using shortest spherical distance to the crosscut | At least one per primary; marginal area ≥ 0.05 Q; extent 0.20..0.45 rad; root width 0.08..0.16 rad; extent/root width ≥ 2                      | Primary inventory; a declared subordinate peninsula uses the same angular rules without the area-share floor. A visibly extended but attached subordinate form is intended; decorative slivers and a lobe renamed peninsula are excluded. |
| Embayment: water pocket, mouth and depth after every positive term and polar effect                                                                                       | At least one per primary; depth ≥ 0.15 rad; opening 0.12..0.30 rad; depth/opening ≥ 0.5; removed area ≥ 0.02 Q                                 | Primary inventory; any declared subordinate embayment uses the angular rules without the area-share floor. Require an outline-changing recess and an open mouth, without prescribing ellipse cuts.                                        |
| Owner guard: infimum of `r_i − d(c_i,x)` over the closure of all realized owner land                                                                                      | Final clearance `m` ≥ 0.04 rad; nominal clearance ≥ 0.05 rad; proposed permitted contour motion `D` ≤ 0.01 rad                                 | All land, including islands, group members and finite polar land. Reserve room before placement and keep the final silhouette off support clipping. Never fill this strip for quota.                                                      |

The minimum primary land shares are compatible algebraically: `0.55 + 0.20 + 0.05 = 0.80`.
Embayment water is reserved separately before computing surviving shares; it is not another
land share. The remaining 0.20 is uncommitted body land, not guaranteed island capacity, because
islands are outside `Q`. There is no claim that these areas can be embedded with the stated widths.

The inherited gap is **0.05 rad**, independent of the proposed clearance. For owner caps require
`r_i + r_j + 0.05 ≤ d(c_i,c_j)`; one owner makes that pairwise test vacuous. All positive terms
remain under their final guards. At the proposed minimum clearances, the corresponding realized
land gap is at least `0.05 + 0.04 + 0.04 = 0.13` rad; this extra cost is intentional and must be
included in feasibility, not recovered by weakening the inherited cap gap. Clearance suggests
nominal width reserves of at least `w + 2D`
and depth/extent reserves of at least `h + 2D`, with analogous headroom below upper limits.
These are conservative design obligations to certify later, not displacement or survival proofs.
`D = 0.01` is an allowed geometric-motion ceiling, **not** a claim the retained scalar obeys it.
The retained field is not signed distance: ±4 scalar units or 1,000,000 ticks/unit cannot be
converted directly to radians. A future certificate needs a valid contour band, transverse lower
slope bounds, controlled branch changes, topology and area-share preservation, including fixed
island interactions. Hausdorff proximity or an upper Lipschitz bound alone does not prove these.
If the certificate needs tighter motion than 0.01, use that tighter interval; do not enlarge it
to reach quota.

## Reserve ledger and no-proposal policy

Carry forward the [issue-166 ledger](../issue-166/policy.md#area-ledger-and-feasibility-obligation).
Before water removal let `U = B ∪ L_1 ∪ ... ∪ L_k ∪ P`,
`b = μ(B)`, `l_j = μ(L_j \ (B ∪ earlier L))`, `p = μ(P \ (B ∪ all L))`, and
`e = μ(E ∩ U)`. Here the pre-cut sets in the ledger become the surviving role sets measured above
after subtraction; re-evaluate each surviving marginal share after cuts. For multiple bodies use
their union with the same ordered marginal accounting. Reserve `E` against **every** positive term.

At the selected calibrated contour, with island/group union `I` and finite polar land reserve `Z`, require
`q_i = b + sum(l_j) + p − e + μ(I \ (U \ E)) + μ(Z \ ((U \ E) ∪ I))`.
Both `I` and `Z` are disjoint from protected `E`; overlapping islands/groups and polar contributions
count once. Additional polar water is also subtracted once (include it in `E` for the ledger;
keep the embayment witness separately identified). The ±0.1 z² retained polar bias is scalar,
not free area. Ledger sets must describe its final effects. A zero-area pole point cannot pay a
finite quota. Protected water also includes island channels, whether cut from `U` or already outside it.
At other contour values the same expression records realized area, which may differ from the
immutable target `q_i`; certification must show a permitted value can reach it.

Let `K_i = cap(c_i, r_i − m)` and `W_i` be the union of all protected water within `K_i`.
The necessary capacity check is `q_i ≤ μ(K_i \ W_i) ≤ (1 − cos(r_i − m))/2` with `r_i > m`.
Require the actual connected role layout and reserved water to fit too. Sum quotas to the requested
land fraction; island floors must not exceed their owner quotas. Contour offsets can spend only
certified freedom, never the guard strip or protected water.

For this proposal retain squared template-size shares as the single starting allocation rule
from [budgetShares/calibrate](../issue-165/field.mjs), fixed before placement. This is an inherited
experiment hypothesis, not a selected production allocation. Geometry may reveal it cannot
satisfy the role rules; return no proposal instead of changing shares during calibration.

Keep the retained experimental coverage limits: absolute error from target ≤ **0.25 percentage
points** at both 400 × 200 preview and 1600 × 800 full samples, and per-owner preview error ≤
**0.25/count percentage points of sphere area**. These are separate target checks, not merely a
preview/full difference limit. Sample tolerance is not slack in the exact area/feature ledger.
It neither proves analytic feasibility nor permits quotas to move between owners.

Invalid public inputs still fail the existing validator without coercion. A valid input may
instead yield **no proposal** for a demonstrated cap/feature/water conflict, island floor above
quota, coverage failure, missing required certificate, non-finite result, or exhausted declared
finite operation budget. Report the input, failed obligation, quota/capacity or measured threshold,
and whether the result proves infeasibility or only an exhausted/unproved search. Preserve seed,
all nine controls, requested owners, quota shares and gap; never substitute another policy.
The current lack of a solver is an investigation limitation, not an implemented all-inputs-fail rule.

The fixed normal-01 caps are a mandatory rejection. Other low-water/high-count combinations may
fail capacity, high-island combinations may exceed floors or consume protected channels, and
fragmentation/polar/ocean combinations may fail anatomy or topology. These are conditional failure
permissions for every valid combination, including defaults, not claims those categories necessarily
fail. No combination has been certified successful by this proposal, and no failure rate is measured.
A policy returning only failures would not meet the M2 visible proof or qualify a comparison family.

## All nine public controls

Ranges/defaults below are inherited from [AtlasControls and defaults](../../../packages/core/src/atlas-geography-model.ts)
and [validateAtlasControls](../../../packages/core/src/atlas-geography-validation.ts). No changes are proposed.

| Control: range; default                                                          | Responsibility and limits                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `worldCircumferenceKm`: 10000..80000, step 1000; 40000                           | Scale angular geometry into physical km/km². Same angular targets; no pixel or circumference-based relaxation.                                                                                                                                                                        |
| `targetWaterCoveragePercent`: integer 45..80; 65                                 | Set `sum(q_i) = 1 − water/100`; retain both sampled coverage limits and exact reserve accounting. Valid low-water inputs may have inadequate separated capacity.                                                                                                                      |
| `continentCountIntent`: integer 1..8; 4                                          | Preserve every requested slot and validate/document realization. Primary anatomy follows the role rule; ordinary visual primary count remains 1..3. No clamping, dropping or renaming owners.                                                                                         |
| `continentDistribution`: balanced/varied/oneDominant; varied                     | Retain equal shares for balanced and seeded size relationships for varied/oneDominant. Unequal anatomy remains required even for co-primary areas. High-count balanced controls need explicit primary-count applicability; oneDominant does not turn every other body into an island. |
| `fragmentationPercent`: integer 0..100; 35                                       | Vary cuts and connected/subordinate structure within protected widths, shares and water. Same primary floors at 0 and 100; high fragmentation cannot replace all interiors with ribbons. Meaningful progression remains to be proved.                                                 |
| `islandAbundancePercent`: integer 0..100; 35                                     | Independent isolated-island budget inside owner quota and guard; zero removes this category. Nonzero realization needs unequal islands tied to actual margins, with protected water; no invented minimum count here.                                                                  |
| `archipelagoAbundancePercent`: integer 0..100; 25                                | Independent group budget, overlap counted once; zero removes groups. Nonzero groups need irregular size/spacing and channel survival. Counts alone do not prove realization or R5 avoidance.                                                                                          |
| `oceanConnectivity`: singleGlobal/connectedMajority/multipleBasins; singleGlobal | Preserve downstream water classification, connectivity and segmentation meanings. Separate caps do not prove ocean semantics or forbid multiple semantic basins within connected water. Missing topology evidence yields no proposal.                                                 |
| `polarCharacter`: oceanBiased/neutral/landBiased; neutral                        | Reserve finite post-bias land/water within all guards; keep unique poles. Same role dimensions in radians at poles; projected width gives no exemption. Non-neutral area/topology realization remains unverified.                                                                     |

## Visual contract cross-check

| Unchanged requirement               | Help from the proposed numbers; remaining human decision                                                                                                                                                               |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Positive 1: primary masses          | Predeclared roles and half-largest audit resist hiding equal owners. One-to-three ordinary visual count, arrangement and deterministic variation remain to be demonstrated.                                            |
| Positive 2: internal hierarchy      | Interior, two unequal lobes, peninsula and embayment receive explicit surviving dimensions/shares. Direction, curvature, distinct anatomy and readability are not proven.                                              |
| Positive 3: orientation/arrangement | Gap and guard clearance constrain contacts, not axes or diversity. Default seed cohort must show more than rotated repeated layouts.                                                                                   |
| Positive 4: water relationships     | Protected embayment opening/depth and island channels reserve water. Coherent ocean negative space, opposing margins and nonuniform channels remain visual/topological obligations.                                    |
| Positive 5: margin islands          | Independent budgets, containment and protected water prevent some occlusion. Unequal sizes, irregular groups and relation to realized ends/margins still need review; zero abundance is exempt only from its category. |
| Positive 6: half-size scale         | Angular floors target macro features at both sizes. Pole/projection effects and perceived hierarchy still require native and half-size decisions; overlays cannot repair missing anatomy.                              |
| R1 ribbon                           | Majority interior plus disk and root widths help; a large disk with a long repeatedly necked remainder may still fail.                                                                                                 |
| R2 rounded interchangeability       | Unequal lobe contributions and separate peninsula/bay roles help; repeated clovers can still meet the numbers and fail.                                                                                                |
| R3 geometric excavation             | Clearance prevents final guard contact; measured bays can still look like ellipse punches or a parallel inset of a cap.                                                                                                |
| R4 regular arrangement              | A 0.05-rad gap prevents contact, not uniform spacing/orientation/channels; cohort review remains decisive.                                                                                                             |
| R5 mechanical islands               | A correct area ledger does not prevent dotted necklaces, repeated triplets or unrelated satellites.                                                                                                                    |
| R6 cosmetic detail                  | Macro floors and half-size review limit reliance on tiny detail; additional marks cannot turn an existing failing silhouette into a pass.                                                                              |

## Decision and conditional next step

**Recommend adoption of this one target set for design investigation.** No specific logical
conflict with the existing requirements has been established; spatial realizability and visual
sufficiency remain open. The exact maintainer decision is whether to adopt the role/applicability
rules, numeric table, reserve ledger and conditional no-proposal policy as the next investigation's
requirements. **Adoption is ACCEPTED for design investigation:** after completion and review, the maintainer
explicitly instructed, “Adopt the proposed targets for the design investigation.” The same
instruction authorizes continuing v3 work with agents and local commits, without pushing.
This adopts the targets, role/applicability rules, reserve ledger and no-proposal policy as
investigation requirements; it does not establish constructibility or human visual acceptance. No accepted ADR changes here, including ADR-0029.

**Maintainer decision, 2026-09-06 — measurement on the sampled lattice.** After a human review
that rejected all nine `issue-184/comparison-r2` rows (recorded on
[issue 161](https://github.com/ChadHealey/ttrpg-map-generator/issues/161)), the maintainer
approved applying the targets in the table above as **measurements of the sampled production
partition** (accepted full profile, with preview counterparts) rather than as certificates of
authored continuous polygons before sampling. The numeric targets, role rules, reserve ledger,
gap/clearance obligations and no-proposal policy are unchanged. What changes is the object
measured: the largest inscribed geodesic disk, lobe and peninsula shares/widths, bay depth and
opening, and the inter-owner gap are computed on the sampled land/water partition and its
extracted coastline, so the checked geometry is the geometry the atlas shows. A candidate that
misses a floor is rejected within a fixed finite candidate budget; exhaustion is an explicit
no-proposal with the failing quantity. This is an investigation-contract change, not a target
change, and it does not select a family, amend ADR-0029 or accept any image.

This adoption permits a bounded construction/certificate **design** issue for this same
policy: specify deterministic witnesses, spherical placement with fixed quotas, area/topology and
contour certificates, finite budgets, ties and explicit failure diagnostics. It would not make a
comparison READY. Only a sufficiently justified later specification may support a draft comparison
using the exact six retained inputs (`normal-01`..`normal-04`, `connected-majority`,
`fragmented-islands`), analytic spherical geometry, continuous zero contours for every land term,
exact repeats, explicit coverage failures and human native/half-size decisions for every row.
No new issue is created by this package.

[C1 compatibility, C2 generation and C3 adoption/evidence](../issue-165/child-plan.md) remain
**NOT READY**. Production retains the 12-default/6-control cohort, 128-seed sweep and macOS/Linux
canonical equality. Accepted v1 and any user-accepted v2 data, IDs, constraints, locks, decoration,
edits and generator-free reopening remain unchanged; existing #162 compatibility is not repeated.
Later changed macro output needs truthful behavior/generator v3 and manifest provenance, without
unrelated record/package/sampling/quantization/classification/coastline/seed/context version changes.
The spike's private stream is not a production contract. #148 and #150 remain behind accepted v3
geography and inherited-context evidence; descendants retain accepted parent lineage. M3 overlays
and M4 detail cannot repair M2 anatomy. Delivering this recommendation completes the discovery
content without waiting for adoption; publication separately requires the dedicated review.
