import { type EntityId, type Landmass, parseStableId } from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import {
  ATLAS_DISPLAY_HEIGHT_TICKS,
  ATLAS_DISPLAY_WIDTH_TICKS,
  type AtlasDisplayPoint,
  type AtlasProjectedCoastlinePath,
  type AtlasProjectedPathId,
} from './atlas-display-projection.js';
import { createAtlasLandFillSubpaths } from './atlas-scene-fill.js';

describe('atlas scene land-fill geometry', () => {
  it('uses accepted membership to select the spherical complement when needed', () => {
    const result = createAtlasLandFillSubpaths(
      landmassAt(100, 100),
      [
        path(true, [
          displayPoint(1_000, 400),
          displayPoint(1_200, 400),
          displayPoint(1_100, 600),
          displayPoint(1_000, 400),
        ]),
      ],
      2_048,
      1_024,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.points).toEqual([
      { xPx: 0, yPx: 0 },
      { xPx: 2_048, yPx: 0 },
      { xPx: 2_048, yPx: 1_024 },
      { xPx: 0, yPx: 1_024 },
    ]);
  });

  it('closes an eastward polar path along the north display boundary', () => {
    const result = createAtlasLandFillSubpaths(
      landmassAt(1_024, 100),
      [
        path(false, [
          displayPoint(0, 400),
          displayPoint(ATLAS_DISPLAY_WIDTH_TICKS / 2, 500),
          displayPoint(ATLAS_DISPLAY_WIDTH_TICKS, 400),
        ]),
      ],
      2_048,
      1_024,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.points.slice(-2)).toEqual([
      { xPx: 2_048, yPx: 0 },
      { xPx: 0, yPx: 0 },
    ]);
  });
});

function landmassAt(x: number, y: number): Landmass {
  const latitudeIndex = 1_024 - y;
  const sampleIndex = 1 + (latitudeIndex - 1) * 2_048 + x;
  return {
    entityId: stableEntityId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    sourceClassificationAspectId: value(
      parseStableId('aspect', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
    ),
    componentId: value(parseStableId('surface-component', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')),
    membership: {
      classificationVersion: 1,
      fingerprint: 'd'.repeat(64),
      sampleCount: 1,
      sphericalAreaWeight: 1,
      sampleRanges: [{ startIndex: sampleIndex, endIndexExclusive: sampleIndex + 1 }],
    },
    kind: 'island',
    adjacentWaterBodyIds: [stableEntityId('dddddddd-dddd-4ddd-8ddd-dddddddddddd')],
  };
}

function path(
  isClosed: boolean,
  points: readonly AtlasDisplayPoint[],
): AtlasProjectedCoastlinePath {
  const landmassId = stableEntityId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  return {
    pathId: 'test-path/0000' as AtlasProjectedPathId,
    sourceRingId: value(parseStableId('coastline-ring', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')),
    sourceBoundaryFingerprint: 'f'.repeat(64),
    sourceEntityId: landmassId,
    landmassId,
    waterBodyIds: [stableEntityId('dddddddd-dddd-4ddd-8ddd-dddddddddddd')],
    sourcePathIndex: 0,
    isClosed,
    points,
  };
}

function displayPoint(xDisplayTicks: number, yPx: number): AtlasDisplayPoint {
  return {
    xDisplayTicks,
    yDisplayTicks: (yPx * ATLAS_DISPLAY_HEIGHT_TICKS) / 1_024,
  } as AtlasDisplayPoint;
}

function stableEntityId(input: string): EntityId {
  return value(parseStableId('entity', input));
}

function value<Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false },
): Value {
  if (!result.ok) throw new Error('Expected valid test identity.');
  return result.value;
}
