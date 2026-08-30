import type {
  PlanetPoint,
  RegionalExtent,
  RegionalPoint,
  RootSurfaceId,
  WorldRadius,
} from './index.js';
import {
  createRegionalFootprintTransform,
  parseRegionalRectangleFootprint,
  type RegionalRectangleFootprint,
  validateRegionalRectangleFootprint,
} from './index.js';

declare const origin: PlanetPoint;
declare const extent: RegionalExtent;
declare const rootSurfaceId: RootSurfaceId;
declare const worldRadius: WorldRadius;
declare const regionalPoint: RegionalPoint;

const parsed = parseRegionalRectangleFootprint({
  shapeVersion: 'regional-rectangle-v1',
  rootSurfaceId,
  worldRadius,
  origin,
  extent,
  transformId: 'planet-regional-azimuthal-equidistant',
  transformVersion: 1,
});
if (parsed.ok) {
  createRegionalFootprintTransform(parsed.value);
  validateRegionalRectangleFootprint(parsed.value);
}

const rawFootprint: RegionalRectangleFootprint = {
  shapeVersion: 'regional-rectangle-v1',
  rootSurfaceId,
  // @ts-expect-error Raw radius records cannot satisfy the validated footprint boundary.
  worldRadius: { radiusMillimeters: 1_000_000 },
  origin,
  extent,
  transformId: 'planet-regional-azimuthal-equidistant',
  transformVersion: 1,
};

const invalidCrossSpace: RegionalRectangleFootprint = {
  shapeVersion: 'regional-rectangle-v1',
  rootSurfaceId,
  worldRadius,
  // @ts-expect-error A regional point cannot become a planet-native footprint origin.
  origin: regionalPoint,
  extent,
  transformId: 'planet-regional-azimuthal-equidistant',
  transformVersion: 1,
};

void [rawFootprint, invalidCrossSpace];
