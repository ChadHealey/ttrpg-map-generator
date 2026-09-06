# Issue 176 independent implementation review

No actionable correctness, regression or test finding remains in the private
implementation. The explicit wedge mode follows the reviewed
[issue 175 proof and finite recipe](../issue-175/design.md). This clears the
predicate boundary for a separate constructor experiment; it does not accept a
complete primary candidate, world image or production generator.

## Proof-to-code mapping

[The segment predicate](wedge-segment.mjs) evaluates the three normalized affine
forms over whole straight edges. Ordinary edges use the EPS-expanded closed wedge,
omit near-parallel constraints conservatively and require interval separation
beyond the fixed parameter slack. Nonfinite and unresolved cases reject. Thus a
pair of outside endpoints is insufficient for acceptance, and contact remains a
rejection.

Structural shoulder edges use exact point identity and the correct active face at
each endpoint. A strictly negative value at the opposite endpoint proves exclusion
along the whole open edge. The implementation does not substitute affine L for its
linear derivative, waive an endpoint neighborhood, or allow an edge joining both
shoulders. Roles and islands use ordinary clipping even when they touch a shoulder.

[The mouth helper](wedge-mouth.mjs) checks every interior, stitched body, role and
island boundary. Exact directed mouth identity and consistent ring normalization
precede the predicate. The origin margin, strict planar pocket and witness support,
chart cap, opening/depth bounds and primary area floor remain unchanged. Existing
whole-candidate validation supplies finite and simple geometry, planar pocket and
pre-cut topology, paid area accounting, component contacts and all other anatomy
requirements.

[Certificate dispatch](certificates.mjs) adds only the explicit `wedge-geodesic`
mode. The supporting helper is imported unchanged from issue 174; radial checks
remain unchanged. Unknown modes reject and a failed wedge mode cannot fall back.
The fixed input bounds and constant work per edge remain intact.

## Independent verification

Ran both focused test files: **22 tests passed**. Reviewed the tests for the useful
seaward-land example, rotations and ring reversal; crossings with outside
endpoints; active-face entering and tangent edges; near-parallel and near-empty
clipping; lens and farther-wedge islands; seaward island acceptance; independent
role/island contacts; preserved pocket, witness, cap, malformed-input and dispatch
failures. The primary bay-floor test executes the actual helper gate at the largest
retained body quota while the complete candidate still fails for missing primary
anatomy.

Separately loaded both frozen issue-172 comparison result files and compared all
**54 stored radial certificate receipts** with the new certificate using strict
deep equality. Every complete result matched, without executing a historical
constructor or evidence writer. The focused tests also check complete retained
supporting-mode results against issue 174, including twelve chart rotations.

As an additional read-only adversarial check, enumerated 14,520 directed segment
pairs on the integer lattice from -100 to 100 in steps of 20, mapped to chart
coordinates by division by 100. For mouth (.65,-.12) to (.65,.12), independently
clipped the corresponding integer affine forms with BigInt rational endpoint
comparisons against the exact closed wedge. All 13,166 exclusions accepted by the
implementation were disjoint under that separate calculation. This finite check
supplements the proof review; it is not an exhaustive floating-point proof.

No prior evidence or runtime source was edited by this review, and no world images
were generated. The inherited binary64 EPS/slack assurance remains diagnostic,
rather than formally outward-rounded interval arithmetic. The conservative
unbounded wedge may still reject land beyond the actual lens. Neither limitation
is concealed by the local acceptance result.
