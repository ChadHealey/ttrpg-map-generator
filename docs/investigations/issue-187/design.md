# Preliminary literal A whole-coast prototype — review before execution

This specifies one complete central coast and its fixed regional variations. No geometry has
been executed or certified. Missing authored constants are no longer treated as an outcome:
the proposed private experiment must test this reviewed specification, unless a concrete
analytic/topological contradiction falsifies it before execution. No additional recipe is
implicitly authorized by a failed visual result.

## Hypothesis and material change

Issue 184's final reviews agree that A and repeated B/C/control mouths fail R3. Large 3 improves
its paired-wall defect and is a credible provisional baseline, not human/family acceptance.
This experiment tests **one new A**: a broad oblique shoulder above a recessed sector, with the
lower bank continuing into a broad lower lobe rather than ending as a separately projecting lip.
The west peninsula remains a separate role. No B/C/Large or companion execution belongs here.

This is not a splice within frozen roles. The entire 29-anchor mother coast is authoritative.
The lower-lobe root now ends at anchor 27, incorporating the adjacent broad lower region; the
interior witness moves west. The northern region and bay/outer shoulders are coauthored in
the table below. The peninsula retains a known broad-root/far-cut structure, avoiding an
unrelated reconstruction of every proven feature at once. The new whole-body area, shares,
cap and visual effect are unverified.

## Complete central anchor table

Use frozen `issue-172/coast-partition.mjs`: `sampleCoast(anchors,{steps:3,tension:.12})`.
There are 29 cyclic anchors and 87 sampled coast vertices; anchor i maps to sample 3i.
The sequence is intended CCW. Require the actual sampled signed area to be positive;
reject an orientation failure rather than silently reversing the role indexing.

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
| 26  | .180  | -.490 |
| 27  | .490  | -.380 |
| 28  | .510  | -.300 |

No added rotation, chart translation, shear, post-sampling smoothing or projection bias.
The chart pole is the origin. The periodic sampler determines every cubic handle; no hidden
hand-tuned handles remain. The sampled polygon, not the true spline, is credited and rendered.

## Complete partition and witnesses

Call `partitionCoast` with the following fixed sample indices, in this role order:

| Role       | start | end | far endpoints | central collar disk |
| ---------- | ----- | --- | ------------- | ------------------- |
| lobe0      | 18    | 33  | [21,30]       | (0,.525)            |
| lobe1      | 66    | 81  | [69,75]       | (-.150,-.560)       |
| peninsula2 | 39    | 60  | [45,54]       | (-.680,-.050)       |

The root endpoints are the actual coast points at start/end. Derive their collar coast
prefixes and distal polygons with frozen issue 178, not another rectangle assumption. All required
role intervals are disjoint and lie outside the declared bay interval by index construction;
actual geometric nonintersection is still a certificate obligation.

Interior witness: (-.100,0). Bay interval: samples 0→12, shoulders a=anchor 0 and b=anchor 4,
central witness (.280,-.065). Reverse the pocket polygon exactly once as in the retained
CCW mother-coast construction, preserving the explicit ordered mouth [a,b]. Set
`mouthKind:'wedge-geodesic'`. No mode fallback. Island anchor indices are [63,65,79,81,82,83];
each references the actual directed exposed mother-coast edge to its successor. They are
declared now for compatibility, but no detached geometry is placed in this body-only experiment.

## Two exact regional displacement tables

Let supplied anatomy be [u0,v0] within [-1,1]² and variation be 0..3. Let
g=[1,.85,.6,.3][variation], u=g*u0 and v=g*v0. Before sampling, set each anchor
to central[i]+u*U[i]+v*V[i]. Unlisted entries are exactly (0,0).

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

Before fitting, witnesses are defined by these exact affine formulas:

- lobe 0 disk=(0,.525)+u*(.010,0);
- lobe 1 disk=(-.150,-.560)+v*(.008,-.006);
- peninsula disk=(-.680,-.050), unchanged;
- interior witness=(-.100,0), unchanged;
- bay witness=(.280,-.065)+u*(.004,0)+v*(0,.004).

Roots, far endpoints and sites always reference the displaced sampled coast; never recompute
their identities by proximity. These deterministic formulas consume the existing two anatomy
values and introduce no random stream, new index search or per-vertex randomness. The local
60-case matrix supplies the values directly; it does not substitute a new RNG for production.

## Analytic review boundaries

The central directed mouth has det(a,b)=.12955>0. The unscaled exterior cardinal tangent
directions at the shoulders are v_a=anchor 28 minus anchor 1=(.170,-.150) and
v_b=anchor 5 minus anchor 3=(.360,.180). Their active radial-face tests are
det(a,v_a)=-.03610 and det(v_b,b)=-.10980, both strictly excluding. The positive .12 sampler
factor does not change these signs. A reviewer must check the complete displaced formulas;
central signs are not a claim of whole-case clearance.

The bay coast is entirely in the B index complement. Its witness is intended to be behind the
mouth and clear of the new head; its containment and area have not been established. The
complete positive boundary must avoid the frozen expanded water wedge except at the exact
structural shoulders. Tangent directions alone never prove those segment predicates.

The lower-lobe root change reallocates actual land from B to a separately credited exterior.
This is a principal risk: B must still occupy ≥.55Q, each required lobe ≥.08Q, sum ≥.20Q and
ratio ≥1.5. The new northern outline may also change this ratio. No quota-independent assertion
of compatibility is made. Peninsula share ≥.05Q, width .08..16, extent .20..45 and ratio ≥2 remain
unchanged. Width uses validated root/far; extent remains from the original actual root.

Interior radius ≥.15, bay depth ≥.15, opening .12..30, depth/opening ≥.5, removed share ≥.02,
cap/guard rules and total 256 vertices remain frozen. The chosen westward interior disk is a
new pre-fit witness, not a search after a failed disk. Local angular/cap checks may falsify
the recipe at the largest or balanced fit; that outcome is retained, not repaired by target
relaxation or favorable feature relabeling.

## Exact local experiment

After independent literal design review, implement only this private A constructor and its
body-only capture/replay/tests. For each of three quota expressions

1. .13106846473029043*.9905;
2. .10494186046511626*.9905;
3. .06666666666666667*.984;

use anatomies (0,0),(-1,-1),(-1,1),(1,-1),(1,1), and variations 0,1,2,3: exactly 60 cases/state.
Stitch B and roles, compute raw polygon area, apply one uniform scale
sqrt(4π*quota/rawBodyArea) to all coordinate-valued geometry and witnesses, set primary=true,
islands=[], and certify against that exact declared quota with frozen issue 178 options
`{nominalClearance:.05,collarWidthUpperMode:'root-and-far'}`. Do not reassociate quota arithmetic
when replaying receipts. No islands, placement, 134-case corpus or world render is authorized here.

Capture source before first execution; retain all 60 outcomes, failures included, then exact
repeat and guarded replay. Render one native local panel with the three central-anatomy,
variation 0 paid sizes, and an exact half-size counterpart, using the established plain palette.
No labels or overlays may supply missing hierarchy. Other fixed-case thumbnails may be retained
only as the predeclared local diagnostic, not as extra shapes or tuned trials.

The observable result is whether a complete whole-coast/role reauthoring produces a certified
unlabelled local silhouette with one broad shoulder/flush bank instead of two opposing jaws.
A numeric pass with repeated lip/slot grammar is a failure. At most a second complete state may
be specified after an explicit first-state diagnosis and independent review, then captured and
tested on the same 60 cases. No intermediate parameter scan or hidden favorable fit is allowed.

If both states fail, close this bounded experiment as rejected. A demonstrated analytic conflict
may stop before execution, but absent constants or unfinished drafting cannot count as a result.
Only a successful local proof of concept supports a separately scoped whole A/B/C family design;
it does not prove native-world behavior, paid island placement, control semantics, production
12/6/128 evidence, cross-platform equality, accepted ADR or human visual acceptance.
