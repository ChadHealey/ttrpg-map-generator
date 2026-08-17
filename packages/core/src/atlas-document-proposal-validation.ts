/** Proposal-record and complete atlas validation used by the atomic transaction boundary. */

import {
  ATLAS_COASTLINE_APPEARANCE_BEHAVIOR_VERSION,
  ATLAS_PAPER_TREATMENT_BEHAVIOR_VERSION,
  ATLAS_WATER_DECORATION_BEHAVIOR_VERSION,
  type AtlasAppearanceRecords,
  type AtlasCoastlineAppearance,
  type AtlasPaperTreatment,
  type AtlasWaterDecoration,
} from './atlas-appearance-model.js';
import {
  ATLAS_DOCUMENT_COMMAND_KIND,
  ATLAS_DOCUMENT_OPERATION_MODES,
  ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES,
  type AtlasDocumentTransactionDiagnostic,
  type CommitAtlasProposalCommand,
} from './atlas-document-transaction-model.js';
import {
  type AtlasAspectKind,
  atlasControlsMatchWorldRadius,
  deriveAtlasAspectId,
  deriveAtlasSingletonEntityIds,
} from './atlas-geography-aspects.js';
import {
  type AtlasGeographyRecords,
  type CanonicalWorldCoastline,
  type IslandGroup,
  type Landmass,
  type LandWaterClassification,
  type MacroElevationField,
  type WaterBody,
} from './atlas-geography-model.js';
import { parseAtlasControls, validateAtlasGeographyRecords } from './atlas-geography-validation.js';
import { parsePlanetPoint } from './coordinates.js';
import {
  type AcceptedAspectRecord,
  type AspectReplacementProposal,
  orderGenerationDiagnostics,
} from './generated-aspects.js';
import { compareStableReferences, type EntityId } from './identity.js';
import { createImmutableDomainSnapshot } from './immutable-domain-snapshot.js';
import { MAP_COORDINATE_SYSTEM_KINDS, type WorldMap } from './world-document.js';
import { deepEqual } from './world-document-transaction-support.js';

export function validateAtlasProposalShape(
  currentMap: WorldMap,
  command: CommitAtlasProposalCommand,
  diagnostics: AtlasDocumentTransactionDiagnostic[],
): void {
  const entityIds = command.proposedEntities.map(({ entityId }) => entityId);
  const aspectIds = command.proposedAspects.map(({ target }) => target.aspect.aspectId);
  const entitySet = new Set(entityIds);
  const aspectSet = new Set(aspectIds);
  const controls = parseAtlasControls(command.controls);
  const commandKind: unknown = command.kind;
  const operationMode: unknown = command.operationMode;
  const coordinateKind: unknown = command.proposedCoordinateSystem.kind;
  const isOperationModeValid = Object.values(ATLAS_DOCUMENT_OPERATION_MODES).some(
    (mode) => mode === operationMode,
  );
  const isCoordinateValid =
    coordinateKind === MAP_COORDINATE_SYSTEM_KINDS.planetSphere &&
    command.proposedCoordinateSystem.rootSurfaceId === currentMap.coordinateSystem.rootSurfaceId &&
    atlasControlsMatchWorldRadius(command.controls, command.proposedCoordinateSystem.radius);
  const proposalsValid = command.proposedAspects.every((proposal) =>
    isValidMapEntityProposal(proposal, command.targetMapId, command.expectedWorldSeed, entitySet),
  );
  if (
    !controls.ok ||
    commandKind !== ATLAS_DOCUMENT_COMMAND_KIND ||
    !isOperationModeValid ||
    !isCoordinateValid ||
    entitySet.size !== entityIds.length ||
    aspectSet.size !== aspectIds.length ||
    !proposalsValid
  ) {
    diagnostics.push(invalidAtlasProposalDiagnosticFromIds(aspectIds, entityIds));
  }
}

export function acceptAtlasProposals(
  proposals: readonly AspectReplacementProposal[],
  diagnostics: AtlasDocumentTransactionDiagnostic[],
): readonly AcceptedAspectRecord[] | undefined {
  const records = proposals.map((proposal) =>
    createImmutableDomainSnapshot<AcceptedAspectRecord>({
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
      diagnostics: orderGenerationDiagnostics(proposal.diagnostics),
      acceptedOutput: proposal.output,
    }),
  );
  if (records.some((record) => !record.ok)) {
    diagnostics.push(
      invalidAtlasProposalDiagnosticFromIds(
        proposals.map(({ target }) => target.aspect.aspectId),
        proposals.map(({ target }) => target.entityId),
      ),
    );
    return undefined;
  }
  return Object.freeze(
    records
      .map((record) => {
        if (!record.ok) throw new Error('Validated atlas proposal snapshot unexpectedly failed.');
        return record.value;
      })
      .sort((left, right) => compareStableReferences(left.aspectId, right.aspectId)),
  );
}

export function validateCompleteAtlasProposal(
  aspects: readonly AcceptedAspectRecord[],
  command: CommitAtlasProposalCommand,
  diagnostics: AtlasDocumentTransactionDiagnostic[],
): void {
  try {
    const singletonIds = deriveAtlasSingletonEntityIds(command.targetMapId);
    const macro = uniqueAspect(aspects, 'worldTerrain.macroElevation');
    const partition = uniqueAspect(aspects, 'worldSurface.landWaterClassification');
    const coastline = uniqueAspect(aspects, 'worldCoastline.geometry');
    const coastlineAppearance = uniqueAspect(aspects, 'atlas.coastlineAppearance');
    const waterDecoration = uniqueAspect(aspects, 'atlas.waterDecoration');
    const paperTreatment = uniqueAspect(aspects, 'atlas.paperTreatment');
    if (
      macro === undefined ||
      partition === undefined ||
      coastline === undefined ||
      coastlineAppearance === undefined ||
      waterDecoration === undefined ||
      paperTreatment === undefined
    ) {
      throw new Error('missing singleton aspect');
    }
    const geography: AtlasGeographyRecords = {
      controls: command.controls,
      macroElevation: macro.acceptedOutput as MacroElevationField,
      landWaterClassification: partition.acceptedOutput as LandWaterClassification,
      semanticClassificationVersion: 1,
      worldMapId: command.targetMapId,
      worldSurfaceEntityId: singletonIds.worldSurfaceEntityId,
      landWaterClassificationAspectId: partition.aspectId,
      landmasses: outputs(aspects, 'landmass.classification') as readonly Landmass[],
      islandGroups: outputs(aspects, 'islandGroup.classification') as readonly IslandGroup[],
      waterBodies: outputs(aspects, 'waterBody.classification') as readonly WaterBody[],
      coastline: coastline.acceptedOutput as CanonicalWorldCoastline,
    };
    const appearance: AtlasAppearanceRecords = {
      atlasPresentationEntityId: singletonIds.atlasPresentationEntityId,
      coastlineAppearance: coastlineAppearance.acceptedOutput as AtlasCoastlineAppearance,
      waterDecoration: waterDecoration.acceptedOutput as AtlasWaterDecoration,
      paperTreatment: paperTreatment.acceptedOutput as AtlasPaperTreatment,
    };
    if (
      !validateAtlasGeographyRecords(geography).ok ||
      appearance.atlasPresentationEntityId !== singletonIds.atlasPresentationEntityId ||
      !appearanceMatchesGeography(geography, appearance) ||
      !hasValidAcceptedEnvelopes(aspects, command, geography)
    ) {
      throw new Error('invalid complete atlas');
    }
  } catch {
    diagnostics.push(invalidAtlasProposalDiagnostic(aspects));
  }
}

function hasValidAcceptedEnvelopes(
  aspects: readonly AcceptedAspectRecord[],
  command: CommitAtlasProposalCommand,
  geography: AtlasGeographyRecords,
): boolean {
  const singletonIds = deriveAtlasSingletonEntityIds(command.targetMapId);
  const expectedSingletonOwners = new Map<
    string,
    { readonly kind: AtlasAspectKind; readonly owner: EntityId }
  >([
    [
      'worldTerrain.macroElevation',
      { kind: 'worldTerrain.macroElevation', owner: singletonIds.worldSurfaceEntityId },
    ],
    [
      'worldSurface.landWaterClassification',
      { kind: 'worldSurface.landWaterClassification', owner: singletonIds.worldSurfaceEntityId },
    ],
    [
      'worldCoastline.geometry',
      { kind: 'worldCoastline.geometry', owner: singletonIds.worldCoastlineEntityId },
    ],
    [
      'atlas.coastlineAppearance',
      { kind: 'atlas.coastlineAppearance', owner: singletonIds.atlasPresentationEntityId },
    ],
    [
      'atlas.paperTreatment',
      { kind: 'atlas.paperTreatment', owner: singletonIds.atlasPresentationEntityId },
    ],
    [
      'atlas.waterDecoration',
      { kind: 'atlas.waterDecoration', owner: singletonIds.atlasPresentationEntityId },
    ],
  ]);
  const semanticById = new Map(
    [...geography.landmasses, ...geography.islandGroups, ...geography.waterBodies].map(
      (value) => [value.entityId, value] as const,
    ),
  );
  const expectedEntityIds = new Set([...singletonIdsToArray(singletonIds), ...semanticById.keys()]);
  const proposedEntityIds = new Set(command.proposedEntities.map(({ entityId }) => entityId));
  if (
    expectedEntityIds.size !== proposedEntityIds.size ||
    [...expectedEntityIds].some((entityId) => !proposedEntityIds.has(entityId))
  ) {
    return false;
  }
  return aspects.every((aspect) => {
    const singleton = expectedSingletonOwners.get(aspect.aspectName);
    if (singleton !== undefined) {
      return (
        aspect.entityId === singleton.owner &&
        aspect.aspectId === deriveAtlasAspectId(singleton.owner, singleton.kind)
      );
    }
    const semantic = semanticById.get(aspect.entityId);
    const expectedName =
      semantic === undefined
        ? undefined
        : 'memberLandmassIds' in semantic
          ? 'islandGroup.classification'
          : 'connectivity' in semantic
            ? 'waterBody.classification'
            : 'landmass.classification';
    return (
      expectedName !== undefined &&
      semantic !== undefined &&
      aspect.aspectName === expectedName &&
      aspect.aspectId === deriveAtlasAspectId(aspect.entityId, expectedName) &&
      (!('sourceClassificationAspectId' in semantic) ||
        semantic.sourceClassificationAspectId === geography.landWaterClassificationAspectId)
    );
  });
}

function singletonIdsToArray(
  ids: ReturnType<typeof deriveAtlasSingletonEntityIds>,
): readonly EntityId[] {
  return [ids.worldSurfaceEntityId, ids.worldCoastlineEntityId, ids.atlasPresentationEntityId];
}

export function invalidAtlasProposalDiagnostic(
  aspects: readonly AcceptedAspectRecord[],
): AtlasDocumentTransactionDiagnostic {
  return invalidAtlasProposalDiagnosticFromIds(
    aspects.map(({ aspectId }) => aspectId),
    aspects.map(({ entityId }) => entityId),
  );
}

function isValidMapEntityProposal(
  proposal: AspectReplacementProposal,
  targetMapId: CommitAtlasProposalCommand['targetMapId'],
  worldSeed: CommitAtlasProposalCommand['expectedWorldSeed'],
  entityIds: ReadonlySet<EntityId>,
): boolean {
  if (proposal.seedScope !== 'map/entity' || proposal.seedMetadata.seedScope !== 'map/entity') {
    return false;
  }
  return (
    proposal.target.mapId === targetMapId &&
    entityIds.has(proposal.target.entityId) &&
    proposal.seedMetadata.worldSeed === worldSeed &&
    proposal.seedMetadata.mapId === targetMapId &&
    proposal.seedMetadata.entityId === proposal.target.entityId &&
    proposal.seedMetadata.generatorId === proposal.generatorId &&
    proposal.seedMetadata.generatorVersion === proposal.generatorVersion &&
    proposal.seedMetadata.aspectName === proposal.target.aspectName &&
    proposal.seedMetadata.variantRevision === proposal.target.variantRevision &&
    proposal.diagnostics.every(
      ({ severity, target }) =>
        severity !== 'error' && target.aspectId === proposal.target.aspect.aspectId,
    )
  );
}

function appearanceMatchesGeography(
  geography: AtlasGeographyRecords,
  appearance: AtlasAppearanceRecords,
): boolean {
  const ringById = new Map(geography.coastline.rings.map((ring) => [ring.ringId, ring] as const));
  const decisions = appearance.coastlineAppearance.ringDecisions;
  const paths = appearance.waterDecoration.paths;
  const waterBodyIds = new Set(geography.waterBodies.map(({ entityId }) => entityId));
  const coastlineBehaviorVersion: unknown =
    appearance.coastlineAppearance.appearanceBehaviorVersion;
  const waterBehaviorVersion: unknown = appearance.waterDecoration.decorationBehaviorVersion;
  const paperBehaviorVersion: unknown = appearance.paperTreatment.treatmentBehaviorVersion;
  const styles = [
    appearance.coastlineAppearance.style,
    appearance.waterDecoration.style,
    appearance.paperTreatment.style,
  ];
  return (
    decisions.length === ringById.size &&
    new Set(decisions.map(({ sourceRingId }) => sourceRingId)).size === decisions.length &&
    decisions.every(
      (decision) =>
        ringById.get(decision.sourceRingId)?.sourceBoundaryFingerprint ===
          decision.sourceBoundaryFingerprint &&
        validPermille(decision.wobblePhasePermille) &&
        validPermille(decision.wobbleStrengthPermille) &&
        validPermille(decision.secondaryPhasePermille) &&
        validPermille(decision.pressurePhasePermille) &&
        validPermille(decision.pressureStrengthPermille),
    ) &&
    coastlineBehaviorVersion === ATLAS_COASTLINE_APPEARANCE_BEHAVIOR_VERSION &&
    waterBehaviorVersion === ATLAS_WATER_DECORATION_BEHAVIOR_VERSION &&
    paperBehaviorVersion === ATLAS_PAPER_TREATMENT_BEHAVIOR_VERSION &&
    new Set(paths.map(({ decorationId }) => decorationId)).size === paths.length &&
    paths.some(({ kind }) => kind === 'coastal-echo') &&
    paths.some(({ kind }) => kind === 'water-mark') &&
    paths.every((path) => {
      const ring = path.sourceRingId === undefined ? undefined : ringById.get(path.sourceRingId);
      const expectedRelatedIds =
        ring === undefined ? [] : [ring.ringId, ...ring.waterBodyIds].sort();
      return (
        path.points.length >= 2 &&
        path.points.every((point) => parsePlanetPoint(point).ok) &&
        Number.isInteger(path.weightPermille) &&
        path.weightPermille >= 1 &&
        path.weightPermille <= 1_000 &&
        new Set(path.relatedSourceIds).size === path.relatedSourceIds.length &&
        (path.kind === 'water-mark'
          ? waterBodyIds.has(path.sourceEntityId) &&
            path.sourceRingId === undefined &&
            path.sourceBoundaryFingerprint === undefined
          : ring?.landmassId === path.sourceEntityId &&
            ring.sourceBoundaryFingerprint === path.sourceBoundaryFingerprint &&
            deepEqual([...path.relatedSourceIds].sort(), expectedRelatedIds))
      );
    }) &&
    validPermille(appearance.paperTreatment.grainPhaseXPermille) &&
    validPermille(appearance.paperTreatment.grainPhaseYPermille) &&
    validPermille(appearance.paperTreatment.grainAnglePermille) &&
    validPermille(appearance.paperTreatment.grainDensityPermille) &&
    validPermille(appearance.paperTreatment.grainLengthPermille) &&
    styles.every((style) => deepEqual(style, styles[0]))
  );
}

function validPermille(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 1_000;
}

function uniqueAspect(
  aspects: readonly AcceptedAspectRecord[],
  name: string,
): AcceptedAspectRecord | undefined {
  const matches = aspects.filter(({ aspectName }) => aspectName === name);
  return matches.length === 1 ? matches[0] : undefined;
}

function outputs(aspects: readonly AcceptedAspectRecord[], name: string): readonly unknown[] {
  return aspects
    .filter(({ aspectName }) => aspectName === name)
    .sort((left, right) => compareStableReferences(left.entityId, right.entityId))
    .map(({ acceptedOutput }) => acceptedOutput);
}

function invalidAtlasProposalDiagnosticFromIds(
  aspectIds: readonly AtlasDocumentTransactionDiagnostic['aspectIds'][number][],
  entityIds: readonly EntityId[],
): AtlasDocumentTransactionDiagnostic {
  return Object.freeze({
    code: ATLAS_DOCUMENT_TRANSACTION_DIAGNOSTIC_CODES.invalidProposal,
    aspectIds: Object.freeze([...new Set(aspectIds)].sort()),
    entityIds: Object.freeze([...new Set(entityIds)].sort()),
    lockIds: Object.freeze([]),
    message:
      'The complete atlas proposal failed deterministic metadata, partition, or provenance validation.',
    suggestedAction:
      'Discard it and regenerate every stage from the same validated source snapshot.',
  });
}
