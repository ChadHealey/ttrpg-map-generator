# ADR-0023 — Milestone 3 Footprint and Local-Projection Contract

- **Status:** Accepted
- **Date:** 2026-08-29
- **Decision owners:** Project maintainers
- **Supersedes:** None
- **Superseded by:** None
- **Resolves:** [Issue #130](https://github.com/ChadHealey/ttrpg-map-generator/issues/130)

## Context

Milestone 3 needs a selectable world-space footprint that can be handed to a regional
generator as planet-native authority plus an invertible local physical chart. The current
coordinate implementation already provides canonical spherical `PlanetPoint` values,
millimeter `RegionalPoint` values, and a version-1 azimuthal-equidistant transform with a
closed-hemisphere domain. [ADR-0005](0005-planet-and-regional-coordinate-contract.md) leaves
footprint shape and production limits open. [ADR-0022](0022-milestone-3-world-physical-context.md)
now defines the physical fields, source provenance, padded collar, and boundary portals that
the selected footprint must carry into inherited context.

This decision fixes one bounded footprint contract. It does not implement the model, selector,
clipping, overlap detection, or regional generation.

## Decision drivers

- Keep planet-native points and fields authoritative across the longitude seam and poles.
- Use the existing local chart and physical units without making an atlas display projection
  part of persisted geometry.
- Make every accepted footprint finite, canonical, round-trip safe, and deterministically
  identifiable.
- Leave enough disk margin for a padded context collar and explicit boundary portals.
- Keep the first selector contract small enough for one core implementation and fixture set.

## Options considered

### Option A — Origin-centered local rectangle (selected)

Represent one footprint as a closed, non-degenerate, axis-aligned rectangle in the regional
coordinate space of a canonical planet origin. The rectangle maps through the version-1
azimuthal-equidistant transform; its planet-native boundary is derived and never replaces the
rectangle's canonical local extent.

### Option B — Arbitrary planet-native polygon

This would support more expressive selections and could follow coastlines, but would require
planet-topology polygon validation, seam-aware ring canonicalization, and a separate decision
about local projection bounds before the first regional handoff. It is deferred.

### Option C — Display-projection rectangle

This would make the selector easy to draw but would make footprint authority depend on atlas
viewport projection, seam cuts, and pole behavior. It is rejected by the coordinate contract.

## Decision

### Footprint record

The supported shape is `regional-rectangle-v1`, a closed rectangle with:

- `origin`: canonical `PlanetPoint` and the local frame defined by ADR-0005;
- `extent`: canonical `RegionalExtent` in integer millimeters, with strictly positive width
  and height; and
- `transform`: `planet-regional-azimuthal-equidistant`, version `1`, with the explicit world
  radius and transform origin recorded in the parent/context record.

The extent is the authoritative footprint in local physical coordinates. A selector may start
from screen or display coordinates, but it must convert through the typed transform before
acceptance. No screen coordinate, render coordinate, or atlas display-projection value is
persisted as footprint geometry.

### Limits and transform domain

Let `R` be the explicit world radius in kilometers and let

```text
L = floor(R * pi / 4 * 1,000,000) millimeters
```

Every accepted extent satisfies:

```text
0 < maxX - minX <= 2L
0 < maxY - minY <= 2L
abs(minX), abs(maxX), abs(minY), abs(maxY) <= L
```

Thus every corner is at most `pi / (2 * sqrt(2))` radians from the origin, well inside the
version-1 closed hemisphere (`pi / 2`). This is the initial hard angular/physical limit and
is independent of any assumed Earth radius. It also bounds each axis to a 90-degree arc and
leaves a substantial margin for the transform's declared round-trip allowance.

The implementation additionally applies ADR-0005's exact integer disk check and
`validateRoundTripSafeRegionalExtent`; it rejects rather than clamps an extent that rounds
outside the supported or round-trip-safe disk. The public round-trip tolerance is exactly
`getPublicRoundTripBoundKm(radius)`. A zero-width or zero-height extent is rejected as
degenerate even though `RegionalExtent` itself can represent a closed point or line.

### Seam and pole behavior

- **Horizontal seam:** The origin and all accepted source anchors use canonical planet ticks.
  A footprint may straddle longitude `-pi/+pi`; the seam is not a boundary of the local
  rectangle. Planet-native rings and sampled fields unwrap longitude only transiently and
  canonicalize persisted points back to `[-pi, pi)`.
- **Near poles:** A non-pole origin uses the ADR-0005 tangent frame. A pole origin is valid and
  uses ADR-0005's fixed prime-meridian frame. Local `x/y` remains authoritative for the
  rectangle; longitude is never treated as planar x.
- **Boundary:** Points on the four local rectangle edges and corners are included. A point
  outside the rectangle, outside the transform hemisphere, outside the round-trip-safe inset,
  or beyond the hard limits is rejected before clipping or generation.
- **Overlap:** This contract does not authorize overlapping-child detection or a shared
  refinement layer. Those remain later implementation work; adjacent children can share
  planet-native samples and portals through ADR-0022.

### Inherited-context relationship

The footprint record is the geometric key for an ADR-0022 context snapshot. The snapshot keeps
the canonical origin, extent, transform ID/version, world radius, source aspect versions,
checksum, padded collar, and boundary portals. Clipping selects source samples and vector
features against the footprint plus collar; it does not re-sample authoritative fields into a
new footprint-owned field. Boundary portals are ordered in local perimeter order, with ties
resolved by canonical planet ticks and source ID. A child may refine inside the rectangle, but
must preserve inherited classifications, anchors, and portals within the declared child
tolerances.

### Identity and serialization

The stable footprint identity input is the canonical tuple:

```text
regional-rectangle-v1 |
rootSurfaceNamespaceId |
worldRadiusMillimeters |
origin.longitudeTicks | origin.latitudeTicks |
minXMillimeters | maxXMillimeters | minYMillimeters | maxYMillimeters |
transformId | transformVersion
```

The tuple is encoded with explicit field boundaries and the project seed/hash grammar; it is
not derived from display coordinates, labels, array position, or selector event order. Equivalent
input ordering produces the same canonical record and identity. Canonical serialized field
order is `shapeVersion`, `rootSurfaceNamespaceId`, `worldRadiusMillimeters`, `origin`,
`extent.minXMillimeters`, `extent.maxXMillimeters`, `extent.minYMillimeters`,
`extent.maxYMillimeters`, `transformId`, `transformVersion`, followed by source versions,
collar, portals, and checksum in their owning context record. Serializers emit already-canonical
integer values and never repair persisted input.

### Diagnostics

The selector/validator exposes stable categories rather than projection-library messages:

- `footprint.shape.unsupported` — shape or contract version is not supported;
- `footprint.extent.degenerate` — width or height is zero/negative;
- `footprint.extent.limit` — physical or angular hard limit is exceeded;
- `footprint.transform.domain` — a point or extent is outside the transform hemisphere;
- `footprint.transform.round-trip` — the extent is outside the declared safe inset;
- `footprint.coordinate.invalid` — input is not canonical or violates ADR-0005; and
- `footprint.context.invalid` — collar, portal, source-version, or checksum data cannot be
  reconciled with the footprint.

Diagnostics identify the failed category and offending boundary/field where known. No invalid
selection is clamped, wrapped, reflected, or silently repaired.

## Consequences

### Positive

- Ordinary, seam-crossing, and near-pole selections use one small typed contract.
- The selected rectangle is independent of display projection and has explicit physical units.
- The 45-degree per-axis bound is easy to validate and leaves transform-domain and round-trip
  margin for inherited collars.
- Stable IDs, canonical ordering, portals, and diagnostics are defined before persistence or
  selector work begins.

### Negative

- The first selector cannot follow arbitrary coastlines or accept regions wider than the
  origin-centered bound.
- Rectangles can include unwanted area; arbitrary polygons require a later contract.
- A future projection or planet model needs an explicit versioned amendment and migration.

### Neutral or follow-up

- [Issue #132](https://github.com/ChadHealey/ttrpg-map-generator/issues/132) implements the
  footprint records, validation, transform metadata, diagnostics, and approved vectors.
- [Issue #133](https://github.com/ChadHealey/ttrpg-map-generator/issues/133) decides the
  `.mapworld` compatibility and migration boundary after the M3 domain decisions exist.
- [Issue #138](https://github.com/ChadHealey/ttrpg-map-generator/issues/138) integrates
  accepted physical aspects and context clipping; it must consume this record rather than
  redesign it.

## Compatibility and migration

- **Accepted world documents:** M2 documents have no footprint records and remain valid; load
  must not invoke a selector or generator.
- **Persisted schemas and migrations:** This ADR selects the domain contract but no DTO or
  package-version transition. #133 owns that decision. Future records persist integer ticks,
  transform identity/version, radius, and canonical extent without re-rounding.
- **Generator, seed, parameter, context, or style versions:** The footprint shape and transform
  are version `1`; changes to shape, limits, identity grammar, or transform behavior require a
  new version and explicit reconciliation policy.
- **Canonical fixtures:** #132 adds ordinary, seam, near-pole, boundary, invalid-size, and
  round-trip vectors. Existing M1/M2 bytes do not change.
- **macOS and Linux determinism:** Integer canonical values, ties-away-from-zero quantization,
  stable tuple encoding, and exact integer disk comparisons are required on both platforms.
- **Parent and child maps:** The parent world owns the footprint and context snapshot. A child
  receives source lineage, collar, portals, and checksum; it never reads generator internals.

## Validation

The contract is validated in #132 with focused vectors for:

1. an ordinary equatorial rectangle centered at `(0, 0)`;
2. a rectangle whose derived planet boundary crosses the canonical longitude seam;
3. a near-north-pole origin and the exact canonical north-pole origin;
4. an extent edge/corner at the accepted limit and one millimeter beyond it;
5. zero-area, over-limit, outside-hemisphere, non-canonical, and unsafe-round-trip inputs; and
6. forward/inverse samples within `getPublicRoundTripBoundKm(radius)`.

The broader review checks that the record supplies every ADR-0022 clipping input, preserves
adjacent-child portal ordering, and remains consistent with the M3 visible exit and the M4
consumer. If any vector requires a second projection family, a new root coordinate model, or a
new persistence boundary, #132 stops and returns for a contract amendment rather than
implementing around this decision.

## Revisit conditions

- A required M3 region cannot fit the explicit 45-degree-per-axis rectangle while retaining
  acceptable visual or physical behavior.
- A seam or pole fixture fails with canonical planet sampling despite the ADR-0005 frame.
- The collar or portal requirements need a second authoritative geometry or storage boundary.
- Product scope requires arbitrary polygons, overlapping children, ellipsoidal worlds, or a
  projection outside the version-1 closed hemisphere.
