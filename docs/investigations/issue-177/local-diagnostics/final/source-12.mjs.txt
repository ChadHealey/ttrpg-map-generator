/** Horizontal primary: continuous broad flanks, fixed internal role crosscuts. */
import { partitionCoast, sampleCoast } from '../issue-172/coast-partition.mjs';

export function buildCoast(id, { anatomy = [0, 0] } = {}) {
  if (
    !Array.isArray(anatomy) ||
    anatomy.length !== 2 ||
    !anatomy.every((x) => Number.isFinite(x) && Math.abs(x) <= 1)
  )
    throw new RangeError('Invalid bounded anatomy');
  const [u, v] = anatomy;
  const anchors = [
    [0.7, -0.115],
    [0.48, -0.1],
    [0.4, -0.01],
    [0.49, 0.1],
    [0.72, 0.115],
    [0.72, 0.25],
    [0.64, 0.32],
    [0.58, 0.58],
    [0.38, 0.68],
    [0.22, 0.61],
    [0.08, 0.46],
    [-0.1, 0.46],
    [-0.38, 0.38],
    [-0.64, 0.38],
    [-0.84, 0.23],
    [-0.9, -0.04],
    [-0.75, -0.28],
    [-0.37, -0.35],
    [-0.18, -0.44],
    [-0.053, -0.46],
    [-0.18, -0.66],
    [-0.18, -0.78],
    [-0.06, -0.8],
    [0.08, -0.69],
    [0.11, -0.57],
    [0.07, -0.46],
    [0.35, -0.4],
    [0.59, -0.3],
  ];
  // Regional coast coefficients vary before sampling; role identities never move after fitting.
  for (const i of [13, 14, 15, 16]) anchors[i][0] += 0.025 * u;
  for (const i of [7, 8, 9]) anchors[i][1] += 0.02 * v;
  const coast = sampleCoast(anchors, { steps: 3, tension: 0.12 });
  const result = partitionCoast(id, {
    coast,
    roles: [
      { kind: 'lobe', start: 36, end: 51, far: [39, 48], disk: [-0.56, 0] },
      { kind: 'lobe', start: 18, end: 30, far: [21, 27], disk: [0.38, 0.48] },
      { kind: 'peninsula', start: 57, end: 75, far: [63, 69], disk: [-0.04, -0.59] },
    ],
    bay: { start: 0, end: 12, witness: [0.46, 0] },
    interiorWitness: [0, 0],
    islandAnchors: [31, 33, 52, 54, 77, 79],
  });
  result.bay.polygon.reverse();
  result.bay.mouthKind = 'wedge-geodesic';
  // Fixed chart pole chosen for this asymmetric footprint, before any quota or certificate.
  const move = (o) =>
    Array.isArray(o)
      ? o.length === 2 && o.every((x) => typeof x === 'number')
        ? [o[0] + 0.06, o[1] - 0.025]
        : o.map(move)
      : o && typeof o === 'object'
        ? Object.fromEntries(Object.entries(o).map(([k, value]) => [k, move(value)]))
        : o;
  return move(result);
}
