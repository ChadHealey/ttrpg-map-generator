# ADR-0013 — Whole-world atlas scene composition

- **Status:** Accepted
- **Date:** 2026-08-16
- **Decision owners:** Project maintainers
- **Supersedes:** None
- **Superseded by:** None

## Context

Issue #62 turns accepted Milestone 2 land, water, semantic entities, and canonical coastline into
one renderer-neutral atlas scene. The Milestone 0 scene supports rectangles, single polygons,
polylines, and labels. A whole-world landmass can cross the display seam, contain water holes, or
enclose a pole, so one simple polygon cannot represent its fill without changing canonical
geometry or asking Canvas and SVG to reconstruct it differently.

Scene construction must remain disposable, deterministic, source-linked, and independent of
viewport state or hidden caches. Coarse viewing may reduce ink work but cannot move a semantic
boundary or change land/water classification.

## Decision drivers

- Canvas and SVG must interpret the same land and coastline geometry.
- Seam pieces, polar caps, and holes must fill without boolean repair or generator reach-through.
- Stable render identity, source entity/aspect links, and z-order must survive insertion-order
  changes and cache deletion.
- The scene contract should grow only by the primitive required for this proof.

## Options considered

### Option A — Reconstruct fills independently in each backend

Canvas and SVG could close seam paths separately. This duplicates geographic interpretation and
creates a renderer split-brain risk.

### Option B — Rasterize land/water classification into the scene

A raster classification layer would be easy to fill, but would hide semantic boundaries in a
resolution-specific cache and would not provide canonical SVG path evidence.

### Option C — Add a renderer-neutral compound fill path

Add one compound path node containing stable closed subpaths with even-odd fill semantics. Compose
those subpaths once from the accepted projected coastline, then give both backends the same values.

## Decision

Adopt Option C.

`RenderNode` gains a `compoundPath` primitive containing closed subpaths, a fill color, and the
`evenodd` fill rule. All render nodes may carry an optional source aspect ID and stable related
source IDs in addition to their primary source entity. SVG serializes these links as data
attributes; Canvas selection reads them from the shared scene rather than reconstructing identity.

Atlas scene-composition version 1 uses a fixed 2048 by 1024 logical extent. Node order is the
z-order: structural background, water field, stable-ID-ordered landmass fills, then stable
projected-path-ordered coastline ink. Fill subpaths close ordinary seam pieces along the seam. An
open path spanning opposite display edges encloses the north boundary when traversed west-to-east
and the south boundary when traversed east-to-west, preserving the accepted land-on-left winding.

The `normal-atlas` level of detail includes fills and coastline nodes. `coarse-preview` uses the
identical background, water, and land-fill nodes but omits coastline ink. It does not simplify,
move, or reclassify a boundary. Later style work may add disposable decoration through the same
scene without changing this semantic fill rule.

Scene construction accepts only core records already validated by the transaction or persistence
boundary. It canonicalizes top-level collection order, validates the source ownership and
references needed by the scene, projects canonical coastline through ADR-0012, and returns a
disposable scene or stable diagnostics. It does not repeat full-profile semantic validation during
every cache rebuild. It imports no generator implementation and consults no cache, clock, locale,
filesystem state, viewport state, or random stream.

## Consequences

### Positive

- Canvas and SVG share exact seam, pole, hole, and source-link semantics.
- Land fills remain vector evidence without promoting projected paths to accepted geography.
- Rebuilding after cache deletion produces structurally identical scene bytes.
- Coarse viewing has an explicit safe omission rule.

### Negative

- Backends and deterministic visual-evidence tooling must implement one additional primitive.
- Scene files can contain several subpaths for one seam-crossing landmass.

### Neutral or follow-up

- Issue #63 owns versioned hand-ink tokens, styled paths, decoration, and paper treatment.
- Water-body inspection may use accepted membership hit testing where marine semantic boundaries
  have no visible coastline; it must not invent a rendered geographic boundary.
- Curves, masks, opacity, patterns, and arbitrary transforms remain deferred until demonstrated.

## Compatibility and migration

No accepted document schema changes. Scene-composition version 1 is disposable render
compatibility metadata. Existing Milestone 0 and 1 scenes omit the new optional provenance fields
and serialize exactly as before. Generator, seed, semantic-classification, canonical-coastline,
projection, persistence, and style versions remain unchanged.

The six Milestone 2 fixtures add separate canonical render-scene and SVG artifacts. Semantic
kernel evidence changes only to record scene assertions and version provenance. PNG evidence is
unchanged until style work begins.

## Validation

- Focused tests cover compound-path Canvas/SVG parity, even-odd holes, selection, and unchanged
  legacy SVG bytes.
- Every registered atlas fixture composes normal, rebuilt, reordered-source, and coarse scenes.
- Fixtures prove unique stable node IDs, deterministic layer order, source entity/aspect links,
  bounded coordinates, identical coarse fill geometry, and unchanged accepted source records.
- Canonical scene and SVG bytes are registered separately from semantic and PNG evidence.

## Revisit conditions

- A valid accepted coastline cannot be represented by the seam/pole closure rule.
- Measured scene size or composition time exceeds the Milestone 2 budget.
- A demonstrated style requires curves, masks, or patterns that cannot be expressed without
  backend-specific interpretation.
