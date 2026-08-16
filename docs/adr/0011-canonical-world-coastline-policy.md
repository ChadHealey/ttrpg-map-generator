# ADR-0011 — Canonical world coastline policy

- **Status:** Accepted
- **Date:** 2026-08-16
- **Decision owners:** Project maintainers
- **Supersedes:** None
- **Superseded by:** None

## Context

[Issue #60](https://github.com/ChadHealey/ttrpg-map-generator/issues/60) turns the accepted
Milestone 2 land/water partition and semantic entities into canonical planet-native coastline
vectors. ADR-0009 selected spherical marching cells, exact quantized predicates, reject-only
repair, and a topology-guarded simplifier, but deliberately left winding, source identity,
simplification tolerance, and complete validation to this issue.

Canonical coastline is accepted geography. It must remain continuous across the ADR-0005 seam,
handle each pole as one surface location, preserve every accepted classification adjacency, and
load without invoking generation. Display projection and styled ink remain disposable downstream
data owned by later issues.

## Decision drivers

- Preserve every full-profile land/water sample, narrow channel, and retained island.
- Give #61 stable ring provenance without deriving identity from simplified points or traversal.
- Keep the maximum simplification displacement visually bounded at the required 8192-pixel export.
- Reject invalid topology with stable diagnostics instead of silently repairing accepted state.
- Produce deterministic bytes and ordering on supported Node platforms.

## Options considered

### Option A — Unsimplified marching-cell rings

Store every full-profile contour point. This is the most conservative classification boundary,
but it leaves the topology-guarded simplifier selected by ADR-0009 unproved and retains avoidable
vertices on locally straight coastline.

### Option B — Quarter-cell guarded simplification

Use a tolerance of 524,288 planet ticks, one quarter of a version-1 full-profile cell. On the
default 40,000 km world this is about 4.9 km at the equator and at most one horizontal pixel in an
8192-pixel-wide whole-world export. Protect seam and pole anchors. Rank candidates exactly and
remove only non-adjacent vertices whose replacement chord does not intersect the ring and whose
changed triangle contains no accepted sample anchor.

### Option C — Half-cell guarded simplification

Use 1,048,576 ticks. This can reduce more points, but permits roughly two pixels of displacement at
the maximum proof export before styling and provides no demonstrated product benefit for the
larger compatibility allowance.

## Decision

Adopt Option B as simplification-policy version 1.

Extraction uses ADR-0009 marching quads and polar triangles with deterministic integer-tick
interpolation against the accepted half-tick threshold. Every raw segment is directed in its
unwrapped local cell with accepted land on its left. This
`land-on-left` winding describes both ordinary outer loops and oppositely wound holes without
choosing a projection-space exterior. Rings use implicit closure and never duplicate their first
point.

Each raw vertex records the land/water sample transition that produced it. Generation proves that
the complete ring set covers every accepted land/water neighbor pair exactly once. A physical loop
records its one landmass ID and every adjacent water-body ID in stable order; it does not select an
arbitrary primary water body when semantic marine segmentation meets one coast.

Ring provenance is the SHA-256 of the versioned landmass ID, ordered water-body IDs, and canonical
oriented cycle of source sample transitions. Ring identity derives from the stable world-coastline
singleton plus that fingerprint. It therefore survives point simplification and collection
reordering while changing when the authoritative classified boundary or source semantics change.

The simplifier performs one deterministic pass. Candidate distance uses exact integer squared
ratios; ties use canonical tick/index keys. Seam points, pole points, and vertices incident to a
canonical seam crossing are protected. Adjacent candidates are not both removed, so every new
edge replaces at most two raw edges. A candidate is rejected if its chord intersects the current
ring or its changed triangle contains or touches a full-profile sample anchor. Complete
post-simplification self/inter-ring topology validation runs before proposal.

Repair policy is `reject-invalid-no-silent-repair`. Extraction, source coverage, winding,
simplification, identity, or topology failure returns an actionable stable diagnostic and leaves
previously accepted geography unchanged.

## Consequences

### Positive

- Classification coverage is exact at every accepted anchor rather than inferred from appearance.
- Rings carry sufficient source identity for deterministic projection, persistence, and rendering.
- Holes, seam crossings, polar caps, channels, and small islands share one spherical contract.
- Simplification is visibly bounded and cannot accumulate tolerance through repeated removals.

### Negative

- The conservative one-pass policy removes fewer points than iterative Douglas-Peucker-style
  simplification.
- Accepted validation performs full-profile boundary coverage work and exact integer geometry.
- Ring provenance intentionally changes when semantic water segmentation along a loop changes.

### Neutral or follow-up

- #61 may split one canonical ring into several projected paths but cannot mutate this geometry or
  identity.
- #65 persists the materialized output and its version metadata; load validation never extracts or
  simplifies it again.

## Compatibility and migration

No released Milestone 2 coastline record exists, so no migration is required. Geometry behavior,
extraction, simplification-policy, topology-validation, and parameter-schema versions all begin at

1. Changing tolerance, protection, candidate ordering, source fingerprinting, winding, repair,
   or validation semantics increments the smallest truthful version and updates reviewed fixed
   evidence. Seed derivation and deterministic-stream versions remain 1; the generator records a
   map/entity namespace but makes zero random draws.

Existing Milestone 0/1 accepted data, SVG, PNG, persistence schemas, style versions, regional
context, and child maps are unchanged. The six Milestone 2 pre-persistence kernel vectors gain
canonical coastline evidence and remain the macOS/Linux byte-comparison boundary until #65 moves
the same output to canonical accepted-aspect bytes.

## Validation

- Exact source-transition coverage is compared with every full-profile land/water adjacency.
- Raw segment references prove land-left winding; post-quantization validation rejects duplicate,
  short, self-intersecting, or mutually intersecting rings.
- Minimized adversarial tests cover both seam directions, polar caps, nested holes, quantization,
  a guarded channel anchor, a tiny island, closure, and invalid intersections.
- The registered six-row fixed matrix records ring/source identities, raw and simplified point
  counts, seam/pole evidence, metadata, and a canonical primitive-traversal SHA-256.
- Repeated generation is structurally identical, and `pnpm test:cross-platform` compares the same
  evidence on macOS and Linux.

## Revisit conditions

- The complete atlas scene or export budget shows canonical point count is a measured bottleneck.
- Visual review shows a one-pixel maximum canonical displacement is too coarse at required output.
- A valid accepted classification cannot be represented without a polygon boolean operation.
- Regional coastline inheritance requires additional source anchors beyond the canonical
  transition fingerprint.
