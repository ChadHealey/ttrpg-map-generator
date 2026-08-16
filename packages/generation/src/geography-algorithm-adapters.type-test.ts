import type { PlanetPoint } from '@ttrpg-map/core';

import type {
  ProposedPlanetRing,
  QuantizedPlanetFieldAdapter,
  QuantizedSphericalField,
} from './geography-algorithm-adapters.js';

declare const adapter: QuantizedPlanetFieldAdapter;
declare const field: QuantizedSphericalField;
declare const point: PlanetPoint;
declare const ring: ProposedPlanetRing;

adapter.sample(point);
field.valueAt(0, 0);

// @ts-expect-error A raw library coordinate cannot enter the planet-native field adapter.
adapter.sample({ x: 0, y: 0 });
// @ts-expect-error Proposed adapter geometry remains readonly.
ring.points[0] = point;
// @ts-expect-error A foreign mutable tuple is not a project-owned proposed planet ring.
const foreignRing: ProposedPlanetRing = { points: [[0, 0]] };

void foreignRing;
