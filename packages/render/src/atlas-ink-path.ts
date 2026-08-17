/** Safe one-pass hand-ink derivation from canonical projected coastline paths. */

import {
  type AtlasCoastlineInkDecision,
  type AtlasStyleCoastlineTokens,
  type RenderPoint,
} from '@ttrpg-map/core';

import type { AtlasProjectedCoastlinePath } from './atlas-display-projection.js';
import { atlasDisplayPointToRenderPoint } from './atlas-scene-fill.js';

export interface AtlasInkStrokeSegment {
  readonly segmentIndex: number;
  readonly points: readonly RenderPoint[];
  readonly strokeWidthPx: number;
}

/**
 * Derive a low-frequency two-band wobble once, then split the resulting path only for pressure.
 * Unsafe candidates retry at lower amplitude and finally fall back to canonical projected points.
 */
export function deriveAtlasInkStrokeSegments(
  path: AtlasProjectedCoastlinePath,
  decision: AtlasCoastlineInkDecision,
  tokens: AtlasStyleCoastlineTokens,
  widthPx: number,
  heightPx: number,
): readonly AtlasInkStrokeSegment[] {
  const canonical = path.points.map((point) =>
    atlasDisplayPointToRenderPoint(point, widthPx, heightPx),
  );
  const styled = safeWobble(canonical, path.isClosed, decision, tokens, widthPx, heightPx);
  return splitForPressure(styled, decision, tokens);
}

export function hasAtlasPathSelfIntersection(
  points: readonly RenderPoint[],
  isClosed: boolean,
): boolean {
  if (points.length < 4) return false;
  const segmentCount = isClosed ? points.length : points.length - 1;
  const cells = new Map<string, number[]>();
  const checkedPairs = new Set<string>();
  for (let index = 0; index < segmentCount; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    if (start === undefined || end === undefined || samePoint(start, end)) continue;
    const keys = segmentCellKeys(start, end);
    for (const key of keys) {
      for (const previousIndex of cells.get(key) ?? []) {
        if (segmentsAreAdjacent(previousIndex, index, segmentCount, isClosed)) continue;
        const pairKey = `${String(previousIndex)}:${String(index)}`;
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);
        const previousStart = points[previousIndex];
        const previousEnd = points[(previousIndex + 1) % points.length];
        if (
          previousStart !== undefined &&
          previousEnd !== undefined &&
          segmentsIntersect(previousStart, previousEnd, start, end)
        ) {
          return true;
        }
      }
      const indexes = cells.get(key);
      if (indexes === undefined) cells.set(key, [index]);
      else indexes.push(index);
    }
  }
  return false;
}

function safeWobble(
  canonicalInput: readonly RenderPoint[],
  isClosed: boolean,
  decision: AtlasCoastlineInkDecision,
  tokens: AtlasStyleCoastlineTokens,
  widthPx: number,
  heightPx: number,
): readonly RenderPoint[] {
  const canonical = removeExplicitClosure(canonicalInput, isClosed);
  for (const scale of [1, 0.5, 0.25]) {
    const candidate = wobble(canonical, isClosed, decision, tokens, scale, widthPx, heightPx);
    if (!hasAtlasPathSelfIntersection(candidate, isClosed))
      return restoreClosure(candidate, isClosed);
  }
  return restoreClosure(canonical, isClosed);
}

function wobble(
  canonical: readonly RenderPoint[],
  isClosed: boolean,
  decision: AtlasCoastlineInkDecision,
  tokens: AtlasStyleCoastlineTokens,
  amplitudeScale: number,
  widthPx: number,
  heightPx: number,
): readonly RenderPoint[] {
  if (canonical.length < 3) return Object.freeze([...canonical]);
  const cumulative = cumulativeLengths(canonical);
  const totalLength = cumulative.at(-1) ?? 0;
  const amplitude =
    tokens.maximumWobblePx * (decision.wobbleStrengthPermille / 1_000) * amplitudeScale;
  const firstPhase = (decision.wobblePhasePermille / 1_000) * Math.PI * 2;
  const secondPhase = (decision.secondaryPhasePermille / 1_000) * Math.PI * 2;
  return Object.freeze(
    canonical.map((point, index) => {
      if (!isClosed && (index === 0 || index === canonical.length - 1)) return point;
      const previous = canonical[isClosed ? modulo(index - 1, canonical.length) : index - 1];
      const next = canonical[isClosed ? modulo(index + 1, canonical.length) : index + 1];
      if (previous === undefined || next === undefined) return point;
      const tangentX = next.xPx - previous.xPx;
      const tangentY = next.yPx - previous.yPx;
      const tangentLength = Math.hypot(tangentX, tangentY);
      if (!(tangentLength > 0)) return point;
      const distance = cumulative[index] ?? 0;
      const primary = Math.sin((distance / tokens.primaryWavelengthPx) * Math.PI * 2 + firstPhase);
      const secondary =
        Math.sin((distance / tokens.secondaryWavelengthPx) * Math.PI * 2 + secondPhase) * 0.34;
      const taper = isClosed
        ? 1
        : Math.min(1, distance / 14, Math.max(0, (totalLength - distance) / 14));
      const displacement = amplitude * (primary * 0.66 + secondary) * taper;
      const normalX = -tangentY / tangentLength;
      const normalY = tangentX / tangentLength;
      return Object.freeze({
        xPx: clamp(point.xPx + normalX * displacement, 0, widthPx),
        yPx: clamp(point.yPx + normalY * displacement, 0, heightPx),
      });
    }),
  );
}

function splitForPressure(
  points: readonly RenderPoint[],
  decision: AtlasCoastlineInkDecision,
  tokens: AtlasStyleCoastlineTokens,
): readonly AtlasInkStrokeSegment[] {
  if (points.length < 2) return Object.freeze([]);
  const segments: AtlasInkStrokeSegment[] = [];
  let active: RenderPoint[] = [required(points[0])];
  let activeLength = 0;
  let traversedLength = 0;
  for (let index = 1; index < points.length; index += 1) {
    const point = required(points[index]);
    const previous = required(points[index - 1]);
    const edgeLength = Math.hypot(point.xPx - previous.xPx, point.yPx - previous.yPx);
    active.push(point);
    activeLength += edgeLength;
    if (activeLength >= tokens.strokeSegmentLengthPx || index === points.length - 1) {
      const midpointDistance = traversedLength + activeLength / 2;
      const phase = (decision.pressurePhasePermille / 1_000) * Math.PI * 2;
      const pressure = Math.sin(
        (midpointDistance / tokens.pressureWavelengthPx) * Math.PI * 2 + phase,
      );
      const strokeWidthPx =
        tokens.primaryWidthPx +
        pressure * tokens.pressureVariationPx * (decision.pressureStrengthPermille / 1_000);
      segments.push(
        Object.freeze({
          segmentIndex: segments.length,
          points: Object.freeze(active),
          strokeWidthPx,
        }),
      );
      traversedLength += activeLength;
      active = [point];
      activeLength = 0;
    }
  }
  return Object.freeze(segments);
}

function cumulativeLengths(points: readonly RenderPoint[]): readonly number[] {
  const values = [0];
  for (let index = 1; index < points.length; index += 1) {
    const previous = required(points[index - 1]);
    const current = required(points[index]);
    values.push(
      required(values[index - 1]) +
        Math.hypot(current.xPx - previous.xPx, current.yPx - previous.yPx),
    );
  }
  return Object.freeze(values);
}

function removeExplicitClosure(
  points: readonly RenderPoint[],
  isClosed: boolean,
): readonly RenderPoint[] {
  return isClosed && points.length > 1 && samePoint(required(points[0]), required(points.at(-1)))
    ? Object.freeze(points.slice(0, -1))
    : Object.freeze([...points]);
}

function restoreClosure(points: readonly RenderPoint[], isClosed: boolean): readonly RenderPoint[] {
  return isClosed && points.length > 0
    ? Object.freeze([...points, required(points[0])])
    : Object.freeze([...points]);
}

function segmentCellKeys(start: RenderPoint, end: RenderPoint): readonly string[] {
  const cellSize = 8;
  const minimumX = Math.floor(Math.min(start.xPx, end.xPx) / cellSize);
  const maximumX = Math.floor(Math.max(start.xPx, end.xPx) / cellSize);
  const minimumY = Math.floor(Math.min(start.yPx, end.yPx) / cellSize);
  const maximumY = Math.floor(Math.max(start.yPx, end.yPx) / cellSize);
  const keys: string[] = [];
  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) keys.push(`${String(x)}:${String(y)}`);
  }
  return keys;
}

function segmentsAreAdjacent(
  left: number,
  right: number,
  segmentCount: number,
  isClosed: boolean,
): boolean {
  return (
    Math.abs(left - right) <= 1 ||
    (isClosed &&
      ((left === 0 && right === segmentCount - 1) || (right === 0 && left === segmentCount - 1)))
  );
}

function segmentsIntersect(
  firstStart: RenderPoint,
  firstEnd: RenderPoint,
  secondStart: RenderPoint,
  secondEnd: RenderPoint,
): boolean {
  const firstA = orientation(firstStart, firstEnd, secondStart);
  const firstB = orientation(firstStart, firstEnd, secondEnd);
  const secondA = orientation(secondStart, secondEnd, firstStart);
  const secondB = orientation(secondStart, secondEnd, firstEnd);
  return firstA * firstB <= 0 && secondA * secondB <= 0;
}

function orientation(origin: RenderPoint, first: RenderPoint, second: RenderPoint): number {
  return (
    (first.xPx - origin.xPx) * (second.yPx - origin.yPx) -
    (first.yPx - origin.yPx) * (second.xPx - origin.xPx)
  );
}

function samePoint(left: RenderPoint, right: RenderPoint): boolean {
  return left.xPx === right.xPx && left.yPx === right.yPx;
}

function required<Value>(value: Value | undefined): Value {
  if (value === undefined) throw new Error('Atlas ink path lost a required point.');
  return value;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function modulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}
