import { partitionCoast, sampleCoast } from '../issue-172/coast-partition.mjs';
export function buildCoast(id) {
  const anchors = [
    [0.68, -0.28],
    [0.49, -0.25],
    [0.38, -0.14],
    [0.5, -0.02],
    [0.75, -0.06],
    [0.81, 0.13],
    [0.61, 0.38],
    [0.49, 0.4],
    [0.39, 0.54],
    [0.28, 0.68],
    [0.22, 0.74],
    [0.16, 0.68],
    [0.025, 0.55],
    [-0.1, 0.4],
    [-0.16, 0.44],
    [-0.25, 0.66],
    [-0.46, 0.74],
    [-0.68, 0.55],
    [-0.71, 0.15],
    [-0.72, -0.03],
    [-0.66, -0.32],
    [-0.5, -0.41],
    [-0.35, -0.575],
    [-0.08, -0.675],
    [0.13, -0.56],
    [0.21, -0.43],
    [0.51, -0.41],
  ];
  const coast = sampleCoast(anchors, { steps: 3, tension: 0.12 });
  const s = partitionCoast(id, {
    coast,
    roles: [
      { kind: 'lobe', start: 14 * 3, end: 18 * 3, far: [15 * 3, 17 * 3], disk: [-0.43, 0.47] },
      { kind: 'lobe', start: 21 * 3, end: 25 * 3, far: [22 * 3, 24 * 3], disk: [-0.1, -0.5] },
      { kind: 'peninsula', start: 7 * 3, end: 13 * 3, far: [9 * 3, 11 * 3], disk: [0.22, 0.52] },
    ],
    bay: { start: 0, end: 4 * 3, witness: [0.45, -0.15] },
    interiorWitness: [0, 0],
    islandAnchors: [5 * 3, 6 * 3, 16 * 3, 17 * 3, 22 * 3, 23 * 3],
  });
  s.bay.polygon.reverse();
  s.bay.mouthKind = 'wedge-geodesic';
  return s;
}
