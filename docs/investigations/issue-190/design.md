# Complete literal primary gulf prototype — proposed first state

This is an unexecuted design. No candidate builder, sampler, certificate, parameter scan or
image has been run for these literals. Issue 188 demonstrated only subordinate component
expressiveness. This proposal tests a whole primary with a required peninsula forming the
lower bank of its required gulf; no independent third terminal peninsula is added elsewhere.
The frozen 188 whole-body mode and every adopted issue 167 target remain mandatory.

## Mechanism and composition

The major western lobe occupies the left flank of a broad connected core; the distinctly smaller
northeastern lobe caps the opposite upper flank. The required peninsula is the short southeast
extension. Its upper coast is the lower gulf bank. The upper gulf shoulder continues northeast
into the substantial upper body, rather than turning immediately back at a mouth extremum.
Both banks are part of the same periodic coast authored before its role partition. The
peninsula has a broad attachment root and a narrower validated far cut, with a curved taper
and no terminal bulb. This composition is not a reflection or three-anchor adjustment of 187.

This is a hypothesis about a different relation between whole coast and role inventory, not a
promise that the resulting gulf will be attractive. The local test must reject persistent
opposing jaws, an assembled tab appearance, or an unconvincing mass hierarchy even if numeric
certification passes. Large-3, companion bodies, worlds and existing family sources stay frozen.

## Fixed sampling and coordinate rules

Use the frozen 172 `sampleCoast` with exactly three samples per anchor span and tension .12.
The 23 anchors below are periodic, without a repeated closing anchor: 69 sampled coast points.
Coordinates are raw planar LAEA coordinates. The selected chart origin is fixed in this table;
there is no recentering, rotation, shear, fitted control-point change or cap search.

| Anchor | x     | y     | Fixed use                                                  |
| ------ | ----- | ----- | ---------------------------------------------------------- |
| 0      | .540  | -.080 | Lower mouth shoulder a; peninsula far endpoint             |
| 1      | .250  | .000  | Peninsula root endpoint h; internal bay shoreline junction |
| 2      | .210  | .080  | Gulf head                                                  |
| 3      | .530  | .100  | Upper mouth shoulder b                                     |
| 4      | .650  | .240  | Small lobe root start; continuing upper flank              |
| 5      | .650  | .440  | Small lobe far endpoint                                    |
| 6      | .470  | .620  | Northeast outer margin                                     |
| 7      | .240  | .680  | Small lobe far endpoint                                    |
| 8      | .020  | .570  | Small lobe root end                                        |
| 9      | -.050 | .430  | Core upper margin                                          |
| 10     | -.190 | .430  | Core upper margin                                          |
| 11     | -.310 | .440  | Large lobe root start                                      |
| 12     | -.570 | .400  | Large lobe far endpoint                                    |
| 13     | -.770 | .190  | Western outer margin                                       |
| 14     | -.780 | -.080 | Western outer margin                                       |
| 15     | -.630 | -.340 | Large lobe far endpoint                                    |
| 16     | -.410 | -.480 | Large lobe root end                                        |
| 17     | -.240 | -.490 | Core lower margin                                          |
| 18     | -.030 | -.530 | Core lower margin                                          |
| 19     | .180  | -.490 | Core lower margin                                          |
| 20     | .290  | -.400 | Peninsula root start r                                     |
| 21     | .540  | -.195 | Peninsula far endpoint f                                   |
| 22     | .585  | -.130 | Curved distal peninsula tip                                |

The tip tangent is vertical: the preceding and succeeding anchors 21 and 0 have the same x.
The two sampled cubic spans therefore meet smoothly at the distal turn. The coast is the
sampled polygon itself; no later image-only smoothing or different analytic coastline is used.

## Complete regional displacement declaration

The caller supplies anatomy=[u0,v0], each in [-1,1], and variation in {0,1,2,3}. Let
amplitude=[1,.85,.60,.30][variation], u=amplitude*u0, v=amplitude*v0. Before sampling, add
u*U_i + v*V_i to anchor i. Every omitted vector is exactly (0,0).

| Anchor | U dx | U dy | V dx  | V dy  |
| ------ | ---- | ---- | ----- | ----- |
| 5      | .000 | .010 | .000  | .000  |
| 6      | .005 | .020 | .000  | .000  |
| 7      | .005 | .025 | .000  | .000  |
| 8      | .005 | .010 | .000  | .000  |
| 12     | .000 | .000 | -.008 | .006  |
| 13     | .000 | .000 | -.020 | .015  |
| 14     | .000 | .000 | -.020 | -.010 |
| 15     | .000 | .000 | -.008 | -.012 |
| 16     | .000 | .000 | .000  | -.005 |

These are two predeclared regional shape coefficients, not new random draws. All peninsula and
gulf anchors, and their immediate shoulder neighbors, are fixed across the whole displacement
box. Their bay/peninsula relationship does not change in response to a failed fit. The center's
four amplitudes coincide, so the corpus contains 60 cases, not 60 distinct shapes.

## Exact fixed role partition and witnesses

Use the new 188 partition entry, with the following role order and sampled indices. Anchor i
maps to sample 3*i. All role arcs follow the positive mother-coast order, wrapping only for P.
The constructor must reject a nonpositive mother coast instead of silently relabelling roles.

| Role          | Start | End | Far endpoints | First disk center before fit |
| ------------- | ----- | --- | ------------- | ---------------------------- |
| Large lobe L1 | 33    | 48  | [36,45]       | (-.460-.005v, -.010-.002v)   |
| Small lobe L2 | 12    | 24  | [15,21]       | (.390+.004u, .480+.010u)     |
| Peninsula P   | 60    | 3   | [63,0]        | (.360,-.170)                 |

Interior witness is fixed (-.050,-.060). Bay interval is sampled indices 0 through 9 inclusive,
with mouth [sample0,sample9] and witness (.320,.025). Normalize the pocket ring and ordered
mouth together exactly as the reviewed helper specifies. Set `mouthKind:'wedge-geodesic'` and
certificate option `bayCoastMode:'whole-body'`, with `collarWidthUpperMode:'root-and-far'` and
nominal clearance .05. Every owner is explicitly `primary:true`.

The bay's first three sampled edges belong to P, ending at P root endpoint sample3. Its
remaining six coast edges belong to B. The mouth shoulder at sample0 is a far endpoint of P,
not a root endpoint. The other mouth shoulder sample9 is not a role endpoint. Role intervals
are mutually disjoint; the bay overlap is solely shared actual exterior coast. Internal roots
must never be credited as bay coast. There are no detached islands or margin sites in this
body-only prototype.

## One paid fit and exact corpus

Construct the whole coast and declared surviving partition once, stitch its actual body,
then compute A as the sum of the disjoint surviving B and role shoelace areas. For declared
body quota q, use s=sqrt(4*pi*q/A) exactly once. Scale every coordinate of B, S, roles, root,
far cut, disk, bay, mouth and witnesses by the same s, preserving all non-coordinate metadata.
Do not subtract the bay from A again. No area target is achieved by changing an anchor after fit.

Use precisely the three existing 187 expressions:

1. .13106846473029043 * .9905
2. .10494186046511626 * .9905
3. .06666666666666667 * .984

For each, execute anatomy center (0,0) and corners (-1,-1),(-1,1),(1,-1),(1,1), each at all four
amplitudes in the fixed order above. The fixed corpus is 3*5*4=60 body-only cases. No public
water/control semantics, default-seed audit, placement solver, owner-count variation or world
matrix is included. All paid fits must pass the exact unchanged primary certificate.

## Analytic feasibility rationale and its limits

The following are hand calculations on the declared unsampled anchor chords, not measurements
of the proposed sampled coast. Their purpose is to expose an obvious incompatible design before
execution. The actual fixed 60-case certificate remains decisive.

At u=v=0 the anchor-polygon area ledger is:

- B .69055
- L1 .29245
- L2 .12725
- P .0733625
- Total surviving body 1.1836125

This gives approximately 58.3% B, 24.7% and 10.8% lobes, and 6.2% P. The lobe ratio is about
2.30. Those margins leave room above the .55/.08/.20/.05 share floors; they do not prove the
sampled area shares at the displacement corners. Sampling and the regional changes alter all
those actual areas, and no favorable reclassification is permitted.

The peninsula's root and far coordinates are unchanged across u/v. Its lower collar prefix
is the span r->f: every cubic control has y<=-.195. The opposing prefix is a->h, whose controls
have y>=-.080. Thus their Euclidean separation is at least .115 and equals .115 at the far
endpoints. The far segment x=.540 joins those endpoints. The head initially lies to its right;
its nonzero distal region must still pass the actual simple T/C/D tests. The declared disk center
has root-line clearance greater than .09, at least .09 clearance from the upper-prefix half-plane,
and greater lower-prefix/far clearance. Root/far/disk topology is not inferred merely from this
width arithmetic.

At the literal tip, distance to the ORIGINAL root segment is .1288/sqrt(.1616), about .3204;
its perpendicular projection is internal to the root. All peninsula cubic controls provide a
finite conservative extent upper of .322 before the uniform fit. This width and extent pair is
compatible with the far-cut witness, without imposing a narrow actual root or flaring terminal
head. Exact c, s, area, extent and collar minima at all 60 cases remain measured gates.

For the fixed mouth, b-a=(-.010,.180), det(a,b)=.0964>0 and width=sqrt(.0325). The witness has
positive chord-side numerator .03855, giving raw line depth .03855/sqrt(.0325), about .2138.
The anchor-chord pocket [a,b,anchor2,h] has raw area .0389. These opening/depth/area margins are
plausible at the three paid sizes, but only the sampled pocket area receives credit. All
nonmouth bay cubic control points are strictly on the origin side of the mouth chord; their
sampled edges inherit that half-plane property.

The two actual sampled structural shoulder edges have strictly negative exclusion signs over
the complete u/v box. From a toward its immediately preceding sample, delta is
(.0295333333333,-.0168296296296), giving det(a,delta) approximately -.00672533. From b to its
immediately following sample, delta is
(.0513777777778,.0357629629630-.0002666666667u), giving det(delta,b) approximately
-.01381759259+.00014133333u, which remains below -.01367. The u term comes from
the next-next anchor 5 in the sampled cubic, even though the mouth tangent itself is fixed. These are the radial-face active derivatives, not the affine chord
function applied incorrectly to a direction. The whole-body wedge test must additionally check
every other actual edge, all topology and the cap; these two signs alone are not a full proof.

The raw large-lobe collar is a broad strip between root33/48 and far36/45, with its disk away
from both cuts. The small-lobe collar similarly lies between root12/24 and far15/21. Their
proposed disk centers have comfortable chord-scale clearance centrally, but corner containment
is an explicit unproved certificate obligation. The sampled cap and the balanced body's actual
guard are also unproved; no claim of six-owner placement follows from local compactness.

## Execution boundary and stopping rule

Independent literal review must precede implementation or any useful geometry evaluation.
Pin the full literal source, corpus, design/review, exact dependencies and tool versions before
the first import that constructs this geometry. The first execution retains all 60 outcomes,
including every failure, and the three central quota panels at native and half size. Use the
same 900x320, 450x160, span2.5 local panel convention as 187 unless the issue declares another
inventory before capture. It is a local component-body diagnostic, not a world image.

At most two complete material states are permitted. This document specifies the first only;
a second requires a concrete first-state diagnosis and a complete independently reviewed new
literal/displacement/witness table before execution, bound to the retained first result. No
hidden parameter sweep, local repair calls or third state is allowed. All source must be
formatter-idempotent before freeze, and trusted exact-source replay must precede any retained
runtime execution. Malformed boundary tests and exact replay do not create additional useful
geometry variants.

Stop if the finite unchanged certificate rejects the complete state or if local review still
finds a mechanical mouth/projection grammar. A second state is justified only by a specific
bounded diagnosis; exhausting it ends this prototype with an honest result. Numeric failure is
not erased by relabelling a primary as subordinate. A local numerical and visual pass would
justify a separately scoped family investigation; it would not select v3, prove whole-world
controls, or establish human acceptance.
