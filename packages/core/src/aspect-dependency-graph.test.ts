import { describe, expect, it } from 'vitest';

import {
  createAspectDependencyGraph,
  getCanonicalAspectDependencyTraversal,
  validateAspectDependencyGraph,
} from './aspect-dependency-graph.js';
import {
  ASPECT_DEPENDENCY_DIAGNOSTIC_CODES,
  ASPECT_INVALIDATION_EFFECTS,
} from './aspect-dependency-model.js';
import {
  getDirectAspectInvalidation,
  getTransitiveAspectInvalidation,
} from './aspect-invalidation.js';
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
  ASPECT_DEPENDENCY_PROVENANCE_KINDS,
  type AspectDependencyReference,
  parseAspectName,
} from './generated-aspects.js';
import {
  type AspectId,
  type EntityId,
  type LockId,
  type MapId,
  parseGeneratorId,
  parseStableId,
  type StableIdByKind,
  type StableIdKind,
} from './identity.js';
import { parseSeedInput, parseWorldSeed } from './seed-input.js';
import {
  MAP_COORDINATE_SYSTEM_KINDS,
  MAP_KINDS,
  MAP_RELATIONSHIP_KINDS,
  MAP_SCALE_CLASSES,
  type MapDocument,
  type RegionalMap,
  WORLD_MAP_EXTENT_KIND,
  type WorldDocument,
  type WorldMap,
} from './world-document.js';
import {
  getCanonicalOwnershipTraversal,
  validateWorldDocumentOwnership,
} from './world-document-ownership.js';

const WORLD_DOCUMENT_ID = id('world-document', '00000000-0000-4000-8000-000000000001');
const WORLD_MAP_ID = id('map', '00000000-0000-4000-8000-000000000001');
const REGIONAL_MAP_ID = id('map', '00000000-0000-4000-8000-000000000002');
const WORLD_ENTITY_ID = id('entity', '00000000-0000-4000-8000-000000000001');
const REGIONAL_ENTITY_ID = id('entity', '00000000-0000-4000-8000-000000000002');
const ASPECT_A_ID = id('aspect', '00000000-0000-4000-8000-000000000001');
const ASPECT_B_ID = id('aspect', '00000000-0000-4000-8000-000000000002');
const ASPECT_C_ID = id('aspect', '00000000-0000-4000-8000-000000000003');
const ASPECT_D_ID = id('aspect', '00000000-0000-4000-8000-000000000004');
const ASPECT_E_ID = id('aspect', '00000000-0000-4000-8000-000000000005');
const MISSING_ASPECT_ID = id('aspect', '00000000-0000-4000-8000-000000000099');
const LOCK_A_ID = id('lock', '00000000-0000-4000-8000-000000000001');
const LOCK_B_ID = id('lock', '00000000-0000-4000-8000-000000000002');
const ROOT_SURFACE_ID = id('root-surface', '00000000-0000-4000-8000-000000000001');
const WORLD_SEED = parsed(parseWorldSeed('81985529216486895'));
const WORLD_RADIUS = parsed(createWorldRadius(1_000));
const REGION_ORIGIN = parsed(createPlanetPoint(0, 0));
const REGION_EXTENT = parsed(createRegionalExtent(-10_000, 10_000, -10_000, 10_000));
const GENERATOR_ID = parsed(parseGeneratorId('proof.outline'));
const ASPECT_NAME = parsed(parseAspectName('proof.outline'));
const GENERATOR_VERSION = parsed(createBehaviorVersion(1));
const PARAMETER_SCHEMA_VERSION = parsed(createParameterSchemaVersion(1));
const REVISION = parsed(createVariantRevision(0));

describe('aspect dependency graph', () => {
  it('keeps stable-ID dependencies structurally separate from ownership', () => {
    const upstream = aspect(ASPECT_A_ID, WORLD_MAP_ID, WORLD_ENTITY_ID);
    const dependent = aspect(ASPECT_B_ID, WORLD_MAP_ID, WORLD_ENTITY_ID, [reference(ASPECT_A_ID)]);
    const withoutDependency = document([
      worldMap({ aspects: [upstream, { ...dependent, dependencyAspects: [] }] }),
    ]);
    const withDependency = document([worldMap({ aspects: [dependent, upstream] })]);

    expect(validateWorldDocumentOwnership(withDependency)).toStrictEqual([]);
    expect(getCanonicalOwnershipTraversal(withDependency)).toStrictEqual(
      getCanonicalOwnershipTraversal(withoutDependency),
    );

    const graph = validGraph(withDependency);
    expect(graph).toStrictEqual({
      nodes: [
        { aspectId: ASPECT_A_ID, mapId: WORLD_MAP_ID, kind: 'accepted' },
        { aspectId: ASPECT_B_ID, mapId: WORLD_MAP_ID, kind: 'accepted' },
      ],
      edges: [{ dependencyAspectId: ASPECT_A_ID, dependentAspectId: ASPECT_B_ID }],
    });
    expect(graph.nodes.every((node) => !('entityId' in node) && !('acceptedOutput' in node))).toBe(
      true,
    );
  });

  it('rejects cycles with stable diagnostics independent of insertion order', () => {
    const aspects = [
      aspect(ASPECT_A_ID, WORLD_MAP_ID, WORLD_ENTITY_ID, [reference(ASPECT_C_ID)]),
      aspect(ASPECT_B_ID, WORLD_MAP_ID, WORLD_ENTITY_ID, [reference(ASPECT_A_ID)]),
      aspect(ASPECT_C_ID, WORLD_MAP_ID, WORLD_ENTITY_ID, [reference(ASPECT_B_ID)]),
    ];
    const baseline = validateAspectDependencyGraph(document([worldMap({ aspects })]));
    const reordered = validateAspectDependencyGraph(
      document([worldMap({ aspects: [...aspects].reverse() })]),
    );

    expect(reordered).toStrictEqual(baseline);
    expect(baseline).toHaveLength(1);
    expect(baseline[0]).toMatchObject({
      code: ASPECT_DEPENDENCY_DIAGNOSTIC_CODES.cycleDetected,
      severity: 'error',
      aspectIds: [ASPECT_A_ID, ASPECT_B_ID, ASPECT_C_ID],
    });
  });

  it('rejects missing dependency and regional context-status nodes', () => {
    const missingDependency = aspect(ASPECT_A_ID, WORLD_MAP_ID, WORLD_ENTITY_ID, [
      reference(MISSING_ASPECT_ID),
    ]);
    const region = regionalMap({
      aspects: [aspect(ASPECT_D_ID, REGIONAL_MAP_ID, REGIONAL_ENTITY_ID)],
      contextStatusAspectId: ASPECT_C_ID,
    });
    const diagnostics = validateAspectDependencyGraph(
      document([region, worldMap({ aspects: [missingDependency] })]),
    ).filter((diagnostic) => diagnostic.code === ASPECT_DEPENDENCY_DIAGNOSTIC_CODES.missingNode);

    expect(diagnostics.map((diagnostic) => diagnostic.aspectIds)).toStrictEqual([
      [ASPECT_A_ID, MISSING_ASPECT_ID],
      [ASPECT_C_ID],
    ]);
  });

  it('accepts only declared parent-to-child context-status edges across maps', () => {
    const parent = aspect(ASPECT_A_ID, WORLD_MAP_ID, WORLD_ENTITY_ID);
    const validContext = aspect(ASPECT_C_ID, REGIONAL_MAP_ID, REGIONAL_ENTITY_ID, [
      inheritedContextReference(ASPECT_A_ID),
    ]);
    const childGeography = aspect(ASPECT_D_ID, REGIONAL_MAP_ID, REGIONAL_ENTITY_ID, [
      reference(ASPECT_C_ID),
    ]);
    const valid = document([
      regionalMap({ aspects: [childGeography, validContext] }),
      worldMap({ aspects: [parent] }),
    ]);
    expect(createAspectDependencyGraph(valid)).toMatchObject({ ok: true });

    const missingProvenance = document([
      worldMap({ aspects: [parent] }),
      regionalMap({
        aspects: [
          childGeography,
          aspect(ASPECT_C_ID, REGIONAL_MAP_ID, REGIONAL_ENTITY_ID, [reference(ASPECT_A_ID)]),
        ],
      }),
    ]);
    const bypassedContextStatus = document([
      worldMap({ aspects: [parent] }),
      regionalMap({
        aspects: [
          validContext,
          aspect(ASPECT_D_ID, REGIONAL_MAP_ID, REGIONAL_ENTITY_ID, [
            inheritedContextReference(ASPECT_A_ID),
          ]),
        ],
      }),
    ]);

    for (const invalid of [missingProvenance, bypassedContextStatus]) {
      const diagnostics = validateAspectDependencyGraph(invalid);
      expect(diagnostics).toMatchObject([
        { code: ASPECT_DEPENDENCY_DIAGNOSTIC_CODES.invalidCrossMapEdge, severity: 'error' },
      ]);
      expect(validateAspectDependencyGraph(document([...invalid.maps].reverse()))).toStrictEqual(
        diagnostics,
      );
    }
  });

  it('keeps traversal and affected ordering stable across many insertion orders', () => {
    const aspects = orderedDagAspects();
    const variants = insertionOrderVariants(aspects);
    let expected:
      | {
          readonly traversal: readonly AspectId[];
          readonly direct: ReturnType<typeof getDirectAspectInvalidation>;
          readonly transitive: ReturnType<typeof getTransitiveAspectInvalidation>;
        }
      | undefined;

    for (const [index, variant] of variants.entries()) {
      const reorderedDependencies = variant.map((record) => ({
        ...record,
        dependencyAspects:
          index % 2 === 0 ? record.dependencyAspects : [...record.dependencyAspects].reverse(),
      }));
      const graph = validGraph(document([worldMap({ aspects: reorderedDependencies })]));
      const evidence = {
        traversal: getCanonicalAspectDependencyTraversal(graph),
        direct: getDirectAspectInvalidation(graph, [ASPECT_B_ID, ASPECT_A_ID], []),
        transitive: getTransitiveAspectInvalidation(graph, [ASPECT_B_ID, ASPECT_A_ID], []),
      };
      expected ??= evidence;
      expect(evidence).toStrictEqual(expected);
    }

    expect(expected?.traversal).toStrictEqual([
      ASPECT_A_ID,
      ASPECT_B_ID,
      ASPECT_C_ID,
      ASPECT_D_ID,
      ASPECT_E_ID,
    ]);
    expect(expected?.direct.affectedAspects.map((affected) => affected.aspectId)).toStrictEqual([
      ASPECT_C_ID,
      ASPECT_D_ID,
    ]);
    expect(expected?.transitive.affectedAspects.map((affected) => affected.aspectId)).toStrictEqual(
      [ASPECT_C_ID, ASPECT_D_ID, ASPECT_E_ID],
    );
  });

  it('queries direct and transitive invalidation without mutating accepted aspects', () => {
    const acceptedAspects = orderedDagAspects();
    const world = worldMap({ aspects: acceptedAspects });
    const acceptedOutputReferences = acceptedAspects.map((record) => record.acceptedOutput);
    const before = structuredClone(world);
    const graph = validGraph(document([world]));

    expect(getDirectAspectInvalidation(graph, [ASPECT_A_ID], []).affectedAspects).toStrictEqual([
      { aspectId: ASPECT_C_ID, effect: ASPECT_INVALIDATION_EFFECTS.invalidated },
    ]);
    expect(getTransitiveAspectInvalidation(graph, [ASPECT_A_ID], []).affectedAspects).toStrictEqual(
      [
        { aspectId: ASPECT_C_ID, effect: ASPECT_INVALIDATION_EFFECTS.invalidated },
        { aspectId: ASPECT_E_ID, effect: ASPECT_INVALIDATION_EFFECTS.invalidated },
      ],
    );
    expect(world).toStrictEqual(before);
    for (const [index, record] of acceptedAspects.entries()) {
      expect(record.acceptedOutput).toBe(acceptedOutputReferences[index]);
    }
  });

  it('retains materialized locks and reports upstream inconsistencies without crossing them', () => {
    const upstream = aspect(ASPECT_A_ID, WORLD_MAP_ID, WORLD_ENTITY_ID);
    const locked = aspect(ASPECT_B_ID, WORLD_MAP_ID, WORLD_ENTITY_ID, [reference(ASPECT_A_ID)]);
    const behindLock = aspect(ASPECT_C_ID, WORLD_MAP_ID, WORLD_ENTITY_ID, [reference(ASPECT_B_ID)]);
    const unlocked = aspect(ASPECT_D_ID, WORLD_MAP_ID, WORLD_ENTITY_ID, [reference(ASPECT_A_ID)]);
    const locks = [lock(LOCK_B_ID, ASPECT_B_ID), lock(LOCK_A_ID, ASPECT_B_ID)];
    const world = worldMap({ aspects: [behindLock, unlocked, locked, upstream], locks });
    const before = structuredClone(world);
    const lockedOutput = locked.acceptedOutput;
    const graph = validGraph(document([world]));
    const result = getTransitiveAspectInvalidation(graph, [ASPECT_A_ID], world.locks);

    expect(result.affectedAspects).toStrictEqual([
      { aspectId: ASPECT_B_ID, effect: ASPECT_INVALIDATION_EFFECTS.lockedInconsistent },
      { aspectId: ASPECT_D_ID, effect: ASPECT_INVALIDATION_EFFECTS.invalidated },
    ]);
    expect(result.diagnostics).toMatchObject([
      {
        code: ASPECT_DEPENDENCY_DIAGNOSTIC_CODES.lockedOutputInconsistent,
        severity: 'warning',
        aspectIds: [ASPECT_A_ID, ASPECT_B_ID],
        lockIds: [LOCK_A_ID, LOCK_B_ID],
      },
    ]);
    expect(result.affectedAspects.some((affected) => affected.aspectId === ASPECT_C_ID)).toBe(
      false,
    );
    expect(locked.acceptedOutput).toBe(lockedOutput);
    expect(world).toStrictEqual(before);
    expect(
      getTransitiveAspectInvalidation(graph, [ASPECT_A_ID], [...world.locks].reverse()),
    ).toStrictEqual(result);
  });

  it('marks child context stale without invalidating or replacing accepted child geography', () => {
    const parent = aspect(ASPECT_A_ID, WORLD_MAP_ID, WORLD_ENTITY_ID);
    const contextStatus = aspect(ASPECT_C_ID, REGIONAL_MAP_ID, REGIONAL_ENTITY_ID, [
      inheritedContextReference(ASPECT_A_ID),
    ]);
    const childGeography = aspect(ASPECT_D_ID, REGIONAL_MAP_ID, REGIONAL_ENTITY_ID, [
      reference(ASPECT_C_ID),
    ]);
    const region = regionalMap({ aspects: [childGeography, contextStatus] });
    const acceptedGeography = childGeography.acceptedOutput;
    const before = structuredClone(region);
    const graph = validGraph(document([region, worldMap({ aspects: [parent] })]));
    const result = getTransitiveAspectInvalidation(graph, [ASPECT_A_ID], []);

    expect(result.affectedAspects).toStrictEqual([
      { aspectId: ASPECT_C_ID, effect: ASPECT_INVALIDATION_EFFECTS.staleContext },
    ]);
    expect(result.staleContexts).toStrictEqual([
      {
        regionalMapId: REGIONAL_MAP_ID,
        contextStatusAspectId: ASPECT_C_ID,
        status: 'stale',
        invalidatedParentAspectIds: [ASPECT_A_ID],
      },
    ]);
    expect(childGeography.acceptedOutput).toBe(acceptedGeography);
    expect(region).toStrictEqual(before);
    expect(getTransitiveAspectInvalidation(graph, [ASPECT_C_ID], []).affectedAspects).toStrictEqual(
      [{ aspectId: ASPECT_D_ID, effect: ASPECT_INVALIDATION_EFFECTS.invalidated }],
    );
  });
});

function orderedDagAspects(): readonly AcceptedAspectRecord[] {
  return [
    aspect(ASPECT_A_ID, WORLD_MAP_ID, WORLD_ENTITY_ID),
    aspect(ASPECT_B_ID, WORLD_MAP_ID, WORLD_ENTITY_ID),
    aspect(ASPECT_C_ID, WORLD_MAP_ID, WORLD_ENTITY_ID, [
      reference(ASPECT_B_ID),
      reference(ASPECT_A_ID),
    ]),
    aspect(ASPECT_D_ID, WORLD_MAP_ID, WORLD_ENTITY_ID, [reference(ASPECT_B_ID)]),
    aspect(ASPECT_E_ID, WORLD_MAP_ID, WORLD_ENTITY_ID, [
      reference(ASPECT_D_ID),
      reference(ASPECT_C_ID),
    ]),
  ];
}

function insertionOrderVariants<Value>(values: readonly Value[]): readonly (readonly Value[])[] {
  const variants: Value[][] = [];
  for (let offset = 0; offset < values.length; offset += 1) {
    variants.push([...values.slice(offset), ...values.slice(0, offset)]);
    variants.push([...values.slice(offset), ...values.slice(0, offset)].reverse());
  }
  return variants;
}

function document(maps: readonly MapDocument[]): WorldDocument {
  return Object.freeze({
    worldDocumentId: WORLD_DOCUMENT_ID,
    displayName: 'Dependency proof',
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
    displayName: 'World',
    coordinateSystem: {
      kind: MAP_COORDINATE_SYSTEM_KINDS.planetSphere,
      rootSurfaceId: ROOT_SURFACE_ID,
      radius: WORLD_RADIUS,
    },
    extent: { kind: WORLD_MAP_EXTENT_KIND },
    entities: [{ entityId: WORLD_ENTITY_ID, displayName: 'World dependency proof' }],
    aspects: [],
    constraints: [],
    locks: [],
    decoration: { aspectReferences: [] },
    layout: { aspectReferences: [] },
    ...overrides,
  });
}

function regionalMap(
  options: {
    readonly aspects?: readonly AcceptedAspectRecord[];
    readonly contextStatusAspectId?: AspectId;
  } = {},
): RegionalMap {
  const baseline: RegionalMap = {
    mapId: REGIONAL_MAP_ID,
    mapKind: MAP_KINDS.regional,
    scaleClass: MAP_SCALE_CLASSES.regional,
    displayName: 'Region',
    parent: {
      parentMapId: WORLD_MAP_ID,
      rootMapId: WORLD_MAP_ID,
      relationshipKind: MAP_RELATIONSHIP_KINDS.worldToRegional,
      contextStatusAspectId: options.contextStatusAspectId ?? ASPECT_C_ID,
    },
    coordinateSystem: {
      kind: MAP_COORDINATE_SYSTEM_KINDS.regionalAzimuthalEquidistant,
      rootSurfaceId: ROOT_SURFACE_ID,
      transformId: PLANET_REGIONAL_TRANSFORM_ID,
      transformVersion: COORDINATE_TRANSFORM_VERSION,
      origin: REGION_ORIGIN,
      radius: WORLD_RADIUS,
    },
    extent: REGION_EXTENT,
    entities: [{ entityId: REGIONAL_ENTITY_ID, displayName: 'Regional dependency proof' }],
    aspects: options.aspects ?? [],
    constraints: [],
    locks: [],
    decoration: { aspectReferences: [] },
    layout: { aspectReferences: [] },
  };
  return Object.freeze(baseline);
}

function aspect(
  aspectId: AspectId,
  mapId: MapId,
  entityId: EntityId,
  dependencyAspects: readonly AspectDependencyReference[] = [],
): AcceptedAspectRecord<Record<string, never>, { readonly stableValue: string }> {
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
    parameters: Object.freeze({}),
    seedScope: seedMetadata.seedScope,
    seedMetadata,
    variantRevision: REVISION,
    dependencyAspects: Object.freeze(dependencyAspects),
    generationStatus: 'accepted',
    diagnostics: Object.freeze([]),
    acceptedOutput: Object.freeze({ stableValue: `accepted:${aspectId}` }),
  });
}

function reference(aspectId: AspectId): AspectDependencyReference {
  return Object.freeze({ aspectId });
}

function inheritedContextReference(aspectId: AspectId): AspectDependencyReference {
  return Object.freeze({
    aspectId,
    contextProvenance: Object.freeze({
      kind: ASPECT_DEPENDENCY_PROVENANCE_KINDS.inheritedContext,
      parentMapId: WORLD_MAP_ID,
      childMapId: REGIONAL_MAP_ID,
    }),
  });
}

function lock(lockId: LockId, aspectId: AspectId) {
  return Object.freeze({ lockId, target: Object.freeze({ aspectId }) });
}

function validGraph(worldDocument: WorldDocument) {
  const result = createAspectDependencyGraph(worldDocument);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.graph;
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
