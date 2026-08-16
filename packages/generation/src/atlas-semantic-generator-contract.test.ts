import {
  type AcceptedAspectRecord,
  deriveAtlasAspectId,
  deriveAtlasSingletonEntityIds,
  parseAspectName,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import {
  FIXED_ATLAS_LAND_WATER_ASPECT_ID,
  FIXED_ATLAS_WORLD_MAP_ID,
  FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
  fixedAtlasInput,
  generateFixedAtlasFull,
} from './atlas-land-water-test-support.js';
import {
  type AtlasSemanticAspectProposal,
  generateAtlasSemanticGeography,
} from './atlas-semantic-generator-contract.js';

describe('atlas semantic proposal boundary', () => {
  it('recomputes only declared semantic aspects and preserves revisions and unrelated aspects', async () => {
    const landWater = await generateFixedAtlasFull();
    const baseInput = {
      worldSeed: fixedAtlasInput().worldSeed,
      worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
      worldSurfaceEntityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
      landWaterClassificationAspectId: FIXED_ATLAS_LAND_WATER_ASPECT_ID,
      records: landWater.patch.records,
    } as const;
    const initial = generateAtlasSemanticGeography({
      ...baseInput,
      previousAcceptedAspects: [],
    });
    expect(initial.status).toBe('proposed');
    if (initial.status !== 'proposed') return;
    const accepted = initial.patch.replacements.map(acceptProposal);
    const unrelated = unrelatedPaperAspect(accepted[0]);
    const repeated = generateAtlasSemanticGeography({
      ...baseInput,
      previousRecords: initial.patch.records,
      previousAcceptedAspects: [unrelated, ...accepted].reverse(),
    });
    expect(repeated.status).toBe('proposed');
    if (repeated.status !== 'proposed') return;
    expect(repeated.patch.replacements).toStrictEqual(initial.patch.replacements);
    expect(repeated.patch.removedAspectIds).toStrictEqual([]);
    expect(repeated.patch.explicitlyIncrementedAspectIds).toStrictEqual([]);
    expect(
      repeated.patch.replacements.every(({ target }) =>
        [
          'landmass.classification',
          'islandGroup.classification',
          'waterBody.classification',
        ].includes(target.aspectName),
      ),
    ).toBe(true);
    expect(
      repeated.patch.replacements.some(
        ({ target }) => target.aspect.aspectId === unrelated.aspectId,
      ),
    ).toBe(false);
    expect(repeated.patch.replacements.every(({ target }) => target.variantRevision === 0)).toBe(
      true,
    );
  }, 30_000);
});

function acceptProposal(proposal: AtlasSemanticAspectProposal): AcceptedAspectRecord {
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

function unrelatedPaperAspect(source: AcceptedAspectRecord | undefined): AcceptedAspectRecord {
  if (source === undefined) throw new Error('Expected a semantic aspect proposal.');
  const presentation =
    deriveAtlasSingletonEntityIds(FIXED_ATLAS_WORLD_MAP_ID).atlasPresentationEntityId;
  const aspectName = parseAspectName('atlas.paperTreatment');
  if (!aspectName.ok) throw new Error(aspectName.diagnostic.message);
  return Object.freeze({
    ...source,
    entityId: presentation,
    aspectId: deriveAtlasAspectId(presentation, 'atlas.paperTreatment'),
    aspectName: aspectName.value,
    acceptedOutput: Object.freeze({ paperTone: 1 }),
  });
}
