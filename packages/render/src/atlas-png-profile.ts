/** Public atlas-png-v1 compatibility constants and immutable exporter contracts. */

import type { AtlasStyleTokens, RenderScene } from '@ttrpg-map/core';

import { ATLAS_PNG_ENCODER_IDAT_BYTES } from './atlas-png-encoder.js';
import {
  ATLAS_PNG_BAND_CORE_HEIGHT_PX,
  ATLAS_PNG_BAND_HALO_PX,
  ATLAS_PNG_COORDINATE_QUANTIZATION,
  ATLAS_PNG_MAXIMUM_LIVE_BANDS,
  ATLAS_PNG_MAXIMUM_LIVE_RASTER_BYTES,
  ATLAS_PNG_REQUIRED_BAND_HALO_PX,
  ATLAS_PNG_SUPERSAMPLE_OFFSETS,
  type AtlasPngRasterResources,
} from './atlas-png-rasterizer.js';
import type { AtlasRenderScene } from './atlas-scene.js';

export const ATLAS_PNG_EXPORT_PROFILE_ID = 'atlas-png-v1' as const;
export const ATLAS_PNG_EXPORT_VERSION = 1 as const;
export const ATLAS_PNG_PHYSICAL_OVERLAY_EXPORT_PROFILE_ID = 'atlas-png-v2' as const;
export const ATLAS_PNG_PHYSICAL_OVERLAY_EXPORT_VERSION = 2 as const;
export const ATLAS_PNG_FONT_POLICY = 'no-rendered-text-v1' as const;
export const ATLAS_PNG_SUPPORTED_STYLE_ID = 'atlas-style.restrained-ink' as const;
export const ATLAS_PNG_MAXIMUM_BYTES = 64 * 1_024 * 1_024;
export const ATLAS_PNG_MAXIMUM_COMPRESSED_ASSEMBLY_BYTES = ATLAS_PNG_MAXIMUM_BYTES;
export const ATLAS_PNG_MAXIMUM_CONCURRENT_ENCODED_BYTES = ATLAS_PNG_MAXIMUM_BYTES * 2;
export const ATLAS_PNG_SUPPORTED_DIMENSIONS = Object.freeze([
  Object.freeze({ widthPx: 1_600, heightPx: 800 }),
  Object.freeze({ widthPx: 4_096, heightPx: 2_048 }),
  Object.freeze({ widthPx: 8_192, heightPx: 4_096 }),
] as const);
export const ATLAS_PNG_DEFAULT_DIMENSIONS = ATLAS_PNG_SUPPORTED_DIMENSIONS[2];

export const ATLAS_PNG_COLOR_PROFILE = Object.freeze({
  bitDepth: 8,
  colorType: 2,
  isOpaque: true,
  colorSpace: 'sRGB',
  renderingIntent: 0,
  physicalSizeMetadata: 'none',
});

export const ATLAS_PNG_ENCODING_POLICY = Object.freeze({
  chunkOrder: Object.freeze(['IHDR', 'sRGB', 'IDAT', 'IEND'] as const),
  firstRowFilter: 'sub-1',
  remainingRowFilter: 'up-2',
  zlibHeaderHex: '7801',
  deflate: 'single-final-fixed-huffman-row-local-distance-1-rle-v1',
  idatChunkBytes: ATLAS_PNG_ENCODER_IDAT_BYTES,
});

export const ATLAS_PNG_TILE_POLICY = Object.freeze({
  traversal: 'top-to-bottom-full-width-bands',
  coreHeightPx: ATLAS_PNG_BAND_CORE_HEIGHT_PX,
  haloPx: ATLAS_PNG_BAND_HALO_PX,
  requiredHaloPx: ATLAS_PNG_REQUIRED_BAND_HALO_PX,
  maximumLiveBands: ATLAS_PNG_MAXIMUM_LIVE_BANDS,
  maximumLiveRasterBytes: ATLAS_PNG_MAXIMUM_LIVE_RASTER_BYTES,
  coordinateQuantizationPerOutputPixel: ATLAS_PNG_COORDINATE_QUANTIZATION,
  supersampleOffsets: ATLAS_PNG_SUPERSAMPLE_OFFSETS,
  downsampleRule: 'srgb-channel-sum-plus-2-shift-2',
});

export const ATLAS_PNG_DIAGNOSTIC_CODES = Object.freeze({
  cancelled: 'atlas-png.export.cancelled',
  dimensionsInvalid: 'atlas-png.dimensions.invalid',
  duplicateNodeId: 'atlas-png.node-id.duplicate',
  encodingFailed: 'atlas-png.encoding.failed',
  fontUnsupported: 'atlas-png.font.unsupported',
  nodeInvalid: 'atlas-png.node.invalid',
  outputTooLarge: 'atlas-png.output.too-large',
  resourceLimitExceeded: 'atlas-png.resource-limit.exceeded',
  sceneUnsupported: 'atlas-png.scene.unsupported',
  sourceLinkInvalid: 'atlas-png.source-link.invalid',
  styleUnsupported: 'atlas-png.style.unsupported',
  zOrderInvalid: 'atlas-png.z-order.invalid',
} as const);

export type AtlasPngDiagnosticCode =
  (typeof ATLAS_PNG_DIAGNOSTIC_CODES)[keyof typeof ATLAS_PNG_DIAGNOSTIC_CODES];

export interface AtlasPngDiagnostic {
  readonly code: AtlasPngDiagnosticCode;
  readonly message: string;
  readonly sourceId?: string;
}

export interface AtlasPngDimensions {
  readonly widthPx: number;
  readonly heightPx: number;
}

export interface AtlasPngStyleMetadata {
  readonly styleId: AtlasStyleTokens['styleId'];
  readonly styleBehaviorVersion: number;
  readonly tokenVersion: number;
}

export type AtlasPngSceneInput = RenderScene & Partial<AtlasRenderScene>;

export interface AtlasPngExportRequest {
  readonly scene: AtlasPngSceneInput;
  readonly style: AtlasPngStyleMetadata;
  readonly dimensions?: AtlasPngDimensions;
}

/** Explicit opt-in request for the profile that admits source-linked physical overlays. */
export type AtlasPngPhysicalOverlayExportRequest = AtlasPngExportRequest;

export interface AtlasPngExportResources extends AtlasPngRasterResources {
  readonly outputPixelCount: number;
  readonly maximumRawRgbRowBytes: number;
  readonly maximumFilteredRowBytes: number;
  readonly maximumLiveRowBufferBytes: number;
  readonly maximumCompressedAssemblyBytes: typeof ATLAS_PNG_MAXIMUM_COMPRESSED_ASSEMBLY_BYTES;
  readonly maximumConcurrentEncodedBytes: typeof ATLAS_PNG_MAXIMUM_CONCURRENT_ENCODED_BYTES;
  readonly maximumEncodedBytes: typeof ATLAS_PNG_MAXIMUM_BYTES;
  readonly hasFullSizeRasterSurface: false;
}

export interface AtlasPngExport {
  readonly profileId: typeof ATLAS_PNG_EXPORT_PROFILE_ID;
  readonly profileVersion: typeof ATLAS_PNG_EXPORT_VERSION;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly byteLength: number;
  readonly bytes: Uint8Array;
  readonly resources: AtlasPngExportResources;
}

export interface AtlasPngPhysicalOverlayExport extends Omit<
  AtlasPngExport,
  'profileId' | 'profileVersion'
> {
  readonly profileId: typeof ATLAS_PNG_PHYSICAL_OVERLAY_EXPORT_PROFILE_ID;
  readonly profileVersion: typeof ATLAS_PNG_PHYSICAL_OVERLAY_EXPORT_VERSION;
}

export type AtlasPngExportResult =
  | { readonly ok: true; readonly value: AtlasPngExport }
  | { readonly ok: false; readonly diagnostics: readonly AtlasPngDiagnostic[] };

export type AtlasPngPhysicalOverlayExportResult =
  | { readonly ok: true; readonly value: AtlasPngPhysicalOverlayExport }
  | { readonly ok: false; readonly diagnostics: readonly AtlasPngDiagnostic[] };

export interface AtlasPngExportProgress {
  readonly profileId: typeof ATLAS_PNG_EXPORT_PROFILE_ID;
  readonly stage:
    'validating' | 'preparing' | 'rasterizing' | 'verifying' | 'completed' | 'cancelled' | 'failed';
  readonly completedWork: number;
  readonly totalWork: number;
  readonly isTerminal: boolean;
}

export interface AtlasPngPhysicalOverlayExportProgress extends Omit<
  AtlasPngExportProgress,
  'profileId'
> {
  readonly profileId: typeof ATLAS_PNG_PHYSICAL_OVERLAY_EXPORT_PROFILE_ID;
}

export interface AtlasPngExportRuntime {
  readonly isCancellationRequested: () => boolean;
  readonly reportProgress: (progress: AtlasPngExportProgress) => void;
  readonly yieldControl: () => Promise<void>;
}

export interface AtlasPngPhysicalOverlayExportRuntime {
  readonly isCancellationRequested: () => boolean;
  readonly reportProgress: (progress: AtlasPngPhysicalOverlayExportProgress) => void;
  readonly yieldControl: () => Promise<void>;
}
