# ADR-0026 — Versioned atlas physical-overlay export profiles

- **Status:** Accepted
- **Date:** 2026-08-31
- **Decision owners:** Project maintainers
- **Supersedes:** None
- **Superseded by:** None
- **Resolves:** [Issue #154](https://github.com/ChadHealey/ttrpg-map-generator/issues/154)

## Context

ADR-0015 and ADR-0016 define `atlas-svg-v1` and `atlas-png-v1` for the Milestone 2 six-layer
atlas scene: paper background, water background, land fills, paper treatment, water decoration,
and coastline ink. They intentionally reject unknown nodes so renderer output cannot silently
change when the disposable scene grows.

Milestone 3 needs the later atlas-scene composition work to display accepted physical context.
That work will emit source-linked `atlas/physical/` overlay nodes. Accepting those nodes under a
v1 profile would change the documented scene contract and, for valid new scenes, introduce an
unversioned compatibility boundary. The exporters must consume only the scene contract; they must
not import physical generators, reconstruct accepted records, or mutate them.

## Decision

Add explicit `atlas-svg-v2` and `atlas-png-v2` export profiles, each at profile version 2. The
v2 entry points are named for physical overlays, so callers opt in deliberately; the existing v1
entry points continue to validate and serialize only the original profile.

V2 accepts canonical node IDs below `atlas/physical/` only when every segment is lowercase ASCII
alphanumeric with optional `.`, `_`, or `-`. Every node retains the existing canonical source
entity ID, source aspect ID, and sorted related-source-ID validation. Physical nodes may use the
already-supported `compoundPath` or `polyline` primitives, with the existing geometry, color,
stroke-width, coordinate, cancellation, and resource limits. No new primitive, generic layer
system, generator import, or raster pipeline is introduced.

The v2 painter order is fixed:

```text
paper background → water background → land fills → physical overlays
  → paper treatment → water decoration → coastline ink
```

Thus overlays communicate accepted context above semantic fills while paper treatment and water
decoration retain their established appearance, and coastline ink remains legible above every
physical feature. Physical IDs are strictly increasing within their layer, as are all other
layer-local IDs. A v2 scene must contain at least one valid physical-overlay node; v1 reports an
actionable diagnostic directing callers to v2 when it sees an `atlas/physical/` node.

SVG serialization records the selected profile ID and version in its metadata and uses
profile-specific SVG element IDs. PNG records the selected profile in its typed receipt while
using the unchanged bounded raster and encoder behavior.

## Consequences

### Positive

- Existing M2 SVG, PNG, gallery fixtures, and byte contracts remain v1 and unchanged.
- The downstream M3 scene composer has an explicit compatible target without broadening v1.
- Both exporters preserve deterministic ordering, source provenance, cancellation, and bounded
  resource behavior through their existing scene-only paths.

### Negative

- A physical atlas export must deliberately select the v2 entry point.
- The dedicated v2 fixture adds generated evidence without changing any M2 gallery, so future
  profile changes must preserve both the v1 M2 fixtures and the v2 physical-overlay fixture.

## Validation

- Focused SVG and PNG tests cover v1 rejection, v2 acceptance, canonical source links, fixed
  overlay z-order, malformed/duplicate/unsorted/misplaced nodes, exact repeats, cancellation, and
  PNG bounded-resource reporting.
- The v2 SVG test verifies the emitted physical overlay precedes paper, water decoration, and
  coastline ink, while the PNG test proves the same valid source-linked scene repeats exactly.
- The registered `atlas-physical-overlay-profile-v2` fixture records its canonical scene, SVG,
  and reviewed PNG. The visual evidence shows the physical fill remains visible inside land while
  the continuous coastline ink stays above it.
- Existing `atlas-svg-v1` and `atlas-png-v1` tests continue to exercise their unchanged contracts.

## Revisit conditions

- A demonstrated accepted physical feature requires a renderer primitive other than
  `compoundPath` or `polyline`.
- A physical overlay cannot satisfy the existing PNG raster limits or needs different painter
  order to preserve coastline legibility.
- A third production package boundary becomes necessary to select or interpret an export profile.
