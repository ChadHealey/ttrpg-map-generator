/** Generator-free reconstruction of complete accepted Milestone 2 atlas records. */

import {
  type AtlasAppearanceRecords,
  type AtlasCoastlineAppearance,
  type AtlasPaperTreatment,
  type AtlasWaterDecoration,
} from './atlas-appearance-model.js';
import { validateAtlasAppearanceRecords } from './atlas-document-proposal-validation.js';
import {
  type AtlasAspectKind,
  atlasControlsMatchWorldRadius,
  deriveAtlasAspectId,
  deriveAtlasSingletonEntityIds,
} from './atlas-geography-aspects.js';
import {
  type AtlasControls,
  type AtlasGeographyRecords,
  type CanonicalWorldCoastline,
  type IslandGroup,
  type Landmass,
  type LandWaterClassification,
  type MacroElevationField,
  type WaterBody,
} from './atlas-geography-model.js';
import { parseAtlasControls, validateAtlasGeographyRecords } from './atlas-geography-validation.js';
import type { AcceptedAspectRecord } from './generated-aspects.js';
import type { AspectId, EntityId } from './identity.js';
import type { WorldDocument, WorldMap } from './world-document.js';

const ATLAS_ASPECT_NAMES: ReadonlySet<string> = new Set<AtlasAspectKind>([
  'worldTerrain.macroElevation',
  'worldSurface.landWaterClassification',
  'landmass.classification',
  'islandGroup.classification',
  'waterBody.classification',
  'worldCoastline.geometry',
  'atlas.coastlineAppearance',
  'atlas.waterDecoration',
  'atlas.paperTreatment',
]);

export const ACCEPTED_ATLAS_DIAGNOSTIC_CODES = Object.freeze({
  incomplete: 'atlas-accepted.content.incomplete',
  invalid: 'atlas-accepted.content.invalid',
  referenceInvalid: 'atlas-accepted.reference.invalid',
} as const);

export type AcceptedAtlasDiagnosticCode =
  (typeof ACCEPTED_ATLAS_DIAGNOSTIC_CODES)[keyof typeof ACCEPTED_ATLAS_DIAGNOSTIC_CODES];

export interface AcceptedAtlasDiagnostic {
  readonly code: AcceptedAtlasDiagnosticCode;
  readonly message: string;
  readonly suggestedAction: string;
}

export interface ReconstructedAcceptedAtlas {
  readonly geography: AtlasGeographyRecords;
  readonly appearance: AtlasAppearanceRecords;
}

export type ReconstructAcceptedAtlasResult =
  | { readonly status: 'not-atlas' }
  | { readonly status: 'accepted'; readonly value: ReconstructedAcceptedAtlas }
  | { readonly status: 'invalid'; readonly diagnostics: readonly AcceptedAtlasDiagnostic[] };

/**
 * Reconstruct authoritative atlas records from accepted aspects only. This function has no
 * generator, renderer, cache, projection, filesystem, or migration dependency.
 */
export function reconstructAcceptedAtlas(document: WorldDocument): ReconstructAcceptedAtlasResult {
  const atlasAspects = document.maps.flatMap((map) =>
    map.aspects.filter(({ aspectName }) => ATLAS_ASPECT_NAMES.has(aspectName)),
  );
  if (atlasAspects.length === 0) return Object.freeze({ status: 'not-atlas' });

  const root = document.maps.find(({ mapId }) => mapId === document.rootMapId);
  if (root?.mapKind !== 'world' || document.maps.length !== 1) {
    return invalid(
      ACCEPTED_ATLAS_DIAGNOSTIC_CODES.incomplete,
      'A Milestone 2 atlas must be the complete accepted state of the one root WorldMap.',
      'Restore the complete accepted root atlas package without partial atlas records.',
    );
  }
  if (root.aspects.some(({ aspectName }) => !ATLAS_ASPECT_NAMES.has(aspectName))) {
    return invalid(
      ACCEPTED_ATLAS_DIAGNOSTIC_CODES.incomplete,
      'A Milestone 2 atlas map contains an unsupported or mixed accepted aspect record.',
      'Restore the complete version-1 atlas aspect set or open the package with a compatible application.',
    );
  }

  const singletonIds = deriveAtlasSingletonEntityIds(root.mapId);
  const macro = uniqueAspect(root, 'worldTerrain.macroElevation');
  const partition = uniqueAspect(root, 'worldSurface.landWaterClassification');
  const coastline = uniqueAspect(root, 'worldCoastline.geometry');
  const coastlineAppearance = uniqueAspect(root, 'atlas.coastlineAppearance');
  const waterDecoration = uniqueAspect(root, 'atlas.waterDecoration');
  const paperTreatment = uniqueAspect(root, 'atlas.paperTreatment');
  if (
    macro === undefined ||
    partition === undefined ||
    coastline === undefined ||
    coastlineAppearance === undefined ||
    waterDecoration === undefined ||
    paperTreatment === undefined
  ) {
    return invalid(
      ACCEPTED_ATLAS_DIAGNOSTIC_CODES.incomplete,
      'The accepted atlas is missing or duplicates a required singleton aspect.',
      'Restore all six singleton atlas aspects from the last valid package.',
    );
  }

  const controls = controlsFromAspects(macro, partition);
  if (controls === undefined) {
    return invalid(
      ACCEPTED_ATLAS_DIAGNOSTIC_CODES.invalid,
      'Accepted atlas control provenance cannot be reconstructed from the macro and classification parameters.',
      'Restore the exact version-1 parameter records without defaults or coercion.',
    );
  }

  const geography: AtlasGeographyRecords = {
    controls,
    macroElevation: macro.acceptedOutput as MacroElevationField,
    landWaterClassification: partition.acceptedOutput as LandWaterClassification,
    semanticClassificationVersion: 1,
    worldMapId: root.mapId,
    worldSurfaceEntityId: singletonIds.worldSurfaceEntityId,
    landWaterClassificationAspectId: partition.aspectId,
    landmasses: outputs(root, 'landmass.classification') as readonly Landmass[],
    islandGroups: outputs(root, 'islandGroup.classification') as readonly IslandGroup[],
    waterBodies: outputs(root, 'waterBody.classification') as readonly WaterBody[],
    coastline: coastline.acceptedOutput as CanonicalWorldCoastline,
  };
  const appearance: AtlasAppearanceRecords = {
    atlasPresentationEntityId: singletonIds.atlasPresentationEntityId,
    coastlineAppearance: coastlineAppearance.acceptedOutput as AtlasCoastlineAppearance,
    waterDecoration: waterDecoration.acceptedOutput as AtlasWaterDecoration,
    paperTreatment: paperTreatment.acceptedOutput as AtlasPaperTreatment,
  };

  const geographyValidation = validateAtlasGeographyRecords(geography);
  if (
    !geographyValidation.ok ||
    !atlasControlsMatchWorldRadius(controls, root.coordinateSystem.radius) ||
    !validateAtlasAppearanceRecords(geography, appearance) ||
    !appearanceParametersMatchOutputs(coastlineAppearance, waterDecoration, paperTreatment)
  ) {
    return invalid(
      ACCEPTED_ATLAS_DIAGNOSTIC_CODES.invalid,
      'The reconstructed atlas fails accepted geography, coastline, appearance, or provenance invariants.',
      'Restore the exact accepted records from the last package that passed full atlas validation.',
    );
  }
  if (!hasValidAcceptedDiagnostics(root)) {
    return invalid(
      ACCEPTED_ATLAS_DIAGNOSTIC_CODES.invalid,
      'An accepted atlas aspect contains an error diagnostic or a diagnostic targeting another aspect.',
      'Restore accepted aspect diagnostics from the atlas transaction that produced their containing aspects.',
    );
  }
  if (!hasExactAtlasOwnership(root, geography, appearance)) {
    return invalid(
      ACCEPTED_ATLAS_DIAGNOSTIC_CODES.referenceInvalid,
      'The accepted atlas has inconsistent entity ownership, aspect identity, dependencies, or decoration references.',
      'Restore the complete stable entity/aspect graph without renaming or dropping referenced records.',
    );
  }
  return Object.freeze({
    status: 'accepted',
    value: Object.freeze({ geography, appearance }),
  });
}

function hasValidAcceptedDiagnostics(map: WorldMap): boolean {
  return map.aspects.every((aspect) =>
    aspect.diagnostics.every(
      ({ severity, target }) => severity !== 'error' && target.aspectId === aspect.aspectId,
    ),
  );
}

function appearanceParametersMatchOutputs(...aspects: readonly AcceptedAspectRecord[]): boolean {
  return aspects.every((aspect) => {
    if (!isRecord(aspect.parameters) || !isRecord(aspect.acceptedOutput)) return false;
    const style = aspect.acceptedOutput.style;
    return (
      isRecord(style) &&
      aspect.parameters.styleId === style.styleId &&
      aspect.parameters.styleBehaviorVersion === style.styleBehaviorVersion
    );
  });
}

function controlsFromAspects(
  macro: AcceptedAspectRecord,
  partition: AcceptedAspectRecord,
): AtlasControls | undefined {
  if (!isRecord(macro.parameters) || !isRecord(partition.parameters)) return undefined;
  const parsed = parseAtlasControls({
    worldCircumferenceKm: macro.parameters.worldCircumferenceKm,
    targetWaterCoveragePercent: partition.parameters.targetWaterCoveragePercent,
    continentCountIntent: macro.parameters.continentCountIntent,
    continentDistribution: macro.parameters.continentDistribution,
    fragmentationPercent: macro.parameters.fragmentationPercent,
    islandAbundancePercent: macro.parameters.islandAbundancePercent,
    archipelagoAbundancePercent: macro.parameters.archipelagoAbundancePercent,
    oceanConnectivity: partition.parameters.oceanConnectivity,
    polarCharacter: macro.parameters.polarCharacter,
  });
  return parsed.ok ? parsed.value : undefined;
}

function hasExactAtlasOwnership(
  map: WorldMap,
  geography: AtlasGeographyRecords,
  appearance: AtlasAppearanceRecords,
): boolean {
  const singletonIds = deriveAtlasSingletonEntityIds(map.mapId);
  const expectedEntityIds = new Set<EntityId>([
    singletonIds.worldSurfaceEntityId,
    singletonIds.worldCoastlineEntityId,
    singletonIds.atlasPresentationEntityId,
    ...geography.landmasses.map(({ entityId }) => entityId),
    ...geography.islandGroups.map(({ entityId }) => entityId),
    ...geography.waterBodies.map(({ entityId }) => entityId),
  ]);
  const actualEntityIds = map.entities.map(({ entityId }) => entityId);
  if (
    expectedEntityIds.size !== actualEntityIds.length ||
    actualEntityIds.some((entityId) => !expectedEntityIds.has(entityId))
  ) {
    return false;
  }

  const expectedDependencies = expectedDependencyIds(geography);
  if (
    map.aspects.length !== expectedDependencies.size ||
    map.aspects.some((aspect) => {
      const kind = aspect.aspectName as AtlasAspectKind;
      return (
        !expectedDependencies.has(aspect.aspectId) ||
        aspect.mapId !== map.mapId ||
        String(aspect.generatorId) !== String(aspect.aspectName) ||
        aspect.generatorVersion !== 1 ||
        aspect.parameterSchemaVersion !== 1 ||
        aspect.seedScope !== 'map/entity' ||
        aspect.seedMetadata.seedScope !== 'map/entity' ||
        aspect.seedMetadata.mapId !== map.mapId ||
        aspect.seedMetadata.entityId !== aspect.entityId ||
        aspect.aspectId !== deriveAtlasAspectId(aspect.entityId, kind) ||
        !sameIds(
          aspect.dependencyAspects.map(({ aspectId }) => aspectId),
          expectedDependencies.get(aspect.aspectId) ?? [],
        )
      );
    })
  ) {
    return false;
  }

  const expectedAppearanceIds = [
    deriveAtlasAspectId(singletonIds.atlasPresentationEntityId, 'atlas.coastlineAppearance'),
    deriveAtlasAspectId(singletonIds.atlasPresentationEntityId, 'atlas.paperTreatment'),
    deriveAtlasAspectId(singletonIds.atlasPresentationEntityId, 'atlas.waterDecoration'),
  ].sort();
  return (
    appearance.atlasPresentationEntityId === singletonIds.atlasPresentationEntityId &&
    sameIds(
      map.decoration.aspectReferences.map(({ aspectId }) => aspectId),
      expectedAppearanceIds,
    )
  );
}

function expectedDependencyIds(
  geography: AtlasGeographyRecords,
): ReadonlyMap<AspectId, readonly AspectId[]> {
  const singletonIds = deriveAtlasSingletonEntityIds(geography.worldMapId);
  const macroId = deriveAtlasAspectId(
    singletonIds.worldSurfaceEntityId,
    'worldTerrain.macroElevation',
  );
  const partitionId = geography.landWaterClassificationAspectId;
  const coastlineId = deriveAtlasAspectId(
    singletonIds.worldCoastlineEntityId,
    'worldCoastline.geometry',
  );
  const landAspectByEntity = new Map(
    geography.landmasses.map(({ entityId }) => [
      entityId,
      deriveAtlasAspectId(entityId, 'landmass.classification'),
    ]),
  );
  const waterAspectIds = geography.waterBodies.map(({ entityId }) =>
    deriveAtlasAspectId(entityId, 'waterBody.classification'),
  );
  const result = new Map<AspectId, readonly AspectId[]>([
    [macroId, []],
    [partitionId, [macroId]],
    [coastlineId, [partitionId, ...landAspectByEntity.values(), ...waterAspectIds].sort()],
    [
      deriveAtlasAspectId(singletonIds.atlasPresentationEntityId, 'atlas.coastlineAppearance'),
      [coastlineId],
    ],
    [deriveAtlasAspectId(singletonIds.atlasPresentationEntityId, 'atlas.paperTreatment'), []],
    [
      deriveAtlasAspectId(singletonIds.atlasPresentationEntityId, 'atlas.waterDecoration'),
      [partitionId, coastlineId, ...waterAspectIds].sort(),
    ],
  ]);
  for (const landmass of geography.landmasses) {
    result.set(deriveAtlasAspectId(landmass.entityId, 'landmass.classification'), [partitionId]);
  }
  for (const group of geography.islandGroups) {
    result.set(
      deriveAtlasAspectId(group.entityId, 'islandGroup.classification'),
      [
        partitionId,
        ...group.memberLandmassIds.flatMap((entityId) => {
          const aspectId = landAspectByEntity.get(entityId);
          return aspectId === undefined ? [] : [aspectId];
        }),
      ].sort(),
    );
  }
  for (const waterBody of geography.waterBodies) {
    result.set(
      deriveAtlasAspectId(waterBody.entityId, 'waterBody.classification'),
      [
        partitionId,
        ...waterBody.adjacentLandmassIds.flatMap((entityId) => {
          const aspectId = landAspectByEntity.get(entityId);
          return aspectId === undefined ? [] : [aspectId];
        }),
      ].sort(),
    );
  }
  return result;
}

function uniqueAspect(map: WorldMap, name: AtlasAspectKind): AcceptedAspectRecord | undefined {
  const matches = map.aspects.filter(({ aspectName }) => aspectName === name);
  return matches.length === 1 ? matches[0] : undefined;
}

function outputs(map: WorldMap, name: AtlasAspectKind): readonly unknown[] {
  return map.aspects
    .filter(({ aspectName }) => aspectName === name)
    .sort((left, right) =>
      left.entityId < right.entityId ? -1 : left.entityId > right.entityId ? 1 : 0,
    )
    .map(({ acceptedOutput }) => acceptedOutput);
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  const orderedLeft = [...left].sort();
  const orderedRight = [...right].sort();
  return (
    orderedLeft.length === orderedRight.length &&
    orderedLeft.every((value, index) => value === orderedRight[index])
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(
  code: AcceptedAtlasDiagnosticCode,
  message: string,
  suggestedAction: string,
): ReconstructAcceptedAtlasResult {
  return Object.freeze({
    status: 'invalid',
    diagnostics: Object.freeze([Object.freeze({ code, message, suggestedAction })]),
  });
}
