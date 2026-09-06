# Preliminary displacement and preservation ledger

This ledger is frozen before checkpoint sampling. It distinguishes real-arithmetic facts,
conditional bounds and unproved obligations. It does not silently turn binary64 predicates
or sampled proximity into interval certificates.

## Normalization and the local inverse bound

Clamping a finite scalar to [-1,1] preserves its sign and exact zero set. It is 1-Lipschitz
as a scalar function, but constant saturation regions have no positive lower derivative.
The public quantizer has field-value error at most 1/(2Q), Q=2^24. H adds a positive
1/(2Q) contour level in the quantized field. Z adds no contour-level bias, but rejects every
zero anchor and exact alternating saddle tie before extraction.

For one owner write alpha for its certified maximum angular coast radius, r for its guard
radius, and beta=.01 radians. Let c=cos((alpha+beta)/2). Inside that chart cap, the LAEA map's
singular values are bounded by c and 1/c. The cap and image disk must be convex for the
shortest-path comparison; alpha+beta<pi/2 is a sufficient condition retained explicitly.
The signed distance to a disjoint polygon union is 1-Lipschitz in the chart. For a point
within spherical beta of its actual coast, the two metrics give c*d<=abs(h)<=d/c.

To identify the field F with h in this band, require beta/c<.02 and
r-alpha-beta>beta/c. The first keeps negative extension clipping inactive; the second
keeps the guard minimum inactive. Other owners cannot win when their guard candidates
are more negative than -beta/c. A sufficient test uses the retained minimum guard gap g:
for every other owner its guard is at most -(r-alpha)-g+beta, which must be less than
-beta/c. These are explicit per-owner conditions, not inferred from sampled values.
If they hold, the union's winning field equals h on this band's two sides and the clamp
is inactive. The real-arithmetic inverse bound is d<=abs(F)/c on that band.

These metric/guard facts do not establish a certified binary64 error radius for forward
Lambert evaluation, distance-to-segment predicates, acos/dot or trigonometric coordinates.
That arithmetic residual is unresolved. It is not assigned zero because repeat tests pass.

## Upper field variation and cell interpolation

A global upper Lipschitz bound can survive clipping, unlike an inverse bound. In each
owner's evaluation cap of radius r+.02, LAEA has upper metric factor
L_i=sec((r+.02)/2), when r+.02<pi. Signed distance, its constant clipping and the guard
minimum have upper bound max(L_i,1). At the outer cap boundary the guard is exactly -.02
and the clipped chart term is at least -.02, so the inside minimum equals the outside
guard continuation. Their continuous join has the same upper bound along sphere paths.
Taking the maximum over owners and then clamping retains L=max_i L_i. This is a
real-arithmetic upper variation result; it supplies no global inverse bound.

Use the conservative latitude-plus-longitude path diameter
Delta=pi/latitudeBandCount+2*pi/longitudeCellCount: approximately .02454 radians at preview
and .00614 at full. For coordinate-affine interpolation in a nonpolar cell, any unrounded
raw segment point is a convex combination of its two edge crossings, hence a convex
combination of the same cell's sample corners. The weighted quantized values equal the
chosen contour level. If the point/corner sphere distances are bounded by Delta, the
scalar residual is bounded by L*Delta+1/(2Q)+bias. Coordinate rounding then adds its own
L-scaled displacement allowance. A raw-to-original angular estimate obtained by dividing
this scalar residual by c is applicable only after showing the entire compared locus lies
in the preceding inverse band's domain. It does not prove that every original feature
has a sampled counterpart. Pole-fan coordinate singularities and the accepted interpretation
of ring segments need explicit treatment; a planar-cell formula is not automatically a
sphere-wide Hausdorff theorem.

The ledger records these conditional numerical quantities for each profile and owner.
A value outside beta fails the proposed local transfer bound; it does not justify a larger
undeclared band or threshold. Even a value inside beta is labelled conditional because
binary64 residuals, pole interpretation and complete correspondence are not proved here.
The preview diameter alone is greater than beta, so that crude estimate cannot establish
the preview role obligations.

## Coordinate rounding and simplification

The released interpolation rounds a rational DISPLACEMENT ties away from zero, then adds
the integer start coordinate. For start=-2,end=-1 and signs=-1/+1, the result is -1 rather
than roundAway(-1.5)=-2. The private zero helper preserves that exact expression. Each
coordinate error is still at most half a coordinate tick relative to the exact rational
interpolant. A conservative longitude-plus-latitude angular allowance is 2*pi/2^32.

The fixed simplification tolerance is 524288 coordinate ticks, or about .000767 radians
in a single equatorial coordinate. The public algorithm removes only nonadjacent candidates,
guards ring intersections and accepted sample anchors, and bounds each replacement to two
raw edges. This does not itself prove a symmetric spherical Hausdorff allowance, cross-ring
role correspondence or area/collar preservation. Raw and simplified rings are measured
separately and linked to the same external predecessor and source-anchor component key.
No simplification tolerance is subtracted from a role floor without the missing transfer proof.

## Exact stopping claim

The raw source-anchor graph and immutable predecessor association establish a transient
sampled-component correspondence. They do not locate the original internal role cuts on an
extracted boundary. Body/lobe area, first disks, collar separating widths, peninsula extent
and bay opening/depth are therefore not certified on the extracted geometry. Both policies'
complete proposal gates remain closed for `extracted-role-certification-unproved` even if
coverage, raw topology and guarded simplification pass. This is the specific bounded conflict,
not proof that either policy can never be made viable.

The smallest successor needs a conservative original-role to extracted-boundary correspondence
and stability theorem, including domain/pole and numerical error treatment. It may use the
retained output to formulate that contract but cannot select new roots, rename surviving
pieces, lower adopted targets, enlarge the fixed corpus or implement a new topology system
under this discovery. No human geometry or production family is selected.

## Stronger source-level inverse and crossing argument

The stricter inactive-guard band above is sufficient but unnecessary for a one-sided
scalar-to-coast estimate. Let c_i=cos((r_i+.02)/2), on an owner's convex evaluation cap.
Every owner polygon lies inside its guard cap. Inside a polygon, distance g to the cap
boundary is at least distance d to the polygon coast; h>=c_i*d. Thus min(h,g)>=c_i*d
even when the guard is active. Outside a polygon, if the owner's field lies strictly
between -.02 and zero then clipping is inactive, h<0, and its magnitude is
max(abs(h),(-g)+). This is at least abs(h)>=c_i*d; outside-cap distance is no greater
than distance to the contained polygon. A winning value with abs(F)<.02 cannot come
from an owner's outside-extension branch, whose value is <=-.02. For a negative union
value, the winning owner's coast supplies a point on the union boundary at distance
at most abs(F)/c_i. For a positive union value, disjoint certified guards identify the
unique positive owner. This gives dist(point, original coast)<=L*abs(F) for small
field magnitude, where L=max_i(1/c_i). It requires convex evaluation caps and the
certified whole-polygon containment; it does not claim an unclipped global inverse.
This same disjoint-positive-guard argument justifies source-anchor owner attribution.

There is a simpler raw-to-original crossing bound than the affine scalar residual.
For admitted Z, every emitted cell has a genuine positive/negative field edge, so
continuity gives an actual zero on that edge. H also has that edge unless its water
corner has tick zero with a small positive original value. In that case the corner
has 0<F<1/(2Q) and the preceding inverse argument places actual coast within L/(2Q)
of that corner. Every coordinate-affine raw segment point lies within its rectangular
cell or polar triangle's coordinate bounds. A latitude-plus-longitude path to that
edge point or corner is at most Delta; the pole fan admits the same conservative
bound with its pole longitude alias. Add the half-coordinate rounding allowance.
Therefore the ideal coordinate-affine raw-to-original bound is
Delta + (H ? L/(2Q) : 0) + 2*pi/2^32. For a shortest-geodesic interpretation of raw
segments, the elementary endpoint/triangle-inequality alternative is 2*Delta plus
the same corrections. Both interpretations are reported explicitly. This proves
neither the reverse original-to-raw direction nor absence of subcell components.

The simplifier's actual createCandidate additionally requires projection strictly
inside the replacement segment. Each removed vertex has perpendicular distance
<=524288 ticks and adjacent removal is blocked. The replacement of the two raw
coordinate-linear edges therefore has a symmetric unwrapped-coordinate distance
bound of that tolerance; converting Euclidean to longitude-plus-latitude distance
gives sqrt(2)*524288*2*pi/2^32, approximately .001084688 radians. The diagnostic also
measures the actual removed-vertex distances to their exact predecessor chord and
checks that at most one consecutive vertex was removed. This is a coordinate-affine
bound, not a proof that the original field's internal roles map to the output.

## Comparison with the fixed checkpoint's actual margins

These preliminary arithmetic values read only existing certified receipts, before
sampling any checkpoint field. They use H, whose negligible positive bias is the
larger of the two policies. No new geometry or source certificate was generated.
The coordinate-affine raw bound is approximately .024543727 at preview and .006135958
at full. With generic guarded simplification it is approximately .025628415 and
.007220646 respectively. The preview bound exceeds D=.01 for every row; full's
one-sided bound is below D but does not supply two-way role correspondence.

| Row                | Global upper L | Smallest original role disk slack | Smallest peninsula width-upper slack |
| ------------------ | -------------: | --------------------------------: | -----------------------------------: |
| normal-01          |    1.163284340 |                        .032158557 |                           .008240834 |
| normal-02          |    1.123204964 |                        .012307885 |                           .026894007 |
| normal-03          |    1.128120676 |                        .012242029 |                           .027626723 |
| normal-04          |    1.124347186 |                        .012314145 |                           .026647440 |
| connected-majority |    1.076810117 |                        .001417983 |                           .058512179 |
| fragmented-islands |    1.105144079 |                        .005249065 |                           .046349999 |

Even hypothetically granting the missing two-way role-boundary correspondence,
perturbing two chains by delta permits a width increase of 2*delta. At full resolution,
normal-01's .008240834 width headroom is smaller than about .014441295; both of its
peninsulas fail this conservative upper-width transfer. The balanced control's
.001417983 disk headroom and fragmented control's .005249065 headroom are smaller
than full's approximately .007220646 generic displacement. These are explicit
failures of this proposed conservative certification route, not measurements that
those extracted disks or widths actually violate their targets. The emitted ledgers
retain all per-owner slacks and conditional perturbation values rather than selecting
only favorable features. Bay and area slacks are recorded without an invented simple
transfer rule for moving cuts, changing opening direction or role membership.

This establishes a concrete insufficiency beyond the absence of an implementation:
preview's coarse bound misses D, and some tight full-profile feature margins cannot
absorb even the hypothetical generic transfer bound. Actual measured predecessor
and fixed-witness diagnostics may be smaller, but those samples cannot replace the
missing complete two-way correspondence and binary64 stability contract.

For H's specific small-positive-corner case, an even narrower guard argument suffices:
the positive original field point lies inside one positive polygon, and convexity of the chart image
puts that point within the polygon vertices' certified maximum angular radius alpha. Its
guard value is at least r-alpha=.05, well above a half quantum. Hence tiny positive F
cannot result from the guard; h=F and the nearest original coast is within q/(2*c), using
c=cos(alpha/2). The recorded L is a conservative larger factor. Per-owner ledger fields
check convex evaluation caps, the retained containment margin and the half-quantum guard
comparison. Continuity and metric statements are real-arithmetic properties of the frozen
formula; binary64 evaluation does not gain an interval certificate from this argument.
