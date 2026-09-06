# Next bounded bay hypothesis — read-only design

I inspected the exact issue-183 comparison-r1 native and half images for connected-majority,
normal-02, normal-03 and default-004, and read current183 A/B/C, frozen182 large and the172
partition helper. No candidate was executed and no repository source was changed.

## Diagnosis and recommendation

The balanced image visibly contains both sharp polygonal excavations and rounded shapes with
long flat lips. Normal02/03 retain conspicuous V/step recesses at half size. Default004's large
primary has a short lower peninsula, but its bay still reads as a slanted slot with a blunt lip.
These are actual broad margins, not raster resolution artifacts. A B-only repair cannot justify
a full-family pass: A and the large fallback must be included in the same bounded hypothesis.

The smallest useful change is a local, explicitly authored four-piece cubic chain: an exterior
shoulder transition, two unequal bay-bank curves sharing one smooth inner-head tangent, and an
exterior shoulder transition. Sample that new geometry into authoritative polygon vertices before
the existing single quota fit. Do not merely subdivide183's five straight B vertices, increase
global cardinal tension, apply a smoothing filter after partition, or add edge noise.

Keep C and subordinate sources unchanged. Keep all actual role polygons/root/far/disk coordinates
exact before fitting by retaining the old sampled array outside the declared free-coast interval.
Uniform fit will change their final coordinates when body area changes; that is expected and is
why every full certificate must rerun. “Exact raw roles” must not be misstated as exact fitted
owners or unchanged182 fallback output.

## First combined material state: concrete starting recipe

Use the current legacy coast computation to obtain the pre-splice samples for each anatomy input.
Replace only the intervals below. Reuse every kept Point coordinate exactly; do not recompute it
through a new sampling formula. Each bay uses two cubic Bézier segments with eight equal parameter
subintervals each. Each exterior shoulder buffer uses four subintervals. Total replacement is
24 edges. The endpoints of every piece are emitted once, exactly, without interpolating t=0/1.
The polygonal sampled chain is authoritative; smooth-curve language describes its authored shape,
not an unproved continuous certificate.

All coordinates below are BEFORE B/large's existing (+.06,-.025) chart translation. Values are
an unexecuted first recipe, not passing geometry. They deliberately change broad bank curvature.

### B: replace old coast30 through coast36, preserving both endpoint roots

Keep the declared mouth a=(.01,.46), b=(-.20,.445) and witness(-.11,.20) initially. Replace the
literal five-vertex excavation with these two curves:

| Piece       | P0  | P1           | P2           | P3             |
| ----------- | --- | ------------ | ------------ | -------------- |
| First bank  | a   | (-.002,.390) | (-.045,.165) | k=(-.120,.170) |
| Second bank | k   | (-.195,.175) | (-.140,.370) | b              |

The derivatives at k are exactly equal: 3*(-.075,.005). There is a rounded, laterally offset
inner head, not a V apex or circular arc. The old witness is deliberately retained; if it is not
strictly inside the resulting polygon, this recipe fails rather than moving it after fitting.
The asymmetric second bank may still make a conspicuous cove; that is a visual uncertainty.

Connect old30 to a and b to old36 using the shoulder rule below. This changes the exposed
non-role shoulder geometry rather than leaving a hard elbow at each inserted mouth.

### A: replace the cyclic interval old84 through old15

Keep a=(.66,-.20), b=(.73,.025), witness(.45,-.06). Old84=(.61,-.30) and old15=(.74,.25)
are buffer endpoints outside every attachment interval. Proposed banks:

| Piece       | P0  | P1           | P2           | P3             |
| ----------- | --- | ------------ | ------------ | -------------- |
| First bank  | a   | (.595,-.170) | (.385,-.125) | k=(.390,-.055) |
| Second bank | k   | (.395,.015)  | (.625,-.020) | b              |

The inner derivatives both equal 3*(.005,.070). One bank approaches the deepest region obliquely;
the other opens through a different curvature instead of mirroring it. Matched buffers round the
outer headland turn that currently joins an almost horizontal lip to a near-vertical exterior.

### Large fallback: replace cyclic old81 through old15

Keep a=(.505,-.273), b=(.625,-.137), witness(.34,-.11). Old81=(.43,-.37) and
old15=(.72,.10) are outside the role intervals. Proposed banks:

| Piece       | P0  | P1           | P2           | P3             |
| ----------- | --- | ------------ | ------------ | -------------- |
| First bank  | a   | (.445,-.230) | (.295,-.140) | k=(.300,-.105) |
| Second bank | k   | (.305,-.070) | (.560,-.152) | b              |

The inner derivatives both equal 3*(.005,.035). The final bank approaches b with tangent
(.065,.015), allowing it to continue into a rounded exterior instead of making the current
blunt angular turnaround. This may reduce pocket area or exclude its witness; preserve the
failure if so. Peninsula roots/far/disk and the carefully recovered large quota remain fixed.

### Exterior shoulder rule, including wedge endpoint constraints

Let E0/E1 be the unchanged splice endpoints, prev/next their unchanged exterior neighbor samples,
and Q1 the first bank's P1, Q2 the second bank's P2. Use buffers:

- incoming: [E0, E0 + .5*(E0-prev), a - .35*(Q1-a), a];
- outgoing: [b, b + .35*(b-Q2), E1 - .5*(next-E1), E1].

These are positive collinear tangent joins at each mouth and align with the old exposed polygon
edge at each splice boundary. They are geometric continuity choices, not certificate exemptions.
The small seaward shoulders may be valid because wedge support permits land outside the angular
mouth sector. Check the actual frozen wedge predicate on every new straight segment.

In particular the terminal tangent at b must point outside its active radial face (or inward of
the mouth line); a generic “round the lip” handle pointing into W is invalid. The prescribed
outgoing b tangents satisfy det(v,b)<0 in the actual translated chart for these central mouths;
the complete curve and all anatomy cases still require certification. Use the linear mouth-line
derivative det(b-a,v), never the affine L(v), for any diagnostic explanation.

## Exact indexing, sites and limits

Make a small private splice helper that returns an explicit old-index→new-index map for retained
samples and named new mouth indices. For a cyclic replacement, choose a deterministic new array
start at E0 and remap every role start/end/far and all site indices through that map. Reject a role
reference to a removed sample. Preserve disk arrays unchanged. Assert the complete raw attachment
arrays equal the predecessor for center/corners/variations, not just root lengths or role areas.

B's new count is102 (84−6+24); A93 (87−18+24); large90 (84−18+24), each below the unchanged180
partition limit. Even with77 detached vertices they remain below256 unique owner vertices. No
sampling-policy or certificate bound changes are needed. The endpoints are retained roots on B;
no extra subdivision may enter its neighboring role arcs.

For A and large, existing island anchor edges outside the splice survive; remap them exactly.
B's old31/33 anchor edges are deleted by the actual bay repair. Predeclare replacements using
unchanged exposed old13/16 on the filled eastern margin, retaining52/54/77/79 for its other four
sites. This is only a proposed site ledger: verify all six are exposed, pairwise valid and compact
under the unchanged24-attempt site budget. Do not retain stale31/33 indices or add a search for
more favorable anchors after fitting. Geometry changes can legitimately alter island selection
and placement receipts; category payments, streams and all budgets remain fixed.

The first state can keep the new bay handles fixed while the existing regional anatomy streams
continue elsewhere; do not add randomness to obtain a favorable local shape. If a second state
needs bay variation, prescribe its bounded handle coefficients using the existing anatomy draws
before executing it, preserve boundary identities, and count it as a material combined state.

## Gates, uncertainty and split recommendation

This can fit the drafted next issue as one private bay-and-shoulder change. Before any world
matrix, certify all changed raw layouts at their actual paid body quotas and bounded anatomy
corners, then all exact183134 construction/placement inputs with strict repeats. The first state
above may fail pocket containment/area, whole-wedge exclusion, role share after changed body area,
compact site placement or balanced caps. Those are material outcomes, not reasons to weaken a
target or relabel a witness.

Retain each combined A/B/large source state, failures and local panels before editing. Permit at
most three combined material states and two exact nine-row matrices. The first complete local
state must be independently inspected for actual flowing shoulders and distinct bay profiles
before spending a matrix. A merely rounded slot is a local rejection, even if certified.

After a passing134 gate, review all nine native/half pairs together; seven ordinary rows and both
controls must meet the retained contract. No claim follows from B alone or selected favorable
rows. If unchanged C or subordinates become decisive, altering them exceeds this narrowly
declared hypothesis and needs a separate issue; preserve that limitation rather than silently
expanding the coast rewrite. Likewise, inability to succeed without changing attachment geometry,
fourth state, third matrix or new support mathematics is a split/stop condition. No human
selection, production contour proof or accepted ADR is inferred from this proposal.
