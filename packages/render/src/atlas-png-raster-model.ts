/** Internal prepared-scene and geometry model for atlas-png-v1 rasterization. */

import type { RenderPoint } from '@ttrpg-map/core';

import type { AtlasPngRasterResult } from './atlas-png-raster-policy.js';
import { ATLAS_PNG_COORDINATE_QUANTIZATION } from './atlas-png-raster-policy.js';

export interface RgbColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

export interface PreparedRectangle {
  readonly kind: 'rectangle';
  readonly color: RgbColor;
  readonly leftPx: number;
  readonly topPx: number;
  readonly rightPx: number;
  readonly bottomPx: number;
}

export interface PreparedCompoundPath {
  readonly kind: 'compoundPath';
  readonly color: RgbColor;
  readonly intersectionsByVerticalSample: readonly [
    readonly (readonly number[] | undefined)[],
    readonly (readonly number[] | undefined)[],
  ];
}

export interface PreparedPolyline {
  readonly kind: 'polyline';
  readonly color: RgbColor;
  readonly points: readonly RenderPoint[];
  readonly radiusPx: number;
  readonly estimatedSampleVisits: number;
}

export type PreparedNode = PreparedRectangle | PreparedCompoundPath | PreparedPolyline;

export interface PreparedScene {
  readonly nodes: readonly PreparedNode[];
  readonly waterColor: RgbColor;
  readonly fillEdgeSampleVisits: number;
  readonly strokeSampleVisitBudget: number;
}

export interface PreparationState {
  completedWork: number;
  fillEdgeSampleVisits: number;
  strokeSampleVisitBudget: number;
}

export interface BandSurface {
  readonly bytes: Uint8Array;
  readonly expandedStartY: number;
  readonly expandedHeight: number;
  readonly planeStride: number;
}

const COLOR_PATTERN = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/u;

export function quantizeAtlasPngCoordinate(value: number): number {
  return Math.round(value * ATLAS_PNG_COORDINATE_QUANTIZATION) / ATLAS_PNG_COORDINATE_QUANTIZATION;
}

export function scaleAtlasPngPoint(point: RenderPoint, scale: number): RenderPoint {
  return Object.freeze({
    xPx: quantizeAtlasPngCoordinate(point.xPx * scale),
    yPx: quantizeAtlasPngCoordinate(point.yPx * scale),
  });
}

export function parseAtlasPngColor(value: string): RgbColor | undefined {
  const match = COLOR_PATTERN.exec(value);
  if (match === null) return undefined;
  return Object.freeze({
    red: Number.parseInt(match[1] ?? '0', 16),
    green: Number.parseInt(match[2] ?? '0', 16),
    blue: Number.parseInt(match[3] ?? '0', 16),
  });
}

export function distanceSquaredToAtlasPngSegment(
  x: number,
  y: number,
  start: RenderPoint,
  end: RenderPoint,
): number {
  const deltaX = end.xPx - start.xPx;
  const deltaY = end.yPx - start.yPx;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  const ratio =
    lengthSquared === 0
      ? 0
      : clampAtlasPng(((x - start.xPx) * deltaX + (y - start.yPx) * deltaY) / lengthSquared, 0, 1);
  const differenceX = x - (start.xPx + ratio * deltaX);
  const differenceY = y - (start.yPx + ratio * deltaY);
  return differenceX * differenceX + differenceY * differenceY;
}

export function clampAtlasPng(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function atlasPngCancelledFailure(): Extract<AtlasPngRasterResult, { readonly ok: false }> {
  return {
    ok: false,
    failure: Object.freeze({
      reason: 'cancelled',
      message: 'Atlas PNG rasterization was cancelled before canonical bytes were completed.',
    }),
  };
}

export function atlasPngResourceFailure(
  message: string,
): Extract<AtlasPngRasterResult, { readonly ok: false }> {
  return { ok: false, failure: Object.freeze({ reason: 'resource-limit', message }) };
}
