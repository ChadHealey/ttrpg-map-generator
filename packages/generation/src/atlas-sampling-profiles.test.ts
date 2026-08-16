import {
  PLANET_LATITUDE_MAX_TICKS,
  PLANET_LATITUDE_MIN_TICKS,
  PLANET_LONGITUDE_MIN_TICKS,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import {
  ATLAS_FIELD_QUANTIZATION_SCALE,
  createAtlasContourLevel,
  getAtlasGridVertex,
  getAtlasSampleAnchorCount,
  getAtlasSampleStorageIndex,
  getFullProfileAddressForPreview,
  isAtlasLand,
  parseAtlasFieldValueTicks,
  quantizeAtlasFieldValue,
  WORLD_ATLAS_FULL_PROFILE,
  WORLD_ATLAS_PREVIEW_PROFILE,
} from './atlas-sampling-profiles.js';

describe('Milestone 2 atlas sampling profiles', () => {
  it('nests every preview anchor exactly inside the full planet-native lattice', () => {
    for (
      let latitudeIndex = 0;
      latitudeIndex <= WORLD_ATLAS_PREVIEW_PROFILE.latitudeBandCount;
      latitudeIndex += 1
    ) {
      const longitudeCount =
        latitudeIndex === 0 || latitudeIndex === WORLD_ATLAS_PREVIEW_PROFILE.latitudeBandCount
          ? 1
          : WORLD_ATLAS_PREVIEW_PROFILE.longitudeCellCount;
      for (let longitudeIndex = 0; longitudeIndex < longitudeCount; longitudeIndex += 1) {
        const fullAddress = getFullProfileAddressForPreview(longitudeIndex, latitudeIndex);
        expect(
          getAtlasGridVertex(
            WORLD_ATLAS_FULL_PROFILE,
            fullAddress.longitudeIndex,
            fullAddress.latitudeIndex,
          ),
        ).toEqual(getAtlasGridVertex(WORLD_ATLAS_PREVIEW_PROFILE, longitudeIndex, latitudeIndex));
      }
    }
  });

  it('stores the seam once per interior row and each pole once globally', () => {
    expect(getAtlasSampleAnchorCount(WORLD_ATLAS_PREVIEW_PROFILE)).toBe(130_562);
    expect(getAtlasSampleAnchorCount(WORLD_ATLAS_FULL_PROFILE)).toBe(2_095_106);
    expect(getAtlasGridVertex(WORLD_ATLAS_PREVIEW_PROFILE, 0, 1).longitudeTicks).toBe(
      PLANET_LONGITUDE_MIN_TICKS,
    );
    expect(getAtlasGridVertex(WORLD_ATLAS_PREVIEW_PROFILE, 0, 0)).toEqual({
      longitudeTicks: 0,
      latitudeTicks: PLANET_LATITUDE_MIN_TICKS,
    });
    expect(getAtlasGridVertex(WORLD_ATLAS_PREVIEW_PROFILE, 511, 256)).toEqual({
      longitudeTicks: 0,
      latitudeTicks: PLANET_LATITUDE_MAX_TICKS,
    });
    expect(getAtlasSampleStorageIndex(WORLD_ATLAS_PREVIEW_PROFILE, 0, 0)).toBe(0);
    expect(getAtlasSampleStorageIndex(WORLD_ATLAS_PREVIEW_PROFILE, 511, 0)).toBe(0);
    expect(getAtlasSampleStorageIndex(WORLD_ATLAS_PREVIEW_PROFILE, 0, 256)).toBe(130_561);
    expect(() =>
      getAtlasSampleAnchorCount({
        ...WORLD_ATLAS_PREVIEW_PROFILE,
        longitudeCellCount: 1_024,
      }),
    ).toThrow('exact version 1 dimensions');
  });

  it('uses exact normalized field ticks and non-degenerate half-tick classification', () => {
    expect(quantizeAtlasFieldValue(0.5)).toEqual({
      ok: true,
      value: ATLAS_FIELD_QUANTIZATION_SCALE / 2,
    });
    expect(quantizeAtlasFieldValue(1 + Number.EPSILON).ok).toBe(false);
    expect(parseAtlasFieldValueTicks(-0).ok).toBe(false);
    const zero = parseAtlasFieldValueTicks(0);
    if (!zero.ok) throw new Error(zero.diagnostic.message);
    const level = createAtlasContourLevel(zero.value);
    if (!level.ok) throw new Error(level.diagnostic.message);
    expect(level.value).toBe(1);
    expect(isAtlasLand(zero.value, level.value)).toBe(false);
    const one = parseAtlasFieldValueTicks(1);
    if (!one.ok) throw new Error(one.diagnostic.message);
    expect(isAtlasLand(one.value, level.value)).toBe(true);
  });
});
