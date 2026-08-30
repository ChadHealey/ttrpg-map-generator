# ADR-0025 — Deterministic Atlas Label Glyph, Metrics, and Export Contract

- **Status:** Accepted
- **Date:** 2026-08-29
- **Decision owners:** Project maintainers
- **Supersedes:** None
- **Superseded by:** None
- **Resolves:** [Issue #129](https://github.com/ChadHealey/ttrpg-map-generator/issues/129)

## Context

Milestone 3 requires deterministic world-label placement and equivalent Canvas, SVG, and PNG
output. ADR-0024 fixes world-name content to a small ASCII grammar and keeps it separate from
`label.placement`. ADR-0022 and ADR-0023 fix the stable world-feature and named-anchor identities
that labels must retain. Those decisions are complete locally while their GitHub issues await
publication.

The current generic `RenderLabel` carries a font-family string and lets each backend render text.
That remains useful for the Milestone 0 proof, but it cannot define canonical atlas output. The
accepted `atlas-svg-v1` and `atlas-png-v1` profiles reject labels and ambient fonts; ADR-0015 and
ADR-0016 explicitly require a reviewed embedded-font or vector-text decision before that changes.
The PNG implementation already provides a deterministic even-odd filled-contour raster path with
fixed node, point, sample-visit, band, memory, and output limits.

The repository package direction also matters. `generation`, `assets`, and `render` are siblings
that depend only on `core`; they cannot import one another. Placement therefore cannot ask a
renderer or browser to measure text, and a renderer cannot privately load an asset that is absent
from the renderer-neutral scene.

## Decision drivers

- Give #141 exact host-independent metrics before collision resolution.
- Make Canvas, SVG, and PNG consume the same resolved glyph geometry without operating-system,
  browser, locale, network, or runtime font behavior.
- Preserve the exact bytes and rejection behavior of both version-1 atlas export profiles.
- Keep accepted name content, accepted label placement, disposable render geometry, and raster
  caches distinct across save/reopen and upgrades.
- Use one attractive calligraphic atlas face with auditable public-repository provenance and a
  redistribution license compatible with a public application.
- Bound glyph data, dense-label work, SVG bytes, and PNG raster work before implementation.

## Options considered

### Option A — Bundled webfont rendered as text

Bundle a WOFF/TTF, measure through DOM or Canvas APIs, emit SVG `<text>`, and use a browser or native
font rasterizer for PNG. This keeps authoring simple but makes placement, shaping, hinting,
antialiasing, and PNG output depend on runtime font engines. Embedding the font in SVG does not
supply the project-owned banded PNG rasterizer. This option is rejected.

### Option B — Parse and outline the source font at runtime

Bundle an OpenType font and a pinned parser/shaper, then produce glyph paths whenever a scene is
built. This could avoid system fonts, but it adds an output-sensitive production dependency,
repeats parsing and variable-font behavior at runtime, expands the untrusted-input boundary, and
still needs a project-owned canonical flattening and metrics contract. The bounded ASCII alphabet
does not justify that runtime surface. This option is rejected.

### Option C — Check in a versioned ASCII glyph-and-metrics pack

Pin one OFL source font, instantiate one fixed style during a reviewed asset-build step, and
commit a project-owned pack containing integer metrics, explicit pair kerning, and flattened
even-odd contours for ADR-0024's alphabet. A scene carries the used pack definitions plus resolved
glyph instances, so every backend receives the same data. This option is selected.

## Decision

### Typeface, source, and license

The initial atlas face is upright **Alegreya at `wght=500`**, with no other variable axes,
substitutions, ligatures, hinting, or locale features. Alegreya's contemporary calligraphic serif
character fits the restrained-ink atlas while remaining readable at map-label sizes. One face and
weight are enough for the first label proof; hierarchy uses bounded size and placement priority,
not additional fonts or styles.

The immutable source is Google Fonts' `Alegreya[wght].ttf`, version 2.009, at commit
[`40478177239cbf3bac07908ef0738afee0f72be7`](https://github.com/google/fonts/commit/40478177239cbf3bac07908ef0738afee0f72be7):

- source path:
  [`ofl/alegreya/Alegreya[wght].ttf`](https://github.com/google/fonts/blob/40478177239cbf3bac07908ef0738afee0f72be7/ofl/alegreya/Alegreya%5Bwght%5D.ttf);
- source byte length: `425288`;
- source Git blob: `af2b22024311daaa15ec4ab879bd67f790abb9f1`;
- source SHA-256: `ba5564634b93a8f8ba57b48cd4f1ae7417d2b4656fbac779028679b00de3cf12`;
- copyright: `Copyright 2011 The Alegreya Project Authors`;
- license: [SIL Open Font License 1.1](https://github.com/google/fonts/blob/40478177239cbf3bac07908ef0738afee0f72be7/ofl/alegreya/OFL.txt).

The pinned OFL header declares no Reserved Font Name. The derived pack nevertheless uses the
project-owned identifier `atlas-glyphs.alegreya-medium-ascii-v1` rather than presenting itself as a
general-purpose font. The asset implementation must retain the copyright, complete OFL text,
source URL/commit/digest, conversion-tool versions, and a FONTLOG-style description beside the
pack. The derived glyph data remains under OFL 1.1; repository code keeps its own license. SVG and
PNG maps are documents/artwork made with the font, not redistributed installable fonts. The
[official OFL FAQ](https://openfontlicense.org/ofl-faq/) permits application bundling and states
that embedding or creating graphics does not change the document's license.

No production dependency is selected. The implementation that creates the checked-in pack must
first record and review any development-only conversion tool under `docs/05-git-workflow.md` and
must reproduce the same manifest and asset digest on macOS and Linux.

### Alphabet and shaping policy

Glyph-pack version 1 covers exactly:

```text
U+0020 SPACE
U+0041..U+005A LATIN CAPITAL LETTER A..Z
U+0061..U+007A LATIN SMALL LETTER a..z
```

This covers ADR-0024 title-case names, single U+0020 separators, and uppercase Roman-numeral
collision suffixes. A label containing a code point outside the pack fails with
`atlas-label.glyph.unsupported`; it does not substitute a missing-glyph box or consult another
font. A visible label contains from 1 through 64 code points, has no leading, trailing, or repeated
spaces, and uses the exact accepted ASCII bytes as accessibility text. Empty or overlong text fails
with `atlas-label.text.length-invalid`; invalid spacing fails with
`atlas-label.text.spacing-invalid`. Validation reports these stable categories before metrics,
placement, scene composition, or rendering begins.

Version 1 maps each code point directly through the source cmap at `wght=500`. It applies no GSUB,
ligature, language, script, case, normalization, or hinting behavior. The pack contains a complete
explicit pair-kerning table for the supported non-space glyphs after fixed-axis instantiation;
an absent pair has adjustment zero. Placement sums only integer advance widths, the explicit pair
adjustment, and the declared tracking value. It never invokes a shaping engine.

### Canonical glyph pack

`core` owns immutable DTOs and validation for the pack; `assets` owns the accepted built-in pack.
The pack manifest contains:

- asset ID, asset-schema version `1`, glyph-behavior version `1`, source fingerprint, license ID,
  supported code points, and canonical pack SHA-256;
- `4096` integer glyph units per em;
- ascender, descender, line gap, advances, side bearings, tight bounds, and pair adjustments in
  signed glyph-unit integers;
- one stable glyph key per supported non-space code point and the space advance;
- closed outline contours as integer glyph-unit points with even-odd fill; and
- total contour, point, and byte counts for resource validation.

The reviewed converter instantiates the variable source at exactly `wght=500`, maps source metrics
to `4096` units per em, and rounds to the nearest integer with exact halves toward positive
infinity. It recursively flattens quadratic outlines until their maximum deviation from the source
curve is no more than one glyph unit (`1/4096 em`), then quantizes with the same rounding rule.

Canonicalization removes consecutive duplicate points and a duplicate terminal point, rejects
fewer than three distinct points or zero signed area, and normalizes every contour to clockwise
winding in glyph coordinates. It then rotates the cyclic sequence to the lexicographically least
complete `(x, y)` point sequence; when the least point occurs more than once, comparison continues
through each complete cyclic candidate. Contours sort ascending by
`(minX, minY, maxX, maxY, pointCount, normalizedPointSequence)`. No source traversal order,
converter collection order, or original cyclic start survives into canonical bytes. Even-odd fill
preserves counters such as those in `A`, `B`, `O`, and `a`.

The checked-in pack is the runtime authority. Runtime code never opens, parses, or instantiates the
source TTF. Changing the source, axis value, alphabet, metrics, kerning, flattening tolerance,
rounding, contour order, or pack digest creates the smallest truthful new asset and glyph-behavior
versions; it does not rewrite an accepted placement.

### Placement input and accepted state

The desktop passes a validated metric-only snapshot from `assets` into #141 through `core` types.
`generation` does not import `assets`. The snapshot includes the pack identity/fingerprint,
supported code points, integer advances, pair adjustments, bounds, and units per em, but no backend
or font-parser object.

An accepted `label.placement` record owns its opaque placement/aspect identity and retains:

- source entity ID and accepted name-content aspect ID/revision;
- exact display text;
- glyph asset ID, schema/behavior versions, and pack fingerprint;
- font size, baseline/anchor, label bounds, and resolved glyph origins in integer `1/1024`
  atlas-render-pixel ticks;
- placement behavior version, priority, variant revision, and diagnostics.

The placement resolver calculates advances and kerning with integer arithmetic, then rounds each
glyph origin and bound once to the nearest render tick with exact halves toward positive infinity.
Renderers do not measure or reflow it. A manual move changes only the accepted placement transform
and revision; it cannot mutate semantic name content, source identity, pack data, or unrelated
placements.

Save/reopen restores the accepted record without invoking naming or placement generation. The
`.mapworld` decision owned by #133 must persist these values or an equivalent lossless contract and
must require the exact released pack fingerprint. Released built-in packs remain readable; a
missing or mismatched pack produces a stable compatibility diagnostic instead of a fallback font,
new placement, or drift.

### Renderer-neutral vector label scene

The label-capable scene contract adds a project-owned vector-label node and a scene-level glyph
definition table. It does not change the generic Milestone 0 `RenderLabel` proof node.

The glyph table contains only definitions used by that scene, in glyph-key order, plus its pack
identity and fingerprint. Each vector-label node retains source entity/aspect links, exact
accessibility text, accepted placement identity/revision, fill style token, baseline/font size,
resolved integer-tick bounds, and a glyph-instance list. Every instance references one table key
and carries its already resolved integer-tick origin. Definitions are shared rather than copying
outline points into every label.

All backends use one project-owned expansion rule. For glyph point `(gx, gy)`, resolved baseline
origin `(ox, oy)`, and positive `fontSizeTicks`, all expressed as integers, the expanded render
ticks are exactly:

```text
x = ox + roundHalfTowardPositiveInfinity(gx * fontSizeTicks / 4096)
y = oy - roundHalfTowardPositiveInfinity(gy * fontSizeTicks / 4096)
```

`roundHalfTowardPositiveInfinity(n / d)` means `floor(n / d + 1/2)` for signed `n` and positive
`d`. Glyph coordinates use an upward-positive y-axis; render coordinates use a downward-positive
y-axis, hence the subtraction. The numerator and translation are evaluated with signed widened
integer arithmetic (`bigint` or an equivalent exact representation), never a floating-point
intermediate. Validation rejects an input outside its declared integer range or a final `x`/`y`
outside JavaScript's safe-integer range. Bounds use the same formula on the canonical metric box;
no backend rounds an intermediate scale, translation, or already expanded coordinate again. SVG
may retain that same definition/instance structure as `<defs>` and `<use>`; Canvas and PNG may
expand it into the same line contours. No backend applies kerning, shaping, hinting, font fallback,
path repair, or a different flattening tolerance.

Vector labels occupy the atlas label layer after coastline ink. A larger integer placement
priority means a more important label. Nodes sort by ascending numeric priority so more important
labels paint later, then by ascending placement ID using ASCII comparison. #141 must resolve
collisions before scene composition; painter order is not a collision resolver. All label contours
remain inside the fixed scene extent, and seam-adjacent placements use the one accepted projected
copy rather than wrapping text independently in a renderer.

SVG v2 emits each visible vector label as one provenance-bearing group with a child `<title>` that
contains the exact escaped ASCII text and shared outline instances. It emits no visible `<text>`,
`@font-face`, external URL, or installable font. Canvas exposes the same text through the desktop's
semantic/accessible overlay; PNG remains an opaque pixel export with no text chunks.

### Compatibility profiles and budgets

Existing `atlas-svg-v1` and `atlas-png-v1` continue to reject text/vector-label nodes and must keep
their canonical bytes. Their implementations must pin their accepted scene-composition version to
the current version `3` rather than following a mutable latest-version constant.

Label-capable output introduces:

- atlas scene-composition version `4`;
- font policy `outlined-ascii-glyphs-v1`;
- `atlas-svg-v2`, export-profile version `2`; and
- `atlas-png-v2`, export-profile version `2`.

The v2 profiles retain v1 dimensions, physical sizes, numeric formatting where applicable, SVG
`32 MiB` output ceiling, PNG sample/quantization/banding/filter/DEFLATE/chunk rules, one-live-band
policy, `64 MiB` PNG ceiling, and `128 MiB` encoded-assembly ceiling. They add only the version-4
scene and outlined-label interpretation. Legacy v1 exporters remain available for version-3
label-free scenes and fixtures.

Version 4 additionally enforces:

- at most `256` vector-label nodes;
- at most `64` code points per label and `4096` visible glyph instances per scene;
- exactly one released glyph-pack identity/fingerprint per scene;
- at most `50000` points across the one-time glyph definition table;
- the existing PNG maximum of `4096` scene nodes and `250000` stored scene/definition points; and
- the existing PNG fill-edge sample-visit budget, counting every transformed glyph contour during
  raster preparation.

Definitions count once toward stored-point and SVG-definition budgets; every transformed instance
counts toward raster work. Label support does not raise the existing band, live-raster, output, or
sample-visit ceilings. Exceeding any limit returns a stable resource diagnostic before allocation
or serialization. Representative dense output must pass inside these limits; the implementation
may lower a label count through #141's deterministic placement policy, but may not silently drop a
required accepted label or weaken a public export budget.

### Evidence matrix and implementation order

The asset and later implementations use non-private fixed evidence covering:

1. `A`, `Ava Vale`, `The Verdant Reach`, and `Eldermere II` for capitals/lowercase, spaces,
   kerning, counters, and ADR-0024 suffixes;
2. empty text, 65-character text, leading/trailing/repeated spaces, and `A-B` for the exact
   `length-invalid`, `spacing-invalid`, and `glyph.unsupported` diagnostic categories;
3. the same metric snapshot, placement, glyph table, and expanded contour fingerprints on macOS
   and Linux;
4. sparse ordinary labels and the maximum dense matrix, including seam-adjacent accepted
   placement, stable source links, canonical ordering, and deterministic resource rejection;
5. save/reopen of accepted glyph origins and bounds without generator or placement invocation;
6. byte-identical repeated SVG v2 and PNG v2 exports plus Canvas/SVG/PNG geometry comparison;
7. unchanged v1 fixture bytes and explicit rejection of version-4/vector-label scenes; and
8. sparse and dense visual crops at `1600 × 800` plus sampled `8192 × 4096` PNG seams, counters,
   thin joins, and band boundaries.

The implementation sequence is:

1. Create one bounded asset-contract child to add the `core` DTO/validation, the reviewed
   development-only converter boundary, the checked-in `assets` glyph/metrics pack, OFL notices,
   provenance manifest, digest tests, and cross-platform reproduction evidence.
2. Reauthor #141 to depend on that asset child and #140, then implement candidates, collision
   resolution, accepted placement records, metric-only input, and fixed placement vectors.
3. Incorporate the accepted placement/pack reference into the schema work owned by #133 before
   claiming save/reopen completion.
4. Reauthor #142 to depend on the asset child and #141, then implement scene version 4, Canvas
   vector labels, SVG v2, PNG v2, compatibility tests, and visual evidence.

SVG and PNG do not need separate implementation issues because both consume the same flattened
contours and resolved instances in `packages/render`. Split #142 only if measured work reveals an
independent third boundary or either exporter cannot retain the shared geometry and current
resource budgets.

## Consequences

### Positive

- Placement, preview, SVG, and PNG never depend on host fonts or backend text measurement.
- One small ASCII pack provides attractive map lettering, explicit metrics, reusable outlines,
  bounded licensing, and efficient SVG definition reuse.
- Existing v1 public exports and the generic proof label remain untouched.
- Accepted placements survive reopen and upgrades without reflow or regeneration.

### Negative

- The first atlas labels are ASCII-only, upright, single-face, straight baseline labels.
- Font conversion and the derived pack require a dedicated reviewed asset step before placement
  implementation can begin.
- Flattened outlines cost more scene/raster work than native text and must fit explicit dense-map
  budgets.

### Neutral or follow-up

- #140 still owns name generation; this decision does not change name content.
- #141 owns label selection and collisions, not rendering.
- #133 owns persistence schema and migration boundaries.
- #142 owns renderer/export implementation after the pack and placements exist.
- Unicode, complex shaping, curved baselines, multiple weights, regional-local typography, and
  user-imported fonts require separate versioned decisions.

## Compatibility and migration

- **Accepted M2 world documents and geography:** unchanged.
- **Existing name content and M3 physical/context decisions:** unchanged.
- **Persisted schemas:** no label-placement schema exists yet; #133 must add the released pack
  reference and lossless accepted placement contract before persistence implementation.
- **Seed and generator behavior:** unchanged by this ADR. Later placement implementation receives
  its own behavior version and reroll-isolation fixtures.
- **Style and scene versions:** existing style tokens remain; scene version 4 adds vector labels
  and the outlined glyph policy without redefining version 3.
- **SVG/PNG compatibility:** v1 profiles and bytes remain valid and label-free. New label-capable
  output uses v2 profiles.
- **Fixtures:** existing semantic, scene-v3, SVG-v1, PNG-v1, and visual evidence is append-only and
  unchanged. New pack, placement, scene-v4, SVG-v2, PNG-v2, and sparse/dense visual rows are added
  by their owning implementation issues.
- **macOS/Linux:** the checked-in pack is byte-identical input on both platforms; metric,
  placement, scene, SVG, and PNG fingerprints must match exactly.
- **Parent/child maps:** named-anchor source identities from ADR-0023 remain unchanged. Regional
  label content and placement are still independently resolved later.

## Validation

Review the selected option and fixed matrix against ADR-0015, ADR-0016, ADR-0022, ADR-0023,
ADR-0024, `docs/01-architecture.md`, and the current PNG point/sample/output ceilings. Confirm the
pinned source digest and OFL header from the immutable Google Fonts commit. Search the repository
to ensure no existing atlas path claims ambient font support and no v1 profile is authorized to
accept labels.

The later asset child proves pack reproduction and license/provenance. #141 proves metrics,
collision, ordering, seam, isolation, and accepted-state behavior. #142 proves scene validation,
shared geometry, exact-repeat exports, legacy compatibility, resource bounds, accessibility
metadata, and sparse/dense visual quality. C2–C4 implementation work receives the repository's
dedicated read-only review before publication.

## Revisit conditions

- The pinned source or derived pack cannot be reproduced byte-for-byte on macOS and Linux with a
  reviewed development-only tool.
- The derived pack exceeds `50000` points or representative dense labels exceed existing node,
  point, fill-visit, SVG-byte, PNG-byte, band, time, or memory limits.
- One-glyph-unit flattening produces visible counters, joins, or diagonals that fail the reviewed
  `1600 × 800` or sampled `8192 × 4096` gallery.
- SVG or PNG requires backend-specific label geometry instead of the shared scene definitions and
  instances.
- Product requirements introduce Unicode, complex scripts, curved text, multiple faces, or
  user-supplied fonts.
