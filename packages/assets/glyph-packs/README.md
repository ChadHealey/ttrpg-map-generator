# Alegreya medium ASCII glyph pack v1

This directory contains the development-only source and legal/provenance material for
`atlas-glyphs.alegreya-medium-ascii-v1`. Runtime code imports only the generated
`packages/assets/src/atlas-glyph-pack.ts` module and never reads or parses the TTF.

- Source: Google Fonts Alegreya 2.009, `Alegreya[wght].ttf`, commit
  `40478177239cbf3bac07908ef0738afee0f72be7`.
- Source SHA-256: `ba5564634b93a8f8ba57b48cd4f1ae7417d2b4656fbac779028679b00de3cf12`.
- Source byte length: `425288`.
- Source copyright: `Copyright 2011 The Alegreya Project Authors`.
- License: SIL Open Font License 1.1; the complete notice is retained in [OFL.txt](OFL.txt).
- Converter: FontTools 4.60.2 (MIT), pinned in `tools/glyph-pack/requirements.txt`.

The converter instantiates `wght=500`, maps metrics to 4096 glyph units/em, flattens and
canonicalizes outlines, and produces the checked-in TypeScript pack. Run
`python3 -m pip install --require-hashes -r tools/glyph-pack/requirements.txt` in a disposable development
environment, then run `python3 tools/glyph-pack/convert.py`. `pnpm glyph-pack:check` fails
if regeneration differs from the committed pack.

## FONTLOG

2026-09-01: Created this project-owned derived outline-and-metrics pack from the pinned
Alegreya source for deterministic atlas labels. It is not an installable font and uses the
identifier `atlas-glyphs.alegreya-medium-ascii-v1`. The pack retains only SPACE and ASCII
Latin A–Z/a–z at upright `wght=500`; no shaping, ligatures, hinting, or other axes are used.
