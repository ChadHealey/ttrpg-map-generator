# Issue 175: bounded radial water-wedge exclusion

This design expands the sufficient bay class in [issue 173](../issue-173/design.md)
and its private [issue 174 implementation](../issue-174/README.md). It preserves the
ordered mouth, alpha<=1.4, planar pocket/B0 topology, and every
[adopted measurement target](../issue-167/README.md). It authorizes no constructor
or production changes.

For normalized CCW pocket mouth a->b, d=det(a,b)>0, w=|b-a|, L(u)=det(b-a,u-a), define the closed wedge W by

- g1(u)=det(a,u)/|a| >=0;
- g2(u)=det(u,b)/|b| >=0;
- g3(u)=-L(u)/w >=0.

The positive cone between a and b contains the entire minor arc: its spherical slerp is a positive combination of A and B, and inverse chart projection rescales the horizontal vector by a positive scalar. Issue173's separate outward-bowing proof gives L<0 on the open arc. Cone convexity contains its enclosed chord/arc lens, so that lens lies in W. Slerp alone does not prove the outward-side condition.

For each positive polygon, prove its boundary disjoint from W except its exact structural B shoulders. This also excludes its interior: for any interior u in W, the ray u+t(a+b) remains in W. The derivatives of the three unnormalized inequalities are d,d,2d, all positive. Since the polygon is bounded, this ray exits across a boundary point. That exit has L<0 and thus cannot be either shoulder. It contradicts boundary exclusion. The proof applies to every component separately, including every role and island. This is a planar exit proof: the ray may continue outside the chart disk without evaluating the inverse map there.

Check all segments, not only vertices. A segment whose endpoints are outside W may cross it: (.8,-.3)->(.8,.3) for a=(.65,-.12),b=(.65,.12).

## Finite implementation recipe

Preserve exact mouth/pocket orientation and origin signed-distance margin d/w>EPS. Preserve all old simple-ring, root/contact, body-stitch, pocket/witness/B0, cap and quota checks. Keep the planar pocket and its witness on L>=0, with the same strict nonshoulder margins. Only the positive-land global L>0 requirement changes.

For a positive edge not incident to a structural B shoulder, clip its parameter
interval [0,1] against all three closed affine inequalities. In real arithmetic
accept only an empty intersection. The selected investigation algorithm clips the
expanded wedge gi>=-EPS, with EPS=1e-10 and parameter separation slack tau=1e-12:

1. Initialize lower=0 and upper=1. For each i, compute A=gi(p), B=gi(q) and
   slope=B-A. Nonfinite values reject.
2. If max(A,B)<-EPS, this entire segment is outside one expanded halfplane: accept
   its exclusion immediately. This endpoint maximum is exact for an affine function
   in real arithmetic.
3. If abs(slope)<=EPS, omit this constraint. Omission enlarges the feasible interval
   and can only create a conservative rejection; it cannot hide a wedge crossing.
   This includes a constant constraint unless step 2 already resolved exclusion.
4. Otherwise compute t=(-EPS-A)/slope. Nonfinite t rejects. A positive slope sets
   lower=max(lower,t); a negative slope sets upper=min(upper,t).
5. After at most three constraints, accept only if lower>upper+tau. A nonempty,
   touching or unresolved interval rejects. Never accept because a sampled point
   happens to be outside the wedge.

The expansion and rejection margins preserve the investigation's explicit
binary64 diagnostic assurance; they do not constitute outward-rounded interval
arithmetic. The containment/exclusion proof is in real arithmetic. A future formal
certificate still needs bounded arithmetic for these linear operations and the
inherited Lambert/trigonometric quantities. There is no new transcendental
acceptance primitive here.

Expanded clipping must NOT be used to demand a singleton shoulder contact: every valid incident edge would meet the expansion for an initial interval. Instead use exact identity and an excluding active face over the whole straight segment:

- At a, opposite endpoint q must satisfy g1(q)<-EPS OR g3(q)<-EPS.
- At b, opposite endpoint q must satisfy g2(q)<-EPS OR g3(q)<-EPS.

The chosen active function is exactly zero at the shoulder and equals t*g(q) along the edge, so it is strictly negative for all t>0. This proves the whole edge misses W, rather than exempting a short neighborhood. Equivalently, for v=q-a the first rule is det(a,v)<0 OR ell(v)>0, where ell(v)=det(b-a,v) is the LINEAR derivative. Do not mistakenly substitute affine L(v), which adds d and can accept entering edges. Same for b with det(v,b). Reject edges joining both shoulders. Exact shoulder waivers apply only to structural B and its stitched boundary; role/island contacts retain their existing rejection.

At most 23*256 stored edge occurrences and three constraints per ordinary edge:
<=17664 halfplane clipping steps, each with at most one division. Incident edges
need at most two active-face comparisons. There is no root isolation, sampling,
retry, subdivision or candidate search. Preserve the existing maximum 256 unique
vertices, eight role polygons, eleven islands and per-ring input bounds. These
work and uncertainty budgets are fixed before implementation or candidate fitting.

The lens is then empty of all positive geometry. Since E lies on L>=0 and the lens
lies on L<=0, their only common boundary is the chord. Existing pocket topology
supplies a simple true-geodesic pocket and pre-cut body. With c=cos(alpha/2), the
unchanged sufficient tests, each retaining the existing 1e-9 target slack, are:

- opening lower c*w >= .12 and upper w/c <= .30;
- witness-to-mouth distance lower c*L(witness)/w >= .15;
- that lower bound divided by opening upper >= .5;
- planar area(E)/(4*pi) >= .02*Q for a primary, where Q is the paid body quota.

The distance at the declared witness is a lower bound on the adopted maximum bay
depth, not a measurement of the pocket maximum. The witness remains strictly inside
planar E and inside the containing chart cap; its line-side check alone is
insufficient. The primary-only removal floor must actually execute under primary
classification. Positive owner and role area accounting remains unchanged; no
curved lens credit is needed. Preserve issue 174's radial default and require an
explicit new private mode for any successor, with no silent fallback on failure.

## Local corroboration and limitations

With a=(.65,-.12), b=(.65,.12), E=[a,b,(.34,.09),(.38,-.08)], witness=(.42,0), use
B=[(-.6,-.45),(.85,-.35),a,(.38,-.08),(.34,.09),b,(.9,.4),(-.55,.5)].
Scratch checks find B/E/B0 simple, witness outside B and inside E; every B edge misses W except four structural shoulder endpoints. The two seaward points fail global chord support but pass this wedge test. Chart radius .9848857802 gives alpha1.0297886775, opening [.2088827422,.2757527950], depth lower .2001792946, ratio .7259375, and planar removed area .05935sr exceeding the largest retained bay floor .0326281576sr. This is not a complete primary or visual claim.

The retained [arithmetic script](corroborate.mjs) and
[result](corroboration.json) corroborate these values and the old private
certificate's rejection limited to global-support occurrences. Their ordinary
binary64 clipping is an example calculation, not the future conservative predicate
and not a sampled substitute for the proof above.

Required negatives: crossing segment with both endpoints outside W; nonincident
tangent to either radial face or chord; island wholly in W/lens; incident direction
entering W; incident ray along an active face into W; wrong mouth order; nearzero
origin determinant; missing exact shoulder identity; extra role/island shoulder
contacts; old planar E intrusion; invalid witness/cap. In particular, p=(.8,0)
lies in W, and a small island around p must reject even though it may be beyond the
finite lens: this is deliberate sufficient-class conservatism. The narrower island
around (.6505,0) used in issue 174 intrudes into the actual lens and must also reject.
Positives should include a seaward island outside the angular cone and consistently
reversed full ring/mouth. Near-parallel constraints and singleton clip intersections
need focused regressions, as does a direction falsely accepted by substituting
affine L(v) for linear ell(v).
For a concrete endpoint case, a=(.65,-.12), q=(.66,-.12) enters W. With
v=(.01,0), ell(v)=-.0024, but affine L(v)=.1536: the mistaken expression
would accept a forbidden incident edge.

This class remains conservative: it excludes the entire unbounded wedge although only the finite lens must be empty; all old planar pocket constraints remain; it may still constrain shoulder shape. It expands permissible land positions around a bay but is not evidence that it explains or fixes issue172's visual rejection. The smallest justified successor is a private predicate implementation and adversarial tests, followed by a separately authorized constructor experiment.

Independent pre-review resolved the linear-derivative notation and confirmed that
expanded-wedge clipping must apply only to nonincident edges. The final independent
review must inspect this version before that implementation successor is ready.
