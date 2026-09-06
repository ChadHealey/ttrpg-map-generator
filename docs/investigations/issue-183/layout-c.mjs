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
  const anchors = [
    [0.6, -0.3],
    [0.43, -0.235],
    [0.36, -0.145],
    [0.52, -0.115],
    [0.68, -0.1],
    [0.81, 0.13],
    [0.61, 0.38],
    [0.49, 0.4],
    [0.43, 0.56],
    [0.28, 0.68],
    [0.24, 0.75],
    [0.2, 0.755],
    [0.16, 0.7],
    [0.015, 0.56],
    [-0.1, 0.4],
    [-0.16, 0.44],
    [-0.25, 0.66],
    [-0.44, 0.76],
    [-0.68, 0.55],
    [-0.6, 0.15],
    [-0.7, -0.05],
    [-0.66, -0.32],
    [-0.5, -0.41],
    [-0.35, -0.575],
    [-0.08, -0.69],
    [0.13, -0.56],
    [0.21, -0.43],
    [0.51, -0.41],
  ];
  const [u, v] = anatomy.map((x) => x * [1, 0.85, 0.6, 0.3][variation]);
  anchors[17] = [anchors[17][0] + 0.012 * u, anchors[17][1] + 0.012 * v];
  anchors[24] = [anchors[24][0] + 0.008 * v, anchors[24][1] - 0.008 * u];
  const coast = sampleCoast(anchors, { steps: 3, tension: 0.12 });
  const s = partitionCoast(id, {
    coast,
    roles: [
      { kind: 'lobe', start: 15 * 3, end: 19 * 3, far: [16 * 3, 18 * 3], disk: [-0.43, 0.47] },
      { kind: 'lobe', start: 22 * 3, end: 26 * 3, far: [23 * 3, 25 * 3], disk: [-0.1, -0.495] },
      { kind: 'peninsula', start: 7 * 3, end: 14 * 3, far: [9 * 3, 12 * 3], disk: [0.22, 0.52] },
    ],
    bay: { start: 0, end: 4 * 3, witness: [0.4, -0.17] },
    interiorWitness: [0, 0],
    islandAnchors: [5 * 3, 6 * 3, 17 * 3, 18 * 3, 23 * 3, 24 * 3],
  });
  s.bay.polygon.reverse();
  s.bay.mouthKind = 'wedge-geodesic';
  return s;
}
