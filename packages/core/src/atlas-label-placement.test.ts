import { describe, expect, it } from 'vitest';

import {
  ATLAS_GLYPH_PACK_SUPPORTED_CODE_POINTS,
  type AtlasGlyphMetricSnapshot,
  type AtlasGlyphPack,
  atlasGlyphPackDigest,
  createAtlasGlyphMetricSnapshot,
} from './atlas-glyph-pack.js';
import {
  ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES,
  type AtlasLabelPlacementCandidate,
  resolveAtlasLabelPlacements,
  roundHalfTowardPositiveInfinity,
} from './atlas-label-placement.js';
import { createBehaviorVersion, createVariantRevision } from './compatibility.js';
import { deriveStableId, parseSemanticKey, parseStableId } from './identity.js';
import { parseWorldSeed } from './seed-input.js';
import type { WorldFeatureNameContent } from './world-feature-name-model.js';

const MAP_ID = required(parseStableId('map', '11111111-1111-4111-8111-111111111111'));
const WORLD_SEED = required(parseWorldSeed('42'));
const VERSION = required(createBehaviorVersion(1));
const ZERO = required(createVariantRevision(0));
const ONE = required(createVariantRevision(1));
const EXTENT = Object.freeze({
  minXTicks: 0,
  minYTicks: 0,
  maxXTicks: 2_048_000,
  maxYTicks: 1_024_000,
});

describe('atlas label placement', () => {
  it('uses metric-only integer layout and remains insertion-order independent', () => {
    const left = candidate(1, 'Ava Vale', 5, 100_000, 100_000);
    const right = candidate(2, 'Iron Peaks', 4, 400_000, 300_000);
    const first = resolved([left, right]);
    const second = resolved([right, left]);

    expect(first).toStrictEqual(second);
    expect(first.proposals).toHaveLength(2);
    const ava = first.proposals.find(({ output }) => output.displayText === 'Ava Vale')?.output;
    expect(ava?.glyphOrigins[0]).toMatchObject({
      glyphKey: 'glyph-65',
      xTicks: 100_000,
      yTicks: 100_000,
    });
    expect(ava?.glyphOrigins[1]?.xTicks).toBe(100_928);
    expect(ava?.glyphPackSha256).toBe(METRICS.packSha256);
    expect(ava?.sourceNameVariantRevision).toBe(ZERO);
  });

  it('accepts the first in-bounds explicit variant and never wraps a seam-adjacent candidate', () => {
    const placement = candidate(1, 'Ava Vale', 1, 1_000, 100_000, [
      variant('outside', -20_000, 0),
      variant('inside', 0, 0),
    ]);
    const result = resolved([placement]);
    expect(result.proposals[0]?.output.selectedVariantKey).toBe('inside');
    expect(result.proposals[0]?.output.baseline.xTicks).toBe(1_000);
    expect(result.proposals[0]?.output.glyphOrigins).toHaveLength(7);
  });

  it('resolves dense collisions by priority and returns a stable diagnostic for the loser', () => {
    const low = candidate(1, 'Ava Vale', 1, 100_000, 100_000);
    const high = candidate(2, 'Iron Peaks', 2, 100_000, 100_000);
    const result = resolved([low, high]);

    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]?.output.displayText).toBe('Iron Peaks');
    expect(result.diagnostics).toMatchObject([
      { code: ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.collision },
    ]);
  });

  it('keeps supplied variant order when a selected placement revision changes', () => {
    const peer = resolved([candidate(2, 'Iron Peaks', 1, 800_000, 100_000)]).proposals[0]?.output;
    if (peer === undefined) throw new Error('Expected fixed peer placement.');
    const current = candidate(1, 'Ava Vale', 1, 100_000, 100_000, [
      variant('left', 0, 0),
      variant('right', 400_000, 0),
    ]);
    const revised = { ...current, placementVariantRevision: ONE };
    const result = resolveAtlasLabelPlacements({
      mapId: MAP_ID,
      worldSeed: WORLD_SEED,
      sceneExtent: EXTENT,
      metrics: METRICS,
      candidates: [revised],
      acceptedPeerPlacements: [peer],
    });
    if (!result.ok) throw new Error('Expected selected placement resolution.');

    expect(result.proposals[0]?.output.selectedVariantKey).toBe('left');
    expect(peer).toStrictEqual(
      resolved([candidate(2, 'Iron Peaks', 1, 800_000, 100_000)]).proposals[0]?.output,
    );
  });

  it('rejects malformed metrics, text, pack mismatches, and unsupported glyphs before placement', () => {
    const malformedMetrics = { ...METRICS, unitsPerEm: 2_048 };
    const badMetrics = resolveAtlasLabelPlacements({
      mapId: MAP_ID,
      worldSeed: WORLD_SEED,
      sceneExtent: EXTENT,
      metrics: malformedMetrics,
      candidates: [candidate(1, 'Ava Vale', 1, 100_000, 100_000)],
    });
    expect(badMetrics).toMatchObject({
      ok: false,
      diagnostics: [{ code: ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.metricInvalid }],
    });
    const malformedGlyphs = { ...METRICS, glyphs: [null] };
    expect(
      resolveAtlasLabelPlacements({
        mapId: MAP_ID,
        worldSeed: WORLD_SEED,
        sceneExtent: EXTENT,
        metrics: malformedGlyphs as unknown as AtlasGlyphMetricSnapshot,
        candidates: [candidate(1, 'Ava Vale', 1, 100_000, 100_000)],
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.metricInvalid }],
    });

    const overlong = candidate(1, 'A'.repeat(65), 1, 100_000, 100_000);
    expect(attempt([overlong]).diagnostics).toMatchObject([
      { code: ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.textLength },
    ]);
    const unsupported = candidate(1, 'Á', 1, 100_000, 100_000);
    expect(attempt([unsupported]).diagnostics).toMatchObject([
      { code: ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.glyphUnsupported },
    ]);
    const mismatched = {
      ...candidate(1, 'Ava Vale', 1, 100_000, 100_000),
      glyphPackSha256: 'b'.repeat(64),
    };
    expect(attempt([mismatched]).diagnostics).toMatchObject([
      { code: ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.metricMismatch },
    ]);
  });

  it('rounds signed halves toward positive infinity without a floating-point intermediate', () => {
    expect(roundHalfTowardPositiveInfinity(1n, 2n)).toBe(1n);
    expect(roundHalfTowardPositiveInfinity(-1n, 2n)).toBe(0n);
    expect(roundHalfTowardPositiveInfinity(-3n, 2n)).toBe(-1n);
    expect(roundHalfTowardPositiveInfinity(-6n, 4n)).toBe(-1n);
  });
});

const METRICS = metricSnapshot();

function metricSnapshot(): AtlasGlyphMetricSnapshot {
  const glyphs = ATLAS_GLYPH_PACK_SUPPORTED_CODE_POINTS.filter(
    (codePoint) => codePoint !== 0x20,
  ).map((codePoint) =>
    Object.freeze({
      glyphKey: `glyph-${String(codePoint)}`,
      codePoint,
      advanceWidth: 4_096,
      leftSideBearing: 0,
      bounds: Object.freeze({ minX: 0, minY: -1_024, maxX: 3_072, maxY: 3_072 }),
      contours: Object.freeze([
        Object.freeze({
          points: Object.freeze([
            Object.freeze({ x: 0, y: 0 }),
            Object.freeze({ x: 0, y: 1 }),
            Object.freeze({ x: 1, y: 0 }),
          ]),
        }),
      ]),
    }),
  );
  const content = {
    assetId: 'atlas-glyphs.alegreya-medium-ascii-v1',
    assetSchemaVersion: 1,
    glyphBehaviorVersion: 1,
    unitsPerEm: 4_096,
    ascender: 3_072,
    descender: -1_024,
    lineGap: 0,
    tracking: 128,
    spaceAdvance: 1_024,
    source: Object.freeze({
      sourceUrl:
        'https://github.com/google/fonts/blob/40478177239cbf3bac07908ef0738afee0f72be7/ofl/alegreya/Alegreya%5Bwght%5D.ttf',
      sourceCommit: '40478177239cbf3bac07908ef0738afee0f72be7',
      sourceSha256: 'ba5564634b93a8f8ba57b48cd4f1ae7417d2b4656fbac779028679b00de3cf12',
      sourceByteLength: 425_288,
      licenseId: 'OFL-1.1' as const,
    }),
    glyphs: Object.freeze(glyphs),
    kerningPairs: Object.freeze([
      Object.freeze({ leftGlyphKey: 'glyph-65', rightGlyphKey: 'glyph-118', adjustment: -512 }),
    ]),
    contourCount: glyphs.length,
    pointCount: glyphs.length * 3,
  } satisfies Omit<AtlasGlyphPack, 'canonicalPackSha256'>;
  const pack = Object.freeze({
    ...content,
    canonicalPackSha256: atlasGlyphPackDigest(content as AtlasGlyphPack),
  });
  const result = createAtlasGlyphMetricSnapshot(pack);
  if (!result.ok) throw new Error('Expected valid synthetic glyph pack.');
  return result.value;
}

function candidate(
  index: number,
  displayName: string,
  priority: number,
  xTicks: number,
  yTicks: number,
  variants: readonly AtlasLabelPlacementCandidate['variants'][number][] = [
    variant('default', 0, 0),
  ],
): AtlasLabelPlacementCandidate {
  return Object.freeze({
    nameContent: nameContent(index, displayName),
    placementVariantRevision: ZERO,
    glyphPackSha256: METRICS.packSha256,
    priority,
    fontSizeTicks: 1_024,
    anchor: Object.freeze({ xTicks, yTicks }),
    variants: Object.freeze(variants),
  });
}

function variant(variantKey: string, xTicks: number, yTicks: number) {
  return Object.freeze({ variantKey, baselineOffset: Object.freeze({ xTicks, yTicks }) });
}

function nameContent(index: number, displayName: string): WorldFeatureNameContent {
  return Object.freeze({
    entityId: deriveStableId(
      'entity',
      MAP_ID,
      required(parseSemanticKey(`label-${String(index)}`)),
    ),
    nameKind: 'landmass',
    nameContentBehaviorVersion: VERSION,
    lexiconVersion: VERSION,
    variantRevision: ZERO,
    origin: 'generated',
    displayName,
    comparisonKey: displayName.toLowerCase(),
  });
}

function resolved(candidates: readonly AtlasLabelPlacementCandidate[]) {
  const result = attempt(candidates);
  if (!result.ok) throw new Error('Expected valid label-placement input.');
  return result;
}

function attempt(candidates: readonly AtlasLabelPlacementCandidate[]) {
  return resolveAtlasLabelPlacements({
    mapId: MAP_ID,
    worldSeed: WORLD_SEED,
    sceneExtent: EXTENT,
    metrics: METRICS,
    candidates,
  });
}

function required<Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false },
): Value {
  if (!result.ok) throw new Error('Expected valid test setup.');
  return result.value;
}
