/** Stable atlas identities and complete proposal assembly for desktop orchestration. */

import {
  ATLAS_APPEARANCE_PARAMETER_SCHEMA_VERSION,
  type AtlasAppearanceAspectProposal,
  RESTRAINED_INK_ATLAS_STYLE,
} from '@ttrpg-map/assets';
import {
  type AcceptedAspectRecord,
  type AspectId,
  type AspectReplacementProposal,
  ATLAS_ASPECT_DEFINITIONS,
  ATLAS_DOCUMENT_OPERATION_MODES,
  type AtlasControls,
  type AtlasDocumentOperationMode,
  type AtlasGeographyRecords,
  createVariantRevision,
  deriveAtlasSingletonEntityIds,
  deriveAtlasWorldRadius,
  deriveStableId,
  type EntityId,
  type MapEntity,
  type MapId,
  parseSemanticKey,
  parseStableId,
  type RootSurfaceId,
  type VariantRevision,
  type WorldDocument,
  type WorldDocumentId,
  type WorldRadius,
  type WorldSeed,
} from '@ttrpg-map/core';

import type {
  AcceptedAtlasState,
  AtlasWorkflowGenerationRequest,
  AtlasWorkflowOperation,
} from './atlas-workflow-generation.js';

export const ATLAS_PROOF_WORLD_MAP_ID = requiredId('map', 'a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7');
export const ATLAS_PROOF_ROOT_SURFACE_ID = deriveRootSurfaceId(
  ATLAS_PROOF_WORLD_MAP_ID,
  'atlas-root-surface',
);
const ATLAS_PROOF_WORLD_DOCUMENT_ID = requiredId(
  'world-document',
  '78b2157c-4f2c-5ac7-986b-76dc808f377e',
);
const APPEARANCE_NAMES: readonly string[] = Object.freeze([
  'atlas.coastlineAppearance',
  'atlas.paperTreatment',
  'atlas.waterDecoration',
]);

export function createAtlasShell(worldSeed: WorldSeed, controls: AtlasControls): WorldDocument {
  const singletonIds = deriveAtlasSingletonEntityIds(ATLAS_PROOF_WORLD_MAP_ID);
  return Object.freeze({
    worldDocumentId: ATLAS_PROOF_WORLD_DOCUMENT_ID,
    displayName: 'Milestone 2 whole-world atlas',
    worldSeed,
    rootMapId: ATLAS_PROOF_WORLD_MAP_ID,
    maps: Object.freeze([
      Object.freeze({
        mapId: ATLAS_PROOF_WORLD_MAP_ID,
        mapKind: 'world',
        scaleClass: 'world',
        displayName: 'Whole-world atlas',
        coordinateSystem: Object.freeze({
          kind: 'planet-sphere',
          rootSurfaceId: ATLAS_PROOF_ROOT_SURFACE_ID,
          radius: requiredAtlasRadius(controls.worldCircumferenceKm),
        }),
        extent: Object.freeze({ kind: 'whole-surface' }),
        entities: Object.freeze([
          entity(singletonIds.worldSurfaceEntityId, 'World surface'),
          entity(singletonIds.worldCoastlineEntityId, 'World coastline'),
          entity(singletonIds.atlasPresentationEntityId, 'Atlas presentation'),
        ]),
        aspects: Object.freeze([]),
        constraints: Object.freeze([]),
        locks: Object.freeze([]),
        decoration: Object.freeze({ aspectReferences: Object.freeze([]) }),
        layout: Object.freeze({ aspectReferences: Object.freeze([]) }),
      }),
    ]),
  });
}

export function atlasEntities(
  singletonIds: ReturnType<typeof deriveAtlasSingletonEntityIds>,
  records: AtlasGeographyRecords,
): readonly MapEntity[] {
  return Object.freeze(
    [
      entity(singletonIds.worldSurfaceEntityId, 'World surface'),
      entity(singletonIds.worldCoastlineEntityId, 'World coastline'),
      entity(singletonIds.atlasPresentationEntityId, 'Atlas presentation'),
      ...records.landmasses.map((value) => entity(value.entityId, displayKind(value.kind))),
      ...records.islandGroups.map((value) => entity(value.entityId, displayKind(value.kind))),
      ...records.waterBodies.map((value) => entity(value.entityId, displayKind(value.kind))),
    ].sort((left, right) =>
      left.entityId < right.entityId ? -1 : left.entityId > right.entityId ? 1 : 0,
    ),
  );
}

export function appearanceProposal(
  proposal: AtlasAppearanceAspectProposal<unknown>,
): AspectReplacementProposal {
  const definition = ATLAS_ASPECT_DEFINITIONS.find(
    ({ aspectName }) => aspectName === proposal.target.aspectName,
  );
  if (definition === undefined) throw new Error('Missing accepted atlas appearance definition.');
  return Object.freeze({
    status: 'proposed',
    target: Object.freeze({
      mapId: proposal.target.mapId,
      entityId: proposal.target.entityId,
      aspect: Object.freeze({ aspectId: proposal.target.aspectId }),
      aspectName: proposal.target.aspectName,
      variantRevision: proposal.target.variantRevision,
    }),
    generatorId: proposal.generatorId,
    generatorVersion: definition.generatorVersion,
    parameterSchemaVersion: definition.parameterSchemaVersion,
    parameters: Object.freeze({
      parameterSchemaVersion: ATLAS_APPEARANCE_PARAMETER_SCHEMA_VERSION,
      styleId: RESTRAINED_INK_ATLAS_STYLE.styleId,
      styleBehaviorVersion: RESTRAINED_INK_ATLAS_STYLE.styleBehaviorVersion,
    }),
    seedScope: 'map/entity',
    seedMetadata: proposal.seedMetadata,
    dependencyAspects: Object.freeze(
      proposal.dependencyAspectIds.map((aspectId) => Object.freeze({ aspectId })),
    ),
    output: proposal.output,
    diagnostics: Object.freeze([]),
  });
}

/** Re-wrap an unchanged accepted record so a complete transaction can prove its isolation set. */
export function retainedAspectProposal(record: AcceptedAspectRecord): AspectReplacementProposal {
  return Object.freeze({
    status: 'proposed',
    target: Object.freeze({
      mapId: record.mapId,
      entityId: record.entityId,
      aspect: Object.freeze({ aspectId: record.aspectId }),
      aspectName: record.aspectName,
      variantRevision: record.variantRevision,
    }),
    generatorId: record.generatorId,
    generatorVersion: record.generatorVersion,
    parameterSchemaVersion: record.parameterSchemaVersion,
    parameters: record.parameters,
    seedScope: record.seedScope,
    seedMetadata: record.seedMetadata,
    dependencyAspects: record.dependencyAspects,
    output: record.acceptedOutput,
    diagnostics: record.diagnostics,
  });
}

export function appearanceRevisionsFor(
  request: AtlasWorkflowGenerationRequest,
  previous: AcceptedAtlasState | undefined,
) {
  const aspects = previous?.document.maps[0]?.aspects ?? [];
  const increment = request.operation === 'appearance-reroll';
  return Object.freeze({
    coastlineAppearance: revisionFor(aspects, 'atlas.coastlineAppearance', increment),
    waterDecoration: revisionFor(aspects, 'atlas.waterDecoration', increment),
    paperTreatment: revisionFor(aspects, 'atlas.paperTreatment', increment),
  });
}

export function explicitlyIncrementedIds(
  request: AtlasWorkflowGenerationRequest,
  proposals: readonly AspectReplacementProposal[],
): readonly AspectId[] {
  const names =
    request.operation === 'geography-reroll'
      ? ['worldTerrain.macroElevation']
      : request.operation === 'appearance-reroll'
        ? APPEARANCE_NAMES
        : [];
  return Object.freeze(
    proposals
      .filter(({ target }) => names.includes(target.aspectName))
      .map(({ target }) => target.aspect.aspectId)
      .sort(),
  );
}

export function operationMode(operation: AtlasWorkflowOperation): AtlasDocumentOperationMode {
  return operation === 'initial-atlas'
    ? ATLAS_DOCUMENT_OPERATION_MODES.initial
    : operation === 'control-driven-replacement'
      ? ATLAS_DOCUMENT_OPERATION_MODES.controls
      : operation === 'geography-reroll'
        ? ATLAS_DOCUMENT_OPERATION_MODES.geographyReroll
        : ATLAS_DOCUMENT_OPERATION_MODES.appearanceReroll;
}

export function requiredAtlasRadius(circumferenceKm: number): WorldRadius {
  const result = deriveAtlasWorldRadius(circumferenceKm);
  if (!result.ok) throw new Error(result.diagnostic.message);
  return result.value;
}

export function revisionFor(
  aspects: readonly AcceptedAspectRecord[],
  aspectName: string,
  increment: boolean,
): VariantRevision {
  const current = aspects.find((aspect) => aspect.aspectName === aspectName)?.variantRevision;
  const value = (current ?? 0) + (increment ? 1 : 0);
  const parsed = createVariantRevision(value);
  if (!parsed.ok) throw new Error(parsed.diagnostic.message);
  return parsed.value;
}

function entity(entityId: EntityId, displayName: string): MapEntity {
  return Object.freeze({ entityId, displayName });
}

function displayKind(kind: string): string {
  return kind.replace(/([A-Z])/g, ' $1').replace(/^./, (first) => first.toUpperCase());
}

function deriveRootSurfaceId(parentId: MapId, key: string): RootSurfaceId {
  const semanticKey = parseSemanticKey(key);
  if (!semanticKey.ok) throw new Error(semanticKey.diagnostic.message);
  return deriveStableId('root-surface', parentId, semanticKey.value);
}

function requiredId(kind: 'map', value: string): MapId;
function requiredId(kind: 'world-document', value: string): WorldDocumentId;
function requiredId(kind: 'map' | 'world-document', value: string): MapId | WorldDocumentId {
  const result = parseStableId(kind, value);
  if (!result.ok) throw new Error(result.diagnostic.message);
  return result.value;
}
