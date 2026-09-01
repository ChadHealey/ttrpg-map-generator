import {
  type AcceptedAspectRecord,
  type AtlasGeographyRecords,
  collectWorldFeatureNameSources,
  deriveWorldFeatureNameAspectId,
  DETERMINISTIC_STREAM_VERSION,
  type EntityId,
  type InheritedContextNamedAnchor,
  SEED_DERIVATION_VERSION,
  validateWorldFeatureNameContent,
  WORLD_FEATURE_NAME_ASPECT_NAME,
  WORLD_FEATURE_NAME_BEHAVIOR_VERSION,
  WORLD_FEATURE_NAME_GENERATOR_ID,
  WORLD_FEATURE_NAME_PARAMETER_SCHEMA_VERSION,
  type WorldFeatureNameContent,
  type WorldFeatureNameParameters,
  type WorldMap,
  type WorldPhysicalContextRecords,
  type WorldSeed,
} from '@ttrpg-map/core';

interface AcceptedNameSource {
  readonly rootMap: WorldMap;
  readonly worldSeed: WorldSeed;
  readonly geography: AtlasGeographyRecords;
  readonly physical: WorldPhysicalContextRecords;
  readonly acceptedNameAspects: readonly AcceptedAspectRecord<
    WorldFeatureNameParameters,
    WorldFeatureNameContent
  >[];
}

export function validateInheritedContextNameAspects(source: AcceptedNameSource) {
  const expected = collectWorldFeatureNameSources(source.geography, source.physical);
  if (source.acceptedNameAspects.length !== expected.length)
    return {
      ok: false as const,
      message: 'Accepted name aspects must cover every eligible world feature.',
    };
  const expectedByEntity = new Map(expected.map((item) => [item.entityId, item]));
  const seen = new Set<EntityId>();
  const claimedNames = new Set<string>();
  for (const aspect of source.acceptedNameAspects) {
    const content = aspect.acceptedOutput;
    const seed = aspect.seedMetadata;
    const parameters = aspect.parameters;
    const nameClaim = `${content.nameKind}\n${content.comparisonKey}`;
    if (
      expectedByEntity.get(content.entityId)?.nameKind !== content.nameKind ||
      seen.has(content.entityId) ||
      claimedNames.has(nameClaim) ||
      !validateWorldFeatureNameContent(content) ||
      aspect.mapId !== source.rootMap.mapId ||
      aspect.entityId !== content.entityId ||
      aspect.aspectId !== deriveWorldFeatureNameAspectId(content.entityId) ||
      aspect.aspectName !== WORLD_FEATURE_NAME_ASPECT_NAME ||
      aspect.generatorId !== WORLD_FEATURE_NAME_GENERATOR_ID ||
      aspect.generatorVersion !== WORLD_FEATURE_NAME_BEHAVIOR_VERSION ||
      aspect.parameterSchemaVersion !== WORLD_FEATURE_NAME_PARAMETER_SCHEMA_VERSION ||
      aspect.variantRevision !== content.variantRevision ||
      aspect.seedScope !== 'map/entity' ||
      seed.seedScope !== 'map/entity' ||
      seed.seedDerivationVersion !== SEED_DERIVATION_VERSION ||
      seed.deterministicStreamVersion !== DETERMINISTIC_STREAM_VERSION ||
      seed.worldSeed !== source.worldSeed ||
      seed.mapId !== source.rootMap.mapId ||
      seed.entityId !== content.entityId ||
      seed.generatorId !== aspect.generatorId ||
      seed.generatorVersion !== aspect.generatorVersion ||
      seed.aspectName !== aspect.aspectName ||
      seed.variantRevision !== content.variantRevision ||
      parameters.parameterSchemaVersion !== aspect.parameterSchemaVersion ||
      parameters.lexiconVersion !== content.lexiconVersion ||
      parameters.nameContentBehaviorVersion !== content.nameContentBehaviorVersion ||
      aspect.dependencyAspects.length !== 0 ||
      aspect.diagnostics.some(
        ({ severity, target }) => severity === 'error' || target.aspectId !== aspect.aspectId,
      )
    )
      return {
        ok: false as const,
        message:
          'Accepted name aspect ownership, parameters, seed metadata, or content is invalid.',
      };
    seen.add(content.entityId);
    claimedNames.add(nameClaim);
  }
  return {
    ok: true as const,
    aspects: Object.freeze(
      [...source.acceptedNameAspects].sort((left, right) =>
        compareAscii(left.aspectId, right.aspectId),
      ),
    ),
  };
}

export function toInheritedContextNamedAnchor(
  aspect: AcceptedAspectRecord<WorldFeatureNameParameters, WorldFeatureNameContent>,
): InheritedContextNamedAnchor {
  const content = aspect.acceptedOutput;
  return Object.freeze({
    sourceMapId: aspect.mapId,
    sourceEntityId: aspect.entityId,
    sourceAspectId: aspect.aspectId,
    nameKind: content.nameKind,
    displayName: content.displayName,
    nameContentBehaviorVersion: content.nameContentBehaviorVersion,
    lexiconVersion: content.lexiconVersion,
    variantRevision: content.variantRevision,
    origin: content.origin,
  });
}

function compareAscii(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}
