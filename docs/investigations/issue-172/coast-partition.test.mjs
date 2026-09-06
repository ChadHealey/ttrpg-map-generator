import { describe, expect, it } from 'vitest';

import { edges, hasEdge, polygonArea, stitchBody } from '../issue-169/geometry.mjs';
import { partitionCoast, sampleCoast } from './coast-partition.mjs';

const anchors = Array.from({ length: 16 }, (_, i) => [
  Math.cos((i * Math.PI) / 8),
  Math.sin((i * Math.PI) / 8),
]);
function declaration(coast) {
  return {
    coast,
    interiorWitness: [0, 0],
    roles: [
      { kind: 'lobe', start: 0, end: 9, far: [3, 6], disk: [0.6, 0.3] },
      { kind: 'lobe', start: 15, end: 24, far: [18, 21], disk: [-0.6, 0.3] },
      { kind: 'peninsula', start: 33, end: 42, far: [36, 39], disk: [0.1, -0.6] },
    ],
    islandAnchors: [1, 7, 13, 22, 31, 43],
  };
}

describe('issue-172 fixed whole-coast partitions', () => {
  it('reconstructs the exact authored outer coast and area without resampling the stitched union', () => {
    const coast = sampleCoast(anchors),
      before = structuredClone(coast),
      candidate = partitionCoast('owner', declaration(coast));
    const stitched = stitchBody(candidate.interior, candidate.attachments);
    expect(edges(stitched).every((edge) => hasEdge(coast, ...edge))).toBe(true);
    expect(stitched).toHaveLength(coast.length);
    expect(
      polygonArea(candidate.interior) +
        candidate.attachments.reduce((s, a) => s + polygonArea(a.polygon), 0),
    ).toBeCloseTo(polygonArea(coast), 12);
    expect(coast).toEqual(before);
  });
  it('keeps cyclic intervals fixed across index zero and orients margin edges to the exterior', () => {
    const coast = sampleCoast(anchors),
      input = declaration(coast);
    input.roles = [{ kind: 'lobe', start: 42, end: 3, far: [45, 0], disk: [0.8, 0] }];
    const candidate = partitionCoast('owner', input),
      stitched = stitchBody(candidate.interior, candidate.attachments);
    expect(stitched).toHaveLength(coast.length);
    for (const edge of candidate.islandAnchorEdges) expect(hasEdge(stitched, ...edge)).toBe(true);
    const clockwise = partitionCoast('owner', {
      coast: coast.toReversed(),
      roles: [],
      interiorWitness: [0, 0],
      islandAnchors: [0],
    });
    expect(clockwise.islandAnchorEdges[0]).toEqual([coast.at(-2), coast.at(-1)]);
  });
  it('rejects overlapping role arcs, missing far indices and bay-role overlap before any fitting', () => {
    const coast = sampleCoast(anchors);
    const overlap = declaration(coast);
    overlap.roles[1].start = 6;
    expect(() => partitionCoast('owner', overlap)).toThrow(/Overlapping/);
    const outside = declaration(coast);
    outside.roles[0].far = [10, 11];
    expect(() => partitionCoast('owner', outside)).toThrow(/invalid fixed/);
    const bay = declaration(coast);
    bay.bay = { start: 2, end: 5, witness: [0.9, 0.1] };
    expect(() => partitionCoast('owner', bay)).toThrow(/bay interval/);
  });
  it('bounds sampling and rejects nonfinite coordinates or unsupported controls', () => {
    expect(sampleCoast(anchors)).toHaveLength(48);
    for (const options of [{ steps: 0 }, { steps: 5 }, { tension: NaN }, { tension: 0.3 }])
      expect(() => sampleCoast(anchors, options)).toThrow();
    expect(() => sampleCoast([[NaN, 0], ...anchors])).toThrow();
  });
});
