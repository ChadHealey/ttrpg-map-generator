/** Deterministic whole-world atlas scene composition from accepted semantic geography. */

import {
  type AspectId,
  type AtlasGeographyRecords,
  deriveAtlasAspectId,
  deriveAtlasSingletonEntityIds,
  type EntityId,
  type Landmass,
  type RenderCompoundPath,
  type RenderNode,
  type RenderScene,
} from '@ttrpg-map/core';

import {
  ATLAS_DISPLAY_COORDINATE_SPACE,
  ATLAS_DISPLAY_PROJECTION_METADATA,
  type AtlasDisplayProjectionMetadata,
  type AtlasProjectedCoastlinePath,
  projectAtlasCanonicalCoastline,
} from './atlas-display-projection.js';
import { atlasDisplayPointToRenderPoint, createAtlasLandFillSubpaths } from './atlas-scene-fill.js';

export const ATLAS_SCENE_COMPOSITION_VERSION = 1 as const;
export const ATLAS_SCENE_WIDTH_PX = 2_048 as const;
export const ATLAS_SCENE_HEIGHT_PX = 1_024 as const;

export const ATLAS_SCENE_LEVELS_OF_DETAIL = Object.freeze({
  coarsePreview: 'coarse-preview',
  normalAtlas: 'normal-atlas',
} as const);

export type AtlasSceneLevelOfDetail =
  (typeof ATLAS_SCENE_LEVELS_OF_DETAIL)[keyof typeof ATLAS_SCENE_LEVELS_OF_DETAIL];

/** A renderer-neutral, disposable atlas scene with explicit source and projection provenance. */
export interface AtlasRenderScene extends RenderScene {
  readonly authority: 'disposable-render-scene';
  readonly sceneKind: 'whole-world-atlas';
  readonly sceneCompositionVersion: typeof ATLAS_SCENE_COMPOSITION_VERSION;
  readonly levelOfDetail: AtlasSceneLevelOfDetail;
  readonly coordinateSpace: typeof ATLAS_DISPLAY_COORDINATE_SPACE;
  readonly sourceWorldMapId: string;
  readonly projection: AtlasDisplayProjectionMetadata;
}

export const ATLAS_SCENE_DIAGNOSTIC_CODES = Object.freeze({
  invalidAcceptedGeography: 'atlas-scene.accepted-geography.invalid',
  invalidProjectedFill: 'atlas-scene.projected-fill.invalid',
  projectionFailed: 'atlas-scene.projection.failed',
} as const);

export type AtlasSceneDiagnosticCode =
  (typeof ATLAS_SCENE_DIAGNOSTIC_CODES)[keyof typeof ATLAS_SCENE_DIAGNOSTIC_CODES];

export interface AtlasSceneDiagnostic {
  readonly code: AtlasSceneDiagnosticCode;
  readonly message: string;
  readonly sourceCode?: string;
  readonly sourceId?: string;
}

export type AtlasSceneCompositionResult =
  | { readonly ok: true; readonly value: AtlasRenderScene }
  | { readonly ok: false; readonly diagnostics: readonly AtlasSceneDiagnostic[] };

export interface AtlasSceneCompositionOptions {
  readonly levelOfDetail?: AtlasSceneLevelOfDetail;
}

const STRUCTURAL_PALETTE = Object.freeze({
  paper: '#efe3c5',
  water: '#cad9d8',
  land: '#d9d2a7',
  coastline: '#34342c',
} as const);

/**
 * Compose a pure scene from accepted records. Top-level collection order is canonicalized before
 * scene-specific validation so equivalent insertion order cannot affect render IDs, z-order, or
 * output bytes. The caller supplies already accepted records; transaction and persistence
 * boundaries own full-profile validation.
 */
export function composeAtlasRenderScene(
  sourceRecords: AtlasGeographyRecords,
  options: AtlasSceneCompositionOptions = {},
): AtlasSceneCompositionResult {
  const records = canonicalizeRecords(sourceRecords);
  const sourceDiagnostics = validateAtlasSceneSource(records);
  if (sourceDiagnostics.length > 0) return { ok: false, diagnostics: sourceDiagnostics };

  const projection = projectAtlasCanonicalCoastline(records.coastline);
  if (!projection.ok) {
    return {
      ok: false,
      diagnostics: Object.freeze(
        projection.diagnostics.map((diagnostic) =>
          Object.freeze({
            code: ATLAS_SCENE_DIAGNOSTIC_CODES.projectionFailed,
            message: diagnostic.message,
            sourceCode: diagnostic.code,
            ...(diagnostic.sourceRingId === undefined ? {} : { sourceId: diagnostic.sourceRingId }),
          }),
        ),
      ),
    };
  }

  const levelOfDetail = options.levelOfDetail ?? ATLAS_SCENE_LEVELS_OF_DETAIL.normalAtlas;
  const singletonIds = deriveAtlasSingletonEntityIds(records.worldMapId);
  const coastlineAspectId = deriveAtlasAspectId(
    singletonIds.worldCoastlineEntityId,
    'worldCoastline.geometry',
  );
  const waterBodyIds = Object.freeze(
    records.waterBodies.map(({ entityId }) => entityId).sort(compareText),
  );
  const nodes: RenderNode[] = [
    backgroundNode(
      'atlas/background/paper',
      records.worldSurfaceEntityId,
      records.landWaterClassificationAspectId,
      waterBodyIds,
      STRUCTURAL_PALETTE.paper,
    ),
    backgroundNode(
      'atlas/background/water',
      records.worldSurfaceEntityId,
      records.landWaterClassificationAspectId,
      waterBodyIds,
      STRUCTURAL_PALETTE.water,
    ),
  ];

  for (const landmass of records.landmasses) {
    const paths = projection.value.paths.filter(
      ({ landmassId }) => landmassId === landmass.entityId,
    );
    const fill = landFillNode(landmass, paths);
    if (!fill.ok) return fill;
    nodes.push(fill.value);
  }

  if (levelOfDetail === ATLAS_SCENE_LEVELS_OF_DETAIL.normalAtlas) {
    nodes.push(...projection.value.paths.map((path) => coastlineNode(path, coastlineAspectId)));
  }

  return {
    ok: true,
    value: Object.freeze({
      authority: 'disposable-render-scene',
      sceneKind: 'whole-world-atlas',
      sceneCompositionVersion: ATLAS_SCENE_COMPOSITION_VERSION,
      levelOfDetail,
      coordinateSpace: ATLAS_DISPLAY_COORDINATE_SPACE,
      sourceWorldMapId: records.worldMapId,
      projection: ATLAS_DISPLAY_PROJECTION_METADATA,
      widthPx: ATLAS_SCENE_WIDTH_PX,
      heightPx: ATLAS_SCENE_HEIGHT_PX,
      nodes: Object.freeze(nodes),
    }),
  };
}

function canonicalizeRecords(records: AtlasGeographyRecords): AtlasGeographyRecords {
  return {
    ...records,
    landmasses: Object.freeze([...records.landmasses].sort(compareEntity)),
    islandGroups: Object.freeze([...records.islandGroups].sort(compareEntity)),
    waterBodies: Object.freeze([...records.waterBodies].sort(compareEntity)),
    coastline: {
      ...records.coastline,
      rings: Object.freeze(
        [...records.coastline.rings].sort((left, right) => compareText(left.ringId, right.ringId)),
      ),
    },
  };
}

function backgroundNode(
  id: string,
  sourceId: EntityId,
  sourceAspectId: AspectId,
  relatedSourceIds: readonly EntityId[],
  fillColor: string,
): RenderNode {
  return Object.freeze({
    id,
    kind: 'rectangle',
    sourceId,
    sourceAspectId,
    relatedSourceIds,
    xPx: 0,
    yPx: 0,
    widthPx: ATLAS_SCENE_WIDTH_PX,
    heightPx: ATLAS_SCENE_HEIGHT_PX,
    fillColor,
  });
}

function landFillNode(
  landmass: Landmass,
  paths: readonly AtlasProjectedCoastlinePath[],
):
  | { readonly ok: true; readonly value: RenderCompoundPath }
  | { readonly ok: false; readonly diagnostics: readonly AtlasSceneDiagnostic[] } {
  const subpaths = createAtlasLandFillSubpaths(
    landmass,
    paths,
    ATLAS_SCENE_WIDTH_PX,
    ATLAS_SCENE_HEIGHT_PX,
  );
  if (!subpaths.ok) return invalidFill(subpaths.sourceId, subpaths.message);
  const relatedSourceIds = Object.freeze(
    [...new Set(paths.flatMap(({ waterBodyIds }) => waterBodyIds))].sort(compareText),
  );
  return {
    ok: true,
    value: Object.freeze({
      id: `atlas/land/${landmass.entityId}`,
      kind: 'compoundPath',
      sourceId: landmass.entityId,
      sourceAspectId: deriveAtlasAspectId(landmass.entityId, 'landmass.classification'),
      relatedSourceIds,
      subpaths: subpaths.value,
      fillColor: STRUCTURAL_PALETTE.land,
      fillRule: 'evenodd',
    }),
  };
}

function coastlineNode(path: AtlasProjectedCoastlinePath, coastlineAspectId: AspectId): RenderNode {
  return Object.freeze({
    id: `atlas/coastline/${path.pathId}`,
    kind: 'polyline',
    sourceId: path.landmassId,
    sourceAspectId: coastlineAspectId,
    relatedSourceIds: path.waterBodyIds,
    points: Object.freeze(
      path.points.map((point) =>
        atlasDisplayPointToRenderPoint(point, ATLAS_SCENE_WIDTH_PX, ATLAS_SCENE_HEIGHT_PX),
      ),
    ),
    strokeColor: STRUCTURAL_PALETTE.coastline,
    strokeWidthPx: 1.5,
  });
}

function validateAtlasSceneSource(records: AtlasGeographyRecords): readonly AtlasSceneDiagnostic[] {
  const diagnostics: AtlasSceneDiagnostic[] = [];
  const singletons = deriveAtlasSingletonEntityIds(records.worldMapId);
  if (records.worldSurfaceEntityId !== singletons.worldSurfaceEntityId) {
    diagnostics.push(
      sourceDiagnostic(
        records.worldSurfaceEntityId,
        'Atlas scene source has a world-surface owner inconsistent with its world map.',
      ),
    );
  }
  const expectedClassificationAspectId = deriveAtlasAspectId(
    records.worldSurfaceEntityId,
    'worldSurface.landWaterClassification',
  );
  if (records.landWaterClassificationAspectId !== expectedClassificationAspectId) {
    diagnostics.push(
      sourceDiagnostic(
        records.landWaterClassificationAspectId,
        'Atlas scene source has an inconsistent land/water classification aspect.',
      ),
    );
  }

  const landmassIds = new Set(records.landmasses.map(({ entityId }) => entityId));
  const waterBodyIds = new Set(records.waterBodies.map(({ entityId }) => entityId));
  if (
    landmassIds.size !== records.landmasses.length ||
    waterBodyIds.size !== records.waterBodies.length
  ) {
    diagnostics.push(
      sourceDiagnostic(records.worldMapId, 'Atlas scene source IDs must be unique.'),
    );
  }
  for (const ring of records.coastline.rings) {
    if (!landmassIds.has(ring.landmassId)) {
      diagnostics.push(
        sourceDiagnostic(ring.ringId, `Coastline ring ${ring.ringId} has no source landmass.`),
      );
    }
    if (ring.waterBodyIds.some((id) => !waterBodyIds.has(id))) {
      diagnostics.push(
        sourceDiagnostic(ring.ringId, `Coastline ring ${ring.ringId} has an unknown water body.`),
      );
    }
  }
  return Object.freeze(
    diagnostics.sort(
      (left, right) =>
        compareText(left.sourceId ?? '', right.sourceId ?? '') ||
        compareText(left.message, right.message),
    ),
  );
}

function sourceDiagnostic(sourceId: string, message: string): AtlasSceneDiagnostic {
  return Object.freeze({
    code: ATLAS_SCENE_DIAGNOSTIC_CODES.invalidAcceptedGeography,
    message,
    sourceId,
  });
}

function invalidFill(
  sourceId: string,
  message: string,
): { readonly ok: false; readonly diagnostics: readonly AtlasSceneDiagnostic[] } {
  return {
    ok: false,
    diagnostics: Object.freeze([
      Object.freeze({
        code: ATLAS_SCENE_DIAGNOSTIC_CODES.invalidProjectedFill,
        message,
        sourceId,
      }),
    ]),
  };
}

function compareEntity(
  left: { readonly entityId: EntityId },
  right: { readonly entityId: EntityId },
): number {
  return compareText(left.entityId, right.entityId);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
