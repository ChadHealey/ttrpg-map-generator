/** Public-relative rebound of three fixed local hypotheses. No filesystem writes. */
import { polygonArea, stitchBody } from '../../../issue-169/geometry.mjs';
import { partitionCoast, sampleCoast } from '../../../issue-172/coast-partition.mjs';
import { certifyCandidate } from '../../../issue-176/certificates.mjs';
const base = [
  [0.68, -0.1],
  [0.49, -0.08],
  [0.35, 0.02],
  [0.45, 0.13],
  [0.7, 0.12],
  [0.74, 0.25],
  [0.6, 0.4],
  [0.47, 0.66],
  [0.18, 0.81],
  [-0.18, 0.82],
  [-0.48, 0.65],
  [-0.61, 0.4],
  [-0.64, 0.24],
  [-0.61, 0.065],
  [-0.78, 0.155],
  [-0.92, 0.09],
  [-0.96, 0.03],
  [-0.94, -0.14],
  [-0.75, -0.2],
  [-0.61, -0.065],
  [-0.62, -0.24],
  [-0.49, -0.43],
  [-0.37, -0.66],
  [-0.13, -0.83],
  [0.06, -0.79],
  [0.18, -0.49],
  [0.44, -0.42],
  [0.61, -0.3],
];
const variants = [
  {
    id: 'one-sided-1',
    patch: {
      12: [-0.45, 0.14],
      14: [-0.78, -0.02],
      15: [-0.96, -0.055],
      16: [-0.97, -0.14],
      17: [-0.9, -0.27],
      18: [-0.68, -0.3],
    },
    disk: [-0.73, -0.1],
  },
  {
    id: 'one-sided-2',
    patch: {
      12: [-0.47, 0.15],
      14: [-0.78, -0.04],
      15: [-0.95, -0.09],
      16: [-0.94, -0.21],
      17: [-0.82, -0.31],
      18: [-0.67, -0.26],
    },
    disk: [-0.73, -0.12],
  },
  {
    id: 'one-sided-3',
    patch: {
      12: [-0.49, 0.155],
      14: [-0.78, -0.0625],
      15: [-0.93, -0.105],
      16: [-0.93, -0.23],
      17: [-0.8, -0.32],
      18: [-0.66, -0.3],
      20: [-0.54, -0.25],
    },
    disk: [-0.73, -0.13],
  },
];
const quotas = [
  1.631407882 / (4 * Math.PI),
  0.10494186046511626 * 0.9905,
  0.06666666666666667 * 0.984,
];
const anatomies = [
  [0, 0],
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];
function build(v, anatomy, quota) {
  const anchors = base.map((p, i) => [...(v.patch[i] ?? p)]),
    [u, w] = anatomy;
  anchors[7] = [anchors[7][0] + 0.03 * u, anchors[7][1] + 0.015 * w];
  anchors[8] = [anchors[8][0] + 0.04 * w, anchors[8][1] + 0.035 * u];
  anchors[9] = [anchors[9][0] - 0.025 * u, anchors[9][1] - 0.025 * w];
  anchors[23] = [anchors[23][0] + 0.04 * w, anchors[23][1] + 0.025 * u];
  const coast = sampleCoast(anchors, { steps: 3, tension: 0.12 });
  const split = partitionCoast(v.id, {
    coast,
    roles: [
      { kind: 'lobe', start: 18, end: 33, far: [21, 30], disk: [0, 0.525] },
      { kind: 'lobe', start: 63, end: 75, far: [66, 72], disk: [-0.15, -0.56] },
      { kind: 'peninsula', start: 39, end: 57, far: [45, 51], disk: v.disk },
    ],
    bay: { start: 0, end: 12, witness: [0.43, 0.02] },
    interiorWitness: [0, 0],
  });
  split.bay.polygon.reverse();
  split.bay.mouthKind = 'wedge-geodesic';
  let candidate = {
    id: v.id,
    primary: true,
    ...split,
    islands: [],
    bodyBoundary: stitchBody(split.interior, split.attachments),
  };
  const rawArea = polygonArea(candidate.bodyBoundary),
    scale = Math.sqrt((4 * Math.PI * quota) / rawArea);
  const map = (o) =>
    Array.isArray(o)
      ? o.length === 2 && o.every((x) => typeof x === 'number')
        ? o.map((x) => x * scale)
        : o.map(map)
      : o && typeof o === 'object'
        ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, map(v)]))
        : o;
  candidate = map(candidate);
  const certificate = certifyCandidate(candidate, { quota });
  return { variant: v.id, anatomy, quota, rawArea, scale, candidate, certificate };
}
export function reconstruct() {
  return {
    scope: 'Three fixed local headland variants, no islands or world acceptance',
    variants,
    quotas,
    anatomies,
    reports: variants.flatMap((v) => quotas.flatMap((q) => anatomies.map((a) => build(v, a, q)))),
  };
}
