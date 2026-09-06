# Proposed ADR — Macro-morphology selection gate after the v2 rejection

- **Status:** Proposed; human-reviewed no-selection recommendation
- **Date:** 2026-09-05
- **Decision owners:** Project maintainers
- **Supersedes:** ADR-0029's v2 adoption decision, only if this proposal is accepted
- **Superseded by:** None

## Context

[Issue 164](https://github.com/ChadHealey/ttrpg-map-generator/issues/164) revisits
[ADR-0029](../../adr/0029-separated-macro-landmass-field.md) after the maintainer rejected the
preserved v2 cohort. [This investigation](README.md) compares two bounded unit-sphere realizations.
Both preserve explicit inter-owner separation, but neither demonstrates the proposed whole-atlas
morphology contract. The maintainer adopted all twelve failing [image decisions](visual-review.md).
This unnumbered proposal remains issue-owned until a maintainer resolves the decision; it does not
edit the accepted ADR or silently change the project plan.

## Decision drivers

- Believable hierarchy must exist within each primary continental mass at M2 atlas scale.
- One to three co-primary continents are acceptable; a single dominant continent is optional.
- Ocean separation, deterministic bounded construction, shared anchors, semantic truth, and
  generator-free reopen remain non-negotiable.
- Prototype convenience must not become a persistence or production generator contract.

## Options considered

### A — Adopt the v2 separated radial envelopes

Reject. The maintainer's eighteen-image review already rejects the morphology. Preserve the useful
separation and compatibility evidence, not its earlier acceptance labels.

### B — Adopt the tested anisotropic multi-lobed envelopes as v3

Do not select. The tested realization exposes circular guards, repeats rounded lobes, and loses
some intended primary/minor area hierarchy during coverage calibration. Its smaller implementation
cost does not compensate for missing visible hierarchy.

### C — Adopt the tested independently warped spherical cells as v3

Do not select. This removes circular owner support and permits more varied component areas, but
slab-like regions, sharp shoulders, and narrow partition channels remain conspicuous. It also
adds score/warp bounds and more difficult water/control calibration. Its mathematical gap proof
is useful; its favorable area ratios are not visual acceptance.

## Decision

Recommend **no selection from the two tested realizations**. Suspend adoption of ADR-0029's v2
candidate as the ordinary new-atlas path. Carry its useful invariants into a second bounded
investigation of how continental hierarchy and coverage budgets interact with separation. The
[ordered child plan](child-plan.md) defines the evidence needed before any implementation child
becomes ready. This does not conclude that the two entire algorithm families are impossible.

The eventual v3 architectural boundary is a project-owned, versioned macro-elevation field in
`packages/generation`, consuming validated controls and deterministic scoped streams on unit
vectors. It proposes a quantized field and bounded diagnostics; accepted land/water, semantic
classification, coastline extraction, rendering, and M3 context must continue to consume their
existing declared boundaries. Owner sites are transient construction data, not semantic IDs.
No renderer, classifier, physical layer, or later regional refinement may repair its silhouette.
A continuous field compatible with the production contour policy must be demonstrated: these
prototypes' hard support masks and island steps are not an approved interpolation contract.

## Consequences

### Positive

- The useful v2 separation result survives without mislabeling its product acceptance.
- No accepted data or downstream context is regenerated to support an unproven field.
- The next experiment has observable failure targets rather than an open-ended tuning exercise.

### Negative

- There is no production-ready v3 recommendation yet; M2 corrective closure and affected M3 evidence
  remain blocked on a later selected realization.
- A second bounded discovery is required. More detail, simulation, or dependencies are not
  authorized merely because the first two realizations failed.

### Neutral or follow-up

The prototype renderer, SHA-256 counter stream, floating area weights, scalar ticks, and grid are
investigation tools only. Their version names never enter accepted world records.

## Compatibility and migration

- **Accepted v1:** keep all existing aspect/output bytes, IDs, constraints, locks, decoration,
  edits, canonical semantic/SVG/PNG fixtures, and saved worlds immutable. Reopen invokes zero
  generators. New capabilities never reinterpret v1 as v3.
- **Unaccepted v2:** preserve `736e1ddbbda804fa2c9e74e63d0d1ea3c99b83e1` and its review history as
  rejected candidate evidence. Do not merge its generator/gallery/dispatch as ordinary creation.
  The independent #162 compatibility commit `14aca59` is already on `main`: keep its validated
  v1/v2 provenance and generator-free reopening. A user-accepted v2 package, if encountered, remains
  accepted user data even though the cohort was rejected; visual rejection does not authorize
  deleting or replacing it. Do not reuse `2` for changed output.
- **Versions:** once selected and implemented, intentional new macro output uses macro field
  behavior `3`, macro-elevation generator `3`, and its containing atlas generator manifest version
  `3` if that manifest identifies the new composition. No production version is changed now.
  Keep land/water classification, semantic/coastline policy, sample topology, quantization,
  parameter schema, seed derivation, and deterministic-stream algorithms at their released versions
  unless their contracts actually change. Such changes require explicit review; they are not
  justified just because inputs differ.
- **Persistence:** add strict matching `3` provenance alongside `1` and `2` in a separate core and
  persistence compatibility child. Keep package and record versions when their byte layout is
  unchanged; a broader format migration is a stop condition. Reject unsupported/mixed provenance
  explicitly. No upgrade UI or migration framework is authorized here.
- **Streams:** production uses the existing declared map/aspect scopes, IDs and seed metadata with
  generator version `3`. Introduce stable owner/subfeature scopes only with a documented versioned
  mapping; do not copy the spike's independent SHA-256 stream into production or change released
  stream/seed derivation algorithms to accommodate it.
- **Fixtures:** retain all v1 evidence byte-for-byte; retain v2 candidate evidence at its ref with
  rejection intact. Add distinct v3 rows only through targeted fixture generation and append-only
  human review, after field acceptance. No blanket snapshot update or relabeling of old rows.
- **macOS/Linux:** local repeated PNG/grid hashes prove one runtime only. Before adoption require
  byte-identical canonical full fields, partitions, semantic outputs, and reopened output across
  macOS and Linux, plus exact production preview/full shared anchors. Quantization alone does not
  prove trigonometric behavior near thresholds is portable.
- **M3 and descendants:** explicit accepted v3 geography replacement invalidates the direct
  land/water, semantic, coastline and dependent appearance/physical outputs. Existing inherited
  snapshots retain their exact parent lineage and accepted child geography. Mark affected context
  stale through the existing policy; never regenerate children on reopen or parent change.
  Coordinate #148's evidence only after the selected v3 geography/production cohort is accepted,
  then perform #150's visible-exit review. Do not bump the inherited-context schema merely because
  a source aspect's generator version changed; do record its actual source version/revision/hash.

## Validation

The issue-owned repeated matrix and focused smoke tests support a no-selection recommendation,
not production conformance. Human decisions for all twelve images are recorded; the dedicated review
and its provenance-test correction are recorded in [verification.md](verification.md).
A selected successor must additionally prove calibrated continuous field
behavior, full control semantics and failure diagnostics, true production preview/full correspondence,
macOS/Linux canonical equality, strict compatibility, the full 18-row production cohort, and the
128-seed preview sweep. See the [contract](visual-contract.md) and [child plan](child-plan.md).

## Revisit conditions

A bounded successor provides all-image human passes with seed-driven hierarchy while preserving
angular separation, coverage and control semantics, continuous sampling, and deterministic budgets.
If that requires tectonics, a production dependency, a renderer/classifier repair, or a third major
implementation boundary, stop and re-scope instead of treating this proposal as authorization.
