/** Planet-native coastal echoes and water marks for the restrained atlas style. */

import {
  ATLAS_FULL_LATITUDE_BAND_COUNT,
  ATLAS_FULL_LONGITUDE_CELL_COUNT,
  ATLAS_FULL_SAMPLE_COUNT,
  type AtlasGeographyRecords,
  atlasStorageAddress,
  atlasStorageIndex,
  type AtlasSurfaceComponentMembership,
  type AtlasWaterDecorationPath,
  type CanonicalWorldCoastlineRing,
  type DeterministicRandomStream,
  type EntityId,
  parsePlanetPoint,
  PLANET_LATITUDE_MAX_TICKS,
  PLANET_LATITUDE_MIN_TICKS,
  PLANET_LONGITUDE_MAX_TICKS,
  PLANET_LONGITUDE_MIN_TICKS,
  PLANET_TICKS_PER_TURN,
  type PlanetPoint,
  roundTiesAwayFromZero,
  type WaterBody,
} from '@ttrpg-map/core';

const DISPLAY_TICKS_PER_PIXEL = PLANET_TICKS_PER_TURN / 2_048;
const SEAM_MARGIN_TICKS = 14 * DISPLAY_TICKS_PER_PIXEL;
const POLE_MARGIN_TICKS = 14 * DISPLAY_TICKS_PER_PIXEL;

/** Generate stable source-linked decoration without projecting or changing semantic geography. */
export function createAtlasWaterDecorationPaths(
  sourceRecords: AtlasGeographyRecords,
  random: DeterministicRandomStream,
): readonly AtlasWaterDecorationPath[] {
  const records = canonicalize(sourceRecords);
  const paths = [
    ...records.coastline.rings.flatMap((ring) => echoPaths(records, ring, random)),
    ...records.waterBodies.flatMap((waterBody) => waterMarkPaths(waterBody, random)),
  ];
  return Object.freeze(
    paths.sort((left, right) => compareText(left.decorationId, right.decorationId)),
  );
}

function echoPaths(
  records: AtlasGeographyRecords,
  ring: CanonicalWorldCoastlineRing,
  random: DeterministicRandomStream,
): readonly AtlasWaterDecorationPath[] {
  if (ring.points.length < 9) return Object.freeze([]);
  const stride = 76 + random.nextInt(31);
  const start = random.nextInt(stride);
  const paths: AtlasWaterDecorationPath[] = [];
  let acceptedIndex = 0;
  const centers: number[] = [];
  for (let center = start; center < ring.points.length; center += stride) centers.push(center);
  if (centers.length === 0) centers.push(random.nextInt(ring.points.length));
  for (const center of centers) {
    const offsetTicks = (4.5 + random.nextFloat64() * 2.5) * DISPLAY_TICKS_PER_PIXEL;
    const points = offsetRingSpan(ring.points, center, offsetTicks);
    const clearance = offsetRingSpan(ring.points, center, offsetTicks * 2.35);
    if (
      points === undefined ||
      clearance === undefined ||
      !points.every((point) => isWater(records, point)) ||
      !clearance.every((point) => isWater(records, point))
    ) {
      continue;
    }
    paths.push(
      Object.freeze({
        decorationId: `atlas-water/echo/${ring.ringId}/${String(acceptedIndex).padStart(4, '0')}`,
        kind: 'coastal-echo',
        sourceEntityId: ring.landmassId,
        sourceRingId: ring.ringId,
        sourceBoundaryFingerprint: ring.sourceBoundaryFingerprint,
        relatedSourceIds: Object.freeze([ring.ringId, ...ring.waterBodyIds].sort(compareText)),
        weightPermille: 720 + random.nextInt(181),
        points,
      }),
    );
    acceptedIndex += 1;
  }
  return Object.freeze(paths);
}

function waterMarkPaths(
  waterBody: WaterBody,
  random: DeterministicRandomStream,
): readonly AtlasWaterDecorationPath[] {
  const targetCount = Math.max(
    2,
    Math.min(20, Math.ceil(waterBody.membership.sampleCount / 70_000)),
  );
  const usedSamples = new Set<number>();
  const paths: AtlasWaterDecorationPath[] = [];
  for (let markIndex = 0; markIndex < targetCount; markIndex += 1) {
    let accepted: readonly PlanetPoint[] | undefined;
    let sampleIndex: number | undefined;
    for (let attempt = 0; attempt < 28 && accepted === undefined; attempt += 1) {
      const candidate = membershipSampleAt(
        waterBody.membership,
        random.nextInt(waterBody.membership.sampleCount),
      );
      if (usedSamples.has(candidate)) continue;
      const anchor = pointForSample(candidate);
      if (anchor === undefined || isNearChartBoundary(anchor)) continue;
      const halfLengthTicks = (5 + random.nextInt(7)) * DISPLAY_TICKS_PER_PIXEL;
      const bowTicks = (random.nextInt(5) - 2) * (DISPLAY_TICKS_PER_PIXEL / 3);
      const candidatePoints = waterMarkPoints(anchor, halfLengthTicks, bowTicks);
      if (
        candidatePoints?.every((point) => membershipOwnsPoint(waterBody.membership, point)) === true
      ) {
        accepted = candidatePoints;
        sampleIndex = candidate;
      }
    }
    if (accepted === undefined || sampleIndex === undefined) continue;
    usedSamples.add(sampleIndex);
    paths.push(
      Object.freeze({
        decorationId: `atlas-water/mark/${waterBody.entityId}/${String(paths.length).padStart(4, '0')}`,
        kind: 'water-mark',
        sourceEntityId: waterBody.entityId,
        relatedSourceIds: Object.freeze([]),
        weightPermille: 650 + random.nextInt(251),
        points: accepted,
      }),
    );
  }
  return Object.freeze(paths);
}

function offsetRingSpan(
  ring: readonly PlanetPoint[],
  center: number,
  distanceTicks: number,
): readonly PlanetPoint[] | undefined {
  const indexes = [center - 8, center, center + 8];
  const points: PlanetPoint[] = [];
  for (const rawIndex of indexes) {
    const index = modulo(rawIndex, ring.length);
    const point = ring[index];
    const previous = ring[modulo(index - 2, ring.length)];
    const next = ring[modulo(index + 2, ring.length)];
    if (point === undefined || previous === undefined || next === undefined) return undefined;
    if (isNearChartBoundary(point)) return undefined;
    const deltaX = shortestLongitudeDelta(previous.longitudeTicks, next.longitudeTicks);
    const deltaY = next.latitudeTicks - previous.latitudeTicks;
    const length = Math.hypot(deltaX, deltaY);
    if (!(length > 0)) return undefined;
    const longitudeTicks =
      point.longitudeTicks + roundTiesAwayFromZero((deltaY / length) * distanceTicks);
    const latitudeTicks =
      point.latitudeTicks - roundTiesAwayFromZero((deltaX / length) * distanceTicks);
    const parsed = canonicalPoint(longitudeTicks, latitudeTicks);
    if (parsed === undefined || isNearChartBoundary(parsed)) return undefined;
    points.push(parsed);
  }
  return crossesSeam(points) ? undefined : Object.freeze(points);
}

function waterMarkPoints(
  anchor: PlanetPoint,
  halfLengthTicks: number,
  bowTicks: number,
): readonly PlanetPoint[] | undefined {
  const points = [
    canonicalPoint(anchor.longitudeTicks - halfLengthTicks, anchor.latitudeTicks),
    canonicalPoint(anchor.longitudeTicks, anchor.latitudeTicks + bowTicks),
    canonicalPoint(anchor.longitudeTicks + halfLengthTicks, anchor.latitudeTicks),
  ];
  return points.some((point) => point === undefined || isNearChartBoundary(point)) ||
    crossesSeam(points as PlanetPoint[])
    ? undefined
    : Object.freeze(points as PlanetPoint[]);
}

function membershipSampleAt(membership: AtlasSurfaceComponentMembership, offset: number): number {
  let remaining = offset;
  for (const range of membership.sampleRanges) {
    const length = range.endIndexExclusive - range.startIndex;
    if (remaining < length) return range.startIndex + remaining;
    remaining -= length;
  }
  throw new RangeError('Water membership offset is outside its declared sample count.');
}

function pointForSample(index: number): PlanetPoint | undefined {
  if (index < 0 || index >= ATLAS_FULL_SAMPLE_COUNT) return undefined;
  const { longitudeIndex, latitudeIndex } = atlasStorageAddress(index);
  const longitudeTicks =
    latitudeIndex === 0 || latitudeIndex === ATLAS_FULL_LATITUDE_BAND_COUNT
      ? 0
      : PLANET_LONGITUDE_MIN_TICKS +
        longitudeIndex * (PLANET_TICKS_PER_TURN / ATLAS_FULL_LONGITUDE_CELL_COUNT);
  const latitudeTicks =
    PLANET_LATITUDE_MIN_TICKS +
    latitudeIndex * (PLANET_TICKS_PER_TURN / 2 / ATLAS_FULL_LATITUDE_BAND_COUNT);
  return canonicalPoint(longitudeTicks, latitudeTicks);
}

function isWater(records: AtlasGeographyRecords, point: PlanetPoint): boolean {
  return records.landWaterClassification.samples[sampleIndexForPoint(point)] === 'water';
}

function membershipOwnsPoint(
  membership: AtlasSurfaceComponentMembership,
  point: PlanetPoint,
): boolean {
  const index = sampleIndexForPoint(point);
  return membership.sampleRanges.some(
    ({ startIndex, endIndexExclusive }) => index >= startIndex && index < endIndexExclusive,
  );
}

function sampleIndexForPoint(point: PlanetPoint): number {
  const latitudeStep = PLANET_TICKS_PER_TURN / 2 / ATLAS_FULL_LATITUDE_BAND_COUNT;
  const longitudeStep = PLANET_TICKS_PER_TURN / ATLAS_FULL_LONGITUDE_CELL_COUNT;
  const latitudeIndex = Math.max(
    0,
    Math.min(
      ATLAS_FULL_LATITUDE_BAND_COUNT,
      Math.round((point.latitudeTicks - PLANET_LATITUDE_MIN_TICKS) / latitudeStep),
    ),
  );
  if (latitudeIndex === 0 || latitudeIndex === ATLAS_FULL_LATITUDE_BAND_COUNT) {
    return atlasStorageIndex(0, latitudeIndex);
  }
  const longitudeIndex = modulo(
    Math.round((point.longitudeTicks - PLANET_LONGITUDE_MIN_TICKS) / longitudeStep),
    ATLAS_FULL_LONGITUDE_CELL_COUNT,
  );
  return atlasStorageIndex(longitudeIndex, latitudeIndex);
}

function canonicalPoint(longitudeTicks: number, latitudeTicks: number): PlanetPoint | undefined {
  if (
    latitudeTicks <= PLANET_LATITUDE_MIN_TICKS + POLE_MARGIN_TICKS ||
    latitudeTicks >= PLANET_LATITUDE_MAX_TICKS - POLE_MARGIN_TICKS
  ) {
    return undefined;
  }
  const wrappedLongitude =
    modulo(longitudeTicks - PLANET_LONGITUDE_MIN_TICKS, PLANET_TICKS_PER_TURN) +
    PLANET_LONGITUDE_MIN_TICKS;
  const parsed = parsePlanetPoint({
    longitudeTicks: wrappedLongitude,
    latitudeTicks: roundTiesAwayFromZero(latitudeTicks),
  });
  return parsed.ok ? parsed.value : undefined;
}

function isNearChartBoundary(point: PlanetPoint): boolean {
  return (
    point.longitudeTicks <= PLANET_LONGITUDE_MIN_TICKS + SEAM_MARGIN_TICKS ||
    point.longitudeTicks >= PLANET_LONGITUDE_MAX_TICKS - SEAM_MARGIN_TICKS ||
    point.latitudeTicks <= PLANET_LATITUDE_MIN_TICKS + POLE_MARGIN_TICKS ||
    point.latitudeTicks >= PLANET_LATITUDE_MAX_TICKS - POLE_MARGIN_TICKS
  );
}

function crossesSeam(points: readonly PlanetPoint[]): boolean {
  return points.slice(1).some((point, index) => {
    const previous = points[index];
    return (
      previous !== undefined &&
      Math.abs(point.longitudeTicks - previous.longitudeTicks) > PLANET_TICKS_PER_TURN / 2
    );
  });
}

function shortestLongitudeDelta(start: number, end: number): number {
  const delta = end - start;
  if (delta > PLANET_TICKS_PER_TURN / 2) return delta - PLANET_TICKS_PER_TURN;
  if (delta < -PLANET_TICKS_PER_TURN / 2) return delta + PLANET_TICKS_PER_TURN;
  return delta;
}

function canonicalize(records: AtlasGeographyRecords): AtlasGeographyRecords {
  return {
    ...records,
    waterBodies: Object.freeze([...records.waterBodies].sort(compareEntity)),
    coastline: {
      ...records.coastline,
      rings: Object.freeze(
        [...records.coastline.rings].sort((left, right) => compareText(left.ringId, right.ringId)),
      ),
    },
  };
}

function compareEntity(
  left: { readonly entityId: EntityId },
  right: { readonly entityId: EntityId },
) {
  return compareText(left.entityId, right.entityId);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function modulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}
