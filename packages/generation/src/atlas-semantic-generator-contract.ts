/** Immutable #59 generator manifest, proposal patch, and aspect metadata. */

import {
  type AcceptedAspectRecord,
  type AspectId,
  ATLAS_ASPECT_DEFINITIONS,
  ATLAS_SEMANTIC_CLASSIFICATION_VERSION,
  type AtlasLandWaterRecords,
  type AtlasSemanticGeographyRecords,
  createVariantRevision,
  deriveAtlasAspectId,
  DETERMINISTIC_STREAM_VERSION,
  type EntityId,
  formatWorldSeed,
  type IslandGroup,
  type Landmass,
  type MapEntitySeedInput,
  type MapId,
  parseSeedInput,
  SEED_DERIVATION_VERSION,
  type VariantRevision,
  type WaterBody,
  type WorldSeed,
} from '@ttrpg-map/core';

import {
  type AtlasSemanticClassificationDiagnostic,
  classifyAtlasSemanticGeography,
} from './atlas-semantic-classifier.js';
import {
  ATLAS_SEMANTIC_CLASSIFICATION_PARAMETERS,
  ATLAS_SEMANTIC_GENERATOR_MANIFEST_VERSION,
  ATLAS_SEMANTIC_PARAMETER_SCHEMA_VERSION,
  ATLAS_SEMANTIC_POLICY_VERSION,
  type AtlasSemanticClassificationParameters,
} from './atlas-semantic-classifier-policy.js';
import type { GenerationProposal } from './generator-contracts.js';

export const ATLAS_SEMANTIC_DIAGNOSTIC_CODES = Object.freeze({
  classificationAmbiguous: 'atlas.semantic.classification-ambiguous',
  classificationImpossible: 'atlas.semantic.classification-impossible',
  componentDisconnected: 'atlas.semantic.component-disconnected',
  identityCollision: 'atlas.semantic.identity-collision',
  inputInvalid: 'atlas.semantic.input-invalid',
  outputInvalid: 'atlas.semantic.output-invalid',
  ownershipMissing: 'atlas.semantic.ownership-missing',
  ownershipOverlap: 'atlas.semantic.ownership-overlap',
  relationshipInvalid: 'atlas.semantic.relationship-invalid',
} as const);

export const ATLAS_SEMANTIC_GENERATOR_MANIFEST = Object.freeze({
  manifestVersion: ATLAS_SEMANTIC_GENERATOR_MANIFEST_VERSION,
  classificationVersion: ATLAS_SEMANTIC_CLASSIFICATION_VERSION,
  parameterSchemaVersion: ATLAS_SEMANTIC_PARAMETER_SCHEMA_VERSION,
  policyVersion: ATLAS_SEMANTIC_POLICY_VERSION,
  inputAspect: 'worldSurface.landWaterClassification',
  outputAspects: Object.freeze([
    'landmass.classification',
    'islandGroup.classification',
    'waterBody.classification',
  ] as const),
  randomDrawPolicy: 'zero-draws',
  seedScope: 'map/entity',
  topology: Object.freeze({
    adjacency: 'wrapped-four-neighbor-with-single-poles',
    longitudeWrap: true,
    poleVerticesPerPole: 1,
  }),
  thresholds: ATLAS_SEMANTIC_CLASSIFICATION_PARAMETERS,
});

export interface AtlasSemanticGenerationInput {
  readonly worldSeed: WorldSeed;
  readonly worldMapId: MapId;
  readonly worldSurfaceEntityId: EntityId;
  readonly landWaterClassificationAspectId: AspectId;
  readonly records: AtlasLandWaterRecords;
  readonly previousRecords?: AtlasSemanticGeographyRecords;
  /** Current accepted aspects may include unrelated geography, appearance, and paper records. */
  readonly previousAcceptedAspects: readonly AcceptedAspectRecord[];
}

export type AtlasSemanticAspectOutput = IslandGroup | Landmass | WaterBody;
export type AtlasSemanticAspectProposal = GenerationProposal<
  AtlasSemanticClassificationParameters,
  AtlasSemanticAspectOutput,
  MapEntitySeedInput
>;

export interface AtlasSemanticGeographyProposedPatch {
  readonly patchKind: 'replace-atlas-semantic-geography';
  readonly operationMode: 'geography-dependency-recompute';
  readonly records: AtlasSemanticGeographyRecords;
  readonly replacements: readonly AtlasSemanticAspectProposal[];
  readonly removedAspectIds: readonly AspectId[];
  readonly addedEntityIds: readonly EntityId[];
  readonly removedEntityIds: readonly EntityId[];
  readonly retainedEntityIds: readonly EntityId[];
  /** Dependency recomputation never increments a semantic aspect revision. */
  readonly explicitlyIncrementedAspectIds: readonly [];
}

export type AtlasSemanticGenerationResult =
  | { readonly status: 'proposed'; readonly patch: AtlasSemanticGeographyProposedPatch }
  | {
      readonly status: 'invalid';
      readonly diagnostics: readonly AtlasSemanticClassificationDiagnostic[];
    };

/** Classify records and produce only the declared semantic geography aspect replacements. */
export function generateAtlasSemanticGeography(
  input: AtlasSemanticGenerationInput,
): AtlasSemanticGenerationResult {
  const classified = classifyAtlasSemanticGeography(input);
  if (!classified.ok)
    return Object.freeze({ status: 'invalid', diagnostics: classified.diagnostics });
  const previousByAspectId = new Map(
    input.previousAcceptedAspects
      .filter(isSemanticClassificationAspect)
      .map((aspect) => [aspect.aspectId, aspect] as const),
  );
  const replacements: AtlasSemanticAspectProposal[] = [];
  const landAspectIds = new Map<EntityId, AspectId>();
  for (const landmass of classified.records.landmasses) {
    landAspectIds.set(
      landmass.entityId,
      deriveAtlasAspectId(landmass.entityId, 'landmass.classification'),
    );
  }
  for (const landmass of classified.records.landmasses) {
    replacements.push(
      proposal(
        input,
        landmass.entityId,
        'landmass.classification',
        landmass,
        [input.landWaterClassificationAspectId],
        previousByAspectId,
      ),
    );
  }
  for (const group of classified.records.islandGroups) {
    replacements.push(
      proposal(
        input,
        group.entityId,
        'islandGroup.classification',
        group,
        [
          input.landWaterClassificationAspectId,
          ...group.memberLandmassIds.flatMap((entityId) => {
            const aspectId = landAspectIds.get(entityId);
            return aspectId === undefined ? [] : [aspectId];
          }),
        ],
        previousByAspectId,
      ),
    );
  }
  for (const waterBody of classified.records.waterBodies) {
    replacements.push(
      proposal(
        input,
        waterBody.entityId,
        'waterBody.classification',
        waterBody,
        [
          input.landWaterClassificationAspectId,
          ...waterBody.adjacentLandmassIds.flatMap((entityId) => {
            const aspectId = landAspectIds.get(entityId);
            return aspectId === undefined ? [] : [aspectId];
          }),
        ],
        previousByAspectId,
      ),
    );
  }
  replacements.sort(compareProposal);

  const nextEntityIds = semanticEntityIds(classified.records);
  const previousEntityIds =
    input.previousRecords === undefined ? [] : semanticEntityIds(input.previousRecords);
  const nextSet = new Set(nextEntityIds);
  const previousSet = new Set(previousEntityIds);
  const nextAspectIds = new Set(replacements.map(({ target }) => target.aspect.aspectId));
  const removedAspectIds = input.previousAcceptedAspects
    .filter(isSemanticClassificationAspect)
    .map(({ aspectId }) => aspectId)
    .filter((aspectId) => !nextAspectIds.has(aspectId))
    .sort();
  return Object.freeze({
    status: 'proposed',
    patch: Object.freeze({
      patchKind: 'replace-atlas-semantic-geography',
      operationMode: 'geography-dependency-recompute',
      records: classified.records,
      replacements: Object.freeze(replacements),
      removedAspectIds: Object.freeze(removedAspectIds),
      addedEntityIds: Object.freeze(nextEntityIds.filter((entityId) => !previousSet.has(entityId))),
      removedEntityIds: Object.freeze(
        previousEntityIds.filter((entityId) => !nextSet.has(entityId)),
      ),
      retainedEntityIds: Object.freeze(
        nextEntityIds.filter((entityId) => previousSet.has(entityId)),
      ),
      explicitlyIncrementedAspectIds: Object.freeze([] as const),
    }),
  });
}

function proposal(
  input: AtlasSemanticGenerationInput,
  entityId: EntityId,
  kind: 'islandGroup.classification' | 'landmass.classification' | 'waterBody.classification',
  output: AtlasSemanticAspectOutput,
  dependencyAspectIds: readonly AspectId[],
  previousByAspectId: ReadonlyMap<AspectId, AcceptedAspectRecord>,
): AtlasSemanticAspectProposal {
  const definition = aspectDefinition(kind);
  const aspectId = deriveAtlasAspectId(entityId, kind);
  const revision = previousByAspectId.get(aspectId)?.variantRevision ?? revisionZero();
  const seedMetadata = mapEntitySeed(
    input.worldSeed,
    input.worldMapId,
    entityId,
    definition.generatorId,
    definition.aspectName,
    revision,
  );
  return Object.freeze({
    status: 'proposed',
    target: Object.freeze({
      mapId: input.worldMapId,
      entityId,
      aspect: Object.freeze({ aspectId }),
      aspectName: definition.aspectName,
      variantRevision: revision,
    }),
    generatorId: definition.generatorId,
    generatorVersion: definition.generatorVersion,
    parameterSchemaVersion: definition.parameterSchemaVersion,
    parameters: ATLAS_SEMANTIC_CLASSIFICATION_PARAMETERS,
    seedScope: 'map/entity',
    seedMetadata,
    dependencyAspects: Object.freeze(
      [...new Set(dependencyAspectIds)]
        .sort()
        .map((dependencyAspectId) => Object.freeze({ aspectId: dependencyAspectId })),
    ),
    output,
    diagnostics: Object.freeze([]),
  });
}

function aspectDefinition(
  kind: 'islandGroup.classification' | 'landmass.classification' | 'waterBody.classification',
): (typeof ATLAS_ASPECT_DEFINITIONS)[number] {
  const definition = ATLAS_ASPECT_DEFINITIONS.find((candidate) => candidate.kind === kind);
  if (definition === undefined) throw new Error('Missing semantic atlas aspect definition.');
  return definition;
}

function mapEntitySeed(
  worldSeed: WorldSeed,
  mapId: MapId,
  entityId: EntityId,
  generatorId: (typeof ATLAS_ASPECT_DEFINITIONS)[number]['generatorId'],
  aspectName: (typeof ATLAS_ASPECT_DEFINITIONS)[number]['aspectName'],
  variantRevision: VariantRevision,
): MapEntitySeedInput {
  const parsed = parseSeedInput({
    seedDerivationVersion: SEED_DERIVATION_VERSION,
    deterministicStreamVersion: DETERMINISTIC_STREAM_VERSION,
    seedScope: 'map/entity',
    worldSeed: formatWorldSeed(worldSeed),
    generatorId,
    generatorVersion: 1,
    aspectName,
    variantRevision,
    mapId,
    entityId,
  });
  if (!parsed.ok || parsed.value.seedScope !== 'map/entity') {
    throw new Error('Semantic atlas metadata did not produce a map/entity seed namespace.');
  }
  return parsed.value;
}

function semanticEntityIds(records: AtlasSemanticGeographyRecords): readonly EntityId[] {
  return Object.freeze(
    [
      ...records.landmasses.map(({ entityId }) => entityId),
      ...records.islandGroups.map(({ entityId }) => entityId),
      ...records.waterBodies.map(({ entityId }) => entityId),
    ].sort(),
  );
}

function compareProposal(
  left: AtlasSemanticAspectProposal,
  right: AtlasSemanticAspectProposal,
): number {
  const leftRank = aspectRank(left.target.aspectName);
  const rightRank = aspectRank(right.target.aspectName);
  return (
    leftRank - rightRank || compareAscii(left.target.aspect.aspectId, right.target.aspect.aspectId)
  );
}

function aspectRank(aspectName: string): number {
  if (aspectName === 'landmass.classification') return 0;
  if (aspectName === 'islandGroup.classification') return 1;
  return 2;
}

function isSemanticClassificationAspect(aspect: AcceptedAspectRecord): boolean {
  return (
    aspect.aspectName === 'landmass.classification' ||
    aspect.aspectName === 'islandGroup.classification' ||
    aspect.aspectName === 'waterBody.classification'
  );
}

function revisionZero(): VariantRevision {
  const revision = createVariantRevision(0);
  if (!revision.ok) throw new Error('Semantic atlas revision zero is invalid.');
  return revision.value;
}

function compareAscii(left: string, right: string): -1 | 0 | 1 {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
