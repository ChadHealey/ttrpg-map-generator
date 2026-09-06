/** Read-only production seam; the adapter metadata is a transport seam, not v3 provenance. */
import { type PlanetPoint, planetPointToAngles } from '@ttrpg-map/core';
import { quantizeAtlasFieldValue, type QuantizedPlanetFieldAdapter } from '@ttrpg-map/generation';
export function vector(point: PlanetPoint): readonly [number, number, number] {
  const { longitudeRad: lon, latitudeRad: lat } = planetPointToAngles(point);
  if (Math.abs(lat) === Math.PI / 2) return [0, 0, Math.sign(lat)];
  const c = Math.cos(lat);
  return [c * Math.cos(lon), c * Math.sin(lon), Math.sin(lat)];
}
export function adapter(raw: (point: readonly number[]) => number): QuantizedPlanetFieldAdapter {
  return {
    algorithmId: 'spherical-basis-field',
    algorithmVersion: 1,
    sample(point) {
      const result = quantizeAtlasFieldValue(raw(vector(point)));
      if (!result.ok) throw new Error(result.diagnostic.message);
      return result.value;
    },
  };
}
