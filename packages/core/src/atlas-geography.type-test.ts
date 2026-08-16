import type {
  AtlasGeographyRecords,
  CanonicalWorldCoastlineRing,
  MacroElevationField,
  PlanetPoint,
  RenderPoint,
} from './index.js';

declare const records: AtlasGeographyRecords;
declare const ring: CanonicalWorldCoastlineRing;
declare const field: MacroElevationField;
declare const point: PlanetPoint;
declare const renderPoint: RenderPoint;

// @ts-expect-error Accepted geography cannot be mutated through a public contract.
records.landmasses[0] = records.landmasses[1];
// @ts-expect-error Canonical coastline uses planet-native points, never render pixels.
ring.points[0] = renderPoint;
// @ts-expect-error Quantized accepted field values are immutable.
field.values[0] = 0;
// @ts-expect-error Raw planet tick records cannot bypass canonical coordinate parsing.
ring.points[0] = { longitudeTicks: point.longitudeTicks, latitudeTicks: point.latitudeTicks };

void [records, ring, field, point, renderPoint];
