import {
  atlasSampleReaderToArray,
  createDeterministicRandomStream,
  createPlanetPoint,
  PLANET_ANGULAR_STEP_RAD,
  validateAtlasLandWaterRecords,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import {
  generateAtlasLandWaterFull,
  generateAtlasLandWaterPreview,
} from './atlas-land-water-generator.js';
import {
  ATLAS_WATER_COVERAGE_TOLERANCE_BASIS_POINTS,
  atlasMacroElevationParameters,
} from './atlas-land-water-generator-contract.js';
import {
  FIXED_ATLAS_GENERATOR_CASES,
  fixedAtlasInput,
  fixedAtlasRuntime,
  generateFixedAtlasFull,
  requiredCase,
} from './atlas-land-water-test-support.js';
import { createAtlasMacroElevationFieldAdapter } from './atlas-macro-elevation-field.js';
import {
  getAtlasSampleStorageIndex,
  getFullProfileAddressForPreview,
  WORLD_ATLAS_FULL_PROFILE,
  WORLD_ATLAS_PREVIEW_PROFILE,
} from './atlas-sampling-profiles.js';

describe('whole-world atlas land/water generation invariants', () => {
  it('produces valid accepted full-profile records for all six fixed seed/control rows', async () => {
    for (const fixed of FIXED_ATLAS_GENERATOR_CASES) {
      const result = await generateFixedAtlasFull(fixed);
      expect(validateAtlasLandWaterRecords(result.patch.records)).toEqual([]);
      expect(result.patch.records.macroElevation.values).toHaveLength(2_095_106);
      expect(result.patch.records.landWaterClassification.samples).toHaveLength(2_095_106);
      expect(result.realization.absoluteWaterCoverageErrorBasisPoints).toBeLessThanOrEqual(
        ATLAS_WATER_COVERAGE_TOLERANCE_BASIS_POINTS,
      );
      expect(
        new Set(atlasSampleReaderToArray(result.patch.records.landWaterClassification.samples)),
      ).toEqual(new Set(['land', 'water']));
    }
  }, 120_000);

  it('reuses every exact preview anchor and classification in the full proposal', async () => {
    const input = fixedAtlasInput();
    const previewResult = await generateAtlasLandWaterPreview(input, fixedAtlasRuntime(input));
    const fullResult = await generateAtlasLandWaterFull(input, fixedAtlasRuntime(input));
    expect(previewResult.status).toBe('preview');
    expect(fullResult.status).toBe('proposed-full');
    if (previewResult.status !== 'preview' || fullResult.status !== 'proposed-full') return;

    const fullValues = fullResult.patch.records.macroElevation.values;
    const fullSamples = fullResult.patch.records.landWaterClassification.samples;
    expect(previewResult.preview.seaLevelContourDoubledTicks).toBe(
      fullResult.patch.records.landWaterClassification.seaLevelContourDoubledTicks,
    );
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
        const previewIndex = getAtlasSampleStorageIndex(
          WORLD_ATLAS_PREVIEW_PROFILE,
          longitudeIndex,
          latitudeIndex,
        );
        const fullAddress = getFullProfileAddressForPreview(longitudeIndex, latitudeIndex);
        const fullIndex = getAtlasSampleStorageIndex(
          WORLD_ATLAS_FULL_PROFILE,
          fullAddress.longitudeIndex,
          fullAddress.latitudeIndex,
        );
        expect(fullValues.at(fullIndex)).toBe(
          previewResult.preview.macroElevationValues[previewIndex],
        );
        expect(fullSamples.at(fullIndex)).toBe(
          previewResult.preview.landWaterSamples[previewIndex],
        );
      }
    }
  }, 30_000);

  it('uses one canonical sample per pole and an analytic field continuous at the seam', () => {
    const input = fixedAtlasInput();
    const stream = createDeterministicRandomStream(input.macroElevationSeedMetadata);
    if (!stream.ok) throw new Error(stream.diagnostic.message);
    const adapter = createAtlasMacroElevationFieldAdapter(
      atlasMacroElevationParameters(input.controls),
      stream.value,
    );
    const positiveSeam = createPlanetPoint(Math.PI, 0.31);
    const negativeSeam = createPlanetPoint(-Math.PI, 0.31);
    if (!positiveSeam.ok || !negativeSeam.ok) throw new Error('Fixed seam points must parse.');
    expect(positiveSeam.value).toEqual(negativeSeam.value);
    expect(adapter.sample(positiveSeam.value)).toBe(adapter.sample(negativeSeam.value));

    const northPrime = createPlanetPoint(0, Math.PI / 2);
    const northQuarter = createPlanetPoint(Math.PI / 2, Math.PI / 2);
    if (!northPrime.ok || !northQuarter.ok) throw new Error('Fixed pole points must parse.');
    expect(northPrime.value).toEqual(northQuarter.value);
    expect(adapter.sample(northPrime.value)).toBe(adapter.sample(northQuarter.value));

    const east = createPlanetPoint(Math.PI - PLANET_ANGULAR_STEP_RAD, 0.31);
    const west = createPlanetPoint(-Math.PI + PLANET_ANGULAR_STEP_RAD, 0.31);
    if (!east.ok || !west.ok) throw new Error('Fixed seam neighbors must parse.');
    expect(Math.abs(adapter.sample(east.value) - adapter.sample(west.value))).toBeLessThanOrEqual(
      2,
    );
  });

  it('keeps the maximum-control multiple-basin intent in classification diagnostics only', async () => {
    const fixed = requiredCase('milestone-2-atlas-control-max');
    const input = fixedAtlasInput(fixed);
    const result = await generateAtlasLandWaterFull(input, fixedAtlasRuntime(input));
    expect(result.status).toBe('proposed-full');
    if (result.status !== 'proposed-full') return;
    expect(result.diagnostics.map(({ code }) => code)).toContain(
      'atlas.land-water.ocean-connectivity-unverified',
    );
  }, 30_000);
});
