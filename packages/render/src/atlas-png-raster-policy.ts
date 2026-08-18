/** Versioned constants and public contracts for deterministic atlas PNG rasterization. */

import type { AtlasRenderScene } from './atlas-scene.js';

export const ATLAS_PNG_COORDINATE_QUANTIZATION = 256 as const;
export const ATLAS_PNG_SUPERSAMPLE_OFFSETS = Object.freeze([
  Object.freeze({ x: 0.25, y: 0.25 }),
  Object.freeze({ x: 0.75, y: 0.25 }),
  Object.freeze({ x: 0.25, y: 0.75 }),
  Object.freeze({ x: 0.75, y: 0.75 }),
] as const);
export const ATLAS_PNG_MAXIMUM_SCENE_STROKE_WIDTH_PX = 2 as const;
export const ATLAS_PNG_BAND_CORE_HEIGHT_PX = 64 as const;
export const ATLAS_PNG_BAND_HALO_PX = 8 as const;
export const ATLAS_PNG_MAXIMUM_OUTPUT_WIDTH_PX = 8_192 as const;
export const ATLAS_PNG_MAXIMUM_OUTPUT_HEIGHT_PX = 4_096 as const;
export const ATLAS_PNG_MAXIMUM_LIVE_BANDS = 1 as const;
export const ATLAS_PNG_MAXIMUM_NODES = 4_096 as const;
export const ATLAS_PNG_MAXIMUM_POINTS = 250_000 as const;
export const ATLAS_PNG_MAXIMUM_FILL_EDGE_SAMPLE_VISITS = 16_777_216 as const;
export const ATLAS_PNG_MAXIMUM_STROKE_SAMPLE_VISITS = 134_217_728 as const;

export const ATLAS_PNG_SAMPLE_PLANE_COUNT = 4 as const;
export const ATLAS_PNG_RGB_CHANNEL_COUNT = 3 as const;
const QUANTIZATION_HALF_STEP_PX = 1 / (ATLAS_PNG_COORDINATE_QUANTIZATION * 2);
const MAXIMUM_OUTPUT_SCALE = ATLAS_PNG_MAXIMUM_OUTPUT_WIDTH_PX / 2_048;
const MAXIMUM_SCALED_STROKE_RADIUS_PX =
  (ATLAS_PNG_MAXIMUM_SCENE_STROKE_WIDTH_PX * MAXIMUM_OUTPUT_SCALE) / 2;
const SUPERSAMPLE_VERTICAL_KERNEL_RADIUS_PX = 0.25;

/** The fixed halo exceeds this exact support proof by three output pixels. */
export const ATLAS_PNG_REQUIRED_BAND_HALO_PX = Math.ceil(
  MAXIMUM_SCALED_STROKE_RADIUS_PX +
    SUPERSAMPLE_VERTICAL_KERNEL_RADIUS_PX +
    QUANTIZATION_HALF_STEP_PX,
);

export interface AtlasPngRasterBandPolicy {
  readonly coreHeightPx: number;
  readonly haloPx: number;
}

export const ATLAS_PNG_PRODUCTION_BAND_POLICY: AtlasPngRasterBandPolicy = Object.freeze({
  coreHeightPx: ATLAS_PNG_BAND_CORE_HEIGHT_PX,
  haloPx: ATLAS_PNG_BAND_HALO_PX,
});

export function atlasPngMaximumLiveRasterBytes(policy: AtlasPngRasterBandPolicy): number {
  return (
    ATLAS_PNG_MAXIMUM_OUTPUT_WIDTH_PX *
    (policy.coreHeightPx + policy.haloPx * 2) *
    ATLAS_PNG_RGB_CHANNEL_COUNT *
    ATLAS_PNG_SAMPLE_PLANE_COUNT
  );
}

export const ATLAS_PNG_MAXIMUM_LIVE_RASTER_BYTES = atlasPngMaximumLiveRasterBytes(
  ATLAS_PNG_PRODUCTION_BAND_POLICY,
);

export interface AtlasPngRasterDimensions {
  readonly widthPx: number;
  readonly heightPx: number;
}

export interface AtlasPngRasterProgressRuntime {
  readonly isCancellationRequested: () => boolean;
  readonly checkpoint: (completedWork: number) => Promise<void>;
}

export interface AtlasPngRasterResources {
  readonly bandCoreHeightPx: number;
  readonly bandHaloPx: number;
  readonly requiredBandHaloPx: typeof ATLAS_PNG_REQUIRED_BAND_HALO_PX;
  readonly samplePlaneCount: typeof ATLAS_PNG_SAMPLE_PLANE_COUNT;
  readonly maximumLiveBands: typeof ATLAS_PNG_MAXIMUM_LIVE_BANDS;
  readonly maximumObservedLiveBands: typeof ATLAS_PNG_MAXIMUM_LIVE_BANDS;
  readonly maximumLiveRasterBytes: number;
  readonly maximumObservedLiveRasterBytes: number;
  readonly totalBands: number;
  readonly fillEdgeSampleVisits: number;
  readonly strokeSampleVisitBudget: number;
}

export interface AtlasPngRasterFailure {
  readonly reason: 'cancelled' | 'resource-limit';
  readonly message: string;
}

export type AtlasPngRasterResult =
  | { readonly ok: true; readonly resources: AtlasPngRasterResources }
  | { readonly ok: false; readonly failure: AtlasPngRasterFailure };

export interface AtlasPngRasterRequest {
  readonly scene: AtlasRenderScene;
  readonly dimensions: AtlasPngRasterDimensions;
  readonly runtime: AtlasPngRasterProgressRuntime;
  readonly initialCompletedWork: number;
  readonly writeRow: (row: Uint8Array) => boolean;
}
