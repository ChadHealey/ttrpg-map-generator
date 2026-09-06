# Issue 178 private certificate implementation

The explicit `collarWidthUpperMode: 'root-and-far'` option uses the shorter of two validated
crosscut upper witnesses. It leaves the adopted targets, root, collar, whole first disk, credited
feature area and extent definition unchanged. The [approved design](design.md) and
[independent checkpoint](independent-design-review.md) establish the proof boundary.

The private [certificate](certificates.mjs) copies frozen issue 176 and imports its bay helpers
without editing them. The absent option and explicit `'root'` preserve historical full result
objects, including metric schema, numeric values and failures. Unknown mode values reject at the
input boundary. New mode is selected by the caller before fitting; the certificate has no retry,
crosscut search, mode fallback or favorable relabeling.

`deriveCollar` returns its exact far endpoints only after existing root, exposed prefix, far-contact,
interior-crosscut, C/D simplicity, shared-boundary and area checks succeed. The new branch requires
finite positive lengths and computes `(length + 2*EPS)/c` for both R and T. It selects the smaller
upper bound and chooses R on an exact tie. The role metrics expose `widthUpperRoot`, `widthUpperFar`
and `widthUpperWitness`; the new-mode result also names `collarWidthUpperMode`. These fields are
absent from historical root mode.

The selected `widthUpper` is used by the existing peninsula upper-width and extent/width tests.
The opposing-chain distance remains exclusively a lower-bound source. Extent still measures
shortest distance to original R. A failed T/C/D derivation emits no role upper witness; a missing,
distal or clipped first disk remains an independent rejection even if a short far bound exists.
Other body/feature contacts, quota, share, bay, island and primary-inventory gates remain active.
EPS is still 1e-10 and target slack 1e-9. These are binary64 diagnostic bounds, not formal interval
arithmetic or a production compatibility promise.

## Focused compatibility and rejection checks

The tests compare complete old/default/explicit-root results for every retained issue-172 radial
and issue-177 wedge owner, plus supporting and wedge success/rejection examples. They also cover
broad-root tapered acceptance in explicit new mode, smaller-root selection, exact ties, malformed
options and nonfinite far coordinates. General collar regressions retain invalid/missing/coast-edge
far endpoints, extra far contacts, outside cuts, narrower throats, alternate body bridges, hidden
coast and missing/distal/clipped disks. A fixed spiral collar has a true shortest opposing-chain connection across the exterior gap:
its midpoint is outside C. The test confirms that this .027538 planar distance remains a lower-bound
source and cannot replace either admissible upper witness. The collar and whole disk are valid,
while width/extent obligations honestly reject the complete fixture. Candidate inputs remain
unmodified and repeated results are equal.

```sh
corepack pnpm exec vitest run docs/investigations/issue-178/certificates.test.mjs docs/investigations/issue-178/collar-regressions.test.mjs
```

## Fixed local taper witness

The [example](taper-example.mjs) is a complete subordinate B+P topology witness. Its honest
`primary: false` designation does not supply missing lobe/bay anatomy for a supposed primary.
The same candidate and exact quota are checked with old, explicit-root and root-and-far modes;
only the two old upper-width/ratio failures disappear.

The P area is .1032 steradians, exceeding the largest primary's absolute .0815703941-sr P floor.
At the candidate's measured Lambert factor, root upper is .641426981 rad, far upper .128285396,
width lower .112249721, extent upper .342094390 and extent/width lower 2.333333329. The whole
first-disk lower radius is .093541434. This demonstrates the useful bound on a literal polygon,
not an acceptable continent silhouette, complete primary, paid-island set or world proposal.

The [silhouette](local-taper/silhouette.png) was inspected and is deliberately a rectangle with a
triangular projection. The [labeled diagram](local-taper/labeled.svg) marks R, T and the required
disk. No organic-anatomy or human/world acceptance follows from these local certificates.

[Local evidence](local-taper/manifest.json) captures the entire source closure, old/new receipts,
PNG and SVG bytes. The default command is read-only: it loads frozen source text, repeats the
certificates and drawing in memory, and compares all artifacts and dependency hashes.

```sh
node docs/investigations/issue-178/taper-evidence.mjs
```

The `--write` flag exists only to create a new evidence directory and deliberately fails if the
directory exists. It does not replace retained evidence. The separate complete-primary local
construction is owned and documented by the parent investigation; no full matrix is authorized.
