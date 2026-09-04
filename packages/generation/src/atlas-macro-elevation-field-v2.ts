/** Version-2 separated continent-envelope macro field and accepted-contour diagnostics. */

import {
  type DeepReadonly,
  type DeterministicRandomStream,
  type PlanetPoint,
  planetPointToAngles,
} from '@ttrpg-map/core';

import type { AtlasMacroElevationParameters } from './atlas-land-water-generator-contract.js';
import type { SampledAtlasMacroElevationField } from './atlas-macro-elevation-field.js';
import {
  type AtlasContourLevel,
  type AtlasFieldValueTicks,
  getAtlasGridVertex,
  quantizeAtlasFieldValue,
} from './atlas-sampling-profiles.js';
import type { QuantizedPlanetFieldAdapter } from './geography-algorithm-adapters.js';

export const ATLAS_SEPARATED_FIELD_BEHAVIOR_VERSION = 2 as const;
export const ATLAS_SEPARATED_FIELD_GAP_POLICY_VERSION = 1 as const;
export const ATLAS_SEPARATED_FIELD_SHAPE_POLICY_VERSION = 1 as const;
export const ATLAS_SEPARATED_FIELD_MINIMUM_OCEAN_GAP_RAD = 0.05;
export const ATLAS_SEPARATED_FIELD_PLACEMENT_BUDGET = 8;

const OCEAN_FLOOR = -0.92;
const SHAPE_EIGENVALUE_RATIO_LIMIT = 10;
const SHAPE_SECTOR_COUNT = 12;
const MINIMUM_OCCUPIED_SHAPE_SECTORS = 5;
const SHAPE_RASTER_DIAMETER = 33;
const SHAPE_RASTER_CELL_COUNT = SHAPE_RASTER_DIAMETER ** 2;
const SHAPE_INSPECTION_COOPERATION_ROW_INTERVAL = 16;

interface UnitVector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface SphericalBlob {
  readonly center: UnitVector;
  readonly cutoffDot: number;
  readonly amplitude: number;
  readonly kind: 'broad' | 'island';
}

interface OwnerEnvelope {
  readonly center: UnitVector;
  readonly east: UnitVector;
  readonly north: UnitVector;
  readonly supportRadiusRad: number;
  readonly supportCutoffDot: number;
  readonly broadRadiusScale: number;
  readonly shapePhase: number;
  readonly harmonicTwo: number;
  readonly harmonicThree: number;
  readonly harmonicFive: number;
  readonly blobs: readonly SphericalBlob[];
  readonly cuts: readonly SphericalBlob[];
  readonly polarAmplitude: number;
}

export interface SeparatedAtlasMacroElevationFieldAdapter extends QuantizedPlanetFieldAdapter {
  readonly algorithmId: 'separated-continent-envelope-field';
  readonly algorithmVersion: typeof ATLAS_SEPARATED_FIELD_BEHAVIOR_VERSION;
  readonly gapPolicyVersion: typeof ATLAS_SEPARATED_FIELD_GAP_POLICY_VERSION;
  readonly shapePolicyVersion: typeof ATLAS_SEPARATED_FIELD_SHAPE_POLICY_VERSION;
  readonly minimumOceanGapRad: number;
  readonly oceanFloorTicks: AtlasFieldValueTicks;
  readonly ownerCount: number;
  readonly sampleCartesian: (x: number, y: number, z: number) => AtlasFieldValueTicks;
  readonly ownerIndexAtCartesian: (x: number, y: number, z: number) => number | undefined;
  readonly ownerShapeCoordinateAtCartesian: (
    ownerIndex: number,
    x: number,
    y: number,
    z: number,
  ) => readonly [number, number];
  readonly broadValueAtCartesian: (
    ownerIndex: number,
    x: number,
    y: number,
    z: number,
  ) => AtlasFieldValueTicks;
}

export interface SeparatedAtlasMacroFieldFinding {
  readonly code: 'atlas.macro-v2.gap-unsatisfied' | 'atlas.macro-v2.owner-shape-unsatisfied';
  readonly message: string;
}

export interface SeparatedAtlasMacroFieldReport {
  readonly gapPolicyVersion: typeof ATLAS_SEPARATED_FIELD_GAP_POLICY_VERSION;
  readonly shapePolicyVersion: typeof ATLAS_SEPARATED_FIELD_SHAPE_POLICY_VERSION;
  readonly minimumOceanGapRad: number;
  readonly ownerCount: number;
  readonly retainedOwnerCount: number;
  readonly findings: readonly SeparatedAtlasMacroFieldFinding[];
}

export interface SeparatedAtlasMacroFieldInspectionCooperation {
  /** Called after deterministic row chunks; true stops before another chunk is inspected. */
  readonly cooperate: (completedRows: number, totalRows: number) => Promise<boolean>;
}

export type SeparatedAtlasMacroFieldInspectionResult =
  | { readonly status: 'completed'; readonly report: SeparatedAtlasMacroFieldReport }
  | { readonly status: 'cancelled' };

/** Construct the finite, project-owned v2 field. All positive terms remain inside one guard. */
export function createSeparatedAtlasMacroElevationFieldAdapter(
  parameters: DeepReadonly<AtlasMacroElevationParameters>,
  random: DeterministicRandomStream,
): SeparatedAtlasMacroElevationFieldAdapter {
  if (parameters.fieldBehaviorVersion !== ATLAS_SEPARATED_FIELD_BEHAVIOR_VERSION) {
    throw new RangeError('Separated macro elevation requires field behavior version 2.');
  }
  const centers = rotatedFibonacciCenters(parameters.continentCountIntent, random);
  const nearestDistances = centers.map((center, index) =>
    nearestCenterDistance(center, index, centers),
  );
  const circumferenceScale = Math.sqrt(40_000 / parameters.worldCircumferenceKm);
  const targetRadius = Math.acos(1 - 1.36 / parameters.continentCountIntent);
  const owners = centers.map((center, index) => {
    const nearestDistance = nearestDistances[index];
    if (nearestDistance === undefined) {
      throw new RangeError('Separated field owner distance is unavailable.');
    }
    const maximumSeparatedRadius =
      centers.length === 1
        ? 1.78
        : (nearestDistance - ATLAS_SEPARATED_FIELD_MINIMUM_OCEAN_GAP_RAD) / 2;
    const supportRadiusRad = clamp(
      0.34,
      maximumSeparatedRadius,
      targetRadius * clamp(0.86, 1.12, circumferenceScale),
    );
    return createOwnerEnvelope(center, supportRadiusRad, index, parameters, random);
  });
  const minimumOceanGapRad = minimumOwnerGap(owners);
  if (minimumOceanGapRad < ATLAS_SEPARATED_FIELD_MINIMUM_OCEAN_GAP_RAD - 1e-12) {
    throw new Error('The fixed v2 placement budget could not preserve its ocean gap.');
  }
  const oceanFloorTicks = fieldTicks(OCEAN_FLOOR);

  const ownerIndexAtCartesian = (x: number, y: number, z: number): number | undefined => {
    for (let index = 0; index < owners.length; index += 1) {
      const owner = owners[index];
      if (owner === undefined) continue;
      if (dotCartesian(owner.center, x, y, z) > owner.supportCutoffDot) return index;
    }
    return undefined;
  };
  const broadValueAtCartesian = (
    ownerIndex: number,
    x: number,
    y: number,
    z: number,
  ): AtlasFieldValueTicks => {
    const owner = owners[ownerIndex];
    if (owner === undefined || dotCartesian(owner.center, x, y, z) <= owner.supportCutoffDot) {
      return oceanFloorTicks;
    }
    return fieldTicks(ownerValue(owner, x, y, z, true));
  };
  const sampleCartesian = (x: number, y: number, z: number): AtlasFieldValueTicks => {
    const ownerIndex = ownerIndexAtCartesian(x, y, z);
    if (ownerIndex === undefined) return oceanFloorTicks;
    const owner = owners[ownerIndex];
    return owner === undefined ? oceanFloorTicks : fieldTicks(ownerValue(owner, x, y, z, false));
  };
  const ownerShapeCoordinateAtCartesian = (
    ownerIndex: number,
    x: number,
    y: number,
    z: number,
  ): readonly [number, number] => {
    const owner = owners[ownerIndex];
    if (owner === undefined) throw new RangeError('Separated field owner index is out of range.');
    const centerDot = clamp(-1, 1, dotCartesian(owner.center, x, y, z));
    const normalizedRadius = Math.acos(centerDot) / owner.supportRadiusRad;
    const bearing = Math.atan2(
      dotCartesian(owner.north, x, y, z),
      dotCartesian(owner.east, x, y, z),
    );
    return Object.freeze([
      normalizedRadius * Math.cos(bearing),
      normalizedRadius * Math.sin(bearing),
    ] as const);
  };

  return Object.freeze({
    algorithmId: 'separated-continent-envelope-field',
    algorithmVersion: ATLAS_SEPARATED_FIELD_BEHAVIOR_VERSION,
    gapPolicyVersion: ATLAS_SEPARATED_FIELD_GAP_POLICY_VERSION,
    shapePolicyVersion: ATLAS_SEPARATED_FIELD_SHAPE_POLICY_VERSION,
    minimumOceanGapRad,
    oceanFloorTicks,
    ownerCount: owners.length,
    sample(point: PlanetPoint): AtlasFieldValueTicks {
      const { longitudeRad, latitudeRad } = planetPointToAngles(point);
      const cosLatitude = Math.cos(latitudeRad);
      return sampleCartesian(
        cosLatitude * Math.cos(longitudeRad),
        cosLatitude * Math.sin(longitudeRad),
        Math.sin(latitudeRad),
      );
    },
    sampleCartesian,
    ownerIndexAtCartesian,
    ownerShapeCoordinateAtCartesian,
    broadValueAtCartesian,
  });
}

/** Verify the selected contour against the analytic gap and sampled broad-owner shape contract. */
export async function inspectSeparatedAtlasMacroField(
  adapter: SeparatedAtlasMacroElevationFieldAdapter,
  field: SampledAtlasMacroElevationField,
  contourLevel: AtlasContourLevel,
  cooperation: SeparatedAtlasMacroFieldInspectionCooperation = {
    cooperate: () => Promise.resolve(false),
  },
): Promise<SeparatedAtlasMacroFieldInspectionResult> {
  const findings: SeparatedAtlasMacroFieldFinding[] = [];
  if (
    adapter.minimumOceanGapRad < ATLAS_SEPARATED_FIELD_MINIMUM_OCEAN_GAP_RAD ||
    adapter.oceanFloorTicks * 2 > contourLevel
  ) {
    findings.push(
      finding(
        'atlas.macro-v2.gap-unsatisfied',
        'The selected contour does not preserve the version-2 strictly positive owner gap.',
      ),
    );
  }

  const shapes = Array.from({ length: adapter.ownerCount }, () => shapeAccumulator());
  const totalRows = field.profile.latitudeBandCount + 1;
  for (
    let chunkStart = 0;
    chunkStart < totalRows;
    chunkStart += SHAPE_INSPECTION_COOPERATION_ROW_INTERVAL
  ) {
    const chunkEnd = Math.min(totalRows, chunkStart + SHAPE_INSPECTION_COOPERATION_ROW_INTERVAL);
    for (let latitudeIndex = chunkStart; latitudeIndex < chunkEnd; latitudeIndex += 1) {
      const longitudeCount =
        latitudeIndex === 0 || latitudeIndex === field.profile.latitudeBandCount
          ? 1
          : field.profile.longitudeCellCount;
      for (let longitudeIndex = 0; longitudeIndex < longitudeCount; longitudeIndex += 1) {
        if (field.valueAt(longitudeIndex, latitudeIndex) * 2 <= contourLevel) continue;
        const point = getAtlasGridVertex(field.profile, longitudeIndex, latitudeIndex);
        const { longitudeRad, latitudeRad } = planetPointToAngles(point);
        const cosLatitude = Math.cos(latitudeRad);
        const x = cosLatitude * Math.cos(longitudeRad);
        const y = cosLatitude * Math.sin(longitudeRad);
        const z = Math.sin(latitudeRad);
        const ownerIndex = adapter.ownerIndexAtCartesian(x, y, z);
        if (ownerIndex === undefined) {
          findings.push(
            finding(
              'atlas.macro-v2.gap-unsatisfied',
              'Retained land was found outside every separated owner support.',
            ),
          );
          continue;
        }
        if (adapter.broadValueAtCartesian(ownerIndex, x, y, z) * 2 <= contourLevel) continue;
        const coordinate = adapter.ownerShapeCoordinateAtCartesian(ownerIndex, x, y, z);
        const shape = shapes[ownerIndex];
        if (shape === undefined) continue;
        accumulateShape(shape, coordinate[0], coordinate[1]);
      }
    }
    if (await cooperation.cooperate(chunkEnd, totalRows)) {
      return Object.freeze({ status: 'cancelled' });
    }
  }

  let retainedOwnerCount = 0;
  for (let index = 0; index < shapes.length; index += 1) {
    const shape = shapes[index];
    if (shape === undefined) continue;
    if (shape.count === 0) continue;
    retainedOwnerCount += 1;
    if (!isCompactOwnerShape(shape)) {
      findings.push(
        finding(
          'atlas.macro-v2.owner-shape-unsatisfied',
          `Broad owner ${String(index)} fails the version-2 compact-shape diagnostic.`,
        ),
      );
    }
  }
  if (retainedOwnerCount === 0) {
    findings.push(
      finding(
        'atlas.macro-v2.owner-shape-unsatisfied',
        'The selected contour retained no broad owner envelope.',
      ),
    );
  }

  return Object.freeze({
    status: 'completed',
    report: Object.freeze({
      gapPolicyVersion: ATLAS_SEPARATED_FIELD_GAP_POLICY_VERSION,
      shapePolicyVersion: ATLAS_SEPARATED_FIELD_SHAPE_POLICY_VERSION,
      minimumOceanGapRad: adapter.minimumOceanGapRad,
      ownerCount: adapter.ownerCount,
      retainedOwnerCount,
      findings: Object.freeze(uniqueFindings(findings)),
    }),
  });
}

function createOwnerEnvelope(
  center: UnitVector,
  supportRadiusRad: number,
  ownerIndex: number,
  parameters: DeepReadonly<AtlasMacroElevationParameters>,
  random: DeterministicRandomStream,
): OwnerEnvelope {
  const { east, north } = tangentBasis(center);
  const broadRadiusScale =
    parameters.continentCountIntent === 1
      ? 0.96
      : parameters.continentDistribution === 'oneDominant'
        ? ownerIndex === 0
          ? 0.94
          : 0.8
        : parameters.continentDistribution === 'balanced'
          ? 0.81
          : 0.73 + random.nextFloat64() * 0.1;
  const phase = random.nextFloat64() * Math.PI * 2;
  const harmonicTwo = signedMagnitude(random, 0.06, 0.1);
  const harmonicThree = signedMagnitude(random, 0.05, 0.085);
  const harmonicFive = signedMagnitude(random, 0.025, 0.05);
  const blobs: SphericalBlob[] = [];

  const islandCount = Math.ceil((parameters.islandAbundancePercent / 100) * 3);
  for (let islandIndex = 0; islandIndex < islandCount; islandIndex += 1) {
    const bearing = phase + ((islandIndex + 0.5) * Math.PI * 2) / Math.max(1, islandCount);
    blobs.push(
      blob(
        offsetUnitVector(center, east, north, bearing, supportRadiusRad * 0.92),
        supportRadiusRad * (0.03 + random.nextFloat64() * 0.012),
        0.9,
        'island',
      ),
    );
  }

  const archipelagoCount = Math.ceil((parameters.archipelagoAbundancePercent / 100) * 2);
  for (let clusterIndex = 0; clusterIndex < archipelagoCount; clusterIndex += 1) {
    const clusterBearing =
      phase + ((clusterIndex + 0.25) * Math.PI * 2) / Math.max(1, archipelagoCount);
    for (let memberIndex = 0; memberIndex < 3; memberIndex += 1) {
      const bearing = clusterBearing + (memberIndex - 1) * 0.13;
      const distance = supportRadiusRad * (0.84 + memberIndex * 0.055);
      blobs.push(
        blob(
          offsetUnitVector(center, east, north, bearing, distance),
          supportRadiusRad * 0.024,
          0.82,
          'island',
        ),
      );
    }
  }

  const cuts: SphericalBlob[] = [];
  const cutCount = Math.ceil((parameters.fragmentationPercent / 100) * 3);
  for (let cutIndex = 0; cutIndex < cutCount; cutIndex += 1) {
    const bearing = phase + random.nextFloat64() * Math.PI * 2;
    cuts.push(
      blob(
        offsetUnitVector(
          center,
          east,
          north,
          bearing,
          supportRadiusRad * (0.25 + random.nextFloat64() * 0.25),
        ),
        supportRadiusRad * (0.1 + (parameters.fragmentationPercent / 100) * 0.09),
        0.18 + (parameters.fragmentationPercent / 100) * 0.34,
        'broad',
      ),
    );
  }

  const polarAmplitude =
    parameters.polarCharacter === 'landBiased'
      ? 0.14
      : parameters.polarCharacter === 'oceanBiased'
        ? -0.14
        : 0;
  return Object.freeze({
    center,
    east,
    north,
    supportRadiusRad,
    supportCutoffDot: Math.cos(supportRadiusRad),
    broadRadiusScale,
    shapePhase: phase,
    harmonicTwo,
    harmonicThree,
    harmonicFive,
    blobs: Object.freeze(blobs),
    cuts: Object.freeze(cuts),
    polarAmplitude,
  });
}

function ownerValue(
  owner: OwnerEnvelope,
  x: number,
  y: number,
  z: number,
  broadOnly: boolean,
): number {
  let positive = broadEnvelopeValue(owner, x, y, z);
  if (!broadOnly) {
    for (const basis of owner.blobs) {
      positive = Math.max(positive, blobValue(basis, x, y, z));
    }
  }
  let negative = 0;
  for (const cut of owner.cuts) negative += blobValue(cut, x, y, z);
  const boundedPolar = owner.polarAmplitude * Math.abs(owner.center.z) * z * z;
  return clamp(-1, 1, OCEAN_FLOOR + positive - negative + boundedPolar);
}

function broadEnvelopeValue(owner: OwnerEnvelope, x: number, y: number, z: number): number {
  const centerDot = clamp(-1, 1, dotCartesian(owner.center, x, y, z));
  const angularDistance = Math.acos(centerDot);
  const east = dotCartesian(owner.east, x, y, z);
  const north = dotCartesian(owner.north, x, y, z);
  const bearing = Math.atan2(north, east);
  const radiusScale = clamp(
    0.52,
    0.96,
    owner.broadRadiusScale +
      owner.harmonicTwo * Math.cos(bearing * 2 + owner.shapePhase) +
      owner.harmonicThree * Math.sin(bearing * 3 - owner.shapePhase * 0.7) +
      owner.harmonicFive * Math.cos(bearing * 5 + owner.shapePhase * 1.3),
  );
  const boundaryRadius = owner.supportRadiusRad * radiusScale;
  if (angularDistance >= boundaryRadius) return 0;
  const normalized = 1 - angularDistance / boundaryRadius;
  return 1.18 * normalized * normalized * (3 - 2 * normalized);
}

function blobValue(basis: SphericalBlob, x: number, y: number, z: number): number {
  const dot = dotCartesian(basis.center, x, y, z);
  if (dot <= basis.cutoffDot) return 0;
  const normalized = (dot - basis.cutoffDot) / (1 - basis.cutoffDot);
  return basis.amplitude * normalized * normalized * (3 - 2 * normalized);
}

function rotatedFibonacciCenters(
  count: number,
  random: DeterministicRandomStream,
): readonly UnitVector[] {
  const rotation = randomRotation(random);
  return Object.freeze(
    Array.from({ length: count }, (_, index) => {
      const z = 1 - (2 * (index + 0.5)) / count;
      const horizontal = Math.sqrt(Math.max(0, 1 - z * z));
      const azimuth = index * Math.PI * 2 * 0.618_033_988_749_894_8;
      return rotateVector(
        { x: horizontal * Math.cos(azimuth), y: horizontal * Math.sin(azimuth), z },
        rotation,
      );
    }),
  );
}

interface Quaternion {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

function randomRotation(random: DeterministicRandomStream): Quaternion {
  const first = random.nextFloat64();
  const second = random.nextFloat64() * Math.PI * 2;
  const third = random.nextFloat64() * Math.PI * 2;
  return Object.freeze({
    x: Math.sqrt(1 - first) * Math.sin(second),
    y: Math.sqrt(1 - first) * Math.cos(second),
    z: Math.sqrt(first) * Math.sin(third),
    w: Math.sqrt(first) * Math.cos(third),
  });
}

function signedMagnitude(
  random: DeterministicRandomStream,
  minimum: number,
  maximum: number,
): number {
  const magnitude = minimum + random.nextFloat64() * (maximum - minimum);
  return random.nextFloat64() < 0.5 ? -magnitude : magnitude;
}

function rotateVector(vector: UnitVector, quaternion: Quaternion): UnitVector {
  const twiceX = 2 * (quaternion.y * vector.z - quaternion.z * vector.y);
  const twiceY = 2 * (quaternion.z * vector.x - quaternion.x * vector.z);
  const twiceZ = 2 * (quaternion.x * vector.y - quaternion.y * vector.x);
  return normalized({
    x: vector.x + quaternion.w * twiceX + (quaternion.y * twiceZ - quaternion.z * twiceY),
    y: vector.y + quaternion.w * twiceY + (quaternion.z * twiceX - quaternion.x * twiceZ),
    z: vector.z + quaternion.w * twiceZ + (quaternion.x * twiceY - quaternion.y * twiceX),
  });
}

function nearestCenterDistance(
  center: UnitVector,
  ownerIndex: number,
  centers: readonly UnitVector[],
): number {
  if (centers.length === 1) return Math.PI;
  let nearest = Math.PI;
  for (let index = 0; index < centers.length; index += 1) {
    if (index === ownerIndex) continue;
    const candidate = centers[index];
    if (candidate !== undefined) {
      nearest = Math.min(nearest, angularDistance(center, candidate));
    }
  }
  return nearest;
}

function minimumOwnerGap(owners: readonly OwnerEnvelope[]): number {
  if (owners.length === 1) return Math.PI;
  let minimum = Math.PI;
  for (let left = 0; left < owners.length; left += 1) {
    for (let right = left + 1; right < owners.length; right += 1) {
      const leftOwner = owners[left];
      const rightOwner = owners[right];
      if (leftOwner === undefined || rightOwner === undefined) continue;
      minimum = Math.min(
        minimum,
        angularDistance(leftOwner.center, rightOwner.center) -
          leftOwner.supportRadiusRad -
          rightOwner.supportRadiusRad,
      );
    }
  }
  return minimum;
}

interface ShapeAccumulator {
  count: number;
  xx: number;
  xy: number;
  yy: number;
  sectors: Set<number>;
  occupiedCells: Uint8Array;
  occupiedCellCount: number;
}

function shapeAccumulator(): ShapeAccumulator {
  return {
    count: 0,
    xx: 0,
    xy: 0,
    yy: 0,
    sectors: new Set<number>(),
    occupiedCells: new Uint8Array(SHAPE_RASTER_CELL_COUNT),
    occupiedCellCount: 0,
  };
}

function accumulateShape(shape: ShapeAccumulator, x: number, y: number): void {
  shape.count += 1;
  shape.xx += x * x;
  shape.xy += x * y;
  shape.yy += y * y;
  const bearing = Math.atan2(y, x);
  shape.sectors.add(
    Math.min(
      SHAPE_SECTOR_COUNT - 1,
      Math.floor(((bearing + Math.PI) / (Math.PI * 2)) * SHAPE_SECTOR_COUNT),
    ),
  );
  const cellIndex = shapeRasterAxis(y) * SHAPE_RASTER_DIAMETER + shapeRasterAxis(x);
  if (shape.occupiedCells[cellIndex] === 0) {
    shape.occupiedCells[cellIndex] = 1;
    shape.occupiedCellCount += 1;
  }
}

function isCompactOwnerShape(shape: ShapeAccumulator): boolean {
  if (shape.count < 8) return false;
  const xx = shape.xx / shape.count;
  const xy = shape.xy / shape.count;
  const yy = shape.yy / shape.count;
  const trace = xx + yy;
  const discriminant = Math.sqrt(Math.max(0, (xx - yy) ** 2 + 4 * xy * xy));
  const major = (trace + discriminant) / 2;
  const minor = Math.max(1e-9, (trace - discriminant) / 2);
  return (
    major / minor <= SHAPE_EIGENVALUE_RATIO_LIMIT &&
    shape.sectors.size >= MINIMUM_OCCUPIED_SHAPE_SECTORS &&
    !hasMultipleSubstantialComponents(shape.occupiedCells, shape.occupiedCellCount, 2) &&
    !hasRepeatedNarrowNecks(shape.occupiedCells)
  );
}

function shapeRasterAxis(value: number): number {
  return Math.min(
    SHAPE_RASTER_DIAMETER - 1,
    Math.max(0, Math.floor(((value + 1) / 2) * SHAPE_RASTER_DIAMETER)),
  );
}

function hasRepeatedNarrowNecks(occupiedCells: Uint8Array): boolean {
  const core = new Uint8Array(SHAPE_RASTER_CELL_COUNT);
  let coreCellCount = 0;
  for (let row = 0; row < SHAPE_RASTER_DIAMETER; row += 1) {
    for (let column = 0; column < SHAPE_RASTER_DIAMETER; column += 1) {
      const cellIndex = row * SHAPE_RASTER_DIAMETER + column;
      if (occupiedCells[cellIndex] !== 1) continue;
      let occupiedNeighborCount = 0;
      for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
        for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
          if (rowOffset === 0 && columnOffset === 0) continue;
          const neighborRow = row + rowOffset;
          const neighborColumn = column + columnOffset;
          if (
            neighborRow >= 0 &&
            neighborRow < SHAPE_RASTER_DIAMETER &&
            neighborColumn >= 0 &&
            neighborColumn < SHAPE_RASTER_DIAMETER &&
            occupiedCells[neighborRow * SHAPE_RASTER_DIAMETER + neighborColumn] === 1
          ) {
            occupiedNeighborCount += 1;
          }
        }
      }
      if (occupiedNeighborCount >= 7) {
        core[cellIndex] = 1;
        coreCellCount += 1;
      }
    }
  }
  return hasMultipleSubstantialComponents(core, coreCellCount, 3);
}

function hasMultipleSubstantialComponents(
  cells: Uint8Array,
  occupiedCellCount: number,
  componentLimit: number,
): boolean {
  if (occupiedCellCount === 0) return false;
  const visited = new Uint8Array(SHAPE_RASTER_CELL_COUNT);
  const minimumComponentSize = Math.max(3, Math.ceil(occupiedCellCount * 0.04));
  let substantialComponentCount = 0;
  for (let start = 0; start < cells.length; start += 1) {
    if (cells[start] !== 1 || visited[start] === 1) continue;
    const queue = [start];
    visited[start] = 1;
    let componentSize = 0;
    for (const current of queue) {
      componentSize += 1;
      const row = Math.floor(current / SHAPE_RASTER_DIAMETER);
      const column = current % SHAPE_RASTER_DIAMETER;
      for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
        for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
          if (rowOffset === 0 && columnOffset === 0) continue;
          const neighborRow = row + rowOffset;
          const neighborColumn = column + columnOffset;
          if (
            neighborRow < 0 ||
            neighborRow >= SHAPE_RASTER_DIAMETER ||
            neighborColumn < 0 ||
            neighborColumn >= SHAPE_RASTER_DIAMETER
          ) {
            continue;
          }
          const neighbor = neighborRow * SHAPE_RASTER_DIAMETER + neighborColumn;
          if (cells[neighbor] !== 1 || visited[neighbor] === 1) continue;
          visited[neighbor] = 1;
          queue.push(neighbor);
        }
      }
    }
    if (componentSize < minimumComponentSize) continue;
    substantialComponentCount += 1;
    if (substantialComponentCount >= componentLimit) return true;
  }
  return false;
}

function tangentBasis(center: UnitVector): Readonly<{ east: UnitVector; north: UnitVector }> {
  const reference = Math.abs(center.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  const east = normalized(cross(reference, center));
  return Object.freeze({ east, north: normalized(cross(center, east)) });
}

function offsetUnitVector(
  center: UnitVector,
  east: UnitVector,
  north: UnitVector,
  bearing: number,
  distance: number,
): UnitVector {
  const tangent = {
    x: east.x * Math.cos(bearing) + north.x * Math.sin(bearing),
    y: east.y * Math.cos(bearing) + north.y * Math.sin(bearing),
    z: east.z * Math.cos(bearing) + north.z * Math.sin(bearing),
  };
  return normalized({
    x: center.x * Math.cos(distance) + tangent.x * Math.sin(distance),
    y: center.y * Math.cos(distance) + tangent.y * Math.sin(distance),
    z: center.z * Math.cos(distance) + tangent.z * Math.sin(distance),
  });
}

function blob(
  center: UnitVector,
  radiusRad: number,
  amplitude: number,
  kind: SphericalBlob['kind'],
): SphericalBlob {
  return Object.freeze({ center, cutoffDot: Math.cos(radiusRad), amplitude, kind });
}

function cross(left: UnitVector, right: UnitVector): UnitVector {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}

function normalized(vector: UnitVector): UnitVector {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  return Object.freeze({ x: vector.x / length, y: vector.y / length, z: vector.z / length });
}

function angularDistance(left: UnitVector, right: UnitVector): number {
  return Math.acos(clamp(-1, 1, left.x * right.x + left.y * right.y + left.z * right.z));
}

function dotCartesian(center: UnitVector, x: number, y: number, z: number): number {
  return center.x * x + center.y * y + center.z * z;
}

function fieldTicks(value: number): AtlasFieldValueTicks {
  const quantized = quantizeAtlasFieldValue(value);
  if (!quantized.ok) throw new Error(quantized.diagnostic.message);
  return quantized.value;
}

function finding(
  code: SeparatedAtlasMacroFieldFinding['code'],
  message: string,
): SeparatedAtlasMacroFieldFinding {
  return Object.freeze({ code, message });
}

function uniqueFindings(
  findings: readonly SeparatedAtlasMacroFieldFinding[],
): readonly SeparatedAtlasMacroFieldFinding[] {
  const seen = new Set<string>();
  return findings.filter(({ code, message }) => {
    const key = `${code}:${message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function clamp(minimum: number, maximum: number, value: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
