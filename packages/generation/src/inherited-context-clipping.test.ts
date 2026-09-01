import {
  createPlanetPoint,
  createRegionalFootprintTransform,
  parseRegionalExtent,
  parseRegionalRectangleFootprint,
  parseStableId,
  type PlanetPoint,
  type RegionalExtent,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import {
  clipInheritedContextGeometry,
  type InheritedContextPathSource,
} from './inherited-context-clipping.js';

const MAP_ID = id('map', '00000000-0000-4000-8000-000000000101');
const OWNER_ID = id('entity', '00000000-0000-4000-8000-000000000201');
const RIVER_ID = id('entity', '00000000-0000-4000-8000-000000000202');
const ASPECT_ID = id('aspect', '00000000-0000-4000-8000-000000000301');
const ROOT_SURFACE_ID = id('root-surface', '00000000-0000-4000-8000-000000000401');

describe('inherited-context geometry clipping', () => {
  it('clips accepted geometry to the collar and derives stable ordered footprint portals', () => {
    const footprint = rectangle(required(createPlanetPoint(0, 0)));
    const transform = createRegionalFootprintTransform(footprint);
    const source = riverSource([inverse(transform, -3_000, 0), inverse(transform, 3_000, 0)]);

    const first = clipInheritedContextGeometry([source], footprint, collar());
    const repeated = clipInheritedContextGeometry([source], footprint, collar());
    expect(first).toStrictEqual(repeated);
    if (!first.ok) throw new Error(first.message);

    expect(first.anchors).toHaveLength(1);
    expect(first.anchors[0]?.paths).toHaveLength(1);
    expect(first.portals.map(({ localPoint }) => localPoint)).toStrictEqual([
      { xMillimeters: 1_000, yMillimeters: 0 },
      { xMillimeters: -1_000, yMillimeters: 0 },
    ]);
    expect(new Set(first.portals.map(({ portalId }) => portalId)).size).toBe(2);
    expect(first.intersectingAnchorIds.has(RIVER_ID)).toBe(true);

    for (const path of first.anchors[0]?.paths ?? []) {
      for (const rootPoint of path) {
        const local = transform.forward(rootPoint);
        expect(local.ok).toBe(true);
        if (local.ok) {
          expect(Math.abs(local.value.xMillimeters)).toBeLessThanOrEqual(2_001);
          expect(Math.abs(local.value.yMillimeters)).toBeLessThanOrEqual(2_001);
        }
      }
    }
  });

  it('does not invent a portal for a non-crossing or boundary-collinear feature', () => {
    const footprint = rectangle(required(createPlanetPoint(0, 0)));
    const transform = createRegionalFootprintTransform(footprint);
    const inside = riverSource([inverse(transform, -500, 0), inverse(transform, 500, 0)]);
    const boundary = riverSource([
      inverse(transform, -1_000, -500),
      inverse(transform, -1_000, 500),
    ]);

    for (const source of [inside, boundary]) {
      const clipped = clipInheritedContextGeometry([source], footprint, collar());
      if (!clipped.ok) throw new Error(clipped.message);
      expect(clipped.portals).toStrictEqual([]);
    }
  });

  it('ignores accepted geometry on the remote hemisphere', () => {
    const footprint = rectangle(required(createPlanetPoint(0, 0)));
    const remote = riverSource([
      required(createPlanetPoint(Math.PI - 0.1, 0)),
      required(createPlanetPoint(Math.PI - 0.05, 0.01)),
    ]);
    const clipped = clipInheritedContextGeometry([remote], footprint, collar());

    expect(clipped).toMatchObject({ ok: true, anchors: [], portals: [] });
  });

  it('fails closed when a projection-domain segment may reach the collar', () => {
    const footprint = rectangle(required(createPlanetPoint(0, 0)));
    const transform = createRegionalFootprintTransform(footprint);
    const crossing = riverSource([inverse(transform, 0, 0), required(createPlanetPoint(2, 0))]);

    const clipped = clipInheritedContextGeometry([crossing], footprint, collar());

    expect(clipped.ok).toBe(false);
    if (!clipped.ok) expect(clipped.message).toContain('may reach the collar');
  });

  it('shares portal identity across adjacent footprints', () => {
    const origin = required(createPlanetPoint(0, 0));
    const left = rectangle(origin, {
      minXMillimeters: -1_000,
      maxXMillimeters: 0,
      minYMillimeters: -1_000,
      maxYMillimeters: 1_000,
    });
    const right = rectangle(origin, {
      minXMillimeters: 0,
      maxXMillimeters: 1_000,
      minYMillimeters: -1_000,
      maxYMillimeters: 1_000,
    });
    const transform = createRegionalFootprintTransform(left);
    const source = riverSource([inverse(transform, -3_000, 0), inverse(transform, 3_000, 0)]);
    const leftResult = clipInheritedContextGeometry(
      [source],
      left,
      regionalExtent(-2_000, 1_000, -2_000, 2_000),
    );
    const rightResult = clipInheritedContextGeometry(
      [source],
      right,
      regionalExtent(-1_000, 2_000, -2_000, 2_000),
    );
    if (!leftResult.ok || !rightResult.ok) throw new Error('Adjacent clipping failed.');
    const leftShared = leftResult.portals.find(({ localPoint }) => localPoint.xMillimeters === 0);
    const rightShared = rightResult.portals.find(({ localPoint }) => localPoint.xMillimeters === 0);

    expect(leftShared?.rootPoint).toStrictEqual(rightShared?.rootPoint);
    expect(leftShared?.portalId).toBe(rightShared?.portalId);
  });

  it.each([
    ['horizontal seam', required(createPlanetPoint(Math.PI - 0.001, 0))],
    ['north pole', required(createPlanetPoint(0, Math.PI / 2))],
  ])('keeps %s clipping inside the approved local chart', (_label, origin) => {
    const footprint = rectangle(origin);
    const transform = createRegionalFootprintTransform(footprint);
    const clipped = clipInheritedContextGeometry(
      [riverSource([inverse(transform, -3_000, 0), inverse(transform, 3_000, 0)])],
      footprint,
      collar(),
    );

    expect(clipped.ok).toBe(true);
    if (clipped.ok) expect(clipped.portals).toHaveLength(2);
  });
});

function riverSource(points: InheritedContextPathSource['paths'][number]['points']) {
  return {
    sourceMapId: MAP_ID,
    sourceEntityId: OWNER_ID,
    sourceAspectId: ASPECT_ID,
    sourceAnchorId: RIVER_ID,
    anchorKind: 'major-river',
    portalKind: 'river',
    paths: [{ points, closed: false }],
  } satisfies InheritedContextPathSource;
}

function rectangle(
  origin: PlanetPoint,
  extent: Readonly<{
    minXMillimeters: number;
    maxXMillimeters: number;
    minYMillimeters: number;
    maxYMillimeters: number;
  }> = {
    minXMillimeters: -1_000,
    maxXMillimeters: 1_000,
    minYMillimeters: -1_000,
    maxYMillimeters: 1_000,
  },
) {
  return required(
    parseRegionalRectangleFootprint({
      shapeVersion: 'regional-rectangle-v1',
      rootSurfaceId: ROOT_SURFACE_ID,
      worldRadius: { radiusMillimeters: 1_000_000_000 },
      origin,
      extent,
      transformId: 'planet-regional-azimuthal-equidistant',
      transformVersion: 1,
    }),
  );
}

function collar(): RegionalExtent {
  return regionalExtent(-2_000, 2_000, -2_000, 2_000);
}

function regionalExtent(
  minXMillimeters: number,
  maxXMillimeters: number,
  minYMillimeters: number,
  maxYMillimeters: number,
): RegionalExtent {
  return required(
    parseRegionalExtent({
      minXMillimeters,
      maxXMillimeters,
      minYMillimeters,
      maxYMillimeters,
    }),
  );
}

function inverse(
  transform: ReturnType<typeof createRegionalFootprintTransform>,
  xMillimeters: number,
  yMillimeters: number,
) {
  return required(transform.inverse({ xMillimeters, yMillimeters } as never));
}

function id<Kind extends Parameters<typeof parseStableId>[0]>(kind: Kind, value: string) {
  return required(parseStableId(kind, value));
}

function required<Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false },
): Value {
  if (!result.ok) throw new Error('Invalid test setup value.');
  return result.value;
}
