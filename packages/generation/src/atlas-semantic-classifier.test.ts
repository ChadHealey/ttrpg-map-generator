import {
  ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES,
  type AtlasSemanticGeographyRecords,
  deriveAtlasIslandGroupEntityId,
  validateAtlasSemanticGeographyRecords,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import {
  FIXED_ATLAS_GENERATOR_CASES,
  FIXED_ATLAS_LAND_WATER_ASPECT_ID,
  FIXED_ATLAS_WORLD_MAP_ID,
  FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
  type FixedAtlasGeneratorCase,
  generateFixedAtlasFull,
  requiredCase,
} from './atlas-land-water-test-support.js';
import { classifyAtlasSemanticGeography } from './atlas-semantic-classifier.js';
import { atlasStorageIndex } from './atlas-surface-topology.js';

const landWaterCache = new Map<string, Awaited<ReturnType<typeof generateFixedAtlasFull>>>();
const semanticCache = new Map<
  string,
  Extract<ReturnType<typeof classifyAtlasSemanticGeography>, { readonly ok: true }>
>();

describe('atlas semantic classification', () => {
  it('classifies every fixed proof row with stable ownership and ocean intent', async () => {
    for (const fixed of FIXED_ATLAS_GENERATOR_CASES) {
      const classified = await fixedSemantic(fixed.fixtureId);
      expect(validateAtlasSemanticGeographyRecords(classified.records)).toStrictEqual({ ok: true });
      expect(
        classified.records.landmasses.reduce(
          (total, landmass) => total + landmass.membership.sampleCount,
          0,
        ) +
          classified.records.waterBodies.reduce(
            (total, body) => total + body.membership.sampleCount,
            0,
          ),
      ).toBe(classified.records.landWaterClassification.samples.length);
    }
  }, 120_000);

  it('realizes both disjoint island-group kinds in the fragmented fixed proof', async () => {
    const classified = await fixedSemantic('milestone-2-atlas-fragmented-islands');
    expect(classified.records.islandGroups.map(({ kind }) => kind).sort()).toStrictEqual([
      'archipelago',
      'islandChain',
    ]);
    const members = classified.records.islandGroups.flatMap(
      ({ memberLandmassIds }) => memberLandmassIds,
    );
    expect(new Set(members).size).toBe(members.length);
  }, 30_000);

  it('repeats stable identities and canonical entity order byte-for-byte', async () => {
    const generated = await fixedLandWater('milestone-2-atlas-proof');
    const input = {
      worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
      worldSurfaceEntityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
      landWaterClassificationAspectId: FIXED_ATLAS_LAND_WATER_ASPECT_ID,
      records: generated.patch.records,
    } as const;
    const first = await fixedSemantic('milestone-2-atlas-proof');
    const second = classifyAtlasSemanticGeography(input);
    expect(second).toStrictEqual(first);
  }, 30_000);

  it('retains seam-crossing land as one stable entity and island containment as relationships', async () => {
    const seam = await fixedSemantic('milestone-2-atlas-seam-crossing');
    const crossesSeam = seam.records.landmasses.some((landmass) => {
      for (let latitudeIndex = 1; latitudeIndex < 1_024; latitudeIndex += 1) {
        if (
          ownsSample(landmass.membership.sampleRanges, atlasStorageIndex(0, latitudeIndex)) &&
          ownsSample(landmass.membership.sampleRanges, atlasStorageIndex(2_047, latitudeIndex))
        ) {
          return true;
        }
      }
      return false;
    });
    expect(crossesSeam).toBe(true);

    const fragmented = await fixedSemantic('milestone-2-atlas-fragmented-islands');
    const islands = fragmented.records.landmasses.filter(({ kind }) => kind !== 'continent');
    expect(islands.some(({ kind }) => kind === 'majorIsland')).toBe(true);
    expect(islands.some(({ kind }) => kind === 'island')).toBe(true);
    expect(islands.every(({ containingWaterBodyId }) => containingWaterBodyId !== undefined)).toBe(
      true,
    );
  });

  it('rejects structurally valid mutations of land thresholds and island-group policy', async () => {
    const source = (await fixedSemantic('milestone-2-atlas-fragmented-islands')).records;
    const groupedIds = new Set(
      source.islandGroups.flatMap(({ memberLandmassIds }) => memberLandmassIds),
    );
    const ungroupedIsland = source.landmasses.find(
      ({ entityId, kind }) => kind !== 'continent' && !groupedIds.has(entityId),
    );
    expect(ungroupedIsland).toBeDefined();
    if (ungroupedIsland === undefined) return;
    const wrongLandKind: AtlasSemanticGeographyRecords = {
      ...source,
      landmasses: source.landmasses.map((landmass) => {
        if (landmass.entityId !== ungroupedIsland.entityId) return landmass;
        const { containingWaterBodyId: _containingWaterBodyId, ...withoutContainment } = landmass;
        return { ...withoutContainment, kind: 'continent' };
      }),
    };

    const missingBudgetedGroup: AtlasSemanticGeographyRecords = {
      ...source,
      islandGroups: source.islandGroups.slice(1),
    };
    const archipelago = source.islandGroups.find(({ kind }) => kind === 'archipelago');
    const chain = source.islandGroups.find(({ kind }) => kind === 'islandChain');
    expect(archipelago).toBeDefined();
    expect(chain).toBeDefined();
    if (archipelago === undefined || chain === undefined) return;
    const wrongGroupKind = {
      ...archipelago,
      kind: 'islandChain' as const,
      entityId: deriveAtlasIslandGroupEntityId(
        source.worldMapId,
        'islandChain',
        archipelago.memberLandmassIds,
      ),
    };
    const misclassifiedGroup: AtlasSemanticGeographyRecords = {
      ...source,
      islandGroups: [wrongGroupKind, chain].sort((left, right) =>
        left.entityId < right.entityId ? -1 : left.entityId > right.entityId ? 1 : 0,
      ),
    };
    const reversedChain: AtlasSemanticGeographyRecords = {
      ...source,
      islandGroups: source.islandGroups.map((group) =>
        group.entityId === chain.entityId
          ? { ...group, memberLandmassIds: [...group.memberLandmassIds].reverse() }
          : group,
      ),
    };

    for (const malformed of [
      wrongLandKind,
      missingBudgetedGroup,
      misclassifiedGroup,
      reversedChain,
    ]) {
      expectPolicyRejection(malformed);
    }
  }, 120_000);

  it('rejects duplicate and misplaced ocean-basin roots in one open-marine graph', async () => {
    const source = (await fixedSemantic('milestone-2-atlas-connected-majority')).records;
    const basin = source.waterBodies.find(({ kind }) => kind === 'oceanBasin');
    const marginalSea = source.waterBodies.find(
      ({ kind, enclosure }) => kind === 'sea' && enclosure === 'open-marine',
    );
    expect(basin).toBeDefined();
    expect(marginalSea).toBeDefined();
    if (basin === undefined || marginalSea === undefined) return;

    const duplicateRoot: AtlasSemanticGeographyRecords = {
      ...source,
      waterBodies: source.waterBodies.map((body) =>
        body.entityId === marginalSea.entityId ? { ...body, kind: 'oceanBasin' } : body,
      ),
    };
    const misplacedRoot: AtlasSemanticGeographyRecords = {
      ...source,
      waterBodies: source.waterBodies.map((body) => {
        if (body.entityId === basin.entityId) return { ...body, kind: 'sea' };
        if (body.entityId === marginalSea.entityId) return { ...body, kind: 'oceanBasin' };
        return body;
      }),
    };
    expectPolicyRejection(duplicateRoot);
    expectPolicyRejection(misplacedRoot);
  }, 60_000);

  it('rejects open/enclosed mutations that violate connected-majority or multiple-basin policy', async () => {
    const connectedMajority = (await fixedSemantic('milestone-2-atlas-connected-majority')).records;
    const enclosedSea = connectedMajority.waterBodies.find(
      ({ enclosure }) => enclosure === 'enclosed',
    );
    expect(enclosedSea).toBeDefined();
    if (enclosedSea === undefined) return;
    const falseOpenSea: AtlasSemanticGeographyRecords = {
      ...connectedMajority,
      waterBodies: connectedMajority.waterBodies.map((body) =>
        body.entityId === enclosedSea.entityId
          ? {
              ...body,
              kind: 'oceanBasin',
              enclosure: 'open-marine',
              enclosedByLandmassIds: [],
            }
          : body,
      ),
    };

    const multipleBasins = (await fixedSemantic('milestone-2-atlas-control-max')).records;
    const basin = multipleBasins.waterBodies.find(({ kind }) => kind === 'oceanBasin');
    expect(basin).toBeDefined();
    if (basin === undefined) return;
    const falseEnclosedSea: AtlasSemanticGeographyRecords = {
      ...multipleBasins,
      waterBodies: multipleBasins.waterBodies.map((body) =>
        body.entityId === basin.entityId
          ? {
              ...body,
              kind: 'sea',
              enclosure: 'enclosed',
              enclosedByLandmassIds: body.adjacentLandmassIds,
            }
          : body,
      ),
    };
    expectPolicyRejection(falseOpenSea);
    expectPolicyRejection(falseEnclosedSea);
  }, 60_000);
});

async function fixedLandWater(fixtureId: FixedAtlasGeneratorCase['fixtureId']) {
  const cached = landWaterCache.get(fixtureId);
  if (cached !== undefined) return cached;
  const generated = await generateFixedAtlasFull(requiredCase(fixtureId));
  landWaterCache.set(fixtureId, generated);
  return generated;
}

function expectPolicyRejection(records: AtlasSemanticGeographyRecords): void {
  const result = validateAtlasSemanticGeographyRecords(records);
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.diagnostics.map(({ code }) => code)).toContain(
    ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.policyMisclassification,
  );
}

async function fixedSemantic(fixtureId: FixedAtlasGeneratorCase['fixtureId']) {
  const cached = semanticCache.get(fixtureId);
  if (cached !== undefined) return cached;
  const generated = await fixedLandWater(fixtureId);
  const classified = classifyAtlasSemanticGeography({
    worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
    worldSurfaceEntityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
    landWaterClassificationAspectId: FIXED_ATLAS_LAND_WATER_ASPECT_ID,
    records: generated.patch.records,
  });
  if (!classified.ok) throw new Error(JSON.stringify(classified.diagnostics));
  semanticCache.set(fixtureId, classified);
  return classified;
}

function ownsSample(
  ranges: readonly { readonly startIndex: number; readonly endIndexExclusive: number }[],
  index: number,
): boolean {
  return ranges.some(
    ({ startIndex, endIndexExclusive }) => index >= startIndex && index < endIndexExclusive,
  );
}
