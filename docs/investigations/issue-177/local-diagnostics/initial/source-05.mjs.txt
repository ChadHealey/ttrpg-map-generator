/** Issue-173's planar support proof, evaluated under the retained binary64 diagnostic policy. */
import { edges, EPS, hasEdge, polygonArea, samePoint, signedArea } from '../issue-169/geometry.mjs';

const SPHERE = 4 * Math.PI;
export const SUPPORTING_CHART_LIMIT = 1.4;

/** Called only after the owner's existing finite/simple geometry validation. */
export function certifySupportingMouth(
  candidate,
  { c, angularRadius, bodyArea, fail, minimum, maximum },
) {
  const { bay } = candidate;
  const reject = (code, actual, required, id = 'bay') => fail(code, id, actual, required);
  // The supplied ordered pair must already describe the ring's actual traversal.
  if (
    !edges(bay.polygon).some(([a, b]) => samePoint(a, bay.mouth[0]) && samePoint(b, bay.mouth[1]))
  ) {
    reject('bay-mouth-order', bay.mouth, 'ordered mouth is a directed pocket edge');
    return null;
  }
  const reversed = signedArea(bay.polygon) < 0;
  const ring = reversed ? bay.polygon.toReversed() : bay.polygon;
  const [a, b] = reversed ? bay.mouth.toReversed() : bay.mouth;
  const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (!Number.isFinite(width) || width <= EPS) {
    reject('bay-mouth-degenerate', width, 'resolved positive mouth width');
    return null;
  }
  if (
    !Number.isFinite(angularRadius) ||
    angularRadius > SUPPORTING_CHART_LIMIT ||
    !Number.isFinite(c) ||
    c <= 0
  ) {
    reject('bay-support-chart', angularRadius, '<= 1.4 radians');
    return null;
  }
  const side = (p) => ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / width;
  const positive = (p, code, id) => {
    const value = side(p);
    if (!Number.isFinite(value) || value <= EPS)
      reject(code, value, '> EPS on the origin side of the chord', id);
    return value;
  };
  const originDistance = positive([0, 0], 'bay-origin-support', 'bay');
  const positivePolygons = [
    { id: 'interior', polygon: candidate.interior, shoulders: true },
    { id: 'body', polygon: candidate.bodyBoundary, shoulders: true },
    ...candidate.attachments.map((p) => ({ ...p, shoulders: false })),
    ...candidate.islands.map((p) => ({ ...p, shoulders: false })),
  ];
  let checkedVertices = 0;
  for (const item of positivePolygons) {
    if (hasEdge(item.polygon, a, b))
      reject('bay-positive-mouth-edge', null, 'no positive edge joins both shoulders', item.id);
    for (const p of item.polygon) {
      checkedVertices++;
      if (item.shoulders && (samePoint(p, a) || samePoint(p, b))) continue;
      positive(p, 'bay-positive-support', item.id);
    }
  }
  for (const p of ring) {
    checkedVertices++;
    if (!samePoint(p, a) && !samePoint(p, b)) positive(p, 'bay-pocket-support', 'bay');
  }
  const witnessDistance = positive(bay.witness, 'bay-witness-support', 'bay');
  checkedVertices++;
  if (checkedVertices > 23 * 256 + 1)
    reject('bay-support-budget', checkedVertices, '<= 23*256+1 checked vertices');
  const chartRadius = 2 * Math.sin(angularRadius / 2);
  if (
    !Number.isFinite(Math.hypot(...bay.witness)) ||
    Math.hypot(...bay.witness) > chartRadius + EPS
  )
    reject('bay-witness-cap', Math.hypot(...bay.witness), 'inside the measured chart cap');
  const openingLower = c * width,
    openingUpper = width / c,
    depthLower = c * witnessDistance,
    removedAreaLower = polygonArea(ring) / SPHERE,
    depthOpeningRatioLower = depthLower / openingUpper;
  minimum(openingLower, 0.12, 'bay-opening-min', 'bay');
  maximum(openingUpper, 0.3, 'bay-opening-max', 'bay');
  minimum(depthLower, 0.15, 'bay-depth', 'bay');
  minimum(depthOpeningRatioLower, 0.5, 'bay-ratio', 'bay');
  if (candidate.primary) minimum(removedAreaLower / bodyArea, 0.02, 'bay-removed-share', 'bay');
  return {
    mouthKind: 'supporting-geodesic',
    assurance: 'binary64-diagnostic',
    acceptance: 'planar-support-and-lambert-lower-bounds',
    openingLower,
    openingUpper,
    depthLower,
    depthOpeningRatioLower,
    removedAreaLower,
    removedBodyShareLower: removedAreaLower / bodyArea,
    originDistance,
    witnessLineDistance: witnessDistance,
    checkedVertices,
  };
}
