# Issue 178 independent design checkpoint

**No actionable mathematical or implementation-boundary finding remains in the
reviewed [design](design.md).** The explicit private upper-witness implementation
may proceed with its required adversarial and compatibility tests. No constructor,
world comparison, visual selection or production change is cleared by this review.

## Separator proof and first disk

The tighter bound is valid for the existing
[issue-171 collar definition](../issue-171/design.md): separators distinguish the
root/anchor side from the entire far-cut/distal side. The validated T is an interior
crosscut of F separating root-adjacent C from nonempty D. Its endpoint identities,
actual opposing coast prefixes, simple components and absence of additional contact
are necessary conditions, not optional consequences of a short measured length.

If the infimum admits only proper interior cuts in C, there are L-to-U polygonal
crosscuts approaching T in length. A small inward displacement works away from its
endpoints; short joins inside the endpoint corner sectors reach the corresponding
coast prefixes. This avoids assuming that a single parallel line handles every
collinear endpoint configuration. The cuts preserve the R-versus-T separation class.
Their mapped lengths are bounded by their planar lengths divided by c, giving
W <= |T|/c in the limit and hence W <= min(|R|,|T|)/c.

The whole first disk has strict clearance from T. Sufficiently close approximating
cuts therefore remain distal to it. They leave the disk on the root side: the proof
would not establish an upper bound for a different separator definition requiring
separation of R from that disk itself. The design explicitly preserves the existing
whole-collar R-versus-T/D definition and does not make that substitution.

## Implementation boundary

Only a successfully validated existing far cut may supply the new upper witness.
The opposing-chain minimum remains a lower bound; its minimizing chord need not
lie in C and cannot replace either upper witness. Extent remains measured from the
original root R. Credited feature area remains all of C union D, with the same
pre-fit role, root, far-cut and disk identities.

The selected `collarWidthUpperMode: 'root-and-far'` option is explicit and fixed
before fitting. Absent or explicit `'root'` must preserve the complete prior result,
including metric fields and failures. Unknown values reject without fallback.
New-mode metrics record both conservative upper bounds and the selected witness,
with root selected on an exact tie. Only widthUpper and its use in the existing
peninsula upper-width and extent/width tests change. Lower width, disk, topology,
area, bay and whole-owner obligations remain independent rejection gates.

## Restricted obstruction and counterexamples

Independently checked the straight spherical root-normal strip metric and bound
w sin(e). The value .06959448546 sr follows when the declared root length itself
is at most .16 and the strip extent at most .45. The adopted collar-width infimum
does not by itself impose that declared-root-length restriction. The bound therefore
does not prove universal target incompatibility.

The separate curved-sector and symmetric terminal taper calculations are sound:
their area lower bound exceeds .08157039410 sr, their extent stays below .45, and
the retained pre-tail collar supplies width .158 and a whole .04 disk. Curved
centerline length is not bounded by shortest distance to the original root. These
are standalone spherical geometry examples, not current polygon or owner certificates.

For the planar tapered witness, the trapezoid plus distal triangle has area .096 sr,
the opposing chains attain distance .12 at T, and the declared c=.9 gives the stated
far upper bound near .13333 and extent bounds [.315,.38889]. This validates the
usefulness of the additional witness without claiming a complete primary or an
acceptable silhouette.

The next checkpoint must independently inspect proof-to-code mapping and actual
default/prior-mode receipt equality. Numeric EPS/slack assurance remains diagnostic
binary64 arithmetic, not a formal outward-rounded interval certificate. Earlier
evidence and sources were not modified by this review.
