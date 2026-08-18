/** One-band-at-a-time sample painting and row downsampling for atlas-png-v1. */

import {
  atlasPngCancelledFailure,
  type BandSurface,
  clampAtlasPng,
  distanceSquaredToAtlasPngSegment,
  type PreparedCompoundPath,
  type PreparedNode,
  type PreparedPolyline,
  type PreparedRectangle,
  type RgbColor,
} from './atlas-png-raster-model.js';
import {
  ATLAS_PNG_RGB_CHANNEL_COUNT,
  ATLAS_PNG_SAMPLE_PLANE_COUNT,
  ATLAS_PNG_SUPERSAMPLE_OFFSETS,
  type AtlasPngRasterBandPolicy,
  type AtlasPngRasterProgressRuntime,
  type AtlasPngRasterResult,
} from './atlas-png-raster-policy.js';

const INNER_CHECKPOINT_INTERVAL = 4_096;
const DRAWN: DrawResult = Object.freeze({ ok: true });

type DrawResult = { readonly ok: true } | Extract<AtlasPngRasterResult, { readonly ok: false }>;

export function createAtlasPngBandSurface(
  widthPx: number,
  outputHeightPx: number,
  coreStartY: number,
  coreHeight: number,
  policy: AtlasPngRasterBandPolicy,
): BandSurface {
  const expandedStartY = Math.max(0, coreStartY - policy.haloPx);
  const expandedEndY = Math.min(outputHeightPx, coreStartY + coreHeight + policy.haloPx);
  const expandedHeight = expandedEndY - expandedStartY;
  const planeStride = widthPx * expandedHeight * ATLAS_PNG_RGB_CHANNEL_COUNT;
  return Object.freeze({
    bytes: new Uint8Array(planeStride * ATLAS_PNG_SAMPLE_PLANE_COUNT),
    expandedStartY,
    expandedHeight,
    planeStride,
  });
}

export function initializeAtlasPngBand(band: BandSurface, widthPx: number, color: RgbColor): void {
  for (let sample = 0; sample < ATLAS_PNG_SAMPLE_PLANE_COUNT; sample += 1) {
    const planeStart = sample * band.planeStride;
    const planeEnd = planeStart + band.planeStride;
    for (let offset = planeStart; offset < planeEnd; offset += ATLAS_PNG_RGB_CHANNEL_COUNT) {
      band.bytes[offset] = color.red;
      band.bytes[offset + 1] = color.green;
      band.bytes[offset + 2] = color.blue;
    }
  }
  const expectedBytes =
    widthPx * band.expandedHeight * ATLAS_PNG_RGB_CHANNEL_COUNT * ATLAS_PNG_SAMPLE_PLANE_COUNT;
  if (band.bytes.byteLength !== expectedBytes) {
    throw new Error('Atlas PNG band allocation invariant failed.');
  }
}

export async function renderAtlasPngPreparedNode(
  band: BandSurface,
  widthPx: number,
  node: PreparedNode,
  runtime: AtlasPngRasterProgressRuntime,
  completedWork: number,
): Promise<DrawResult> {
  switch (node.kind) {
    case 'rectangle':
      return renderRectangle(band, widthPx, node, runtime, completedWork);
    case 'compoundPath':
      return renderCompoundPath(band, widthPx, node, runtime, completedWork);
    case 'polyline':
      return renderPolyline(band, widthPx, node, runtime, completedWork);
  }
}

export function downsampleAtlasPngRow(
  band: BandSurface,
  widthPx: number,
  localY: number,
  output: Uint8Array,
): void {
  for (let x = 0; x < widthPx; x += 1) {
    const outputOffset = x * ATLAS_PNG_RGB_CHANNEL_COUNT;
    for (let channel = 0; channel < ATLAS_PNG_RGB_CHANNEL_COUNT; channel += 1) {
      let sum = 0;
      for (let sample = 0; sample < ATLAS_PNG_SAMPLE_PLANE_COUNT; sample += 1) {
        sum +=
          band.bytes[
            sample * band.planeStride +
              (localY * widthPx + x) * ATLAS_PNG_RGB_CHANNEL_COUNT +
              channel
          ] ?? 0;
      }
      output[outputOffset + channel] = (sum + 2) >> 2;
    }
  }
}

async function renderRectangle(
  band: BandSurface,
  widthPx: number,
  node: PreparedRectangle,
  runtime: AtlasPngRasterProgressRuntime,
  completedWork: number,
): Promise<DrawResult> {
  let visitsSinceCheckpoint = 0;
  for (let sample = 0; sample < ATLAS_PNG_SAMPLE_PLANE_COUNT; sample += 1) {
    const offset = ATLAS_PNG_SUPERSAMPLE_OFFSETS[sample];
    if (offset === undefined) continue;
    const firstX = clampAtlasPng(Math.ceil(node.leftPx - offset.x), 0, widthPx);
    const lastXExclusive = clampAtlasPng(Math.ceil(node.rightPx - offset.x), 0, widthPx);
    const firstGlobalY = Math.max(band.expandedStartY, Math.ceil(node.topPx - offset.y));
    const lastGlobalYExclusive = Math.min(
      band.expandedStartY + band.expandedHeight,
      Math.ceil(node.bottomPx - offset.y),
    );
    for (let globalY = firstGlobalY; globalY < lastGlobalYExclusive; globalY += 1) {
      const localY = globalY - band.expandedStartY;
      for (let x = firstX; x < lastXExclusive; x += 1) {
        setSamplePixel(band, widthPx, sample, x, localY, node.color);
        visitsSinceCheckpoint += 1;
        if (visitsSinceCheckpoint >= INNER_CHECKPOINT_INTERVAL) {
          await runtime.checkpoint(completedWork);
          if (runtime.isCancellationRequested()) return atlasPngCancelledFailure();
          visitsSinceCheckpoint = 0;
        }
      }
    }
  }
  return DRAWN;
}

async function renderCompoundPath(
  band: BandSurface,
  widthPx: number,
  node: PreparedCompoundPath,
  runtime: AtlasPngRasterProgressRuntime,
  completedWork: number,
): Promise<DrawResult> {
  let visitsSinceCheckpoint = 0;
  for (let sample = 0; sample < ATLAS_PNG_SAMPLE_PLANE_COUNT; sample += 1) {
    const sampleOffset = ATLAS_PNG_SUPERSAMPLE_OFFSETS[sample];
    if (sampleOffset === undefined) continue;
    const rows = node.intersectionsByVerticalSample[sampleOffset.y === 0.25 ? 0 : 1];
    for (let localY = 0; localY < band.expandedHeight; localY += 1) {
      const intersections = rows[band.expandedStartY + localY];
      if (intersections === undefined) continue;
      for (let index = 0; index + 1 < intersections.length; index += 2) {
        const left = intersections[index];
        const right = intersections[index + 1];
        if (left === undefined || right === undefined) continue;
        const firstX = clampAtlasPng(Math.ceil(left - sampleOffset.x), 0, widthPx);
        const lastXExclusive = clampAtlasPng(Math.ceil(right - sampleOffset.x), 0, widthPx);
        for (let x = firstX; x < lastXExclusive; x += 1) {
          setSamplePixel(band, widthPx, sample, x, localY, node.color);
          visitsSinceCheckpoint += 1;
          if (visitsSinceCheckpoint >= INNER_CHECKPOINT_INTERVAL) {
            await runtime.checkpoint(completedWork);
            if (runtime.isCancellationRequested()) return atlasPngCancelledFailure();
            visitsSinceCheckpoint = 0;
          }
        }
      }
    }
  }
  return DRAWN;
}

async function renderPolyline(
  band: BandSurface,
  widthPx: number,
  node: PreparedPolyline,
  runtime: AtlasPngRasterProgressRuntime,
  completedWork: number,
): Promise<DrawResult> {
  const radiusSquared = node.radiusPx * node.radiusPx;
  let visitsSinceCheckpoint = 0;
  for (let index = 0; index < node.points.length - 1; index += 1) {
    const start = node.points[index];
    const end = node.points[index + 1];
    if (start === undefined || end === undefined) continue;
    const minimumGlobalY = Math.max(
      band.expandedStartY,
      Math.floor(Math.min(start.yPx, end.yPx) - node.radiusPx - 1),
    );
    const maximumGlobalY = Math.min(
      band.expandedStartY + band.expandedHeight,
      Math.ceil(Math.max(start.yPx, end.yPx) + node.radiusPx + 1),
    );
    const minimumX = clampAtlasPng(
      Math.floor(Math.min(start.xPx, end.xPx) - node.radiusPx - 1),
      0,
      widthPx,
    );
    const maximumX = clampAtlasPng(
      Math.ceil(Math.max(start.xPx, end.xPx) + node.radiusPx + 1),
      0,
      widthPx,
    );
    for (let globalY = minimumGlobalY; globalY < maximumGlobalY; globalY += 1) {
      const localY = globalY - band.expandedStartY;
      for (let x = minimumX; x < maximumX; x += 1) {
        for (let sample = 0; sample < ATLAS_PNG_SAMPLE_PLANE_COUNT; sample += 1) {
          const offset = ATLAS_PNG_SUPERSAMPLE_OFFSETS[sample];
          if (
            offset !== undefined &&
            distanceSquaredToAtlasPngSegment(x + offset.x, globalY + offset.y, start, end) <=
              radiusSquared
          ) {
            setSamplePixel(band, widthPx, sample, x, localY, node.color);
          }
          visitsSinceCheckpoint += 1;
          if (visitsSinceCheckpoint >= INNER_CHECKPOINT_INTERVAL) {
            await runtime.checkpoint(completedWork);
            if (runtime.isCancellationRequested()) return atlasPngCancelledFailure();
            visitsSinceCheckpoint = 0;
          }
        }
      }
    }
  }
  return DRAWN;
}

function setSamplePixel(
  band: BandSurface,
  widthPx: number,
  sample: number,
  x: number,
  localY: number,
  color: RgbColor,
): void {
  const offset = sample * band.planeStride + (localY * widthPx + x) * ATLAS_PNG_RGB_CHANNEL_COUNT;
  band.bytes[offset] = color.red;
  band.bytes[offset + 1] = color.green;
  band.bytes[offset + 2] = color.blue;
}
