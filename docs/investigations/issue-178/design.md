# Issue 178: distinguish collar width from the declared root length

This design preserves the [adopted targets](../issue-167/README.md), the
[issue 171 collar topology](../issue-171/design.md), exact positive polygon areas,
and [issue 176 private certificate](../issue-176/README.md) as frozen evidence.
It investigates a tighter upper bound using an already declared crosscut. It does
not establish universal target incompatibility or authorize a world comparison.

## The restricted area obstruction

The largest retained primary has body area
`Q=4*pi*.13106846473029043*(1-.0095)=1.6314078820711624` steradians;
its peninsula floor is `.05Q=.08157039410355812` steradians.

Consider this precisely restricted natural shape class: a geodesic root of length
w, swept along perpendicular geodesics for distance at most e, without extending
past either root endpoint's normal ray. In suitable sphere coordinates it is a
subset of

```text
F(s,t)=(cos(t)cos(s), cos(t)sin(s), sin(t)),
-w/2 <= s <= w/2, 0 <= t <= e.
```

The induced metric is `dt²+cos²(t)ds²`. Hence its area is at most `w*sin(e)`.
If the actual declared root length is at most .16 and e is at most .45, this bound
is `.06959448545779684` steradians; the required area is 17.2% larger than this
bound. Even the looser flat product `.16*.45=.072` is too small.
A taper only decreases this straight-strip area. Exact metric measurements alone
cannot make this restricted class meet the largest primary's floor.

The retained certificate adds further sufficient restrictions. With global Lambert
factor c, a planar non-flaring strip satisfying its root/extent upper bounds has
width at most `.16c` and depth at most `.45c`, so its exact LAEA area is at most
`.072c²`. At c=.88 this is `.0557568` steradians, requiring about 46.3% additional
area. This helps explain pressure to flare the authored head; it is not proof of
one universal cause for the rejected images.

Neither bound applies to every adopted peninsula. Its width W is an infimum of
proper separators in a declared collar, not necessarily the length of the declared
root R. Its extent uses shortest distance to R, not curved centerline length.
A broad-root taper or a curved peninsula may lie outside this restricted class.

## A separate spherical curved/tapered counterexample

A spherical annular sector with colatitude `theta in [r-h,r+h]` and azimuth
`phi in [0,Phi]` has root at phi=0, constant meridional crosscut width `2h`, and
area `2*Phi*sin(r)*sin(h)`. These coordinates are regular and injective when
`0<h<r`, `r+h<pi`, and `0<Phi<2pi`; no swept region is double counted.
For a symmetric tube around a unit-speed curved spine, the same formula follows
from the Jacobian `cos(v)-k_g(s)sin(v)`: integrating over `-h<=v<=h` cancels the
curvature term. One must still check injectivity and regularity, not infer them
from that integral alone.

Take r=.25, h=.079 and base area .085. Then Phi=2.1767423456382615,
spine length `.5385346745878832`, and width .158. For Phi between pi/2 and pi,
the far outer corner's nearest root point is the inner endpoint. Its distance is

```text
eUpper = acos(cos(r+h)cos(r-h) + sin(r+h)sin(r-h)cos(Phi))
       = .44815159858569004.
```

This bounds every sector point: distance to the inner root endpoint is an upper
bound on distance to the root, increases with phi on [0,Phi], and then with theta
on [r-h,r+h] at the maximizing phi. The corner attains the bound.

Over the last ell=.05 of spine length L, taper the symmetric halfwidth to
`h*sqrt(1-((s-(L-ell))/ell)^2)`. The tapered region is a subset of the sector.
Since `sin(x)>=(sin(h)/h)*x` for `0<=x<=h`, its area loss is at most
`2*sin(h)*ell*(1-pi/4)=.0016935916081147469`. It retains at least
`.08330640839188526` steradians. The outer side at the tail start is retained and
has root distance `.4251955445699949`, so extent lies in [.42519554,.44815160]
and extent/width exceeds 2.691. The taper does not increase any cross-section.

Choose collar `0<=phi<=.5` before the terminal taper. Every separator joining its
inner/outer coasts has length at least .158, because colatitude is 1-Lipschitz;
a meridian attains .158. A disk centered at theta=r, phi=.25 has distance at least
`min(h,asin(sin(r)*sin(.25)))=.06124700345342502` from every collar boundary,
exceeding the required .04 radius. The selected collar width is unchanged by the
narrower distal taper outside it.

Thus a standalone non-flaring, tapered spherical peninsula can satisfy these area,
width, extent and first-disk targets without a terminal bulb. It bends roughly
125 degrees. This is not an authoritative LAEA polygon candidate, a complete
primary, an owner-cap packing result, or evidence that such a hook looks acceptable.
Its realization would need paid polygon fitting and the ordinary full certificate.

## The selected far-crosscut upper-bound proof

Retain all issue 171 predicates: F has one exact root R to B; its actual exposed
coast prefixes L and U, R, and declared far crosscut T bound the root-adjacent simple
polygon C. T is a positive-length interior crosscut of F. It cuts F into C and a
nonempty distal polygon D, with no alternate bridges, extra contacts or hidden
coast. The whole declared first disk remains strictly inside C.

The adopted interpretation already made explicit in issue 171 measures separators
of the root/anchor side from the entire T/D side. It is not the different quantity
"minimum cuts separating R from the first disk itself." This distinction is
necessary: a cut near T leaves the first disk on its root side. The proposal does
not move the disk, shrink C, change role areas, or redefine the separator class.

T itself is a proper separator in F, just as R separates F from its anchor. If the
infimum is stated using only cuts properly inside C, use the following limit.
The simple polygonal quadrilateral C admits L-to-U crosscuts inside it approaching
T. Away from the endpoints, displace T a sufficiently small distance into C.
Near each endpoint, add arbitrarily short polygonal joins to its corresponding
coast prefix; this handles collinear adjacent coast segments without assuming a
parallel displacement alone meets both prefixes. Nonincident boundary portions
have positive separation from any trimmed interior part of T. The joins can be
chosen inside the local polygonal corner sectors. These cuts remain in the same
L-to-U separation class and their planar lengths tend to |T|. The first disk has
strict clearance from T, so sufficiently close cuts stay distal to that disk.
This is an existence proof for the infimum; no numerical perturbation search is
needed in the implementation.

The Lambert length bound applies to every such curve in the same containing chart.
Consequently W<=|T|/c. Combining both fixed upper witnesses with the unchanged
opposing-chain lower bound gives

```text
c*delta <= W <= min(|R|,|T|)/c.
```

Do not use delta as an upper witness: its minimizing straight connection might
leave C and need not be an admissible crosscut. The far bound is allowed only after
all full T/C/D topology checks succeed. T cannot be a coast edge, touch another
boundary point, lie outside F, or be selected after a failed quota fit.

## Fixed private implementation contract after independent review

A separate private copy may add the certificate option
`collarWidthUpperMode: 'root-and-far'`. Absent or explicit `'root'` preserves every
old result exactly; an unknown mode rejects. The constructor fixes this option
before fitting and declares R, T, coast prefixes and disk with each candidate.
There is no crosscut search, favorable relabeling, retry or mode fallback.

After successful existing collar validation, compute the finite lengths wR and wT
from its exact root and validated far endpoints. Preserve EPS=1e-10, target
slack=1e-9 and the existing binary64 diagnostic assurance. In the explicit new mode:

```text
rootUpper = (wR+2*EPS)/c
farUpper  = (wT+2*EPS)/c
widthUpper = min(rootUpper,farUpper)
widthLower = c*max(0,delta-2*EPS)  [unchanged]
```

Reject nonfinite/degenerate lengths or unresolved topology. Record both upper
bounds and the selected witness in new-mode metrics; choose root on an exact tie.
Use this widthUpper for the existing .16 peninsula upper gate and extent/width
ratio. Keep extent measured from the original R, all disk/collar lower bounds,
area shares, bay modes, cap/clearance and whole-owner checks unchanged. The default
mode must retain the old metrics schema and failure outputs without new fields.

Work adds one length, two divisions and one comparison per attachment, at most
eight attachments. Existing finite geometry/vertex/contact budgets remain intact.
This is a tighter sufficient analytic bound under the current diagnostic arithmetic,
not formal interval certification or a new production compatibility promise.

Required tests: exact old default/radial/supporting/wedge receipts; explicit root
mode equality; a broad-root taper rejected by root upper but accepted locally by
far upper; a narrower root retaining root selection; invalid or coast-coincident T;
T with additional boundary contacts; missing/distal-only disk; an alternate bridge;
a closest-chain chord that is not an admissible upper witness; and nonfinite or
unknown mode input. A failed collar must never gain eligibility from a short T.

## A direct planar witness and bounded next step

For a local geometry witness take R from (-.25,0) to (.25,0), T from
(-.06,.30) to (.06,.30), and a distal tip at (0,.35). The feature coast follows the
two straight tapered flanks, then the tip: its polygon is
`[(.25,0),(.06,.30),(0,.35),(-.06,.30),(-.25,0)]`.
The collar is the trapezoid below T; disk center (0,.17) is strictly inside it.
Its opposing chains stay at x<=-.06 and x>=.06, attaining delta=.12 at T. At a
valid declared factor c=.9, rootUpper is about .55556 while farUpper is .13333,
widthLower .108, disk radius lower about .1082, and extent bounds [.315,.38889].
Its area .096 steradians exceeds the largest retained peninsula floor. This is a
local tapered feature and first-disk witness, not a complete primary or organic
coastline verdict.

The diagnostic report also includes a complete subordinate B+P witness supplied
by the parent investigation: B is the rectangle x in [-.5,.2], y in [-.5,.5], with
the root at (.2,±.3), tapered sides to T at (.48,±.06), a tip at (.52,0), and disk
at (.3,0). Its .1032-steradian P exceeds the largest primary's absolute peninsula
floor. The frozen certificate rejects only the peninsula width upper and ratio;
the proposed far-bound numbers satisfy those gates. Its declared primary=false
status does not waive missing anatomy on a supposed primary: it is expressly a
subordinate topology example, not a complete primary proof.

The reproducible [diagnostic script](corroborate.mjs) and
[report](corroboration.json) retain the restricted-area calculation and both
counterexamples. Ordinary binary64 arithmetic corroborates the formulas; the
proofs above, not sampled output, establish their stated real-arithmetic meaning.

Independent pre-review found the far-bound argument sound under the retained
R-versus-T/D separator definition and explicitly identified the first-disk
interpretation caveat above. After final independent review, the smallest useful
next step is the private upper-witness change and focused regressions. Only then
try one declared broad-root tapered complete-primary coast. Its numeric result
cannot overrule visual anatomy, and no full world matrix follows automatically.
