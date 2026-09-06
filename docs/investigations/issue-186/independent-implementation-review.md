# Issue 186 independent implementation review before capture

**Clear the reviewed harness for its one authorized checkpoint capture and guarded replay.**
No remaining actionable implementation blocker was found in the stable source. This clearance
is for bounded evidence collection. It is not a production realization, a feature-preservation
certificate, human visual acceptance or permission to add another policy or checkpoint.

The review covered the separate Z implementation, public H/classification/simplification APIs,
component and predecessor correspondence, sampling/measurement, error ledger, fixed checkpoint
pins and trusted-source evidence boundary. No issue184 checkpoint field was evaluated during
this review. The only complete sampling-pipeline smoke used the already declared seam synthetic.

## Explicit correction record

Two preliminary source assumptions in the earlier temporary design review were wrong. The
released [generation entry](../../../packages/generation/src/index.ts) publicly exports both
`classifyAtlasLandWater` and `selectAtlasLandWaterThreshold`; only the threshold inspector test
seam is private. The released extractor's `stitchSegments` uses coordinate-only `contourPointKey`.
The coordinate-plus-transition `contourVertexKey` controls canonical ordering, not stitching.
These were review errors, not production changes. They were corrected before checkpoint capture.

The implementation now calls the actual public classifier with the real branded H=1 contour.
Its integer-anchor bits equal Z's tick>0 rule without pretending the classifier received zero.
The Z degeneracy explanation concerns coincident coordinate/degree ambiguity and its deliberately
restricted domain. It does not rely on the incorrect transition-key stitching claim.

## Implementation checks

The private Z source differs from the released extractor only in the necessary public imports,
separate entry/interface and fixed-zero sign arithmetic. Its geometry helper preserves released
arithmetic. The public adapter's literal version1 type is not fabricated or cast to carry zero.
The outer policy boundary rejects any zero anchor or exact alternating saddle tie before the
private regular-domain extraction. H calls the unmodified public extractor at doubled contour1.
Neither policy repairs an invalid output or substitutes a favorable cell result.

The released interpolation rounds a rational displacement ties away from zero, then adds the
integer start coordinate. It does not always round the absolute interpolated coordinate away
from zero. The helper regression now pins that distinction, including negative half coordinates.
The three saddle blocks likewise distinguish the true Z tie from the true H shifted-sign tie.
Normalization clamps finite F once before the production quantizer, preserves real sign/zero,
and records the expected quantization loss of sufficiently small positive values.

The component graph uses canonical sphere neighbors, seam aliases, unique poles and the released
alternating-cell diagonal decision. Raw transitions must cover the classified neighbor transitions
exactly once and identify a single sampled component together with the left-land anchors. Component
keys hash canonical raw anchor membership. Simplified rings retain their raw predecessor/component
association externally; filtered transitions are checked as an ordered cyclic subsequence. No
semantic EntityIds are fabricated, and no identity is recomputed from a shortened transition list.

The sampler visits the real preview/full unique anchors in canonical order. It retains explicit
little-endian scalar/tick/component hashes and byte-level land/owner hashes. Shared-anchor checks
compare original normalized values and quantized ticks. Owner attribution follows the certified
disjoint positive guards; original body/island counts and boundary provenance are diagnostics.
Boundary-derived merger/split observations do not replace a complete original-role correspondence.
Fixed witnesses are measured on vertex-mapped chart chords and explicitly labelled accordingly.

Public classification supplies the canonical water percentage and the separately rounded
basis-point error. The attributed reference equations agree with that call, including zero-weight
poles and six-decimal ties-away rounding. Total error uses <=25 basis points at both profiles;
private owner error is gated only at preview. Full-owner errors remain diagnostics.

## Findings repaired before capture

The initial shared-anchor implementation threw before retaining the two completed profile outputs
on a mismatch. It now returns a mismatch count and first differing values; the runner retains both
profiles and marks their failure.

The initial policy loop let an exception in Z skip H and discard sampled/classified evidence.
Each policy is now attempted and recorded independently without resampling. Shared sample and
classification results survive a policy exception. A profile sampling failure instead marks both
policies explicitly not attempted, and the aggregate distinguishes planned from actual attempts.
Focused injected-failure tests exercise these repairs without checkpoint sampling.

## Mathematical scope checked

The guard-aware small-|F| inverse argument is sound under the recorded convex evaluation-cap and
whole-polygon containment hypotheses. Inside a polygon, distance to its containing guard-cap
boundary is at least distance to the polygon coast; outside, a small negative unclipped field
magnitude dominates the chart distance term. Disjoint guards make a positive owner unique and
keep an owner's coast part of the original union boundary. This supplies a real-arithmetic local
inverse estimate, not a certified floating-point residual.

For admitted Z, an opposite-sign cell edge contains an original zero by continuity. H's exceptional
zero-tick water corner may have small positive F; its coast is within the recorded half-quantum
inverse allowance. The conservative cell path diameter therefore supplies the stated one-sided
raw-to-original bounds, with explicit coordinate-affine versus shortest-geodesic interpretations
and pole longitude aliases. Neither argument establishes the reverse direction or rules out an
unsampled component.

The generic simplification allowance follows the actual strict interior-projection test and
nonadjacent-removal rule. The harness also measures each removed vertex against its actual raw
predecessor chord and checks the removal/tolerance contract. Conditional disk, width and extent
perturbations remain expressly conditional on missing two-way role-boundary correspondence.

The concrete ledger demonstrates why this conservative route is insufficient: preview's bound
exceeds D=.01, and some retained full-profile disk/peninsula-width margins cannot absorb the
hypothetical generic transfer allowance. These are failures of the proposed certification route,
not measurements that the resulting extracted features necessarily violate their targets. Bay/area
slacks receive no invented simple transfer formula. Binary64 residuals and full extracted-role
certification remain unproved, so proposal gates stay closed even if sampling and topology pass.

## Evidence authority and verification

The runner pins the exact issue184 comparison-r1 manifest/results, the six declared row IDs and
individual row bytes, and the historical field evaluator sources. No constructor or private
million-tick field output is substituted. Source capture binds current trusted public export
resolution, transitive TypeScript source, fixed measurement/field helpers, package manifests,
lockfile and Node/TypeScript/Prettier versions. It records authority before execution and checks
source stability afterward.

Replay compares the exact trusted current/checkpoint manifest and source text before compiling
or importing the runtime. Self-consistent rehashed supplied source is insufficient. Artifact
inventories and hashes are exact, and read-only computational replay regenerates each recorded
artifact for comparison. Hash-only mode is explicitly distinct from replay and does not establish
that retained computations are correct. This review does not claim a completed checkpoint receipt
before the authorized capture has occurred.

Independent verification passed:

- 13 private tests across the policy and evidence files, covering all eight declared synthetics,
  the seam-only sampling smoke, public coverage, degeneracy rejection, component/predecessor checks,
  canonical bytes, exception retention and pre-execution source/input tampering.
- 14 unchanged production tests across sampling profiles, adversarial coastlines, land/water
  classification and surface topology. Combined result: **27 tests in 6 files passed**.
- Strict TypeScript checking with the issue186 configuration passed.

No six-row field evaluation, world rendering, new geometry, production edits or evidence capture
was performed by this reviewer. The final bounded result must retain actual failures and the
numerical limitations above, rather than treating successful public-adapter execution as proof
that the adopted role geometry survives production realization.
