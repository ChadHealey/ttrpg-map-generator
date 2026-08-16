# ADR-0012 — Equirectangular atlas display projection and seam splitting

- **Status:** Accepted
- **Date:** 2026-08-16
- **Decision owners:** Project maintainers
- **Supersedes:** None
- **Superseded by:** None

## Context

[Issue #61](https://github.com/ChadHealey/ttrpg-map-generator/issues/61) projects accepted
planet-native coastline from issue #60 into the Milestone 2 whole-world postcard. The projection
must show the complete sphere in a 2:1 rectangle, split strokes at the canonical longitude seam,
handle poles explicitly, and preserve source identity without turning display paths into accepted
geography.

ADR-0005 owns spherical authority and canonical integer ticks. ADR-0009 owns seam/pole sampling,
and ADR-0011 owns canonical ring winding, provenance, identities, and reject-only validation. This
decision owns only the derived display chart and the deterministic adapter between accepted rings
and later `RenderScene` composition.

## Decision drivers

- Show every longitude and latitude in one rectangular 2:1 atlas postcard.
- Put the horizontal split exactly on the ADR-0005 canonical seam.
- Prevent world-spanning chords, duplicate seam strokes, and renderer-side repair.
- Preserve canonical ring, landmass, water-body, and source-boundary provenance on every split path.
- Make preview and full-resolution scene construction consume identical semantic paths.
- Use exact project-owned arithmetic without a production dependency or floating intersection rule.

## Options considered

### Option A — Equirectangular display ticks with explicit seam splitting

Map longitude and latitude linearly into an exact 2:1 integer rectangle. Unwrap only one crossing
edge at a time, intersect it with the seam using rational integer arithmetic, and emit an endpoint
on each side of the display chart.

### Option B — Equal-area pseudocylindrical projection

An equal-area projection reduces area distortion, but curved boundaries and non-rectangular pole
edges add clipping and inverse-selection policy before the initial postcard has demonstrated that
need. Several familiar choices also require lobes or interrupted edges that complicate stable
path identity.

### Option C — Web Mercator

Mercator is familiar for interactive maps, but cannot show either pole and therefore cannot meet
the complete-world proof. Its unbounded vertical scale also conflicts with the fixed 2:1 extent.

### Option D — Let Canvas and SVG wrap long segments independently

Backend-local wrapping appears small but creates renderer split-brain, loses shared path identity,
and asks renderers to repair geography. It cannot provide one integration boundary for preview and
export.

## Decision

Adopt Option A as display-projection version 1 and seam-policy version 1. The projection ID is
`atlas-equirectangular`; its derived coordinate space is `atlas-display-equirectangular-v1`.

### Exact display mapping

Display coordinates use safe integer ticks and are disposable:

```text
width  = 2^32 display ticks
height = 2^31 display ticks
x = longitudeTicks - (-2^31)
y = 2^30 - latitudeTicks
```

Thus west/east increase from the left canonical seam, north is the top edge, south is the bottom
edge, and the logical aspect ratio is exactly 2:1. The canonical `-2^31` longitude maps to the left
edge. A transient unwrapped `+2^31` seam intersection maps to the right edge. Both display values
name the same planet meridian but remain different chart-boundary locations. Canonical poles map to
the top or bottom display edge. The authoritative pole remains the single longitude-zero
`PlanetPoint` from ADR-0005.

Preview and full scene resolutions scale these same display ticks. Projection performs no
resolution-dependent simplification, classification, or clipping, so their semantic tolerance is
zero display ticks. A later level-of-detail policy may omit decoration or use separately reviewed
display simplification, but it cannot change source path identity or accepted geography.

### Seam intersection and path construction

An edge crosses the seam when its canonical longitude delta has magnitude greater than half a
turn. The adapter unwraps the destination by exactly one turn along the shortest longitude path.
It computes seam latitude from the integer tick ratio and rounds one final rational result to the
nearest latitude tick, with exact ties away from zero. No binary64 projection or epsilon decides
the split.

The source-side fragment ends at its corresponding left or right boundary; the next fragment
starts at the opposite boundary with the same latitude. Ring closure joins the first and last
fragments before output. Consecutive duplicate seam points and zero-length seam-touch fragments are
discarded; every drawable nonzero fragment is retained, including one-tick features. Unsplit rings
remain one explicitly closed drawing path. Split paths are open so neither backend strokes a
synthetic chart-edge join.

Rings are processed in stable ring-ID order without modifying the source array. Within one ring,
paths follow its canonical point traversal. A path ID is the canonical ring ID plus projection ID,
projection version, and zero-padded source-path index. Each path repeats the source ring ID,
source-boundary fingerprint, landmass entity ID, and stable water-body ID list. Display paths are
not entities, aspects, persistence records, or replacements for the canonical ring.

### Boundary and failure policy

The adapter accepts only ADR-0011 policy-version-1 coastline metadata and canonical planet points.
It rejects unsupported metadata, invalid source identity/provenance, duplicate or too-short rings,
and noncanonical point records with stable `atlas-projection.*` diagnostics. It does not close,
rewind, simplify, repair, infer hole semantics, or rewrite source rings. Complete semantic and
topology validation remains the accepted-state boundary in `core`; renderer backends receive only
successful projected output.

The adapter belongs to `packages/render`: it consumes public `core` records, has no generator,
persistence, desktop, Canvas, or SVG dependency, and supplies derived paths for the later scene
composer. Canvas and SVG continue to interpret the same `RenderScene` rather than invoking this
adapter independently.

## Consequences

### Positive

- The complete sphere, both poles, and canonical seam fit an exact 2:1 rectangle.
- Seam intersections and ordering are deterministic integer operations.
- Canonical source identity survives any number of projected path splits.
- Preview and full output share zero-tolerance semantic paths before pixel scaling.
- Canvas and SVG receive one seam-split scene and never repair world-spanning segments.
- No production dependency, projection-shaped accepted data, or generator version is added.

### Negative

- Equirectangular area and shape distortion grows toward the poles.
- One physical seam location has two derived chart-edge representations.
- Filled land polygons with holes will need the later scene composer to preserve fill semantics;
  this issue proves coastline strokes and does not invent a polygon boolean pipeline.

### Neutral or follow-up

- Issue #62 composes full atlas `RenderScene` nodes from these paths and accepted presentation data.
- Issue #66 owns canonical SVG evidence; issue #67 owns deterministic PNG export.
- Alternative user-selectable projections and regional projections remain out of scope.

## Compatibility and migration

- **Accepted world documents:** unchanged. Projection output is disposable and canonical coastline
  remains materialized planet-native authority.
- **Persisted schemas and migrations:** unchanged. The projection ID/version is scene/export cache
  metadata, not an accepted geography record in Milestone 2.
- **Generator, seed, parameter, context, or style versions:** unchanged. Projection version 1 and
  seam-policy version 1 are new render-adapter compatibility inputs. Changing their output requires
  the smallest projection/seam version change and reviewed render evidence.
- **Canonical semantic/SVG/visual fixtures:** canonical semantic coastline bytes remain unchanged.
  The six pre-persistence atlas vectors gain derived projection fingerprints. Canonical SVG/PNG
  evidence remains owned by later issues.
- **macOS and Linux determinism:** safe-integer coordinates, `bigint` rational intersection, explicit
  tie rounding, and stable ordering are byte-comparison inputs on both platforms.
- **Parent and child maps:** unchanged. Regional context consumes planet-native geometry and its own
  local projection, never these display paths.

## Validation

Tests cover both seam directions, repeated seam crossings, seam touches, near-pole geometry,
opposite-wound seam-spanning holes, exact quantization boundaries, and one-tick retained features.
They prove source immutability, provenance, stable path IDs/order, deterministic repeated output,
no world-spanning projected segment, zero preview/full semantic tolerance, and stable diagnostics.
An integration test gives the same seam-split `RenderScene` polylines to production Canvas and SVG
backends and compares their interpreted point sequences.

The six fixed atlas rows record projection metadata, path/point/seam-split counts, and the exact
projected primitive-traversal SHA-256 while retaining their unchanged canonical coastline hash.

## Revisit conditions

- Reviewed near-pole atlas output shows equirectangular distortion prevents the required visual
  quality.
- A later selectable projection needs a stable inverse selection contract or a different seam.
- Filled land/hole scene composition demonstrates that path-only splitting cannot preserve required
  fill semantics without a versioned clipping extension.
- Projection or scene construction becomes a measured budget bottleneck.
