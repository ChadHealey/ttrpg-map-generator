# ADR-0016 — Deterministic whole-world atlas PNG export

- **Status:** Accepted
- **Date:** 2026-08-17
- **Decision owners:** Project maintainers
- **Supersedes:** None
- **Superseded by:** None

## Context

Issue #67 exports a reopened accepted Milestone 2 atlas from the same renderer-neutral
`AtlasRenderScene` used by Canvas preview and the `atlas-svg-v1` exporter. The existing fixture
PNG helper is deliberately test-only: it does not define the production raster, high-resolution
tiling, PNG chunks, compression, progress/cancellation, resource limits, or native commit
contract.

The accepted scene already contains seam-safe fills, canonical-coastline-derived ink, coastal
echoes, water marks, and non-repeating paper treatment in stable painter order. PNG export must
interpret those exact nodes without consulting generator internals, reconstructing geography, or
changing accepted state. The required 8192 by 4096 output cannot rely on a full-size browser
surface or a second unmeasured image copy.

## Decision drivers

- Repeated export of the same accepted scene, versions, dimensions, and settings must produce
  byte-identical PNG on macOS and Linux.
- Canvas, SVG, and PNG must retain the same scene geometry, fill rule, clipping, source ordering,
  and opaque colors.
- Large output must use a fixed, measurable raster-band contract with no tile seams, clipped ink,
  repeated paper grain, or hidden full-size raster.
- PNG chunk, filtering, compression, and metadata policy must not depend on a browser encoder,
  operating-system library, locale, clock, host, network, or ambient font.
- Unsupported input, resource exhaustion, cancellation, and native failures need stable,
  actionable diagnostics and deterministic aftermath.
- The fixed workload must remain subject to the existing 15-second, 1-GiB additional-memory, and
  64-MiB destination limits without redefining those limits on faster development hardware.

## Options considered

### Option A — Browser Canvas and `toBlob`

Rasterize the complete atlas into an offscreen Canvas and delegate PNG encoding to the WebView.
This makes canonical bytes and compression dependent on the installed browser engine, requires a
large live surface, and does not expose a bounded streaming or tile-allocation contract.

### Option B — A third-party or native raster/PNG library

Adopt a software rasterizer and encoder, or move rendering into Rust. This could supply broader
format support, but adds an output-sensitive production dependency or a second rendering engine
before a measured need justifies it. It would still require project-owned scene validation,
tiling, progress, cancellation, and compatibility policy.

### Option C — A project-owned banded rasterizer and canonical PNG encoder

Interpret the validated atlas scene with one small deterministic supersampling policy, rasterize
full-width haloed bands, and stream filtered rows through a deliberately narrow project-owned
zlib/DEFLATE and PNG writer. Send only the verified canonical bytes through a narrow native atomic
single-file commit boundary.

## Decision

Adopt Option C as `atlas-png-v1`, export-profile version 1.

### Supported dimensions and scene boundary

Version 1 supports exactly these 2:1 pixel dimensions:

- `1600 × 800`, for the checked-in reviewed gallery;
- `4096 × 2048`, for an intermediate high-resolution export; and
- `8192 × 4096`, the desktop default and Milestone 2 release workload.

The exporter consumes only the complete normal-detail `AtlasRenderScene` with logical extent
`2048 × 1024`, scene-composition version 2, atlas display projection/seam version 1, and the
restrained-ink style/token version 1. It preserves scene array order as painter order and clips to
the fixed scene extent. It rejects labels and unsupported nodes or versions; Milestone 2 embeds no
font and consults no ambient font or asset. Changing the supported dimension set, default,
accepted scene/style versions, or label policy changes the export profile.

### Deterministic raster policy

Scene geometry is scaled into output-pixel space, then every coordinate and stroke width is
quantized to the nearest `1/256` output pixel. All version-1 scene coordinates are nonnegative, so
nearest ties resolve upward without a signed-zero case.

Each output pixel uses these four fixed sample offsets in output-pixel coordinates, in this order:

```text
(1/4, 1/4), (3/4, 1/4), (1/4, 3/4), (3/4, 3/4)
```

Each sample plane uses binary coverage. Compound paths use the scene's even-odd fill rule.
Polyline strokes use the union of round-ended segment capsules, which also produces round joins.
Rectangles, fills, and strokes replace the previous opaque RGB sample in scene painter order;
there is no alpha channel, transparency, blending mode, antialiasing implementation choice, or
backend-local geography repair. The final output channel is the integer sRGB-channel average
`(sample0 + sample1 + sample2 + sample3 + 2) >> 2`.

These sampling, quantization, coverage, and averaging rules are compatibility bytes. A future
antialiasing, subpixel, gamma-aware averaging, or stroke-coverage change requires a new profile
version and separate PNG review.

### Bounded raster bands

Rasterization proceeds in row-major, full-output-width bands. Each band owns 64 core rows plus an
8-pixel vertical halo above and below, clipped at the output boundary. Only the core rows enter
the PNG stream. The halo makes scene culling and capsule coverage identical on either side of a
band boundary; version-1 validation rejects a raster footprint that cannot be represented by that
fixed overlap instead of clipping it silently.

Exactly one expanded raster band may be live. It contains four opaque RGB sample planes. At the
maximum dimension, its allocation is bounded by:

```text
8192 pixels × (64 + 8 + 8) rows × 4 samples × 3 channels
= 7,864,320 bytes
```

Encoding retains exactly two additional RGB scanline buffers: the current unfiltered output row
and the previous unfiltered output row. It does not allocate a complete RGB/RGBA output surface,
a second live band, a full filtered image, or a full decoded duplicate. Scene and bounded encoder
state are not raster surfaces. Changing core height, halo, band traversal, live-band count, or row
buffer policy changes the profile and resource evidence.

### PNG chunks, filtering, and compression

The byte stream contains, in exact order:

1. the standard PNG signature;
2. one `IHDR` chunk with the selected width/height, bit depth `8`, truecolor type `2`, compression
   method `0`, filter method `0`, and no interlace;
3. one `sRGB` chunk with rendering intent `0`;
4. one or more consecutive `IDAT` chunks; and
5. one zero-length `IEND` chunk.

There are no other chunks. In particular, the profile emits no alpha/palette, `pHYs`, `tIME`,
text, host, locale, destination, free-form metadata, `gAMA`, `cHRM`, or background chunk. The scene
paper color is drawn as the opaque RGB background. Chunk lengths and CRC-32 values use the PNG
standard's big-endian encoding.

Each uncompressed scanline begins with its filter byte. The first output row uses filter `1`
(`Sub`), with three bytes per pixel. Every subsequent row uses filter `2` (`Up`) against the
previous unfiltered RGB row. Differences wrap modulo 256.

The filtered stream is wrapped in project-owned zlib with the exact header bytes `0x78 0x01`.
One `BFINAL = 1` fixed-Huffman DEFLATE block contains the complete stream. Match selection resets
at every scanline: cross-row matches are forbidden even though the DEFLATE history exists. Within
one scanline the encoder scans left to right, finds each maximal equal-byte run, emits its first
byte as a literal, then emits the longest legal distance-1 matches up to length 258; a final one or
two bytes that cannot form a match remain literals. All other bytes are literals. It uses the
canonical fixed literal/length and distance tables and their standard extra-bit order, emits one
end-of-block symbol, and zero-pads to the next byte boundary. The zlib trailer is the incremental
Adler-32 of the complete uncompressed filtered stream, encoded big-endian.

The resulting single zlib stream is sliced without reset into consecutive `IDAT` data payloads of
1 MiB (`1,048,576` bytes). Every non-final payload is exactly 1 MiB; the final payload contains the
remaining one byte through 1 MiB. Chunking never changes DEFLATE history or block boundaries.
Output larger than exactly 64 MiB is rejected before native commit.

The compressed IDAT sink is itself capped at 64 MiB and never retains filtered scanlines. Final
PNG assembly may temporarily coexist with that bounded compressed sink, so the declared maximum
concurrent encoded assembly is 128 MiB. At maximum width, the raster output row, encoder previous
RGB row, and filtered scanline total 73,729 bytes. The desktop's canonical base64 transport is
bounded by `4 × ceil(64 MiB / 3)` bytes; native decoded and readback buffers are separately bounded
at 64 MiB. These encoded/transport buffers are included in aggregate-memory measurement and are
not disguised as raster surfaces.

### Progress, cancellation, and native commit

The export operation validates one immutable accepted scene, then reports monotonic progress for
validation, band rasterization, row filtering/compression, and native commit. Operations lasting
more than 250 ms follow the Milestone 2 first-event and maximum-gap rules. Progress includes the
operation ID, stable stage, completed work, total work when known, and cancellation-requested
state. Terminal success occurs only after final PNG validation and verified native receipt.

Raster and encoder loops observe cancellation at bounded safe points. Cancellation before native
commit writes no destination and discards only disposable band/encoder state. Once native durable
commit begins it is explicitly non-cancellable. Acknowledgement stops costly scheduling, and no
destination replacement can occur after a cancellation acknowledgement. Cancellation or failure
cannot mutate the accepted document or affect bytes from a later completed export.

Stable `atlas-png.*` diagnostics distinguish unsupported profile/dimensions/scene/style/nodes,
invalid geometry or z-order, resource/output limits, cancellation, destination conflicts,
fingerprint mismatch, and native I/O. Human-readable text is not a control-flow contract.

The native adapter validates a lowercase `.png` path, canonical base64, exact byte length, and
SHA-256. It rejects symbolic-link or special destinations and stale recognizable temporary
artifacts; writes a private same-directory `.atlas-png-v1.temporary` file; flushes and reads it
back; atomically replaces the target; flushes the parent directory; and reads the committed target
back. The desktop reports success only when the receipt matches path, length, digest, and supported
platform. An interrupted or failed pre-replacement export leaves an existing destination intact.

## Consequences

### Positive

- Canonical PNG bytes do not depend on WebView rasterization, browser encoders, fonts, native image
  libraries, or a new production dependency.
- Four-sample coverage gives fine ink a small fixed quality policy while retaining integer output
  and cross-platform repeatability.
- The largest live raster allocation is explicit and far below a complete 8192 by 4096 image.
- Full-width haloed bands cannot repeat global paper/decorative content or expose a vertical tile
  edge in the cropped output.
- Native replacement prevents a partial PNG from being presented as complete.

### Negative

- Version 1 supports only three fixed 2:1 sizes and one scene/style compatibility set.
- Fixed-Huffman distance-1 compression is intentionally narrower than a general-purpose encoder
  and may produce larger files than adaptive compression.
- The complete canonical byte stream is accumulated for the bounded native base64 boundary after
  raster surfaces have been released; this remains subject to the aggregate 1-GiB release budget
  and 64-MiB file ceiling.
- Changing a seemingly internal raster, filter, block, or chunking rule is an export compatibility
  change.

### Neutral or follow-up

- The Milestone 1 dependency-free PNG helper remains evidence tooling, not a second production
  backend.
- Labels in a later milestone require a separately reviewed deterministic embedded-font or
  vector-text policy.
- PDF, animation, print-shop color management, arbitrary dimensions, GPU/WebGL acceleration, and
  native/Rust rasterization remain out of scope.

## Compatibility and migration

- **Accepted geography, appearance, and persistence:** unchanged. PNG remains an external export
  and visual-evidence class, not authoritative document state.
- **Scene composition, projection, style, and generator versions:** unchanged.
- **Export compatibility:** `atlas-png-v1` version 1 is new. Any change to dimensions, raster
  samples, quantization, banding, chunks, filtering, compression, IDAT slicing, metadata, or
  background behavior requires the smallest truthful profile version and separate PNG review.
- **Fixtures:** all six registered Milestone 2 rows replace their reviewed 1600 by 800 visual PNG
  through one targeted append-only review each. Canonical semantic, render-scene, SVG, and
  authoritative package evidence remain unchanged. The 8192 by 4096 outputs remain disposable
  benchmark/review artifacts rather than checked-in gallery files.
- **Milestone 0/1:** generic SVG and test-only PNG evidence bytes remain unchanged.

## Validation

Focused tests cover the three dimensions, scene/style/font rejection, quantization and four sample
positions, even-odd fills, capsule strokes, opaque painter order, halo crops, band boundaries,
live-band/row-buffer limits, filters, exact zlib/DEFLATE vectors, chunk order/CRC/Adler-32, 1-MiB
`IDAT` partitions, deterministic repeat bytes, cancellation, progress, output limits, and
accepted-state immutability. Native tests cover request/receipt validation, exact readback,
replacement, stale temporary artifacts, symbolic-link/special destinations, and failure before
replacement.

Every registered Milestone 2 row regenerates its reviewed 1600 by 800 PNG through the production
path. Disposable 8192 by 4096 repeats are byte-compared, dimension- and size-checked, and visually
sampled at seams, poles, fine ink, and raster-band boundaries. `pnpm test:png-export` is the named
deterministic/resource evidence gate; it is not the formal reference-hardware benchmark.

The automated PNG and selected boundary-row tolerance is zero: canonical bytes and reconstructed
RGB values must match exactly. Human crop review likewise accepts no visible seam, clipped ink,
repeated texture, or decoration discontinuity at native pixels or normal whole-atlas scale.

The base Apple M1/8-GB five-fresh-process proof remains explicitly outstanding to issue #68. For
each gated atlas fixture, it must still establish that all five 8192 by 4096 runs finish within 15
seconds and 1 GiB peak additional aggregate process-tree memory. Export cancellation must meet its
500 ms acknowledgement limit under the same five-run maximum rule, with the required five early,
middle, and late cancellations. Measurements on a newer development machine do not substitute for
that normative environment and sampling protocol.

## Revisit conditions

- Representative output cannot remain below the 64-MiB ceiling with the fixed encoder.
- Formal reference-hardware measurements miss the existing time, memory, or cancellation limit
  after bounded remedies are attempted and documented.
- Fine-ink or band-boundary review reveals an artifact that the fixed samples or halo cannot
  represent safely.
- A later scene version, selectable projection/style, rendered text, or non-2:1 export needs a new
  compatibility profile.
- A measured raster/encoder bottleneck justifies reviewing a dependency or isolated native/WASM
  implementation.
