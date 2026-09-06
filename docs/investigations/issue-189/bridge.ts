/** Public, full-profile H diagnostic boundary. No accepted records or zero contour casts. */
import { createCompactLandWaterSampleReader, type LandWaterSampleReader } from '@ttrpg-map/core';
import {
  classifyAtlasLandWater,
  createAtlasContourLevel,
  getAtlasSampleAnchorCount,
  getAtlasSampleStorageIndex,
  parseAtlasFieldValueTicks,
  quantizeAtlasFieldValue,
  type QuantizedSphericalField,
  WORLD_ATLAS_FULL_PROFILE,
} from '@ttrpg-map/generation';
export function normalize(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('Finite continuous field required');
  return Math.min(1, Math.max(-1, value)) || 0;
}
export function quantizeNormalized(value: number) {
  const result = quantizeAtlasFieldValue(value);
  if (!result.ok) throw new RangeError(result.diagnostic.message);
  return result.value;
}
export function halfContour() {
  const tick = parseAtlasFieldValueTicks(0);
  if (!tick.ok) throw new Error(tick.diagnostic.message);
  const contour = createAtlasContourLevel(tick.value);
  if (!contour.ok) throw new Error(contour.diagnostic.message);
  return contour.value;
}
export function fieldFromTicks(ticks: Int32Array): QuantizedSphericalField {
  const profile = WORLD_ATLAS_FULL_PROFILE;
  if (!(ticks instanceof Int32Array) || ticks.length !== getAtlasSampleAnchorCount(profile))
    throw new RangeError('Exact full-profile Int32 anchors required');
  for (const tick of ticks)
    if (!parseAtlasFieldValueTicks(tick).ok) throw new RangeError('Invalid field tick');
  return {
    profile,
    sampleCount: ticks.length,
    valueAt: (x, y) => {
      const result = parseAtlasFieldValueTicks(ticks[getAtlasSampleStorageIndex(profile, x, y)]);
      if (!result.ok) throw new RangeError(result.diagnostic.message);
      return result.value;
    },
  };
}
export async function classify(ticks: Int32Array, target: number) {
  if (!Number.isInteger(target) || target < 45 || target > 80)
    throw new RangeError('Public water target required');
  const result = await classifyAtlasLandWater(fieldFromTicks(ticks), halfContour(), target, {
    cooperate: () => Promise.resolve(false),
  });
  if (result.status !== 'completed') throw new Error('Uncancelled classification did not complete');
  return result.output;
}
export function immutableReader(samples: readonly unknown[]): LandWaterSampleReader {
  return createCompactLandWaterSampleReader(samples);
}
