# ADR-0015 — Deterministic whole-world atlas SVG export

- **Status:** Accepted
- **Date:** 2026-08-17
- **Decision owners:** Project maintainers
- **Supersedes:** None
- **Superseded by:** None

## Context

Issue #66 exports a reopened accepted Milestone 2 atlas from the same renderer-neutral
`AtlasRenderScene` used by Canvas preview. The existing `renderSceneToSvg` function is the released
Milestone 0/1 proof serializer: it uses render-pixel root dimensions and deliberately has no atlas
export profile, physical-size policy, metadata contract, font restriction, output ceiling,
progress/cancellation boundary, or native atomic file commit.

The accepted atlas scene already owns seam-safe fills, canonical coastline-derived ink, coastal
echoes, water marks, paper treatment, stable node order, and source links. SVG export must
interpret those nodes without consulting generator internals, reconstructing geography, or
changing accepted state.

## Decision drivers

- Repeated export of the same scene, style metadata, dimensions, and settings must be
  byte-identical on macOS and Linux.
- Canvas and SVG must retain identical scene geometry, fill rules, masks, and z-order.
- Stable element IDs, source links, definitions/references, numeric formatting, metadata, and
  physical units must be inspectable.
- Unsupported dimensions, text/fonts, malformed scenes, oversize output, cancellation, and native
  failures need stable actionable diagnostics.
- The fixed workload must remain below 3 seconds, 512 MiB additional memory, and 32 MiB output.
- Milestone 0/1 canonical SVG bytes must not change.

## Options considered

### Option A — Expand the generic proof serializer in place

This would reuse one function name but silently change released Milestone 0/1 evidence and mix a
small demonstration serializer with a versioned production export contract.

### Option B — Build SVG through browser DOM APIs

DOM construction would add browser implementation and serialization behavior to canonical bytes,
make Node/Linux evidence harder to reproduce, and use more memory than direct bounded text
serialization.

### Option C — Add a dedicated project-owned atlas SVG profile

Validate a complete `AtlasRenderScene`, serialize canonical UTF-8 markup directly in node order,
and send its verified bytes through a narrow native atomic single-file writer.

## Decision

Adopt Option C as `atlas-svg-v1`, export-profile version 1.

### Dimensions, viewBox, and font policy

- The viewBox is always `0 0 2048 1024`, matching scene-composition version 2 exactly.
- Physical dimensions are whole millimetres with an exact 2:1 ratio from `200 × 100 mm` through
  `1600 × 800 mm`; the desktop default is `400 × 200 mm`.
- SVG scales the unchanged viewBox to physical size. Export does not resample, simplify, or
  reinterpret scene geometry.
- Font policy `no-rendered-text-v1` rejects every `label` node. Milestone 2 has no required labels
  or fonts, so the exporter embeds no font, chooses no ambient system font, and emits only a
  non-rendered accessibility `<title>`.

### Canonical serialization

- Root and metadata fields have fixed order and contain no clock, host, locale, destination path,
  or application-session data.
- Metadata records export profile/version, world-map source, scene/projection/seam versions,
  coordinate space, style/token versions, dimensions, viewBox, and font policy.
- Scene node array order is SVG paint order. The exporter validates the canonical background,
  land, paper, water-decoration, and coastline layer sequence instead of sorting or repairing it.
- Every drawn element retains `data-render-node-id`, source entity/aspect ID, and sorted related
  source IDs. A collision-free ASCII encoding of the render-node ID supplies its real SVG `id`.
- Version 1 rounds finite scene numbers to six decimal places, trims trailing zeros, and writes
  negative zero as `0`. The maximum displacement is 0.0000005 logical render pixels and changes no
  semantic classification or canonical coastline source.
- A stable user-space clip-path definition and reference give SVG the same fixed scene boundary as
  Canvas. Compound paths retain `evenodd`; stroke caps and joins retain the scene backend policy.
- UTF-8 output ends in one LF. Output above exactly 32 MiB is rejected before native commit.

### Desktop and native commit

The desktop export operation accepts only an accepted clean atlas and consumes its existing
scene. It emits bounded serialization progress and observes cancellation between 128-node batches.
Cancellation before native commit writes no destination. Once the verified native commit begins,
the interface reports that the short durability sequence is non-cancellable.

The native adapter validates lowercase `.svg` paths, canonical base64, byte length, and SHA-256;
rejects symbolic-link or special destinations and stale temporary artifacts; writes a
same-directory private temporary file; flushes and reads it back; atomically replaces the target;
flushes the parent directory; and reads the committed target back again. Its receipt must exactly
match requested path, length, digest, and supported platform before the desktop reports success.
An interrupted pre-rename export leaves the old destination intact and a recognizably named
temporary artifact that is safe to clean.

## Consequences

### Positive

- Atlas SVG is deterministic without relying on browser DOM serialization or a new dependency.
- Stable IDs, provenance, definitions/references, physical units, and compatibility metadata are
  available to users and fixture review.
- Canvas and SVG continue to consume one scene; the exporter performs no geographic repair.
- Atomic native replacement prevents a partial SVG from being presented as complete.
- Legacy generic SVG evidence remains byte-compatible.

### Negative

- Version 1 supports one projection, scene-composition version, and built-in style provenance.
- It rejects rendered text instead of embedding a font that Milestone 2 does not require.
- The desktop defaults to a stable Downloads filename because a save-dialog plugin would be a new
  production dependency; a later reviewed file-picker change can supply an explicit path without
  changing canonical bytes.

## Compatibility and migration

- **Accepted geography, appearance, and persistence:** unchanged. SVG remains external evidence,
  not authoritative document state.
- **Scene composition, projection, style, and generator versions:** unchanged.
- **Export compatibility:** `atlas-svg-v1` version 1 is new. Any change to its bytes requires the
  smallest truthful export-profile version and separate SVG review.
- **Fixtures:** all six registered atlas rows replace only canonical SVG/manifest evidence;
  canonical semantic kernel, render scene, visual image, and authoritative package evidence remain
  unchanged.
- **Milestone 0/1:** the generic `renderSceneToSvg` contract and bytes remain unchanged.

## Validation

Focused tests cover dimensions, font rejection, metadata, numeric formatting, stable IDs,
definitions/references, source links, z-order, deterministic repeat bytes, cancellation, native
request/receipt validation, atomic replacement/readback, and accepted-state immutability. The
production generation integration compares semantic and SVG evidence separately across geography
reroll, appearance reroll, save/reopen, and repeat export. All six registered rows regenerate
through the production exporter and enforce the 32 MiB ceiling; seam and control-extreme SVGs are
visually inspected.

## Revisit conditions

- Milestone 3 labels require a reviewed embedded-font or vector-text policy.
- A second atlas scene version, projection, or built-in style needs export compatibility.
- Representative release measurements miss the accepted time or memory budget.
- A reviewed desktop file-dialog capability becomes worth a production dependency.
