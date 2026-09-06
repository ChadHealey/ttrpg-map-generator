import { partitionCoast, sampleCoast } from '../../../issue-172/coast-partition.mjs';
export function buildCoast(id, { anatomy = [0, 0], variation = 0 } = {}) {
  if (
    !Array.isArray(anatomy) ||
    anatomy.length !== 2 ||
    !anatomy.every((x) => Number.isFinite(x) && Math.abs(x) <= 1) ||
    !Number.isInteger(variation) ||
    variation < 0 ||
    variation > 3
  )
    throw new RangeError('Invalid bounded anatomy');
  const anchors = [
    [0.57, -0.23],
    [0.46, -0.095],
    [0.37, -0.015],
    [0.56, 0.005],
    [0.74, -0.035],
    [0.74, 0.25],
    [0.6, 0.4],
    [0.47, 0.66],
    [0.18, 0.81],
    [-0.18, 0.82],
    [-0.48, 0.65],
    [-0.61, 0.4],
    [-0.62, 0.315],
    [-0.625, 0.23],
    [-0.755, 0.09],
    [-0.83, -0.04],
    [-0.93, -0.055],
    [-0.95, -0.1],
    [-0.83, -0.17],
    [-0.705, -0.265],
    [-0.57, -0.32],
    [-0.55, -0.38],
    [-0.49, -0.43],
    [-0.37, -0.66],
    [-0.13, -0.83],
    [0.06, -0.79],
    [0.18, -0.49],
    [0.44, -0.42],
    [0.61, -0.3],
  ];
  const [u, v] = anatomy.map((x) => x * [1, 0.85, 0.6, 0.3][variation]);
  anchors[1][0] += 0.015 * u;
  anchors[2][1] += 0.012 * v;
  anchors[3][0] -= 0.015 * v;
  anchors[7] = [anchors[7][0] + 0.03 * u, anchors[7][1] + 0.015 * v];
  anchors[8] = [anchors[8][0] + 0.04 * v, anchors[8][1] + 0.035 * u];
  anchors[9] = [anchors[9][0] - 0.025 * u, anchors[9][1] - 0.025 * v];
  anchors[24] = [anchors[24][0] + 0.04 * v, anchors[24][1] + 0.025 * u];
  const coast = sampleCoast(anchors, { steps: 3, tension: 0.12 });
  const split = partitionCoast(id, {
    coast,
    roles: [
      { kind: 'lobe', start: 18, end: 33, far: [21, 30], disk: [0, 0.525] },
      { kind: 'lobe', start: 66, end: 78, far: [69, 75], disk: [-0.15, -0.56] },
      { kind: 'peninsula', start: 39, end: 60, far: [45, 54], disk: [-0.68, -0.05] },
    ],
    bay: { start: 0, end: 12, witness: [0.42, -0.04] },
    interiorWitness: [0, 0],
    islandAnchors: [63, 65, 79, 81, 82, 83],
  });
  split.bay.polygon.reverse();
  split.bay.mouthKind = 'wedge-geodesic';
  return split;
}
