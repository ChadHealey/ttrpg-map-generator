/** Literal first whole-coast state. No runtime fitting or witness search belongs here. */
import { signedArea } from '../../../issue-169/geometry.mjs';
import { partitionCoast, sampleCoast } from '../../../issue-172/coast-partition.mjs';

const ANCHORS = [
  [0.49, -0.22],
  [0.34, -0.15],
  [0.18, -0.03],
  [0.39, 0.02],
  [0.6, -0.005],
  [0.75, 0.2],
  [0.6, 0.4],
  [0.49, 0.63],
  [0.25, 0.84],
  [-0.1, 0.77],
  [-0.43, 0.6],
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
  [0.49, -0.38],
  [0.51, -0.3],
];
const U = { 3: [0.008, 0], 4: [0.012, 0], 5: [0.02, 0], 6: [0.02, 0], 7: [0.02, 0], 8: [0.02, 0] };
const V = {
  0: [0, 0.008],
  1: [0, 0.006],
  23: [0.01, -0.015],
  24: [0.025, -0.01],
  25: [0.01, 0.01],
  26: [0, 0.008],
  27: [0, 0.008],
  28: [0, 0.008],
};
export function buildCoast(id, { anatomy = [0, 0], variation = 0 } = {}) {
  if (
    typeof id !== 'string' ||
    !id ||
    !Array.isArray(anatomy) ||
    anatomy.length !== 2 ||
    !anatomy.every((x) => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= 1) ||
    !Number.isInteger(variation) ||
    Object.is(variation, -0) ||
    variation < 0 ||
    variation > 3
  )
    throw new RangeError('Invalid bounded anatomy, variation or owner ID');
  const g = [1, 0.85, 0.6, 0.3][variation],
    u = g * anatomy[0],
    v = g * anatomy[1];
  const anchors = ANCHORS.map((p, i) =>
    p.map((x, k) => x + u * (U[i]?.[k] ?? 0) + v * (V[i]?.[k] ?? 0)),
  );
  const coast = sampleCoast(anchors, { steps: 3, tension: 0.12 });
  if (!(signedArea(coast) > 0)) throw new Error('Declared mother coast is not CCW');
  const split = partitionCoast(id, {
    coast,
    roles: [
      { kind: 'lobe', start: 18, end: 33, far: [21, 30], disk: [0.01 * u, 0.525] },
      {
        kind: 'lobe',
        start: 66,
        end: 81,
        far: [69, 75],
        disk: [-0.15 + 0.008 * v, -0.56 - 0.006 * v],
      },
      { kind: 'peninsula', start: 39, end: 60, far: [45, 54], disk: [-0.68, -0.05] },
    ],
    interiorWitness: [-0.1, 0],
    bay: { start: 0, end: 12, witness: [0.28 + 0.004 * u, -0.065 + 0.004 * v] },
    islandAnchors: [63, 65, 79, 81, 82, 83],
  });
  split.bay.polygon.reverse();
  split.bay.mouthKind = 'wedge-geodesic';
  return split;
}
