# ADR-0014 — Restrained ink atlas appearance and one-pass styling

- **Status:** Accepted
- **Date:** 2026-08-16
- **Decision owners:** Project maintainers
- **Supersedes:** None
- **Superseded by:** None

## Context

Issue #63 turns the structural whole-world scene from issue #62 into the first reviewed atlas
style. The style must be attractive and visibly hand-inked while retaining the accepted semantic
partition, canonical planet-native coastline, display-projection safety, stable source links, and
Canvas/SVG scene parity.

The Milestone 2 contract already separates three accepted appearance aspects:
`atlas.coastlineAppearance`, `atlas.waterDecoration`, and `atlas.paperTreatment`. Their outputs
must survive an appearance reroll independently of geography and must remain projection-neutral.
Issue #64 will own the document transaction that commits those proposals; issue #65 will own their
persisted encoding.

## Decision drivers

- Keep semantic geography and canonical coastline bytes unchanged by styling.
- Make each appearance aspect independently reproducible from its own map/entity seed namespace.
- Prevent repeated distortion, topology damage, seam gaps, and decoration in land masks.
- Give Canvas, SVG, and deterministic PNG evidence the same ordered scene semantics.
- Establish one restrained visual direction without creating a public style system.

## Options considered

### Option A — Backend-local filters and procedural brushes

Canvas and SVG could apply their own jitter, textures, and filters. This would duplicate style
interpretation, make exact SVG evidence difficult, and risk different seam or mask behavior.

### Option B — Persist styled projected paths and raster paper textures

Materializing final paths or pixels would make reopen straightforward, but it would promote one
display projection and resolution into accepted authority and would accumulate distortion after
edits.

### Option C — Persist projection-neutral decisions and derive one shared styled scene

Store unitless ring decisions, source-linked planet-native decorative paths, and compact paper
parameters. Resolve a versioned style token set outside the renderer, then derive the disposable
scene once after canonical projection.

## Decision

Adopt Option C.

The version-1 `atlas-style.restrained-ink` token set belongs to `packages/assets`. It uses
near-black ink, muted blue-gray water, quiet parchment-olive land, and warm paper/grain colors.
The token set is a closed project asset, not a user-authored style pack or plugin boundary.
`packages/core` owns only the immutable appearance records and the renderer-neutral token
contract. `packages/render` consumes those core values but does not import the asset package; the
application or fixture composition root supplies the concrete style.

Each appearance aspect uses its own ADR-0006 `map/entity` seed input with the atlas-presentation
singleton as owner. Coastline decisions retain ring ID and source-boundary fingerprint plus
unitless wobble and pressure phases/strengths. Water decoration retains stable source-linked
planet-native paths. Paper treatment retains phases, angle, density, and length decisions rather
than pixels. No accepted output contains projected coordinates, viewport state, SVG nodes, Canvas
state, or raster tiles.

Scene-composition version 2 derives coastline ink once from canonical seam-split projected paths.
The displacement is a bounded sum of two low-frequency sinusoidal bands. Open seam endpoints taper
to zero displacement. A spatial intersection check retries at half and quarter amplitude, then
falls back to the undistorted canonical projected path if necessary. Pressure variation splits the
already-derived path into stable segments; it never re-distorts each segment.

Coastal echoes are short planet-native paths offset toward accepted water from the canonical
land-on-left ring direction. A farther clearance probe must also remain water, suppressing echoes
in narrow channels. Water marks are placed only where all retained points belong to their source
water-body membership. Version 1 keeps decoration away from the canonical chart seam and poles;
the renderer rejects a decoration segment that would cross the seam instead of repairing it.

Paper grain is reconstructed as a sparse low-discrepancy set of tiny source-linked scene strokes
from accepted treatment parameters. It is deliberately subtle, has no repeated raster tile, and
is omitted with all decorative polylines at the coarse-preview level of detail.

## Consequences

### Positive

- Appearance rerolls change three independent accepted outputs while geography and coastline
  remain byte-stable.
- Styled strokes cannot become semantic boundaries or feed later generation.
- Seam endpoints, masks, stable IDs, source links, and z-order are explicit and testable.
- Canvas, SVG, and deterministic PNG evidence consume one scene with one limited-color palette.
- The style can later be replaced by another concrete token set without adding backend-local
  geography logic.

### Negative

- Pressure variation expands one coastline path into several scene nodes and increases canonical
  scene/SVG evidence size.
- Version 1 omits decorative strokes close to the seam rather than projecting arbitrary decorative
  paths through a second wrapping adapter.
- The test PNG rasterizer now supports up to sixteen opaque palette colors; production tiled PNG
  encoding remains owned by issue #67.

### Neutral or follow-up

- Issue #64 must commit the three proposals atomically and prove the user-facing appearance-reroll
  transaction.
- Issue #65 must persist the accepted outputs and reopen them without generation.
- Issues #66 and #67 own production SVG and PNG export policies; this issue supplies their shared
  scene semantics and reviewed visual inputs.
- Labels, title, compass, border, legend, scale, public styles, and terrain motifs remain out of
  scope.

## Compatibility and migration

- **Accepted semantic geography and coastline:** unchanged.
- **Persistence schemas and migrations:** unchanged until issue #65 integrates the new records.
- **Appearance behavior, style, and token versions:** introduced at version 1.
- **Scene composition:** advances from version 1 to version 2 because node structure and visible
  output change.
- **Projection, seed derivation, semantic classification, and coastline versions:** unchanged.
- **Fixtures:** all six atlas rows gain appearance/isolation vectors, version-2 canonical scenes,
  canonical SVG changes, and reviewed PNG evidence. Semantic and canonical coastline hashes are
  reviewed separately and remain unchanged.

## Validation

Focused tests prove independent seed namespaces, deterministic reconstruction, three-output reroll
isolation, source immutability, planet-native decoration, bounded wobble, fixed seam endpoints,
pressure variation, self-intersection fallback, and deterministic four-bit PNG palette encoding.
The six registered fixtures prove stable source ordering, Canvas/SVG parity, seam/pole safety,
masked decoration, and the reviewed limited-color result across the Milestone 2 matrix.

## Revisit conditions

- A valid coastline repeatedly falls back to canonical geometry and visibly loses the intended
  hand-ink character.
- Near-seam decoration omission becomes visible at representative export size.
- Scene node count or SVG size exceeds the Milestone 2 budgets.
- A second concrete style demonstrates that the core token contract encodes assumptions unique to
  this first style.
