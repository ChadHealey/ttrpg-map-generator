/** Deterministic whole-world atlas scene composition from accepted semantic geography. */

import {
  type AspectId,
  ATLAS_COASTLINE_APPEARANCE_BEHAVIOR_VERSION,
  ATLAS_PAPER_TREATMENT_BEHAVIOR_VERSION,
  ATLAS_STYLE_TOKEN_VERSION,
  ATLAS_WATER_DECORATION_BEHAVIOR_VERSION,
  type AtlasAppearanceRecords,
  type AtlasCoastlineInkDecision,
  type AtlasGeographyRecords,
  type AtlasPaperTreatment,
  type AtlasStyleTokens,
  type AtlasWaterDecorationPath,
  deriveAtlasAspectId,
  deriveAtlasSingletonEntityIds,
  type EntityId,
  type Landmass,
  type RenderCompoundPath,
  type RenderNode,
  type RenderPoint,
  type RenderScene,
} from '@ttrpg-map/core';

import {
  ATLAS_DISPLAY_COORDINATE_SPACE,
  ATLAS_DISPLAY_PROJECTION_METADATA,
  type AtlasDisplayProjectionMetadata,
  type AtlasProjectedCoastlinePath,
  projectAtlasCanonicalCoastline,
} from './atlas-display-projection.js';
import { deriveAtlasInkStrokeSegments } from './atlas-ink-path.js';
import { createAtlasLandFillSubpaths } from './atlas-scene-fill.js';

export const ATLAS_SCENE_COMPOSITION_VERSION = 2 as const;
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
  invalidAcceptedAppearance: 'atlas-scene.accepted-appearance.invalid',
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

/**
 * Compose a pure scene from accepted records. Top-level collection order is canonicalized before
 * scene-specific validation so equivalent insertion order cannot affect render IDs, z-order, or
 * output bytes. The caller supplies already accepted records; transaction and persistence
 * boundaries own full-profile validation.
 */
export function composeAtlasRenderScene(
  sourceRecords: AtlasGeographyRecords,
  sourceAppearance: AtlasAppearanceRecords,
  style: AtlasStyleTokens,
  options: AtlasSceneCompositionOptions = {},
): AtlasSceneCompositionResult {
  const records = canonicalizeRecords(sourceRecords);
  const appearance = canonicalizeAppearance(sourceAppearance);
  const sourceDiagnostics = validateAtlasSceneSource(records);
  if (sourceDiagnostics.length > 0) return { ok: false, diagnostics: sourceDiagnostics };
  const appearanceDiagnostics = validateAtlasAppearanceSource(records, appearance, style);
  if (appearanceDiagnostics.length > 0) {
    return { ok: false, diagnostics: appearanceDiagnostics };
  }

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
    singletonIds.atlasPresentationEntityId,
    'atlas.coastlineAppearance',
  );
  const waterDecorationAspectId = deriveAtlasAspectId(
    singletonIds.atlasPresentationEntityId,
    'atlas.waterDecoration',
  );
  const paperTreatmentAspectId = deriveAtlasAspectId(
    singletonIds.atlasPresentationEntityId,
    'atlas.paperTreatment',
  );
  const waterBodyIds = Object.freeze(
    records.waterBodies.map(({ entityId }) => entityId).sort(compareText),
  );
  const nodes: RenderNode[] = [
    backgroundNode(
      'atlas/background/paper',
      appearance.atlasPresentationEntityId,
      paperTreatmentAspectId,
      Object.freeze([records.worldSurfaceEntityId, ...waterBodyIds].sort(compareText)),
      style.colors.paper,
    ),
    backgroundNode(
      'atlas/background/water',
      records.worldSurfaceEntityId,
      records.landWaterClassificationAspectId,
      waterBodyIds,
      style.colors.water,
    ),
  ];

  for (const landmass of records.landmasses) {
    const paths = projection.value.paths.filter(
      ({ landmassId }) => landmassId === landmass.entityId,
    );
    const fill = landFillNode(landmass, paths, style.colors.land);
    if (!fill.ok) return fill;
    nodes.push(fill.value);
  }

  if (levelOfDetail === ATLAS_SCENE_LEVELS_OF_DETAIL.normalAtlas) {
    nodes.push(
      ...paperGrainNodes(
        appearance.atlasPresentationEntityId,
        paperTreatmentAspectId,
        appearance.paperTreatment,
        style,
      ),
      ...appearance.waterDecoration.paths.map((path) =>
        waterDecorationNode(path, waterDecorationAspectId, style),
      ),
    );
    const decisionByRing = new Map(
      appearance.coastlineAppearance.ringDecisions.map((decision) => [
        decision.sourceRingId,
        decision,
      ]),
    );
    for (const path of projection.value.paths) {
      const decision = decisionByRing.get(path.sourceRingId);
      if (decision === undefined) {
        return invalidAppearance(
          path.sourceRingId,
          `Atlas appearance has no ink decision for ${path.sourceRingId}.`,
        );
      }
      nodes.push(...coastlineNodes(path, decision, coastlineAspectId, style));
    }
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

function canonicalizeAppearance(appearance: AtlasAppearanceRecords): AtlasAppearanceRecords {
  return {
    ...appearance,
    coastlineAppearance: {
      ...appearance.coastlineAppearance,
      ringDecisions: Object.freeze(
        [...appearance.coastlineAppearance.ringDecisions].sort((left, right) =>
          compareText(left.sourceRingId, right.sourceRingId),
        ),
      ),
    },
    waterDecoration: {
      ...appearance.waterDecoration,
      paths: Object.freeze(
        appearance.waterDecoration.paths
          .map((path) => ({
            ...path,
            relatedSourceIds: Object.freeze([...path.relatedSourceIds].sort(compareText)),
          }))
          .sort((left, right) => compareText(left.decorationId, right.decorationId)),
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
  fillColor: string,
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
      fillColor,
      fillRule: 'evenodd',
    }),
  };
}

function coastlineNodes(
  path: AtlasProjectedCoastlinePath,
  decision: AtlasCoastlineInkDecision,
  coastlineAspectId: AspectId,
  style: AtlasStyleTokens,
): readonly RenderNode[] {
  const relatedSourceIds = Object.freeze(
    [path.sourceRingId, ...path.waterBodyIds].sort(compareText),
  );
  return deriveAtlasInkStrokeSegments(
    path,
    decision,
    style.coastline,
    ATLAS_SCENE_WIDTH_PX,
    ATLAS_SCENE_HEIGHT_PX,
  ).map((segment) =>
    Object.freeze({
      id: `atlas/coastline/${path.pathId}/stroke-${String(segment.segmentIndex).padStart(4, '0')}`,
      kind: 'polyline',
      sourceId: path.landmassId,
      sourceAspectId: coastlineAspectId,
      relatedSourceIds,
      points: segment.points,
      strokeColor: style.colors.ink,
      strokeWidthPx: segment.strokeWidthPx,
    }),
  );
}

function waterDecorationNode(
  path: AtlasWaterDecorationPath,
  sourceAspectId: AspectId,
  style: AtlasStyleTokens,
): RenderNode {
  return Object.freeze({
    id: path.decorationId,
    kind: 'polyline',
    sourceId: path.sourceEntityId,
    sourceAspectId,
    relatedSourceIds: path.relatedSourceIds,
    points: Object.freeze(path.points.map(atlasPlanetPointToRenderPoint)),
    strokeColor: style.colors.waterInk,
    strokeWidthPx:
      (path.kind === 'coastal-echo'
        ? style.waterDecoration.echoWidthPx
        : style.waterDecoration.waterMarkWidthPx) *
      (path.weightPermille / 1_000),
  });
}

function paperGrainNodes(
  sourceId: EntityId,
  sourceAspectId: AspectId,
  treatment: AtlasPaperTreatment,
  style: AtlasStyleTokens,
): readonly RenderNode[] {
  const count = Math.floor(style.paper.grainCount * (treatment.grainDensityPermille / 1_000));
  const baseAngle = (treatment.grainAnglePermille / 1_000) * Math.PI * 2;
  const length = style.paper.grainLengthPx * (treatment.grainLengthPermille / 1_000);
  const phaseX = treatment.grainPhaseXPermille / 1_000;
  const phaseY = treatment.grainPhaseYPermille / 1_000;
  const nodes: RenderNode[] = [];
  for (let index = 0; index < count; index += 1) {
    const xPx = fractional((index + 1) * 0.618_033_988_749_894_9 + phaseX) * ATLAS_SCENE_WIDTH_PX;
    const yPx = fractional((index + 1) * 0.414_213_562_373_095_1 + phaseY) * ATLAS_SCENE_HEIGHT_PX;
    const angle = baseAngle + ((index % 9) - 4) * 0.035;
    const halfX = (Math.cos(angle) * length) / 2;
    const halfY = (Math.sin(angle) * length) / 2;
    nodes.push(
      Object.freeze({
        id: `atlas/paper/grain-${String(index).padStart(4, '0')}`,
        kind: 'polyline',
        sourceId,
        sourceAspectId,
        relatedSourceIds: Object.freeze([]),
        points: Object.freeze([
          Object.freeze({
            xPx: clamp(xPx - halfX, 0, ATLAS_SCENE_WIDTH_PX),
            yPx: clamp(yPx - halfY, 0, ATLAS_SCENE_HEIGHT_PX),
          }),
          Object.freeze({
            xPx: clamp(xPx + halfX, 0, ATLAS_SCENE_WIDTH_PX),
            yPx: clamp(yPx + halfY, 0, ATLAS_SCENE_HEIGHT_PX),
          }),
        ]),
        strokeColor: style.colors.paperGrain,
        strokeWidthPx: style.paper.grainWidthPx,
      }),
    );
  }
  return Object.freeze(nodes);
}

function atlasPlanetPointToRenderPoint(point: {
  readonly longitudeTicks: number;
  readonly latitudeTicks: number;
}): RenderPoint {
  return Object.freeze({
    xPx: ((point.longitudeTicks + 2 ** 31) * ATLAS_SCENE_WIDTH_PX) / 2 ** 32,
    yPx: ((2 ** 30 - point.latitudeTicks) * ATLAS_SCENE_HEIGHT_PX) / 2 ** 31,
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

function validateAtlasAppearanceSource(
  records: AtlasGeographyRecords,
  appearance: AtlasAppearanceRecords,
  style: AtlasStyleTokens,
): readonly AtlasSceneDiagnostic[] {
  const diagnostics: AtlasSceneDiagnostic[] = [];
  const singletonIds = deriveAtlasSingletonEntityIds(records.worldMapId);
  if (appearance.atlasPresentationEntityId !== singletonIds.atlasPresentationEntityId) {
    diagnostics.push(
      appearanceDiagnostic(
        appearance.atlasPresentationEntityId,
        'Atlas appearance has an inconsistent presentation owner.',
      ),
    );
  }
  if (
    !supportsVersion(
      appearance.coastlineAppearance.appearanceBehaviorVersion,
      ATLAS_COASTLINE_APPEARANCE_BEHAVIOR_VERSION,
    ) ||
    !supportsVersion(
      appearance.waterDecoration.decorationBehaviorVersion,
      ATLAS_WATER_DECORATION_BEHAVIOR_VERSION,
    ) ||
    !supportsVersion(
      appearance.paperTreatment.treatmentBehaviorVersion,
      ATLAS_PAPER_TREATMENT_BEHAVIOR_VERSION,
    )
  ) {
    diagnostics.push(
      appearanceDiagnostic(
        appearance.atlasPresentationEntityId,
        'Atlas appearance contains an unsupported behavior version.',
      ),
    );
  }
  for (const provenance of [
    appearance.coastlineAppearance.style,
    appearance.waterDecoration.style,
    appearance.paperTreatment.style,
  ]) {
    if (!matchesStyleProvenance(provenance, style)) {
      diagnostics.push(
        appearanceDiagnostic(
          provenance.styleId,
          'Atlas appearance provenance does not match the supplied style tokens.',
        ),
      );
    }
  }
  const rings = new Map(records.coastline.rings.map((ring) => [ring.ringId, ring]));
  const decisions = appearance.coastlineAppearance.ringDecisions;
  if (new Set(decisions.map(({ sourceRingId }) => sourceRingId)).size !== decisions.length) {
    diagnostics.push(
      appearanceDiagnostic(
        appearance.atlasPresentationEntityId,
        'Atlas coastline appearance contains duplicate ring decisions.',
      ),
    );
  }
  for (const decision of decisions) {
    const ring = rings.get(decision.sourceRingId);
    if (ring?.sourceBoundaryFingerprint !== decision.sourceBoundaryFingerprint) {
      diagnostics.push(
        appearanceDiagnostic(
          decision.sourceRingId,
          'Atlas coastline appearance has stale or unknown canonical-ring provenance.',
        ),
      );
    }
    if (
      !validPermille(decision.wobblePhasePermille) ||
      !validPermille(decision.wobbleStrengthPermille) ||
      !validPermille(decision.secondaryPhasePermille) ||
      !validPermille(decision.pressurePhasePermille) ||
      !validPermille(decision.pressureStrengthPermille)
    ) {
      diagnostics.push(
        appearanceDiagnostic(
          decision.sourceRingId,
          'Atlas coastline appearance contains an invalid permille decision.',
        ),
      );
    }
  }
  if (decisions.length !== rings.size) {
    diagnostics.push(
      appearanceDiagnostic(
        appearance.atlasPresentationEntityId,
        'Atlas coastline appearance must cover every canonical ring exactly once.',
      ),
    );
  }
  const waterBodyIds = new Set(records.waterBodies.map(({ entityId }) => entityId));
  const decorationIds = appearance.waterDecoration.paths.map(({ decorationId }) => decorationId);
  if (new Set(decorationIds).size !== decorationIds.length) {
    diagnostics.push(
      appearanceDiagnostic(
        appearance.atlasPresentationEntityId,
        'Atlas water-decoration identities must be unique.',
      ),
    );
  }
  for (const path of appearance.waterDecoration.paths) {
    const ring = path.sourceRingId === undefined ? undefined : rings.get(path.sourceRingId);
    const expectedRelatedIds =
      ring === undefined
        ? Object.freeze([] as string[])
        : Object.freeze([ring.ringId, ...ring.waterBodyIds].sort(compareText));
    if (
      !isKnownDecorationKind(path.kind) ||
      path.points.length < 2 ||
      path.weightPermille < 1 ||
      path.weightPermille > 1_000 ||
      !Number.isInteger(path.weightPermille) ||
      new Set(path.relatedSourceIds).size !== path.relatedSourceIds.length ||
      (path.kind === 'water-mark' && !waterBodyIds.has(path.sourceEntityId)) ||
      (path.kind === 'coastal-echo' &&
        (ring?.landmassId !== path.sourceEntityId ||
          ring.sourceBoundaryFingerprint !== path.sourceBoundaryFingerprint ||
          !sameStrings(path.relatedSourceIds, expectedRelatedIds))) ||
      path.points.some((point, index) => {
        const previous = path.points[index - 1];
        return (
          previous !== undefined &&
          Math.abs(point.longitudeTicks - previous.longitudeTicks) > 2 ** 31
        );
      })
    ) {
      diagnostics.push(
        appearanceDiagnostic(
          path.decorationId,
          'Atlas water decoration has invalid source or path data.',
        ),
      );
    }
  }
  if (
    !validPermille(appearance.paperTreatment.grainPhaseXPermille) ||
    !validPermille(appearance.paperTreatment.grainPhaseYPermille) ||
    !validPermille(appearance.paperTreatment.grainAnglePermille) ||
    !validPermille(appearance.paperTreatment.grainDensityPermille) ||
    !validPermille(appearance.paperTreatment.grainLengthPermille)
  ) {
    diagnostics.push(
      appearanceDiagnostic(
        appearance.atlasPresentationEntityId,
        'Atlas paper treatment contains an invalid permille decision.',
      ),
    );
  }
  if (!validStyle(style)) {
    diagnostics.push(
      appearanceDiagnostic(
        style.styleId,
        'Atlas style tokens contain an invalid color or measure.',
      ),
    );
  }
  return Object.freeze(
    diagnostics.sort(
      (left, right) =>
        compareText(left.sourceId ?? '', right.sourceId ?? '') ||
        compareText(left.message, right.message),
    ),
  );
}

function validStyle(style: AtlasStyleTokens): boolean {
  const colors: readonly string[] = [
    style.colors.ink,
    style.colors.land,
    style.colors.paper,
    style.colors.paperGrain,
    style.colors.water,
    style.colors.waterInk,
  ];
  const measures = [
    style.coastline.maximumWobblePx,
    style.coastline.pressureVariationPx,
    style.coastline.pressureWavelengthPx,
    style.coastline.primaryWidthPx,
    style.coastline.primaryWavelengthPx,
    style.coastline.secondaryWavelengthPx,
    style.coastline.strokeSegmentLengthPx,
    style.waterDecoration.echoWidthPx,
    style.waterDecoration.waterMarkWidthPx,
    style.paper.grainCount,
    style.paper.grainLengthPx,
    style.paper.grainWidthPx,
  ];
  return (
    supportsVersion(style.tokenVersion, ATLAS_STYLE_TOKEN_VERSION) &&
    colors.every((color) => /^#[0-9a-f]{6}$/u.test(color)) &&
    measures.every((value) => Number.isFinite(value) && value > 0) &&
    Number.isInteger(style.paper.grainCount)
  );
}

function validPermille(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 1_000;
}

function supportsVersion(value: unknown, expected: number): boolean {
  return value === expected;
}

function matchesStyleProvenance(
  provenance: { readonly styleId: string; readonly styleBehaviorVersion: number },
  style: AtlasStyleTokens,
): boolean {
  return (
    provenance.styleId === style.styleId &&
    supportsVersion(provenance.styleBehaviorVersion, style.styleBehaviorVersion)
  );
}

function isKnownDecorationKind(value: unknown): value is AtlasWaterDecorationPath['kind'] {
  return value === 'coastal-echo' || value === 'water-mark';
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sourceDiagnostic(sourceId: string, message: string): AtlasSceneDiagnostic {
  return Object.freeze({
    code: ATLAS_SCENE_DIAGNOSTIC_CODES.invalidAcceptedGeography,
    message,
    sourceId,
  });
}

function appearanceDiagnostic(sourceId: string, message: string): AtlasSceneDiagnostic {
  return Object.freeze({
    code: ATLAS_SCENE_DIAGNOSTIC_CODES.invalidAcceptedAppearance,
    message,
    sourceId,
  });
}

function invalidAppearance(
  sourceId: string,
  message: string,
): { readonly ok: false; readonly diagnostics: readonly AtlasSceneDiagnostic[] } {
  return { ok: false, diagnostics: Object.freeze([appearanceDiagnostic(sourceId, message)]) };
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

function fractional(value: number): number {
  return value - Math.floor(value);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
