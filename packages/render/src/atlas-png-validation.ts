/** Strict atlas-png-v1 request validation before any raster or encoder allocation. */

import {
  parseStableId,
  type RenderNode,
  type RenderPoint,
  type RenderScene,
} from '@ttrpg-map/core';

import {
  ATLAS_DISPLAY_COORDINATE_SPACE,
  ATLAS_DISPLAY_PROJECTION_METADATA,
} from './atlas-display-projection.js';
import {
  ATLAS_PNG_DEFAULT_DIMENSIONS,
  ATLAS_PNG_DIAGNOSTIC_CODES,
  ATLAS_PNG_SUPPORTED_DIMENSIONS,
  ATLAS_PNG_SUPPORTED_STYLE_ID,
  type AtlasPngDiagnostic,
  type AtlasPngDiagnosticCode,
  type AtlasPngDimensions,
  type AtlasPngExportRequest,
  type AtlasPngSceneInput,
  type AtlasPngStyleMetadata,
} from './atlas-png-profile.js';
import {
  ATLAS_PNG_BAND_HALO_PX,
  ATLAS_PNG_MAXIMUM_NODES,
  ATLAS_PNG_MAXIMUM_POINTS,
  ATLAS_PNG_MAXIMUM_SCENE_STROKE_WIDTH_PX,
  ATLAS_PNG_REQUIRED_BAND_HALO_PX,
} from './atlas-png-rasterizer.js';
import {
  ATLAS_SCENE_COMPOSITION_VERSION,
  ATLAS_SCENE_HEIGHT_PX,
  ATLAS_SCENE_LEVELS_OF_DETAIL,
  ATLAS_SCENE_WIDTH_PX,
  type AtlasRenderScene,
} from './atlas-scene.js';

export interface ValidatedAtlasPngExport {
  readonly scene: AtlasRenderScene;
  readonly style: AtlasPngStyleMetadata;
  readonly dimensions: AtlasPngDimensions;
}

export type AtlasPngValidationResult =
  | { readonly ok: true; readonly value: ValidatedAtlasPngExport }
  | { readonly ok: false; readonly diagnostics: readonly AtlasPngDiagnostic[] };

const COLOR_PATTERN = /^#[0-9a-f]{6}$/u;
const RENDER_NODE_ID_PATTERN = /^[\x20-\x7e]+$/u;

export function validateAtlasPngExportRequest(
  request: AtlasPngExportRequest,
): AtlasPngValidationResult {
  const dimensions = request.dimensions ?? ATLAS_PNG_DEFAULT_DIMENSIONS;
  const diagnostics: AtlasPngDiagnostic[] = [];
  if (!isSupportedAtlasPngDimensions(dimensions)) {
    diagnostics.push(
      atlasPngDiagnostic(
        ATLAS_PNG_DIAGNOSTIC_CODES.dimensionsInvalid,
        'Choose a supported 2:1 atlas PNG size: 1600 × 800, 4096 × 2048, or 8192 × 4096 pixels.',
      ),
    );
  }

  const { scene } = request;
  if (!isSupportedAtlasScene(scene)) {
    diagnostics.push(
      atlasPngDiagnostic(
        ATLAS_PNG_DIAGNOSTIC_CODES.sceneUnsupported,
        'Export a complete normal-detail version-2 whole-world AtlasRenderScene in the accepted equirectangular coordinate space.',
      ),
    );
  }
  if (scene.sourceWorldMapId === undefined || !parseStableId('map', scene.sourceWorldMapId).ok) {
    diagnostics.push(
      atlasPngDiagnostic(
        ATLAS_PNG_DIAGNOSTIC_CODES.sourceLinkInvalid,
        'The atlas scene sourceWorldMapId must be a canonical lowercase non-nil map UUID.',
      ),
    );
  }
  if (!isSupportedStyle(request.style)) {
    diagnostics.push(
      atlasPngDiagnostic(
        ATLAS_PNG_DIAGNOSTIC_CODES.styleUnsupported,
        'The atlas PNG exporter supports the explicit version-1 restrained-ink style and token set.',
      ),
    );
  }
  if (scene.nodes.length > ATLAS_PNG_MAXIMUM_NODES) {
    diagnostics.push(
      atlasPngDiagnostic(
        ATLAS_PNG_DIAGNOSTIC_CODES.resourceLimitExceeded,
        `The atlas scene exceeds the ${String(ATLAS_PNG_MAXIMUM_NODES)}-node PNG profile limit.`,
      ),
    );
  }
  if (ATLAS_PNG_REQUIRED_BAND_HALO_PX > ATLAS_PNG_BAND_HALO_PX) {
    diagnostics.push(
      atlasPngDiagnostic(
        ATLAS_PNG_DIAGNOSTIC_CODES.resourceLimitExceeded,
        'The atlas PNG stroke/sample footprint exceeds the versioned raster-band halo.',
      ),
    );
  }
  validateNodes(scene, diagnostics);
  if (diagnostics.length > 0) return { ok: false, diagnostics: Object.freeze(diagnostics) };

  return {
    ok: true,
    value: Object.freeze({
      scene: scene as AtlasRenderScene,
      style: Object.freeze({ ...request.style }),
      dimensions: Object.freeze({ ...dimensions }),
    }),
  };
}

export function isSupportedAtlasPngDimensions(dimensions: AtlasPngDimensions): boolean {
  return ATLAS_PNG_SUPPORTED_DIMENSIONS.some(
    (supported) =>
      dimensions.widthPx === supported.widthPx && dimensions.heightPx === supported.heightPx,
  );
}

export function atlasPngDiagnostic(
  code: AtlasPngDiagnosticCode,
  message: string,
  sourceId?: string,
): AtlasPngDiagnostic {
  return Object.freeze({ code, message, ...(sourceId === undefined ? {} : { sourceId }) });
}

function validateNodes(scene: AtlasPngSceneInput, diagnostics: AtlasPngDiagnostic[]): void {
  const ids = new Set<string>();
  const previousIdsByLayer = new Map<number, string>();
  const populatedLayers = new Set<number>();
  let hasCoastalEcho = false;
  let hasWaterMark = false;
  let previousLayer = -1;
  let pointCount = 0;

  for (const node of scene.nodes) {
    if (ids.has(node.id)) {
      diagnostics.push(
        atlasPngDiagnostic(
          ATLAS_PNG_DIAGNOSTIC_CODES.duplicateNodeId,
          `Render node ${node.id} is duplicated.`,
          node.id,
        ),
      );
    }
    ids.add(node.id);
    if (node.id.length === 0 || !RENDER_NODE_ID_PATTERN.test(node.id) || !validSourceLinks(node)) {
      diagnostics.push(
        atlasPngDiagnostic(
          ATLAS_PNG_DIAGNOSTIC_CODES.sourceLinkInvalid,
          `Render node ${node.id} must retain a printable ID and canonical sorted UUID source links.`,
          node.id,
        ),
      );
    }
    if (node.kind === 'label') {
      diagnostics.push(
        atlasPngDiagnostic(
          ATLAS_PNG_DIAGNOSTIC_CODES.fontUnsupported,
          `Render node ${node.id} contains text; atlas-png-v1 uses no fonts or rendered labels.`,
          node.id,
        ),
      );
      continue;
    }

    pointCount += nodePointCount(node);
    const layer = nodeLayer(node);
    if (!validNode(node, scene) || !validNodeKindForLayer(node, layer)) {
      diagnostics.push(
        atlasPngDiagnostic(
          ATLAS_PNG_DIAGNOSTIC_CODES.nodeInvalid,
          `Render node ${node.id} contains unsupported paint, geometry, or stroke width.`,
          node.id,
        ),
      );
    }
    const previousId = previousIdsByLayer.get(layer);
    if (layer < 0 || layer < previousLayer || (previousId !== undefined && previousId >= node.id)) {
      diagnostics.push(
        atlasPngDiagnostic(
          ATLAS_PNG_DIAGNOSTIC_CODES.zOrderInvalid,
          `Render node ${node.id} appears outside canonical atlas paint order.`,
          node.id,
        ),
      );
    }
    if (layer >= 0) {
      populatedLayers.add(layer);
      previousIdsByLayer.set(layer, node.id);
    }
    hasCoastalEcho ||= node.id.startsWith('atlas-water/echo/');
    hasWaterMark ||= node.id.startsWith('atlas-water/mark/');
    previousLayer = Math.max(previousLayer, layer);
  }

  if (pointCount > ATLAS_PNG_MAXIMUM_POINTS) {
    diagnostics.push(
      atlasPngDiagnostic(
        ATLAS_PNG_DIAGNOSTIC_CODES.resourceLimitExceeded,
        `The atlas scene exceeds the ${String(ATLAS_PNG_MAXIMUM_POINTS)}-point PNG profile limit.`,
      ),
    );
  }
  if (!hasCompleteAtlasLayers(scene, populatedLayers, hasCoastalEcho, hasWaterMark)) {
    diagnostics.push(
      atlasPngDiagnostic(
        ATLAS_PNG_DIAGNOSTIC_CODES.sceneUnsupported,
        'The complete atlas scene must include canonical backgrounds, land, paper, water decoration, and coastline ink.',
      ),
    );
  }
}

function isSupportedStyle(style: AtlasPngStyleMetadata): boolean {
  return (
    style.styleId === ATLAS_PNG_SUPPORTED_STYLE_ID &&
    style.styleBehaviorVersion === 1 &&
    style.tokenVersion === 1
  );
}

function isSupportedAtlasScene(scene: AtlasPngSceneInput): scene is AtlasRenderScene {
  const projection = (
    scene as unknown as { readonly projection?: Readonly<Record<string, unknown>> }
  ).projection;
  const supported = ATLAS_DISPLAY_PROJECTION_METADATA;
  return (
    scene.authority === 'disposable-render-scene' &&
    scene.sceneKind === 'whole-world-atlas' &&
    scene.sceneCompositionVersion === ATLAS_SCENE_COMPOSITION_VERSION &&
    scene.levelOfDetail === ATLAS_SCENE_LEVELS_OF_DETAIL.normalAtlas &&
    scene.coordinateSpace === ATLAS_DISPLAY_COORDINATE_SPACE &&
    scene.widthPx === ATLAS_SCENE_WIDTH_PX &&
    scene.heightPx === ATLAS_SCENE_HEIGHT_PX &&
    projection?.projectionId === supported.projectionId &&
    projection.projectionVersion === supported.projectionVersion &&
    projection.seamPolicyVersion === supported.seamPolicyVersion &&
    projection.coordinateSpace === supported.coordinateSpace &&
    projection.authority === supported.authority &&
    projection.seamLongitudeTicks === supported.seamLongitudeTicks &&
    projection.widthDisplayTicks === supported.widthDisplayTicks &&
    projection.heightDisplayTicks === supported.heightDisplayTicks &&
    projection.logicalAspectRatio === supported.logicalAspectRatio &&
    projection.xDirection === supported.xDirection &&
    projection.yDirection === supported.yDirection &&
    projection.semanticToleranceTicks === supported.semanticToleranceTicks &&
    typeof scene.sourceWorldMapId === 'string'
  );
}

function validSourceLinks(node: RenderNode): boolean {
  const related = node.relatedSourceIds ?? [];
  return (
    parseStableId('entity', node.sourceId).ok &&
    node.sourceAspectId !== undefined &&
    parseStableId('aspect', node.sourceAspectId).ok &&
    related.every((value) => parseStableId('entity', value).ok) &&
    new Set(related).size === related.length &&
    related.every((value, index) => index === 0 || (related[index - 1] ?? '') < value)
  );
}

function validNode(node: RenderNode, scene: RenderScene): boolean {
  switch (node.kind) {
    case 'rectangle':
      return (
        validColor(node.fillColor) &&
        validNumber(node.xPx, 0, scene.widthPx) &&
        validNumber(node.yPx, 0, scene.heightPx) &&
        validNumber(node.widthPx, Number.MIN_VALUE, scene.widthPx) &&
        validNumber(node.heightPx, Number.MIN_VALUE, scene.heightPx) &&
        node.xPx + node.widthPx <= scene.widthPx &&
        node.yPx + node.heightPx <= scene.heightPx
      );
    case 'polygon':
      return false;
    case 'compoundPath':
      return (
        validColor(node.fillColor) &&
        hasEvenOddFill(node) &&
        node.subpaths.length > 0 &&
        node.subpaths.every(({ points }) => points.length >= 3 && validPoints(points, scene))
      );
    case 'polyline':
      return (
        node.points.length >= 2 &&
        validPoints(node.points, scene) &&
        validColor(node.strokeColor) &&
        validNumber(node.strokeWidthPx, Number.MIN_VALUE, ATLAS_PNG_MAXIMUM_SCENE_STROKE_WIDTH_PX)
      );
    case 'label':
      return false;
  }
}

function validNodeKindForLayer(node: RenderNode, layer: number): boolean {
  if (layer === 0 || layer === 1) {
    return (
      node.kind === 'rectangle' &&
      node.xPx === 0 &&
      node.yPx === 0 &&
      node.widthPx === ATLAS_SCENE_WIDTH_PX &&
      node.heightPx === ATLAS_SCENE_HEIGHT_PX
    );
  }
  if (layer === 2) return node.kind === 'compoundPath';
  if (layer === 3 || layer === 4 || layer === 5) return node.kind === 'polyline';
  return false;
}

function nodePointCount(node: Exclude<RenderNode, { readonly kind: 'label' }>): number {
  switch (node.kind) {
    case 'rectangle':
      return 0;
    case 'polygon':
    case 'polyline':
      return node.points.length;
    case 'compoundPath':
      return node.subpaths.reduce((total, { points }) => total + points.length, 0);
  }
}

function validPoints(points: readonly RenderPoint[], scene: RenderScene): boolean {
  return points.every(
    ({ xPx, yPx }) => validNumber(xPx, 0, scene.widthPx) && validNumber(yPx, 0, scene.heightPx),
  );
}

function validNumber(value: number, minimum: number, maximum: number): boolean {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

function validColor(value: string): boolean {
  return COLOR_PATTERN.test(value);
}

function hasEvenOddFill(node: RenderNode): boolean {
  return (node as unknown as { readonly fillRule?: unknown }).fillRule === 'evenodd';
}

function nodeLayer(node: RenderNode): number {
  if (node.id === 'atlas/background/paper') return 0;
  if (node.id === 'atlas/background/water') return 1;
  if (node.id.startsWith('atlas/land/')) return 2;
  if (node.id.startsWith('atlas/paper/')) return 3;
  if (node.id.startsWith('atlas-water/')) return 4;
  if (node.id.startsWith('atlas/coastline/')) return 5;
  return -1;
}

function hasCompleteAtlasLayers(
  scene: AtlasPngSceneInput,
  populatedLayers: ReadonlySet<number>,
  hasCoastalEcho: boolean,
  hasWaterMark: boolean,
): boolean {
  return (
    scene.nodes[0]?.id === 'atlas/background/paper' &&
    scene.nodes[1]?.id === 'atlas/background/water' &&
    [0, 1, 2, 3, 4, 5].every((layer) => populatedLayers.has(layer)) &&
    hasCoastalEcho &&
    hasWaterMark
  );
}
