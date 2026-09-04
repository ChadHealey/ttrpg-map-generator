/** Canonical, renderer-only SVG export for an accepted whole-world atlas scene. */

import {
  type AtlasStyleTokens,
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
  ATLAS_LABEL_SCENE_COMPOSITION_VERSION,
  ATLAS_SCENE_COMPOSITION_VERSION,
  ATLAS_SCENE_HEIGHT_PX,
  ATLAS_SCENE_LEVELS_OF_DETAIL,
  ATLAS_SCENE_WIDTH_PX,
  type AtlasRenderScene,
} from './atlas-scene.js';
import {
  atlasSvgFooterLines,
  atlasSvgHeaderLines,
  atlasSvgHeaderPrefixLines,
  atlasSvgHeaderSuffixLines,
  type AtlasSvgSerializationInput,
  renderAtlasSvgGlyphDefinition,
  renderAtlasSvgLabelNode,
  renderAtlasSvgNode,
  serializeAtlasSvg,
  serializeAtlasSvgWithinByteLimit,
} from './atlas-svg-serialization.js';
import {
  ATLAS_VECTOR_LABEL_FONT_POLICY,
  ATLAS_VECTOR_LABEL_MAXIMUM_STORED_POINTS,
  validateAndExpandAtlasVectorLabelLayer,
  validateAndExpandAtlasVectorLabelLayerAsync,
  type ValidatedAtlasVectorLabelLayer,
} from './atlas-vector-label.js';

export const ATLAS_SVG_EXPORT_PROFILE_ID = 'atlas-svg-v1' as const;
export const ATLAS_SVG_EXPORT_VERSION = 1 as const;
export const ATLAS_SVG_PHYSICAL_OVERLAY_EXPORT_PROFILE_ID = 'atlas-svg-v2' as const;
export const ATLAS_SVG_PHYSICAL_OVERLAY_EXPORT_VERSION = 2 as const;
export const ATLAS_SVG_LABEL_EXPORT_PROFILE_ID = 'atlas-svg-v3' as const;
export const ATLAS_SVG_LABEL_EXPORT_VERSION = 3 as const;
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

/** Explicit opt-in request for the SVG profile that admits source-linked physical overlays. */
export type AtlasSvgPhysicalOverlayExportRequest = AtlasSvgExportRequest;

export interface AtlasSvgExport {
  readonly profileId: typeof ATLAS_SVG_EXPORT_PROFILE_ID;
  readonly profileVersion: typeof ATLAS_SVG_EXPORT_VERSION;
  readonly widthMillimeters: number;
  readonly heightMillimeters: number;
  readonly byteLength: number;
  readonly svg: string;
  readonly bytes: Uint8Array;
}

export interface AtlasSvgPhysicalOverlayExport extends Omit<
  AtlasSvgExport,
  'profileId' | 'profileVersion'
> {
  readonly profileId: typeof ATLAS_SVG_PHYSICAL_OVERLAY_EXPORT_PROFILE_ID;
  readonly profileVersion: typeof ATLAS_SVG_PHYSICAL_OVERLAY_EXPORT_VERSION;
}

export interface AtlasSvgLabelExport extends Omit<AtlasSvgExport, 'profileId' | 'profileVersion'> {
  readonly profileId: typeof ATLAS_SVG_LABEL_EXPORT_PROFILE_ID;
  readonly profileVersion: typeof ATLAS_SVG_LABEL_EXPORT_VERSION;
}

export type AtlasSvgLabelExportResult =
  | { readonly ok: true; readonly value: AtlasSvgLabelExport }
  | { readonly ok: false; readonly diagnostics: readonly AtlasSvgDiagnostic[] };

export type AtlasSvgExportResult =
  | { readonly ok: true; readonly value: AtlasSvgExport }
  | { readonly ok: false; readonly diagnostics: readonly AtlasSvgDiagnostic[] };

export type AtlasSvgPhysicalOverlayExportResult =
  | { readonly ok: true; readonly value: AtlasSvgPhysicalOverlayExport }
  | { readonly ok: false; readonly diagnostics: readonly AtlasSvgDiagnostic[] };

export interface AtlasSvgExportProgress {
  readonly profileId: typeof ATLAS_SVG_EXPORT_PROFILE_ID;
  readonly stage: 'validating' | 'serializing' | 'verifying' | 'completed' | 'cancelled' | 'failed';
  readonly completedNodes: number;
  readonly totalNodes: number;
  readonly isTerminal: boolean;
}

export interface AtlasSvgPhysicalOverlayExportProgress extends Omit<
  AtlasSvgExportProgress,
  'profileId'
> {
  readonly profileId: typeof ATLAS_SVG_PHYSICAL_OVERLAY_EXPORT_PROFILE_ID;
}

export interface AtlasSvgLabelExportProgress extends Omit<AtlasSvgExportProgress, 'profileId'> {
  readonly profileId: typeof ATLAS_SVG_LABEL_EXPORT_PROFILE_ID;
}

export interface AtlasSvgExportRuntime {
  readonly isCancellationRequested: () => boolean;
  readonly reportProgress: (progress: AtlasSvgExportProgress) => void;
  readonly yieldControl: () => Promise<void>;
}

export interface AtlasSvgPhysicalOverlayExportRuntime {
  readonly isCancellationRequested: () => boolean;
  readonly reportProgress: (progress: AtlasSvgPhysicalOverlayExportProgress) => void;
  readonly yieldControl: () => Promise<void>;
}

export interface AtlasSvgLabelExportRuntime {
  readonly isCancellationRequested: () => boolean;
  readonly reportProgress: (progress: AtlasSvgLabelExportProgress) => void;
  readonly yieldControl: () => Promise<void>;
}

interface ValidatedExport {
  readonly scene: AtlasRenderScene;
  readonly style: AtlasSvgStyleMetadata;
  readonly dimensions: AtlasSvgDimensions;
}

const UTF8_ENCODER = new TextEncoder();
const COLOR_PATTERN = /^#[0-9a-f]{6}$/u;
const RENDER_NODE_ID_PATTERN = /^[\x20-\x7e]+$/u;
const SERIALIZATION_BATCH_SIZE = 128;
const GLYPH_DEFINITION_BATCH_SIZE = 8;
const ATLAS_SVG_LABEL_MAXIMUM_NODES = 4_096;

/** Serialize the exact accepted atlas scene without consulting geography or generator state. */
export function exportAtlasSceneToSvg(request: AtlasSvgExportRequest): AtlasSvgExportResult {
  const validated = validateRequest(request, false);
  if (!validated.ok) return validated;
  return finishExport(validated.value, serializeAtlasSvg(serializationInput(validated.value)));
}

/** Serialize the explicit v2 profile that admits canonical physical-overlay scene nodes. */
export function exportAtlasSceneToSvgWithPhysicalOverlays(
  request: AtlasSvgPhysicalOverlayExportRequest,
): AtlasSvgPhysicalOverlayExportResult {
  const validated = validateRequest(request, true);
  if (!validated.ok) return validated;
  return finishPhysicalOverlayExport(
    validated.value,
    serializeAtlasSvg(
      serializationInput(validated.value, {
        profileId: ATLAS_SVG_PHYSICAL_OVERLAY_EXPORT_PROFILE_ID,
        profileVersion: ATLAS_SVG_PHYSICAL_OVERLAY_EXPORT_VERSION,
      }),
    ),
  );
}

/** Serialize the append-only v3 profile for accepted outlined atlas labels. */
export function exportAtlasSceneToSvgWithLabels(
  request: AtlasSvgExportRequest,
): AtlasSvgLabelExportResult {
  const validated = validateLabelRequest(request);
  if (!validated.ok) return validated;
  const serialized = serializeAtlasSvgWithinByteLimit(
    serializationInput(
      validated.value,
      {
        profileId: ATLAS_SVG_LABEL_EXPORT_PROFILE_ID,
        profileVersion: ATLAS_SVG_LABEL_EXPORT_VERSION,
      },
      ATLAS_VECTOR_LABEL_FONT_POLICY,
    ),
    ATLAS_SVG_MAXIMUM_BYTES,
  );
  if (!serialized.ok) {
    return {
      ok: false,
      diagnostics: Object.freeze([
        diagnostic(
          ATLAS_SVG_DIAGNOSTIC_CODES.outputTooLarge,
          `The canonical SVG exceeds the ${String(ATLAS_SVG_MAXIMUM_BYTES)}-byte atlas limit.`,
        ),
      ]),
    };
  }
  const result = finishExport(validated.value, serialized.value.svg);
  if (!result.ok) return result;
  return {
    ok: true,
    value: Object.freeze({
      ...result.value,
      profileId: ATLAS_SVG_LABEL_EXPORT_PROFILE_ID,
      profileVersion: ATLAS_SVG_LABEL_EXPORT_VERSION,
    }),
  };
}

/** Cancellable v3 serialization with the same bytes and pre-allocation ceiling as the sync API. */
export async function exportAtlasSceneToSvgWithLabelsAsync(
  request: AtlasSvgExportRequest,
  runtime: AtlasSvgLabelExportRuntime,
): Promise<AtlasSvgLabelExportResult> {
  runtime.reportProgress(labelProgress('validating', 0, request.scene.nodes.length, false));
  if (runtime.isCancellationRequested()) {
    return labelCancelled(runtime, request.scene.nodes.length, 0);
  }
  await runtime.yieldControl();
  if (runtime.isCancellationRequested()) {
    return labelCancelled(runtime, request.scene.nodes.length, 0);
  }
  const validated = await validateLabelRequestAsync(request, runtime);
  if ('cancelled' in validated) {
    return labelCancelled(runtime, request.scene.nodes.length, 0);
  }
  if (!validated.ok) {
    runtime.reportProgress(labelProgress('failed', 0, request.scene.nodes.length, true));
    return validated;
  }
  const { scene } = validated.value;
  const serialization = serializationInput(
    validated.value,
    {
      profileId: ATLAS_SVG_LABEL_EXPORT_PROFILE_ID,
      profileVersion: ATLAS_SVG_LABEL_EXPORT_VERSION,
    },
    ATLAS_VECTOR_LABEL_FONT_POLICY,
  );
  const lines: string[] = [];
  let byteLength = 0;
  const appendLines = (batch: readonly string[]): boolean => {
    for (const line of batch) {
      byteLength += UTF8_ENCODER.encode(`${line}\n`).byteLength;
      if (byteLength > ATLAS_SVG_MAXIMUM_BYTES) return false;
      lines.push(line);
    }
    return true;
  };
  if (!appendLines(atlasSvgHeaderPrefixLines(serialization))) {
    return labelOutputTooLarge(runtime, scene.nodes.length, 0);
  }
  const labels = new Map(scene.vectorLabels?.nodes.map((node) => [node.id, node] as const));
  runtime.reportProgress(labelProgress('serializing', 0, scene.nodes.length, false));
  await runtime.yieldControl();
  const definitions = scene.vectorLabels?.definitions ?? [];
  for (let start = 0; start < definitions.length; start += GLYPH_DEFINITION_BATCH_SIZE) {
    if (runtime.isCancellationRequested()) {
      return labelCancelled(runtime, scene.nodes.length, 0);
    }
    const end = Math.min(definitions.length, start + GLYPH_DEFINITION_BATCH_SIZE);
    if (!appendLines(definitions.slice(start, end).map(renderAtlasSvgGlyphDefinition))) {
      return labelOutputTooLarge(runtime, scene.nodes.length, 0);
    }
    await runtime.yieldControl();
  }
  if (runtime.isCancellationRequested()) return labelCancelled(runtime, scene.nodes.length, 0);
  if (!appendLines(atlasSvgHeaderSuffixLines(serialization))) {
    return labelOutputTooLarge(runtime, scene.nodes.length, 0);
  }
  for (let start = 0; start < scene.nodes.length; start += SERIALIZATION_BATCH_SIZE) {
    if (runtime.isCancellationRequested())
      return labelCancelled(runtime, scene.nodes.length, start);
    const end = Math.min(scene.nodes.length, start + SERIALIZATION_BATCH_SIZE);
    for (let index = start; index < end; index += 1) {
      const node = scene.nodes[index];
      if (node === undefined) continue;
      const label = labels.get(node.id);
      if (
        !appendLines([
          `    ${label === undefined ? renderAtlasSvgNode(node) : renderAtlasSvgLabelNode(node, label)}`,
        ])
      ) {
        return labelOutputTooLarge(runtime, scene.nodes.length, index);
      }
    }
    runtime.reportProgress(labelProgress('serializing', end, scene.nodes.length, false));
    await runtime.yieldControl();
  }
  if (runtime.isCancellationRequested()) {
    return labelCancelled(runtime, scene.nodes.length, scene.nodes.length);
  }
  if (!appendLines(atlasSvgFooterLines())) {
    return labelOutputTooLarge(runtime, scene.nodes.length, scene.nodes.length);
  }
  runtime.reportProgress(labelProgress('verifying', scene.nodes.length, scene.nodes.length, false));
  const result = finishExport(validated.value, lines.join('\n').concat('\n'));
  if (!result.ok) {
    runtime.reportProgress(labelProgress('failed', scene.nodes.length, scene.nodes.length, true));
    return result;
  }
  runtime.reportProgress(labelProgress('completed', scene.nodes.length, scene.nodes.length, true));
  return {
    ok: true,
    value: Object.freeze({
      ...result.value,
      profileId: ATLAS_SVG_LABEL_EXPORT_PROFILE_ID,
      profileVersion: ATLAS_SVG_LABEL_EXPORT_VERSION,
    }),
  };
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
  const validated = validateRequest(request, false);
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

/** Cancellable v2 serialization. It retains the v1 bounded-batch cancellation contract. */
export async function exportAtlasSceneToSvgWithPhysicalOverlaysAsync(
  request: AtlasSvgPhysicalOverlayExportRequest,
  runtime: AtlasSvgPhysicalOverlayExportRuntime,
): Promise<AtlasSvgPhysicalOverlayExportResult> {
  runtime.reportProgress(
    physicalOverlayProgress('validating', 0, request.scene.nodes.length, false),
  );
  if (runtime.isCancellationRequested()) {
    return physicalOverlayCancelled(runtime, request.scene.nodes.length, 0);
  }
  const validated = validateRequest(request, true);
  if (!validated.ok) {
    runtime.reportProgress(physicalOverlayProgress('failed', 0, request.scene.nodes.length, true));
    return validated;
  }
  const { scene } = validated.value;
  const serialization = serializationInput(validated.value, {
    profileId: ATLAS_SVG_PHYSICAL_OVERLAY_EXPORT_PROFILE_ID,
    profileVersion: ATLAS_SVG_PHYSICAL_OVERLAY_EXPORT_VERSION,
  });
  const lines = atlasSvgHeaderLines(serialization);
  for (let start = 0; start < scene.nodes.length; start += SERIALIZATION_BATCH_SIZE) {
    if (runtime.isCancellationRequested())
      return physicalOverlayCancelled(runtime, scene.nodes.length, start);
    const end = Math.min(scene.nodes.length, start + SERIALIZATION_BATCH_SIZE);
    for (let index = start; index < end; index += 1) {
      const node = scene.nodes[index];
      if (node !== undefined) lines.push(`    ${renderAtlasSvgNode(node)}`);
    }
    runtime.reportProgress(physicalOverlayProgress('serializing', end, scene.nodes.length, false));
    await runtime.yieldControl();
  }
  if (runtime.isCancellationRequested()) {
    return physicalOverlayCancelled(runtime, scene.nodes.length, scene.nodes.length);
  }
  lines.push(...atlasSvgFooterLines());
  runtime.reportProgress(
    physicalOverlayProgress('verifying', scene.nodes.length, scene.nodes.length, false),
  );
  const result = finishPhysicalOverlayExport(validated.value, `${lines.join('\n')}\n`);
  runtime.reportProgress(
    physicalOverlayProgress(
      result.ok ? 'completed' : 'failed',
      scene.nodes.length,
      scene.nodes.length,
      true,
    ),
  );
  return result;
}

function validateRequest(
  request: AtlasSvgExportRequest,
  requiresPhysicalOverlay: boolean,
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
  if (scene.sourceWorldMapId === undefined || !parseStableId('map', scene.sourceWorldMapId).ok) {
    diagnostics.push(
      diagnostic(
        ATLAS_SVG_DIAGNOSTIC_CODES.sourceLinkInvalid,
        'The atlas scene sourceWorldMapId must be a canonical lowercase non-nil map UUID.',
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
  let hasPhysicalOverlay = false;
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
    if (!validRenderNodeId(node.id)) {
      diagnostics.push(
        diagnostic(
          ATLAS_SVG_DIAGNOSTIC_CODES.nodeInvalid,
          'Atlas render-node IDs must use non-empty printable ASCII text.',
          node.id,
        ),
      );
    }
    if (!validSourceLinks(node)) {
      diagnostics.push(
        diagnostic(
          ATLAS_SVG_DIAGNOSTIC_CODES.sourceLinkInvalid,
          `Render node ${node.id} must retain canonical lowercase non-nil UUID source entity/aspect IDs and sorted unique related source UUIDs.`,
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
    const layer = nodeLayer(node, requiresPhysicalOverlay);
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
    hasPhysicalOverlay ||= isPhysicalOverlayNodeId(node.id);
    if (node.id.startsWith('atlas/physical/') && !requiresPhysicalOverlay) {
      diagnostics.push(
        diagnostic(
          ATLAS_SVG_DIAGNOSTIC_CODES.sceneUnsupported,
          `${ATLAS_SVG_EXPORT_PROFILE_ID} rejects physical overlays; export this scene through ${ATLAS_SVG_PHYSICAL_OVERLAY_EXPORT_PROFILE_ID} version ${String(ATLAS_SVG_PHYSICAL_OVERLAY_EXPORT_VERSION)}.`,
          node.id,
        ),
      );
    }
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
    !(requiresPhysicalOverlay
      ? [0, 1, 2, 3, 4, 5, 6].every((layer) => populatedLayers.has(layer)) && hasPhysicalOverlay
      : [0, 1, 2, 3, 4, 5].every((layer) => populatedLayers.has(layer))) ||
    !hasCoastalEcho ||
    !hasWaterMark
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_SVG_DIAGNOSTIC_CODES.sceneUnsupported,
        requiresPhysicalOverlay
          ? 'The complete atlas-svg-v2 scene must include backgrounds, land, source-linked physical overlays, paper treatment, coastal echoes, water marks, and coastline ink.'
          : 'The complete normal-detail atlas scene must include backgrounds, land, paper treatment, coastal echoes, water marks, and coastline ink.',
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

function serializationInput(
  input: ValidatedExport,
  profile: {
    readonly profileId: string;
    readonly profileVersion: number;
  } = {
    profileId: ATLAS_SVG_EXPORT_PROFILE_ID,
    profileVersion: ATLAS_SVG_EXPORT_VERSION,
  },
  fontPolicy: string = ATLAS_SVG_FONT_POLICY,
): AtlasSvgSerializationInput {
  return {
    ...input,
    profileId: profile.profileId,
    profileVersion: profile.profileVersion,
    fontPolicy,
  };
}

function validateLabelRequest(request: AtlasSvgExportRequest): LabelRequestValidationResult {
  const scene = request.scene as AtlasRenderScene;
  if (
    scene.sceneCompositionVersion !== ATLAS_LABEL_SCENE_COMPOSITION_VERSION ||
    scene.vectorLabels === undefined
  ) {
    return {
      ok: false,
      diagnostics: Object.freeze([
        diagnostic(
          ATLAS_SVG_DIAGNOSTIC_CODES.sceneUnsupported,
          'atlas-svg-v3 requires a complete scene-version-4 outlined-label layer.',
        ),
      ]),
    };
  }
  const labels = validateAndExpandAtlasVectorLabelLayer(scene.vectorLabels);
  if (!labels.ok) return labelLayerValidationFailure(labels.diagnostics[0]);
  return consumeLabelRequestValidation(validateLabelRequestSteps(request, labels.value));
}

type LabelRequestValidationResult =
  | { readonly ok: true; readonly value: ValidatedExport }
  | { readonly ok: false; readonly diagnostics: readonly AtlasSvgDiagnostic[] };

type AsyncLabelRequestValidationResult =
  LabelRequestValidationResult | { readonly cancelled: true };

async function validateLabelRequestAsync(
  request: AtlasSvgExportRequest,
  runtime: AtlasSvgLabelExportRuntime,
): Promise<AsyncLabelRequestValidationResult> {
  const scene = request.scene as AtlasRenderScene;
  if (
    scene.sceneCompositionVersion !== ATLAS_LABEL_SCENE_COMPOSITION_VERSION ||
    scene.vectorLabels === undefined
  ) {
    return {
      ok: false,
      diagnostics: Object.freeze([
        diagnostic(
          ATLAS_SVG_DIAGNOSTIC_CODES.sceneUnsupported,
          'atlas-svg-v3 requires a complete scene-version-4 outlined-label layer.',
        ),
      ]),
    };
  }
  const labels = await validateAndExpandAtlasVectorLabelLayerAsync(scene.vectorLabels, runtime);
  if ('cancelled' in labels) return labels;
  if (!labels.ok) return labelLayerValidationFailure(labels.diagnostics[0]);

  const steps = validateLabelRequestSteps(request, labels.value);
  let step = steps.next();
  while (!step.done) {
    if (runtime.isCancellationRequested()) return { cancelled: true };
    await runtime.yieldControl();
    if (runtime.isCancellationRequested()) return { cancelled: true };
    step = steps.next();
  }
  return step.value;
}

function consumeLabelRequestValidation(
  steps: Generator<void, LabelRequestValidationResult>,
): LabelRequestValidationResult {
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}

function* validateLabelRequestSteps(
  request: AtlasSvgExportRequest,
  labels: ValidatedAtlasVectorLabelLayer,
): Generator<void, LabelRequestValidationResult> {
  const scene = request.scene as AtlasRenderScene;
  const { expanded } = labels;
  const labelIds = new Set(labels.layer.nodes.map(({ id }) => id));
  const actualLabelNodes = scene.nodes.slice(scene.nodes.length - expanded.length);
  const baseNodes = scene.nodes.slice(0, scene.nodes.length - expanded.length);
  let invalidLabelSuffix =
    scene.nodes.length < expanded.length || expanded.length !== labelIds.size;
  const sceneNodeIds = new Set<string>();
  let checkedNodes = 0;
  for (const node of scene.nodes) {
    invalidLabelSuffix ||= sceneNodeIds.has(node.id);
    sceneNodeIds.add(node.id);
    checkedNodes += 1;
    if (checkedNodes % SERIALIZATION_BATCH_SIZE === 0) yield;
  }
  for (const node of baseNodes) {
    invalidLabelSuffix ||= labelIds.has(node.id);
    checkedNodes += 1;
    if (checkedNodes % SERIALIZATION_BATCH_SIZE === 0) yield;
  }
  for (const [index, node] of expanded.entries()) {
    invalidLabelSuffix ||= !sameExpandedLabelNode(node, actualLabelNodes[index]);
    yield;
  }
  if (invalidLabelSuffix) {
    return {
      ok: false,
      diagnostics: Object.freeze([
        diagnostic(
          ATLAS_SVG_DIAGNOSTIC_CODES.sceneUnsupported,
          'Scene-version-4 label nodes must be the canonical expanded suffix after coastline ink.',
        ),
      ]),
    };
  }
  let storedPointCount = labels.definitionPointCount;
  checkedNodes = 0;
  for (const node of scene.nodes) {
    storedPointCount += renderNodePointCount(node);
    checkedNodes += 1;
    if (checkedNodes % SERIALIZATION_BATCH_SIZE === 0) yield;
  }
  if (
    scene.nodes.length > ATLAS_SVG_LABEL_MAXIMUM_NODES ||
    storedPointCount > ATLAS_VECTOR_LABEL_MAXIMUM_STORED_POINTS
  ) {
    return {
      ok: false,
      diagnostics: Object.freeze([
        diagnostic(
          ATLAS_SVG_DIAGNOSTIC_CODES.outputTooLarge,
          'The outlined-label scene exceeds its node or stored-point serialization budget.',
        ),
      ]),
    };
  }
  const baseScene = {
    ...scene,
    sceneCompositionVersion: ATLAS_SCENE_COMPOSITION_VERSION,
    nodes: baseNodes,
  };
  delete (baseScene as { vectorLabels?: unknown }).vectorLabels;
  const base = validateRequest(
    { ...request, scene: baseScene },
    baseNodes.some(({ id }) => id.startsWith('atlas/physical/')),
  );
  if (!base.ok) return base;
  for (const node of expanded) {
    if (!validNode(node, scene)) {
      return {
        ok: false,
        diagnostics: Object.freeze([
          diagnostic(
            ATLAS_SVG_DIAGNOSTIC_CODES.nodeInvalid,
            'Expanded atlas label contours are invalid or outside the fixed scene extent.',
          ),
        ]),
      };
    }
    yield;
  }
  return {
    ok: true,
    value: Object.freeze({
      scene,
      style: Object.freeze({ ...request.style }),
      dimensions: Object.freeze({ ...(request.dimensions ?? ATLAS_SVG_DEFAULT_DIMENSIONS) }),
    }),
  };
}

function labelLayerValidationFailure(
  finding:
    | {
        readonly code: string;
        readonly message: string;
        readonly sourceId?: string;
      }
    | undefined,
): LabelRequestValidationResult {
  return {
    ok: false,
    diagnostics: Object.freeze([
      diagnostic(
        finding?.code === 'atlas-vector-label.resource.exceeded'
          ? ATLAS_SVG_DIAGNOSTIC_CODES.outputTooLarge
          : finding?.code === 'atlas-vector-label.geometry.invalid'
            ? ATLAS_SVG_DIAGNOSTIC_CODES.nodeInvalid
            : ATLAS_SVG_DIAGNOSTIC_CODES.sceneUnsupported,
        finding?.message ?? 'The vector-label layer is invalid.',
        finding?.sourceId,
      ),
    ]),
  };
}

function sameExpandedLabelNode(expected: RenderNode, actual: RenderNode | undefined): boolean {
  return actual !== undefined && JSON.stringify(expected) === JSON.stringify(actual);
}

function renderNodePointCount(node: RenderNode): number {
  switch (node.kind) {
    case 'rectangle':
    case 'label':
      return 0;
    case 'polygon':
    case 'polyline':
      return node.points.length;
    case 'compoundPath':
      return node.subpaths.reduce((total, subpath) => total + subpath.points.length, 0);
  }
}

function finishPhysicalOverlayExport(
  input: ValidatedExport,
  svg: string,
): AtlasSvgPhysicalOverlayExportResult {
  const result = finishExport(input, svg);
  if (!result.ok) return result;
  return {
    ok: true,
    value: Object.freeze({
      ...result.value,
      profileId: ATLAS_SVG_PHYSICAL_OVERLAY_EXPORT_PROFILE_ID,
      profileVersion: ATLAS_SVG_PHYSICAL_OVERLAY_EXPORT_VERSION,
    } satisfies AtlasSvgPhysicalOverlayExport),
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
    parseStableId('entity', node.sourceId).ok &&
    node.sourceAspectId !== undefined &&
    parseStableId('aspect', node.sourceAspectId).ok &&
    related.every(validStableUuidReference) &&
    new Set(related).size === related.length &&
    related.every((value, index) => index === 0 || (related[index - 1] ?? '') < value)
  );
}

function validRenderNodeId(value: string): boolean {
  return value.length > 0 && RENDER_NODE_ID_PATTERN.test(value);
}

function validStableUuidReference(value: string): boolean {
  // Stable UUID kinds share one grammar; related links can point to entities or coastline rings.
  return parseStableId('entity', value).ok;
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
    typeof scene.sourceWorldMapId === 'string'
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

function nodeLayer(node: RenderNode, requiresPhysicalOverlay: boolean): number {
  if (node.id === 'atlas/background/paper') return 0;
  if (node.id === 'atlas/background/water') return 1;
  if (node.id.startsWith('atlas/land/')) return 2;
  if (requiresPhysicalOverlay && isPhysicalOverlayNodeId(node.id)) return 3;
  if (node.id.startsWith('atlas/paper/')) return requiresPhysicalOverlay ? 4 : 3;
  if (node.id.startsWith('atlas-water/')) return requiresPhysicalOverlay ? 5 : 4;
  if (node.id.startsWith('atlas/coastline/')) return requiresPhysicalOverlay ? 6 : 5;
  return -1;
}

function isPhysicalOverlayNodeId(nodeId: string): boolean {
  return /^atlas\/physical\/(?:[a-z0-9][a-z0-9._-]*)(?:\/[a-z0-9][a-z0-9._-]*)*$/u.test(nodeId);
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
  if (layer === 3 && isPhysicalOverlayNodeId(node.id)) {
    return node.kind === 'compoundPath' || node.kind === 'polyline';
  }
  if (layer >= 3 && layer <= 6) return node.kind === 'polyline';
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

function physicalOverlayProgress(
  stage: AtlasSvgPhysicalOverlayExportProgress['stage'],
  completedNodes: number,
  totalNodes: number,
  isTerminal: boolean,
): AtlasSvgPhysicalOverlayExportProgress {
  return Object.freeze({
    profileId: ATLAS_SVG_PHYSICAL_OVERLAY_EXPORT_PROFILE_ID,
    stage,
    completedNodes,
    totalNodes,
    isTerminal,
  });
}

function labelProgress(
  stage: AtlasSvgLabelExportProgress['stage'],
  completedNodes: number,
  totalNodes: number,
  isTerminal: boolean,
): AtlasSvgLabelExportProgress {
  return Object.freeze({
    profileId: ATLAS_SVG_LABEL_EXPORT_PROFILE_ID,
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

function physicalOverlayCancelled(
  runtime: AtlasSvgPhysicalOverlayExportRuntime,
  totalNodes: number,
  completedNodes: number,
): AtlasSvgPhysicalOverlayExportResult {
  runtime.reportProgress(physicalOverlayProgress('cancelled', completedNodes, totalNodes, true));
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

function labelCancelled(
  runtime: AtlasSvgLabelExportRuntime,
  totalNodes: number,
  completedNodes: number,
): AtlasSvgLabelExportResult {
  runtime.reportProgress(labelProgress('cancelled', completedNodes, totalNodes, true));
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

function labelOutputTooLarge(
  runtime: AtlasSvgLabelExportRuntime,
  totalNodes: number,
  completedNodes: number,
): AtlasSvgLabelExportResult {
  runtime.reportProgress(labelProgress('failed', completedNodes, totalNodes, true));
  return {
    ok: false,
    diagnostics: Object.freeze([
      diagnostic(
        ATLAS_SVG_DIAGNOSTIC_CODES.outputTooLarge,
        `The canonical SVG exceeds the ${String(ATLAS_SVG_MAXIMUM_BYTES)}-byte atlas limit.`,
      ),
    ]),
  };
}
