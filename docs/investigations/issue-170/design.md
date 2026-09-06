# Issue 170 — curved anatomy and bounded placement repair

**Reviewed design; the resulting local candidate is rejected before a full world comparison.** This successor addresses
[issue 169's retained r2 comparison](../issue-169/comparison-r2/results.json): certified but
repeated angular shields, T-shaped extensions, geometric bays and island rings, plus exhaustion
for six equal caps. The [adopted issue-167 targets](../issue-167/README.md), separated spherical
envelopes, quota ownership, fixed-zero field and human visual gate remain unchanged. This is
investigation-only; a failed successor remains visible and cannot be selected as production v3.

## Authoritative coast construction

Construct finite polygon samples of cubic Bézier coast chains **within each role**, before
stitching, calculating area and fitting the owner quota. These sampled polygons are the geometry;
there is no renderer smoothing or modification of the stitched body behind the role ledger.
Keep each shared root edge exact, retain the two straight collar coast sides, and use identical
sampled bay-coast points in B and E in opposite order. Reuse issue 169's chart, topology, feature
certificates and fixed-zero evaluator without changing their target predicates.

For a root `[a,b]` with outward unit normal n and collar height h, the incoming B coast approaches
a with tangent n and the outgoing B coast leaves b with tangent `-n`. For example, the neighboring
B Bézier handles are `a-εn` and `b-εn`. The exposed collar sides run from a to `a+hn` and from
`b+hn` back to b. Head-curve controls start parallel to n at their far ends, then widen gradually
and asymmetrically before tapering into an off-axis tip. Preserve the actual collar edges and
the first-disk witness; smooth blending must not hide a second attachment or a narrower crosscut.

Head coordinates retain the affine form `m+wαt+(h+Hβ)n`, with `m=(a+b)/2`. Sample each cubic
at a fixed number of rational parameter values. All resulting α/β coefficients are fixed before
H is solved, so sampled head area remains `wHC`. Together with collar area wh, the direct solve
is still `H=(A-wh)/(wC)`; reject nonpositive H. This permits curved gradual widening without the
former jump to a wide head immediately beyond its root. No nonbase head vertex may enter the
collar. The peninsula initially uses chart root width near .135 and extent near .36–.40 after
normalization, but only the measured angular bounds determine acceptance.

The initial local construction used `B=.645Q`, `L1=.183Q`, `L2=.119Q`, `P=.053Q`.
The authorized single targeted local repair froze `B=.727Q`, `L1=.135Q`, `L2=.085Q`, `P=.053Q`:
its lobe sum `.22Q`, ratio `27/17` and peninsula share remain above the adopted minima.
These are candidate construction shares, not new product targets. Compute Q from the
actual surviving B polygon area, solve the two heads and peninsula from their assigned areas,
then fit the complete owner union to its unchanged quota. The bay is cut and islands reserved
before this normalization. Changes to curve controls therefore cannot escape the exact-area ledger.

The bay mouth remains on an exact chart radial ray. Replace its angular or rectangular coastal
chain with unequal curved shoulders and an asymmetric pocket; the mapped mouth remains the
required geodesic. Recheck removed area, witness depth, opening and every positive-term exclusion.
Subordinates receive deliberately asymmetric coast chains with a broad interior, rather than a
single near-circular polygon. Island shapes remain unequal and detached, but their candidate sites
are concentrated into a few declared free margin pockets with irregular spacing; a ring of sites
around the whole owner is not the construction recipe. Actual polygon contact checks still decide.

Freeze at least three explicit macro layouts with genuinely different socket positions or feature
arrangements, plus bounded curve-coefficient variations. Use seed- and owner-scoped streams to
choose the initial layout and candidate order before certification; an always-first passing shape
cannot stand in for seed variation. Reflection or world orientation alone is insufficient. Keep
all nine control inputs and inherited squared-size quotas. Local candidates remain bounded by 16
per owner, eight owners, 11 island polygons and 256 unique geometry vertices per owner. A working
allocation of about 70 B vertices, 60 head vertices, 12 bay vertices and 77 island vertices totals
219 before shared-point deductions; freeze actual sampling counts with the implementation.

## Revised finite placement

Retain the actual certified radii and `g=.05`; never shrink a cap, transfer quota, change owner
count or change seed to make placement work. Order owners by descending radius, then stable ID.
Try at most 64 complete attempts and 128 candidate directions per owner per attempt, as before.
The default candidates are independent seeded uniform sphere directions. A failed owner ends
that attempt; no backtracking or unbounded retry occurs.

Add one declared spherical-code direction as the first candidate for each owner on attempt 1
(zero-based); for six owners also use it on attempt 0. The codes for owner counts 1–8 are one
point, antipodes, an equatorial triangle, tetrahedron, triangular bipyramid, octahedron,
pentagonal bipyramid and cube. For five owners, allocate the triangular equator before poles;
for seven, allocate poles before the pentagonal equator, whose adjacent spacing is only 72°.
These are fixed candidate orders, not optimal mixed-radius packing claims. Apply one deterministic seed/attempt rotation
to the entire code. Every proposed center still passes the ordinary all-placed-pairs predicate;
these are candidate directions, not exceptions to geometry or assertions that every code fits.

For six equal radii `.753263404553327`, the octahedral candidate has minimum center separation
`π/2`, above the required `2r+.05=1.556526809106654`. Thus its initial placement is available
without relying on a lucky random search. This does not prove the corresponding image's visual
arrangement is acceptable; the [packing audit](../issue-169/packing-audit.md) explains its limited
spacing freedom.

After the first complete feasible placement, run exactly 64 sweeps over owners in the same stable
order. Each owner proposes one geodesic displacement in an independently seeded tangent direction;
step lengths cycle `.08,.04,.015,.005` radians by sweep. Accept the proposal only if every pair
remains separated by at least its required radius sum plus gap and `1e-12` rad numeric slack.
Use that same explicit slack for initial candidates and the final pair certificate.
Otherwise retain that center. This is bounded refinement of a feasible arrangement, not a solver
that publishes overlapping intermediate states. It introduces asymmetric spacing where room exists,
while ordinary random starts preserve more arrangement diversity than rotating one regular code.
Derive each owner's final tangent frame from its final center and separate orientation stream.

The initial candidate budget is at most `64*8*128=65,536`; refinement adds at most `64*8=512`
proposals once, for at most 66,048 center evaluations. Pair checks use at most seven previously
placed/other owners per proposal, plus bounded input and final all-pair checks. Record initial
attempt, candidate count, refinement proposals/acceptances, seed scopes and final minimum gap.
Perform a final explicit all-pair certificate before returning independently owned copies in stable-ID order.
Pair-capacity rejection and exhausted search remain distinct; neither diagnostic edits inputs.

## Verification and stop conditions

First independently review this design, then implement only issue-owned modules. Focused tests
must confirm actual seed/owner shape differences, exact role partitions after curves, protected
bay/root geometry, detached islands, cap containment, repeatable placements, the six-equal-radius
case, nonrotation spacing variation, finite counts, and rejection without owner/quota mutation.
All six retained inputs must pass complete local certificates before a full comparison. Freeze
sources and the finite template/placement settings before rendering; retain failures and source text.

Use the unchanged six inputs, preview/full/half resolutions, sampled tolerances, repeat bytes,
seam/pole checks and native/half visual review. Assistant review may reject or provisionally
recommend; it cannot supply the pending human decision. The issue permits one implementation/
review pass and at most one targeted revised comparison. A changed target/support policy,
production dependency, third comparison or repeated failure pattern requires a bounded successor.

## Independent design review

The root agent independently reviewed the design before implementation. It identified the
incorrect blanket equator-first separation claim for pentagonal bipyramids and requested an
explicit numeric gap slack. This revision uses the fixed orders above and `1e-12` rad throughout.
With those clarifications the reviewer passed the design gate. No adopted geometry target changed;
this is an implementation-design review, not human visual acceptance.

## Final local repair disposition

The [local findings](local-findings.md) and [hashed evidence](local-diagnostics/manifest.json)
retain both local stages and the explicit **rejection**. The repair narrowed lobe sockets, changed
crown/tip controls, moved the radial mouth to chart x `.25..45`, changed the protected curved
pocket/witness, softened B shoulder approaches and widened its lower coast. It kept direct sampled
area fitting and all issue-169 certificate predicates. The frozen finite table has three structural
layouts and four peninsula variants per layout, hence at most 12 local candidates per owner.

Independent island/archipelago owner-area shares are `.02 × abundance/100` and
`.01 × abundance/100`, with the inherited finite counts and zero-category removal. Cubic heads
use four segments with five fixed subdivisions each; B uses the explicit five/eight-point chains
and shared four/five-point bay chains; subordinates use seven six-subdivision chains; islands
use nine vertices each. The observed high-abundance constructions remain within the 256-vertex
and 11-island bounds. All geometry and water contributions precede the same quota normalization.

All six inputs have local certificate successes, but only two structural layouts survive in the
ordinary rows. Every balanced six-owner guard has radius `.8617531779512562`, beyond the necessary
equal-cap ceiling `(π/2−.05)/2`. Assistant local inspection still rejects the tab-like anatomy.
The intended three-layout and packing conditions remain failed acceptance criteria; diagnostic
tests record those failures without waiving the thresholds. No full world comparison, human
approval, sampled world guarantee or production v3 selection followed.
