/** Private attributed copy of generation atlas-coastline-contour-geometry.ts; arithmetic unchanged. */
/** Exact quantized geometry and stable ordering helpers for spherical contour extraction. */

import {
  parsePlanetPoint,
  PLANET_LATITUDE_MAX_TICKS,
  PLANET_LATITUDE_MIN_TICKS,
  PLANET_LONGITUDE_MIN_TICKS,
  type PlanetPoint,
} from '@ttrpg-map/core';
import type {
  ProposedCoastlineBoundaryTransition,
  ProposedPlanetRing,
  QuantizedSphericalField,
} from '@ttrpg-map/generation';

export interface ContourLocalPoint {
  readonly longitudeTicks: number;
  readonly latitudeTicks: number;
}

export function interpolateContourTick(
  startCoordinate: number,
  endCoordinate: number,
  startSign: number,
  endSign: number,
): number {
  if (startCoordinate === endCoordinate) return startCoordinate;
  const numerator = BigInt(-startSign) * BigInt(endCoordinate - startCoordinate);
  const denominator = BigInt(endSign - startSign);
  return startCoordinate + divideRoundTiesAway(numerator, denominator);
}

export function canonicalContourPoint(
  longitudeTicksInput: number,
  latitudeTicks: number,
): PlanetPoint {
  let longitudeTicks = longitudeTicksInput;
  if (longitudeTicks === -PLANET_LONGITUDE_MIN_TICKS) longitudeTicks = PLANET_LONGITUDE_MIN_TICKS;
  if (latitudeTicks === PLANET_LATITUDE_MIN_TICKS || latitudeTicks === PLANET_LATITUDE_MAX_TICKS) {
    longitudeTicks = 0;
  }
  const point = parsePlanetPoint({ longitudeTicks, latitudeTicks });
  if (!point.ok) throw new Error(point.diagnostic.message);
  return point.value;
}

export function contourStorageIndex(
  field: QuantizedSphericalField,
  longitudeIndex: number,
  latitudeIndex: number,
): number {
  if (latitudeIndex === 0) return 0;
  if (latitudeIndex === field.profile.latitudeBandCount) return field.sampleCount - 1;
  return 1 + (latitudeIndex - 1) * field.profile.longitudeCellCount + longitudeIndex;
}

export function contourPointKey(point: PlanetPoint): string {
  const longitude = String(point.longitudeTicks - PLANET_LONGITUDE_MIN_TICKS).padStart(10, '0');
  const latitude = String(point.latitudeTicks - PLANET_LATITUDE_MIN_TICKS).padStart(10, '0');
  return `${longitude}:${latitude}`;
}

export function contourVertexKey(
  point: PlanetPoint | undefined,
  transition: ProposedCoastlineBoundaryTransition | undefined,
): string {
  return `${point === undefined ? '' : contourPointKey(point)}/${String(transition?.landSampleIndex ?? -1)}:${String(transition?.waterSampleIndex ?? -1)}`;
}

export function contourEdgeKey(first: string, second: string): string {
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

export function compareContourRings(left: ProposedPlanetRing, right: ProposedPlanetRing): number {
  const length = Math.min(left.points.length, right.points.length);
  for (let index = 0; index < length; index += 1) {
    const leftKey = contourVertexKey(left.points[index], left.sourceTransitions?.[index]);
    const rightKey = contourVertexKey(right.points[index], right.sourceTransitions?.[index]);
    if (leftKey < rightKey) return -1;
    if (leftKey > rightKey) return 1;
  }
  return left.points.length - right.points.length;
}

export function contourOrientation(
  start: ContourLocalPoint,
  end: ContourLocalPoint,
  point: ContourLocalPoint,
): bigint {
  return (
    BigInt(end.longitudeTicks - start.longitudeTicks) *
      BigInt(point.latitudeTicks - start.latitudeTicks) -
    BigInt(end.latitudeTicks - start.latitudeTicks) *
      BigInt(point.longitudeTicks - start.longitudeTicks)
  );
}

export function hasDifferentContourSigns(first: number, second: number): boolean {
  return first > 0 !== second > 0;
}

export function addContourOutgoing<Segment>(
  outgoing: Map<string, Segment[]>,
  key: string,
  segment: Segment,
): void {
  const values = outgoing.get(key);
  if (values === undefined) outgoing.set(key, [segment]);
  else values.push(segment);
}

export function isContourPlanetPoint(point: PlanetPoint | undefined): point is PlanetPoint {
  return point !== undefined;
}

export function isContourTransition(
  transition: ProposedCoastlineBoundaryTransition | undefined,
): transition is ProposedCoastlineBoundaryTransition {
  return transition !== undefined;
}

export function isContourNumber(value: number | undefined): value is number {
  return value !== undefined;
}

function divideRoundTiesAway(numeratorInput: bigint, denominatorInput: bigint): number {
  if (denominatorInput === 0n) throw new RangeError('Contour interpolation needs distinct signs.');
  const isNegative = numeratorInput < 0n !== denominatorInput < 0n;
  const numerator = numeratorInput < 0n ? -numeratorInput : numeratorInput;
  const denominator = denominatorInput < 0n ? -denominatorInput : denominatorInput;
  let quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder * 2n >= denominator) quotient += 1n;
  const signed = isNegative ? -quotient : quotient;
  const value = Number(signed);
  if (!Number.isSafeInteger(value)) throw new RangeError('Interpolated contour tick is unsafe.');
  return value;
}
