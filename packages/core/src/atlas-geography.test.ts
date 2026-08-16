import { describe, expect, it } from 'vitest';

import { createPlanetPoint } from './coordinates.js';
import { parseSemanticKey, parseStableId } from './identity.js';
import {
  ATLAS_ASPECT_DEFINITIONS,
  ATLAS_CONTROL_DEFINITIONS,
  ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES,
  ATLAS_LANDMASS_KINDS,
  ATLAS_OCEAN_CONNECTIVITY,
  ATLAS_WATER_BODY_KINDS,
  atlasControlsMatchWorldRadius,
  type AtlasGeographyRecords,
  DEFAULT_ATLAS_CONTROLS,
  deriveAtlasAspectId,
  deriveAtlasCoastlineRingId,
  deriveAtlasFeatureEntityId,
  deriveAtlasSingletonEntityIds,
  deriveAtlasSurfaceComponentId,
  deriveAtlasWorldRadius,
  getAtlasControlInvalidationRoots,
  type MacroElevationValueTicks,
  parseAtlasControls,
  validateAtlasGeographyRecords,
} from './index.js';

const WORLD_MAP_ID = value(parseStableId('map', '00000000-0000-4000-8000-000000000001'));
const SINGLETONS = deriveAtlasSingletonEntityIds(WORLD_MAP_ID);
const LAND_COMPONENT_ID = deriveAtlasSurfaceComponentId(
  SINGLETONS.worldSurfaceEntityId,
  value(parseSemanticKey('land-component-001')),
);
const WATER_COMPONENT_ID = deriveAtlasSurfaceComponentId(
  SINGLETONS.worldSurfaceEntityId,
  value(parseSemanticKey('water-component-001')),
);
const LANDMASS_ID = deriveAtlasFeatureEntityId(
  WORLD_MAP_ID,
  value(parseSemanticKey('landmass-001')),
);
const WATER_BODY_ID = deriveAtlasFeatureEntityId(
  WORLD_MAP_ID,
  value(parseSemanticKey('water-body-001')),
);
const RING_ID = deriveAtlasCoastlineRingId(
  SINGLETONS.worldCoastlineEntityId,
  value(parseSemanticKey('coastline-ring-001')),
);

describe('Milestone 2 atlas geography contracts', () => {
  it('fixes the nine aspect names, owner scopes, versions, and direct dependency topology', () => {
    expect(ATLAS_ASPECT_DEFINITIONS).toHaveLength(9);
    expect(ATLAS_ASPECT_DEFINITIONS.map((definition) => definition.kind)).toStrictEqual([
      'worldTerrain.macroElevation',
      'worldSurface.landWaterClassification',
      'landmass.classification',
      'islandGroup.classification',
      'waterBody.classification',
      'worldCoastline.geometry',
      'atlas.coastlineAppearance',
      'atlas.waterDecoration',
      'atlas.paperTreatment',
    ]);
    expect(
      ATLAS_ASPECT_DEFINITIONS.every((definition) => definition.initialVariantRevision === 0),
    ).toBe(true);
    expect(
      ATLAS_ASPECT_DEFINITIONS.find((definition) => definition.kind === 'worldCoastline.geometry'),
    ).toMatchObject({
      owner: 'world-coastline',
      directDependencyKinds: [
        'worldSurface.landWaterClassification',
        'landmass.classification',
        'waterBody.classification',
      ],
    });
  });

  it('derives all singleton, feature, aspect, component, and ring identities without names or positions', () => {
    expect(deriveAtlasSingletonEntityIds(WORLD_MAP_ID)).toStrictEqual(SINGLETONS);
    expect(deriveAtlasFeatureEntityId(WORLD_MAP_ID, value(parseSemanticKey('landmass-001')))).toBe(
      LANDMASS_ID,
    );
    expect(
      deriveAtlasAspectId(SINGLETONS.worldSurfaceEntityId, 'worldTerrain.macroElevation'),
    ).toBe(deriveAtlasAspectId(SINGLETONS.worldSurfaceEntityId, 'worldTerrain.macroElevation'));
    expect(RING_ID).not.toBe(
      deriveAtlasCoastlineRingId(
        SINGLETONS.worldCoastlineEntityId,
        value(parseSemanticKey('coastline-ring-002')),
      ),
    );
  });

  it('validates exact control units, ranges, enums, and circumference-derived radius', () => {
    expect(ATLAS_CONTROL_DEFINITIONS.worldCircumferenceKm).toStrictEqual({
      kind: 'integer',
      unit: 'kilometers',
      defaultValue: 40_000,
      minimum: 10_000,
      maximum: 80_000,
      step: 1_000,
      firstInvalidatedAspect: 'worldTerrain.macroElevation',
    });
    expect(parseAtlasControls(DEFAULT_ATLAS_CONTROLS)).toMatchObject({ ok: true });
    expect(
      parseAtlasControls({ ...DEFAULT_ATLAS_CONTROLS, worldCircumferenceKm: 40_500 }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidControls }],
    });
    expect(parseAtlasControls({ ...DEFAULT_ATLAS_CONTROLS, unknown: true })).toMatchObject({
      ok: false,
      diagnostics: [{ code: ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidControls }],
    });

    const radius = value(deriveAtlasWorldRadius(DEFAULT_ATLAS_CONTROLS.worldCircumferenceKm));
    expect(atlasControlsMatchWorldRadius(DEFAULT_ATLAS_CONTROLS, radius)).toBe(true);
    expect(
      atlasControlsMatchWorldRadius(
        { ...DEFAULT_ATLAS_CONTROLS, worldCircumferenceKm: 41_000 },
        radius,
      ),
    ).toBe(false);
  });

  it('reports the proof-defined invalidation roots in stable order', () => {
    expect(
      getAtlasControlInvalidationRoots(DEFAULT_ATLAS_CONTROLS, {
        ...DEFAULT_ATLAS_CONTROLS,
        worldCircumferenceKm: 41_000,
        targetWaterCoveragePercent: 66,
      }),
    ).toStrictEqual(['worldSurface.landWaterClassification', 'worldTerrain.macroElevation']);
  });

  it('accepts canonical semantic geography with explicit partition, containment, connectivity, and source links', () => {
    expect(validateAtlasGeographyRecords(validRecords())).toStrictEqual({ ok: true });
  });

  it('returns stable diagnostics for invalid metadata, impossible ocean controls, invalid groups, and coastline references', () => {
    const metadata = validRecords();
    const ring = first(validRecords().coastline.rings);
    const impossible = validRecords({
      controls: {
        ...DEFAULT_ATLAS_CONTROLS,
        oceanConnectivity: ATLAS_OCEAN_CONNECTIVITY.multipleBasins,
      },
    });
    const group = validRecords({
      islandGroups: [
        { entityId: LANDMASS_ID, kind: 'archipelago', memberLandmassIds: [LANDMASS_ID] },
      ],
    });
    const coastline = validRecords({
      coastline: {
        geometryBehaviorVersion: 1,
        rings: [{ ...ring, waterBodyId: LANDMASS_ID }],
      },
    });
    const invalidMetadata: AtlasGeographyRecords = {
      ...metadata,
      macroElevation: {
        ...metadata.macroElevation,
        provenance: { ...metadata.macroElevation.provenance, fieldBehaviorVersion: 2 as 1 },
      },
    };

    expect(diagnosticCodes(invalidMetadata)).toContain(
      ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidFieldMetadata,
    );
    expect(diagnosticCodes(impossible)).toContain(
      ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.impossibleControls,
    );
    expect(diagnosticCodes(group)).toContain(
      ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassification,
    );
    expect(diagnosticCodes(coastline)).toContain(
      ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidCoastlineReference,
    );
  });

  it('rejects asymmetric marine connectivity and noncanonical collection order', () => {
    const waterBody = first(validRecords().waterBodies);
    const landmass = first(validRecords().landmasses);
    const brokenConnectivity = validRecords({
      waterBodies: [
        {
          ...waterBody,
          connectivity: [{ connectedWaterBodyId: LANDMASS_ID, kind: 'open-marine-neck' }],
        },
      ],
    });
    const unordered = validRecords({
      landmasses: [{ ...landmass, adjacentWaterBodyIds: [WATER_BODY_ID, WATER_BODY_ID] }],
    });

    expect(diagnosticCodes(brokenConnectivity)).toContain(
      ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.brokenConnectivity,
    );
    expect(diagnosticCodes(unordered)).toContain(ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidOrdering);
  });
});

function validRecords(overrides: Partial<AtlasGeographyRecords> = {}): AtlasGeographyRecords {
  return {
    controls: DEFAULT_ATLAS_CONTROLS,
    macroElevation: {
      provenance: {
        contractVersion: 1,
        samplingProfileId: 'world-atlas-full-v1',
        samplingPolicyVersion: 1,
        longitudeCellCount: 2_048,
        latitudeBandCount: 1_024,
        canonicalTraversal: 'south-pole-then-rows-then-north-pole',
        fieldBehaviorVersion: 1,
        quantizationScale: 2 ** 24,
      },
      values: [0 as MacroElevationValueTicks],
    },
    landWaterClassification: {
      classificationBehaviorVersion: 1,
      seaLevelContourDoubledTicks: 1,
      landComponentIds: [LAND_COMPONENT_ID],
      waterComponentIds: [WATER_COMPONENT_ID],
    },
    landmasses: [
      {
        entityId: LANDMASS_ID,
        componentId: LAND_COMPONENT_ID,
        kind: ATLAS_LANDMASS_KINDS.continent,
        adjacentWaterBodyIds: [WATER_BODY_ID],
      },
    ],
    islandGroups: [],
    waterBodies: [
      {
        entityId: WATER_BODY_ID,
        componentId: WATER_COMPONENT_ID,
        kind: ATLAS_WATER_BODY_KINDS.oceanBasin,
        enclosure: 'open-marine',
        adjacentLandmassIds: [LANDMASS_ID],
        connectivity: [],
      },
    ],
    coastline: {
      geometryBehaviorVersion: 1,
      rings: [
        {
          ringId: RING_ID,
          landmassId: LANDMASS_ID,
          waterBodyId: WATER_BODY_ID,
          points: [
            value(createPlanetPoint(-1, -0.5)),
            value(createPlanetPoint(0, 0.5)),
            value(createPlanetPoint(1, -0.5)),
          ],
        },
      ],
    },
    ...overrides,
  };
}

function diagnosticCodes(records: AtlasGeographyRecords): readonly string[] {
  const result = validateAtlasGeographyRecords(records);
  return result.ok ? [] : result.diagnostics.map((diagnostic) => diagnostic.code);
}

function value<Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false },
): Value {
  if (!result.ok) throw new Error('Expected test input to parse.');
  return result.value;
}

function first<Value>(values: readonly Value[]): Value {
  const entry = values[0];
  if (entry === undefined) throw new Error('Expected test collection entry.');
  return entry;
}
