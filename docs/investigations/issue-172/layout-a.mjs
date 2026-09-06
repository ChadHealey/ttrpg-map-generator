/** Direct eastern arm, northern mass and western lobe; fixed internal role witnesses. */
import { cubic } from './coast-utils.mjs';
export function buildCoast(id, { fragmentationBand = 1 } = {}) {
  const pa = [0.4, -0.28],
    pb = [0.466, -0.192];
  const l1a = [0.58, 0.22],
    l1b = [-0.16, 0.46],
    l1far0 = [0.67, 0.45],
    l1far1 = [0.02, 0.59];
  const l2a = [-0.4, 0.22],
    l2b = [-0.5, -0.18],
    l2far0 = [-0.61, 0.3],
    l2far1 = [-0.65, -0.19];
  const pfar0 = [0.55, -0.4],
    pfar1 = [0.66, -0.16];
  const mouth = [
    [0.42, 0],
    [0.66, 0],
  ];
  const pocketTip = [0.48, 0.225 + fragmentationBand * 0.003];
  const pocket = [
    mouth[0],
    ...cubic(mouth[0], [0.4, 0.06], [0.36, 0.17], pocketTip, 4),
    ...cubic(pocketTip, [0.6, pocketTip[1] + 0.01], [0.65, 0.1], mouth[1], 4),
  ];
  const lobe1 = [
    l1a,
    ...cubic(l1a, [0.65, 0.26], [0.68, 0.36], l1far0),
    ...cubic(l1far0, [0.66, 0.56], [0.58, 0.64], [0.49, 0.65]),
    ...cubic([0.49, 0.65], [0.35, 0.69], [0.15, 0.72], [0.08, 0.68]),
    ...cubic([0.08, 0.68], [0.04, 0.65], [0.01, 0.62], l1far1, 2),
    ...cubic(l1far1, [-0.05, 0.56], [-0.12, 0.5], l1b, 3),
  ];
  const lobe2 = [
    l2a,
    ...cubic(l2a, [-0.47, 0.29], [-0.56, 0.33], l2far0),
    ...cubic(l2far0, [-0.72, 0.27], [-0.79, 0.15], [-0.79, 0.06]),
    ...cubic([-0.79, 0.06], [-0.76, -0.06], [-0.73, -0.19], l2far1),
    ...cubic(l2far1, [-0.6, -0.21], [-0.53, -0.2], l2b, 3),
  ];
  const peninsula = [
    pa,
    ...cubic(pa, [0.41, -0.34], [0.48, -0.4], pfar0),
    ...cubic(pfar0, [0.6, -0.42], [0.66, -0.48], [0.67, -0.44]),
    ...cubic([0.67, -0.44], [0.75, -0.42], [0.75, -0.35], [0.73, -0.32]),
    ...cubic([0.73, -0.32], [0.7, -0.24], [0.69, -0.18], pfar1),
    ...cubic(pfar1, [0.57, -0.16], [0.51, -0.17], pb, 3),
  ];
  const interior = [
    pb,
    ...cubic(pb, [0.422, -0.214], [0.44, -0.04], mouth[0]),
    ...pocket.slice(1),
    ...cubic(mouth[1], [0.75, 0.04], [0.81, 0.08], [0.78, 0.13]),
    ...cubic([0.78, 0.13], [0.72, 0.16], [0.64, 0.22], l1a),
    l1b,
    ...cubic(l1b, [-0.22, 0.38], [-0.33, 0.15], l2a),
    l2b,
    ...cubic(l2b, [-0.47, -0.16], [-0.47, -0.39], [-0.4, -0.44]),
    ...cubic([-0.4, -0.44], [-0.3, -0.57], [-0.17, -0.6], [-0.08, -0.58]),
    ...cubic([-0.08, -0.58], [0.04, -0.55], [0.12, -0.43], [0.2, -0.4]),
    ...cubic([0.2, -0.4], [0.3, -0.38], [0.39, -0.22], pa),
    pa,
  ];
  // pa duplicated only when final cubic supplied it; the root edge pa->pb closes B.
  interior.pop();
  const attachments = [
    {
      id: `${id}/lobe-1`,
      kind: 'lobe',
      root: [l1a, l1b],
      polygon: lobe1,
      collar: { far: [l1far0, l1far1], disk: [0.2, 0.43] },
    },
    {
      id: `${id}/lobe-2`,
      kind: 'lobe',
      root: [l2a, l2b],
      polygon: lobe2,
      collar: { far: [l2far0, l2far1], disk: [-0.53, 0.075] },
    },
    {
      id: `${id}/peninsula`,
      kind: 'peninsula',
      root: [pa, pb],
      polygon: peninsula,
      collar: { far: [pfar0, pfar1], disk: [0.52, -0.29] },
    },
  ];
  const bay = { polygon: pocket, mouth, witness: [0.49, 0.209] };
  return { interior, interiorWitness: [-0.05, -0.05], attachments, bay };
}
