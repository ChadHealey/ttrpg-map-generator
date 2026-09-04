# ADR-0029 — Separated macro-landmass field

- **Status:** Accepted
- **Date:** 2026-09-03
- **Decision owners:** Project maintainers
- **Supersedes:** None
- **Superseded by:** None
- **Proposed by:** [Issue #160](https://github.com/ChadHealey/ttrpg-map-generator/issues/160)

## Context

The M2 version-1 macro field samples an additive set of seeded positive spherical caps and negative
cuts. It preserves deterministic, seam-continuous unit-vector evaluation, but it does not reserve
water between broad continents. Its positive tails can raise saddles between broad centres, and
the water-coverage threshold can retain the resulting narrow joins. Reviewed M2 gallery rows and
an eight-seed default-control sample show that ordinary seeds often yield one long connected
ribbon-like landmass rather than meaningfully different macro silhouettes.

The full diagnosis, reviewed PNG evidence, and proposed fixture matrix are in the
[issue-160 investigation](../investigations/issue-160/README.md). Any remedy must preserve
deterministic streams, fixed quantization and traversal, seam/pole guarantees, the shared
preview/full sampling contract, stable semantic identity derived from the accepted partition, and
generator-free reopening of already accepted v1 maps.

## Decision drivers

- Make inter-continent water separation an explicit macro-field invariant rather than a fortunate
  outcome of parameter tuning.
- Express that separation as a versioned, strictly positive angular ocean-corridor width at the
  accepted contour, not merely disconnected components or a one-sample gap.
- Prevent both inter-owner bridges and severely corridor-like single-owner silhouettes without
  asking semantic classification or rendering to repair the field.
- Keep the field project-owned, analytic, quantized, and unit-sphere native; do not introduce a
  geometry or noise dependency.
- Resolve infeasible control combinations through bounded deterministic calibration or an explicit
  no-proposal diagnostic, never unbounded retries or silent weakening of a declared control.
- Bound the initial repair to M2 macro generation, compatibility dispatch, and evidence without
  redesigning semantic classification, coastline extraction, rendering, or M3 physical layers.
- Preserve accepted v1 geography exactly and offer any changed output only through deliberate
  replacement or upgrade.

## Options considered

### Option A — Retune version-1 bases

Reduce broad radii/amplitudes or increase fragmentation cuts. This is inexpensive but offers no
invariant against a new seed forming a long chain and would turn existing controls into an
undocumented, fragile silhouette policy. Rejected.

### Option B — Spherical cellular ownership with independently warped regions

Build a seeded cellular partition on unit vectors and warp owner-local boundaries. It can be
deterministic and seam/pole safe, but it introduces new ownership, tie-breaking, boundary, and
calibration rules that exceed the smallest corrective change. Deferred.

### Option C — Separated continent-envelope field v2

Deterministically place broad owners with a finite separation rule, evaluate only owner-scoped
envelopes and deformation, and reserve an ocean gap between distinct broad owners at the selected
contour. This retains the current analytic unit-vector/sampling architecture while addressing the
missing separation invariant. Selected, subject to the validation below.

## Decision

Implement a version-2 separated continent-envelope macro field. Broad continents have distinct,
deterministically placed owners on the unit sphere. Their maximum envelopes, local deformation,
and fragmentation are owner-scoped. The v2 field must enforce an explicit ocean-gap guard so two
broad owners cannot become one landmass by additive overlap at the selected land/water contour.

The gap guard has a versioned, strictly positive minimum angular width in planet space. It must be
verified against the selected accepted contour on the canonical full profile; disconnected
components separated only by quantization or one sampled water anchor do not satisfy it. The
renderer and display projection cannot define, widen, or repair this corridor.

Every positive land-forming contribution participates in the same support and separation policy.
Broad envelopes, islands, archipelago members, local deformation, and a land-biased polar
realization cannot raise a guarded corridor into land. A polar realization may be a bounded owner
or an owner-scoped modifier, but it cannot remain an unrestricted global positive term that joins
otherwise separated owners.

Each broad owner also has bounded compact support and a versioned shape-quality diagnostic at the
accepted contour. Elongation, peninsulas, bays, and fragmentation remain allowed, but an owner's
retained land cannot principally be a long narrow corridor or a repeatedly necked chain between
remote lobes. Failure is a macro-field proposal failure; semantic classification must not split a
connected result and rendering must not disguise it.

Islands and archipelagos remain deterministic but cannot silently bridge broad owners. The current
`continentCountIntent`, distribution, fragmentation, island, archipelago, circumference, and polar
controls retain their declared ownership; the implementation must document their v2 realization
without exposing raw field parameters in the UI. The finite placement and calibration procedure
uses a fixed candidate budget, fixed traversal, and stable tie-breaking. For every declared control
combination it either returns a field satisfying the gap, coverage, and shape invariants or returns
an explicit deterministic diagnostic with no proposed patch. It cannot retry until a favorable
random result appears, reinterpret an intent as a guaranteed component count, or silently reduce a
requested control.

This ADR chooses the family and compatibility boundary, not an unreviewed numerical calibration.
The implementation child owns the finite placement rule, envelope formula, and concrete v2
parameters after it proves the silhouette matrix.

## Consequences

### Positive

- Broad-owner separation becomes an explicit, testable property instead of a tuning outcome.
- Single-owner degeneracy and positive polar/island bypasses are covered by the same field-level
  contract rather than left to visual luck.
- The existing project-owned field adapter, canonical sampler, quantization, seam/pole behavior,
  and coastline pipeline remain applicable.
- The normal atlas cohort can receive a visible diversity proof without requiring a universal
  terrain or tectonic model.

### Negative

- Fixed v2 inputs intentionally produce different macro, classification, semantic, coastline, and
  dependent appearance/physical outputs from v1; v2 needs new reviewed fixtures.
- Version dispatch and explicit geography replacement/upgrade need careful UI and persistence
  handling, even though no silent package migration is allowed.
- The first implementation may show that a contained envelope family cannot meet the visual matrix;
  that is a revisit condition, not permission to add uncontrolled field behavior.
- Some extreme but syntactically valid control combinations may produce an explicit no-proposal
  diagnostic when their land budget, owner count, and minimum ocean gap cannot coexist.

### Neutral or follow-up

- This ADR does not change landmass semantic thresholds, coastline extraction/simplification,
  renderer logic, a `.mapworld` schema, sampling policy, or seed-derivation algorithm.
- No production dependency is approved.

## Compatibility and migration

- **Accepted world documents:** Existing v1 accepted maps remain immutable and generator-free on
  reopen. They retain their current accepted macro field, dependent records, and fixture bytes.
- **Persistence:** No in-place migration or reinterpretation of a v1 macro field is permitted. A
  v2 geography outcome is created only by an explicit new-atlas or geography replacement/upgrade
  operation, which replaces downstream accepted geography as one transaction.
- **Versions:** Increment the macro field behavior version and macro-elevation generator version
  to `2`; persist v2 provenance. Keep sampling, quantization, seam, pole, classification,
  deterministic-stream, and seed-derivation versions unchanged unless implementation proves that a
  contract itself changed.
- **Fixtures:** Keep v1 canonical, SVG, PNG, and reopen evidence byte-stable. Register v2 fixed
  seeds and append-only reviews under the fixture conventions; do not overwrite v1 golden output.
- **Platforms:** macOS and Linux must produce byte-identical v2 canonical fields/classification
  for fixed inputs and preserve the existing preview/full correspondence.
- **Parent and child maps:** A v2 replacement invalidates direct M2 dependencies and any M3 or
  regional context derived from them. It must not mutate a child or inherited context silently;
  existing descendants stay attached to their accepted v1 source until a separately explicit
  replacement workflow exists.

## Validation

- Focused macro-field, land/water, semantic, and coastline tests prove deterministic output,
  shared preview/full anchors, seam identity, one sample per pole, valid topology, and stable
  semantic ownership.
- Focused v2 tests prove the versioned minimum angular corridor after the accepted contour is
  selected; prove that broad, island, archipelago, deformation, and polar contributions cannot
  bypass it; reject deliberately corridor-like single-owner fixtures; and prove deterministic
  no-proposal behavior for infeasible controls.
- A twelve-seed normal-control visual cohort, plus the existing six control rows, uses reviewed
  production atlas PNGs. The cohort must show broad-continent, separated-landmass, and fragmented
  island/archipelago families; no default row may be accepted as a ribbon-like connected form.
- A deterministic preview-only sweep of at least 128 additional default-control seeds must produce
  no placement/calibration failure, must meet existing preview water-coverage tolerances, and must
  satisfy preview-profile counterparts of the gap and shape-quality diagnostics. This broad sweep
  guards against tuning only the reviewed cohort; it does not claim the full-profile proof required
  for registered rows, and its measurements do not replace human review.
- The chosen v1 reopen/fixture lane proves no generator invocation and byte-identical accepted
  data after the v2 capability is added.
- `pnpm check` and the read-only cross-platform fixture check pass before publication.

## Revisit conditions

- A proposed v2 placement/envelope implementation cannot satisfy the visual matrix or the broader
  default-seed sweep while retaining its angular ocean-gap, owner-shape, and documented control
  invariants.
- The explicit version dispatch requires a third major package boundary or forces an accepted-data
  migration that cannot remain deliberate and reversible.
- A cross-platform deterministic test finds a divergence attributable to the v2 numeric field.
- Product scope later requires a materially different macro-field family, such as tectonic
  simulation or a general cellular topology; that needs a superseding ADR.
