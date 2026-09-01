/** Generator-free reconstruction and envelope validation for accepted atlas names and labels. */

import type { AtlasGeographyRecords } from './atlas-geography-model.js';
import {
  ATLAS_LABEL_PLACEMENT_ASPECT_NAME,
  ATLAS_LABEL_PLACEMENT_BEHAVIOR_VERSION,
  ATLAS_LABEL_PLACEMENT_GENERATOR_ID,
  ATLAS_LABEL_PLACEMENT_PARAMETER_SCHEMA_VERSION,
  type AtlasLabelPlacement,
  deriveAtlasLabelPlacementAspectId,
} from './atlas-label-placement.js';
import type { AcceptedAspectRecord } from './generated-aspects.js';
import type { WorldMap } from './world-document.js';
import {
  collectWorldFeatureNameSources,
  deriveWorldFeatureNameAspectId,
  validateWorldFeatureNameContent,
  WORLD_FEATURE_NAME_ASPECT_NAME,
  WORLD_FEATURE_NAME_BEHAVIOR_VERSION,
  WORLD_FEATURE_NAME_GENERATOR_ID,
  WORLD_FEATURE_NAME_PARAMETER_SCHEMA_VERSION,
  type WorldFeatureNameContent,
} from './world-feature-name-model.js';
import type { WorldPhysicalContextRecords } from './world-physical-context-model.js';

export const ATLAS_LABEL_ACCEPTED_ASPECT_NAMES: ReadonlySet<string> = new Set([
  WORLD_FEATURE_NAME_ASPECT_NAME,
  ATLAS_LABEL_PLACEMENT_ASPECT_NAME,
]);

export interface AcceptedAtlasLabelRecords {
  readonly names: readonly WorldFeatureNameContent[];
  readonly placements: readonly AtlasLabelPlacement[];
}

export type ReconstructAcceptedAtlasLabelsResult =
  | { readonly status: 'absent' }
  | { readonly status: 'accepted'; readonly value: AcceptedAtlasLabelRecords }
  | { readonly status: 'invalid'; readonly message: string };

export function isAtlasLabelAcceptedAspectName(value: string): boolean {
  return ATLAS_LABEL_ACCEPTED_ASPECT_NAMES.has(value);
}

/** Reconstruct accepted records without loading a glyph pack or invoking either producer. */
export function reconstructAcceptedAtlasLabels(
  map: WorldMap,
  geography: AtlasGeographyRecords,
  physical: WorldPhysicalContextRecords | undefined,
): ReconstructAcceptedAtlasLabelsResult {
  const aspects = map.aspects.filter(({ aspectName }) =>
    isAtlasLabelAcceptedAspectName(aspectName),
  );
  if (aspects.length === 0) return Object.freeze({ status: 'absent' });
  if (physical === undefined)
    return invalid('Accepted atlas labels require complete physical state.');

  const expectedSources = collectWorldFeatureNameSources(geography, physical);
  const expectedByEntity = new Map(expectedSources.map((source) => [source.entityId, source]));
  const nameAspects = aspects
    .filter(({ aspectName }) => aspectName === WORLD_FEATURE_NAME_ASPECT_NAME)
    .sort(compareEntity);
  const placementAspects = aspects
    .filter(({ aspectName }) => aspectName === ATLAS_LABEL_PLACEMENT_ASPECT_NAME)
    .sort(compareEntity);
  if (nameAspects.length !== expectedSources.length) {
    return invalid('Accepted atlas labels require exactly one name for every eligible feature.');
  }

  const names: WorldFeatureNameContent[] = [];
  const nameAspectByEntity = new Map<string, AcceptedAspectRecord>();
  const uniqueness = new Set<string>();
  for (const aspect of nameAspects) {
    const source = expectedByEntity.get(aspect.entityId);
    if (!isRecord(aspect.acceptedOutput) || !isRecord(aspect.parameters)) {
      return invalid('An accepted world-feature name has invalid content or parameters.');
    }
    const output = aspect.acceptedOutput as unknown as WorldFeatureNameContent;
    if (
      source?.nameKind !== output.nameKind ||
      source.entityId !== output.entityId ||
      !validNameEnvelope(aspect, output)
    ) {
      return invalid('An accepted world-feature name has invalid ownership or provenance.');
    }
    const uniqueKey = `${output.nameKind}\0${output.comparisonKey}`;
    if (uniqueness.has(uniqueKey)) {
      return invalid('Accepted world-feature names are duplicated inside a uniqueness domain.');
    }
    uniqueness.add(uniqueKey);
    nameAspectByEntity.set(output.entityId, aspect);
    names.push(output);
  }

  const placements: AtlasLabelPlacement[] = [];
  let packFingerprint: string | undefined;
  for (const aspect of placementAspects) {
    const nameAspect = nameAspectByEntity.get(aspect.entityId);
    const name = nameAspect?.acceptedOutput as WorldFeatureNameContent | undefined;
    if (!hasPlacementShape(aspect.acceptedOutput) || !isRecord(aspect.parameters)) {
      return invalid('An accepted atlas placement has invalid content or parameters.');
    }
    const output = aspect.acceptedOutput;
    if (
      nameAspect === undefined ||
      name === undefined ||
      !validPlacementEnvelope(aspect, output, name, nameAspect)
    ) {
      return invalid('An accepted atlas placement has invalid name linkage or provenance.');
    }
    if (packFingerprint !== undefined && packFingerprint !== output.glyphPackSha256) {
      return invalid('Accepted atlas placements reference more than one glyph pack.');
    }
    packFingerprint = output.glyphPackSha256;
    placements.push(output);
  }
  if (new Set(placementAspects.map(({ entityId }) => entityId)).size !== placementAspects.length) {
    return invalid('Accepted atlas placements duplicate a named source.');
  }
  if (
    expectedSources.some(
      ({ entityId }) => !map.entities.some((entity) => entity.entityId === entityId),
    )
  ) {
    return invalid('An eligible named feature is missing world-map entity ownership.');
  }

  return Object.freeze({
    status: 'accepted',
    value: Object.freeze({ names: Object.freeze(names), placements: Object.freeze(placements) }),
  });
}

function validNameEnvelope(aspect: AcceptedAspectRecord, output: WorldFeatureNameContent): boolean {
  const parameters = aspect.parameters as Readonly<Record<string, unknown>>;
  return (
    validateWorldFeatureNameContent(output) &&
    aspect.aspectId === deriveWorldFeatureNameAspectId(output.entityId) &&
    aspect.aspectName === WORLD_FEATURE_NAME_ASPECT_NAME &&
    aspect.generatorId === WORLD_FEATURE_NAME_GENERATOR_ID &&
    aspect.generatorVersion === WORLD_FEATURE_NAME_BEHAVIOR_VERSION &&
    aspect.parameterSchemaVersion === WORLD_FEATURE_NAME_PARAMETER_SCHEMA_VERSION &&
    aspect.variantRevision === output.variantRevision &&
    aspect.seedScope === 'map/entity' &&
    validSeedEnvelope(aspect) &&
    aspect.dependencyAspects.length === 0 &&
    parameters.parameterSchemaVersion === WORLD_FEATURE_NAME_PARAMETER_SCHEMA_VERSION &&
    parameters.nameContentBehaviorVersion === output.nameContentBehaviorVersion &&
    parameters.lexiconVersion === output.lexiconVersion &&
    validDiagnostics(aspect)
  );
}

function validPlacementEnvelope(
  aspect: AcceptedAspectRecord,
  output: AtlasLabelPlacement,
  name: WorldFeatureNameContent,
  nameAspect: AcceptedAspectRecord,
): boolean {
  const parameters = aspect.parameters as Readonly<Record<string, unknown>>;
  return (
    output.placementId === deriveAtlasLabelPlacementAspectId(name.entityId) &&
    aspect.aspectId === output.placementId &&
    aspect.entityId === name.entityId &&
    aspect.aspectName === ATLAS_LABEL_PLACEMENT_ASPECT_NAME &&
    aspect.generatorId === ATLAS_LABEL_PLACEMENT_GENERATOR_ID &&
    aspect.generatorVersion === ATLAS_LABEL_PLACEMENT_BEHAVIOR_VERSION &&
    aspect.parameterSchemaVersion === ATLAS_LABEL_PLACEMENT_PARAMETER_SCHEMA_VERSION &&
    aspect.variantRevision === output.variantRevision &&
    aspect.seedScope === 'map/entity' &&
    validSeedEnvelope(aspect) &&
    aspect.dependencyAspects.length === 1 &&
    aspect.dependencyAspects[0]?.aspectId === nameAspect.aspectId &&
    output.sourceEntityId === name.entityId &&
    output.sourceNameAspectId === nameAspect.aspectId &&
    output.sourceNameVariantRevision === name.variantRevision &&
    output.displayText === name.displayName &&
    output.glyphAssetSchemaVersion === 1 &&
    output.glyphBehaviorVersion === 1 &&
    output.placementBehaviorVersion === ATLAS_LABEL_PLACEMENT_BEHAVIOR_VERSION &&
    /^[a-f0-9]{64}$/u.test(output.glyphPackSha256) &&
    parameters.parameterSchemaVersion === ATLAS_LABEL_PLACEMENT_PARAMETER_SCHEMA_VERSION &&
    parameters.placementBehaviorVersion === ATLAS_LABEL_PLACEMENT_BEHAVIOR_VERSION &&
    parameters.glyphPackSha256 === output.glyphPackSha256 &&
    validPlacementGeometry(output) &&
    validDiagnostics(aspect)
  );
}

function validPlacementGeometry(output: AtlasLabelPlacement): boolean {
  const values = [
    output.priority,
    output.fontSizeTicks,
    output.baseline.xTicks,
    output.baseline.yTicks,
    output.bounds.minXTicks,
    output.bounds.minYTicks,
    output.bounds.maxXTicks,
    output.bounds.maxYTicks,
  ];
  const visibleCharacters = Array.from(output.displayText).filter((character) => character !== ' ');
  return (
    values.every(Number.isSafeInteger) &&
    output.fontSizeTicks > 0 &&
    output.bounds.minXTicks <= output.bounds.maxXTicks &&
    output.bounds.minYTicks <= output.bounds.maxYTicks &&
    /^[a-z][a-z0-9-]{0,63}$/u.test(output.selectedVariantKey) &&
    output.glyphOrigins.length === visibleCharacters.length &&
    output.glyphOrigins.every((origin, index) => {
      const character = visibleCharacters[index];
      return (
        character !== undefined &&
        origin.glyphKey === character &&
        origin.codePoint === character.codePointAt(0) &&
        Number.isSafeInteger(origin.xTicks) &&
        Number.isSafeInteger(origin.yTicks)
      );
    })
  );
}

function hasPlacementShape(value: unknown): value is AtlasLabelPlacement {
  if (!isRecord(value) || !isRecord(value.baseline) || !isRecord(value.bounds)) return false;
  if (!Array.isArray(value.glyphOrigins)) return false;
  const glyphOrigins: readonly unknown[] = value.glyphOrigins;
  return (
    typeof value.placementId === 'string' &&
    typeof value.sourceEntityId === 'string' &&
    typeof value.sourceNameAspectId === 'string' &&
    typeof value.displayText === 'string' &&
    typeof value.glyphAssetId === 'string' &&
    typeof value.glyphPackSha256 === 'string' &&
    typeof value.selectedVariantKey === 'string' &&
    typeof value.sourceNameVariantRevision === 'number' &&
    typeof value.glyphAssetSchemaVersion === 'number' &&
    typeof value.glyphBehaviorVersion === 'number' &&
    typeof value.placementBehaviorVersion === 'number' &&
    typeof value.variantRevision === 'number' &&
    typeof value.priority === 'number' &&
    typeof value.fontSizeTicks === 'number' &&
    typeof value.baseline.xTicks === 'number' &&
    typeof value.baseline.yTicks === 'number' &&
    typeof value.bounds.minXTicks === 'number' &&
    typeof value.bounds.minYTicks === 'number' &&
    typeof value.bounds.maxXTicks === 'number' &&
    typeof value.bounds.maxYTicks === 'number' &&
    glyphOrigins.every(
      (origin) =>
        isRecord(origin) &&
        typeof origin.glyphKey === 'string' &&
        typeof origin.codePoint === 'number' &&
        typeof origin.xTicks === 'number' &&
        typeof origin.yTicks === 'number',
    )
  );
}

function validSeedEnvelope(aspect: AcceptedAspectRecord): boolean {
  const seed = aspect.seedMetadata;
  return (
    seed.seedScope === 'map/entity' &&
    seed.mapId === aspect.mapId &&
    seed.entityId === aspect.entityId &&
    seed.aspectName === aspect.aspectName &&
    seed.generatorId === aspect.generatorId &&
    seed.generatorVersion === aspect.generatorVersion &&
    seed.variantRevision === aspect.variantRevision
  );
}

function validDiagnostics(aspect: AcceptedAspectRecord): boolean {
  return aspect.diagnostics.every(
    ({ severity, target }) => severity !== 'error' && target.aspectId === aspect.aspectId,
  );
}

function compareEntity(left: AcceptedAspectRecord, right: AcceptedAspectRecord): number {
  return left.entityId < right.entityId ? -1 : left.entityId > right.entityId ? 1 : 0;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(message: string): ReconstructAcceptedAtlasLabelsResult {
  return Object.freeze({ status: 'invalid', message });
}
