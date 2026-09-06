# Issue 187 — proposed final literal state: continuous southeast bank

This is one complete unexecuted second state. State 1's 60 certificates pass, but the author,
main task and independent local reviewer all reject its opposing pointed mouth at both sizes.
The second state tests the named failure: its lower exterior bank must continue into a longer
southeast broad region beyond the mouth, instead of turning around immediately near it.
No constructor, sampler, certificate or renderer was executed to develop this table. No scan
was performed. The first state, its shared runtime and every receipt remain frozen.

## Complete central mother coast

Use the same frozen periodic sampler: steps 3, tension .12, CCW orientation required, 29 anchors
and 87 sampled vertices. Anchor i maps to sample 3i. There is no added translation, rotation,
shear, smoothing or field bias. The three changed anchors are 26, 27 and 28; the complete table
is repeated here to make this a standalone material state, not a menu of deltas.

| i   | x     | y     |
| --- | ----- | ----- |
| 0   | .490  | -.220 |
| 1   | .340  | -.150 |
| 2   | .180  | -.030 |
| 3   | .390  | .020  |
| 4   | .600  | -.005 |
| 5   | .750  | .200  |
| 6   | .600  | .400  |
| 7   | .490  | .630  |
| 8   | .250  | .840  |
| 9   | -.100 | .770  |
| 10  | -.430 | .600  |
| 11  | -.610 | .400  |
| 12  | -.620 | .315  |
| 13  | -.625 | .230  |
| 14  | -.755 | .090  |
| 15  | -.830 | -.040 |
| 16  | -.930 | -.055 |
| 17  | -.950 | -.100 |
| 18  | -.830 | -.170 |
| 19  | -.705 | -.265 |
| 20  | -.570 | -.320 |
| 21  | -.550 | -.380 |
| 22  | -.490 | -.430 |
| 23  | -.370 | -.660 |
| 24  | -.130 | -.830 |
| 25  | .060  | -.790 |
| 26  | .300  | -.550 |
| 27  | .800  | -.500 |
| 28  | .650  | -.350 |

The bay shoulders, head and witness are not retreated or smoothed again. Instead the lower
coast now continues from anchor 27 through 28, the mouth at 0, and bank anchor 1. Their directed
secants are (-.150,.150), (-.160,.130) and (-.150,.070). This moves the broad southeast end and
the actual lower-lobe root endpoint together. Anchor 26 also moves to (.300,-.550) to give the
extended region a wider lower approach, rather than attaching a long line to the old root.

This is a whole-region change. It does not assert that the extended end will look acceptable:
an angular distal point, narrow triangular end or the unchanged upper mouth can still reject
it. Those are explicit remaining risks, not grounds for a third state.

## Fixed partition, witnesses and sites

| Role        | start | end | far samples | central collar disk |
| ----------- | ----- | --- | ----------- | ------------------- |
| lobe 0      | 18    | 33  | [21,30]     | (0,.525)            |
| lobe 1      | 66    | 81  | [69,75]     | (-.150,-.560)       |
| peninsula 2 | 39    | 60  | [45,54]     | (-.680,-.050)       |

The indices stay fixed but lobe 1's actual root end moves with anchor 27 to (.800,-.500).
Its actual coast through anchor 26 also changes. The untouched opposite lobe and west peninsula
are not relabeled to force a ratio or share. Actual B, lobe and peninsula shares must be measured
after the one fit; none is claimed preserved by keeping indices unchanged.

Interior witness: (-.100,0). Bay interval: samples 0 through 12, mouth [coast[0],coast[12]],
central witness (.280,-.065). Reverse the derived pocket ring exactly once, preserving that
ordered mouth; set mouthKind='wedge-geodesic'. All bay coast remains in B's index complement.
Island anchor indices: [63,65,79,81,82,83], with actual directed edge endpoints from the newly
sampled mother coast. These are unplaced site identities only; islands remains [].

## Complete displacement specification

Let u=g*u0 and v=g*v0 with anatomy [u0,v0] in [-1,1]² and
g=[1,.85,.6,.3][variation], variation 0..3. Before sampling set each coordinate to
central[i]+u*U[i]+v*V[i]. Unlisted vectors are exactly zero. The table is unchanged from state 1;
its southeast entries now move the newly authored region rather than the former short lip.

| i   | Ux   | Uy  | Vx   | Vy    |
| --- | ---- | --- | ---- | ----- |
| 0   | 0    | 0   | 0    | .008  |
| 1   | 0    | 0   | 0    | .006  |
| 3   | .008 | 0   | 0    | 0     |
| 4   | .012 | 0   | 0    | 0     |
| 5   | .020 | 0   | 0    | 0     |
| 6   | .020 | 0   | 0    | 0     |
| 7   | .020 | 0   | 0    | 0     |
| 8   | .020 | 0   | 0    | 0     |
| 23  | 0    | 0   | .010 | -.015 |
| 24  | 0    | 0   | .025 | -.010 |
| 25  | 0    | 0   | .010 | .010  |
| 26  | 0    | 0   | 0    | .008  |
| 27  | 0    | 0   | 0    | .008  |
| 28  | 0    | 0   | 0    | .008  |

Witnesses before fitting:

- lobe 0 disk=(0,.525)+u*(.010,0);
- lobe 1 disk=(-.150,-.560)+v*(.008,-.006);
- peninsula disk=(-.680,-.050);
- interior witness=(-.100,0);
- bay witness=(.280,-.065)+u*(.004,0)+v*(0,.004).

Every root, far endpoint and site still refers to its exact displaced sampled index. No extra
randomness, coordinate search, contour adjustment or favorable witness replacement is allowed.

## The specific analytic hypothesis

For the central state, the cubic from anchor 28 to the mouth has x controls
[.650,.6128,.5272,.490]. The following mouth-to-anchor-1 cubic has x controls
[.490,.4528,.3772,.340]. Each sequence is strictly decreasing. The x controls are unchanged
by the complete displacement table on those intervals. Therefore the true cubics and their
sampled coast continue in x through the lower mouth: it cannot be a local x-extremum on these
intervals. This is a narrowly stated geometry fact, not a guarantee about the displayed shape.

The central y controls on those same intervals are [-.350,-.3164,-.2440,-.220] and
[-.220,-.1960,-.1728,-.150], with strictly increasing central y. The prescribed small v shifts
remain a separate whole-box check for the independent designer; all actual segment/topology
predicates still belong to frozen issue 178.

The new exterior tangent at a is (.310,-.200+.002v). Thus
det(a,va)=-.02980-.00150v, strictly negative for v in [-1,1]. The upper shoulder and its
displacement-box determinant are unchanged. The mouth determinant is also unchanged from
the independently reviewed first state. The actual lower incident sampled edge must still
receive its own exclusion check; tangent signs alone do not certify a sampled edge.

Using the frozen sampler's already-reviewed sample-86 formula, the central incident vector
is approximately (.0497481481,-.0369037037), giving det(a,edge) approximately -.0071382222.
The displacement coefficient is approximately -.0003457185*v, so it stays strictly negative
through this box. These are hand-derived formulas for independent review, not a new interval
certificate or a substitute for actual frozen predicates on the 60 cases.

## Unchanged gates and honest uncertainties

The existing whole-state ledger cannot be carried over: extending B and changing the lower-lobe
root can change area shares, opposite-lobe ratio, the one fit, first-disk bounds and guard radius.
Frozen issue 178 must check B share .55, both lobe shares .08 and their sum .20/ratio 1.5,
peninsula share .05 and all unchanged width/extent rules. Bay opening/depth/ratio/removed-area
bounds and expanded-wedge exclusions remain unchanged. No claim is made that this new geometry
passes, packs with other owners or fixes the upper bank's visual grammar.

After independent design review and root clearance, the separate stage-2 guard must verify the
completed first receipt and bind the first-state rejection/review, this exact second table and
its independent review. Source capture must precede any second-state geometry import. Preserve
the frozen first-state shared runtime; do not retrofit this prerequisite into its old hashes.

Execute the same 60 body-only cases: the three quota expressions
.13106846473029043*.9905, .10494186046511626*.9905, .06666666666666667*.984;
center plus four anatomy corners; variations 0,1,2,3. Use one uniform fit, primary=true,
islands=[], and the same frozen certificate options. The native panel is 900 by 320 with three
300-pixel quota panels at chart span 2.5; half panel 450 by 160 uses the corresponding even
native pixels. No extra thumbnail, shape, parameter trial, world or 134-case sweep is added.

Retain all outcomes and exact repeat/replay whether they pass or fail. Numeric failure or a
surviving jaw/slot/extended-tip visual failure rejects this last state. Two material states
exhaust issue 187; there is no corrective third geometry and no local pass implies family,
production or human acceptance.
