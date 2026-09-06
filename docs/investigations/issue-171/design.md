# Issue 171 — a general attachment collar with explicit topology

**Design-only candidate for independent mathematical review.** The adopted
[issue-167 targets](../issue-167/README.md) require attachment witnesses, not rectangular necks
or a prescribed terminal head. The repeated tab-like outcomes of issues 168–170 justify testing
a less restrictive witness while retaining the same separated spherical envelopes, immutable
quotas and fixed-zero contour. No new certificate is implemented here; no world or visual pass
is claimed. [Issue 171](https://github.com/ChadHealey/ttrpg-map-generator/issues/171) owns this work.

## Declared objects and finite topology predicates

Let F be one simple polygon for a declared lobe or peninsula exterior. Its exact root segment
R is the only shared boundary with the preceding body B. F and B have disjoint interiors. The
complete positive union must have no other contact, bridge or overlap joining F to B, another
role or an island. Preserve the ordered marginal-area ledger; naming the same protrusion twice
cannot supply two roles. Root endpoints, role choice, collar coast indices, far crosscut and
disk witness are fixed with the geometric candidate before fitting its quota.

For the first implementation, declare a straight far crosscut T with endpoints on distinct
vertices of F's exposed coastline. Each lies after its corresponding root endpoint along one
of the two opposing exposed coast prefixes, L and U. Check all of the following:

1. F, B and the final stitched body are simple; R is an exact shared edge and the only permitted
   F/B contact. Other roles and islands do not create a second attachment. Require nonzero root
   length and stable endpoint/edge identities, rather than a near-equal inferred match.
2. L and U are the actual ordered boundary prefixes of F from the two root endpoints to the
   two T endpoints. They are disjoint, including their endpoints, and remain exterior coast
   in the complete positive union. No coastline hidden by another positive term qualifies.
3. T has positive length, is not a boundary edge, and its interior lies strictly inside F.
   Exhaustively check T against F's bounded edge list: only its endpoint contacts are allowed,
   with no crossing, overlap or additional touching. A strictly interior midpoint plus those
   intersection exclusions establishes that its entire open segment stays inside F.
4. Cutting F along T gives exactly two simple positive-area polygons. **C is the root-adjacent
   one**, bounded in order by R, one coast prefix, T and the other prefix. D is the nonempty
   distal component. Check exact boundary identities, simplicity, disjoint interiors and
   `area(F)=area(C)+area(D)`. An arbitrary included quadrilateral is not a collar certificate.
5. The declared first interior disk lies wholly inside C. Check its center is strictly inside,
   then bound its distance to every C boundary edge as below. A disk elsewhere in F, a center
   alone inside C, or a disk in another body cannot satisfy this witness.

For this attachment witness, a separating crosscut in C separates the root/anchor side from
the **entire far crosscut and distal feature D**. F's credited land includes both C and D and
is counted once; this distal description does not discard proximal feature area. It identifies
the feature side of the attachment separator requested by issue 167. A coast-to-coast curve
that merely isolates a side pocket or the disk while leaving D connected to R is not such a
separator. In particular, it must not be used to claim the opposing-chain theorem applies to
every curve separating an arbitrary point from the anchor.

## Conservative angular width and disk bounds

Use the [proved Lambert chart bounds](../issue-168/geometry.md): within a declared containing
chart disk of angular radius `a<π`, put `c=cos(a/2)>0`. For planar points u,v,
`c|u-v|≤d_sphere(u,v)≤|u-v|/c`; mapped planar curve lengths obey the corresponding bounds.
The global lower bound follows from spherical chord distance, so it does not assume that a
shortest geodesic stays inside a hemispherical chart cap. Use a covering a that includes all
objects whose distances are being certified, and re-evaluate it after fitting and island placement.

Let `δ=min_{x∈L,y∈U}|x-y|`. Compute it over every pair of line segments in the two authoritative
polygon coast chains. For nonintersecting planar segments, the minimum is the least of their
four endpoint-to-segment distances; any intersection or ambiguous contact rejects the collar.
This is a finite chain-distance computation, not sampling a few favorable chords.

C is a topological quadrilateral by the predicates above. A simple properly embedded crosscut
that separates its R side from its T/D side must join L to U: a crosscut with both endpoints on
one side can cut off only a portion of that side without separating the two opposite sides.
This is the planar Jordan separation argument applied to the declared boundary order. The
Lambert map is a homeomorphism here, so it preserves this topology. Every admissible spherical
separator consequently has length at least `cδ`. R itself is an admissible anchor/feature
separator in the full land union; its mapped straight planar segment has length at most
`w/c`, where `w=|R_end-R_start|`. Thus the infimum W of attachment crosscut lengths satisfies

```text
cδ ≤ W ≤ w/c.
```

Require `cδ≥.10` for each declared lobe root. For a peninsula require `cδ≥.08` and `w/c≤.16`.
The peninsula's unchanged extent lower bound must also be at least twice this conservative
root upper bound. No literal rectangle, straight coast side, affine head, head-height axis or
ban on a curved head turning back is needed: valid topology and actual coast separation replace
those recipe restrictions. A curved return that touches the body or destroys the collar still fails.

For disk center z, compute `b=min_{x∈boundary(C)}|z-x|`. Its spherical inradius is at least cb,
because every exit path meets a boundary point at at least that spherical distance. Require
`cb≥.05` for a lobe's first disk and `cb≥.04` for a peninsula's first disk. These are half the
adopted minimum attachment widths. B's separate primary/subordinate interior disks and primary
area share remain independent requirements; this feature disk does not replace them.

These are sufficient lower/upper bounds, not exact spherical minimum-width measurements.
They can reject a geometrically adequate collar. Binary64 predicates, subtraction and metric
bounds need explicit conservative numeric slack and an unresolved-predicate failure; merely
rounding a near-threshold value upward is not a certificate. This discovery does not supply a
formal IEEE-754 interval implementation. The later implementation must not silently reuse the
old rectangular assumption after accepting the new collar record.

## Direct coast construction and exact area fitting

Author each candidate as fixed-sample curved **outer coast chains** with predeclared root
crosscuts partitioning it into B and its ordered feature polygons. This makes the silhouette
the primary construction object; the collar records certify it rather than force visible
rectangular shoulders. Declare each T, opposing prefix pair and disk with that candidate.
Every root/cut/coast point shared by two records has one exact identity. No smoothing or
favorable role/collar search occurs after stitching or quota fitting.

Polygon sampling counts and curve coefficients are bounded and frozen before evidence.
Compute actual B and feature areas by shoelace and reject candidates missing the adopted
`.55Q` interior share, two `.08Q` lobe shares, `.20Q` lobe sum, `1.5` lobe ratio or `.05Q`
peninsula share. No specific extra partition is mandatory. Uniform scaling preserves these
shares, and the equal-area map makes planar area exactly spherical area in steradians.

Before fitting, reserve island/archipelago fractions f of the immutable owner quota q. Fit the
complete main body of planar area A to `Q=(1-f)q` using `s=sqrt(4πQ/A)`. Scale all role,
collar, bay and witness coordinates together, then check their actual angular targets. This
is finite area fitting even if a candidate's prescribed shares prove inadequate: it returns
no proposal, never relabels features or inflates a sampled contour to repair them.

An optional fixed area-adjustment parameter may move a declared set of exposed Bézier controls
parallel to one chosen direction while holding roots/collar identities fixed. Every sampled
vertex then has form `p_j+λ b_j n`, making shoelace area affine in λ because the quadratic
cross terms vanish. A single direct area solve is permitted only within a predeclared λ interval;
all final topology and share checks still apply. It is not necessary for the first minimal
experiment, and cannot become an unbounded search for a favorable decomposition.

## Compact paid islands and finite experiment

For the minimal successor, retain explicit paid fractions `f_isolated=.02*abundance/100` and
`f_grouped=.01*abundance/100`, with the retained independent category counts, maxima 4 and 7,
and zero removing its category. Divide each fraction among its declared members with fixed
unequal weights. Each island polygon is scaled directly to its assigned `4π f_j q` area.
Their positive areas are therefore already paid when the main body is fitted; no second global
normalization after positioning may silently alter its anatomy.

Declare at most six localized margin anchors per candidate, tied to actual main-body coast
edges or ends, not a ring around the cap. For each island, consider at most 24 candidates:
six anchors in a seed-fixed order and four fixed outward offsets. A concrete initial planar
offset table is `.015,.03,.05,.08`, added beyond that island polygon's maximum center radius
along the declared outward coast normal. These are site proposals in the fitted chart, not
promises of angular clearance. Check every body/role/bay and prior-island segment pair and
containment; reject contact, overlap and intrusion into protected water. Choose the first
passing site in the fixed order. Exhaustion rejects the owner and retains its unplaced-island
diagnostic; it does not drop a paid island or return its quota to the main body.

After all islands are placed, compute the complete cap radius, keep nominal clearance at least
.05 and final clearance at least .04, and rerun feature certificates with the final metric bound.
Reuse [issue 170's bounded placement](../issue-170/design.md#revised-finite-placement) read-only,
including its actual `.05` cap gap and final all-pair check. The
[packing inequalities](../issue-169/packing-audit.md) still apply to these constructed radii.

The next implementation remains limited to 16 geometric candidates per owner, eight owners,
11 island polygons and 256 unique geometry vertices per owner. Witness R/T endpoints are
existing vertices; count any new construction vertices in that limit. Each feature has one
declared T and one declared disk. Topology checks enumerate bounded polygon/segment pairs;
chain-distance checks use at most `256²` segment pairs per collar. At most 24 island sites
per member gives at most `16*11*24=4,224` site proposals per owner across local candidates.
No adaptive resampling, changing decomposition, hidden retry or new cap support policy is allowed.

All other adopted rules remain unchanged: owner count and primary hierarchy, circumference
scaling, actual peninsula extent/area/ratio, protected geodesic bay mouth and depth/area,
guard/gap, finite polar accounting, all nine controls, coverage at both resolutions and
per-owner preview tolerance. Contour interval remains `{0}`, `D=0`. Numerical masks and
future production extraction still require their separate survival evidence.

## Bounded synthetic arithmetic

The following is one collar/attachment example, not a complete primary or world. In a chart
bounded by `a=.8`, `c=cos(.4)=.921060994003`, take the root from `(0,-.065)` to `(0,.065)`.
At `t=0,.25,.5,.75,1`, sample the two gently curved coast chains

```text
L(t) = (.24t, -.065-.025(3t²-2t³)),
U(t) = (.24t,  .065+.09t²-.065t³).
```

These are cubic Bézier coordinate polynomials; their finite polygon samples are authoritative.
Join their far endpoints with T at x=.24 and close at R. Set disk center `z=(.13,0)`.
Every lower-chain y is at most -.065 and every upper-chain y at least .065, with equality
at the root pair, so δ is exactly .13. Extend F's exposed coast between the far endpoints
through `(.31,-.105),(.38,-.035),(.37,.04),(.29,.10)`. An anchor rectangle
`[-.4,0]×[-.25,.25]` with explicit root vertices shares only R with F.

| Measured or bounded quantity                |         Value |
| ------------------------------------------- | ------------: |
| Minimum planar opposing-chain distance δ    | .130000000000 |
| Angular width lower bound cδ                | .119737929220 |
| Angular width upper bound w/c               | .141141575690 |
| Planar center-to-collar-boundary distance b | .078134907450 |
| Whole-disk angular inradius lower bound cb  | .071967015522 |
| Collar planar area                          | .037481250000 |
| Collar whole-sphere area fraction           | .002982663105 |
| Entire exterior F planar area               | .059581250000 |

The candidate satisfies the lobe-root and whole-first-disk bounds. Existing read-only polygon
helpers corroborate simplicity of C, F, B and their stitched union; the boundary construction
supplies the topology argument. The broad root width is not inferred from a chosen wide chord.

For a negative case, keep the same .13 root but insert opposing coast points `(.12,-.015)`
and `(.12,.015)` into their chains. Their distance is .03, so the computed δ is at most .03
and `cδ≤.027631829820`, failing both angular root floors despite the unchanged nominal root.
For an extra-bridge case, add a positive strip `[-.1,.30]×[.08,.095]` connected to the anchor:
it overlaps F away from R (for example near `(.285,.09)`), so the single-attachment/role-overlap
predicate rejects it before any width claim. A disk centered at `(.30,0)` belongs beyond T;
it cannot qualify as wholly inside this root-adjacent collar even if it lies inside F.

The arithmetic was recomputed with Node and the unchanged issue-169 polygon helpers. It is
binary64 corroboration of this bounded example, not an implemented new certificate or formal
rounding proof. The smallest justified successor is a separate local implementation of the
general collar record/predicates plus fixed direct-coast candidates and compact island sites,
with positive/narrowing/bridge/far-cut/disk regressions before any world comparison. Independent
mathematical review and any insufficiency findings must be recorded before that implementation.
