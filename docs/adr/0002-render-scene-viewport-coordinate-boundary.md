# ADR-0002 — Render-scene and viewport coordinate boundary

- **Status:** Accepted
- **Date:** 2026-08-14
- **Decision owners:** Project maintainers
- **Supersedes:** None
- **Superseded by:** None

## Context

Milestone 0 proves that Canvas preview and SVG export can interpret one small,
hard-coded `RenderScene`. It also adds a transient desktop viewport for pan, zoom,
and hit testing. The project plan requires a decision about coordinate transforms
at this point, while reserving planet-native and regional physical coordinates
for Milestone 1.

The proof must remain responsive to CSS layout without allowing screen pixels,
browser viewport state, or a display transform to become accepted map data or
export input. Canvas selection must identify the same render node shown in SVG.

## Decision drivers

- Canvas preview and SVG export must continue to consume identical scene semantics.
- Responsive displays must not cause pan or hit-testing drift.
- Viewport state must remain disposable and must not alter accepted data or exports.
- Later planet-native, regional, screen, render, and print spaces need a clean,
  typed extension path.

## Options considered

### Option A — Make CSS or screen coordinates authoritative

Store scene geometry in browser-layout pixels and use it for display, selection,
and export. This entangles output with window size, device pixel ratio, and CSS
layout, and makes deterministic export and later geographic coordinates unsafe.

### Option B — Transform the Canvas element with CSS

Keep the scene stable but use CSS transforms for zoom and pan. This complicates
pointer inversion, can reduce raster quality, and splits display behavior from
the Canvas drawing transform.

### Option C — Keep a fixed render scene and apply a transient Canvas transform

Keep `RenderScene` geometry in fixed render-pixel coordinates. Apply pan and zoom
only through the Canvas 2D context while viewing it. Convert pointer coordinates
through CSS-to-backing-store scaling and then invert the viewport transform before
hit testing. Serialize SVG directly from the untransformed scene.

## Decision

Adopt Option C.

`RenderScene` coordinates are fixed render-pixel values and are the only
coordinates used by Milestone 0 Canvas and SVG scene nodes. The desktop viewport
contains only a zoom ratio and render-pixel offsets; it is transient UI state and
is neither persisted nor included in SVG export. Canvas pointer input converts
from browser CSS pixels to Canvas backing-store pixels, then through the inverse
viewport transform to render-scene coordinates before selection.

This decision deliberately does not establish planet-native, regional physical,
screen, or print coordinate contracts. Milestone 1 will introduce those distinct,
typed spaces and explicit transforms without changing the authority of accepted
semantic geometry.

## Consequences

### Positive

- Canvas and SVG retain one renderer-neutral source of truth.
- Viewport navigation cannot change exported or accepted scene content.
- Responsive Canvas layouts retain correct drag and selection behavior.
- The later domain coordinate model has a clear boundary from the render proof.

### Negative

- The Milestone 0 scene cannot represent physical distance or geographic location.
- Every Canvas interaction that addresses scene geometry must apply the documented
  inverse transform.

### Neutral or follow-up

- A future render-scene primitive may add an explicit local transform only when a
  demonstrated rendering need requires it; it must not make display projection
  authoritative geography.
- Milestone 1 decides branded planet-native and regional coordinate types,
  quantization, and invertible geographic transforms.

## Compatibility and migration

- **Accepted world documents:** None. The Milestone 0 proof scene is not persisted.
- **Persisted schemas and migrations:** None.
- **Generator, seed, parameter, context, or style versions:** None.
- **Canonical semantic/SVG/visual fixtures:** Existing Canvas and SVG proof
  fixtures remain valid because the `RenderScene` contract is unchanged.
- **macOS and Linux determinism:** Canvas viewport state is not serialized;
  canonical SVG remains a pure interpretation of stable render-pixel values.
- **Parent and child maps:** None. World-to-region transforms are deferred to
  Milestone 1 and later.

## Validation

Unit tests cover zoom centering and clamping, responsive CSS-to-backing-store
conversion, viewport inversion before selection, and render-order hit testing.
The desktop proof is visually reviewed at responsive sizes and confirms that
Canvas selection reports the render node and source ID from the shared scene.

## Revisit conditions

Revisit when Milestone 1 introduces typed geographic coordinate spaces, or when
a demonstrated render requirement needs local scene transforms, high-DPI backing
store management, rotation, clipping, or print-space output.
