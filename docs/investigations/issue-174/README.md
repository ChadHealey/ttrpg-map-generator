# Issue 174 — private supporting-mouth certificate

**Completed private certificate; no world or v3 selected.** This applies the independently
reviewed [issue-173 design](../issue-173/design.md) under unchanged
[issue-167 targets](../issue-167/README.md). The previous radial certificate and all retained
issue-172 comparisons remain frozen.

The new private certificate opts into `bay.mouthKind: 'supporting-geodesic'`. Positive land
must stay strictly on the origin side of the planar mouth chord, apart from its two structural
shoulders. The geodesic's outward lens is then land-free. Acceptance uses the planar pocket's
area lower bound, Lambert opening interval and witness-to-infinite-line depth lower bound.
Exact curved measurements cannot override a failed sufficient check. An absent or explicit
`radial` kind preserves the previous path; an unknown kind rejects.

The implementation preserves every existing owner, general-collar, paid-island, topology,
quota and guard check. [Independent review](independent-review.md) found no actionable defect;
[verification](verification.md) records adversarial tests and exact radial regression. A later bounded coast constructor is a separate issue; this predicate alone cannot
resolve the rejected morphology or establish human acceptance.

All changes and commits remain local. No production source, dependency, accepted data or earlier
evidence changes, and no Git push is authorized.

The next bounded design question is whether restricting only the radial water wedge beyond the
mouth can safely replace global half-plane support. This may allow more
natural surrounding coast without a general curved-intersection solver; it requires its own proof.
