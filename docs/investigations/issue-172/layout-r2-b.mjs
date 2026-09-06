/** R2 B: one periodic coast first, then fixed anatomical crosscuts. */
import { partitionCoast, sampleCoast } from './coast-partition.mjs';
const STEPS = 4;
export function buildCoast(id, { anatomy = [0, 0], variation = 0, fragmentationBand = 0 } = {}) {
  if (
    !Array.isArray(anatomy) ||
    anatomy.length !== 2 ||
    anatomy.some((x) => !Number.isFinite(x) || Math.abs(x) > 1) ||
    !Number.isInteger(variation) ||
    variation < 0 ||
    variation > 3 ||
    !Number.isInteger(fragmentationBand) ||
    fragmentationBand < 0 ||
    fragmentationBand > 3
  )
    throw new RangeError('Invalid R2 B anatomy');
  const amount = [1, 0.85, 0.6, 0.3][variation],
    [u, v] = anatomy.map((x) => x * amount);
  const anchors = [
    [0.42, -0.16],
    [0.62, -0.21],
    [0.73, -0.34],
    [0.65, -0.51],
    [0.5, -0.46],
    [0.38, -0.27],
    [0.17, -0.47],
    [-0.07, -0.51],
    [-0.2, -0.58],
    [-0.47, -0.64],
    [-0.7, -0.5],
    [-0.68, -0.36],
    [-0.61, -0.22],
    [-0.78, -0.07],
    [-0.78, 0.17],
    [-0.6, 0.32],
    [-0.36, 0.44],
    [-0.24, 0.5],
    [0.03, 0.53],
    [0.2, 0.46],
    [0.25, 0.4],
    [0.57, 0.38],
    [0.69, 0.13],
    [0.628, 0],
    [0.47, 0.09],
    [0.42, 0.26],
    [0.34, 0.1],
    [0.4, 0],
  ];
  // Owner-scoped regional offsets precede sampling and the fixed role partition.
  for (const [index, dx, dy] of [
    [9, 0.035 * u, 0.025 * v],
    [10, 0.025 * u, 0.025 * v],
    [11, 0.015 * u, 0.02 * v],
    [13, 0.035 * v, 0],
    [14, 0.045 * v, 0.025 * u],
    [15, 0.035 * v, 0.03 * u],
    [16, 0.05 * u, 0.035 * v],
    [17, 0.02 * u, 0.025 * v],
    [18, 0.07 * u, 0.025 * v],
    [19, 0.02 * u, 0.025 * v],
    [21, 0.02 * v, 0.02 * u],
  ])
    anchors[index] = [anchors[index][0] + dx, anchors[index][1] + dy];
  anchors[25][1] += 0.004 * fragmentationBand;
  const pMap = ([x, y]) => {
    const dx = x - 0.4,
      dy = y + 0.215;
    const along = (0.04 * dx + 0.11 * dy) / 0.0137;
    const out = (0.11 * dx - 0.04 * dy) / 0.0137;
    return [
      0.4 + 0.98 * along * 0.04 + 0.81 * out * 0.11,
      -0.215 + 0.98 * along * 0.11 - 0.81 * out * 0.04,
    ];
  };
  for (let i = 0; i <= 5; i++) anchors[i] = pMap(anchors[i]);
  const shift = ([x, y]) => [x + 0.07, y];
  const coast = sampleCoast(anchors.map(shift), { steps: STEPS, tension: 1 / 6 });
  const roles = [
    { kind: 'lobe', name: 'lobe-1', start: 6, end: 13, far: [8, 11], disk: [-0.37, -0.4] },
    { kind: 'lobe', name: 'lobe-2', start: 15, end: 21, far: [17, 19], disk: [-0.21, 0.415] },
    { kind: 'peninsula', name: 'peninsula', start: 0, end: 5, far: [1, 4], disk: [0.476, -0.26] },
  ].map((r) => ({
    ...r,
    start: r.start * STEPS,
    end: r.end * STEPS,
    far: r.far.map((i) => i * STEPS),
    disk: shift(r.disk),
  }));
  return partitionCoast(id, {
    coast,
    roles,
    interiorWitness: shift([-0.1, 0]),
    bay: { start: 23 * STEPS, end: 27 * STEPS, witness: shift([0.415, 0.23]) },
    islandAnchors: [
      5 * STEPS + 1,
      5 * STEPS + 3,
      13 * STEPS,
      13 * STEPS + 2,
      14 * STEPS,
      14 * STEPS + 2,
    ],
  });
}
