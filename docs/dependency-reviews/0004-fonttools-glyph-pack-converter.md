# 0004 — FontTools for the atlas glyph-pack converter

- Date reviewed: 2026-09-01
- Scope: issue #155 development-only conversion of ADR-0025's pinned Alegreya source
- Resolution: use FontTools 4.60.2 only in `tools/glyph-pack/convert.py`; add no production
  dependency or runtime font parser.

## Capability and containment

The selected pack needs fixed-axis variable-font instantiation, cmap/metric extraction, GPOS
pair-kerning extraction, and glyph-outline traversal. FontTools is a Python library for font
manipulation and has no required dependencies beyond the Python standard library. The converter
uses it only to generate the checked-in pack from the vendored, SHA-256-verified source TTF.
`core`, `assets` runtime modules, renderers, and desktop code never import or execute it.

The exact dependency is `fonttools==4.60.2`, MIT licensed, for Python 3.10+ in CI. Its source
distribution SHA-256 is pinned in `tools/glyph-pack/requirements.txt`; no Node package, package
manifest, lockfile, native library, or production bundle changes. The source is untrusted until its ADR-0025 byte length and
SHA-256 pass. The converter emits a project-owned JSON-compatible TypeScript data module, and
`core` independently validates that module and its canonical digest before exposing a metric
snapshot.

## Alternatives and decision

- Ambient browser/Canvas text or an embedded webfont was rejected by ADR-0025 because metrics,
  shaping, hinting, and raster output would vary by host.
- A runtime OpenType parser was rejected because it adds output-sensitive production dependency
  and parsing surface where a checked-in ASCII pack is sufficient.
- A project-owned parser was rejected for this one development conversion because it would add a
  larger, less-reviewed font-format implementation with no runtime benefit.

FontTools' active MIT-licensed project, deterministic Python implementation, and its support for
TrueType variable instancing/GPOS make it the smallest contained converter. The pinned version
and source are rerun by the existing macOS/Linux CI matrix; a changed tool/version/source that
changes bytes requires a new dependency review and the smallest truthful asset/glyph version.
