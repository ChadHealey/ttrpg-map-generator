# ADR-0001 — Render scene primitives

- **Status:** Accepted
- **Date:** 2026-08-14
- **Decision owners:** Project maintainers
- **Supersedes:** None
- **Superseded by:** None

## Context

Milestone 0 needs Canvas preview and SVG export to depict the same hard-coded inked scene
without either backend reconstructing the image. The render-scene contract must be small enough
for this proof while preserving explicit coordinate units, stable node ordering, and source links.

## Decision drivers

- One scene must be interpreted by both Canvas and SVG backends.
- SVG output must be deterministic enough for canonical regression evidence.
- The proof must not establish a second semantic world model or pre-empt later map features.

## Options considered

### Option A — Renderer-specific scene construction

Canvas and SVG each create their own drawing commands. This is quick initially, but allows the
backends to drift and violates the renderer-neutral boundary.

### Option B — A general SVG path command model

Expose arbitrary path commands immediately. This would cover more shapes, but introduces a
larger, less reviewable contract before the product needs it.

### Option C — A small typed render scene

Use ordered rectangles, polygons, polylines, and labels in fixed render-pixel coordinates. Each
node has a stable render ID and source ID; Canvas and SVG adapt these same node values.

## Decision

Adopt Option C. `@ttrpg-map/core` owns the immutable `RenderScene` types and the fixed proof
scene. `@ttrpg-map/render` owns Canvas and SVG interpretation. Node array order is draw order,
and every SVG element carries the originating render-node and source IDs. The scene remains
disposable render output, not canonical geography or persisted accepted state.

## Consequences

### Positive

- Canvas and SVG share one contract and visual ordering.
- The SVG serializer has a stable, inspectable structure.
- Later primitives can be added only when a demonstrated map need requires them.

### Negative

- Curves, transforms, clipping, patterns, and other drawing features are intentionally absent.
- Text can differ slightly by available platform fonts even though both backends receive identical
  label semantics.

### Neutral or follow-up

- The next required primitive or coordinate-space expansion must amend or supersede this ADR.
- Viewport navigation and element inspection remain issue #4 work.

## Compatibility and migration

- **Accepted world documents:** None; the proof scene is not persisted.
- **Persisted schemas and migrations:** None.
- **Generator, seed, parameter, context, or style versions:** None; no generator or seeded style
  behavior is introduced.
- **Canonical semantic/SVG/visual fixtures:** SVG structure is covered by a deterministic unit
  test; the Canvas/SVG proof is visually inspected.
- **macOS and Linux determinism:** The serializer has no ambient inputs and preserves node order.
- **Parent and child maps:** None; map handoff is outside Milestone 0.

## Validation

Unit tests verify Canvas operations and SVG markup against the same fixed `RenderScene`, including
stable node order and source IDs. The desktop proof displays both renderings side by side and
exports the SVG. Full workspace checks and visual inspection are required before merge.

## Revisit conditions

Revisit when a demonstrated rendering feature requires curves, transforms, clipping, image
assets, richer text layout, or a coordinate space other than fixed render pixels.
