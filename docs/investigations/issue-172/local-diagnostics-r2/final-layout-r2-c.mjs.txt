/** One horizontal, asymmetric whole coast, partitioned at fixed sampled indices before fitting. */
import { partitionCoast, sampleCoast } from './coast-partition.mjs';

export function buildCoast(id, { anatomy = [0, 0] } = {}) {
  const [u, v] = anatomy;
  const anchors = [
    [0.5, -0.22], // 0 peninsula upper root
    [0.34, 0],
    [0.27, 0.14],
    [0.33, 0.21],
    [0.43, 0.12],
    [0.555, 0], // 1..5 bay
    [0.7, -0.05],
    [0.63, 0.25], // 7 northeast lobe root
    [0.62, 0.45],
    [0.38, 0.58],
    [0.12, 0.5],
    [0.12, 0.33], // 11 northeast root
    [-0.03, 0.17],
    [-0.47, 0.35], // 13 western root
    [-0.64, 0.42],
    [-0.76, 0.3],
    [-0.78, 0.04],
    [-0.65, -0.34],
    [-0.63, -0.38],
    [-0.47, -0.35], // 19 western root
    [-0.1, -0.57],
    [0.15, -0.26],
    [0.42, -0.28], // 22 peninsula lower root
    [0.54, -0.54],
    [0.72, -0.36],
    [0.69, -0.17],
    [0.58, -0.14],
  ];
  // Regional macro changes precede the one periodic curve and keep all role indices fixed.
  anchors[16][1] += 0.025 * u;
  anchors[17][0] += 0.025 * u;
  anchors[9][0] += 0.025 * v;
  const steps = 3,
    coast = sampleCoast(anchors, { steps, tension: 0.12 }),
    at = (i) => i * steps;
  return partitionCoast(id, {
    coast,
    interiorWitness: [0, -0.05],
    roles: [
      { kind: 'lobe', start: at(13), end: at(19), far: [at(14), at(18)], disk: [-0.57, 0.02] },
      { kind: 'lobe', start: at(7), end: at(11), far: [at(8), at(10)], disk: [0.35, 0.365] },
      { kind: 'peninsula', start: at(22), end: at(0), far: [at(23), at(26)], disk: [0.505, -0.35] },
    ],
    bay: { start: at(1), end: at(5), witness: [0.32, 0.19] },
    islandAnchors: [at(12), at(19), at(20), at(21), at(17), at(10)],
  });
}
