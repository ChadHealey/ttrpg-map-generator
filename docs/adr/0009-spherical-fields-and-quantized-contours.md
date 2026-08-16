# ADR-0009 — Spherical fields and quantized contour algorithms

- **Status:** Accepted
- **Date:** 2026-08-16
- **Decision owners:** Project maintainers
- **Supersedes:** None
- **Superseded by:** None

## Context

Milestone 2 needs a durable algorithm family before production macro elevation, land/water
classification, connected components, canonical coastlines, and stable semantic entities are
implemented. [Issue #56](https://github.com/ChadHealey/ttrpg-map-generator/issues/56) must choose
the smallest deterministic field, contour, topology, and dependency set while respecting the
authoritative spherical topology and canonical ticks in
[ADR-0005](0005-planet-and-regional-coordinate-contract.md), the independent seed streams in
[ADR-0006](0006-seed-derivation-and-deterministic-streams.md), and the accepted
[Milestone 2 atlas-proof contract](../milestone-2-atlas-proof.md).

The decision is output-sensitive and expensive to reverse after accepted geography exists. A
display-projection grid cannot become authoritative; preview and full classification must agree
at every shared anchor; the horizontal chart seam and both poles must be explicit; topology must
be evaluated after canonical quantization; and no third-party geometry type may enter domain or
generator records.

The complete current library and project-owned comparison, package metadata, primary sources,
six-row spike, and timing/memory observations are recorded in
[dependency review 0003](../dependency-reviews/0003-milestone-2-global-geography-algorithms.md).
This ADR selects contracts and algorithm families. Issues #57 through #60 still own production
records, generators, classification, identities, canonical coastline winding/nesting,
simplification tolerance, and complete validation.

## Decision drivers

- Exact seam identity and explicit pole behavior on the ADR-0005 sphere.
- Exact preview/full classification at nested anchors without promoting preview bytes.
- Stable macOS/Linux output, ordering, quantization, and version consequences.
- Repair-free topology checks that cannot silently delete a channel, island, lock, or constraint.
- Small DOM-free TypeScript that stays inside `generation` and behind project types.
- Measured suitability for all six fixed seed/control rows at the accepted effective dimensions.
- No dependency, native, bundle, licensing, or transitive surface without demonstrated value.

## Options considered

### Option A — Project-owned analytic spherical fields and quantized spherical marching cells

Evaluate seeded analytic basis functions on transient unit vectors derived from canonical
`PlanetPoint` anchors. Quantize normalized field values before classification. Sample a wrapped
longitude/equiangular-latitude lattice with one vertex per pole. Use quads away from the poles,
triangle fans at the poles, exact integer component adjacency, an integer saddle decider, exact
rational contour interpolation, and post-quantization validation.

This directly encodes the topology needed by the product and reuses the existing project stream,
coordinate, and rounding contracts. It requires owning compact grid, contour, and validation
code, and binary64 transcendental evaluation still needs cross-engine evidence.

### Option B — `simplex-noise`, `d3-contour`, and `polygon-clipping`

Sample dependency-provided 3D simplex noise on the sphere, pad or duplicate the chart for
`d3-contour`, then repair/stitch its planar MultiPolygons with `polygon-clipping`. These are
credible focused libraries, but none owns the spherical seam, collapsed poles, ADR-0005 ticks,
preview/full threshold, stable ordering, or accepted-output compatibility. Most of the difficult
adapter and repair work remains, and three output-sensitive packages plus transitive dependencies
become compatibility inputs.

### Option C — FastNoise Lite plus JSTS/Turf

Use a broad noise family and general planar GIS topology stack. This provides the most built-in
algorithms, predicates, and operations. It also adds mutable algorithm configuration, a much
larger runtime and transitive surface, less direct TypeScript metadata in places, licensing review
for JSTS, projection-shaped GeoJSON adapters, and precision behavior not aligned with canonical
integer ticks. The capability is disproportionate to one atlas-scale generated partition.

### Option D — Cube-sphere or icosphere sampling and mesh contours

Avoid one longitude seam by sampling multiple cube faces or a triangular sphere mesh, then trace
contours on the mesh. This can improve area uniformity and pole symmetry, but introduces face or
mesh identity, edge/corner canonicalization, preview refinement, stable mesh ordering, and
conversion contracts not present in ADR-0005. The spike found no quality or performance need that
justifies those additional persisted compatibility choices for Milestone 2.

## Decision

Adopt Option A with no production dependency.

### Sampling policy version 1

A profile has `W` longitude cells and `H` latitude bands. Interior anchors are the exact
ADR-0005 tick equivalents of:

```text
longitude(x) = -pi + 2*pi*x/W        for x in [0, W)
latitude(y)  = -pi/2 + pi*y/H        for y in [0, H]
```

The south pole and north pole are each evaluated and stored once with canonical longitude zero.
Interior rows contain `W` anchors. Longitude cell `W - 1` connects to cell `0` across the
canonical seam. The first and last latitude bands are `W` triangle fans sharing their one pole;
the other bands are wrapped quads. The unique canonical traversal and storage order is south pole,
interior rows south-to-north and west-to-east, north pole. Grid and result processing follows
this order unless a later owner defines a more specific stable semantic order.

`world-atlas-preview-v1` uses `(W, H) = (512, 256)` and has 130,562 unique anchors.
`world-atlas-full-v1` uses `(2048, 1024)` and has 2,095,106 unique anchors. Every preview interior
address maps to the full address `(4*x, 4*y)`; both poles map to the same canonical full pole. The
tests exhaustively prove tick equality for the complete preview set.

The two profiles evaluate the same pointwise field behavior and use the same global
classification thresholds derived from the shared preview anchors. Consequently, at shared
anchors normalized field ticks and land/water classification must be exactly equal. The numeric
tolerance is zero ticks, not an epsilon. Full evaluation may add anchors and other work but cannot
omit or reinterpret a required anchor.

A retained disposable preview boundary may differ from the corresponding full boundary by at
most one preview-cell angular diagonal, `sqrt(2) * pi / 256` radians. This is a visual proposal
tolerance only. It cannot validate, repair, become accepted, or relax canonical full geometry.

### Field and threshold precision version 1

The adapter boundary represents a normalized scalar in `[-1, 1]` as a signed safe-integer tick
with scale `2^24` and quantum `2^-24`. Calculation output is finite and in range before the
adapter; the adapter does not silently normalize invalid values. Rounding is nearest with exact
ties away from zero and zero is canonical positive zero, matching ADR-0005.

Land/water contour levels are odd doubled field ticks. A level `2*t + 1` lies halfway between
integer samples `t` and `t + 1`, so no anchor equals the contour. Classification compares
integers only. Field behavior uses an ADR-0006 aspect stream to construct finite analytic
spherical basis parameters, then samples by unit-vector dot products. This proves continuous
planet-native meaning; it does not approve the spike's provisional basis count, amplitudes, or
control-realization tuning as the production generator owned by #58.

### Classification and connected-component topology

The sampled partition uses four-neighbor adjacency on interior rows, wraps east/west neighbors,
and connects the single south/north pole vertex to every vertex in its adjacent row. Component
discovery scans canonical storage order and visits neighbors in a fixed declared order. #59 may
define semantic component ordering, stable matching, area weighting, containment, and
classification thresholds, but cannot reinterpret seam or pole adjacency.

### Contour extraction and validation

Contour extraction uses marching quads away from the poles and marching triangles in each polar
fan. A quad saddle uses the exact integer bilinear determinant; determinant zero takes the fixed
non-negative branch. Shared-edge intersection coordinates use the doubled integer field values,
exact `bigint` rational arithmetic, and ties-away-from-zero rounding into ADR-0005 ticks. A
temporary unwrapped seam endpoint may equal `+pi`, but every emitted `PlanetPoint` canonicalizes it
to `-pi`. Polar radial edges retain their meridian and interpolate only latitude.

Segments stitch by canonical tick keys. The proposed graph must have degree two at every vertex
and form closed rings. Validation operates after quantization with exact integer orientation and
rejects too-short, open, duplicate-edge, degree-mismatched, or self-intersecting output through
stable project diagnostics. It does not call a boolean library or silently repair the proposal.

#60 owns complete production ring winding, hole/nesting relationships, spherical containment,
stable source/ring identities, quantization collision handling, and adversarial validation. It
also owns a topology-guarded simplifier: candidate vertex removals have deterministic rank and
tie order, preserve declared seam/pole/inherited anchors, and are accepted only when the complete
quantized topology remains valid. An unguarded Douglas-Peucker result is not canonical geometry.

### Adapter and dependency boundary

`QuantizedPlanetFieldAdapter`, `QuantizedSphericalField`,
`PlanetContourExtractionAdapter`, and `PlanetTopologyValidationAdapter` are the narrow
project-owned seams. Their inputs and outputs contain only project coordinates, fixed-point
values, readonly proposed rings, and stable project diagnostics. Third-party values are converted
inside an implementation module and cannot appear in `core`, persistence, public generator
proposals, or accepted records.

No package is added. Polygon boolean operations are not part of the selected initial pipeline.
If #60 demonstrates a necessary operation that a small project implementation cannot safely
provide, `polygon-clipping` is the first focused candidate, but it requires an updated review and
one dependency-only commit before implementation.

## Consequences

### Positive

- Seam and pole behavior follow the authoritative sphere rather than a display rectangle.
- Preview/full anchor nesting and classification equality are exact and executable.
- Integer thresholds, interpolation, predicates, and ordering remove most floating topology
  ambiguity.
- The initial pipeline cannot hide invalid output behind a library repair.
- No runtime dependency, transitive package, native build, foreign geometry type, or application
  bundle contribution is added.
- The six-row full-profile spike completed sampling, both component passes, contours, validation,
  and fingerprinting in 1.16–2.12 seconds per row on the documented non-reference host.

### Negative

- The project owns non-trivial spherical sampling and marching-cell code that needs adversarial
  tests and mathematical review.
- An equiangular lattice oversamples high latitudes; area and coverage calculations must use
  spherical weights rather than anchor counts.
- Binary64 trigonometric functions are not specified bit-for-bit across every JavaScript engine;
  fixed-point output reduces but does not eliminate the need for cross-engine proof.
- Rejecting invalid generated topology may require regeneration or constrained local correction
  where a boolean repair would appear more convenient.

### Neutral or follow-up

- #57 defines accepted records and exact stable identities without importing spike-only types.
- #58 implements and versions the production macro field, controls, progress, and cancellation.
- #59 defines semantic component classification, containment, and stable tie-breaking.
- #60 completes canonical ring topology, winding, nesting, simplification, and validation.
- Display projection remains a disposable mapping selected by #61 and cannot change this policy.

## Compatibility and migration

- **Accepted world documents:** No accepted Milestone 2 geography exists, so this decision needs no
  migration. Future accepted fields and rings remain materialized when an implementation changes.
- **Persisted schemas and migrations:** This ADR defines no record schema. #57/#65 must store the
  selected profile/policy and relevant field/classification/geometry provenance without exposing
  transient grid or adapter values as accepted authority unless their owning record requires it.
- **Generator, seed, parameter, context, or style versions:** Changing basis behavior changes the
  macro-elevation generator version. Changing profile ID, dimensions, anchors, or shared-threshold
  meaning changes the parameter/profile compatibility version and any affected generator behavior.
  Changing quantization, contour interpolation, saddle choice, pole fans, topology, simplification,
  or ordering changes the smallest affected field/classification/geometry and generator versions.
  Seed derivation and stream versions remain 1 unless their ADR-0006 bytes or sampling semantics
  change. Style and inherited-context versions are unaffected by this initial decision.
- **Canonical semantic/SVG/visual fixtures:** Existing Milestone 0/1 evidence is unchanged. Future
  Milestone 2 semantic evidence is sensitive to all choices above; SVG/PNG change only when the
  accepted semantic or later render/style behavior changes.
- **macOS and Linux determinism:** Integer topology is platform-independent. The full fixed matrix
  must pass both Node CI platforms before production acceptance. The WebView/worker execution path
  also needs a focused quantized-field comparison because its engine can differ from Node.
- **Parent and child maps:** No regional map is created. Later inherited context consumes accepted
  planet-native fields and geometry, not the transient atlas grid or display projection.

Old accepted output is never regenerated merely because any selected version is newer. An upgrade
must be explicit and must preserve locks, constraints, and unrelated accepted state.

## Validation

Issue #56 adds executable tests that:

- exhaustively map every preview anchor to identical full-profile ADR-0005 ticks;
- prove exact positive/negative seam identity, seam-neighbor continuity, and longitude-independent
  canonical pole sampling;
- exercise wrapped seam contours, polar-cap contours, and a nested spherical annulus through the
  selected marching topology;
- reject a quantized self-intersecting ring instead of repairing it;
- run all six fixed seed/control rows with non-empty land and water, degree-two closed contours,
  stable fingerprints, and no topology diagnostic; and
- repeat one row to prove deterministic report equality.

The full-profile spike command and report-only observations are retained in dependency review 0003. Production owners must add fixed semantic evidence, classification/nesting adversaries,
cross-platform runs, post-simplification invariants, and the complete Milestone 2 workflow before
acceptance. This ADR's spike neither registers placeholder fixtures nor claims visual quality.

## Revisit conditions

- A representative #58 or #60 workload misses the declared budget after bounded project-owned
  optimization and profiling identifies the selected primitive as the bottleneck.
- macOS/Linux Node or Node/WebView comparison produces different fixed-point samples that a narrow
  versioned rounding guard or execution boundary cannot resolve.
- Production canonical coastline requirements demonstrate a necessary polygon boolean operation
  that cannot be safely expressed by the selected sampled topology and reject/regenerate policy.
- Pole or high-latitude visual/geographic evidence shows equiangular sampling cannot meet the proof
  without impractical resolution or correction.
- A cube-sphere, triangular mesh, or library-backed approach demonstrates materially better
  correctness or cost on the complete fixed matrix while preserving accepted compatibility.
