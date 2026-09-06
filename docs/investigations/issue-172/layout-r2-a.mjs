/** A single cyclic coast with a long northeast mass and westward fan peninsula. */
import { partitionCoast, sampleCoast } from './coast-partition.mjs';

export function buildCoast(id, { anatomy = [0, 0], variation = 0, fragmentationBand = 1 } = {}) {
  const [u, v] = anatomy;
  const anchors = [
    [0.62, 0],
    [0.7, -0.1],
    [0.77, 0.15],
    [0.53, 0.33],
    [0.56 + 0.025 * u, 0.56 + 0.025 * v],
    [0.35 + 0.04 * u, 0.7 + 0.04 * v],
    [0.08, 0.68 + 0.025 * v],
    [-0.1, 0.38],
    [-0.36, 0.37],
    [-0.46, 0.23],
    [-0.64, 0.37],
    [-0.76, 0.22],
    [-0.7, 0.055],
    [-0.48, 0.125],
    [-0.64, -0.15],
    [-0.4, -0.35],
    [-0.33 - 0.025 * v, -0.57],
    [-0.07 - 0.03 * v, -0.69 - 0.025 * u],
    [0.17, -0.5],
    [0.15, -0.31],
    [0.35, -0.3],
    [0.54, -0.17],
    [0.4, 0],
    [0.32, 0.14],
    [0.42, 0.225 + 0.003 * fragmentationBand],
    [0.6, 0.12],
  ];
  const coast = sampleCoast(anchors, { steps: 4, tension: [0.16, 0.19, 0.22, 0.24][variation] });
  return partitionCoast(id, {
    coast,
    roles: [
      { kind: 'lobe', start: 12, end: 28, far: [16, 24], disk: [0.25, 0.48] },
      { kind: 'lobe', start: 61, end: 73, far: [65, 71], disk: [-0.1, -0.52] },
      { kind: 'peninsula', start: 36, end: 52, far: [40, 48], disk: [-0.57, 0.205] },
    ],
    bay: { start: 88, end: 0, witness: [0.43, 0.209] },
    interiorWitness: [-0.03, -0.02],
    islandAnchors: [56, 57, 79, 80, 81, 82],
  });
}
