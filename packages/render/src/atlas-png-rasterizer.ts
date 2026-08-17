/** Deterministic bounded-band software rasterization for the atlas PNG export profile. */

import {
  createAtlasPngBandSurface,
  downsampleAtlasPngRow,
  initializeAtlasPngBand,
  renderAtlasPngPreparedNode,
} from './atlas-png-raster-draw.js';
import {
  atlasPngCancelledFailure,
  atlasPngResourceFailure,
  distanceSquaredToAtlasPngSegment,
  type PreparationState,
  quantizeAtlasPngCoordinate,
} from './atlas-png-raster-model.js';
import {
  ATLAS_PNG_MAXIMUM_LIVE_BANDS,
  ATLAS_PNG_MAXIMUM_OUTPUT_HEIGHT_PX,
  ATLAS_PNG_MAXIMUM_OUTPUT_WIDTH_PX,
  ATLAS_PNG_PRODUCTION_BAND_POLICY,
  ATLAS_PNG_REQUIRED_BAND_HALO_PX,
  ATLAS_PNG_RGB_CHANNEL_COUNT,
  ATLAS_PNG_SAMPLE_PLANE_COUNT,
  atlasPngMaximumLiveRasterBytes,
  type AtlasPngRasterBandPolicy,
  type AtlasPngRasterRequest,
  type AtlasPngRasterResult,
} from './atlas-png-raster-policy.js';
import { prepareAtlasPngScene } from './atlas-png-raster-prepare.js';

export type {
  AtlasPngRasterBandPolicy,
  AtlasPngRasterDimensions,
  AtlasPngRasterFailure,
  AtlasPngRasterProgressRuntime,
  AtlasPngRasterRequest,
  AtlasPngRasterResources,
  AtlasPngRasterResult,
} from './atlas-png-raster-policy.js';
export {
  ATLAS_PNG_BAND_CORE_HEIGHT_PX,
  ATLAS_PNG_BAND_HALO_PX,
  ATLAS_PNG_COORDINATE_QUANTIZATION,
  ATLAS_PNG_MAXIMUM_FILL_EDGE_SAMPLE_VISITS,
  ATLAS_PNG_MAXIMUM_LIVE_BANDS,
  ATLAS_PNG_MAXIMUM_LIVE_RASTER_BYTES,
  ATLAS_PNG_MAXIMUM_NODES,
  ATLAS_PNG_MAXIMUM_OUTPUT_HEIGHT_PX,
  ATLAS_PNG_MAXIMUM_OUTPUT_WIDTH_PX,
  ATLAS_PNG_MAXIMUM_POINTS,
  ATLAS_PNG_MAXIMUM_SCENE_STROKE_WIDTH_PX,
  ATLAS_PNG_MAXIMUM_STROKE_SAMPLE_VISITS,
  ATLAS_PNG_REQUIRED_BAND_HALO_PX,
  ATLAS_PNG_SUPERSAMPLE_OFFSETS,
  atlasPngMaximumLiveRasterBytes,
} from './atlas-png-raster-policy.js';

const TEST_MAXIMUM_REFERENCE_PIXELS = 262_144;

export function atlasPngRasterTotalWork(sceneNodeCount: number, heightPx: number): number {
  const bandCount = Math.ceil(heightPx / ATLAS_PNG_PRODUCTION_BAND_POLICY.coreHeightPx);
  const paintedNodesPerBand = Math.max(0, sceneNodeCount - 2);
  return sceneNodeCount + bandCount * (paintedNodesPerBand + 1) + heightPx;
}

/**
 * Rasterize absolute scene geometry using the immutable 64-core-row/8-halo-row v1 policy. Only
 * downsampled RGB rows cross into the encoder, and no complete output surface is allocated.
 */
export function rasterizeAtlasPngRows(
  request: AtlasPngRasterRequest,
): Promise<AtlasPngRasterResult> {
  return rasterizeWithPolicy(request, ATLAS_PNG_PRODUCTION_BAND_POLICY);
}

async function rasterizeWithPolicy(
  request: AtlasPngRasterRequest,
  policy: AtlasPngRasterBandPolicy,
): Promise<AtlasPngRasterResult> {
  const requestFailure = validateRasterRequest(request, policy);
  if (requestFailure !== undefined) return requestFailure;
  const state: PreparationState = {
    completedWork: request.initialCompletedWork,
    fillEdgeSampleVisits: 0,
    strokeSampleVisitBudget: 0,
  };
  const prepared = await prepareAtlasPngScene(request, policy, state);
  if (!prepared.ok) return prepared;
  const { heightPx, widthPx } = request.dimensions;
  const currentRow = new Uint8Array(widthPx * ATLAS_PNG_RGB_CHANNEL_COUNT);
  const totalBands = Math.ceil(heightPx / policy.coreHeightPx);
  const maximumLiveRasterBytes = atlasPngMaximumLiveRasterBytes(policy);
  let maximumObservedLiveRasterBytes = 0;

  for (let coreStartY = 0; coreStartY < heightPx; coreStartY += policy.coreHeightPx) {
    if (request.runtime.isCancellationRequested()) return atlasPngCancelledFailure();
    const coreHeight = Math.min(policy.coreHeightPx, heightPx - coreStartY);
    const band = createAtlasPngBandSurface(widthPx, heightPx, coreStartY, coreHeight, policy);
    maximumObservedLiveRasterBytes = Math.max(
      maximumObservedLiveRasterBytes,
      band.bytes.byteLength,
    );
    if (band.bytes.byteLength > maximumLiveRasterBytes) {
      return atlasPngResourceFailure('The live supersample band exceeds its bounded byte budget.');
    }
    initializeAtlasPngBand(band, widthPx, prepared.value.waterColor);
    state.completedWork += 1;
    await request.runtime.checkpoint(state.completedWork);
    if (request.runtime.isCancellationRequested()) return atlasPngCancelledFailure();

    for (let nodeIndex = 2; nodeIndex < prepared.value.nodes.length; nodeIndex += 1) {
      const node = prepared.value.nodes[nodeIndex];
      if (node === undefined) continue;
      const rendered = await renderAtlasPngPreparedNode(
        band,
        widthPx,
        node,
        request.runtime,
        state.completedWork,
      );
      if (!rendered.ok) return rendered;
      state.completedWork += 1;
      await request.runtime.checkpoint(state.completedWork);
      if (request.runtime.isCancellationRequested()) return atlasPngCancelledFailure();
    }

    const localCoreStartY = coreStartY - band.expandedStartY;
    for (let localY = localCoreStartY; localY < localCoreStartY + coreHeight; localY += 1) {
      downsampleAtlasPngRow(band, widthPx, localY, currentRow);
      if (!request.writeRow(currentRow)) {
        return atlasPngResourceFailure('The bounded PNG row encoder rejected raster output.');
      }
      state.completedWork += 1;
      const completedCoreRows = localY - localCoreStartY + 1;
      if (completedCoreRows % 8 === 0 || completedCoreRows === coreHeight) {
        await request.runtime.checkpoint(state.completedWork);
        if (request.runtime.isCancellationRequested()) return atlasPngCancelledFailure();
      }
    }
  }

  return {
    ok: true,
    resources: Object.freeze({
      bandCoreHeightPx: policy.coreHeightPx,
      bandHaloPx: policy.haloPx,
      requiredBandHaloPx: ATLAS_PNG_REQUIRED_BAND_HALO_PX,
      samplePlaneCount: ATLAS_PNG_SAMPLE_PLANE_COUNT,
      maximumLiveBands: ATLAS_PNG_MAXIMUM_LIVE_BANDS,
      maximumObservedLiveBands: ATLAS_PNG_MAXIMUM_LIVE_BANDS,
      maximumLiveRasterBytes,
      maximumObservedLiveRasterBytes,
      totalBands,
      fillEdgeSampleVisits: prepared.value.fillEdgeSampleVisits,
      strokeSampleVisitBudget: prepared.value.strokeSampleVisitBudget,
    }),
  };
}

function validateRasterRequest(
  request: AtlasPngRasterRequest,
  policy: AtlasPngRasterBandPolicy,
): Extract<AtlasPngRasterResult, { readonly ok: false }> | undefined {
  const { heightPx, widthPx } = request.dimensions;
  if (
    !Number.isSafeInteger(widthPx) ||
    widthPx < 1 ||
    widthPx > ATLAS_PNG_MAXIMUM_OUTPUT_WIDTH_PX ||
    !Number.isSafeInteger(heightPx) ||
    heightPx < 1 ||
    heightPx > ATLAS_PNG_MAXIMUM_OUTPUT_HEIGHT_PX ||
    !Number.isSafeInteger(request.scene.widthPx) ||
    request.scene.widthPx <= 0 ||
    !Number.isSafeInteger(request.scene.heightPx) ||
    request.scene.heightPx <= 0 ||
    widthPx * request.scene.heightPx !== heightPx * request.scene.widthPx
  ) {
    return atlasPngResourceFailure(
      'Atlas PNG raster dimensions must be positive bounded integers at the scene aspect ratio.',
    );
  }
  if (
    !Number.isSafeInteger(policy.coreHeightPx) ||
    policy.coreHeightPx < 1 ||
    policy.coreHeightPx > ATLAS_PNG_MAXIMUM_OUTPUT_HEIGHT_PX ||
    !Number.isSafeInteger(policy.haloPx) ||
    policy.haloPx > ATLAS_PNG_MAXIMUM_OUTPUT_HEIGHT_PX ||
    policy.haloPx < ATLAS_PNG_REQUIRED_BAND_HALO_PX
  ) {
    return atlasPngResourceFailure(
      'The raster band policy cannot represent the versioned stroke and sample support.',
    );
  }
  return undefined;
}

/** Narrow test seam; alternate policies are limited to small outputs and never reach production. */
export const atlasPngRasterTestSupport = Object.freeze({
  quantize: quantizeAtlasPngCoordinate,
  distanceSquaredToSegment: distanceSquaredToAtlasPngSegment,
  rasterizeWithBandPolicy(
    request: AtlasPngRasterRequest,
    policy: AtlasPngRasterBandPolicy,
  ): Promise<AtlasPngRasterResult> {
    if (request.dimensions.widthPx * request.dimensions.heightPx > TEST_MAXIMUM_REFERENCE_PIXELS) {
      return Promise.resolve(
        atlasPngResourceFailure('Alternate raster-band policies are limited to small test proofs.'),
      );
    }
    return rasterizeWithPolicy(request, Object.freeze({ ...policy }));
  },
});
