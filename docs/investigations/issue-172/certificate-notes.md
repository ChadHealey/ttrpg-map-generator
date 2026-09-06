# Issue 172 general collar certificate notes

This private investigation implements the reviewed [issue 171 design](../issue-171/design.md).
It copies the surrounding issue 169 candidate checks without editing that retained source.
Passing these diagnostics permits bounded construction experiments; it does not establish
world feasibility, visual acceptance, or production readiness.

## API and identities

`certifyCandidate(candidate, { quota, nominalClearance: 0.05 })` returns
`{ ok, failures, metrics }`. The candidate retains the issue 169 body, role, bay,
island, and witness fields. Each attachment replaces `collarHeight` with:

```js
collar: { far: [pointA, pointB], disk: point }
```

Coordinates are final LAEA chart coordinates. Both root endpoints and both far
endpoints must be exact existing feature vertices. The root is an exact edge shared
with the interior. Far endpoints exclude root endpoints. Constructors declare these
identities before fitting and scale `far` and `disk` with the rest of the geometry;
the old issue 169 `scaleCandidate` does not handle this new field.

## Derived topology and measurements

The certificate follows the unique exposed feature boundary from the first root
endpoint to the second. Far endpoints split this path into two opposing coast
prefixes and a distal coast. Their straight crosscut must meet the feature boundary
only at its declared endpoints and have its interior in the feature. It cannot be
a coast edge. Every prefix edge must remain an actual stitched body coast edge.

The crosscut defines a simple root-adjacent collar `C` and a nonempty simple distal
component `D`. They may share only that crosscut and must account for the feature
area. The certificate derives these components; it does not search for a favorable
collar. Reversing ring orientation or the far endpoint array preserves the topology.

Let `delta` be the minimum Euclidean distance between every pair of opposing prefix
segments, `w` the root length, and `c = cos(a / 2)` for the measured owner cap radius
`a`. The diagnostic root width interval is
`[c * max(0, delta - 2*EPS), (w + 2*EPS) / c]`. This applies to separators between
the root and the entire far/distal side, as defined in issue 171. It does not assert
that arbitrary cuts isolating a small coast pocket join opposing prefixes.

The declared disk center must lie strictly in `C`. Its full-boundary clearance gives
the contained spherical disk lower bound
`c * max(0, minBoundaryDistance(disk, C) - 2*EPS)`. Lobe and peninsula disk floors
remain `.05` and `.04` radians. Roles report the measured width bounds, disk radius,
opposing-chain distance, component polygons and component areas. The whole feature
is credited once. Existing role share, peninsula extent, body hierarchy, quota,
protected bay, island detachment, guard, vertex budget, and sole-root predicates remain.

## Numerical and scope limits

The implementation uses binary64 polygon predicates and distance calculations from
issue 169. Exact vertex identities, explicit boundary-contact rejection, `EPS=1e-10`,
two-EPS distance deductions, and target slack `1e-9` reject many ambiguous or marginal
cases. Quota and component area ledgers allow binary64 residuals of `1e-12`.
These are diagnostic tolerances, not a formal directed-rounding or interval proof.
No production quantization, sampled threshold, or marching-contour survival proof is
introduced here. The adopted continuous experimental contour remains zero with `D=0`.

## Review and regression record

The ten focused Vitest cases pass, along with focused ESLint and Prettier checks.
They cover the reviewed curved positive witness, orientation invariance, a valid
distal return, narrow necks, a disk outside the collar or clipped by its boundary,
invalid endpoint identities, an exterior or additionally touching crosscut, a second
body bridge, omitted coast edges, peninsula measurements, missing primary inventory,
quota mismatch, duplicate IDs, island contact, and malformed collar input.

An independent agent reviewed the source and surrounding topology without editing
the implementation and reported no actionable correctness finding. Its separate run
of certificate and readiness tests passed all 14 cases. This review supports the next
bounded local construction experiment and makes no human or world acceptance claim.
