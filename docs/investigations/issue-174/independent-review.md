# Issue 174 — independent proof-to-code review

**Decision: no actionable correctness finding in the reviewed private implementation.**
The new [supporting-mouth helper](supporting-mouth.mjs) and
[owner certificate](certificates.mjs) implement the sufficient class reviewed in
[issue 173](../issue-173/independent-review.md). The evidence below supports this bounded
predicate implementation, not a complete new constructor, world, visual pass or production v3.

## Boundary and proof mapping

The new path requires explicit `bay.mouthKind: 'supporting-geodesic'`. Missing kind and
explicit `'radial'` retain the predecessor's radial behavior; unknown kinds reject. A
supporting-mouth failure cannot route into the radial path or drop the bay.

The mouth must first be an exactly matching directed edge of the supplied pocket ring.
Clockwise normalization reverses the entire local ring and mouth together without mutating
the candidate. Reversing only the mouth or supplying a nearly matching endpoint rejects.
The origin receives the explicit signed-distance margin greater than EPS, so a nearly
radial supporting mouth cannot bypass the reviewed orientation restriction.

The linear support check includes the interior, stitched body, every declared role and
every island. Only the interior and stitched body's exact two shoulder coordinates receive
the structural endpoint exception. Roles and islands do not receive that exception. An edge
joining both shoulders rejects, and all other stored positive vertices must have strict
positive support. Checking the planar pocket and witness separately preserves the chosen
side of the water region. These checks supply the continuous linear-half-space premise of
the outward-lens proof; they are not sampling the curved arc.

The private owner certificate retains finite ring/component limits, polygon simplicity,
exact stitching, role attachments, general collars, paid area, protected planar water and
simple pre-cut-body checks. The supporting helper does not replace those obligations.
Its chart limit is applied to the complete measured candidate. The explicit witness-cap
check and inherited strict witness-in-pocket check prevent an unrelated witness from
using a metric factor that does not cover it. The minor arc then stays within the same
geodesically convex cap used by the design.

Acceptance uses only the reviewed sufficient quantities: a Lambert opening interval,
witness distance to the infinite chord line multiplied by the metric factor, the resulting
depth/opening lower bound, and planar pocket area as a removed-area lower bound. The area
correction is not added to positive owner area. Returned names distinguish lower/upper
bounds from exact measurements, and the output explicitly states `binary64-diagnostic`
assurance. No approximate analytic diagnostic can override a failed gate.

## Independent verification

- Ran `corepack pnpm exec vitest run docs/investigations/issue-174/certificates.test.mjs`:
  **11 tests passed**. Cases include the positive example, reversal and dispatch, extra
  contacts and wrong-side geometry, role/island support, outward-lens intrusion, existing
  planar-water intrusion, invalid witnesses/caps, threshold failures and bounded malformed
  inputs. The primary area-floor check remains distinct from complete primary anatomy.
- Independently loaded both frozen issue-172 comparison result files and passed every
  retained candidate directly to the new private certificate. Its entire output exactly
  matched **all 54 stored owner certificate receipts**, across both six-row revisions.
  This check used retained receipts directly, not regenerated constructor expectations.
- Independently rotated the issue-173 local example through twelve chart orientations.
  All twelve passed the new supporting path, and their sufficient depth matched
  `.21321570650400032` within `1e-12`. This checks that the new nonradial support rule is
  not accidentally tied to the example's vertical planar mouth.

The work above was read-only with respect to runtime and retained evidence. No constructor
matrix, scalar grid, PNG, historical artifact writer or world rerender was run for this review.
Only this review document was added.

## Remaining scope

The implementation retains the explicitly limited binary64 EPS/slack assurance. This is
not a formal interval certificate, a cross-platform equality proof, or a demonstration of
production contour survival. The standalone bay and primary-area checks do not establish
that a complete primary with a supporting mouth can satisfy all anatomy and visual goals.

A separately bounded constructor experiment may use this predicate with fixed witnesses
and unchanged targets. Whether nonradial bay freedom improves the rejected silhouettes
remains an experimental question. Human visual acceptance and production selection remain
unestablished.
