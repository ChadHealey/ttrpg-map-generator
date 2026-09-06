# Issue 187 independent literal design review

**Clear the first literal state for the bounded local experiment.** I found no analytic or
indexing contradiction that requires redesign before execution. This is design readiness,
not a numeric certificate, rendered proof, whole-domain geometry guarantee or human acceptance.
No geometry constructor, sampler, certificate or image renderer was executed in this review.
The checks below use the declared formulas and read-only inspection of the frozen source.

## Index and partition agreement

The actual `sampleCoast` emits `steps` vertices per cyclic anchor interval and emits the exact
anchor at j=0. Thus 29 anchors with steps=3 yield 87 vertices, anchor i at sample 3i, with no
closing duplicate. Its tension=.12 lies inside the existing bounded sampler contract.

The first lobe is anchors 6→11 with far anchors 7 and 10; the second is anchors 22→27 with
far anchors 23 and 25; the peninsula is anchors 13→20 with far anchors 15 and 18. All role
intervals are mutually disjoint, every far endpoint is strictly within its role's coast path,
and no far pair is a consecutive coast edge. The bay interval samples 0→12 (anchors 0→4)
shares no role vertex. Partitioning removes only role-arc interior vertices from B and inserts
actual root chords. Frozen178 must still prove geometry, root adjacency, full first disks and
C/D separation; interval arithmetic does not prove those obligations.

Reversing only the CCW mother coast's derived pocket gives its closing edge the directed mouth
a→b while keeping the declared shoulders unchanged. This is consistent with the existing bay
interface. Do not reverse the mother coast to repair an orientation failure or reorder the root
indices after sampling. The certificate's explicit wedge mode must not fall back to radial mode.

All six declared site indices are valid mother-coast edge indices. Site 79 lies on a role's
exposed coast, which is still actual mother coast; it need not lie on B's residual boundary.
Sites 81–83 border the transition back to B. Their declaration establishes stable edge identity
only. With islands=[] this experiment proves no site clearance, detached-area payment or future
island feasibility. No site should be executed here to turn that unproved obligation into scope.

## Whole displacement-box shoulder checks

Write u=g*u0 and v=g*v0. Because each g is in (0,1], all four variation domains lie inside
u,v∈[-1,1]. The declared moving shoulders and their exterior tangent directions are

- a=(.49,-.22+.008v), b=(.60+.012u,-.005);
- va=anchor28-anchor1=(.17,-.15+.002v);
- vb=anchor5-anchor3=(.36+.012u,.18).

Then det(a,b)=.12955+.00264u−.0048v−.000096uv. Its box extrema occur at corners and give
[.122206,.137086], strictly positive. The active-face tangent determinants are
`det(a,va)=-.03610-.00038v` and `det(vb,b)=-.10980-.00222u`, also strictly negative over
this whole box. These checks preserve mouth orientation and initial radial exclusion under
all declared affine perturbations, not merely the center anatomy.

The credited geometry is sampled, so initial tangents alone would be insufficient. The actual
incident sampled chord at a goes to sample86 on anchor28→a; the one at b goes to sample13 on
b→anchor5. Direct substitution of t=2/3 and t=1/3 into the existing cubic sampler gives

- sample86−a = (7/27)(anchor28−a) + (2/75)(a−anchor27) + (4/75)va;
- sample13−b = (7/27)(anchor5−b) + (4/75)vb − (2/75)(anchor6−b).

Their excluding determinants reduce respectively to approximately
`-.0088568889-.0000617481v` and `-.0314593333-.0006358815u`. Even the least negative
box values are below -.0087 and -.0308 respectively. Thus each actual incident segment remains
strictly outside one active radial face away from its exact shoulder. These are algebraic
real-arithmetic bounds, with comfortable margins for this design check; they are not a new
interval-certified replacement for the frozen EPS predicates.

No conclusion follows about the rest of the sampled ring from those two segment checks. Other
positive edges, the bay pocket/witness, all role polygons, topology, chart cap and distances
remain frozen178 obligations on each actual fitted case. The supplied witness formulas are
fixed before sampling/fitting and do not permit a post-failure witness search.

## Fit, scope and evidence

The three quota expressions are the retained paid body fractions, including the declared
.9905/.984 factors. With islands=[] they are the entire local candidate quota, not an unpaid
whole-owner quota and not a claim of detached payment. Compute the raw stitched body's area,
require the declared positive orientation, then use the exact specified single scale
sqrt(4*pi*quota/rawBodyArea) on every geometric point and witness. Retain the exact original
quota value and pass it to the certificate; do not reconstruct it from the fitted area or
reassociate its arithmetic on replay. Field coordinates, quota fractions and spherical area
must stay distinct. Frozen checks still reject overlaps or a failed area ledger.

The broadened lower lobe can consume too much B area, and the cap can change the role distance
bounds. Those are explicit hypotheses for the 60-case test, not analytic contradictions found
here. Original-root peninsula extent and validated root/far collar width remain unchanged in
meaning. No closest-chain distance may be substituted as the width upper witness.

The matrix is exactly three quotas × five anatomies × four variations. The four center-anatomy
variants intentionally coincide geometrically; this is 60 declared cases, not 60 distinct
shapes or a proof for every interior anatomy value. Subsequent arbitrary anatomy or detached
owner use would still require its own actual certificate and separately scoped evidence.

The native/half panel must show all three center-anatomy variation0 paid sizes using one recorded
chart scale and plain palette. Declare pixel dimensions and any additional fixed-case thumbnail
inventory before capture; do not introduce tuned shapes through diagnostics. Numeric failure
receipts are retained and remain visible even if no visual success can be claimed.

The source-bound guard must reject unknown/coherently rehashed sources before executing them;
copying the historical writer alone is not that guarantee. The issue already explicitly requires
this guard, full receipts, deterministic repeats and replay. One first state and at most one
independently reviewed second state are appropriately bounded. No world, 134-input sweep,
B/C/Large construction or island placement is needed to decide this local hypothesis.

## Decision

The proposed issue is executable after this design checkpoint. Proceed to the literal local
constructor and frozen60-case first state; let actual certificates and independently inspected
native/half silhouettes determine the outcome. Preserve any failure rather than adjusting targets,
roles or witnesses after fitting. Only a local proof of concept can result; whole-family behavior,
production realization, controls, platform equality, accepted ADR and human decisions remain open.
