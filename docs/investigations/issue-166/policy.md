# One evaluated policy: reserve hierarchy before envelope placement

**Disposition: unsupported specification.** The equations below expose missing certificates;
they are not a selected algorithm. The evaluated policy would assign immutable owner quotas,
reserve broad interior/lobe/peninsula/embayment and island space, then select separated spherical
cap placements that contain the complete construction with contour clearance. Calibration would
be permitted only inside a certified feature-preserving interval. Failure would return no proposal,
without moving quota to another owner or using a guard as replacement interior.

## Area ledger and feasibility obligation

Let μ be unit-sphere area divided by 4π. For each owner, define a broad interior B, ordered
secondary lobes L₁..Lₖ, a substantial peninsula P, and an embayment water set E. These must be
geometric sets, not summed ellipse-axis proxies. Let `U = B ∪ L₁ ∪ ... ∪ Lₖ ∪ P`. Allocate:

- Interior `b = μ(B)`.
- Each secondary contribution `lⱼ = μ(Lⱼ \ (B ∪ earlier L))`.
- Peninsula contribution `p = μ(P \ (B ∪ all L))`.
- Embayment subtraction `e = μ(E ∩ U)`, counted once even if it cuts multiple features.

The net broad area is `b + sum(lⱼ) + p − e`. These disjoint marginal contributions account for
overlap without double counting. Positive lobe/peninsula contribution alone says nothing about
attachment width; removing E must also preserve the interior and required attachments.

Let I be the union of isolated and grouped island supports and Z an explicitly designated polar
land reserve. The total land ledger is
`q = b + sum(lⱼ) + p − e + μ(I \ (U \ E)) + μ(Z \ ((U \ E) ∪ I))`.
Overlapping island/group members are counted only once. Protected embayment water must remain
disjoint from I and Z. A single pole point has zero area; any polar land reserve is a finite
spherical area. Negative polar bias likewise needs an accounted water subtraction. The inherited
±0.1 z² bias is a scalar modifier, not an independent additive area allowance. For non-neutral
polar controls these sets would have to describe the **modified** field, which is unproved.

Use angular clearance m > 0 and contain all permitted land in
`Kᵢ = cap(cᵢ, rᵢ − mᵢ)`, with `rᵢ > mᵢ` and
`rᵢ + rⱼ + 0.05 ≤ d(cᵢ,cⱼ)` for all pairs. If Wᵢ is the reserved water inside Kᵢ (including
protected embayment, island channels and any polar water), the necessary capacity condition is
`qᵢ ≤ μ(Kᵢ \ Wᵢ) ≤ (1 − cos(rᵢ − mᵢ))/2`.
All reserves live inside the owner's area budget. They are not extra land added after quotas.
Sums of all owner quotas still equal the requested global land fraction.

The containment and pairwise inequalities are sufficient for the analytic inter-owner gap;
the area inequality is only necessary for the **complete policy**. It would permit a measurable
subset of sufficient area while saying nothing about whether the prescribed connected shapes
fit. A realizable B/L/P/E layout, attachments, and contour certificate are additional obligations.
Also require island-floor ≤ quota, preview owner error ≤ 0.25/count percentage points, and
preview/full total coverage error ≤ 0.25 percentage points; do not use tolerance to redistribute
quotas. Analytic-area feasibility does not guarantee sampled tolerance.

The [normal-01 audit](capacity-audit.md) is the rejected case: even m = 0 and W empty fail for
the two retained primary caps. Any positive clearance or protected water makes it worse. No
successful construction is invented here. Moving centers might allow more capacity, but the
retained 24-candidate placement ranks separation plus jitter before considering size or quota;
it does not certify this new joint area-and-feature obligation.

No defensible numerical values for b, lⱼ, p, e, m, island/polar reserves, interior widths or
attachment widths can be recovered from the evidence. The existing core, three unequal lobes
and two cuts have dimensions, but no certified partition of area, distinguished substantial peninsula,
or protected embayment after calibration. Choosing arbitrary percentages would hide the principal
unknown. This is the failed allocation obligation, not a proposal that symbolic accounting alone
meets the issue's feature-budget requirement.

## Contour displacement and continuity

Write the inherited analytic owner field as
`Fᵢ(x,t) = min(max(Hᵢ(x) − t, Jᵢ(x)), Gᵢ(x))`, where H includes broad land, cuts and polar bias,
J is the maximum of every fixed island/group term including its polar bias, and G is the guard.
The world field is `max_i Fᵢ`. Dot products, chord ellipses, great-circle distance and finite
min/max compositions are continuous, including through zero, seam and poles. This establishes
continuity for the retained construction, not feature survival or a new implementation.
All future positive terms would have to remain inside that final guard; no separate island or
polar override may bypass it.

On a regular isolated broad contour, a displacement estimate `D ≤ |Δt|/k` would require a
positive lower bound k on scalar change per radian along certified transverse paths throughout
the entire calibration band. One must also exclude branch switches, critical levels and new
components, certify a tubular neighborhood, and handle any fixed island contour intersections.
An upper Lipschitz constant alone provides no such inverse bound. The scalar is not a signed
distance field, so four scalar units do not mean four radians.

A feature-survival certificate would need D less than guard clearance, less than half the
minimum attachment and channel widths, and less than the reserved lobe extent, peninsula length
and embayment depth, all in radians. Those are proposed conservative safety requirements, not
proven necessary or sufficient conditions for feature survival. Broad interior inradius and feature
separations would also need certified margins. Neither the retained receipts nor the formulas
provide k, the valid band, or those realized dimensions. Min/max branch junctions are precisely
where a smooth-contour argument cannot simply be assumed.

There is a concrete failure, not merely missing notation: at normal-01's selected −4-unit
offset the first two owner fields equal their guards and the original cuts disappear, as proved
in [the audit](capacity-audit.md). Fixed zero island contours prevent their own inflation but
do not prevent broad land from swallowing them or closing an embayment. Continuous fields and
numerical coverage alone cannot establish hierarchy or visual acceptance.

## Deterministic execution and controls: unsupported parts

Retained construction has at most eight owners, 24 candidates per added owner (at most 168),
four broad ellipses and two cuts per owner, and at most four isolated plus seven grouped island
terms per owner. Calibration has 24 steps per owner (at most 192). Placement retains the first
equal-scoring candidate; field ties prefer earlier owners, broad over islands, then earlier
islands; calibration chooses the high endpoint on equal error. These bound the old computation,
not a solver for the proposed geometric certificates.

A future specification would need stable owner and named subfeature identities before placement,
ordered candidates and deterministic certificate evaluation, and a finite bound on every
intersection/area/displacement check. Array indices and the private shared island stream are
not an approved production identity or reroll contract. No such bounded solver or production
scope mapping is justified by this evidence. The proposed policy's terminal rule is no proposal
on any absent certificate, infeasible quota, non-finite result, or exhausted declared operation
budget; another policy, quota transfer, reduced gap, or seed substitution is not a fallback.
For this investigation the absent certificates trigger **insufficiency**, not an implemented
runtime failure and not a claim that every seed must fail.

| Existing public control       | Required responsibility of this policy; evidence gap                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `worldCircumferenceKm`        | Translate angular feature dimensions to physical scale coherently. Inherited bounded sqrt scaling is not a certified budget/width law.                                                     |
| `targetWaterCoveragePercent`  | Set total land quota before placement; retain fixed tolerance and explicit infeasibility. No evidence that all supported targets can fit with hierarchy.                                   |
| `continentCountIntent`        | Preserve public 1..8 intent. Construction owners are not semantic continents; realization of one to three visually primary masses must be demonstrated, never achieved by clamping intent. |
| `continentDistribution`       | Allocate owner area relationships before placement. Squared sizes are a retained hypothesis, not proof of balanced/varied/one-dominant morphology after construction.                      |
| `fragmentationPercent`        | Budget cuts and attachments without destroying broad interiors. Existing cut widths do not establish survival or meaningful progression.                                                   |
| `islandAbundancePercent`      | Reserve unequal isolated islands related to realized margins; zero removes this category. Count alone does not certify area, detachment or relationships.                                  |
| `archipelagoAbundancePercent` | Reserve irregular groups and their water gaps; zero removes groups. Shared-stream coupling and merged/vanished terms leave identity and abundance realization unsupported.                 |
| `oceanConnectivity`           | Preserve downstream classification responsibility and intended connected-water behavior. Cap separation and a row name do not certify global ocean topology.                               |
| `polarCharacter`              | Account for finite polar land/water effects inside all guards, preserving unique pole identity. ±0.1 z² does not specify area reserves or surviving features.                              |

No public semantics change. This audit establishes failure of one retained input allocation and
missing obligations for this envelope policy; it certifies no seed or control range as successful.

## Unchanged visual contract cross-check

The [visual contract](../issue-164/visual-contract.md) remains the later human gate. Its six
positive requirements are not proved here: primary-count realization, readable internal
hierarchy, seed-driven orientation/arrangement, coherent water relationships, margin islands,
and persistence of those observations at half size all remain unverified for this policy.

| Rejection class               | What the evaluated policy would need; why area alone cannot rule it out                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| R1 ribbon                     | Interior and neck-width certificates; equal area can be a thin chain.                                                                    |
| R2 rounded interchangeability | Distinct surviving internal anatomy; quotas do not distinguish outline grammar.                                                          |
| R3 geometric excavation       | Integrated embayments and margins clear of guards; cap filling demonstrably erases the existing anatomy.                                 |
| R4 regular arrangement        | Varied spacing, facing margins and water openings across default seeds; feasible pairwise gaps do not establish diversity.               |
| R5 mechanical islands         | Unequal irregular groups attached to particular realized margins; area reservations do not establish placement or visible relationships. |
| R6 cosmetic detail            | Macro features remain readable at half size; more terms or pixels cannot substitute for a feature certificate and human review.          |

All are unresolved requirements, not newly passed rows. The insufficiency decision and the
smallest conditional next decision are recorded in [README.md](README.md); no second policy was tried.
