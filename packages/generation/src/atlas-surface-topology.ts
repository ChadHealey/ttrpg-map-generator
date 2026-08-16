/** Globe-aware full-profile component analysis using ADR-0009 wrap and pole adjacency. */

import {
  ATLAS_FULL_LATITUDE_BAND_COUNT,
  ATLAS_FULL_LONGITUDE_CELL_COUNT,
  ATLAS_FULL_SAMPLE_COUNT,
  type AtlasSurfaceSampleRange,
  planetPointToAngles,
  roundTiesAwayFromZero,
} from '@ttrpg-map/core';

import { getAtlasGridVertex, WORLD_ATLAS_FULL_PROFILE } from './atlas-sampling-profiles.js';
import { ATLAS_SEMANTIC_POLICY } from './atlas-semantic-classifier-policy.js';

export interface AtlasSurfaceCentroid {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

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
    (_, analysisIndex): MutableComponent => ({
      analysisIndex,
      kind,
      sampleCount: 0,
      sphericalAreaWeight: 0,
      centroidX: 0,
      centroidY: 0,
      centroidZ: 0,
      sampleRanges: [],
    }),
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

/** Discover every land and water component in canonical traversal and fixed neighbor order. */
export function analyzeAtlasSurfacePartition(
  samples: readonly ('land' | 'water')[],
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
    const kind = samples[start];
    if (kind === undefined) throw new Error('Accepted surface partition lost a sample.');
    const component: MutableComponent = {
      analysisIndex: components.length,
      kind,
      sampleCount: 0,
      sphericalAreaWeight: 0,
      centroidX: 0,
      centroidY: 0,
      centroidZ: 0,
      sampleRanges: [],
    };
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
        if (componentIndexBySample[neighbor] === -1 && samples[neighbor] === kind) {
          componentIndexBySample[neighbor] = component.analysisIndex;
          queue[tail] = neighbor;
          tail += 1;
        }
      });
    }
  }
  accumulateCanonicalRanges(components, componentIndexBySample);
  return Object.freeze({
    components: Object.freeze(components.map(freezeComponent)),
    componentIndexBySample,
    rowWeights,
  });
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

function createAtlasRowWeights(): Int32Array {
  const weights = new Int32Array(ATLAS_FULL_LATITUDE_BAND_COUNT + 1);
  for (let latitudeIndex = 1; latitudeIndex < ATLAS_FULL_LATITUDE_BAND_COUNT; latitudeIndex += 1) {
    const latitudeRad = planetPointToAngles(
      getAtlasGridVertex(WORLD_ATLAS_FULL_PROFILE, 0, latitudeIndex),
    ).latitudeRad;
    weights[latitudeIndex] = roundTiesAwayFromZero(
      Math.cos(latitudeRad) * ATLAS_SEMANTIC_POLICY.sphericalAreaWeightScale,
    );
  }
  return weights;
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
  const { longitudeRad, latitudeRad } = planetPointToAngles(
    getAtlasGridVertex(WORLD_ATLAS_FULL_PROFILE, longitudeIndex, latitudeIndex),
  );
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
