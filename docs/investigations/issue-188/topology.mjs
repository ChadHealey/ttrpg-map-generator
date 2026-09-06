/** Whole-body pocket topology; all contacts derive from an exact exterior arc. */
import {
  edges,
  hasEdge,
  isSimplePolygon,
  pointLocation,
  polygonArea,
  samePoint,
  segmentRelation,
  sharedEdge,
  signedArea,
  stitchBody,
} from '../issue-169/geometry.mjs';

export const PAIR_LIMIT = 32 * 256 * 256;
export const validPoint = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
const positiveRing = (p) => (signedArea(p) < 0 ? p.toReversed() : [...p]);
const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
export function validBay(bay) {
  return (
    !!bay &&
    bay.mouthKind === 'wedge-geodesic' &&
    Array.isArray(bay.polygon) &&
    bay.polygon.length >= 3 &&
    bay.polygon.length <= 256 &&
    bay.polygon.every(validPoint) &&
    Array.isArray(bay.mouth) &&
    bay.mouth.length === 2 &&
    bay.mouth.every(validPoint) &&
    validPoint(bay.witness)
  );
}

/** Called after unchanged positive-body certification; never supplies that certification. */
export function certifyBayTopology(candidate, fail) {
  let pairs = 0;
  const reject = (code, actual, required, id = 'bay') => fail(code, id, actual, required);
  const conflict = (first, second, allowed = []) => {
    const allowedPoints = allowed.flat();
    for (const [a, b] of edges(first))
      for (const [c, d] of edges(second)) {
        if (++pairs > PAIR_LIMIT) {
          reject('bay-pair-budget', pairs, `<= ${PAIR_LIMIT}`);
          return true;
        }
        const relation = segmentRelation(a, b, c, d);
        if (relation === 'none') continue;
        if (
          relation === 'overlap' &&
          allowed.some(([e, f]) => sharedEdge(a, b, e, f) && sharedEdge(c, d, e, f))
        )
          continue;
        const common = [a, b].filter((p) => samePoint(p, c) || samePoint(p, d));
        if (
          relation === 'touch' &&
          common.length === 1 &&
          allowedPoints.some((p) => samePoint(p, common[0]))
        )
          continue;
        return true;
      }
    for (const [ring, other] of [
      [first, second],
      [second, first],
    ]) {
      if (ring.some((p) => pointLocation(p, other) === 1)) return true;
      if (edges(ring).some(([a, b]) => pointLocation(midpoint(a, b), other) === 1)) return true;
    }
    return false;
  };
  const { bay } = candidate;
  if (!validBay(bay) || !isSimplePolygon(bay.polygon)) {
    reject('bay-invalid-geometry', null, 'bounded finite simple wedge pocket');
    return null;
  }
  if (
    !edges(bay.polygon).some(([a, b]) => samePoint(a, bay.mouth[0]) && samePoint(b, bay.mouth[1]))
  ) {
    reject('bay-mouth-order', bay.mouth, 'ordered mouth is an actual directed pocket edge');
    return null;
  }
  const body = positiveRing(candidate.bodyBoundary),
    ring = positiveRing(bay.polygon);
  const [a, b] = signedArea(bay.polygon) < 0 ? bay.mouth.toReversed() : bay.mouth;
  if (
    candidate.attachments.some((role) => role.root.some((p) => samePoint(p, a) || samePoint(p, b)))
  ) {
    reject('bay-mouth-root-junction', null, 'shoulders distinct from all root endpoints');
    return null;
  }
  const ai = ring.findIndex((p) => samePoint(p, a));
  const ordered = ring.map((_, i) => ring[(ai + i) % ring.length]);
  const coast = [a, ...ordered.slice(2).toReversed(), b];
  const start = body.findIndex((p) => samePoint(p, a));
  if (
    start < 0 ||
    coast.length >= body.length ||
    coast.some((p, i) => !samePoint(p, body[(start + i) % body.length]))
  ) {
    reject('bay-whole-coast', null, 'one exact opposite-oriented proper exterior body arc');
    return null;
  }
  const allowed = coast.slice(1).map((p, i) => [coast[i], p]);
  if (hasEdge(body, a, b) || conflict(body, ring, allowed)) {
    reject('bay-body-contact', null, 'only declared shared coast, with disjoint interiors');
    return null;
  }
  const positives = [{ id: 'interior', polygon: candidate.interior }, ...candidate.attachments];
  for (const item of positives) {
    const ownEdges = allowed.filter(([p, q]) => hasEdge(item.polygon, p, q));
    if (conflict(item.polygon, ring, ownEdges))
      reject('bay-role-contact', null, 'only proved exposed coast contact', item.id);
  }
  for (const island of candidate.islands)
    if (conflict(island.polygon, ring))
      reject('water-intrusion', 'bay', 'detached island disjoint from protected pocket', island.id);
  if (
    pointLocation(bay.witness, ring) !== 1 ||
    [body, ...positives.map((p) => p.polygon), ...candidate.islands.map((p) => p.polygon)].some(
      (p) => pointLocation(bay.witness, p) !== -1,
    )
  )
    reject('bay-witness', bay.witness, 'strictly inside E and outside every positive component');
  let precut = null;
  try {
    precut = stitchBody(body, [{ polygon: ring }]);
    const expected = body.filter((_, i) => {
      const offset = (i - start + body.length) % body.length;
      return offset === 0 || offset >= coast.length - 1;
    });
    if (
      precut.length !== expected.length ||
      edges(precut).some(([p, q]) => !hasEdge(expected, p, q))
    )
      reject('bay-precut-boundary', null, 'exact coast replacement by mouth chord');
    if (Math.abs(polygonArea(precut) - polygonArea(body) - polygonArea(ring)) > 1e-12)
      reject('bay-precut-area', null, 'area(U0)=area(S)+area(E)');
  } catch {
    reject('bay-precut-topology', null, 'one simple chord-closed precut body');
  }
  return { body, ring, mouth: [a, b], coast, precut, pairs };
}
