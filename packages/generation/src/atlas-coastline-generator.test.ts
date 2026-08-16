import {
  type AcceptedAspectRecord,
  ATLAS_COASTLINE_SIMPLIFICATION_TOLERANCE_TICKS,
  deriveAtlasSingletonEntityIds,
  PLANET_TICKS_PER_TURN,
  validateAtlasGeographyRecords,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import {
  ATLAS_COASTLINE_GENERATOR_MANIFEST,
  type AtlasCoastlineAspectProposal,
  generateAtlasCanonicalCoastline,
} from './atlas-coastline-generator.js';
import {
  FIXED_ATLAS_LAND_WATER_ASPECT_ID,
  FIXED_ATLAS_WORLD_MAP_ID,
  FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
  fixedAtlasInput,
  generateFixedAtlasFull,
} from './atlas-land-water-test-support.js';
import { generateAtlasSemanticGeography } from './atlas-semantic-generator-contract.js';

describe('canonical atlas coastline generator', () => {
  it('declares the versioned quarter-cell, reject-only canonical geometry contract', () => {
    expect(ATLAS_COASTLINE_GENERATOR_MANIFEST).toMatchObject({
      generatorId: 'worldCoastline.geometry',
      generatorVersion: 1,
      parameterSchemaVersion: 1,
      seedScope: 'map/entity',
      randomDrawPolicy: 'zero-draws',
      parameters: {
        simplificationToleranceTicks: ATLAS_COASTLINE_SIMPLIFICATION_TOLERANCE_TICKS,
        winding: 'land-on-left',
        repairPolicy: 'reject-invalid-no-silent-repair',
      },
    });
  });

  it('extracts byte-stable source-linked rings without changing accepted classification', async () => {
    const landWater = await generateFixedAtlasFull();
    const semantic = generateAtlasSemanticGeography({
      worldSeed: fixedAtlasInput().worldSeed,
      worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
      worldSurfaceEntityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
      landWaterClassificationAspectId: FIXED_ATLAS_LAND_WATER_ASPECT_ID,
      records: landWater.patch.records,
      previousAcceptedAspects: [],
    });
    expect(semantic.status).toBe('proposed');
    if (semantic.status !== 'proposed') return;
    const worldCoastlineEntityId =
      deriveAtlasSingletonEntityIds(FIXED_ATLAS_WORLD_MAP_ID).worldCoastlineEntityId;
    const input = {
      worldSeed: fixedAtlasInput().worldSeed,
      worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
      worldCoastlineEntityId,
      records: semantic.patch.records,
      previousAcceptedAspects: [],
    } as const;
    expect(
      generateAtlasCanonicalCoastline({
        ...input,
        records: { ...input.records, landmasses: [] },
      }),
    ).toMatchObject({
      status: 'invalid',
      diagnostics: [{ code: 'atlas.coastline.input-invalid' }],
    });
    const generated = generateAtlasCanonicalCoastline(input);
    expect(generated).toMatchObject({ status: 'proposed' });
    if (generated.status !== 'proposed') return;
    expect(generateAtlasCanonicalCoastline(input)).toStrictEqual(generated);
    expect(validateAtlasGeographyRecords(generated.patch.records)).toStrictEqual({ ok: true });
    expect(generated.patch.records.landWaterClassification).toBe(
      semantic.patch.records.landWaterClassification,
    );
    expect(generated.patch.rawPointCount).toBeGreaterThan(generated.patch.canonicalPointCount);
    expect(generated.patch.canonicalPointCount).toBeGreaterThan(0);
    expect(generated.patch.replacement.dependencyAspects).toHaveLength(
      1 + semantic.patch.records.landmasses.length + semantic.patch.records.waterBodies.length,
    );
    expect(generated.patch.records.coastline.rings.map(({ ringId }) => ringId)).toStrictEqual(
      [...generated.patch.records.coastline.rings.map(({ ringId }) => ringId)].sort(),
    );
    expect(
      generated.patch.records.coastline.rings.every(
        ({ sourceBoundaryFingerprint, waterBodyIds }) =>
          /^[0-9a-f]{64}$/u.test(sourceBoundaryFingerprint) && waterBodyIds.length > 0,
      ),
    ).toBe(true);
    expect(
      generated.patch.records.coastline.rings.some(({ points }) =>
        points.some((point, index) => {
          const next = points[(index + 1) % points.length];
          return (
            next !== undefined &&
            Math.abs(point.longitudeTicks - next.longitudeTicks) > PLANET_TICKS_PER_TURN / 2
          );
        }),
      ),
    ).toBe(true);

    const accepted = acceptProposal(generated.patch.replacement);
    const repeated = generateAtlasCanonicalCoastline({
      ...input,
      previousAcceptedAspects: [accepted],
    });
    expect(repeated.status).toBe('proposed');
    if (repeated.status !== 'proposed') return;
    expect(repeated.patch.replacement.target.variantRevision).toBe(0);
    expect(repeated.patch.explicitlyIncrementedAspectIds).toStrictEqual([]);
  }, 60_000);
});

function acceptProposal(proposal: AtlasCoastlineAspectProposal): AcceptedAspectRecord {
  return Object.freeze({
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
  });
}
