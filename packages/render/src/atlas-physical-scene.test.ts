import {
  type AtlasStyleTokens,
  createPlanetPoint,
  deriveWorldPhysicalContextAspectId,
  parseSemanticKey,
  parseStableId,
  type WorldPhysicalContextRecords,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import { composeAtlasPhysicalSceneNodes } from './atlas-physical-scene.js';

const WORLD_MAP_ID = required(parseStableId('map', '00000000-0000-4000-8000-000000000101'));
const WORLD_SURFACE_ID = required(parseStableId('entity', '00000000-0000-4000-8000-000000000102'));
const BIOME_ID = required(parseStableId('entity', '00000000-0000-4000-8000-000000000103'));
const WATERSHED_ID = required(parseStableId('entity', '00000000-0000-4000-8000-000000000104'));
const MOUNTAIN_ID = required(parseStableId('entity', '00000000-0000-4000-8000-000000000105'));
const LAKE_ID = required(parseStableId('entity', '00000000-0000-4000-8000-000000000106'));
const RIVER_ID = required(parseStableId('entity', '00000000-0000-4000-8000-000000000107'));

const STYLE: AtlasStyleTokens = {
  styleId: required(parseSemanticKey('atlas-style.restrained-ink')),
  styleBehaviorVersion: 1,
  tokenVersion: 1,
  colors: {
    ink: '#282a24',
    water: '#afbec0',
    waterInk: '#71888b',
    land: '#c9c39a',
    paper: '#eadcba',
    paperGrain: '#d9c8a3',
  },
  coastline: {
    primaryWidthPx: 1.55,
    pressureVariationPx: 0.38,
    maximumWobblePx: 0.72,
    primaryWavelengthPx: 38,
    secondaryWavelengthPx: 71,
    pressureWavelengthPx: 54,
    strokeSegmentLengthPx: 18,
  },
  waterDecoration: { echoWidthPx: 0.82, waterMarkWidthPx: 0.78 },
  paper: { grainCount: 420, grainLengthPx: 2.6, grainWidthPx: 0.55 },
};

describe('accepted M3 physical atlas scene overlays', () => {
  it('projects every physical feature with deterministic source entity and aspect provenance', () => {
    const physical = physicalRecords();
    const before = JSON.stringify(physical);
    const nodes = composeAtlasPhysicalSceneNodes(physical, STYLE, {
      widthPx: 2048,
      heightPx: 1024,
    });

    expect(nodes.map(({ id }) => id)).toStrictEqual([...nodes.map(({ id }) => id)].sort());
    expect(nodes.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        `atlas/physical/01-biome/${BIOME_ID}/0000`,
        `atlas/physical/02-watershed/${WATERSHED_ID}/0000/0000`,
        `atlas/physical/03-mountain/${MOUNTAIN_ID}/0000/0000`,
        `atlas/physical/04-lake/${LAKE_ID}/0000`,
        `atlas/physical/05-river/${RIVER_ID}/0000`,
        `atlas/physical/05-river/${RIVER_ID}/0001`,
      ]),
    );
    expect(
      nodes.every(({ sourceId, sourceAspectId }) => sourceId !== '' && sourceAspectId !== ''),
    ).toBe(true);
    expect(
      nodes.every(({ relatedSourceIds }) => {
        const ids = relatedSourceIds ?? [];
        return ids.join('|') === [...ids].sort().join('|');
      }),
    ).toBe(true);
    expect(nodes.every((node) => node.id.startsWith('atlas/physical/'))).toBe(true);
    expect(nodes.some(({ kind }) => kind === 'compoundPath')).toBe(true);
    const biome = nodes.find(({ id }) => id.startsWith('atlas/physical/01-biome/'));
    expect(biome?.kind).toBe('polyline');
    if (biome?.kind === 'polyline') {
      expect(biome.points).toHaveLength(4);
      expect(biome.points[0]).toStrictEqual(biome.points.at(-1));
    }
    expect(JSON.stringify(physical)).toBe(before);
  });

  it('canonicalizes equivalent physical input ordering without changing scene semantics', () => {
    const physical = physicalRecords();
    const reordered = {
      ...physical,
      biomeBelts: {
        ...physical.biomeBelts,
        beltSummaries: [...physical.biomeBelts.beltSummaries].reverse(),
      },
      majorLakes: [...physical.majorLakes].reverse(),
      majorRivers: [...physical.majorRivers].reverse(),
      mountainSystems: {
        ...physical.mountainSystems,
        systems: [...physical.mountainSystems.systems].reverse(),
      },
      watersheds: {
        ...physical.watersheds,
        watersheds: [...physical.watersheds.watersheds].reverse(),
      },
    };

    expect(
      composeAtlasPhysicalSceneNodes(reordered, STYLE, { widthPx: 2048, heightPx: 1024 }),
    ).toStrictEqual(
      composeAtlasPhysicalSceneNodes(physical, STYLE, { widthPx: 2048, heightPx: 1024 }),
    );
  });

  it('keeps seam-crossing biome boundaries split into open display paths', () => {
    const physical = physicalRecords();
    const originalBelt = physical.biomeBelts.beltSummaries.at(0);
    if (originalBelt === undefined) throw new Error('Expected a biome belt.');
    const seamCrossing = {
      ...physical,
      biomeBelts: {
        ...physical.biomeBelts,
        beltSummaries: [
          {
            ...originalBelt,
            boundaryPoints: [
              required(createPlanetPoint(3.05, 0.2)),
              required(createPlanetPoint(-3.05, 0.1)),
              required(createPlanetPoint(-2.8, -0.2)),
            ],
          },
        ],
      },
    };

    const nodes = composeAtlasPhysicalSceneNodes(seamCrossing, STYLE, {
      widthPx: 2048,
      heightPx: 1024,
    });
    const biomeNodes = nodes.filter(({ id }) => id.startsWith('atlas/physical/01-biome/'));

    expect(biomeNodes).toHaveLength(2);
    expect(biomeNodes.every((node) => node.kind === 'polyline')).toBe(true);
    expect(
      biomeNodes.every((node) => {
        if (node.kind !== 'polyline') return true;
        const first = node.points[0];
        const last = node.points.at(-1);
        return first?.xPx !== last?.xPx || first?.yPx !== last?.yPx;
      }),
    ).toBe(true);
  });

  it('keeps each minimum-size closed lake outline aligned with its rendered fill', () => {
    const physical = physicalRecords();
    const originalLake = physical.majorLakes[0];
    if (originalLake === undefined) throw new Error('Expected a lake.');
    const tinyLake = {
      ...originalLake,
      ring: [
        required(createPlanetPoint(0, 0)),
        required(createPlanetPoint(0.001, 0)),
        required(createPlanetPoint(0, 0.001)),
      ],
    };
    const nodes = composeAtlasPhysicalSceneNodes({ ...physical, majorLakes: [tinyLake] }, STYLE, {
      widthPx: 2048,
      heightPx: 1024,
    });
    const lake = nodes.find(({ id }) => id === `atlas/physical/04-lake/${LAKE_ID}/0000`);
    const outline = nodes.find(({ id }) => id === `atlas/physical/04-lake/${LAKE_ID}/0000/outline`);

    expect(lake?.kind).toBe('compoundPath');
    expect(outline?.kind).toBe('polyline');
    if (lake?.kind !== 'compoundPath' || outline?.kind !== 'polyline') {
      throw new Error('Expected a closed lake and outline.');
    }
    const fillPoints = lake.subpaths[0]?.points;
    if (fillPoints === undefined) throw new Error('Expected lake fill points.');
    expect(outline.points).toStrictEqual(fillPoints);
    const xExtent =
      Math.max(...fillPoints.map(({ xPx }) => xPx)) - Math.min(...fillPoints.map(({ xPx }) => xPx));
    const yExtent =
      Math.max(...fillPoints.map(({ yPx }) => yPx)) - Math.min(...fillPoints.map(({ yPx }) => yPx));
    expect(Math.max(xExtent, yExtent)).toBeGreaterThanOrEqual(30);
  });
});

function physicalRecords(): WorldPhysicalContextRecords {
  const point = (longitude: number, latitude: number) =>
    required(createPlanetPoint(longitude, latitude));
  const mountainAspectId = deriveWorldPhysicalContextAspectId(
    WORLD_SURFACE_ID,
    'worldTerrain.mountainSystems',
  );
  const biomeAspectId = deriveWorldPhysicalContextAspectId(
    WORLD_SURFACE_ID,
    'worldEcology.biomeBelts',
  );
  const watershedAspectId = deriveWorldPhysicalContextAspectId(
    WORLD_SURFACE_ID,
    'worldHydrology.watersheds',
  );
  return {
    worldMapId: WORLD_MAP_ID,
    worldSurfaceEntityId: WORLD_SURFACE_ID,
    mountainSystems: {
      ownerAspectId: mountainAspectId,
      systems: [
        {
          entityId: MOUNTAIN_ID,
          centerlines: [[point(-0.6, 0.2), point(0, 0.45), point(0.45, 0.25)]],
        },
      ],
    },
    biomeBelts: {
      provenance: { ownerAspectId: biomeAspectId },
      beltSummaries: [
        {
          entityId: BIOME_ID,
          boundaryPoints: [point(-0.7, -0.2), point(0, 0.1), point(0.75, -0.2)],
        },
      ],
    },
    watersheds: {
      provenance: { ownerAspectId: watershedAspectId },
      watersheds: [
        {
          entityId: WATERSHED_ID,
          outletEntityId: LAKE_ID,
          divideLines: [[point(-0.8, 0.5), point(0.6, 0.45)]],
        },
      ],
    },
    majorLakes: [
      {
        entityId: LAKE_ID,
        watershedId: WATERSHED_ID,
        ring: [point(-0.2, -0.1), point(0.1, -0.1), point(0, 0.15)],
      },
    ],
    majorRivers: [
      {
        entityId: RIVER_ID,
        watershedId: WATERSHED_ID,
        sourceEntityId: MOUNTAIN_ID,
        outletEntityId: LAKE_ID,
        joinsRiverIds: [],
        centerline: [point(3.05, 0.2), point(-3.05, 0.1)],
      },
    ],
  } as unknown as WorldPhysicalContextRecords;
}

function required<Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false },
): Value {
  if (!result.ok) throw new Error('Expected a valid test value.');
  return result.value;
}
