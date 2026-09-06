/** Fixed B+P subordinate witness, not a complete primary or world proposal. */
import { polygonArea, stitchBody } from '../issue-169/geometry.mjs';

export function taperExample({ rootHalfWidth = 0.3, farHalfWidth = 0.06 } = {}) {
  const rootA = [0.2, -rootHalfWidth],
    rootB = [0.2, rootHalfWidth],
    farA = [0.48, -farHalfWidth],
    farB = [0.48, farHalfWidth];
  const interior = [[-0.5, -0.5], [0.2, -0.5], rootA, rootB, [0.2, 0.5], [-0.5, 0.5]];
  const attachment = {
    id: 'local/peninsula-0',
    kind: 'peninsula',
    root: [rootA, rootB],
    polygon: [rootA, farA, [0.52, 0], farB, rootB],
    collar: { far: [farA, farB], disk: [0.3, 0] },
  };
  const candidate = {
    id: 'local',
    primary: false,
    interior,
    interiorWitness: [-0.1, 0],
    attachments: [attachment],
    islands: [],
    bodyBoundary: stitchBody(interior, [attachment]),
  };
  const quota = (polygonArea(interior) + polygonArea(attachment.polygon)) / (4 * Math.PI);
  return { candidate, quota };
}
