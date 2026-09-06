# Issue 175 — radial water-wedge design

**Proceed to a bounded private predicate implementation.** The [design](design.md) proves a
more permissive sufficient bay class than issue 174's global supporting half-plane. Land may
extend beyond the mouth line outside the angular opening sector, while the geodesic mouth and
its outward lens remain protected by a finite three-half-plane exclusion test.

The [local example](corroboration.json) is rejected by the old global-support predicate but
satisfies the new exclusion proof and every adopted bay measurement. The main task and
[independent reviewer](independent-review.md) checked the continuous geometry and its finite
algorithm. [Verification](verification.md) records the corrected endpoint derivative, clipping
boundaries and numerical limitations. This is a local bay proof, not a complete primary or world.

The next issue must implement and independently review the new opt-in predicate with adversarial
segment, shoulder, island and witness tests, preserving both previous modes. A separately bounded
constructor can then test whether this freedom improves the rejected silhouettes. No target,
quota, production source, accepted data or prior evidence changes. Human visual acceptance is
pending, and all commits remain local with no Git pushes.
