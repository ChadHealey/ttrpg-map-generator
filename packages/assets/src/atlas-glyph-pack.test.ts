import {
  ATLAS_GLYPH_PACK_SUPPORTED_CODE_POINTS,
  createAtlasGlyphMetricSnapshot,
  validateAtlasGlyphPack,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import { ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_PACK } from './atlas-glyph-pack.js';

describe('Alegreya medium ASCII glyph pack', () => {
  it('matches the ADR-0025 identity, exact alphabet, and metric-only contract', () => {
    const validation = validateAtlasGlyphPack(ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_PACK);
    expect(validation.ok, JSON.stringify(validation)).toBe(true);
    if (!validation.ok) throw new Error(validation.diagnostics[0]?.message);
    const snapshot = createAtlasGlyphMetricSnapshot(validation.value);
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) throw new Error(snapshot.diagnostics[0]?.message);
    expect(snapshot.value.packSha256).toBe(
      ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_PACK.canonicalPackSha256,
    );
    expect(snapshot.value.glyphs.map(({ codePoint }) => codePoint)).toEqual(
      ATLAS_GLYPH_PACK_SUPPORTED_CODE_POINTS.filter((codePoint) => codePoint !== 0x20),
    );
    for (const label of ['A', 'Ava Vale', 'The Verdant Reach', 'Eldermere II']) {
      expect(
        Array.from(label).every(
          (character) =>
            character === ' ' ||
            snapshot.value.glyphs.some(({ codePoint }) => codePoint === character.codePointAt(0)),
        ),
      ).toBe(true);
    }
  });

  it('rejects digest drift and noncanonical contour winding before exposing metrics', () => {
    const digestMismatch = JSON.parse(JSON.stringify(ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_PACK)) as {
      canonicalPackSha256: string;
    };
    digestMismatch.canonicalPackSha256 = '0'.repeat(64);
    expect(validateAtlasGlyphPack(digestMismatch)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'atlas-glyph-pack.digest.mismatch' }],
    });

    const reversedContour = JSON.parse(JSON.stringify(ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_PACK)) as {
      glyphs: { contours: { points: unknown[] }[] }[];
    };
    reversedContour.glyphs[0]?.contours[0]?.points.reverse();
    expect(validateAtlasGlyphPack(reversedContour)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'atlas-glyph-pack.contours.invalid' }],
    });
  });
});
