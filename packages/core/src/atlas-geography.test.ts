import { describe, expect, it } from 'vitest';

import { createPlanetPoint, roundTiesAwayFromZero } from './coordinates.js';
import { parseSemanticKey, parseStableId } from './identity.js';
import {
  ATLAS_ASPECT_DEFINITIONS,
  ATLAS_CONTROL_DEFINITIONS,
  ATLAS_FULL_LATITUDE_BAND_COUNT,
  ATLAS_FULL_LONGITUDE_CELL_COUNT,
  ATLAS_FULL_SAMPLE_COUNT,
  ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES,
  ATLAS_LANDMASS_KINDS,
  ATLAS_MACRO_ELEVATION_VERSION_DEFINITIONS,
  ATLAS_OCEAN_CONNECTIVITY,
  ATLAS_SEMANTIC_AREA_WEIGHT_SCALE,
  ATLAS_WATER_BODY_KINDS,
  atlasControlsMatchWorldRadius,
  type AtlasGeographyRecords,
  atlasSampleReaderToArray,
  createBehaviorVersion,
  createLandWaterSampleReader,
  createMacroElevationSampleReader,
  DEFAULT_ATLAS_CONTROLS,
  deriveAtlasAspectId,
  deriveAtlasCoastlineRingId,
  deriveAtlasCoastlineRingIdFromFingerprint,
  deriveAtlasFeatureEntityId,
  deriveAtlasSemanticComponentIdentity,
  deriveAtlasSingletonEntityIds,
  deriveAtlasWorldRadius,
  getAtlasControlInvalidationRoots,
  type MacroElevationValueTicks,
  parseAtlasControls,
  selectAtlasMacroElevationVersion,
  validateAtlasGeographyRecords,
  validateAtlasLandWaterRecords,
  validateAtlasMacroElevationVersionPair,
} from './index.js';

const WORLD_MAP_ID = value(parseStableId('map', '00000000-0000-4000-8000-000000000001'));
const SINGLETONS = deriveAtlasSingletonEntityIds(WORLD_MAP_ID);
const SAMPLE_MIDPOINT = ATLAS_FULL_SAMPLE_COUNT / 2;
const LAND_RANGES = [{ startIndex: 0, endIndexExclusive: SAMPLE_MIDPOINT }];
const WATER_RANGES = [{ startIndex: SAMPLE_MIDPOINT, endIndexExclusive: ATLAS_FULL_SAMPLE_COUNT }];
const LAND_AREA_WEIGHT = areaWeightForRanges(LAND_RANGES);
const WATER_AREA_WEIGHT = areaWeightForRanges(WATER_RANGES);
const LAND_IDENTITY = deriveAtlasSemanticComponentIdentity(
  WORLD_MAP_ID,
  SINGLETONS.worldSurfaceEntityId,
  'land',
  LAND_RANGES,
);
const WATER_IDENTITY = deriveAtlasSemanticComponentIdentity(
  WORLD_MAP_ID,
  SINGLETONS.worldSurfaceEntityId,
  'water',
  WATER_RANGES,
);
const LAND_COMPONENT_ID = LAND_IDENTITY.componentId;
const WATER_COMPONENT_ID = WATER_IDENTITY.componentId;
const LANDMASS_ID = LAND_IDENTITY.entityId;
const WATER_BODY_ID = WATER_IDENTITY.entityId;
const RING_FINGERPRINT = 'a'.repeat(64);
const RING_ID = deriveAtlasCoastlineRingIdFromFingerprint(
  SINGLETONS.worldCoastlineEntityId,
  RING_FINGERPRINT,
);
const CLASSIFICATION_ASPECT_ID = deriveAtlasAspectId(
  SINGLETONS.worldSurfaceEntityId,
  'worldSurface.landWaterClassification',
);
const FULL_PROFILE_TEST_TIMEOUT_MS = 30_000;

function fullProfileIt(name: string, testBody: () => void): void {
  it(name, testBody, FULL_PROFILE_TEST_TIMEOUT_MS);
}

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

  it('selects the two supported macro-elevation version contracts independently of the v1 catalog default', () => {
    expect(ATLAS_MACRO_ELEVATION_VERSION_DEFINITIONS).toStrictEqual([
      { fieldBehaviorVersion: 1, generatorVersion: 1 },
      { fieldBehaviorVersion: 2, generatorVersion: 2 },
    ]);
    expect(selectAtlasMacroElevationVersion(1)).toStrictEqual({
      fieldBehaviorVersion: 1,
      generatorVersion: 1,
    });
    expect(selectAtlasMacroElevationVersion(2)).toStrictEqual({
      fieldBehaviorVersion: 2,
      generatorVersion: 2,
    });
    expect(
      ATLAS_ASPECT_DEFINITIONS.find(({ kind }) => kind === 'worldTerrain.macroElevation')
        ?.generatorVersion,
    ).toBe(1);
  });

  it('validates only exact macro-elevation generator, parameter, and output version tuples', () => {
    const versionOne = value(createBehaviorVersion(1));
    const versionTwo = value(createBehaviorVersion(2));
    expect(validateAtlasMacroElevationVersionPair(versionOne, 1, 1)).toStrictEqual([]);
    expect(validateAtlasMacroElevationVersionPair(versionTwo, 2, 2)).toStrictEqual([]);
    for (const tuple of [
      [versionOne, 1, 2],
      [versionTwo, 1, 1],
      [versionTwo, 2, 1],
      [3, 3, 3],
    ] as const) {
      expect(validateAtlasMacroElevationVersionPair(tuple[0], tuple[1], tuple[2])).toStrictEqual([
        expect.objectContaining({
          code: ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidFieldVersionPair,
        }),
      ]);
    }
  });

  it('derives all singleton, feature, aspect, component, and ring identities without names or positions', () => {
    expect(deriveAtlasSingletonEntityIds(WORLD_MAP_ID)).toStrictEqual(SINGLETONS);
    expect(deriveAtlasFeatureEntityId(WORLD_MAP_ID, value(parseSemanticKey('landmass-001')))).toBe(
      '22c09949-866a-5c0d-b883-3bfdd23918a4',
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

  fullProfileIt(
    'accepts canonical semantic geography with explicit partition, containment, connectivity, and source links',
    () => {
      expect(validateAtlasGeographyRecords(validRecords())).toStrictEqual({ ok: true });
    },
  );

  fullProfileIt(
    'keeps #58 field/partition output valid before #59 semantic entities reference it',
    () => {
      const records = validRecords();
      expect(
        validateAtlasLandWaterRecords({
          controls: records.controls,
          macroElevation: records.macroElevation,
          landWaterClassification: records.landWaterClassification,
        }),
      ).toStrictEqual([]);
      expect(records.landmasses[0]?.sourceClassificationAspectId).toBe(
        records.landWaterClassificationAspectId,
      );
      expect(records.waterBodies[0]?.sourceClassificationAspectId).toBe(
        records.landWaterClassificationAspectId,
      );
    },
  );

  fullProfileIt('accepts macro-elevation field behavior versions 1 and 2 without widening', () => {
    const versionOne = validRecords();
    const versionTwo: AtlasGeographyRecords = {
      ...versionOne,
      macroElevation: {
        ...versionOne.macroElevation,
        provenance: { ...versionOne.macroElevation.provenance, fieldBehaviorVersion: 2 },
      },
    };
    expect(validateAtlasGeographyRecords(versionOne)).toStrictEqual({ ok: true });
    expect(validateAtlasGeographyRecords(versionTwo)).toStrictEqual({ ok: true });
  });

  fullProfileIt(
    'rejects truncated full fields and partitions plus invalid versions and contour ranges',
    () => {
      const records = validRecords();
      const invalid = {
        ...records,
        macroElevation: {
          ...records.macroElevation,
          values: createMacroElevationSampleReader(Object.freeze([0 as MacroElevationValueTicks])),
        },
        landWaterClassification: {
          ...records.landWaterClassification,
          classificationBehaviorVersion: 2 as 1,
          seaLevelContourDoubledTicks: 2 * 2 ** 24 + 1,
          samples: createLandWaterSampleReader(Object.freeze(['water'] as const)),
        },
        coastline: { ...records.coastline, geometryBehaviorVersion: 2 as 1 },
      };
      const codes = diagnosticCodes(invalid);
      expect(codes).toContain(ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidFieldMetadata);
      expect(codes).toContain(ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassification);
      expect(codes).toContain(ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassificationVersion);
      expect(codes).toContain(ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidCoastlineVersion);
    },
  );

  fullProfileIt('rejects invalid or contradictory upstream land/water samples', () => {
    const records = validRecords();
    const invalidLiteral = {
      ...records,
      landWaterClassification: {
        ...records.landWaterClassification,
        samples: createLandWaterSampleReader(
          Object.freeze([
            'bogus',
            ...atlasSampleReaderToArray(records.landWaterClassification.samples).slice(1),
          ]) as readonly ('land' | 'water')[],
        ),
      },
    };
    const mismatch = {
      ...records,
      landWaterClassification: {
        ...records.landWaterClassification,
        samples: createLandWaterSampleReader(
          Object.freeze([
            'water',
            ...atlasSampleReaderToArray(records.landWaterClassification.samples).slice(1),
          ]),
        ),
      },
    };
    expect(validateAtlasLandWaterRecords(invalidLiteral).map((finding) => finding.code)).toContain(
      ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassification,
    );
    expect(validateAtlasLandWaterRecords(mismatch).map((finding) => finding.code)).toContain(
      ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassification,
    );
  });

  fullProfileIt(
    'returns stable diagnostics for invalid metadata, impossible ocean controls, invalid groups, and coastline references',
    () => {
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
          extractionAlgorithmVersion: 1,
          simplificationPolicyVersion: 1,
          simplificationToleranceTicks: 524_288,
          topologyValidationVersion: 1,
          winding: 'land-on-left',
          repairPolicy: 'reject-invalid-no-silent-repair',
          rings: [{ ...ring, waterBodyIds: [LANDMASS_ID] }],
        },
      });
      const invalidMetadata = {
        ...metadata,
        macroElevation: {
          ...metadata.macroElevation,
          provenance: { ...metadata.macroElevation.provenance, fieldBehaviorVersion: 3 },
        },
      } as unknown as AtlasGeographyRecords;

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
    },
  );

  fullProfileIt('rejects self-intersecting canonical coastline rings without a generator', () => {
    const records = validRecords();
    const ring = first(records.coastline.rings);
    const selfIntersecting = validRecords({
      coastline: {
        ...records.coastline,
        rings: [
          {
            ...ring,
            points: [
              value(createPlanetPoint(-1, -1)),
              value(createPlanetPoint(1, 1)),
              value(createPlanetPoint(-1, 1)),
              value(createPlanetPoint(1, -1)),
            ],
          },
        ],
      },
    });

    expect(diagnosticCodes(selfIntersecting)).toContain(
      ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidCoastlineReference,
    );
  });

  fullProfileIt('rejects asymmetric marine connectivity and noncanonical collection order', () => {
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
    expect(diagnosticCodes(unordered)).toContain(
      ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.brokenContainment,
    );
  });

  fullProfileIt('reports stable ownership, disconnectedness, and identity diagnostics', () => {
    const records = validRecords();
    const landmass = first(records.landmasses);
    const waterBody = first(records.waterBodies);
    const overlap = validRecords({
      waterBodies: [
        {
          ...waterBody,
          membership: { ...landmass.membership },
        },
      ],
    });
    const missing = validRecords({
      landmasses: [
        {
          ...landmass,
          membership: {
            ...landmass.membership,
            sampleCount: landmass.membership.sampleCount - 1,
            sampleRanges: [
              {
                startIndex: 0,
                endIndexExclusive: SAMPLE_MIDPOINT - 1,
              },
            ],
          },
        },
      ],
    });
    const disconnected = validRecords({
      landmasses: [
        {
          ...landmass,
          membership: {
            ...landmass.membership,
            sampleCount: 2,
            sampleRanges: [
              { startIndex: 0, endIndexExclusive: 1 },
              { startIndex: SAMPLE_MIDPOINT - 1, endIndexExclusive: SAMPLE_MIDPOINT },
            ],
          },
        },
      ],
    });
    const collision = validRecords({
      landmasses: [
        {
          ...landmass,
          membership: { ...landmass.membership, fingerprint: '0'.repeat(64) },
        },
      ],
    });
    const wrongArea = validRecords({
      landmasses: [
        {
          ...landmass,
          membership: {
            ...landmass.membership,
            sphericalAreaWeight: landmass.membership.sphericalAreaWeight + 1,
          },
        },
      ],
    });

    expect(diagnosticCodes(overlap)).toContain(
      ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.overlappingOwnership,
    );
    expect(diagnosticCodes(missing)).toContain(ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.unownedSample);
    expect(diagnosticCodes(disconnected)).toContain(
      ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.disconnectedComponent,
    );
    expect(diagnosticCodes(collision)).toContain(
      ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.identityCollision,
    );
    expect(diagnosticCodes(wrongArea)).toContain(
      ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassification,
    );
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
      values: Array.from(
        { length: ATLAS_FULL_SAMPLE_COUNT },
        (_, index) => (index < SAMPLE_MIDPOINT ? 1 : 0) as MacroElevationValueTicks,
      ),
    },
    landWaterClassification: {
      classificationBehaviorVersion: 1,
      seaLevelContourDoubledTicks: 1,
      samples: Array.from({ length: ATLAS_FULL_SAMPLE_COUNT }, (_, index) =>
        index < SAMPLE_MIDPOINT ? ('land' as const) : ('water' as const),
      ),
    },
    semanticClassificationVersion: 1,
    worldMapId: WORLD_MAP_ID,
    worldSurfaceEntityId: SINGLETONS.worldSurfaceEntityId,
    landmasses: [
      {
        entityId: LANDMASS_ID,
        sourceClassificationAspectId: CLASSIFICATION_ASPECT_ID,
        componentId: LAND_COMPONENT_ID,
        membership: {
          classificationVersion: 1,
          fingerprint: LAND_IDENTITY.fingerprint,
          sampleCount: SAMPLE_MIDPOINT,
          sphericalAreaWeight: LAND_AREA_WEIGHT,
          sampleRanges: LAND_RANGES,
        },
        kind: ATLAS_LANDMASS_KINDS.continent,
        adjacentWaterBodyIds: [WATER_BODY_ID],
      },
    ],
    islandGroups: [],
    waterBodies: [
      {
        entityId: WATER_BODY_ID,
        sourceClassificationAspectId: CLASSIFICATION_ASPECT_ID,
        componentId: WATER_COMPONENT_ID,
        membership: {
          classificationVersion: 1,
          fingerprint: WATER_IDENTITY.fingerprint,
          sampleCount: SAMPLE_MIDPOINT,
          sphericalAreaWeight: WATER_AREA_WEIGHT,
          sampleRanges: WATER_RANGES,
        },
        kind: ATLAS_WATER_BODY_KINDS.oceanBasin,
        enclosure: 'open-marine',
        enclosedByLandmassIds: [],
        adjacentLandmassIds: [LANDMASS_ID],
        connectivity: [],
      },
    ],
    coastline: {
      geometryBehaviorVersion: 1,
      extractionAlgorithmVersion: 1,
      simplificationPolicyVersion: 1,
      simplificationToleranceTicks: 524_288,
      topologyValidationVersion: 1,
      winding: 'land-on-left',
      repairPolicy: 'reject-invalid-no-silent-repair',
      rings: [
        {
          ringId: RING_ID,
          sourceBoundaryFingerprint: RING_FINGERPRINT,
          landmassId: LANDMASS_ID,
          waterBodyIds: [WATER_BODY_ID],
          points: [
            value(createPlanetPoint(-1, -0.5)),
            value(createPlanetPoint(0, 0.5)),
            value(createPlanetPoint(1, -0.5)),
          ],
        },
      ],
    },
    landWaterClassificationAspectId: CLASSIFICATION_ASPECT_ID,
    ...overrides,
  };
}

function areaWeightForRanges(ranges: readonly { startIndex: number; endIndexExclusive: number }[]) {
  let total = 0;
  for (const { startIndex, endIndexExclusive } of ranges) {
    for (let index = startIndex; index < endIndexExclusive; index += 1) {
      const latitudeIndex =
        index === 0
          ? 0
          : index === ATLAS_FULL_SAMPLE_COUNT - 1
            ? ATLAS_FULL_LATITUDE_BAND_COUNT
            : Math.floor((index - 1) / ATLAS_FULL_LONGITUDE_CELL_COUNT) + 1;
      total += roundTiesAwayFromZero(
        Math.cos(-Math.PI / 2 + (Math.PI * latitudeIndex) / ATLAS_FULL_LATITUDE_BAND_COUNT) *
          ATLAS_SEMANTIC_AREA_WEIGHT_SCALE,
      );
    }
  }
  return total;
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
