/** Reviewed whole-primary gulf. Construct only in an exclusively reserved phase. */
import { signedArea } from '../../../issue-169/geometry.mjs';
import { partitionCoast, sampleCoast } from '../../../issue-188/coast-partition.mjs';
import { validateInput } from '../../schema.mjs';

export function buildCoast(id, options) {
  const { u, v } = validateInput(id, options);
  const anchors = [
    [0.54, -0.08],
    [0.25, 0.0],
    [0.21, 0.08],
    [0.53, 0.1],
    [0.65, 0.24],
    [0.65, 0.44],
    [0.47, 0.62],
    [0.24, 0.68],
    [0.02, 0.57],
    [-0.05, 0.43],
    [-0.19, 0.43],
    [-0.31, 0.44],
    [-0.57, 0.4],
    [-0.77, 0.19],
    [-0.78, -0.08],
    [-0.63, -0.34],
    [-0.41, -0.48],
    [-0.24, -0.49],
    [-0.03, -0.53],
    [0.18, -0.49],
    [0.29, -0.4],
    [0.54, -0.195],
    [0.585, -0.13],
  ];
  const U = { 5: [0, 0.01], 6: [0.005, 0.02], 7: [0.005, 0.025], 8: [0.005, 0.01] };
  const V = {
    12: [-0.008, 0.006],
    13: [-0.02, 0.015],
    14: [-0.02, -0.01],
    15: [-0.008, -0.012],
    16: [0, -0.005],
  };
  const coast = sampleCoast(
    anchors.map((p, i) => p.map((x, k) => x + u * (U[i]?.[k] ?? 0) + v * (V[i]?.[k] ?? 0))),
    { steps: 3, tension: 0.12 },
  );
  if (!(signedArea(coast) > 0)) throw new Error('Literal mother coast must be positive');
  return partitionCoast(id, {
    coast,
    roles: [
      {
        kind: 'lobe',
        start: 33,
        end: 48,
        far: [36, 45],
        disk: [-0.46 - 0.005 * v, -0.01 - 0.002 * v],
      },
      {
        kind: 'lobe',
        start: 12,
        end: 24,
        far: [15, 21],
        disk: [0.39 + 0.004 * u, 0.48 + 0.01 * u],
      },
      { kind: 'peninsula', start: 60, end: 3, far: [63, 0], disk: [0.36, -0.17] },
    ],
    bay: { start: 0, end: 9, witness: [0.32, 0.025] },
    interiorWitness: [-0.05, -0.06],
  });
}
