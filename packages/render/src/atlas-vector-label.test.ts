import {
  type AspectId,
  deriveAtlasLabelPlacementAspectId,
  deriveWorldFeatureNameAspectId,
  type EntityId,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import {
  type AtlasVectorLabelLayer,
  expandAtlasVectorLabelLayer,
  validateAndExpandAtlasVectorLabelLayer,
} from './atlas-vector-label.js';

describe('atlas vector labels', () => {
  it('expands signed half ticks toward positive infinity and preserves canonical order', () => {
    const layer = Object.freeze({
      glyphAssetId: 'atlas-glyphs.alegreya-medium-ascii-v1',
      glyphAssetSchemaVersion: 1,
      glyphBehaviorVersion: 1,
      glyphPackSha256: 'pack',
      unitsPerEm: 4_096,
      definitions: Object.freeze([
        Object.freeze({
          glyphKey: 'A',
          codePoint: 65,
          contours: Object.freeze([
            Object.freeze({
              points: Object.freeze([
                Object.freeze({ x: -1, y: -1 }),
                Object.freeze({ x: 1, y: -1 }),
                Object.freeze({ x: 0, y: 1 }),
              ]),
            }),
          ]),
        }),
      ]),
      nodes: Object.freeze([
        Object.freeze({
          id: 'atlas/labels/one',
          sourceId: '00000000-0000-5000-8000-000000000001' as EntityId,
          sourceNameAspectId: '00000000-0000-5000-8000-000000000002' as AspectId,
          sourceNameVariantRevision: 0,
          placementId: '00000000-0000-5000-8000-000000000003' as AspectId,
          placementVariantRevision: 0,
          accessibilityText: 'A',
          priority: 1,
          fontSizeTicks: 2_048,
          bounds: Object.freeze({ minXTicks: 100, minYTicks: 200, maxXTicks: 101, maxYTicks: 201 }),
          fillColor: '#282a24',
          glyphs: Object.freeze([
            Object.freeze({ glyphKey: 'A', originXTicks: 100, originYTicks: 200 }),
          ]),
        }),
      ]),
    }) satisfies AtlasVectorLabelLayer;

    const expanded = expandAtlasVectorLabelLayer(layer);
    expect(expanded).toHaveLength(1);
    expect(expanded[0]?.subpaths[0]?.points).toEqual([
      { xPx: 100 / 1_024, yPx: 200 / 1_024 },
      { xPx: 101 / 1_024, yPx: 200 / 1_024 },
      { xPx: 100 / 1_024, yPx: 199 / 1_024 },
    ]);
    expect(expanded[0]).toMatchObject({ fillRule: 'evenodd', id: 'atlas/labels/one' });
  });

  it('authenticates released definitions and fails closed for malformed or oversized layers', () => {
    const forged = forgedLayer();
    expect(validateAndExpandAtlasVectorLabelLayer(forged)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'atlas-vector-label.glyph-pack.invalid' }],
    });
    expect(
      validateAndExpandAtlasVectorLabelLayer({
        ...forged,
        glyphAssetId: 'atlas-glyphs.forged-v9',
      }).ok,
    ).toBe(false);
    expect(
      validateAndExpandAtlasVectorLabelLayer({ ...forged, definitions: Object.freeze([]) }).ok,
    ).toBe(false);
    expect(
      validateAndExpandAtlasVectorLabelLayer({
        ...forged,
        nodes: Object.freeze(Array.from({ length: 257 }, () => forged.nodes[0])),
      }).ok,
    ).toBe(false);
  });
});

function forgedLayer(): AtlasVectorLabelLayer {
  const sourceId = '00000000-0000-4000-8000-000000000001' as EntityId;
  const placementId = deriveAtlasLabelPlacementAspectId(sourceId);
  return Object.freeze({
    glyphAssetId: 'atlas-glyphs.alegreya-medium-ascii-v1',
    glyphAssetSchemaVersion: 1,
    glyphBehaviorVersion: 1,
    glyphPackSha256: 'aafd639d37f5e6a9f4a2be8e773dd8a74bb96760486c800c28c827de624bb557',
    unitsPerEm: 4_096,
    definitions: Object.freeze([
      Object.freeze({
        glyphKey: 'A',
        codePoint: 65,
        contours: Object.freeze([
          Object.freeze({
            points: Object.freeze([
              Object.freeze({ x: -1, y: -1 }),
              Object.freeze({ x: 1, y: -1 }),
              Object.freeze({ x: 0, y: 1 }),
            ]),
          }),
        ]),
      }),
    ]),
    nodes: Object.freeze([
      Object.freeze({
        id: `atlas/labels/${placementId}`,
        sourceId,
        sourceNameAspectId: deriveWorldFeatureNameAspectId(sourceId),
        sourceNameVariantRevision: 0,
        placementId,
        placementVariantRevision: 0,
        accessibilityText: 'A',
        priority: 1,
        fontSizeTicks: 2_048,
        bounds: Object.freeze({ minXTicks: 100, minYTicks: 199, maxXTicks: 101, maxYTicks: 200 }),
        fillColor: '#282a24',
        glyphs: Object.freeze([
          Object.freeze({ glyphKey: 'A', originXTicks: 100, originYTicks: 200 }),
        ]),
      }),
    ]),
  });
}
