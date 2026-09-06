/** Two reviewed literals only. Do not call before the authorized complete capture. */
import { polygonArea } from '../issue-169/geometry.mjs';
import { partitionCoast } from './coast-partition.mjs';

export function buildFixture(id) {
  if (!['peninsula-bank', 'lobe-bank'].includes(id))
    throw new RangeError('Only two fixed component fixtures');
  const lobe = id === 'lobe-bank';
  const r = [0.1, lobe ? -0.28 : -0.25],
    h = [0.1, 0],
    k = [0.13, 0.11];
  const a = [0.4, -0.08],
    b = [0.39, 0.16];
  const f = [0.4, lobe ? -0.21 : -0.18],
    t = lobe ? [0.46, -0.145] : [0.44, -0.13];
  const bodyBoundary = [[-0.6, -0.5], [0.1, -0.5], r, f, t, a, h, k, b, [0.36, 0.5], [-0.6, 0.5]];
  const partition = partitionCoast(id, {
    coast: bodyBoundary,
    roles: [
      { kind: lobe ? 'lobe' : 'peninsula', start: 2, end: 6, far: [3, 5], disk: [0.2, -0.12] },
    ],
    bay: { start: 5, end: 8, witness: [0.21, 0.05] },
    interiorWitness: [-0.2, 0],
  });
  let candidate = {
    ...partition,
    id,
    primary: false,
    bodyBoundary,
    islands: [],
    bay: { ...partition.bay, polygon: [a, b, k, h] },
  };
  if (lobe) {
    const point = ([x, y]) => [x, -y],
      ring = (p) => p.map(point).toReversed();
    candidate = {
      ...candidate,
      interior: ring(candidate.interior),
      interiorWitness: point(candidate.interiorWitness),
      bodyBoundary: ring(candidate.bodyBoundary),
      attachments: candidate.attachments.map((role) => ({
        ...role,
        polygon: ring(role.polygon),
        root: role.root.map(point),
        collar: { far: role.collar.far.map(point), disk: point(role.collar.disk) },
      })),
      bay: {
        ...candidate.bay,
        polygon: ring(candidate.bay.polygon),
        mouth: candidate.bay.mouth.map(point).toReversed(),
        witness: point(candidate.bay.witness),
      },
    };
  }
  const quota =
    (polygonArea(candidate.interior) +
      candidate.attachments.reduce((sum, role) => sum + polygonArea(role.polygon), 0)) /
    (4 * Math.PI);
  return { candidate, quota };
}
