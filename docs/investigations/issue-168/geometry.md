# Geometry predicates for the issue-168 candidate

These are real-arithmetic derivations and proposed finite predicates, not an implemented formal
floating-point certificate. The [construction and limits](README.md) and unchanged
[adopted targets](../issue-167/README.md) govern. Sphere area fraction is `μ=area/(4π)`; body
area Q and owner quota q are distinct. Local coordinates become angular geometry only after fitting.

## Equal-area chart and length bounds

For chart vector `u=(x,y)`, `ρ=|u|<2`, inverse Lambert mapping in an owner frame is
`p(u)=(x sqrt(1-ρ²/4), y sqrt(1-ρ²/4), 1-ρ²/2)`.
Its angular radius is `θ=2 asin(ρ/2)`. The radial and tangential metric singular values are
`1/sqrt(1-ρ²/4)` and `sqrt(1-ρ²/4)`; their product is one. Consequently planar area,
including holes and disjoint components counted once, equals spherical area in steradians.

Within chart disk `ρ≤R=2sin(a/2)`, `a<π`, put `c=cos(a/2)>0`. Curves staying in that disk
have lengths between c and `1/c` times planar length. Global point distances also satisfy
`c|u-v|≤d(p(u),p(v))≤|u-v|/c`. The upper bound uses the mapped straight segment inside the
disk. The lower bound does not assume the shortest geodesic remains inside a large cap:
write radial angles A,B, radii `r=2sin(A/2)`, `s=2sin(B/2)` and azimuth difference φ. Then
`|p(u)-p(v)|²=4sin²((A-B)/2)+2rs cos(A/2)cos(B/2)(1-cosφ)`.
The radial chord divided by `|r-s|` is `cos((A-B)/4)/cos((A+B)/4)≥1` (use its limit for equal
radii). The angular coefficient is at least `c²`, so chord distance is at least `c|u-v|`;
great-circle distance is at least chord distance. This also covers a sole-owner cap larger
than a hemisphere. Near `a=π` the bounds become weak; failure to certify remains a rejection.

Simple polygons have area from oriented shoelace sums. After verifying orientation, simplicity,
disjoint interiors and permitted shared root edges, their sum/difference is the exact reserve
ledger. Uniform scale s multiplies each area by `s²`. Thus the README's normalization establishes
`μ(owner)=q` in real arithmetic without sampled redistribution. Numerical area residuals must be
reported separately; a future implementation cannot call binary64 arithmetic formally exact.

## Explicit witness predicates after scaling

Use one disk bound a covering every role, collar, pocket and witness in a candidate; compute c
from that a. Tighter local bounds may be introduced only with their own proved domain bounds.
All targets below refer to the surviving polygons, after cuts and all polar/island contributions.

- **Interior:** declare center z in B; check it is inside and compute its minimum planar distance
  b to every boundary segment. The disk of spherical radius `cb` is inside B: any exit path must
  meet a boundary point at at least that spherical distance. Require `cb≥.15` for primaries or
  `.075` for subordinates, and the primary surviving area share ≥`.55Q`.
- **Roots:** the declared rectangular collar attaches a feature only to its named preceding
  body. Verify no other boundary intersections or alternate bridge exist. Its opposing long
  sides must be actual exterior coast throughout the collar. Its far end reaches a declared
  first interior disk of radius at least half the required angular attachment width. Check that
  disk by the preceding boundary-distance predicate on the feature/body union. Every separating
  crosscut in this collar joins the opposing coast sides, so its length is ≥`cw`; the mapped
  straight crosscut exhibits length ≤`w/c`. This certifies the infimum rather than a chosen wide
  chord. Reject an ambiguous collar or any extra attachment, including an island bridge.
- **Lobes:** certify each connected exterior's ordered marginal polygon area, its own exterior
  coast arc and root lower bound `cw≥.10`. Require both shares ≥`.08Q`, sum ≥`.20Q`, ratio ≥`1.5`.
  The prescribed `.15/.09` allocation supplies area margins but never supplies the width proof.
- **Peninsula:** its credited exterior excludes B and both lobes. Let T be its root segment and
  `e=max_v distance(v,T)` over exterior polygon vertices. Distance to a convex segment is convex;
  triangulation shows this vertex maximum bounds the whole polygon. Therefore its true spherical
  extent lies in `[ce,e/c]`. Require `ce≥.20`, `e/c≤.45`, `cw≥.08`, `w/c≤.16`,
  and `c²e/w≥2`; the last compares a lower extent to an upper root-infimum bound. Require area
  ≥`.05Q`. These conservative inequalities may reject geometry that would pass exact measurement.
- **Bay:** require shoulders on one radial ray, with distinct radial coordinates `ρ1,ρ2`.
  Its mapped radial segment is the shortest geodesic mouth with exact opening
  `o=|2asin(ρ2/2)-2asin(ρ1/2)|`. Require `.12≤o≤.30`. The simple pocket's other boundary is
  one connected coast arc on its declared body-facing side; its interior is wholly removed
  from the intended union and connects to exterior water through the mouth. For a declared
  interior witness z, compute planar distance b to that radial mouth segment and require
  `cb≥.15` and `cb/o≥.5`. This supplies a lower bound on maximum depth. Require removed pocket
  area ≥`.02Q`, with no island/polar term refilling it. An arbitrary chart chord is not a
  substitute for the geodesic mouth. Inland holes and offshore pockets fail these predicates.
- **Containment:** all polygon points lie within the largest vertex radius R because the
  chart disk is convex. Let `a=2asin(R/2)` and require `r-a≥.05`, then every land point has
  nominal/final guard clearance ≥`.05` at fixed zero. Require `r+δ<π` for the scalar extension.
  Check `r_i+r_j+.05≤d(center_i,center_j)` for every pair. Triangle inequality then gives
  realized inter-owner land separation at least `.15` rad with these nominal margins, exceeding
  the adopted `.13` minimum. Fixed retained caps with inadequate capacity must still be rejected.

Rectangle root sides can fail to stay coast when the head flares backward or another feature
touches them; the polygon/intersection checks are required, not implied by the recipe. Polygon
segment tests, signed point-in-polygon tests and finite component/root adjacency supply these
predicates. Use the full declared vertex bound; unresolved touching, collinearity or topology
is a numeric-predicate failure, not a permissive epsilon union. Human-observed primaries remain
subject to the same checks even when the arithmetic role rule did not predict their appearance.

## Continuous field and sampling boundary

Choose fixed `δ=.02` radians for the experiment's negative field extension. For a sphere point
with `d(center,p)<r+δ`, map it to the local chart and compute planar signed distance h to the
complete owner land boundary, positive inside. Define `F=min(max(h,-δ), r-d(center,p))`.
For `d≥r+δ`, define `F=r-d(center,p)` directly. At the join the guard equals `-δ` and both
formulas agree. All chart operations stay away from the antipode; both parts are continuous,
including polygon vertices, and the global field is `max_i F_i`. The local h is a scalar in
chart units, not a claim of signed spherical distance; the clipping constant merely joins fields.
The positive set is exactly the constructed land because every positive polygon has guard slack.

There is exactly one permitted contour, zero, hence no calibration branch changes or motion:
`D=0`. Quota normalization precedes placement, and no later offset is allowed. This does not
prove survival under the retained issue-165 offsets, quantization or a production interpolated
contour. If integers use `round(F*TICKS)>0`, a thin positive boundary strip can disappear;
report that independently and check both inherited sampled tolerances. Before production adoption,
bound quantization and extraction displacement against finite witness slack, or certify the
actual production reconstruction. The existing shared sampled-threshold selector cannot be reused
silently. Test seam/pole aliases, nested sample anchors and continuity from both sides of the
polygon and extension boundaries; tests corroborate rather than replace these derivations.

## Normal-01 arithmetic and unresolved work

The retained primary quota is `.35*.9025/2.41 = .13106846473029043`. Its original caps fail even
without margins or water, as [issue 166 proves](../issue-166/capacity-audit.md). For an illustrative
usable-cap occupancy f, the nominal containing radius would be
`r=acos(1-2q/f)+.05`. At `f=.75`, r is `.912574695381` and two such caps require center distance
`1.875149390762`. At `f=.65`, r is `.981398395731` and the requirement is `2.012796791461`.
Tetrahedral center distance is `acos(-1/3)=1.910633236249`. These binary64 arithmetic illustrations
show sensitivity to footprint efficiency; they establish neither an anatomical embedding nor a
feasible placement, and do not authorize enlarging the retained caps in place.

Still unproved: existence of any passing complete template at the fixed quotas, adequate packing
success, useful abundance/fragmentation/polar mappings, sampled coverage at zero, visual diversity,
and production numeric/extraction/runtime guarantees. A template that passes the stated exact
predicates has the listed continuous geometric properties; no template is claimed to pass yet.
The bounded next experiment must expose the first failed obligation and retain its evidence.
