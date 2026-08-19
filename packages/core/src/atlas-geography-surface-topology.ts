/** Globe-aware component geometry shared by #59 generation and accepted-record validation. */

import {
  ATLAS_FULL_LATITUDE_BAND_COUNT,
  ATLAS_FULL_LONGITUDE_CELL_COUNT,
  ATLAS_FULL_SAMPLE_COUNT,
  ATLAS_SEMANTIC_AREA_WEIGHT_SCALE,
  type AtlasSurfaceComponentMembership,
  type AtlasSurfaceSampleRange,
} from './atlas-geography-model.js';
import type { AtlasSemanticCentroid } from './atlas-geography-semantic-policy.js';
import type { LandWaterSampleReader } from './atlas-sample-reader.js';
import {
  PLANET_ANGULAR_STEP_RAD,
  PLANET_LATITUDE_MIN_TICKS,
  PLANET_LONGITUDE_MIN_TICKS,
  PLANET_TICKS_PER_TURN,
  roundTiesAwayFromZero,
} from './coordinates.js';

export type AtlasSurfaceCentroid = AtlasSemanticCentroid;

export interface AtlasSurfaceComponentAnalysis {
  readonly analysisIndex: number;
  readonly kind: 'land' | 'water';
  readonly sampleCount: number;
  readonly sphericalAreaWeight: number;
  readonly sampleRanges: readonly AtlasSurfaceSampleRange[];
  readonly centroid: AtlasSurfaceCentroid;
}

export interface AtlasSurfacePartitionAnalysis {
  readonly components: readonly AtlasSurfaceComponentAnalysis[];
  readonly componentIndexBySample: Int32Array;
  readonly rowWeights: Int32Array;
}

const partitionSources = new WeakMap<AtlasSurfacePartitionAnalysis, LandWaterSampleReader>();

interface MutableComponent {
  readonly analysisIndex: number;
  readonly kind: 'land' | 'water';
  sampleCount: number;
  sphericalAreaWeight: number;
  centroidX: number;
  centroidY: number;
  centroidZ: number;
  readonly sampleRanges: AtlasSurfaceSampleRange[];
}

/** Summarize an existing canonical region label partition; negative labels are ignored. */
export function summarizeAtlasLabeledRegions(
  labels: Int32Array,
  kind: 'land' | 'water',
  rowWeights: Int32Array,
): readonly AtlasSurfaceComponentAnalysis[] {
  if (labels.length !== ATLAS_FULL_SAMPLE_COUNT) {
    throw new RangeError('Atlas region labels must cover the accepted full profile.');
  }
  const maximumLabel = labels.reduce((maximum, label) => Math.max(maximum, label), -1);
  const components = Array.from(
    { length: maximumLabel + 1 },
    (_, analysisIndex): MutableComponent => mutableComponent(analysisIndex, kind),
  );
  for (let index = 0; index < labels.length; index += 1) {
    const label = labels[index];
    if (label === undefined || label < 0) continue;
    const component = components[label];
    if (component === undefined) throw new Error('Atlas region label is not dense.');
    component.sampleCount += 1;
    accumulateAreaAndCentroid(component, index, rowWeights);
  }
  accumulateCanonicalRanges(components, labels);
  return Object.freeze(components.map(freezeComponent));
}

/** Discover every land and water component in canonical traversal and fixed neighbor order. */
export function analyzeAtlasSurfacePartition(
  samples: LandWaterSampleReader,
): AtlasSurfacePartitionAnalysis {
  if (samples.length !== ATLAS_FULL_SAMPLE_COUNT) {
    throw new RangeError('Semantic classification requires the accepted full-profile partition.');
  }
  const rowWeights = createAtlasRowWeights();
  const componentIndexBySample = new Int32Array(ATLAS_FULL_SAMPLE_COUNT);
  componentIndexBySample.fill(-1);
  const queue = new Int32Array(ATLAS_FULL_SAMPLE_COUNT);
  const components: MutableComponent[] = [];
  for (let start = 0; start < ATLAS_FULL_SAMPLE_COUNT; start += 1) {
    if (componentIndexBySample[start] !== -1) continue;
    const kind = samples.at(start);
    if (kind === undefined) throw new Error('Accepted surface partition lost a sample.');
    const component = mutableComponent(components.length, kind);
    components.push(component);
    let head = 0;
    let tail = 0;
    queue[tail] = start;
    tail += 1;
    componentIndexBySample[start] = component.analysisIndex;
    while (head < tail) {
      const current = queue[head];
      head += 1;
      if (current === undefined) throw new Error('Surface component queue lost an anchor.');
      component.sampleCount += 1;
      accumulateAreaAndCentroid(component, current, rowWeights);
      forEachAtlasSurfaceNeighbor(current, (neighbor) => {
        if (componentIndexBySample[neighbor] === -1 && samples.at(neighbor) === kind) {
          componentIndexBySample[neighbor] = component.analysisIndex;
          queue[tail] = neighbor;
          tail += 1;
        }
      });
    }
  }
  accumulateCanonicalRanges(components, componentIndexBySample);
  const analysis = Object.freeze({
    components: Object.freeze(components.map(freezeComponent)),
    componentIndexBySample,
    rowWeights,
  });
  partitionSources.set(analysis, samples);
  return analysis;
}

export function isAtlasSurfacePartitionAnalysisFor(
  analysis: AtlasSurfacePartitionAnalysis,
  samples: LandWaterSampleReader,
): boolean {
  return partitionSources.get(analysis) === samples;
}

/** Recompute the exact normalized centroid recorded implicitly by canonical membership. */
export function atlasMembershipCentroid(
  membership: AtlasSurfaceComponentMembership,
  rowWeights: Int32Array = createAtlasRowWeights(),
): AtlasSurfaceCentroid {
  const component = mutableComponent(0, 'land');
  for (const { startIndex, endIndexExclusive } of membership.sampleRanges) {
    for (let index = startIndex; index < endIndexExclusive; index += 1) {
      component.sampleCount += 1;
      accumulateAreaAndCentroid(component, index, rowWeights);
    }
  }
  return freezeComponent(component).centroid;
}

export function forEachAtlasSurfaceNeighbor(
  index: number,
  visit: (neighborIndex: number) => void,
): void {
  if (index === 0 || index === ATLAS_FULL_SAMPLE_COUNT - 1) {
    const latitudeIndex = index === 0 ? 1 : ATLAS_FULL_LATITUDE_BAND_COUNT - 1;
    for (
      let longitudeIndex = 0;
      longitudeIndex < ATLAS_FULL_LONGITUDE_CELL_COUNT;
      longitudeIndex += 1
    ) {
      visit(atlasStorageIndex(longitudeIndex, latitudeIndex));
    }
    return;
  }
  const { longitudeIndex, latitudeIndex } = atlasStorageAddress(index);
  visit(atlasStorageIndex(longitudeIndex, latitudeIndex - 1));
  visit(
    atlasStorageIndex(
      (longitudeIndex + ATLAS_FULL_LONGITUDE_CELL_COUNT - 1) % ATLAS_FULL_LONGITUDE_CELL_COUNT,
      latitudeIndex,
    ),
  );
  visit(atlasStorageIndex((longitudeIndex + 1) % ATLAS_FULL_LONGITUDE_CELL_COUNT, latitudeIndex));
  visit(atlasStorageIndex(longitudeIndex, latitudeIndex + 1));
}

export function atlasStorageIndex(longitudeIndex: number, latitudeIndex: number): number {
  if (latitudeIndex === 0) return 0;
  if (latitudeIndex === ATLAS_FULL_LATITUDE_BAND_COUNT) return ATLAS_FULL_SAMPLE_COUNT - 1;
  return (
    1 +
    (latitudeIndex - 1) * ATLAS_FULL_LONGITUDE_CELL_COUNT +
    ((longitudeIndex + ATLAS_FULL_LONGITUDE_CELL_COUNT) % ATLAS_FULL_LONGITUDE_CELL_COUNT)
  );
}

export function atlasStorageAddress(index: number): Readonly<{
  longitudeIndex: number;
  latitudeIndex: number;
}> {
  if (index === 0) return Object.freeze({ longitudeIndex: 0, latitudeIndex: 0 });
  if (index === ATLAS_FULL_SAMPLE_COUNT - 1) {
    return Object.freeze({
      longitudeIndex: 0,
      latitudeIndex: ATLAS_FULL_LATITUDE_BAND_COUNT,
    });
  }
  const offset = index - 1;
  return Object.freeze({
    longitudeIndex: offset % ATLAS_FULL_LONGITUDE_CELL_COUNT,
    latitudeIndex: Math.floor(offset / ATLAS_FULL_LONGITUDE_CELL_COUNT) + 1,
  });
}

export function createAtlasRowWeights(): Int32Array {
  const weights = new Int32Array(ATLAS_FULL_LATITUDE_BAND_COUNT + 1);
  for (let latitudeIndex = 1; latitudeIndex < ATLAS_FULL_LATITUDE_BAND_COUNT; latitudeIndex += 1) {
    const latitudeTicks =
      PLANET_LATITUDE_MIN_TICKS +
      latitudeIndex * (PLANET_TICKS_PER_TURN / 2 / ATLAS_FULL_LATITUDE_BAND_COUNT);
    weights[latitudeIndex] = roundTiesAwayFromZero(
      Math.cos(latitudeTicks * PLANET_ANGULAR_STEP_RAD) * ATLAS_SEMANTIC_AREA_WEIGHT_SCALE,
    );
  }
  return weights;
}

function mutableComponent(analysisIndex: number, kind: 'land' | 'water'): MutableComponent {
  return {
    analysisIndex,
    kind,
    sampleCount: 0,
    sphericalAreaWeight: 0,
    centroidX: 0,
    centroidY: 0,
    centroidZ: 0,
    sampleRanges: [],
  };
}

function accumulateAreaAndCentroid(
  component: MutableComponent,
  sampleIndex: number,
  rowWeights: Int32Array,
): void {
  const { longitudeIndex, latitudeIndex } = atlasStorageAddress(sampleIndex);
  const weight = rowWeights[latitudeIndex] ?? 0;
  component.sphericalAreaWeight += weight;
  if (weight === 0) {
    if (sampleIndex === 0) component.centroidZ -= 1;
    else if (sampleIndex === ATLAS_FULL_SAMPLE_COUNT - 1) component.centroidZ += 1;
    return;
  }
  const longitudeTicks =
    PLANET_LONGITUDE_MIN_TICKS +
    longitudeIndex * (PLANET_TICKS_PER_TURN / ATLAS_FULL_LONGITUDE_CELL_COUNT);
  const latitudeTicks =
    PLANET_LATITUDE_MIN_TICKS +
    latitudeIndex * (PLANET_TICKS_PER_TURN / 2 / ATLAS_FULL_LATITUDE_BAND_COUNT);
  const longitudeRad = longitudeTicks * PLANET_ANGULAR_STEP_RAD;
  const latitudeRad = latitudeTicks * PLANET_ANGULAR_STEP_RAD;
  const latitudeCos = Math.cos(latitudeRad);
  component.centroidX += latitudeCos * Math.cos(longitudeRad) * weight;
  component.centroidY += latitudeCos * Math.sin(longitudeRad) * weight;
  component.centroidZ += Math.sin(latitudeRad) * weight;
}

function accumulateCanonicalRanges(
  components: readonly MutableComponent[],
  componentIndexBySample: Int32Array,
): void {
  let rangeStart = 0;
  let current = componentIndexBySample[0];
  for (let index = 1; index <= ATLAS_FULL_SAMPLE_COUNT; index += 1) {
    const next = index === ATLAS_FULL_SAMPLE_COUNT ? -1 : componentIndexBySample[index];
    if (next === current) continue;
    const component = current === undefined ? undefined : components[current];
    component?.sampleRanges.push(
      Object.freeze({ startIndex: rangeStart, endIndexExclusive: index }),
    );
    rangeStart = index;
    current = next;
  }
}

function freezeComponent(component: MutableComponent): AtlasSurfaceComponentAnalysis {
  const length = Math.hypot(component.centroidX, component.centroidY, component.centroidZ);
  const fallbackZ = component.centroidZ < 0 ? -1 : 1;
  return Object.freeze({
    analysisIndex: component.analysisIndex,
    kind: component.kind,
    sampleCount: component.sampleCount,
    sphericalAreaWeight: component.sphericalAreaWeight,
    sampleRanges: Object.freeze(component.sampleRanges),
    centroid: Object.freeze(
      length === 0
        ? { x: 0, y: 0, z: fallbackZ }
        : {
            x: component.centroidX / length,
            y: component.centroidY / length,
            z: component.centroidZ / length,
          },
    ),
  });
}
