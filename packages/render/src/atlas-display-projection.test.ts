import {
  ATLAS_COASTLINE_EXTRACTION_ALGORITHM_VERSION,
  ATLAS_COASTLINE_GEOMETRY_BEHAVIOR_VERSION,
  ATLAS_COASTLINE_REPAIR_POLICY,
  ATLAS_COASTLINE_SIMPLIFICATION_POLICY_VERSION,
  ATLAS_COASTLINE_SIMPLIFICATION_TOLERANCE_TICKS,
  ATLAS_COASTLINE_TOPOLOGY_VALIDATION_VERSION,
  ATLAS_COASTLINE_WINDING,
  type CanonicalWorldCoastline,
  type CanonicalWorldCoastlineRing,
  type CoastlineRingId,
  type EntityId,
  parsePlanetPoint,
  parseStableId,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import fixtureSource from '../../../fixtures/adversarial-geometry/atlas-equirectangular-v1.json';
import {
  ATLAS_DISPLAY_HEIGHT_TICKS,
  ATLAS_DISPLAY_PROJECTION_METADATA,
  ATLAS_DISPLAY_WIDTH_TICKS,
  ATLAS_PROJECTION_DIAGNOSTIC_CODES,
  projectAtlasCanonicalCoastline,
} from './atlas-display-projection.js';

describe('atlas equirectangular display projection', () => {
  it.each(fixtureSource.cases)(
    'projects adversarial case $caseId without a world-spanning edge',
    (fixture) => {
      const source = coastline([ringFromFixture(fixture, 0)]);
      const sourceBefore = JSON.stringify(source);

      const first = projectAtlasCanonicalCoastline(source);
      const second = projectAtlasCanonicalCoastline(source);

      expect(first).toEqual(second);
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      expect(first.value.projection).toEqual(ATLAS_DISPLAY_PROJECTION_METADATA);
      expect(first.value.authority).toBe('disposable');
      expect(first.value.paths).toHaveLength(fixture.expectedPathCount);
      expect(JSON.stringify(source)).toBe(sourceBefore);

      for (const [pathIndex, path] of first.value.paths.entries()) {
        expect(path.pathId).toContain(`/path-${String(pathIndex).padStart(4, '0')}`);
        expect(path.sourceRingId).toBe(source.rings[0]?.ringId);
        expect(path.sourceBoundaryFingerprint).toBe(source.rings[0]?.sourceBoundaryFingerprint);
        expect(path.sourceEntityId).toBe(source.rings[0]?.landmassId);
        expect(path.waterBodyIds).toEqual(source.rings[0]?.waterBodyIds);
        expect(path.waterBodyIds).not.toBe(source.rings[0]?.waterBodyIds);
        expect(path.points.length).toBeGreaterThanOrEqual(2);
        for (const point of path.points) {
          expect(point.xDisplayTicks).toBeGreaterThanOrEqual(0);
          expect(point.xDisplayTicks).toBeLessThanOrEqual(ATLAS_DISPLAY_WIDTH_TICKS);
          expect(point.yDisplayTicks).toBeGreaterThanOrEqual(0);
          expect(point.yDisplayTicks).toBeLessThanOrEqual(ATLAS_DISPLAY_HEIGHT_TICKS);
        }
        for (let index = 1; index < path.points.length; index += 1) {
          const point = required(path.points[index], 'Expected projected path point.');
          const prior = required(path.points[index - 1], 'Expected prior projected path point.');
          expect(Math.abs(point.xDisplayTicks - prior.xDisplayTicks)).toBeLessThanOrEqual(
            ATLAS_DISPLAY_WIDTH_TICKS / 2,
          );
        }
        if (!path.isClosed) {
          const firstPoint = required(path.points[0], 'Expected open path start.');
          const lastPoint = required(path.points.at(-1), 'Expected open path end.');
          expect([0, ATLAS_DISPLAY_WIDTH_TICKS]).toContain(firstPoint.xDisplayTicks);
          expect([0, ATLAS_DISPLAY_WIDTH_TICKS]).toContain(lastPoint.xDisplayTicks);
        }
      }
    },
  );

  it('uses source identity rather than input ring order for stable path ordering', () => {
    const rings = fixtureSource.cases.slice(0, 3).map(ringFromFixture);
    const canonical = projectAtlasCanonicalCoastline(coastline(rings));
    const reordered = projectAtlasCanonicalCoastline(coastline([...rings].reverse()));

    expect(canonical).toEqual(reordered);
    expect(canonical.ok).toBe(true);
    if (!canonical.ok) return;
    expect(canonical.value.paths.map(({ pathId }) => pathId)).toEqual(
      [...canonical.value.paths.map(({ pathId }) => pathId)].sort(compareText),
    );
  });

  it('rejects unsupported versions and invalid rings with stable actionable diagnostics', () => {
    const valid = coastline([
      ringFromFixture(required(fixtureSource.cases[0], 'Expected first fixture case.'), 0),
    ]);
    const unsupported = projectAtlasCanonicalCoastline({
      ...valid,
      geometryBehaviorVersion: 2,
    } as unknown as CanonicalWorldCoastline);
    expect(unsupported).toEqual({
      ok: false,
      diagnostics: [
        {
          code: ATLAS_PROJECTION_DIAGNOSTIC_CODES.unsupportedGeometry,
          message:
            'Atlas projection supports only accepted canonical coastline geometry policy version 1.',
        },
      ],
    });

    const sourceRing = required(valid.rings[0], 'Expected valid source ring.');
    const firstPoint = required(sourceRing.points[0], 'Expected first source point.');
    const secondPoint = required(sourceRing.points[1], 'Expected second source point.');
    const invalid = projectAtlasCanonicalCoastline(
      coastline([
        {
          ...sourceRing,
          points: [firstPoint, firstPoint, secondPoint],
        },
      ]),
    );
    expect(invalid.ok).toBe(false);
    if (invalid.ok) return;
    expect(invalid.diagnostics.map(({ code }) => code)).toEqual([
      ATLAS_PROJECTION_DIAGNOSTIC_CODES.invalidSourceRing,
    ]);
    expect(invalid.diagnostics[0]?.message).toContain('unique canonical planet-native points');
  });
});

export function adversarialProjectionCoastline(): CanonicalWorldCoastline {
  return coastline(fixtureSource.cases.map(ringFromFixture));
}

function ringFromFixture(
  fixture: (typeof fixtureSource.cases)[number],
  index: number,
): CanonicalWorldCoastlineRing {
  return {
    ringId: stableId('coastline-ring', uuidForIndex(index + 1)),
    sourceBoundaryFingerprint: (index + 1).toString(16).repeat(64).slice(0, 64),
    landmassId: stableId('entity', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    waterBodyIds: [stableId('entity', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')],
    points: fixture.points.map(([longitudeTicks, latitudeTicks]) => {
      const result = parsePlanetPoint({ longitudeTicks, latitudeTicks });
      if (!result.ok) throw new Error(result.diagnostic.message);
      return result.value;
    }),
  };
}

function coastline(rings: readonly CanonicalWorldCoastlineRing[]): CanonicalWorldCoastline {
  return {
    geometryBehaviorVersion: ATLAS_COASTLINE_GEOMETRY_BEHAVIOR_VERSION,
    extractionAlgorithmVersion: ATLAS_COASTLINE_EXTRACTION_ALGORITHM_VERSION,
    simplificationPolicyVersion: ATLAS_COASTLINE_SIMPLIFICATION_POLICY_VERSION,
    simplificationToleranceTicks: ATLAS_COASTLINE_SIMPLIFICATION_TOLERANCE_TICKS,
    topologyValidationVersion: ATLAS_COASTLINE_TOPOLOGY_VALIDATION_VERSION,
    winding: ATLAS_COASTLINE_WINDING,
    repairPolicy: ATLAS_COASTLINE_REPAIR_POLICY,
    rings,
  };
}

function stableId(kind: 'coastline-ring', input: string): CoastlineRingId;
function stableId(kind: 'entity', input: string): EntityId;
function stableId(kind: 'coastline-ring' | 'entity', input: string): CoastlineRingId | EntityId {
  if (kind === 'coastline-ring') {
    const result = parseStableId(kind, input);
    if (!result.ok) throw new Error(result.diagnostic.message);
    return result.value;
  }
  const result = parseStableId(kind, input);
  if (!result.ok) throw new Error(result.diagnostic.message);
  return result.value;
}

function uuidForIndex(index: number): string {
  return `${String(index).padStart(8, '0')}-1111-4111-8111-111111111111`;
}

function compareText(left: string, right: string): -1 | 0 | 1 {
  return left < right ? -1 : left > right ? 1 : 0;
}

function required<Value>(value: Value | undefined, message: string): Value {
  if (value === undefined) throw new Error(message);
  return value;
}
