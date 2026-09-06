# Fixed-radius packing audit of issue-169-r1

The immutable [r1 receipt](comparison-r1/results.json) reports placement exhaustion for all four
ordinary rows, after their local geometry certificates passed. The necessary conditions below
show that their **retained radius combinations cannot be packed at any centers**, independently
of the search budget. This rejects those constructed footprints, not all shapes satisfying the
adopted targets, every placement under another radius combination, or the separated-envelope
policy itself. Control rows failed local construction first and have no accepted r1 radii.

All distances/radii are radians on the unit sphere; `g=.05` is the unchanged cap gap. Dot-product
inequalities and proofs below are real-arithmetic statements. Reported numerical values are
binary64 reconstructions, not formal directed-rounding bounds. Their failure margins exceed
rounding uncertainty by many orders of magnitude.

## Two equal primary and two equal subordinate radii

Let centers `p1,p2` have radius R and `s1,s2` radius r. Assume `2R+g≤π` and `2r+g≤π`;
otherwise the corresponding pair already cannot fit. Put `P=p1+p2`, `S=s1+s2`. Pairwise gaps
require

```text
|P|² = 2+2 p1·p2 ≤ 2+2cos(2R+g) = 4cos²(R+g/2),
|S|² ≤ 4cos²(r+g/2),
P·S = sum of the four primary/subordinate dot products ≤ 4cos(R+r+g).
```

Cauchy's inequality gives `P·S≥-|P||S|`. Therefore a necessary condition is
`cos(R+r+g)≥-cos(R+g/2)cos(r+g/2)`. Equivalently, the requested cross-group separation may not
exceed `acos(-cos(R+g/2)cos(r+g/2))`. This is a bound on every possible center arrangement,
not an assumption of a tetrahedral or symmetric layout.

For retained normal-01, `R=1.1391717987182857` and `r=.7311773783120331`:

| Quantity                                        |          Value |
| ----------------------------------------------- | -------------: |
| Requested common primary/subordinate separation | 1.920349177030 |
| Necessary upper bound on that common separation | 1.862642001791 |
| Violation                                       | 0.057707175239 |

The retained two-plus-two cap allocation is impossible. Increasing placement attempts alone
cannot rescue it; at least one footprint/radius must change while all target checks still hold.

## Three equal primary radii and one subordinate radius

Let the primary centers have radius R, subordinate center s radius r, and `P=p1+p2+p3`.
Write `t=cos(2R+g)` and `u=cos(R+r+g)`. Pairwise gaps require `|P|²≤3+6t` and `P·s≤3u`.
If `3+6t<0`, the primary triple is already impossible. If `u<0`, Cauchy's inequality implies
`|P|≥-3u`, hence `9u²≤3+6t`. Thus the requested common primary/subordinate separation cannot
exceed `acos(-sqrt((1+2t)/3))`. This derives the obstruction without assuming the three
primaries are on one latitude or equally spaced.

Normal-02, normal-03 and normal-04 share the retained radii
`R=1.0139846732370452`, `r=.6570801690645831`. Here `t=-.4857080679104869` and
`sqrt((1+2t)/3)=.09761124282756614`.

| Quantity                                        |          Value |
| ----------------------------------------------- | -------------: |
| Requested common primary/subordinate separation | 1.721064842302 |
| Necessary upper bound on that common separation | 1.668563243934 |
| Violation                                       | 0.052501598368 |

All three retained three-plus-one radius allocations are impossible. This conclusion is
separate from their repeated silhouette/arrangement limitations or any later visual assessment.

## Six equal owners and compactness targets for a repair

Among six unit vectors in three dimensions, some pair has nonnegative dot product. To see why
strictly negative pairwise dot products cannot occur for even five vectors, take an affine
dependence of five points, split its positive and negative coefficients, and normalize their
sums to one. Both convex combinations give the same vector x. Their cross-group dot-product
expansion would give `|x|²<0`, a contradiction. Thus some separation is at most `π/2`.

Six equal cap radii consequently require `r≤(π/2-g)/2=.7603981633974483`. The octahedral
center arrangement attains this center-distance bound, but does not establish admissible
anatomy, sampled coverage or acceptable visual arrangement. Radius .75 leaves little spacing
freedom; the explicit balanced control must still be interpretable under the unchanged contract.

For an illustrative nominal radius r, the usable chart radius with .05 clearance is
`R_chart=2sin((r-.05)/2)`, and owner-area occupancy of its usable cap is
`q/((1-cos(r-.05))/2)`. The following are useful local footprint targets, not adopted product
requirements or proofs that a fitting anatomical shape exists:

| Owner quota q      | Illustrative guard radius r | Maximum chart radius | Required usable-cap occupancy |
| ------------------ | --------------------------: | -------------------: | ----------------------------: |
| .13106846473029043 |                         .95 |        .869931068222 |                 .692769120430 |
| .04393153526970955 |                         .60 |        .543093873912 |                 .595780883483 |
| .06666666666666667 |                         .75 |        .685795614911 |                 .566995124651 |

In retained normal-01, the primary B reaches chart radius .746832, but lobe 1 reaches 1.036128,
lobe 2 reaches .934952, peninsula reaches 1.029034, and islands reach approximately .95–.984.
The subordinate B reaches only .484840 while its islands reach .643–.668. Therefore compacting
only the broad interior would miss much of the actual footprint. A bounded repair can shorten
radial head reach by using wider heads, move sockets inward where the topology permits, orient
extensions along suitable margins, and place islands in genuinely free margin pockets. It must
recheck every attachment, bay, role share and detached channel; it cannot simply clip at a cap.

## Independent local control failures

The retained connected-majority row has six equal quotas `.06666666666666667`. Across its eight
candidates per owner, failures include first-disk radius, attachment width, peninsula minimum
extent, bay depth and island contact. For owner 0/template 0, lobe disk lower bounds are .047067
against .05, peninsula width .075307 against .08, peninsula extent .190013 against .20, and bay
depth .125511 against .15. Packing cannot fix these post-normalization local failures.

The fragmented-islands row fails bay depth and actual island/body or island/island contact,
with additional attachment/disk/peninsula-ratio failures in some candidates. Removing only its
footprint bottleneck does not certify the control. The bounded repair must preserve each retained
failure, declare revised template/control geometry before another comparison, and rerun local
certificates before spending the full image budget. No target, owner count or quota is relaxed
by this audit.
