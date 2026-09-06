# Issue 165 — pre-result experiment contract

Revision `issue-165-r1`; fixed before rendering or inspecting this revision. This is a local,
reviewable experiment specification, not publication or a production field contract.

## Hypothesis and fixed policy

Test whether replacing one global contour with explicit per-owner area quotas preserves the
existing hierarchy. Exactly two continuations use issue-164-r2's unchanged placement, sites,
waves, lobe/cut dimensions, island positions and finite construction budgets. No seed search.
For each owner, let weight = squared baseline template `size`; normalize the weights to sum to
one and multiply by requested global land fraction. These are quotas of the entire sphere,
not semantic continent counts. Balanced owners have equal quotas; varied/oneDominant retain
the baseline seeded hierarchy. No redistribution when a quota is infeasible.

Envelope broad terms retain the core, three unequal lobes and two margin cuts. Cellular broad
terms retain four biased sites, independently warped scores and eight water competitors; its
hierarchy is the existing site/bias recipe. This deliberately tests budgeting, not an additional
shape-design policy. Family-specific score units remain different. Both apply independent
24-step integer contour searches in [-4, 4] at 1,000,000 ticks/unit. Before calibration every
owner contour is zero. Islands retain zero contours, so broad-area growth cannot inflate their
support. Polar bias applies to the broad and island terms, inside the final guard.

For continuous ellipses use the tangent chord coordinates with axes sin(major), sin(minor),
then intersect with the center-facing cap at cos(max(major, minor)). This is an explicit
continuity repair of the baseline log-map/sentinel and stepped island fields. The intersection
is a continuous min, not a hard rejection. It may change initial silhouettes; report before/after
measurements so any improvement is not attributed exclusively to calibration.

The final scalar is max over owners of min(max(broad - owner contour, signed islands) + polar,
owner guard). Envelope guard is radius minus great-circle distance. Cellular guard is
(score_i - max_other_score - 1.86 * 0.05 - 0.000002)/(2 * 1.86), capped at 4 for a sole owner.
Positive land requires positive guard for every term. Calibration never moves the guard's zero.
Analytic scalars are continuous; final Int32 ticks have ordinary quantization steps of at most
one tick. Continuous contour claims refer to the pre-quantized field, not integer continuity.

Coverage tolerance is 0.25 percentage points on both 400-by-200 preview and 1600-by-800 full
samples. Each owner must also meet 0.25/count percentage points of whole-sphere area on preview.
Infeasible quota, floor from retained islands, missed tolerance, or non-finite field disqualifies
the realization. Still retain its best bounded diagnostic image; never call a failed image an
accepted proposal. No fallback or quota redistribution. 24 placement proposals per added owner,
four broad sites/lobes, two envelope cuts, three cellular waves, eight water sites, and at most
four isolated plus seven grouped satellites per owner are inherited finite budgets.

## Fixed inputs and repeats

Read the six exact inputs and all nine controls from issue-164/comparison/results.json, checking
that both baseline families agree. Compare normal-01..04, connected-majority, fragmented-islands.
Run each new pair twice in full; compare scalar/owner bytes, masks, both PNG sizes and all
measurements. Encode scalar Int32 and owner Int8 in big-endian explicit row order. Hash sources,
inputs, measurement definitions and baseline receipt. Record runtime separately from deterministic
results. No production imports or dependency changes.

## Measurements applied identically to old and new

Initial contour is zero. Final baseline contour is its unchanged r2 calibration; final new
contours follow the policy above. Baseline never had area quotas: report its squared-size shares
as an **inferred comparison proxy**, not retroactively asserted intent. New quotas are explicit.

Visit y north-to-south, x west-to-east; no duplicate seam vertex, one evaluation per pole, repeated
only in the display/grid array. Area uses cos(latitude) row weights; poles have zero area. Component
traversal is four-neighbor, seam wrapped, with connected pole aliases; descending weighted area,
first traversal index breaks ties. Report each owner and every component's whole-sphere and
land-relative shares, total water, signed coverage error and before/after changes. Owners are
transient construction identities and can have multiple components.

Coastline is the set of land/water grid edges, visiting east then south once per grid vertex.
Locate a crossing with 16 fixed bisections of the retained predicate on its great-circle arc.
Weight east-neighbor crossings by dLatitude and south-neighbor crossings by
cos(midLatitude)*dLongitude (dual-grid arc-length approximation). Exclude zero-area pole alias
edges. The denominator is total such estimated coastline length, including islands, at preview
resolution. Tolerance delta = 0.02 rad from the crossing to the original support/ownership guard.
Envelope clearance is exact radius-distance. Cellular slack/(2L) is a certified lower distance
bound, not an exact distance: exclude contacts whose lower bound exceeds delta; otherwise probe
32 evenly spaced tangent directions at delta. A nonpositive guard proves a contact within delta;
unresolved cases are reported separately. Report confirmed fraction and conservative upper
fraction including unresolved cases, never equate all near-score points with proven contact.
This is a resolution-sensitive diagnostic, not a production coastline-length claim.

Islands: independently set each abundance to 0 and 100 with normal-01's seed and other controls
fixed. Record constructed isolated/group members; retained winning-island samples; whether each
satellite vanished, merged into its owner's largest realized component, or remained detached.
Record center-to-nearest realized principal-component coastline angular distance, and count
centers within 0.2 rad. This is an explicit relationship diagnostic, not a guarantee that every
satellite is aesthetically related. Overlapped/occluded satellite terms with no winning retained
sample are called vanished at this resolution. Broad and satellite ties prefer broad, then lower
satellite index. Probe previews only; they do not add full-image comparison rows.

## Geometry, visual and adoption gates

Triangle inequality gives the envelope gap; the score-difference 2L Lipschitz bound gives the
cellular gap. min with the guard covers broad, island, group and positive polar terms. Test near-gap
points as corroboration, not proof. Force owner zero to north/south poles in focused fixtures,
rebuilding its local shapes/sites and separation radii, test unique pole identity, seam-crossing
land and exact nested anchors. Probe support, ownership, island and selected contour limits.

Retain twelve unlabelled 1600-by-800 PNGs and twelve fixed 800-by-400 nearest-anchor reads. Human
pass/fail and rationale required for every row against issue-164 visual contract version 1.
Assess the four defaults separately from controls; record visually primary masses, internal
hierarchy, positive observations and rejection codes. Assistant observations are provisional.
Select only with four default passes, interpretable controls and all numeric gates; otherwise
no selection. C1–C3 remain NOT READY until a selection and separately bounded specification.
Accepted v1/v2, generator-free reopen, version-3 consequences, compatibility and M3 boundaries
remain as in issue-164's proposal. Local repeats do not prove macOS/Linux equality.
