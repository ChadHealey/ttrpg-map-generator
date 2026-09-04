import { DEFAULT_ATLAS_CONTROLS } from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import { generateAtlasLandWaterPreview } from './atlas-land-water-generator.js';
import {
  ATLAS_LAND_WATER_GENERATOR_MANIFEST,
  ATLAS_LAND_WATER_INPUT_DIAGNOSTIC_CODES,
  atlasLandWaterClassificationParameters,
  atlasMacroElevationParameters,
  createAtlasLandWaterGenerationInput,
} from './atlas-land-water-generator-contract.js';
import {
  FIXED_ATLAS_LAND_WATER_ASPECT_ID,
  FIXED_ATLAS_MACRO_ELEVATION_ASPECT_ID,
  FIXED_ATLAS_WORLD_MAP_ID,
  FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
  fixedAtlasInput,
  fixedAtlasRuntime,
} from './atlas-land-water-test-support.js';

describe('atlas land/water generator contract', () => {
  it('declares exact v2 macro ownership, dependency, seed scopes, controls, profiles, and cost', () => {
    expect(ATLAS_LAND_WATER_GENERATOR_MANIFEST).toMatchObject({
      manifestVersion: 2,
      inputs: [
        'validated-atlas-controls',
        'explicit-macro-field-behavior-version',
        'canonical-world-seed',
        'world-map-id',
        'world-surface-entity-id',
        'two-aspect-ids',
        'two-variant-revisions',
        'two-independent-map-entity-streams',
      ],
      aspects: [
        {
          aspectName: 'worldTerrain.macroElevation',
          generatorId: 'worldTerrain.macroElevation',
          generatorVersion: 2,
          parameterSchemaVersion: 1,
          additionalBehaviorVersion: 2,
          seedScope: 'map/entity',
          directDependencies: [],
          outputRecord: 'MacroElevationField',
          randomDrawPolicy: 'finite-separated-owners',
        },
        {
          aspectName: 'worldSurface.landWaterClassification',
          generatorId: 'worldSurface.landWaterClassification',
          generatorVersion: 1,
          parameterSchemaVersion: 1,
          additionalBehaviorVersion: 1,
          seedScope: 'map/entity',
          directDependencies: ['worldTerrain.macroElevation'],
          outputRecord: 'LandWaterClassification',
          randomDrawPolicy: 'zero-draws',
        },
      ],
      directDependencyEdges: [
        {
          input: 'worldTerrain.macroElevation',
          output: 'worldSurface.landWaterClassification',
        },
      ],
      versions: {
        geographyContractVersion: 1,
        samplingPolicyVersion: 1,
        fieldBehaviorVersion: 2,
        gapPolicyVersion: 1,
        shapePolicyVersion: 1,
        classificationBehaviorVersion: 1,
        parameterSchemaVersion: 1,
        realizationVersion: 1,
        previewVersion: 1,
        seedDerivationVersion: 1,
        deterministicStreamVersion: 1,
      },
      profiles: {
        preview: {
          profileId: 'world-atlas-preview-v1',
          sampleCount: 130_562,
          authority: 'disposable',
          isPromotable: false,
        },
        full: {
          profileId: 'world-atlas-full-v1',
          sampleCount: 2_095_106,
          authority: 'proposed-accepted-output',
        },
        sharedAnchorRefinementFactor: 4,
      },
      tolerances: {
        connectedMajorityProxyMinimumPercent: 90,
        connectivityPreferenceMaxCoverageErrorBasisPoints: 10,
        sharedAnchorFieldTicks: 0,
        sharedAnchorClassificationDifferences: 0,
        canonicalSeamIdentityFieldTicks: 0,
        poleSamplesPerPole: 1,
        maximumWaterCoverageErrorBasisPoints: 25,
        minimumOwnerOceanGapRad: 0.05,
      },
      expectedCost: {
        complexity: 'linear-in-profile-anchors',
        costClass: 'costly',
        fullReferenceWallClockBudgetMs: 10_000,
        fullReferencePeakAdditionalMemoryMiB: 768,
        macroPlacementBudget: 8,
      },
    });
    expect(ATLAS_LAND_WATER_GENERATOR_MANIFEST.controlOwnership).toStrictEqual({
      macroElevation: [
        'archipelagoAbundancePercent',
        'continentCountIntent',
        'continentDistribution',
        'fragmentationPercent',
        'islandAbundancePercent',
        'polarCharacter',
        'worldCircumferenceKm',
      ],
      landWaterClassification: ['oceanConnectivity', 'targetWaterCoveragePercent'],
    });
  });

  it('validates exact IDs and controls, then returns a fixed-order immutable snapshot', () => {
    const parsed = createAtlasLandWaterGenerationInput(sourceWithControls(reversedControls()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.controls).toStrictEqual(DEFAULT_ATLAS_CONTROLS);
    expect(Object.keys(parsed.value.controls)).toStrictEqual([
      'worldCircumferenceKm',
      'targetWaterCoveragePercent',
      'continentCountIntent',
      'continentDistribution',
      'fragmentationPercent',
      'islandAbundancePercent',
      'archipelagoAbundancePercent',
      'oceanConnectivity',
      'polarCharacter',
    ]);
    expect(Object.isFrozen(parsed.value)).toBe(true);
    expect(Object.isFrozen(parsed.value.controls)).toBe(true);
    expect(parsed.value.macroElevationSeedMetadata).toMatchObject({
      seedScope: 'map/entity',
      aspectName: 'worldTerrain.macroElevation',
      generatorId: 'worldTerrain.macroElevation',
      mapId: FIXED_ATLAS_WORLD_MAP_ID,
      entityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
      generatorVersion: 1,
    });
    expect(parsed.value.landWaterClassificationSeedMetadata).toMatchObject({
      seedScope: 'map/entity',
      aspectName: 'worldSurface.landWaterClassification',
      generatorId: 'worldSurface.landWaterClassification',
    });
  });

  it('rejects extra fields, invalid controls, and non-derived identities with stable diagnostics', () => {
    expect(
      createAtlasLandWaterGenerationInput({
        ...sourceWithControls(DEFAULT_ATLAS_CONTROLS),
        macroElevationFieldBehaviorVersion: 3,
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: ATLAS_LAND_WATER_INPUT_DIAGNOSTIC_CODES.invalidField,
          field: 'macroElevationFieldBehaviorVersion',
        },
      ],
    });
    expect(
      createAtlasLandWaterGenerationInput({
        ...sourceWithControls(DEFAULT_ATLAS_CONTROLS),
        extra: true,
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: ATLAS_LAND_WATER_INPUT_DIAGNOSTIC_CODES.invalidRecord }],
    });
    expect(
      createAtlasLandWaterGenerationInput(
        sourceWithControls({ ...DEFAULT_ATLAS_CONTROLS, targetWaterCoveragePercent: 44 }),
      ),
    ).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: ATLAS_LAND_WATER_INPUT_DIAGNOSTIC_CODES.invalidField,
          field: 'controls',
        },
      ],
    });
    expect(
      createAtlasLandWaterGenerationInput({
        ...sourceWithControls(DEFAULT_ATLAS_CONTROLS),
        worldSurfaceEntityId: '11111111-1111-4111-8111-111111111111',
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: ATLAS_LAND_WATER_INPUT_DIAGNOSTIC_CODES.invalidField,
          field: 'worldSurfaceEntityId',
        },
      ],
    });
  });

  it('separates macro controls from classification-only parameters by construction', () => {
    const macro = atlasMacroElevationParameters(DEFAULT_ATLAS_CONTROLS, 1);
    const classification = atlasLandWaterClassificationParameters(DEFAULT_ATLAS_CONTROLS);
    expect(macro).not.toHaveProperty('targetWaterCoveragePercent');
    expect(macro).not.toHaveProperty('oceanConnectivity');
    expect(classification).toStrictEqual({
      parameterSchemaVersion: 1,
      classificationBehaviorVersion: 1,
      sharedThresholdProfileId: 'world-atlas-preview-v1',
      acceptedProfileId: 'world-atlas-full-v1',
      realizationVersion: 1,
      maximumWaterCoverageErrorBasisPoints: 25,
      targetWaterCoveragePercent: 65,
      oceanConnectivity: 'singleGlobal',
    });
  });

  it('returns disposable non-promotable preview data without accepted aspect metadata', async () => {
    const input = fixedAtlasInput();
    const result = await generateAtlasLandWaterPreview(input, fixedAtlasRuntime(input));
    expect(result.status).toBe('preview');
    if (result.status !== 'preview') return;
    expect(result.preview).toMatchObject({
      previewKind: 'disposable-atlas-land-water',
      previewVersion: 1,
      profileId: 'world-atlas-preview-v1',
      authority: 'disposable',
      isPromotable: false,
    });
    expect(result.preview.macroElevationValues).toHaveLength(130_562);
    expect(result.preview.landWaterSamples).toHaveLength(130_562);
    const keys = JSON.stringify(result.preview);
    expect(keys).not.toContain('aspectId');
    expect(keys).not.toContain('variantRevision');
    expect(keys).not.toContain('accepted');
    expect(keys).not.toContain('packagePath');
  });
});

function sourceWithControls(controls: unknown): Record<string, unknown> {
  return {
    worldSeed: '81985529216486895',
    worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
    worldSurfaceEntityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
    macroElevationAspectId: FIXED_ATLAS_MACRO_ELEVATION_ASPECT_ID,
    macroElevationFieldBehaviorVersion: 1,
    landWaterClassificationAspectId: FIXED_ATLAS_LAND_WATER_ASPECT_ID,
    macroElevationVariantRevision: 0,
    landWaterClassificationVariantRevision: 0,
    controls,
  };
}

function reversedControls(): Record<string, unknown> {
  return Object.fromEntries(Object.entries(DEFAULT_ATLAS_CONTROLS).reverse());
}
