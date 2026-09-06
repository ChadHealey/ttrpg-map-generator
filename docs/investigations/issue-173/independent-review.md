# Issue 173 — independent mathematical review

**Decision: the reviewed sufficient class justifies one bounded private implementation.**
I independently checked [design.md](design.md), ran the read-only
[arithmetic corroboration](corroborate.mjs), and checked the local pocket topology with the
unchanged issue-169 polygon helpers. No unresolved mathematical correctness finding remains
in the selected planar-support construction. This is not a complete owner, world, visual,
production or formally rounded numerical certificate.

## Area and orientation

For `A=p(a), B=p(b)`, the north-pole triangle numerator is
`s(a)s(b)det(a,b)` and its denominator is
`s(a)s(b)(4s(a)s(b)+a·b)`. Cancelling the positive factor yields the stated solid-angle
formula. The reduced denominator is at least `4cos(alpha)>0` for `alpha<=1.4`, so the
chosen branch has no wrap ambiguity. Replacing the mapped straight chord's planar area
contribution by the geodesic contribution gives
`signedArea(E_curved)=signedArea(E)+T-det(a,b)/2`.

The signs reverse when both the pocket traversal and mouth reverse. Reversing the mouth
array alone does not describe the same oriented boundary. The same-ray radial case has
zero correction. The separate known example `a=(.5,0),b=(0,.5)` reduces to
`T=2atan(1/15)`, approximately `.1331363275516476` steradians. The script's sampled
convergence corroborates that value; it is not used as a continuous topology proof.

## Continuous exclusion and the outward lens

I independently differentiated the plane equation after rotating `gxy=(-k,0)`.
On its boundary, the tangency relation is
`gxy·v=gz(2+z)(u·v)/(4s³)`. Substitution into the second derivative gives exactly

```text
vᵀ Hess(h) v = -gz(2+z)|v|²/(4s²) - gz(4+z)(u·v)²/(16s⁴).
```

Both terms have the required sign for `gz>0,z>0`. The boundary is a unique graph
`x=f(y)>0`: `x` increases while `(gz/k)z/s` decreases with `x`. Its `hx<0` and negative
tangential second derivative imply `f''<0`. The minor arc stays in the convex northern
cap and follows that graph between its endpoints, strictly outside the chord.

The selected predicate uses the **planar** linear functional `L`, not a sampled test of
the curved great-circle-plane function. Strict positive vertex signs imply strict signs
throughout each straight edge and positive polygon interior. With no edge joining both
shoulders, the only permitted contacts with `L=0` are the two structural shoulder
endpoints. All roles and islands retain the inherited contact exclusions.

Consequently the outward lens on `L<0` is free of every positive polygon. The old simple
planar water pocket on `L>=0` meets that lens only along the chord. Gluing them preserves
a simple curved pocket and a simple counterfactual pre-cut body, without changing actual
positive land or its quotas. The declared planar witness remains inside the curved pocket.

Planar support must not be presented as global great-circle-side support. I checked the
counterexample in the design: with shoulders `(.65,-.12),(.65,.12)`, point `(.64,1)` has
`L=.0024>0` and chart angle about `1.27113`, yet `(A×B)·p(u)≈-.0501557664`. This does not
invalidate the selected lens proof; it explains why the two support claims stay distinct.

## Sufficient measurements and useful local example

The conservative successor is sound without using the analytic correction to pass a gate:

- Planar pocket area is a lower bound because the added lens has positive area.
- `c|a-b|` and `|a-b|/c` bound the true mouth opening.
- Every arc point is across the chord line from the witness, so the witness's distance
  to that infinite line, multiplied by `c`, bounds its spherical distance to the arc below.
- Witness-to-arc distance is itself a lower bound on the maximum pocket depth. Dividing
  its lower bound by the opening upper bound gives a valid depth/opening lower bound.

The cap factor must cover the witness and the complete arc. The declared cap does so:
`alpha<pi/2` makes it geodesically convex, and its planar disk also contains the lens.
Using the positive example's actual maximum planar radius `.75` gives these independent
values:

| Quantity                                              |    Independent value |
| ----------------------------------------------------- | -------------------: |
| Containing angular radius                             |  `.7687935489912782` |
| Metric factor `c`                                     |  `.9270248108869579` |
| Opening lower bound                                   | `.22248595461286988` |
| Opening upper bound                                   | `.25889274718588495` |
| Depth lower bound                                     | `.21321570650400032` |
| Depth/opening lower bound                             |  `.8235677083333334` |
| Planar removed area, steradians                       |             `.05935` |
| Largest retained removed-area requirement, steradians | `.03262815764142325` |

The unchanged polygon helpers also corroborated simplicity of `B`, `E`, and planar `B0`,
witness containment in `E` and exclusion from `B`, and pre-cut area `1.1005`. These facts
establish a useful local example with substantial numerical margins. They do not assert
that a complete primary or a visually acceptable family can be constructed around it.

## Corrections resolved and remaining boundary

Two review clarifications are incorporated in the final design:

- The chart origin receives the explicit support margin `L(0)/w>EPS`, so a nearly radial
  positive determinant is not accepted under an unspecified near-zero rule.
- The analytic projection formula is named as exact **witness-to-mouth distance**, a
  lower bound on maximum bay depth, rather than an exact calculation of the pocket maximum.

The planned negative cases address extra chord contacts/crossings, lens and planar-pocket
intrusion, incorrect ordering, degeneracy, unsupported chart radius and invalid witnesses.
They must precede acceptance of a new private predicate. Exact formulas remain diagnostic;
existing binary64 EPS/slack checks are not formal outward arithmetic. No unresolved sign,
nonfinite intermediate or diagnostic branch choice may convert failure into success.

One bounded private bay-predicate implementation with those tests is justified. A new world
comparison, constructor redesign, target relaxation and production integration are separate
decisions. Earlier rejected evidence remains unchanged.
