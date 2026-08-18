/** Bounded scene preparation for the deterministic atlas PNG rasterizer. */

import type {
  RenderCompoundPath,
  RenderNode,
  RenderPoint,
  RenderPolyline,
  RenderRectangle,
} from '@ttrpg-map/core';

import {
  atlasPngCancelledFailure,
  atlasPngResourceFailure,
  clampAtlasPng,
  parseAtlasPngColor,
  type PreparationState,
  type PreparedCompoundPath,
  type PreparedNode,
  type PreparedPolyline,
  type PreparedRectangle,
  type PreparedScene,
  quantizeAtlasPngCoordinate,
  scaleAtlasPngPoint,
} from './atlas-png-raster-model.js';
import {
  ATLAS_PNG_MAXIMUM_FILL_EDGE_SAMPLE_VISITS,
  ATLAS_PNG_MAXIMUM_NODES,
  ATLAS_PNG_MAXIMUM_POINTS,
  ATLAS_PNG_MAXIMUM_SCENE_STROKE_WIDTH_PX,
  ATLAS_PNG_MAXIMUM_STROKE_SAMPLE_VISITS,
  ATLAS_PNG_SAMPLE_PLANE_COUNT,
  ATLAS_PNG_SUPERSAMPLE_OFFSETS,
  type AtlasPngRasterBandPolicy,
  type AtlasPngRasterProgressRuntime,
  type AtlasPngRasterRequest,
  type AtlasPngRasterResult,
} from './atlas-png-raster-policy.js';

const INNER_CHECKPOINT_INTERVAL = 4_096;

type PreparedSceneResult =
  | { readonly ok: true; readonly value: PreparedScene }
  | Extract<AtlasPngRasterResult, { readonly ok: false }>;

export async function prepareAtlasPngScene(
  request: AtlasPngRasterRequest,
  policy: AtlasPngRasterBandPolicy,
  state: PreparationState,
): Promise<PreparedSceneResult> {
  const capFailure = validateStructuralCaps(request.scene.nodes);
  if (capFailure !== undefined) return capFailure;
  const { heightPx, widthPx } = request.dimensions;
  const scale = widthPx / request.scene.widthPx;
  const prepared: PreparedNode[] = [];
  for (const node of request.scene.nodes) {
    if (request.runtime.isCancellationRequested()) return atlasPngCancelledFailure();
    const result = await prepareNode(
      node,
      scale,
      widthPx,
      heightPx,
      policy,
      request.runtime,
      state,
    );
    if (!result.ok) return result;
    prepared.push(result.value);
    state.completedWork += 1;
    await request.runtime.checkpoint(state.completedWork);
  }
  const paper = prepared[0];
  const water = prepared[1];
  if (
    paper?.kind !== 'rectangle' ||
    water?.kind !== 'rectangle' ||
    water.leftPx !== 0 ||
    water.topPx !== 0 ||
    water.rightPx !== widthPx ||
    water.bottomPx !== heightPx
  ) {
    return atlasPngResourceFailure(
      'The validated atlas scene has no canonical full-output paper and water backgrounds.',
    );
  }
  return {
    ok: true,
    value: Object.freeze({
      nodes: Object.freeze(prepared),
      waterColor: water.color,
      fillEdgeSampleVisits: state.fillEdgeSampleVisits,
      strokeSampleVisitBudget: state.strokeSampleVisitBudget,
    }),
  };
}

async function prepareNode(
  node: RenderNode,
  scale: number,
  widthPx: number,
  heightPx: number,
  policy: AtlasPngRasterBandPolicy,
  runtime: AtlasPngRasterProgressRuntime,
  state: PreparationState,
): Promise<
  | { readonly ok: true; readonly value: PreparedNode }
  | Extract<AtlasPngRasterResult, { readonly ok: false }>
> {
  switch (node.kind) {
    case 'rectangle':
      return prepareRectangle(node, scale);
    case 'compoundPath':
      return prepareCompoundPath(node, scale, heightPx, runtime, state);
    case 'polyline':
      return preparePolyline(node, scale, widthPx, heightPx, policy, runtime, state);
    case 'polygon':
    case 'label':
      return atlasPngResourceFailure('The validated atlas PNG scene contains an unsupported node.');
  }
}

function prepareRectangle(
  node: RenderRectangle,
  scale: number,
):
  | { readonly ok: true; readonly value: PreparedRectangle }
  | ReturnType<typeof atlasPngResourceFailure> {
  const color = parseAtlasPngColor(node.fillColor);
  if (color === undefined || !validRectangle(node)) {
    return atlasPngResourceFailure('The atlas PNG scene contains an invalid rectangle.');
  }
  return {
    ok: true,
    value: Object.freeze({
      kind: 'rectangle',
      color,
      leftPx: quantizeAtlasPngCoordinate(node.xPx * scale),
      topPx: quantizeAtlasPngCoordinate(node.yPx * scale),
      rightPx: quantizeAtlasPngCoordinate((node.xPx + node.widthPx) * scale),
      bottomPx: quantizeAtlasPngCoordinate((node.yPx + node.heightPx) * scale),
    }),
  };
}

async function prepareCompoundPath(
  node: RenderCompoundPath,
  scale: number,
  heightPx: number,
  runtime: AtlasPngRasterProgressRuntime,
  state: PreparationState,
): Promise<
  | { readonly ok: true; readonly value: PreparedCompoundPath }
  | Extract<AtlasPngRasterResult, { readonly ok: false }>
> {
  const color = parseAtlasPngColor(node.fillColor);
  if (color === undefined) {
    return atlasPngResourceFailure('The atlas PNG scene contains an invalid compound-path color.');
  }
  const mutableRows = [
    new Array<number[] | undefined>(heightPx),
    new Array<number[] | undefined>(heightPx),
  ] as [(number[] | undefined)[], (number[] | undefined)[]];
  let workSinceCheckpoint = 0;

  for (const subpath of node.subpaths) {
    for (let index = 0; index < subpath.points.length; index += 1) {
      const sourceStart = subpath.points[index];
      const sourceEnd = subpath.points[(index + 1) % subpath.points.length];
      if (
        sourceStart === undefined ||
        sourceEnd === undefined ||
        !validPoint(sourceStart, sourceEnd)
      ) {
        return atlasPngResourceFailure(
          'The atlas PNG scene contains invalid compound-path geometry.',
        );
      }
      const start = scaleAtlasPngPoint(sourceStart, scale);
      const end = scaleAtlasPngPoint(sourceEnd, scale);
      workSinceCheckpoint += 1;
      if (workSinceCheckpoint >= INNER_CHECKPOINT_INTERVAL) {
        await runtime.checkpoint(state.completedWork);
        if (runtime.isCancellationRequested()) return atlasPngCancelledFailure();
        workSinceCheckpoint = 0;
      }
      if (start.yPx === end.yPx) continue;
      const minimumY = Math.min(start.yPx, end.yPx);
      const maximumY = Math.max(start.yPx, end.yPx);
      for (let verticalSample = 0; verticalSample < 2; verticalSample += 1) {
        const sampleRows = mutableRows[verticalSample];
        const sampleOffsetY = ATLAS_PNG_SUPERSAMPLE_OFFSETS[verticalSample * 2]?.y ?? 0.25;
        if (sampleRows === undefined) continue;
        const firstRow = clampAtlasPng(Math.ceil(minimumY - sampleOffsetY), 0, heightPx);
        const lastRowExclusive = clampAtlasPng(Math.ceil(maximumY - sampleOffsetY), 0, heightPx);
        for (let row = firstRow; row < lastRowExclusive; row += 1) {
          const sampleY = row + sampleOffsetY;
          const intersection =
            start.xPx + ((sampleY - start.yPx) * (end.xPx - start.xPx)) / (end.yPx - start.yPx);
          const values = sampleRows[row] ?? [];
          values.push(intersection);
          sampleRows[row] = values;
          state.fillEdgeSampleVisits += 1;
          workSinceCheckpoint += 1;
          if (state.fillEdgeSampleVisits > ATLAS_PNG_MAXIMUM_FILL_EDGE_SAMPLE_VISITS) {
            return atlasPngResourceFailure(
              'The scene exceeds the atlas-png-v1 bounded fill edge/sample-row budget.',
            );
          }
          if (workSinceCheckpoint >= INNER_CHECKPOINT_INTERVAL) {
            await runtime.checkpoint(state.completedWork);
            if (runtime.isCancellationRequested()) return atlasPngCancelledFailure();
            workSinceCheckpoint = 0;
          }
        }
      }
    }
  }
  const frozenRows = await freezeIntersectionRows(
    mutableRows,
    heightPx,
    runtime,
    state.completedWork,
  );
  if (!frozenRows.ok) return frozenRows;
  return {
    ok: true,
    value: Object.freeze({
      kind: 'compoundPath',
      color,
      intersectionsByVerticalSample: frozenRows.value,
    }),
  };
}

async function preparePolyline(
  node: RenderPolyline,
  scale: number,
  widthPx: number,
  heightPx: number,
  policy: AtlasPngRasterBandPolicy,
  runtime: AtlasPngRasterProgressRuntime,
  state: PreparationState,
): Promise<
  | { readonly ok: true; readonly value: PreparedPolyline }
  | Extract<AtlasPngRasterResult, { readonly ok: false }>
> {
  const color = parseAtlasPngColor(node.strokeColor);
  if (
    color === undefined ||
    !Number.isFinite(node.strokeWidthPx) ||
    node.strokeWidthPx <= 0 ||
    node.strokeWidthPx > ATLAS_PNG_MAXIMUM_SCENE_STROKE_WIDTH_PX
  ) {
    return atlasPngResourceFailure('The atlas PNG scene contains invalid polyline paint.');
  }
  const points: RenderPoint[] = [];
  for (let index = 0; index < node.points.length; index += 1) {
    const source = node.points[index];
    if (source === undefined || !validPoint(source)) {
      return atlasPngResourceFailure('The atlas PNG scene contains invalid polyline geometry.');
    }
    points.push(scaleAtlasPngPoint(source, scale));
    if ((index + 1) % INNER_CHECKPOINT_INTERVAL === 0) {
      await runtime.checkpoint(state.completedWork);
      if (runtime.isCancellationRequested()) return atlasPngCancelledFailure();
    }
  }
  const radiusPx = quantizeAtlasPngCoordinate(node.strokeWidthPx * scale) / 2;
  const maximumBandOverlap = Math.min(
    Math.ceil(heightPx / policy.coreHeightPx),
    1 + Math.ceil((policy.haloPx * 2) / policy.coreHeightPx),
  );
  let estimatedSampleVisits = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    if (start === undefined || end === undefined) continue;
    const width = clippedSpan(start.xPx, end.xPx, radiusPx, widthPx);
    const height = clippedSpan(start.yPx, end.yPx, radiusPx, heightPx);
    estimatedSampleVisits += width * height * ATLAS_PNG_SAMPLE_PLANE_COUNT * maximumBandOverlap;
    state.strokeSampleVisitBudget +=
      width * height * ATLAS_PNG_SAMPLE_PLANE_COUNT * maximumBandOverlap;
    if (state.strokeSampleVisitBudget > ATLAS_PNG_MAXIMUM_STROKE_SAMPLE_VISITS) {
      return atlasPngResourceFailure(
        'The scene exceeds the atlas-png-v1 bounded stroke sample-visit budget.',
      );
    }
  }
  return {
    ok: true,
    value: Object.freeze({
      kind: 'polyline',
      color,
      points: Object.freeze(points),
      radiusPx,
      estimatedSampleVisits,
    }),
  };
}

function validateStructuralCaps(
  nodes: readonly RenderNode[],
): ReturnType<typeof atlasPngResourceFailure> | undefined {
  if (nodes.length > ATLAS_PNG_MAXIMUM_NODES) {
    return atlasPngResourceFailure('The scene exceeds the atlas-png-v1 bounded node budget.');
  }
  let pointCount = 0;
  let subpathCount = 0;
  for (const node of nodes) {
    if (node.kind === 'polygon' || node.kind === 'polyline') pointCount += node.points.length;
    if (node.kind === 'compoundPath') {
      subpathCount += node.subpaths.length;
      for (const subpath of node.subpaths) pointCount += subpath.points.length;
    }
    if (pointCount > ATLAS_PNG_MAXIMUM_POINTS || subpathCount > ATLAS_PNG_MAXIMUM_POINTS) {
      return atlasPngResourceFailure('The scene exceeds the atlas-png-v1 bounded point budget.');
    }
  }
  return undefined;
}

async function freezeIntersectionRows(
  mutableRows: readonly [(number[] | undefined)[], (number[] | undefined)[]],
  heightPx: number,
  runtime: AtlasPngRasterProgressRuntime,
  completedWork: number,
): Promise<
  | {
      readonly ok: true;
      readonly value: PreparedCompoundPath['intersectionsByVerticalSample'];
    }
  | Extract<AtlasPngRasterResult, { readonly ok: false }>
> {
  const rows = [
    new Array<readonly number[] | undefined>(heightPx),
    new Array<readonly number[] | undefined>(heightPx),
  ] as [(readonly number[] | undefined)[], (readonly number[] | undefined)[]];
  for (let sample = 0; sample < mutableRows.length; sample += 1) {
    const sourceRows = mutableRows[sample];
    const destinationRows = rows[sample];
    if (sourceRows === undefined || destinationRows === undefined) continue;
    for (let row = 0; row < sourceRows.length; row += 1) {
      const values = sourceRows[row];
      if (values !== undefined) destinationRows[row] = Object.freeze(values.sort(compareNumbers));
      if ((row + 1) % INNER_CHECKPOINT_INTERVAL === 0) {
        await runtime.checkpoint(completedWork);
        if (runtime.isCancellationRequested()) return atlasPngCancelledFailure();
      }
    }
  }
  return { ok: true, value: Object.freeze([Object.freeze(rows[0]), Object.freeze(rows[1])]) };
}

function clippedSpan(first: number, second: number, radiusPx: number, limit: number): number {
  const minimum = clampAtlasPng(Math.floor(Math.min(first, second) - radiusPx - 1), 0, limit);
  const maximum = clampAtlasPng(Math.ceil(Math.max(first, second) + radiusPx + 1), 0, limit);
  return maximum - minimum;
}

function validRectangle(node: RenderRectangle): boolean {
  return (
    [node.xPx, node.yPx, node.widthPx, node.heightPx].every(Number.isFinite) &&
    node.widthPx >= 0 &&
    node.heightPx >= 0
  );
}

function validPoint(...points: readonly RenderPoint[]): boolean {
  return points.every(({ xPx, yPx }) => Number.isFinite(xPx) && Number.isFinite(yPx));
}

function compareNumbers(left: number, right: number): number {
  return left - right;
}
