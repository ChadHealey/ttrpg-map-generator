/** Diagonal northwest/southwest flanks with an off-center northern peninsula. */
import { partitionCoast, sampleCoast } from '../issue-172/coast-partition.mjs';

export function buildCoast(id, { anatomy = [0, 0], variation = 0 } = {}) {
  if (
    !Array.isArray(anatomy) ||
    anatomy.length !== 2 ||
    !anatomy.every((x) => Number.isFinite(x) && Math.abs(x) <= 1) ||
    !Number.isInteger(variation) ||
    variation < 0 ||
    variation > 3
  )
    throw new RangeError('Invalid bounded coast parameters');
  const [u, v] = anatomy;
  const anchors = [
    [0.68, -0.28],
    [0.49, -0.25],
    [0.38, -0.14],
    [0.5, -0.02],
    [0.75, -0.06],
    [0.81, 0.13],
    [0.61, 0.38],
    [0.32, 0.44],
    [0.45, 0.63],
    [0.34, 0.78],
    [0.2, 0.73],
    [0.075, 0.59],
    [0.19, 0.44],
    [0.02, 0.45],
    [-0.09, 0.71],
    [-0.35, 0.82],
    [-0.62, 0.62],
    [-0.68, 0.15],
    [-0.72, -0.03],
    [-0.66, -0.32],
    [-0.5, -0.41],
    [-0.35, -0.64],
    [-0.08, -0.78],
    [0.13, -0.62],
    [0.21, -0.43],
    [0.51, -0.41],
  ];
  // Fixed broad-region offsets, declared before sampling and quota fitting.
  anchors[15] = [anchors[15][0] + 0.015 * u, anchors[15][1] + 0.015 * v];
  anchors[22] = [anchors[22][0] + 0.015 * v, anchors[22][1] - 0.015 * u];
  const coast = sampleCoast(anchors, { steps: 3, tension: [0.12, 0.14, 0.16, 0.18][variation] });
  const split = partitionCoast(id, {
    coast,
    roles: [
      { kind: 'lobe', start: 13 * 3, end: 17 * 3, far: [14 * 3, 16 * 3], disk: [-0.3, 0.47] },
      { kind: 'lobe', start: 20 * 3, end: 24 * 3, far: [21 * 3, 23 * 3], disk: [-0.1, -0.53] },
      { kind: 'peninsula', start: 7 * 3, end: 12 * 3, far: [8 * 3, 11 * 3], disk: [0.25, 0.535] },
    ],
    bay: { start: 0, end: 4 * 3, witness: [0.45, -0.15] },
    interiorWitness: [0, 0],
    islandAnchors: [5 * 3, 6 * 3, 15 * 3, 16 * 3, 21 * 3, 22 * 3],
  });
  split.bay.polygon.reverse();
  split.bay.mouthKind = 'wedge-geodesic';
  return split;
}
