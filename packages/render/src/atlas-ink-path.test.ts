import {
  type AtlasCoastlineInkDecision,
  type EntityId,
  parseStableId,
  type RenderPoint,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import {
  ATLAS_DISPLAY_HEIGHT_TICKS,
  ATLAS_DISPLAY_WIDTH_TICKS,
  type AtlasDisplayPoint,
  type AtlasProjectedCoastlinePath,
  type AtlasProjectedPathId,
} from './atlas-display-projection.js';
import { deriveAtlasInkStrokeSegments, hasAtlasPathSelfIntersection } from './atlas-ink-path.js';

describe('atlas ink path derivation', () => {
  it('keeps seam endpoints fixed while applying bounded wobble and pressure variation once', () => {
    const path = projectedPath();
    const first = deriveAtlasInkStrokeSegments(path, decision(), tokens, 2_048, 1_024);
    const second = deriveAtlasInkStrokeSegments(path, decision(), tokens, 2_048, 1_024);
    const points = joinedPoints(first.flatMap(({ points: segmentPoints }) => segmentPoints));

    expect(first).toEqual(second);
    expect(points[0]).toEqual({ xPx: 0, yPx: 512 });
    expect(points.at(-1)).toEqual({ xPx: 2_048, yPx: 512 });
    expect(points.every(({ yPx }) => Math.abs(yPx - 512) <= tokens.maximumWobblePx)).toBe(true);
    expect(new Set(first.map(({ strokeWidthPx }) => strokeWidthPx)).size).toBeGreaterThan(2);
    expect(hasAtlasPathSelfIntersection(points, false)).toBe(false);
  });
});

const tokens = {
  primaryWidthPx: 1.55,
  pressureVariationPx: 0.38,
  maximumWobblePx: 0.72,
  primaryWavelengthPx: 38,
  secondaryWavelengthPx: 71,
  pressureWavelengthPx: 54,
  strokeSegmentLengthPx: 18,
} as const;

function projectedPath(): AtlasProjectedCoastlinePath {
  const landmassId = stableEntityId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  return {
    pathId: 'test-path/0000' as AtlasProjectedPathId,
    sourceRingId: stableRingId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
    sourceBoundaryFingerprint: 'c'.repeat(64),
    sourceEntityId: landmassId,
    landmassId,
    waterBodyIds: [stableEntityId('dddddddd-dddd-4ddd-8ddd-dddddddddddd')],
    sourcePathIndex: 0,
    isClosed: false,
    points: Object.freeze(
      Array.from({ length: 129 }, (_, index) =>
        displayPoint((index * ATLAS_DISPLAY_WIDTH_TICKS) / 128, ATLAS_DISPLAY_HEIGHT_TICKS / 2),
      ),
    ),
  };
}

function decision(): AtlasCoastlineInkDecision {
  return {
    sourceRingId: stableRingId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
    sourceBoundaryFingerprint: 'c'.repeat(64),
    wobblePhasePermille: 137,
    wobbleStrengthPermille: 1_000,
    secondaryPhasePermille: 619,
    pressurePhasePermille: 277,
    pressureStrengthPermille: 1_000,
  };
}

function displayPoint(xDisplayTicks: number, yDisplayTicks: number): AtlasDisplayPoint {
  return { xDisplayTicks, yDisplayTicks } as AtlasDisplayPoint;
}

function joinedPoints(points: readonly RenderPoint[]): readonly RenderPoint[] {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    return previous?.xPx !== point.xPx || previous.yPx !== point.yPx;
  });
}

function stableEntityId(input: string): EntityId {
  const result = parseStableId('entity', input);
  if (!result.ok) throw new Error(result.diagnostic.message);
  return result.value;
}

function stableRingId(input: string) {
  const result = parseStableId('coastline-ring', input);
  if (!result.ok) throw new Error(result.diagnostic.message);
  return result.value;
}
