import { describe, expect, it } from 'vitest';

import {
  createBehaviorVersion,
  createParameterSchemaVersion,
  createVariantRevision,
} from './compatibility.js';
import {
  COORDINATE_TRANSFORM_VERSION,
  PLANET_REGIONAL_TRANSFORM_ID,
} from './coordinate-transforms.js';
import { createPlanetPoint, createRegionalExtent, createWorldRadius } from './coordinates.js';
import {
  type AcceptedAspectRecord,
  type AspectReference,
  parseAspectName,
} from './generated-aspects.js';
import {
  type AspectId,
  type EntityId,
  type MapId,
  parseGeneratorId,
  parseStableId,
  type StableIdByKind,
  type StableIdKind,
} from './identity.js';
import { parseSeedInput, parseWorldSeed } from './seed-input.js';
import {
  CONSTRAINT_KINDS,
  MAP_COORDINATE_SYSTEM_KINDS,
  MAP_KINDS,
  MAP_RELATIONSHIP_KINDS,
  MAP_SCALE_CLASSES,
  type MapDocument,
  type MapEntity,
  type RegionalMap,
  WORLD_MAP_EXTENT_KIND,
  type WorldDocument,
  type WorldMap,
} from './world-document.js';
import {
  getCanonicalOwnershipTraversal,
  OWNERSHIP_DIAGNOSTIC_CODES,
  type OwnershipDiagnosticCode,
  type OwnershipTraversalNode,
  validateWorldDocumentOwnership,
} from './world-document-ownership.js';

const WORLD_DOCUMENT_ID = id('world-document', '29646d87-2997-44f8-8b6d-7153f93e6e99');
const WORLD_MAP_ID = id('map', 'a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7');
const SECOND_WORLD_MAP_ID = id('map', 'b7f99996-09e8-4f5f-bf5f-80b6bb38bdb7');
const REGION_A_ID = id('map', '16f99996-09e8-4f5f-bf5f-80b6bb38bdb7');
const REGION_B_ID = id('map', '27f99996-09e8-4f5f-bf5f-80b6bb38bdb7');
const MISSING_MAP_ID = id('map', 'f8f99996-09e8-4f5f-bf5f-80b6bb38bdb7');
const ENTITY_A_ID = id('entity', '36f4a17b-dfaf-4dce-9904-9a900d300da4');
const ENTITY_B_ID = id('entity', 'c6f4a17b-dfaf-4dce-9904-9a900d300da4');
const ASPECT_A_ID = id('aspect', '54b92092-3d5f-4bca-a12c-353185de1557');
const ASPECT_B_ID = id('aspect', '42928679-db9b-4de2-a8d4-0baecd709cc9');
const CONSTRAINT_ID = id('constraint', 'ac35a7ae-3f2c-4433-9351-e23d52c65870');
const LOCK_ID = id('lock', '1562f399-119d-4702-aafd-66349098c85f');
const ROOT_SURFACE_ID = id('root-surface', '41c0988c-d65f-4dab-a064-fc8a8755eaec');
const WORLD_SEED = parsed(parseWorldSeed('81985529216486895'));
const RADIUS = parsed(createWorldRadius(1_000));
const REGION_ORIGIN = parsed(createPlanetPoint(0, 0));
const REGION_EXTENT = parsed(createRegionalExtent(-10_000, 10_000, -20_000, 20_000));
const GENERATOR_ID = parsed(parseGeneratorId('proof.outline'));
const ASPECT_NAME = parsed(parseAspectName('proof.outline'));
const GENERATOR_VERSION = parsed(createBehaviorVersion(1));
const PARAMETER_SCHEMA_VERSION = parsed(createParameterSchemaVersion(1));
const REVISION = parsed(createVariantRevision(0));

describe('world-document ownership', () => {
  it('accepts one physical world root with zero or more physical regional children', () => {
    const root = worldMap();
    const region = regionalMap(REGION_A_ID);
    const document = worldDocument([region, root]);

    expect(validateWorldDocumentOwnership(document)).toStrictEqual([]);
    expect(root.coordinateSystem).toStrictEqual({
      kind: MAP_COORDINATE_SYSTEM_KINDS.planetSphere,
      rootSurfaceId: ROOT_SURFACE_ID,
      radius: RADIUS,
    });
    expect(root.extent).toStrictEqual({ kind: WORLD_MAP_EXTENT_KIND });
    expect(region.parent).toStrictEqual({
      parentMapId: WORLD_MAP_ID,
      rootMapId: WORLD_MAP_ID,
      relationshipKind: MAP_RELATIONSHIP_KINDS.worldToRegional,
    });
    expect(region.coordinateSystem).toMatchObject({
      kind: MAP_COORDINATE_SYSTEM_KINDS.regionalAzimuthalEquidistant,
      rootSurfaceId: ROOT_SURFACE_ID,
      transformId: PLANET_REGIONAL_TRANSFORM_ID,
      transformVersion: COORDINATE_TRANSFORM_VERSION,
      origin: REGION_ORIGIN,
      radius: RADIUS,
    });
    expect(region.extent).toBe(REGION_EXTENT);
  });

  it('keeps canonical traversal stable across display renames and collection reordering', () => {
    const outline = aspect(ASPECT_A_ID, WORLD_MAP_ID, ENTITY_A_ID);
    const markers = aspect(ASPECT_B_ID, WORLD_MAP_ID, ENTITY_B_ID, [{ aspectId: ASPECT_A_ID }]);
    const markerEntity: MapEntity = { entityId: ENTITY_B_ID, displayName: 'Markers' };
    const outlineEntity: MapEntity = { entityId: ENTITY_A_ID, displayName: 'Outline' };
    const entities: readonly MapEntity[] = [markerEntity, outlineEntity];
    const baselineRoot = worldMap({
      entities,
      aspects: [outline, markers],
      constraints: [
        {
          constraintId: CONSTRAINT_ID,
          constraintKind: CONSTRAINT_KINDS.proofKeepWithinExtent,
          target: { aspectId: ASPECT_A_ID },
          parameters: {},
        },
      ],
      locks: [{ lockId: LOCK_ID, target: { aspectId: ASPECT_A_ID } }],
      decoration: { aspectReferences: [{ aspectId: ASPECT_B_ID }] },
      layout: { aspectReferences: [{ aspectId: ASPECT_A_ID }] },
    });
    const baseline = worldDocument([
      regionalMap(REGION_B_ID),
      baselineRoot,
      regionalMap(REGION_A_ID),
    ]);
    const renamedAndReordered = worldDocument(
      [
        regionalMap(REGION_A_ID, { displayName: 'Renamed A' }),
        regionalMap(REGION_B_ID, { displayName: 'Renamed B' }),
        worldMap({
          ...baselineRoot,
          displayName: 'Renamed root',
          entities: [
            { ...outlineEntity, displayName: 'Renamed outline' },
            { ...markerEntity, displayName: 'Renamed markers' },
          ],
          aspects: [markers, outline],
        }),
      ],
      'Renamed document',
    );

    const baselineTraversal = getCanonicalOwnershipTraversal(baseline);
    const reorderedTraversal = getCanonicalOwnershipTraversal(renamedAndReordered);
    expect(baselineTraversal).toStrictEqual(reorderedTraversal);
    expect(baselineTraversal.ok).toBe(true);
    if (!baselineTraversal.ok) return;
    expect(baselineTraversal.nodes.map(nodeKey)).toStrictEqual([
      `world-document:${WORLD_DOCUMENT_ID}`,
      `world-map:${WORLD_MAP_ID}`,
      `entity:${ENTITY_A_ID}`,
      `aspect:${ASPECT_A_ID}`,
      `entity:${ENTITY_B_ID}`,
      `aspect:${ASPECT_B_ID}`,
      `constraint:${CONSTRAINT_ID}`,
      `lock:${LOCK_ID}`,
      `regional-map:${REGION_A_ID}`,
      `regional-map:${REGION_B_ID}`,
    ]);
  });

  it('does not reinterpret aspect dependencies as ownership', () => {
    const rootWithoutDependency = worldMap({
      entities: [
        { entityId: ENTITY_A_ID, displayName: 'A' },
        { entityId: ENTITY_B_ID, displayName: 'B' },
      ],
      aspects: [
        aspect(ASPECT_A_ID, WORLD_MAP_ID, ENTITY_A_ID),
        aspect(ASPECT_B_ID, WORLD_MAP_ID, ENTITY_B_ID),
      ],
    });
    const withoutDependency = worldDocument([rootWithoutDependency]);
    const withCrossEntityDependency = worldDocument([
      worldMap({
        ...rootWithoutDependency,
        aspects: [
          aspect(ASPECT_A_ID, WORLD_MAP_ID, ENTITY_A_ID),
          aspect(ASPECT_B_ID, WORLD_MAP_ID, ENTITY_B_ID, [{ aspectId: ASPECT_A_ID }]),
        ],
      }),
    ]);

    expect(getCanonicalOwnershipTraversal(withCrossEntityDependency)).toStrictEqual(
      getCanonicalOwnershipTraversal(withoutDependency),
    );
  });

  it('rejects missing and multiple roots with stable diagnostic codes', () => {
    expect(codes(worldDocument([]))).toContain(OWNERSHIP_DIAGNOSTIC_CODES.missingRoot);

    const secondRoot = worldMap({ mapId: SECOND_WORLD_MAP_ID });
    expect(codes(worldDocument([worldMap(), secondRoot]))).toContain(
      OWNERSHIP_DIAGNOSTIC_CODES.multipleRoots,
    );

    const duplicateRootCodes = codes(
      worldDocument([worldMap(), { ...worldMap() }, regionalMap(REGION_A_ID)]),
    );
    expect(duplicateRootCodes).toContain(OWNERSHIP_DIAGNOSTIC_CODES.duplicateOwnership);
    expect(duplicateRootCodes).not.toContain(OWNERSHIP_DIAGNOSTIC_CODES.missingParent);
  });

  it('rejects duplicate map, entity, and aspect ownership', () => {
    const sharedEntity = { entityId: ENTITY_A_ID, displayName: 'Shared' };
    const root = worldMap({
      entities: [sharedEntity],
      aspects: [aspect(ASPECT_A_ID, WORLD_MAP_ID, ENTITY_A_ID)],
    });
    const duplicateRegion = regionalMap(REGION_A_ID, {
      entities: [sharedEntity],
      aspects: [aspect(ASPECT_A_ID, REGION_A_ID, ENTITY_A_ID)],
    });
    const document = worldDocument([root, duplicateRegion, { ...duplicateRegion }]);
    const diagnostics = validateWorldDocumentOwnership(document).filter(
      (diagnostic) => diagnostic.code === OWNERSHIP_DIAGNOSTIC_CODES.duplicateOwnership,
    );

    expect(diagnostics.map((diagnostic) => diagnostic.recordKind)).toStrictEqual([
      'aspect',
      'entity',
      'map',
    ]);
  });

  it('rejects missing parents, mismatched aspect owners, and invalid regional references', () => {
    const badRegion = regionalMap(REGION_A_ID, {
      parent: {
        parentMapId: MISSING_MAP_ID,
        rootMapId: REGION_B_ID,
        relationshipKind: MAP_RELATIONSHIP_KINDS.worldToRegional,
      },
      entities: [{ entityId: ENTITY_A_ID, displayName: 'Owned here' }],
      aspects: [aspect(ASPECT_A_ID, WORLD_MAP_ID, ENTITY_A_ID)],
    });

    expect(codes(worldDocument([worldMap(), badRegion]))).toEqual(
      expect.arrayContaining([
        OWNERSHIP_DIAGNOSTIC_CODES.missingParent,
        OWNERSHIP_DIAGNOSTIC_CODES.ownerMismatch,
        OWNERSHIP_DIAGNOSTIC_CODES.rootReferenceMismatch,
        OWNERSHIP_DIAGNOSTIC_CODES.unsupportedRelationship,
      ]),
    );
  });

  it('rejects ownership cycles independently of invalid future relationships', () => {
    const regionA = regionalMap(REGION_A_ID, {
      parent: {
        parentMapId: REGION_B_ID,
        rootMapId: WORLD_MAP_ID,
        relationshipKind: MAP_RELATIONSHIP_KINDS.worldToRegional,
      },
    });
    const regionB = regionalMap(REGION_B_ID, {
      parent: {
        parentMapId: REGION_A_ID,
        rootMapId: WORLD_MAP_ID,
        relationshipKind: MAP_RELATIONSHIP_KINDS.worldToRegional,
      },
    });
    const document = worldDocument([regionB, worldMap(), regionA]);
    const reversed = worldDocument([regionA, worldMap(), regionB]);

    expect(validateWorldDocumentOwnership(document)).toStrictEqual(
      validateWorldDocumentOwnership(reversed),
    );
    expect(codes(document)).toContain(OWNERSHIP_DIAGNOSTIC_CODES.ownershipCycle);
    expect(getCanonicalOwnershipTraversal(document)).toMatchObject({ ok: false });
  });

  it('rejects unsupported future map and relationship kinds instead of accepting them', () => {
    const futureMap = {
      ...regionalMap(REGION_A_ID),
      mapKind: 'settlement',
    } as unknown as MapDocument;
    const futureRelationship = {
      ...regionalMap(REGION_B_ID),
      parent: {
        parentMapId: WORLD_MAP_ID,
        rootMapId: WORLD_MAP_ID,
        relationshipKind: 'regional-to-settlement',
      },
    } as unknown as RegionalMap;
    const diagnosticCodes = codes(worldDocument([worldMap(), futureMap, futureRelationship]));

    expect(diagnosticCodes).toEqual(
      expect.arrayContaining([
        OWNERSHIP_DIAGNOSTIC_CODES.unsupportedMapKind,
        OWNERSHIP_DIAGNOSTIC_CODES.unsupportedRelationship,
      ]),
    );
  });
});

function worldDocument(maps: readonly MapDocument[], displayName = 'Proof world'): WorldDocument {
  return Object.freeze({
    worldDocumentId: WORLD_DOCUMENT_ID,
    displayName,
    worldSeed: WORLD_SEED,
    rootMapId: WORLD_MAP_ID,
    maps: Object.freeze(maps),
  });
}

function worldMap(overrides: Partial<WorldMap> = {}): WorldMap {
  return Object.freeze({
    mapId: WORLD_MAP_ID,
    mapKind: MAP_KINDS.world,
    scaleClass: MAP_SCALE_CLASSES.world,
    displayName: 'Proof root',
    coordinateSystem: {
      kind: MAP_COORDINATE_SYSTEM_KINDS.planetSphere,
      rootSurfaceId: ROOT_SURFACE_ID,
      radius: RADIUS,
    },
    extent: { kind: WORLD_MAP_EXTENT_KIND },
    entities: [],
    aspects: [],
    constraints: [],
    locks: [],
    decoration: { aspectReferences: [] },
    layout: { aspectReferences: [] },
    ...overrides,
  });
}

function regionalMap(mapId: MapId, overrides: Partial<RegionalMap> = {}): RegionalMap {
  const baseline: RegionalMap = {
    mapId,
    mapKind: MAP_KINDS.regional,
    scaleClass: MAP_SCALE_CLASSES.regional,
    displayName: `Region ${mapId}`,
    parent: {
      parentMapId: WORLD_MAP_ID,
      rootMapId: WORLD_MAP_ID,
      relationshipKind: MAP_RELATIONSHIP_KINDS.worldToRegional,
    },
    coordinateSystem: {
      kind: MAP_COORDINATE_SYSTEM_KINDS.regionalAzimuthalEquidistant,
      rootSurfaceId: ROOT_SURFACE_ID,
      transformId: PLANET_REGIONAL_TRANSFORM_ID,
      transformVersion: COORDINATE_TRANSFORM_VERSION,
      origin: REGION_ORIGIN,
      radius: RADIUS,
    },
    extent: REGION_EXTENT,
    entities: [],
    aspects: [],
    constraints: [],
    locks: [],
    decoration: { aspectReferences: [] },
    layout: { aspectReferences: [] },
  };
  return Object.freeze({ ...baseline, ...overrides });
}

function aspect(
  aspectId: AspectId,
  mapId: MapId,
  entityId: EntityId,
  dependencyAspects: readonly AspectReference[] = [],
): AcceptedAspectRecord {
  const seedMetadata = parsed(
    parseSeedInput({
      seedDerivationVersion: 1,
      deterministicStreamVersion: 1,
      seedScope: 'map/entity',
      worldSeed: '81985529216486895',
      generatorId: GENERATOR_ID,
      generatorVersion: GENERATOR_VERSION,
      aspectName: ASPECT_NAME,
      variantRevision: REVISION,
      mapId,
      entityId,
    }),
  );
  return Object.freeze({
    mapId,
    entityId,
    aspectId,
    aspectName: ASPECT_NAME,
    generatorId: GENERATOR_ID,
    generatorVersion: GENERATOR_VERSION,
    parameterSchemaVersion: PARAMETER_SCHEMA_VERSION,
    parameters: {},
    seedScope: seedMetadata.seedScope,
    seedMetadata,
    variantRevision: REVISION,
    dependencyAspects: Object.freeze(dependencyAspects),
    generationStatus: 'accepted',
    diagnostics: [],
    acceptedOutput: {},
  });
}

function codes(document: WorldDocument): readonly OwnershipDiagnosticCode[] {
  return validateWorldDocumentOwnership(document).map((diagnostic) => diagnostic.code);
}

function nodeKey(node: OwnershipTraversalNode): string {
  switch (node.kind) {
    case 'world-document':
      return `world-document:${node.worldDocumentId}`;
    case 'world-map':
      return `world-map:${node.mapId}`;
    case 'regional-map':
      return `regional-map:${node.mapId}`;
    case 'entity':
      return `entity:${node.entityId}`;
    case 'aspect':
      return `aspect:${node.aspectId}`;
    case 'constraint':
      return `constraint:${node.constraintId}`;
    case 'lock':
      return `lock:${node.lockId}`;
  }
}

function id<Kind extends StableIdKind>(kind: Kind, value: string): StableIdByKind[Kind] {
  return parsed(parseStableId(kind, value));
}

function parsed<Value>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly diagnostic: { readonly message: string } },
): Value {
  if (!result.ok) throw new Error(result.diagnostic.message);
  return result.value;
}
