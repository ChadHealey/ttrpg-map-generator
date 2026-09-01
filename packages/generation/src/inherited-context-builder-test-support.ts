import {
  type AcceptedAspectRecord,
  type AspectId,
  ATLAS_FULL_SAMPLE_COUNT,
  type AtlasGeographyRecords,
  collectWorldFeatureNameSources,
  createBehaviorVersion,
  createConstantWorldPhysicalFieldReader,
  createParameterSchemaVersion,
  createRegionalFootprintTransform,
  createVariantRevision,
  createWorldFeatureNameProposals,
  DEFAULT_ATLAS_CONTROLS,
  DEFAULT_WORLD_PHYSICAL_CONTEXT_CONTROLS,
  DETERMINISTIC_STREAM_VERSION,
  type EntityId,
  type MacroElevationValueTicks,
  type MapEntitySeedInput,
  parseAspectName,
  parseGeneratorId,
  parseRegionalRectangleFootprint,
  parseSemanticKey,
  parseStableId,
  parseWorldSeed,
  type PlanetPoint,
  type QuantizedScalarField,
  type RegionalRectangleFootprint,
  SEED_DERIVATION_VERSION,
  type WorldFeatureNameContent,
  type WorldFeatureNameParameters,
  type WorldMap,
  type WorldPhysicalContextRecords,
  type WorldPhysicalFieldFingerprint,
  type WorldPhysicalFieldKind,
} from '@ttrpg-map/core';

import type { AcceptedBuildSource } from './inherited-context-source-assembly.js';

const MAP_ID = id('map', '00000000-0000-4000-8000-000000000101');
const ROOT_SURFACE_ID = id('root-surface', '00000000-0000-4000-8000-000000000102');
const WORLD_SURFACE_ID = entity('201');
const LANDMASS_ID = entity('202');
const ISLAND_GROUP_ID = entity('203');
const WATER_BODY_ID = entity('204');
const MOUNTAIN_ID = entity('205');
const WATERSHED_ID = entity('206');
const RIVER_ID = entity('207');
const LAKE_ID = entity('208');
const COASTLINE_OWNER_ID = entity('209');
const BIOME_ID = entity('20a');
const COASTLINE_RING_ID = id('coastline-ring', uuid('501'));
const WORLD_SEED = required(parseWorldSeed('1'));
const VERSION = required(createBehaviorVersion(1));
const PARAMETER_VERSION = required(createParameterSchemaVersion(1));
const REVISION = required(createVariantRevision(0));
const FINGERPRINT = 'a'.repeat(64) as WorldPhysicalFieldFingerprint;
const TEMPERATE = semantic('temperate');
const FOREST = semantic('temperate-forest');

const ASPECT_IDS = {
  macro: aspect('301'),
  landWater: aspect('302'),
  coastline: aspect('303'),
  biome: aspect('304'),
  climate: aspect('305'),
  moisture: aspect('306'),
  winds: aspect('307'),
  temperature: aspect('308'),
  watersheds: aspect('309'),
  mountains: aspect('30a'),
  rivers: aspect('30b'),
  lakes: aspect('30c'),
} as const;

export interface InheritedContextBuilderFixture {
  readonly footprint: RegionalRectangleFootprint;
  readonly source: AcceptedBuildSource;
}

export function inheritedContextBuilderFixture(
  origin: PlanetPoint,
): InheritedContextBuilderFixture {
  const footprint = required(
    parseRegionalRectangleFootprint({
      shapeVersion: 'regional-rectangle-v1',
      rootSurfaceId: ROOT_SURFACE_ID,
      worldRadius: { radiusMillimeters: 1_000_000_000 },
      origin,
      extent: {
        minXMillimeters: -1_000,
        maxXMillimeters: 1_000,
        minYMillimeters: -1_000,
        maxYMillimeters: 1_000,
      },
      transformId: 'planet-regional-azimuthal-equidistant',
      transformVersion: 1,
    }),
  );
  const transform = createRegionalFootprintTransform(footprint);
  const horizontal = [localRoot(transform, -3_000, 0), localRoot(transform, 3_000, 0)];
  const ring = [
    localRoot(transform, -3_000, -500),
    localRoot(transform, 3_000, -500),
    localRoot(transform, 3_000, 500),
    localRoot(transform, -3_000, 500),
  ];
  const rootMap = worldMap();
  const geography = geographyRecords(horizontal, ring);
  const physical = physicalRecords(horizontal, ring);
  return {
    footprint,
    source: {
      rootMap,
      worldSeed: WORLD_SEED,
      geography,
      physical,
      acceptedNameAspects: acceptedNames(geography, physical),
    },
  };
}

export function emptyWorldDocument(rootMap: WorldMap) {
  return {
    worldDocumentId: id('world-document', uuid('601')),
    displayName: 'Invalid atlas',
    worldSeed: WORLD_SEED,
    rootMapId: rootMap.mapId,
    maps: [{ ...rootMap, aspects: [] }],
  } as const;
}

export function withLabelPlacementDecoration(source: AcceptedBuildSource): AcceptedBuildSource {
  return {
    ...source,
    rootMap: {
      ...source.rootMap,
      aspects: [
        ...source.rootMap.aspects,
        acceptedAspect('label.placement', aspect('30f'), entity('20b')),
      ],
    },
  };
}

function worldMap(): WorldMap {
  const aspects = [
    acceptedAspect('worldTerrain.macroElevation', ASPECT_IDS.macro, WORLD_SURFACE_ID),
    acceptedAspect('worldSurface.landWaterClassification', ASPECT_IDS.landWater, WORLD_SURFACE_ID),
    acceptedAspect('worldCoastline.geometry', ASPECT_IDS.coastline, COASTLINE_OWNER_ID),
    acceptedAspect('worldEcology.biomeBelts', ASPECT_IDS.biome, WORLD_SURFACE_ID),
    acceptedAspect('worldClimate.zones', ASPECT_IDS.climate, WORLD_SURFACE_ID),
    acceptedAspect('worldClimate.moisture', ASPECT_IDS.moisture, WORLD_SURFACE_ID),
    acceptedAspect('worldClimate.prevailingWinds', ASPECT_IDS.winds, WORLD_SURFACE_ID),
    acceptedAspect('worldClimate.temperature', ASPECT_IDS.temperature, WORLD_SURFACE_ID),
    acceptedAspect('worldHydrology.watersheds', ASPECT_IDS.watersheds, WORLD_SURFACE_ID),
    acceptedAspect('worldTerrain.mountainSystems', ASPECT_IDS.mountains, WORLD_SURFACE_ID),
    acceptedAspect('worldHydrology.majorRivers', ASPECT_IDS.rivers, WORLD_SURFACE_ID),
    acceptedAspect('worldHydrology.majorLakes', ASPECT_IDS.lakes, WORLD_SURFACE_ID),
    acceptedAspect('landmass.classification', aspect('30d'), LANDMASS_ID),
    acceptedAspect('waterBody.classification', aspect('30e'), WATER_BODY_ID),
  ];
  return {
    mapId: MAP_ID,
    mapKind: 'world',
    scaleClass: 'world',
    displayName: 'Accepted world',
    coordinateSystem: {
      kind: 'planet-sphere',
      rootSurfaceId: ROOT_SURFACE_ID,
      radius: { radiusMillimeters: 1_000_000_000 } as never,
    },
    extent: { kind: 'whole-surface' },
    entities: [],
    aspects,
    constraints: [],
    locks: [],
    decoration: { aspectReferences: [] },
    layout: { aspectReferences: [] },
  };
}

function geographyRecords(
  horizontal: readonly PlanetPoint[],
  ring: readonly PlanetPoint[],
): AtlasGeographyRecords {
  const membership = {
    classificationVersion: 1 as const,
    fingerprint: FINGERPRINT,
    sampleCount: ATLAS_FULL_SAMPLE_COUNT,
    sphericalAreaWeight: 1,
    sampleRanges: [{ startIndex: 0, endIndexExclusive: ATLAS_FULL_SAMPLE_COUNT }],
  };
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
      values: createConstantWorldPhysicalFieldReader(
        ATLAS_FULL_SAMPLE_COUNT,
        100 as MacroElevationValueTicks,
      ),
    },
    landWaterClassification: {
      classificationBehaviorVersion: 1,
      seaLevelContourDoubledTicks: 1,
      samples: createConstantWorldPhysicalFieldReader(ATLAS_FULL_SAMPLE_COUNT, 'land') as never,
    },
    semanticClassificationVersion: 1,
    worldMapId: MAP_ID,
    worldSurfaceEntityId: WORLD_SURFACE_ID,
    landWaterClassificationAspectId: ASPECT_IDS.landWater,
    landmasses: [
      {
        entityId: LANDMASS_ID,
        sourceClassificationAspectId: ASPECT_IDS.landWater,
        componentId: id('surface-component', uuid('701')),
        membership,
        kind: 'continent',
        adjacentWaterBodyIds: [WATER_BODY_ID],
      },
    ],
    islandGroups: [
      { entityId: ISLAND_GROUP_ID, kind: 'archipelago', memberLandmassIds: [LANDMASS_ID] },
    ],
    waterBodies: [
      {
        entityId: WATER_BODY_ID,
        sourceClassificationAspectId: ASPECT_IDS.landWater,
        componentId: id('surface-component', uuid('702')),
        membership: { ...membership, sampleRanges: [] },
        kind: 'oceanBasin',
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
          ringId: COASTLINE_RING_ID,
          sourceBoundaryFingerprint: FINGERPRINT,
          landmassId: LANDMASS_ID,
          waterBodyIds: [WATER_BODY_ID],
          points: ring.length > 0 ? ring : horizontal,
        },
      ],
    },
  };
}

function physicalRecords(
  horizontal: readonly PlanetPoint[],
  ring: readonly PlanetPoint[],
): WorldPhysicalContextRecords {
  const temperature = field('temperature', ASPECT_IDS.temperature, 150);
  const direction = field('prevailing-winds-direction', ASPECT_IDS.winds, 1);
  const speed = field('prevailing-winds-speed', ASPECT_IDS.winds, 2);
  const moisture = field('moisture', ASPECT_IDS.moisture, 3);
  const climate = field('climate-zones', ASPECT_IDS.climate, TEMPERATE);
  const biome = field('biome-belts', ASPECT_IDS.biome, FOREST);
  const watersheds = field('watershed-assignment', ASPECT_IDS.watersheds, WATERSHED_ID);
  return {
    worldMapId: MAP_ID,
    worldSurfaceEntityId: WORLD_SURFACE_ID,
    controls: DEFAULT_WORLD_PHYSICAL_CONTEXT_CONTROLS,
    mountainSystems: {
      ownerAspectId: ASPECT_IDS.mountains,
      sourceAspectIds: [],
      systems: [
        {
          entityId: MOUNTAIN_ID,
          behaviorVersion: 1,
          geometryVersion: 1,
          centerlines: [horizontal],
          influenceWidth: { millimeters: 1_000 } as never,
          prominence: 10 as never,
          boundaryPortalIds: [],
        },
      ],
    },
    temperature: { ...temperature, quantumCelsius: 0.1 } as never,
    prevailingWinds: {
      xComponents: direction,
      yComponents: direction,
      zComponents: direction,
      speed,
      speedQuantumMetersPerSecond: 0.1,
    } as never,
    moisture: { ...moisture, influenceKinds: ['coastal'] } as never,
    climateZones: { ...climate, classificationPolicyVersion: 1, definitions: [] } as never,
    biomeBelts: {
      ...biome,
      classificationPolicyVersion: 1,
      definitions: [],
      beltSummaries: [
        { entityId: BIOME_ID, biomeKey: FOREST, geometryVersion: 1, boundaryPoints: ring },
      ],
    } as never,
    watersheds: {
      ...watersheds,
      graphPolicyVersion: 1,
      watersheds: [
        {
          entityId: WATERSHED_ID,
          behaviorVersion: 1,
          geometryVersion: 1,
          divideLines: [horizontal],
          boundaryPortalIds: [],
        },
      ],
    } as never,
    majorRivers: [
      {
        entityId: RIVER_ID,
        behaviorVersion: 1,
        geometryVersion: 1,
        watershedId: WATERSHED_ID,
        centerline: horizontal,
        sourceEntityId: MOUNTAIN_ID,
        joinsRiverIds: [],
        dischargeSamples: [1 as never],
        widthSamples: [{ millimeters: 1_000 } as never],
        boundaryPortalIds: [],
      },
    ],
    majorLakes: [
      {
        entityId: LAKE_ID,
        behaviorVersion: 1,
        geometryVersion: 1,
        watershedId: WATERSHED_ID,
        ring,
        depth: 1 as never,
        surfaceElevation: 1 as never,
        boundaryPortalIds: [],
      },
    ],
  };
}

function field<Kind extends WorldPhysicalFieldKind, Value>(
  fieldKind: Kind,
  ownerAspectId: AspectId,
  value: Value,
): QuantizedScalarField<Kind, Value> {
  return {
    provenance: {
      contractVersion: 1,
      fieldKind,
      ownerAspectId,
      sourceAspectIds: [],
      fieldBehaviorVersion: 1,
      fieldEncodingVersion: 1,
      valueEncoding: 'signed-integer-ticks',
      quantizationScale: 1,
      samplingProfileId: 'world-atlas-full-v1',
      samplingPolicyVersion: 1,
      longitudeCellCount: 2_048,
      latitudeBandCount: 1_024,
      canonicalTraversal: 'south-pole-then-rows-then-north-pole',
      fingerprint: FINGERPRINT,
    },
    minimumValue: value,
    maximumValue: value,
    values: createConstantWorldPhysicalFieldReader(ATLAS_FULL_SAMPLE_COUNT, value),
  };
}

function acceptedNames(geography: AtlasGeographyRecords, physical: WorldPhysicalContextRecords) {
  const generated = createWorldFeatureNameProposals({
    mapId: MAP_ID,
    worldSeed: WORLD_SEED,
    sources: collectWorldFeatureNameSources(geography, physical),
  });
  if (!generated.ok) throw new Error('Name fixture generation failed.');
  return generated.proposals.map(
    (proposal): AcceptedAspectRecord<WorldFeatureNameParameters, WorldFeatureNameContent> => ({
      mapId: proposal.target.mapId,
      entityId: proposal.target.entityId,
      aspectId: proposal.target.aspect.aspectId,
      aspectName: proposal.target.aspectName,
      generatorId: proposal.generatorId,
      generatorVersion: proposal.generatorVersion,
      parameterSchemaVersion: proposal.parameterSchemaVersion,
      parameters: proposal.parameters,
      seedScope: proposal.seedScope,
      seedMetadata: proposal.seedMetadata,
      variantRevision: proposal.target.variantRevision,
      dependencyAspects: proposal.dependencyAspects,
      generationStatus: 'accepted',
      diagnostics: proposal.diagnostics,
      acceptedOutput: proposal.output,
    }),
  );
}

function acceptedAspect(
  name: string,
  aspectId: AspectId,
  entityId: EntityId,
): AcceptedAspectRecord {
  const aspectName = required(parseAspectName(name));
  const generatorId = required(parseGeneratorId(name));
  const seedMetadata: MapEntitySeedInput = {
    seedDerivationVersion: SEED_DERIVATION_VERSION,
    deterministicStreamVersion: DETERMINISTIC_STREAM_VERSION,
    seedScope: 'map/entity',
    worldSeed: WORLD_SEED,
    mapId: MAP_ID,
    entityId,
    generatorId,
    generatorVersion: VERSION,
    aspectName,
    variantRevision: REVISION,
  };
  return {
    mapId: MAP_ID,
    entityId,
    aspectId,
    aspectName,
    generatorId,
    generatorVersion: VERSION,
    parameterSchemaVersion: PARAMETER_VERSION,
    parameters: {},
    seedScope: 'map/entity',
    seedMetadata,
    variantRevision: REVISION,
    dependencyAspects: [],
    generationStatus: 'accepted',
    diagnostics: [],
    acceptedOutput: null,
  };
}

function localRoot(
  transform: ReturnType<typeof createRegionalFootprintTransform>,
  xMillimeters: number,
  yMillimeters: number,
) {
  return required(transform.inverse({ xMillimeters, yMillimeters } as never));
}

function aspect(suffix: string) {
  return id('aspect', uuid(suffix));
}

function entity(suffix: string) {
  return id('entity', uuid(suffix));
}

function semantic(value: string) {
  return required(parseSemanticKey(value));
}

function uuid(suffix: string) {
  return `00000000-0000-4000-8000-${suffix.padStart(12, '0')}`;
}

function id<Kind extends Parameters<typeof parseStableId>[0]>(kind: Kind, value: string) {
  return required(parseStableId(kind, value));
}

function required<Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false },
): Value {
  if (!result.ok) throw new Error('Invalid test fixture value.');
  return result.value;
}
