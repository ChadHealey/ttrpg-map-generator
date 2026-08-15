import {
  type AcceptedAspectRecord,
  type AspectId,
  type AspectName,
  createBehaviorVersion,
  createParameterSchemaVersion,
  createPlanetPoint,
  createRegionalExtent,
  createVariantRevision,
  createWorldRadius,
  type EntityId,
  type GeneratorId,
  MAP_COORDINATE_SYSTEM_KINDS,
  MAP_KINDS,
  MAP_RELATIONSHIP_KINDS,
  MAP_SCALE_CLASSES,
  type MapId,
  parseAspectName,
  parseGeneratorId,
  parseSeedInput,
  parseStableId,
  type VariantRevision,
  WORLD_MAP_EXTENT_KIND,
  type WorldDocument,
} from '@ttrpg-map/core';

const WORLD_DOCUMENT_ID = parsed(
  parseStableId('world-document', '29646d87-2997-44f8-8b6d-7153f93e6e99'),
);
const WORLD_MAP_ID = parsed(parseStableId('map', 'a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7'));
const PROOF_ENTITY_ID = parsed(parseStableId('entity', 'c6f4a17b-dfaf-4dce-9904-9a900d300da4'));
const ROOT_SURFACE_ID = parsed(
  parseStableId('root-surface', '41c0988c-d65f-4dab-a064-fc8a8755eaec'),
);
const GENERATOR_VERSION = parsed(createBehaviorVersion(1));
const PARAMETER_SCHEMA_VERSION = parsed(createParameterSchemaVersion(1));
const WORLD_RADIUS = parsed(createWorldRadius(1_000));

export function createWorldWithRegionalMap(): WorldDocument {
  const regionalMapId = parsed(parseStableId('map', 'b6f99996-09e8-4f5f-bf5f-80b6bb38bdb7'));
  const regionalEntityId = parsed(parseStableId('entity', 'd6f4a17b-dfaf-4dce-9904-9a900d300da4'));
  const sourceAspectId = parsed(parseStableId('aspect', '00000000-0000-4000-8000-000000000011'));
  const contextAspectId = parsed(parseStableId('aspect', '00000000-0000-4000-8000-000000000012'));
  const revision = parsed(createVariantRevision(0));
  const source = genericAspect(
    WORLD_MAP_ID,
    PROOF_ENTITY_ID,
    sourceAspectId,
    parsed(parseAspectName('regional.source')),
    parsed(parseGeneratorId('regional.source')),
    revision,
    [],
    { stableValue: 'accepted-source' },
  );
  const context = genericAspect(
    regionalMapId,
    regionalEntityId,
    contextAspectId,
    parsed(parseAspectName('regional.contextStatus')),
    parsed(parseGeneratorId('regional.context-status')),
    revision,
    [
      {
        aspectId: sourceAspectId,
        contextProvenance: {
          kind: 'inherited-context',
          parentMapId: WORLD_MAP_ID,
          childMapId: regionalMapId,
        },
      },
    ],
    { status: 'current' },
  );
  return {
    worldDocumentId: WORLD_DOCUMENT_ID,
    displayName: 'World with regional child',
    worldSeed: source.seedMetadata.worldSeed,
    rootMapId: WORLD_MAP_ID,
    maps: [
      {
        mapId: regionalMapId,
        mapKind: MAP_KINDS.regional,
        scaleClass: MAP_SCALE_CLASSES.regional,
        displayName: 'Regional child',
        parent: {
          parentMapId: WORLD_MAP_ID,
          rootMapId: WORLD_MAP_ID,
          relationshipKind: MAP_RELATIONSHIP_KINDS.worldToRegional,
          contextStatusAspectId: contextAspectId,
        },
        coordinateSystem: {
          kind: MAP_COORDINATE_SYSTEM_KINDS.regionalAzimuthalEquidistant,
          rootSurfaceId: ROOT_SURFACE_ID,
          transformId: 'planet-regional-azimuthal-equidistant',
          transformVersion: 1,
          origin: parsed(createPlanetPoint(0, 0)),
          radius: WORLD_RADIUS,
        },
        extent: parsed(createRegionalExtent(-10_000, 10_000, -10_000, 10_000)),
        entities: [{ entityId: regionalEntityId, displayName: 'Regional context entity' }],
        aspects: [context],
        constraints: [],
        locks: [],
        decoration: { aspectReferences: [] },
        layout: { aspectReferences: [] },
      },
      {
        mapId: WORLD_MAP_ID,
        mapKind: MAP_KINDS.world,
        scaleClass: MAP_SCALE_CLASSES.world,
        displayName: 'World root',
        coordinateSystem: {
          kind: MAP_COORDINATE_SYSTEM_KINDS.planetSphere,
          rootSurfaceId: ROOT_SURFACE_ID,
          radius: WORLD_RADIUS,
        },
        extent: { kind: WORLD_MAP_EXTENT_KIND },
        entities: [{ entityId: PROOF_ENTITY_ID, displayName: 'Source entity' }],
        aspects: [source],
        constraints: [],
        locks: [],
        decoration: { aspectReferences: [] },
        layout: { aspectReferences: [] },
      },
    ],
  };
}

export function createWorldWithGenericPayload(
  parameters: unknown,
  acceptedOutput: unknown,
): WorldDocument {
  const document = createWorldWithRegionalMap();
  return {
    ...document,
    maps: document.maps.map((map) => ({
      ...map,
      aspects: map.aspects.map((aspect) =>
        aspect.aspectName === 'regional.source'
          ? { ...aspect, parameters, acceptedOutput }
          : aspect,
      ),
    })),
  };
}

function genericAspect(
  mapId: MapId,
  entityId: EntityId,
  aspectId: AspectId,
  aspectName: AspectName,
  generatorId: GeneratorId,
  revision: VariantRevision,
  dependencyAspects: AcceptedAspectRecord['dependencyAspects'],
  acceptedOutput: Readonly<Record<string, string>>,
): AcceptedAspectRecord {
  const seedMetadata = parsed(
    parseSeedInput({
      seedDerivationVersion: 1,
      deterministicStreamVersion: 1,
      seedScope: 'map/entity',
      worldSeed: '81985529216486895',
      generatorId,
      generatorVersion: GENERATOR_VERSION,
      aspectName,
      variantRevision: revision,
      mapId,
      entityId,
    }),
  );
  return {
    mapId,
    entityId,
    aspectId,
    aspectName,
    generatorId,
    generatorVersion: GENERATOR_VERSION,
    parameterSchemaVersion: PARAMETER_SCHEMA_VERSION,
    parameters: {},
    seedScope: seedMetadata.seedScope,
    seedMetadata,
    variantRevision: revision,
    dependencyAspects,
    generationStatus: 'accepted',
    diagnostics: [],
    acceptedOutput,
  };
}

function parsed<Value>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly diagnostic: unknown },
): Value {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostic));
  return result.value;
}
