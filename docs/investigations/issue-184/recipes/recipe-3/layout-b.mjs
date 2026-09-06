/** Horizontal primary with a broad-root southern taper and oblique asymmetric bay. */
import { partitionCoast, sampleCoast } from '../../../issue-172/coast-partition.mjs';
import { remapRoles, remapSites, spliceCoast } from './splice.mjs';

export function buildCoast(id, { anatomy = [0, 0] } = {}) {
  if (
    !Array.isArray(anatomy) ||
    anatomy.length !== 2 ||
    !anatomy.every((x) => Number.isFinite(x) && Math.abs(x) <= 1)
  )
    throw new RangeError('Invalid bounded anatomy');
  const [u, v] = anatomy;
  const anchors = [
    [0.49, -0.29],
    [0.53, -0.26],
    [0.57, -0.22],
    [0.61, -0.17],
    [0.64, -0.12],
    [0.72, 0.1],
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
    [-0.335, -0.375],
    [-0.3, -0.4],
    [-0.19, -0.53],
    [-0.08, -0.64],
    [-0.045, -0.72],
    [0.04, -0.64],
    [0.21, -0.52],
    [0.3, -0.4],
    [0.35, -0.4],
    [0.43, -0.37],
  ];
  // Regional coast coefficients vary before sampling; role identities never move after fitting.
  for (const i of [13, 14, 15, 16]) anchors[i][0] += 0.025 * u;
  for (const i of [7, 8, 9]) anchors[i][1] += 0.02 * v;
  const oldCoast = sampleCoast(anchors, { steps: 3, tension: 0.12 });
  // Fixed replacement of five exposed B coast vertices, outside every role interval.
  // Existing roots, feature polygons and collars remain byte-identical to frozen179.
  oldCoast[31] = [0.01, 0.46];
  oldCoast[32] = [-0.025, 0.27];
  oldCoast[33] = [-0.12, 0.14];
  oldCoast[34] = [-0.21, 0.34];
  oldCoast[35] = [-0.2, 0.445];
  const splice = spliceCoast(oldCoast, {
    start: 30,
    end: 36,
    first: [
      [0.01, 0.46],
      [-0.002, 0.39],
      [-0.045, 0.165],
      [-0.12, 0.17],
    ],
    second: [
      [-0.12, 0.17],
      [-0.195, 0.175],
      [-0.14, 0.37],
      [-0.2, 0.445],
    ],
  });
  const result = partitionCoast(id, {
    coast: splice.coast,
    roles: remapRoles(splice, [
      { kind: 'lobe', start: 36, end: 51, far: [39, 48], disk: [-0.56, 0] },
      { kind: 'lobe', start: 18, end: 30, far: [21, 27], disk: [0.38, 0.48] },
      { kind: 'peninsula', start: 57, end: 75, far: [63, 69], disk: [0, -0.49] },
    ]),
    bay: { start: splice.mouth[0], end: splice.mouth[1], witness: [-0.11, 0.2] },
    interiorWitness: [0, -0.16],
    islandAnchors: remapSites(splice, [13, 16, 52, 54, 77, 79]),
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
