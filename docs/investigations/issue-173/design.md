# Issue 173: a sufficient nonradial bay mouth

This design keeps the [adopted targets](../issue-167/README.md), positive LAEA polygon
accounting, [general collars](../issue-171/design.md), and zero experimental contour
unchanged. It proposes one restrictive, finite class for a private successor: a bay
whose entire positive geometry is supported by its planar mouth chord on the chart
origin side. Its actual opening is the shortest spherical geodesic between shoulders.
This buys nonradial mouth freedom without a general curved-edge intersection solver.
It does not establish a cause of the [issue 172](../issue-172/README.md) visual rejection
or promise a visual improvement.

## Coordinates and ordered area

Let `N=(0,0,1)` be the chart pole, `p(u)` the existing inverse LAEA map, and

```text
s(u) = sqrt(1 - |u|²/4)
p(u) = (s(u)*ux, s(u)*uy, 1 - |u|²/2).
```

Require the complete candidate and every bay witness to lie in a cap of angular
radius `alpha <= 1.4 < pi/2`. The cap is geodesically convex; therefore its minor
mouth arc stays in this cap. Let `A=p(a)`, `B=p(b)`, with distinct shoulders `a,b`.
The ordered pair `a -> b` must be the mouth edge in the oriented planar pocket ring
`E`, not an independently ordered array. The signed spherical triangle `N,A,B` has
area

```text
d = det(a,b)
T = 2 atan2(det(N,A,B), 1 + N·A + A·B + B·N)
  = 2 atan2(d, 4*s(a)*s(b) + a·b).
Delta = T - d/2
signedArea(E_curved) = signedShoelace(E) + Delta.
```

The cancellation uses `det(N,A,B)=s(a)s(b)d` and a denominator equal to
`s(a)s(b)*(4s(a)s(b)+a·b)`. This factor is positive. The reduced denominator is at
least `4*cos(alpha)>0`, so the selected branch is continuous and `T` lies in
`(-pi,pi)`. Both radial sides of the triangle map to straight radial chart segments.
LAEA preserves area, so replacing the straight mouth's line-integral contribution
`d/2` with the geodesic contribution `T` gives the correction above. The signed
solid-angle formula is also recorded in [Jacobson, section 8.4, equation 8.6](https://www.cs.toronto.edu/~jacobson/images/alec-jacobson-thesis-2013-compressed.pdf).

Reverse the entire ring and mouth traversal together: both signed areas, `T`, and
`Delta` reverse sign. Reversing only the mouth array is invalid. Take an absolute
area only after establishing a simple pocket and its orientation. The radial
same-ray limiting case has `d=0`, positive denominator and zero correction. It is
useful corroboration but is outside the strict nonradial support class below.
Positive owner polygon areas, marginal role shares and paid island quotas do not
change. The correction concerns the protected water pocket and its counterfactual
pre-cut body only.

## Selected continuous topology predicate

Normalize the entire pocket ring to counterclockwise orientation, or reject an
inconsistent orientation; never reverse just its mouth. With its ordered mouth
`a -> b`, define

```text
w = |b-a| > 0.
L(u) = det(b-a, u-a).
L(0) = det(a,b) = d > 0.
```

The accepted class requires all of the following before any bay measurements:

1. Preserve the existing simple, nondegenerate positive polygons, exact role roots,
   sole attachment links, disjoint roles/islands, and stitched body identity. Preserve
   the existing planar pocket `E`: every nonmouth edge is exactly a surviving
   interior coast edge; its interior is outside all positive polygons; there are no
   extra contacts; the declared witness lies strictly in `E`; and planar pre-cut
   `B0=B union E` is one simple body with the existing area ledger.
2. The distinct shoulders are exact existing coast vertices and the sole permitted
   `L=0` positive-geometry vertices. Every other vertex of every positive polygon
   must have `L>0` with the declared diagnostic margin. No positive polygon edge may
   join both shoulders. Inherited role/island contact predicates still reject an
   additional role or island touching either shoulder.
3. Require `L(0)/w > EPS`, every nonmouth pocket vertex and the witness on `L>0`, and the cap
   restriction above. Near-zero signs, ambiguous identities, invalid rings, extra
   contacts and unsupported caps reject. These are candidate restrictions, not
   changes to any adopted target.

A linear functional achieves its minimum over a polygon on its vertices. Each
straight positive edge therefore has `L>0` in its open interior, except for a
permitted endpoint at a shoulder; the entire positive polygon interior has `L>0`.
This is a continuous exclusion statement, not a sampled-edge assertion.

The minor geodesic mouth lies strictly on `L<0` except at the shoulders, as proved
below. It therefore meets no land edge, role or island except those two structural
contacts. Its chart arc and the chord enclose an outward lens on `L<0`. The planar
pocket lies on `L>=0`; the lens and pocket meet exactly along the chord. Their union
is one simple curved pocket, with the same coast and the true geodesic opening.
The lens is land-free, including detached islands, so protected water survives.
The same gluing argument makes curved pre-cut `B0` simple. The witness remains in
the planar pocket and thus in the curved pocket.

### Why the geodesic bows outward

This proof also answers the original great-circle-side question. Orient the mouth
plane normal `g=A cross B` so `gz>0`; here `d>0` already supplies that orientation.
Rotate chart axes so `gxy=(-k,0)`, with `k>0`. In the north hemisphere put

```text
z = 1-|u|²/2 > 0, s = sqrt((1+z)/2)
h(u) = s*(gxy·u) + gz*z.
```

The plane boundary is `x=f(y)>0`: its equation is `k*x=gz*z/s`. For fixed `y`, the
left side rises with `x` and `z/s` decreases. There is exactly one boundary point
for each `|y|<sqrt(2)`. On that boundary `hx<0`. For any nonzero tangent vector `v`,
differentiating the implicit equation gives

```text
vᵀ Hess(h) v = -gz*(2+z)*|v|²/(4*s²)
                  -gz*(4+z)*(u·v)²/(16*s⁴) < 0.
```

Consequently `f''<0`: this boundary graph is strictly concave, and its north-side
region `K={z>0,h>=0}` is convex. The minor arc stays in the north hemisphere and is
the graph between the shoulders' distinct `y` coordinates. Strict concavity puts
it outside their chord, on `L<0`; `L(0)>0` fixes which side is meant. There are no
extra chord crossings or coincident segments.

If every land vertex instead had `h>0`, convexity of `K` would certify every edge's
continuous great-circle-side condition. That is a valid alternative theorem, but
it is not the selected implementation predicate. Planar support alone does **not**
assert all land lies in `K`: for shoulders `(.65,-.12),(.65,.12)`, point `(.64,1)`
has `L=.0024>0`, angular radius about `1.27113<1.4`, but `h<0`. The selected proof
only needs the outward lens to be empty, which planar support establishes directly.

## Sufficient acceptance and exact diagnostic measurements

Use the retained [Lambert metric bound](../issue-168/geometry.md), with
`c=cos(alpha/2)` and planar mouth length `w=|b-a|`. The successor accepts only if
these conservative real-arithmetic quantities meet the unchanged thresholds:

```text
openingLower = c*w                  >= .12
openingUpper = w/c                  <= .30
depthLower = c*L(witness)/w          >= .15
depthLower/openingUpper             >= .5
removedAreaLower = area(E)/(4*pi)   >= .02*Q  [for a primary]
```

The area lower bound omits the positive outward lens. The depth lower bound uses
distance to the infinite chord line: every point of the geodesic arc is across that
line from the witness, so its chart distance is at least `L(witness)/w`. The whole
arc stays inside the same cap, making the spherical lower factor `c` valid. The
opening interval is the existing point-pair metric bound. These tests may reject
bays whose exact values would qualify; they never loosen the adopted targets.

For reporting/corroboration, the exact opening is
`beta=atan2(|A cross B|, A·B)`, with `0<beta<pi`. Put
`n=(A cross B)/|A cross B|`, `X=p(witness)`, `P=X-(X·n)n`, and `r=|P|`.
If `r=0`, every point of the great circle is at distance `pi/2`. Otherwise set
`Y=P/r`. It lies on the minor arc exactly when both
`(A cross Y)·n >= 0` and `(Y cross B)·n >= 0`. If so the exact witness-to-mouth distance is
`atan2(|X·n|,r)`; otherwise that distance is the smaller spherical distance to `A` or `B`.
The antipodal projection is a maximum-distance stationary point, not an additional
minimum. This exact distance at the declared witness is a lower bound on the
adopted maximum pocket depth; it is not a computation of the pocket maximum.
Endpoint projection ambiguity must not select a favorable branch. These
exact formula evaluations are diagnostics, never an override of sufficient failure.

## Arithmetic, finite work, and implementation decision

The proof above is in real arithmetic. The smallest successor retains issue 172's
explicit binary64 diagnostic assurance and existing EPS/slack policy. It adds finite
input, identity, signed-area and linear-side checks; acceptance uses only the
existing chart metric machinery and planar distances/areas. Analytic area and exact
witness-to-arc distance evaluations are reported separately. An implementation may report that a
candidate passed these diagnostic predicates; it must not claim a formally rounded
geometric certificate, production contour survival, or cross-platform equality.

Use the existing maximum 256 unique vertices, eight role polygons and eleven
islands per candidate. Enumerate the existing finite polygon/contact checks, then
at most one linear-side check per stored boundary occurrence and witness. One fixed
mouth, one fixed witness and one predeclared ring are evaluated: no mouth search,
resampling, contour retry or favorable endpoint reordering. Preserve existing input
ring length limits and bound total checked occurrences by `23*256+1`; excess input
rejects. Classify failures explicitly as invalid identity/orientation, unsupported
chart, non-supporting positive geometry, planar topology/contact, invalid witness,
nonfinite/ambiguous arithmetic, or insufficient area/opening/depth/ratio.

Diagnostic comparisons retain `EPS=1e-10` for geometry and `1e-9` target slack. Use
signed distance `L(u)/w` for side margins, require it above EPS at every nonshoulder
vertex and witness, and preserve exact shoulder identities instead of numerically
classifying their expected zeros. Nonfinite intermediate results reject. Analytic
reporting must flag unresolved zero projection or arc-membership signs instead of
choosing a branch; it cannot turn a sufficient failure into success.

No quartic root isolation, general curved polygon engine, dependency, or rewrite of
old geometry is needed for this successor. A later formal certificate would still
need outward arithmetic for the retained predicates, cap/trigonometric terms and
comparisons. If formally bounded analytic reporting is wanted, isolate a separate
fixed-budget scalar primitive for square roots and atan2; do not silently expand
this investigation into that library or treat Math functions as such a proof.

## Examples and review gate

The corroborated local example is

```text
a=(.65,-.12), b=(.65,.12), witness=(.42,0)
E=[a,b,(.34,.09),(.38,-.08)]
B=[(-.6,-.45),(.35,-.5),a,(.38,-.08),(.34,.09),b,(.35,.52),(-.55,.5)].
```

All nonshoulder positive vertices lie strictly at `x<.65`. `B`, `E`, and planar
`B0` are simple; `B0` has area `1.1005`. The exact mouth opening is approximately
`.2270011777`, exact witness depth `.2423450275`, and curved pocket area
`.0598752976` steradians, comprising planar `.05935` plus `.0005252976`. The planar
area alone exceeds the largest retained required bay removal `.0326281576`.
The actual containing chart radius is `.75`, giving `c=.9270248109` rather than
using the worst allowed cap. Its sufficient opening interval is approximately
`[.2224859546,.2588927472]`, depth lower bound `.2132157065`, and ratio lower bound
`.8235677083`; all pass the unchanged bay thresholds.
This is a feasible local bay witness, not a complete primary or world certificate.

Required negative regressions include an extra positive vertex on the chord, a
crossing positive edge with an endpoint on `L<0`, an island wholly inside the
outward lens, positive intrusion into planar `E`, reversing only the mouth, a nearly
coincident pair of shoulders, a chart outside alpha 1.4, and a depth witness outside
`E`. Preserve orientation reversal and same-ray zero-correction arithmetic checks.
The known triangle `a=(.5,0),b=(0,.5)` has area `2*atan(1/15)`; sampled convergence
corroborates the formula but never supplies the continuous topology proof.

Independent review must check this document and the local arithmetic before an
implementation issue becomes ready. The selected next step is one private bounded
bay-predicate replacement using planar support and the sufficient bounds above,
with focused positive/negative tests. No world comparison or constructor redesign
is authorized by this design.
