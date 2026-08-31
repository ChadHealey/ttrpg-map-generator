import { describe, expect, it } from 'vitest';

import { ATLAS_FULL_SAMPLE_COUNT } from './atlas-geography-model.js';
import { createPhysicalDistance, createPlanetPoint } from './coordinates.js';
import { parseStableId } from './identity.js';
import {
  getWorldPhysicalContextControlInvalidationRoots,
  WORLD_PHYSICAL_CONTEXT_ASPECT_DEFINITIONS,
  WORLD_PHYSICAL_CONTEXT_CONTROL_DEFINITIONS,
  type WorldPhysicalContextAspectKind,
} from './world-physical-context-aspects.js';
import {
  deriveWorldPhysicalBiomeBeltEntityId,
  deriveWorldPhysicalContextAspectId,
  deriveWorldPhysicalFeatureEntityId,
  fingerprintWorldPhysicalField,
  fingerprintWorldPhysicalRootSignature,
  parseBiomeKey,
  parseClimateZoneKey,
  parseWorldPhysicalFieldFingerprint,
} from './world-physical-context-identity.js';
import {
  createDischargeTicks,
  createNormalizedFieldTicks,
  createTemperatureTicks,
  createWindSpeedTicks,
  isCalmWindSpeed,
  type WorldPhysicalContextRecords,
  type WorldPhysicalFieldKind,
} from './world-physical-context-model.js';
import { createConstantWorldPhysicalFieldReader } from './world-physical-context-readers.js';
import {
  getCanonicalWorldPhysicalContextAspectTraversal,
  validateWorldPhysicalContextAspectDefinitions,
  validateWorldPhysicalContextControls,
  validateWorldPhysicalContextRecords,
  WORLD_PHYSICAL_CONTEXT_DIAGNOSTIC_CODES,
} from './world-physical-context-validation.js';

const WORLD_MAP_ID = required(parseStableId('map', '00000000-0000-4000-8000-000000000101'));
const WORLD_SURFACE_ID = required(parseStableId('entity', '00000000-0000-4000-8000-000000000101'));
const RIVER_ID = required(parseStableId('entity', '00000000-0000-4000-8000-000000000103'));
const PLANET_POINT = required(createPlanetPoint(0, 0));
const SECOND_PLANET_POINT = required(createPlanetPoint(0.1, 0.1));
const DISTANCE = required(createPhysicalDistance(1));
const TEMPERATURE = requiredValue(createTemperatureTicks(150));
const NORMALIZED = requiredValue(createNormalizedFieldTicks(0));
const MOISTURE = requiredValue(createNormalizedFieldTicks(0));
const WIND_SPEED = requiredValue(createWindSpeedTicks(0));
const DISCHARGE = requiredValue(createDischargeTicks(0));
const CLIMATE_ZONE = requiredValue(parseClimateZoneKey('temperate'));
const BIOME = requiredValue(parseBiomeKey('temperate-forest'));
const INVALID_FINGERPRINT = requiredValue(parseWorldPhysicalFieldFingerprint('a'.repeat(64)));

describe('Milestone 3 world physical-context contracts', () => {
  it('fixes accepted controls and the direct physical dependency catalogue', () => {
    expect(WORLD_PHYSICAL_CONTEXT_CONTROL_DEFINITIONS).toStrictEqual({
      mountainCharacter: {
        kind: 'enum',
        defaultValue: 'varied',
        values: ['low', 'varied', 'rugged'],
        firstInvalidatedAspect: 'worldTerrain.mountainSystems',
      },
      climateCharacter: {
        kind: 'enum',
        defaultValue: 'varied',
        values: ['temperate', 'varied', 'extreme'],
        firstInvalidatedAspect: 'worldClimate.temperature',
      },
    });
    expect(WORLD_PHYSICAL_CONTEXT_ASPECT_DEFINITIONS).toHaveLength(9);
    expect(getCanonicalWorldPhysicalContextAspectTraversal()).toStrictEqual([
      'worldTerrain.mountainSystems',
      'worldClimate.temperature',
      'worldClimate.prevailingWinds',
      'worldClimate.moisture',
      'worldClimate.zones',
      'worldEcology.biomeBelts',
      'worldHydrology.watersheds',
      'worldHydrology.majorRivers',
      'worldHydrology.majorLakes',
    ]);
    expect(validateWorldPhysicalContextAspectDefinitions()).toStrictEqual([]);
    expect(
      getWorldPhysicalContextControlInvalidationRoots(
        { mountainCharacter: 'varied', climateCharacter: 'varied' },
        { mountainCharacter: 'rugged', climateCharacter: 'extreme' },
      ),
    ).toStrictEqual(['worldClimate.temperature', 'worldTerrain.mountainSystems']);
    expect(
      Object.fromEntries(
        WORLD_PHYSICAL_CONTEXT_ASPECT_DEFINITIONS.map((definition) => [
          definition.kind,
          definition.directDependencyKinds,
        ]),
      ),
    ).toStrictEqual({
      'worldTerrain.mountainSystems': [
        'worldTerrain.macroElevation',
        'worldSurface.landWaterClassification',
      ],
      'worldClimate.temperature': [
        'worldTerrain.macroElevation',
        'worldSurface.landWaterClassification',
        'waterBody.classification',
        'worldTerrain.mountainSystems',
      ],
      'worldClimate.prevailingWinds': [
        'worldClimate.temperature',
        'waterBody.classification',
        'worldTerrain.mountainSystems',
      ],
      'worldClimate.moisture': [
        'waterBody.classification',
        'worldClimate.prevailingWinds',
        'worldTerrain.mountainSystems',
        'worldClimate.temperature',
      ],
      'worldClimate.zones': [
        'worldClimate.temperature',
        'worldClimate.moisture',
        'worldSurface.landWaterClassification',
      ],
      'worldEcology.biomeBelts': [
        'worldClimate.zones',
        'worldClimate.moisture',
        'worldClimate.temperature',
        'worldTerrain.macroElevation',
        'landmass.classification',
      ],
      'worldHydrology.watersheds': [
        'worldTerrain.macroElevation',
        'worldSurface.landWaterClassification',
        'worldTerrain.mountainSystems',
        'worldClimate.moisture',
      ],
      'worldHydrology.majorRivers': [
        'worldHydrology.watersheds',
        'waterBody.classification',
        'worldTerrain.macroElevation',
        'worldClimate.moisture',
      ],
      'worldHydrology.majorLakes': [
        'worldHydrology.watersheds',
        'worldTerrain.macroElevation',
        'worldSurface.landWaterClassification',
        'waterBody.classification',
        'worldHydrology.majorRivers',
      ],
    });
    expect(
      validateWorldPhysicalContextControls({
        mountainCharacter: 'rugged',
        climateCharacter: 'bad' as 'varied',
      }),
    ).toStrictEqual([
      {
        code: WORLD_PHYSICAL_CONTEXT_DIAGNOSTIC_CODES.invalidControls,
        message: 'climateCharacter must be temperate, varied, or extreme.',
      },
    ]);
  });

  it('derives physical aspect and feature identities from owners and canonical root signatures', () => {
    const signature = fingerprintWorldPhysicalRootSignature([PLANET_POINT, SECOND_PLANET_POINT]);
    expect(deriveWorldPhysicalContextAspectId(WORLD_SURFACE_ID, 'worldClimate.temperature')).toBe(
      deriveWorldPhysicalContextAspectId(WORLD_SURFACE_ID, 'worldClimate.temperature'),
    );
    expect(deriveWorldPhysicalFeatureEntityId(WORLD_MAP_ID, 'river', signature)).toBe(
      deriveWorldPhysicalFeatureEntityId(WORLD_MAP_ID, 'river', signature),
    );
    expect(deriveWorldPhysicalFeatureEntityId(WORLD_MAP_ID, 'river', signature)).not.toBe(
      deriveWorldPhysicalFeatureEntityId(
        WORLD_MAP_ID,
        'river',
        fingerprintWorldPhysicalRootSignature([SECOND_PLANET_POINT]),
      ),
    );
    expect(fingerprintWorldPhysicalRootSignature([SECOND_PLANET_POINT, PLANET_POINT])).toBe(
      signature,
    );
    expect(parseWorldPhysicalFieldFingerprint('A'.repeat(64))).toBeUndefined();
    expect(isCalmWindSpeed(WIND_SPEED)).toBe(true);
    expect(isCalmWindSpeed(requiredValue(createWindSpeedTicks(1)))).toBe(false);
  });

  it('accepts a frozen synthetic physical-context contract without generation or clipping', () => {
    expect(validateWorldPhysicalContextRecords(validRecords())).toStrictEqual({ ok: true });
  });

  it('requires canonical biome-belt identities derived from their biome key and root points', () => {
    const records = validRecords();
    const points = [PLANET_POINT, PLANET_POINT, PLANET_POINT];
    const summary = {
      entityId: deriveWorldPhysicalBiomeBeltEntityId(
        WORLD_MAP_ID,
        BIOME,
        fingerprintWorldPhysicalRootSignature(points),
      ),
      biomeKey: BIOME,
      geometryVersion: 1 as const,
      boundaryPoints: points,
    };
    const withSummary = {
      ...records,
      biomeBelts: { ...records.biomeBelts, beltSummaries: [summary] },
    };

    expect(validateWorldPhysicalContextRecords(withSummary)).toStrictEqual({ ok: true });
    expect(
      diagnosticCodes({
        ...withSummary,
        biomeBelts: {
          ...withSummary.biomeBelts,
          beltSummaries: [{ ...summary, entityId: RIVER_ID }],
        },
      }),
    ).toContain(WORLD_PHYSICAL_CONTEXT_DIAGNOSTIC_CODES.invalidGeometry);
  });

  it('returns stable diagnostics for invalid versions, readers, values, ordering, and references', () => {
    const records = validRecords();
    const invalidVersion = {
      ...records,
      temperature: {
        ...records.temperature,
        provenance: { ...records.temperature.provenance, contractVersion: 2 as 1 },
      },
    };
    const invalidReader = {
      ...records,
      temperature: {
        ...records.temperature,
        values: {
          length: ATLAS_FULL_SAMPLE_COUNT,
          at: () => TEMPERATURE,
          forEach: () => undefined,
        },
      },
    } as unknown as WorldPhysicalContextRecords;
    const invalidValue = {
      ...records,
      moisture: {
        ...records.moisture,
        values: createConstantWorldPhysicalFieldReader(
          ATLAS_FULL_SAMPLE_COUNT,
          -1 as typeof MOISTURE,
        ),
      },
    };
    const invalidOrdering = {
      ...records,
      mountainSystems: {
        ...records.mountainSystems,
        sourceAspectIds: [...records.mountainSystems.sourceAspectIds].reverse(),
      },
    };
    const invalidReference = {
      ...records,
      majorRivers: [
        {
          entityId: RIVER_ID,
          behaviorVersion: 1 as const,
          geometryVersion: 1 as const,
          watershedId: RIVER_ID,
          centerline: [PLANET_POINT, PLANET_POINT],
          sourceEntityId: RIVER_ID,
          joinsRiverIds: [],
          dischargeSamples: [DISCHARGE],
          widthSamples: [DISTANCE],
          boundaryPortalIds: [],
        },
      ],
    };

    expect(diagnosticCodes(invalidVersion)).toContain(
      WORLD_PHYSICAL_CONTEXT_DIAGNOSTIC_CODES.invalidVersion,
    );
    expect(diagnosticCodes(invalidReader)).toContain(
      WORLD_PHYSICAL_CONTEXT_DIAGNOSTIC_CODES.invalidFieldMetadata,
    );
    expect(diagnosticCodes(invalidValue)).toContain(
      WORLD_PHYSICAL_CONTEXT_DIAGNOSTIC_CODES.invalidFieldValue,
    );
    expect(diagnosticCodes(invalidOrdering)).toContain(
      WORLD_PHYSICAL_CONTEXT_DIAGNOSTIC_CODES.invalidOrdering,
    );
    expect(diagnosticCodes(invalidReference)).toContain(
      WORLD_PHYSICAL_CONTEXT_DIAGNOSTIC_CODES.invalidReference,
    );

    const invalidFingerprint = {
      ...records,
      temperature: {
        ...records.temperature,
        provenance: { ...records.temperature.provenance, fingerprint: INVALID_FINGERPRINT },
      },
    };
    const invalidOwner = {
      ...records,
      moisture: {
        ...records.moisture,
        provenance: {
          ...records.moisture.provenance,
          ownerAspectId: records.temperature.provenance.ownerAspectId,
        },
      },
    };
    const invalidSource = {
      ...records,
      temperature: {
        ...records.temperature,
        provenance: {
          ...records.temperature.provenance,
          sourceAspectIds: [
            'not-an-aspect-id',
          ] as unknown as typeof records.temperature.provenance.sourceAspectIds,
        },
      },
    };
    expect(diagnosticCodes(invalidFingerprint)).toContain(
      WORLD_PHYSICAL_CONTEXT_DIAGNOSTIC_CODES.invalidFieldMetadata,
    );
    expect(diagnosticCodes(invalidOwner)).toContain(
      WORLD_PHYSICAL_CONTEXT_DIAGNOSTIC_CODES.invalidFieldMetadata,
    );
    expect(diagnosticCodes(invalidSource)).toContain(
      WORLD_PHYSICAL_CONTEXT_DIAGNOSTIC_CODES.invalidFieldMetadata,
    );
  });
});

function validRecords(): WorldPhysicalContextRecords {
  const aspectId = (kind: WorldPhysicalContextAspectKind) =>
    deriveWorldPhysicalContextAspectId(WORLD_SURFACE_ID, kind);
  const sourceAspectIds = Object.freeze(
    [aspectId('worldClimate.moisture'), aspectId('worldTerrain.mountainSystems')].sort(),
  );
  const field = <Kind extends WorldPhysicalFieldKind, Value>(
    kind: Kind,
    ownerAspectId: ReturnType<typeof aspectId>,
    value: Value,
  ) => {
    const values = createConstantWorldPhysicalFieldReader(ATLAS_FULL_SAMPLE_COUNT, value);
    const provenanceWithoutFingerprint = {
      contractVersion: 1 as const,
      fieldKind: kind,
      ownerAspectId,
      sourceAspectIds,
      fieldBehaviorVersion: 1 as const,
      fieldEncodingVersion: 1 as const,
      valueEncoding: encodingFor(kind).valueEncoding,
      quantizationScale: encodingFor(kind).quantizationScale,
      samplingProfileId: 'world-atlas-full-v1' as const,
      samplingPolicyVersion: 1 as const,
      longitudeCellCount: 2_048 as const,
      latitudeBandCount: 1_024 as const,
      canonicalTraversal: 'south-pole-then-rows-then-north-pole' as const,
    } as const;
    return Object.freeze({
      provenance: Object.freeze({
        ...provenanceWithoutFingerprint,
        fingerprint: fingerprintWorldPhysicalField({
          provenance: provenanceWithoutFingerprint,
          minimumValue: value,
          maximumValue: value,
          values,
        }),
      }),
      minimumValue: value,
      maximumValue: value,
      values,
    });
  };
  const temperature = Object.freeze({
    ...field('temperature', aspectId('worldClimate.temperature'), TEMPERATURE),
    quantumCelsius: 0.1 as const,
  });
  const windDirection = field(
    'prevailing-winds-direction',
    aspectId('worldClimate.prevailingWinds'),
    NORMALIZED,
  );
  const windSpeed = field(
    'prevailing-winds-speed',
    aspectId('worldClimate.prevailingWinds'),
    WIND_SPEED,
  );
  const climate = Object.freeze({
    ...field('climate-zones', aspectId('worldClimate.zones'), CLIMATE_ZONE),
    classificationPolicyVersion: 1 as const,
    definitions: Object.freeze([
      Object.freeze({
        key: CLIMATE_ZONE,
        minimumTemperature: TEMPERATURE,
        maximumTemperature: TEMPERATURE,
        minimumMoisture: MOISTURE,
        maximumMoisture: MOISTURE,
      }),
    ]),
  });
  const biome = Object.freeze({
    ...field('biome-belts', aspectId('worldEcology.biomeBelts'), BIOME),
    classificationPolicyVersion: 1 as const,
    definitions: Object.freeze([
      Object.freeze({ key: BIOME, compatibleClimateZoneKeys: Object.freeze([CLIMATE_ZONE]) }),
    ]),
    beltSummaries: Object.freeze([]),
  });
  const watershed = Object.freeze({
    entityId: deriveWorldPhysicalFeatureEntityId(
      WORLD_MAP_ID,
      'watershed',
      fingerprintWorldPhysicalRootSignature([PLANET_POINT, SECOND_PLANET_POINT]),
    ),
    behaviorVersion: 1 as const,
    geometryVersion: 1 as const,
    divideLines: Object.freeze([Object.freeze([PLANET_POINT, SECOND_PLANET_POINT])]),
    boundaryPortalIds: Object.freeze([]),
  });

  return Object.freeze({
    worldMapId: WORLD_MAP_ID,
    worldSurfaceEntityId: WORLD_SURFACE_ID,
    controls: Object.freeze({ mountainCharacter: 'varied', climateCharacter: 'varied' }),
    mountainSystems: Object.freeze({
      ownerAspectId: aspectId('worldTerrain.mountainSystems'),
      sourceAspectIds,
      systems: Object.freeze([]),
    }),
    temperature,
    prevailingWinds: Object.freeze({
      xComponents: windDirection,
      yComponents: windDirection,
      zComponents: windDirection,
      speed: Object.freeze({ ...windSpeed, speedQuantumMetersPerSecond: 0.1 as const }),
      speedQuantumMetersPerSecond: 0.1 as const,
    }),
    moisture: Object.freeze({
      ...field('moisture', aspectId('worldClimate.moisture'), MOISTURE),
      influenceKinds: Object.freeze(['coastal', 'rain-shadow', 'windward'] as const),
    }),
    climateZones: climate,
    biomeBelts: biome,
    watersheds: Object.freeze({
      ...field('watershed-assignment', aspectId('worldHydrology.watersheds'), watershed.entityId),
      graphPolicyVersion: 1 as const,
      watersheds: Object.freeze([watershed]),
    }),
    majorRivers: Object.freeze([]),
    majorLakes: Object.freeze([]),
  });
}

function encodingFor(kind: WorldPhysicalFieldKind) {
  const encodings = {
    temperature: { valueEncoding: 'signed-integer-ticks', quantizationScale: 10 },
    'prevailing-winds-direction': {
      valueEncoding: 'normalized-integer-ticks',
      quantizationScale: 16_777_216,
    },
    'prevailing-winds-speed': { valueEncoding: 'unsigned-integer-ticks', quantizationScale: 10 },
    moisture: { valueEncoding: 'normalized-integer-ticks', quantizationScale: 16_777_216 },
    'climate-zones': { valueEncoding: 'semantic-key', quantizationScale: 1 },
    'biome-belts': { valueEncoding: 'semantic-key', quantizationScale: 1 },
    'watershed-assignment': { valueEncoding: 'entity-id', quantizationScale: 1 },
  } as const;
  return encodings[kind];
}

function diagnosticCodes(records: WorldPhysicalContextRecords): readonly string[] {
  const result = validateWorldPhysicalContextRecords(records);
  return result.ok ? [] : result.diagnostics.map((diagnostic) => diagnostic.code);
}

function required<Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false },
): Value {
  if (!result.ok) throw new Error('Test setup value is invalid.');
  return result.value;
}

function requiredValue<Value>(value: Value | undefined): Value {
  if (value === undefined) throw new Error('Test setup value is invalid.');
  return value;
}
