# Issue 173 — mathematical review and scope

The design selects one finite sufficient class, rather than a general geodesic polygon engine.
The main task independently checked the signed area cancellation, the boundary tangent Hessian,
the concavity sign, planar support versus great-circle support, and the outward-lens gluing
argument. A separate mathematical reviewer checked the same proof and the local arithmetic.
The [independent record](independent-review.md) preserves its disposition and clarifications.

Two review clarifications were incorporated: the origin must have an explicit positive support
distance margin, and the exact projection formula measures the declared witness's distance to
the mouth, which is a lower bound on maximum bay depth. It does not measure the entire pocket's
maximum depth. A counterexample also prevents claiming that planar origin-side support implies
every land point lies on the same great-circle-plane side.

The [corroboration script](corroborate.mjs) uses ordinary binary64 arithmetic and assertions.
It checks signed reversal, radial zero correction, the known `2*atan(1/15)` triangle, convergence
of a sampled triangle area, a positive nonradial bay, simple planar B/E/pre-cut area identity,
water-witness membership, and both interior and endpoint arc-projection cases. It records the
sufficient opening interval, line-distance depth lower bound, ratio and planar removed-area
lower bound. Samples corroborate an equation; they do not supply the continuous topology proof.

The [saved output](corroboration.json) reproduces exactly after formatting. The positive bay's
opening interval is about `[.222486,.258893]` radians, its depth lower bound is `.213216`, and
its ratio lower bound is `.823568`. Its planar area `.05935` steradians exceeds the largest
retained required bay removal `.03262816`. No full primary, quota-fit constructor or world
acceptance is claimed. The required negative geometric cases are specified in the design and
must become executable regressions in the certificate successor.

```sh
node docs/investigations/issue-173/corroborate.mjs
corepack pnpm exec prettier --check docs/investigations/issue-173
corepack pnpm exec eslint docs/investigations/issue-173
```

Relative links and public-content checks pass; staged whitespace and repository precommit checks
accompany the local commit. No new production implementation or dependency was introduced.
The broader production/native stages and the original root-check timeout plus successful
targeted recovery remain recorded in [issue-168 verification](../issue-168/verification.md).
Those unchanged stages are reused. This design's new arithmetic and proof received the focused
checks above, and no clean single root run or formal interval arithmetic is invented.

The implementation successor is deliberately limited to the new private bay predicate, preserved
radial regression, adversarial tests and independent review. A new constructor comparison is a
separate step; accepted v1/v2, production C1–C3 and human decisions remain untouched.
