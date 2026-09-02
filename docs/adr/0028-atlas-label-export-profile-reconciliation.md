# ADR-0028 — Atlas label export profile reconciliation

- **Status:** Accepted
- **Date:** 2026-09-01
- **Decision owners:** Project maintainers
- **Supersedes:** The profile identifiers selected by ADR-0025 only
- **Superseded by:** None
- **Resolves:** [Issue #142](https://github.com/ChadHealey/ttrpg-map-generator/issues/142)

## Context

ADR-0025 selected `atlas-svg-v2` and `atlas-png-v2` for scene-version-4 outlined labels. Before
that renderer work began, ADR-0026 released those same identifiers for scene-version-3 physical
overlays and checked in reviewed SVG/PNG evidence. Reassigning v2 would silently change a public
export contract and invalidate accepted fixture bytes.

The label geometry decision itself remains valid: accepted placements reference one released
glyph pack, the renderer expands its integer contours exactly once, and Canvas, SVG, and PNG
consume that shared result without fonts or backend text measurement.

## Decision

Preserve `atlas-svg-v1`/`atlas-png-v1` and the released physical-overlay
`atlas-svg-v2`/`atlas-png-v2` contracts unchanged. The label-capable profiles are:

- `atlas-svg-v3`, export-profile version `3`;
- `atlas-png-v3`, export-profile version `3`;
- atlas scene-composition version `4`; and
- font policy `outlined-ascii-glyphs-v1`.

V3 requires a complete version-4 vector-label layer after coastline ink. It may include the
already accepted physical-overlay layer, but it cannot reinterpret a v1 or v2 scene. SVG retains
the scene's used glyph-definition table and exact accepted accessibility text. PNG rasterizes the
same expanded even-odd contours through the existing bounded banded pipeline.

Persistence remains independent. The v3 exporters consume already accepted in-memory records;
they neither require nor claim `.mapworld` name/placement round-trip support.

## Consequences

- Released v1 and v2 bytes, validation, and entry points remain append-only compatibility
  contracts.
- Profile selection truthfully identifies whether an export is M2, M3 physical-overlay, or M3
  outlined-label output.
- ADR-0025 remains authoritative for glyphs, exact expansion, label ordering, accessibility,
  resource ceilings, and visual evidence; only its originally selected profile IDs are replaced.

## Validation

- Exact-repeat tests cover SVG/PNG v3 from fixed accepted label records.
- Compatibility tests retain v1 and physical-overlay v2 fixtures and rejection behavior.
- Canvas/SVG/PNG geometry evidence compares the shared expanded contours.
- Sparse/dense 1600 × 800 evidence and sampled 8192 × 4096 output inspect counters, joins, seams,
  and raster-band boundaries.

## Revisit conditions

- A backend requires geometry different from the shared exact contour expansion.
- The released glyph pack or accepted placement cannot fit the existing point, node, sample-visit,
  band, memory, or output ceilings.
- Product requirements add complex shaping, Unicode, curved baselines, or user-supplied fonts.
