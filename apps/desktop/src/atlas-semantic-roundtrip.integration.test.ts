import {
  type AcceptedAspectRecord,
  createDeterministicRandomStream,
  DEFAULT_ATLAS_CONTROLS,
  deriveAtlasAspectId,
  deriveAtlasSingletonEntityIds,
  type MapEntity,
  type WorldDocument,
} from '@ttrpg-map/core';
import {
  type AtlasSemanticAspectProposal,
  createAtlasLandWaterGenerationInput,
  createMilestoneOneProofDocument,
  generateAtlasLandWaterFull,
  generateAtlasSemanticGeography,
  MILESTONE_ONE_PROOF_SEED,
  MILESTONE_ONE_WORLD_MAP_ID,
} from '@ttrpg-map/generation';
import { canonicalAspectBytes, decodeMapworld, encodeMapworld } from '@ttrpg-map/persistence';
import { describe, expect, it } from 'vitest';

describe('accepted atlas semantic canonical support', () => {
  it('round-trips semantic entities without regeneration or an alternate serializer', async () => {
    const surface = deriveAtlasSingletonEntityIds(MILESTONE_ONE_WORLD_MAP_ID).worldSurfaceEntityId;
    const inputResult = createAtlasLandWaterGenerationInput({
      worldSeed: MILESTONE_ONE_PROOF_SEED,
      worldMapId: MILESTONE_ONE_WORLD_MAP_ID,
      worldSurfaceEntityId: surface,
      macroElevationAspectId: deriveAtlasAspectId(surface, 'worldTerrain.macroElevation'),
      landWaterClassificationAspectId: deriveAtlasAspectId(
        surface,
        'worldSurface.landWaterClassification',
      ),
      macroElevationVariantRevision: 0,
      landWaterClassificationVariantRevision: 0,
      controls: DEFAULT_ATLAS_CONTROLS,
    });
    if (!inputResult.ok) throw new Error(JSON.stringify(inputResult.diagnostics));
    const input = inputResult.value;
    const macroRandom = createDeterministicRandomStream(input.macroElevationSeedMetadata);
    const classificationRandom = createDeterministicRandomStream(
      input.landWaterClassificationSeedMetadata,
    );
    if (!macroRandom.ok || !classificationRandom.ok) throw new Error('Invalid fixed seed input.');
    const landWater = await generateAtlasLandWaterFull(input, {
      operationId: 'atlas-semantic-roundtrip',
      macroElevationRandom: macroRandom.value,
      landWaterClassificationRandom: classificationRandom.value,
      cancellation: { cancellationVersion: 1, isCancellationRequested: () => false },
      reportProgress: () => undefined,
      yieldControl: () => Promise.resolve(),
    });
    if (landWater.status !== 'proposed-full')
      throw new Error(JSON.stringify(landWater.diagnostics));
    const semantic = generateAtlasSemanticGeography({
      worldSeed: input.worldSeed,
      worldMapId: input.worldMapId,
      worldSurfaceEntityId: input.worldSurfaceEntityId,
      landWaterClassificationAspectId: input.landWaterClassificationAspectId,
      records: landWater.patch.records,
      previousAcceptedAspects: [],
    });
    expect(semantic.status).toBe('proposed');
    if (semantic.status !== 'proposed') return;
    const semanticAspects = semantic.patch.replacements.map(acceptProposal);
    const upstream = acceptProposal({
      ...landWater.patch.replacements[1],
      dependencyAspects: [],
      output: { canonicalTestSupport: 1 },
    } as unknown as AtlasSemanticAspectProposal);
    const source = createMilestoneOneProofDocument(MILESTONE_ONE_PROOF_SEED);
    const sourceMap = source.maps[0];
    if (sourceMap?.mapKind !== 'world') {
      throw new Error('Expected the Milestone 1 root world map.');
    }
    const semanticEntities: MapEntity[] = [
      { entityId: input.worldSurfaceEntityId, displayName: 'World surface' },
      ...semantic.patch.addedEntityIds.map((entityId) => ({
        entityId,
        displayName: 'Semantic geography entity',
      })),
    ];
    const document: WorldDocument = Object.freeze({
      ...source,
      maps: Object.freeze([
        Object.freeze({
          ...sourceMap,
          entities: Object.freeze([...sourceMap.entities, ...semanticEntities]),
          aspects: Object.freeze([...sourceMap.aspects, upstream, ...semanticAspects]),
        }),
      ]),
    });

    const encoded = encodeMapworld(document);
    expect(encoded.ok, encoded.ok ? undefined : JSON.stringify(encoded.diagnostics)).toBe(true);
    if (!encoded.ok) return;
    const reopened = decodeMapworld(encoded.value);
    expect(reopened.ok, reopened.ok ? undefined : JSON.stringify(reopened.diagnostics)).toBe(true);
    if (!reopened.ok) return;
    const reopenedMap = reopened.value.maps[0];
    if (reopenedMap === undefined) throw new Error('Reopened world map is missing.');
    for (const aspect of semanticAspects) {
      const decoded = reopenedMap.aspects.find(({ aspectId }) => aspectId === aspect.aspectId);
      expect(decoded).toBeDefined();
      if (decoded === undefined) continue;
      expect(bytes(canonicalAspectBytes(decoded))).toStrictEqual(
        bytes(canonicalAspectBytes(aspect)),
      );
    }
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

function bytes(result: ReturnType<typeof canonicalAspectBytes>): Uint8Array {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}
