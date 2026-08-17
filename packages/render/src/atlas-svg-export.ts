/** Canonical, renderer-only SVG export for an accepted whole-world atlas scene. */

import type { AtlasStyleTokens, RenderNode, RenderPoint, RenderScene } from '@ttrpg-map/core';

import {
  ATLAS_DISPLAY_COORDINATE_SPACE,
  ATLAS_DISPLAY_PROJECTION_METADATA,
} from './atlas-display-projection.js';
import {
  ATLAS_SCENE_COMPOSITION_VERSION,
  ATLAS_SCENE_HEIGHT_PX,
  ATLAS_SCENE_LEVELS_OF_DETAIL,
  ATLAS_SCENE_WIDTH_PX,
  type AtlasRenderScene,
} from './atlas-scene.js';
import {
  atlasSvgFooterLines,
  atlasSvgHeaderLines,
  type AtlasSvgSerializationInput,
  renderAtlasSvgNode,
  serializeAtlasSvg,
} from './atlas-svg-serialization.js';

export const ATLAS_SVG_EXPORT_PROFILE_ID = 'atlas-svg-v1' as const;
export const ATLAS_SVG_EXPORT_VERSION = 1 as const;
export const ATLAS_SVG_FONT_POLICY = 'no-rendered-text-v1' as const;
export const ATLAS_SVG_SUPPORTED_STYLE_ID = 'atlas-style.restrained-ink' as const;
export const ATLAS_SVG_MAXIMUM_BYTES = 32 * 1_024 * 1_024;
export const ATLAS_SVG_DEFAULT_DIMENSIONS = Object.freeze({
  widthMillimeters: 400,
  heightMillimeters: 200,
});
export const ATLAS_SVG_DIMENSION_LIMITS = Object.freeze({
  minimumWidthMillimeters: 200,
  maximumWidthMillimeters: 1_600,
  minimumHeightMillimeters: 100,
  maximumHeightMillimeters: 800,
});

export const ATLAS_SVG_DIAGNOSTIC_CODES = Object.freeze({
  cancelled: 'atlas-svg.export.cancelled',
  dimensionsInvalid: 'atlas-svg.dimensions.invalid',
  duplicateNodeId: 'atlas-svg.node-id.duplicate',
  fontUnsupported: 'atlas-svg.font.unsupported',
  nodeInvalid: 'atlas-svg.node.invalid',
  outputTooLarge: 'atlas-svg.output.too-large',
  sceneUnsupported: 'atlas-svg.scene.unsupported',
  sourceLinkInvalid: 'atlas-svg.source-link.invalid',
  styleUnsupported: 'atlas-svg.style.unsupported',
  zOrderInvalid: 'atlas-svg.z-order.invalid',
} as const);

export type AtlasSvgDiagnosticCode =
  (typeof ATLAS_SVG_DIAGNOSTIC_CODES)[keyof typeof ATLAS_SVG_DIAGNOSTIC_CODES];

export interface AtlasSvgDiagnostic {
  readonly code: AtlasSvgDiagnosticCode;
  readonly message: string;
  readonly sourceId?: string;
}

export interface AtlasSvgDimensions {
  readonly widthMillimeters: number;
  readonly heightMillimeters: number;
}

export interface AtlasSvgStyleMetadata {
  readonly styleId: AtlasStyleTokens['styleId'];
  readonly styleBehaviorVersion: number;
  readonly tokenVersion: number;
}

export type AtlasSvgSceneInput = RenderScene & Partial<AtlasRenderScene>;

export interface AtlasSvgExportRequest {
  readonly scene: AtlasSvgSceneInput;
  readonly style: AtlasSvgStyleMetadata;
  readonly dimensions?: AtlasSvgDimensions;
}

export interface AtlasSvgExport {
  readonly profileId: typeof ATLAS_SVG_EXPORT_PROFILE_ID;
  readonly profileVersion: typeof ATLAS_SVG_EXPORT_VERSION;
  readonly widthMillimeters: number;
  readonly heightMillimeters: number;
  readonly byteLength: number;
  readonly svg: string;
  readonly bytes: Uint8Array;
}

export type AtlasSvgExportResult =
  | { readonly ok: true; readonly value: AtlasSvgExport }
  | { readonly ok: false; readonly diagnostics: readonly AtlasSvgDiagnostic[] };

export interface AtlasSvgExportProgress {
  readonly profileId: typeof ATLAS_SVG_EXPORT_PROFILE_ID;
  readonly stage: 'validating' | 'serializing' | 'verifying' | 'completed' | 'cancelled' | 'failed';
  readonly completedNodes: number;
  readonly totalNodes: number;
  readonly isTerminal: boolean;
}

export interface AtlasSvgExportRuntime {
  readonly isCancellationRequested: () => boolean;
  readonly reportProgress: (progress: AtlasSvgExportProgress) => void;
  readonly yieldControl: () => Promise<void>;
}

interface ValidatedExport {
  readonly scene: AtlasRenderScene;
  readonly style: AtlasSvgStyleMetadata;
  readonly dimensions: AtlasSvgDimensions;
}

const UTF8_ENCODER = new TextEncoder();
const COLOR_PATTERN = /^#[0-9a-f]{6}$/u;
const SOURCE_ID_PATTERN = /^[\x20-\x7e]+$/u;
const SERIALIZATION_BATCH_SIZE = 128;

/** Serialize the exact accepted atlas scene without consulting geography or generator state. */
export function exportAtlasSceneToSvg(request: AtlasSvgExportRequest): AtlasSvgExportResult {
  const validated = validateRequest(request);
  if (!validated.ok) return validated;
  return finishExport(validated.value, serializeAtlasSvg(serializationInput(validated.value)));
}

/**
 * Cancellable production serialization. Cancellation is observed between bounded node batches;
 * scheduling never changes completed canonical bytes.
 */
export async function exportAtlasSceneToSvgAsync(
  request: AtlasSvgExportRequest,
  runtime: AtlasSvgExportRuntime,
): Promise<AtlasSvgExportResult> {
  runtime.reportProgress(progress('validating', 0, request.scene.nodes.length, false));
  if (runtime.isCancellationRequested()) return cancelled(runtime, request.scene.nodes.length, 0);
  const validated = validateRequest(request);
  if (!validated.ok) {
    runtime.reportProgress(progress('failed', 0, request.scene.nodes.length, true));
    return validated;
  }
  const { scene } = validated.value;
  const serialization = serializationInput(validated.value);
  const lines = atlasSvgHeaderLines(serialization);
  for (let start = 0; start < scene.nodes.length; start += SERIALIZATION_BATCH_SIZE) {
    if (runtime.isCancellationRequested()) return cancelled(runtime, scene.nodes.length, start);
    const end = Math.min(scene.nodes.length, start + SERIALIZATION_BATCH_SIZE);
    for (let index = start; index < end; index += 1) {
      const node = scene.nodes[index];
      if (node !== undefined) lines.push(`    ${renderAtlasSvgNode(node)}`);
    }
    runtime.reportProgress(progress('serializing', end, scene.nodes.length, false));
    await runtime.yieldControl();
  }
  if (runtime.isCancellationRequested()) {
    return cancelled(runtime, scene.nodes.length, scene.nodes.length);
  }
  lines.push(...atlasSvgFooterLines());
  runtime.reportProgress(progress('verifying', scene.nodes.length, scene.nodes.length, false));
  const result = finishExport(validated.value, `${lines.join('\n')}\n`);
  if (result.ok) {
    runtime.reportProgress(progress('completed', scene.nodes.length, scene.nodes.length, true));
  } else {
    runtime.reportProgress(progress('failed', scene.nodes.length, scene.nodes.length, true));
  }
  return result;
}

function validateRequest(
  request: AtlasSvgExportRequest,
):
  | { readonly ok: true; readonly value: ValidatedExport }
  | { readonly ok: false; readonly diagnostics: readonly AtlasSvgDiagnostic[] } {
  const dimensions = request.dimensions ?? ATLAS_SVG_DEFAULT_DIMENSIONS;
  const diagnostics: AtlasSvgDiagnostic[] = [];
  if (!validDimensions(dimensions)) {
    diagnostics.push(
      diagnostic(
        ATLAS_SVG_DIAGNOSTIC_CODES.dimensionsInvalid,
        'Choose whole-millimetre 2:1 atlas dimensions from 200 × 100 mm through 1600 × 800 mm.',
      ),
    );
  }
  const scene = request.scene;
  if (!isSupportedAtlasScene(scene)) {
    diagnostics.push(
      diagnostic(
        ATLAS_SVG_DIAGNOSTIC_CODES.sceneUnsupported,
        'Export a complete normal-detail version-2 whole-world AtlasRenderScene in the accepted equirectangular coordinate space.',
      ),
    );
  }
  if (
    request.style.styleId !== ATLAS_SVG_SUPPORTED_STYLE_ID ||
    request.style.styleBehaviorVersion !== 1 ||
    request.style.tokenVersion !== 1
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_SVG_DIAGNOSTIC_CODES.styleUnsupported,
        'The atlas SVG exporter supports an explicit version-1 built-in style and token set.',
      ),
    );
  }
  const ids = new Set<string>();
  const previousIdsByLayer = new Map<number, string>();
  const populatedLayers = new Set<number>();
  let hasCoastalEcho = false;
  let hasWaterMark = false;
  let previousLayer = -1;
  for (const node of scene.nodes) {
    if (ids.has(node.id)) {
      diagnostics.push(
        diagnostic(
          ATLAS_SVG_DIAGNOSTIC_CODES.duplicateNodeId,
          `Render node ${node.id} is duplicated; rebuild the accepted atlas scene before export.`,
          node.id,
        ),
      );
    }
    ids.add(node.id);
    if (!validSourceLinks(node)) {
      diagnostics.push(
        diagnostic(
          ATLAS_SVG_DIAGNOSTIC_CODES.sourceLinkInvalid,
          `Render node ${node.id} must retain one source entity, one source aspect, and sorted unique related source IDs.`,
          node.id,
        ),
      );
    }
    if (node.kind === 'label') {
      diagnostics.push(
        diagnostic(
          ATLAS_SVG_DIAGNOSTIC_CODES.fontUnsupported,
          `Render node ${node.id} contains text; atlas-svg-v1 embeds no fonts and accepts no rendered labels.`,
          node.id,
        ),
      );
      continue;
    }
    const layer = nodeLayer(node);
    if (!validNode(node, scene) || !validNodeKindForLayer(node, layer)) {
      diagnostics.push(
        diagnostic(
          ATLAS_SVG_DIAGNOSTIC_CODES.nodeInvalid,
          `Render node ${node.id} contains unsupported paint, geometry, or non-finite/out-of-bounds coordinates.`,
          node.id,
        ),
      );
    }
    const previousId = previousIdsByLayer.get(layer);
    if (layer < 0 || layer < previousLayer || (previousId !== undefined && previousId >= node.id)) {
      diagnostics.push(
        diagnostic(
          ATLAS_SVG_DIAGNOSTIC_CODES.zOrderInvalid,
          `Render node ${node.id} appears outside the canonical background, land, paper, water-decoration, coastline z-order.`,
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
  if (
    scene.nodes[0]?.id !== 'atlas/background/paper' ||
    scene.nodes[1]?.id !== 'atlas/background/water'
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_SVG_DIAGNOSTIC_CODES.zOrderInvalid,
        'The complete atlas scene must begin with its paper and water background nodes.',
      ),
    );
  }
  if (
    ![0, 1, 2, 3, 4, 5].every((layer) => populatedLayers.has(layer)) ||
    !hasCoastalEcho ||
    !hasWaterMark
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_SVG_DIAGNOSTIC_CODES.sceneUnsupported,
        'The complete normal-detail atlas scene must include backgrounds, land, paper treatment, coastal echoes, water marks, and coastline ink.',
      ),
    );
  }
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

function serializationInput(input: ValidatedExport): AtlasSvgSerializationInput {
  return {
    ...input,
    profileId: ATLAS_SVG_EXPORT_PROFILE_ID,
    profileVersion: ATLAS_SVG_EXPORT_VERSION,
    fontPolicy: ATLAS_SVG_FONT_POLICY,
  };
}

function finishExport(input: ValidatedExport, svg: string): AtlasSvgExportResult {
  const bytes = UTF8_ENCODER.encode(svg);
  if (bytes.byteLength > ATLAS_SVG_MAXIMUM_BYTES) {
    return {
      ok: false,
      diagnostics: Object.freeze([
        diagnostic(
          ATLAS_SVG_DIAGNOSTIC_CODES.outputTooLarge,
          `The canonical SVG is ${String(bytes.byteLength)} bytes; reduce scene complexity before retrying the ${String(ATLAS_SVG_MAXIMUM_BYTES)}-byte atlas limit.`,
        ),
      ]),
    };
  }
  return {
    ok: true,
    value: Object.freeze({
      profileId: ATLAS_SVG_EXPORT_PROFILE_ID,
      profileVersion: ATLAS_SVG_EXPORT_VERSION,
      widthMillimeters: input.dimensions.widthMillimeters,
      heightMillimeters: input.dimensions.heightMillimeters,
      byteLength: bytes.byteLength,
      svg,
      bytes,
    }),
  };
}

function validDimensions(dimensions: AtlasSvgDimensions): boolean {
  return (
    Number.isSafeInteger(dimensions.widthMillimeters) &&
    Number.isSafeInteger(dimensions.heightMillimeters) &&
    dimensions.widthMillimeters >= ATLAS_SVG_DIMENSION_LIMITS.minimumWidthMillimeters &&
    dimensions.widthMillimeters <= ATLAS_SVG_DIMENSION_LIMITS.maximumWidthMillimeters &&
    dimensions.heightMillimeters >= ATLAS_SVG_DIMENSION_LIMITS.minimumHeightMillimeters &&
    dimensions.heightMillimeters <= ATLAS_SVG_DIMENSION_LIMITS.maximumHeightMillimeters &&
    dimensions.widthMillimeters === dimensions.heightMillimeters * 2
  );
}

function validSourceLinks(node: RenderNode): boolean {
  const related = node.relatedSourceIds ?? [];
  return (
    validSourceId(node.id) &&
    validSourceId(node.sourceId) &&
    node.sourceAspectId !== undefined &&
    validSourceId(node.sourceAspectId) &&
    related.every(validSourceId) &&
    new Set(related).size === related.length &&
    related.every((value, index) => index === 0 || (related[index - 1] ?? '') < value)
  );
}

function validSourceId(value: string): boolean {
  return value.length > 0 && SOURCE_ID_PATTERN.test(value);
}

function validNode(node: RenderNode, scene: RenderScene): boolean {
  switch (node.kind) {
    case 'rectangle':
      return (
        validColor(node.fillColor) &&
        validNumber(node.xPx, 0, scene.widthPx) &&
        validNumber(node.yPx, 0, scene.heightPx) &&
        validNumber(node.widthPx, 0, scene.widthPx) &&
        validNumber(node.heightPx, 0, scene.heightPx) &&
        node.xPx + node.widthPx <= scene.widthPx &&
        node.yPx + node.heightPx <= scene.heightPx
      );
    case 'polygon':
      return false;
    case 'compoundPath':
      return (
        validColor(node.fillColor) &&
        (node as unknown as Readonly<Record<string, unknown>>).fillRule === 'evenodd' &&
        node.subpaths.length > 0 &&
        node.subpaths.every(({ points }) => points.length >= 3 && validPoints(points, scene))
      );
    case 'polyline':
      return (
        node.points.length >= 2 &&
        validPoints(node.points, scene) &&
        validColor(node.strokeColor) &&
        validNumber(node.strokeWidthPx, Number.MIN_VALUE, scene.widthPx)
      );
    case 'label':
      return false;
  }
}

function isSupportedAtlasScene(scene: AtlasSvgSceneInput): scene is AtlasRenderScene {
  const projection = (
    scene as unknown as { readonly projection?: Readonly<Record<string, unknown>> }
  ).projection;
  const supportedProjection = ATLAS_DISPLAY_PROJECTION_METADATA;
  return (
    scene.authority === 'disposable-render-scene' &&
    scene.sceneKind === 'whole-world-atlas' &&
    scene.sceneCompositionVersion === ATLAS_SCENE_COMPOSITION_VERSION &&
    scene.levelOfDetail === ATLAS_SCENE_LEVELS_OF_DETAIL.normalAtlas &&
    scene.coordinateSpace === ATLAS_DISPLAY_COORDINATE_SPACE &&
    scene.widthPx === ATLAS_SCENE_WIDTH_PX &&
    scene.heightPx === ATLAS_SCENE_HEIGHT_PX &&
    projection?.projectionId === supportedProjection.projectionId &&
    projection.projectionVersion === supportedProjection.projectionVersion &&
    projection.seamPolicyVersion === supportedProjection.seamPolicyVersion &&
    projection.coordinateSpace === supportedProjection.coordinateSpace &&
    projection.authority === supportedProjection.authority &&
    projection.seamLongitudeTicks === supportedProjection.seamLongitudeTicks &&
    projection.widthDisplayTicks === supportedProjection.widthDisplayTicks &&
    projection.heightDisplayTicks === supportedProjection.heightDisplayTicks &&
    projection.logicalAspectRatio === supportedProjection.logicalAspectRatio &&
    projection.xDirection === supportedProjection.xDirection &&
    projection.yDirection === supportedProjection.yDirection &&
    projection.semanticToleranceTicks === supportedProjection.semanticToleranceTicks &&
    scene.sourceWorldMapId !== undefined &&
    validSourceId(scene.sourceWorldMapId)
  );
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

function nodeLayer(node: RenderNode): number {
  if (node.id === 'atlas/background/paper') return 0;
  if (node.id === 'atlas/background/water') return 1;
  if (node.id.startsWith('atlas/land/')) return 2;
  if (node.id.startsWith('atlas/paper/')) return 3;
  if (node.id.startsWith('atlas-water/')) return 4;
  if (node.id.startsWith('atlas/coastline/')) return 5;
  return -1;
}

function validNodeKindForLayer(node: RenderNode, layer: number): boolean {
  if (layer === 0 || layer === 1) return node.kind === 'rectangle';
  if (layer === 2) return node.kind === 'compoundPath';
  if (layer === 3 || layer === 4 || layer === 5) return node.kind === 'polyline';
  return false;
}

function diagnostic(
  code: AtlasSvgDiagnosticCode,
  message: string,
  sourceId?: string,
): AtlasSvgDiagnostic {
  return Object.freeze({ code, message, ...(sourceId === undefined ? {} : { sourceId }) });
}

function progress(
  stage: AtlasSvgExportProgress['stage'],
  completedNodes: number,
  totalNodes: number,
  isTerminal: boolean,
): AtlasSvgExportProgress {
  return Object.freeze({
    profileId: ATLAS_SVG_EXPORT_PROFILE_ID,
    stage,
    completedNodes,
    totalNodes,
    isTerminal,
  });
}

function cancelled(
  runtime: AtlasSvgExportRuntime,
  totalNodes: number,
  completedNodes: number,
): AtlasSvgExportResult {
  runtime.reportProgress(progress('cancelled', completedNodes, totalNodes, true));
  return {
    ok: false,
    diagnostics: Object.freeze([
      diagnostic(
        ATLAS_SVG_DIAGNOSTIC_CODES.cancelled,
        'Atlas SVG export was cancelled before any destination file was committed.',
      ),
    ]),
  };
}
