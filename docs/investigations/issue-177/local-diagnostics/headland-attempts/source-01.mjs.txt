/** Investigation-only planar predicates and the unit-sphere equal-area chart. */
export const EPS = 1e-10;
export const samePoint = (a, b) => a[0] === b[0] && a[1] === b[1];
export const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
export const edges = (polygon) => polygon.map((p, i) => [p, polygon[(i + 1) % polygon.length]]);
export function signedArea(polygon) {
  return edges(polygon).reduce((sum, [a, b]) => sum + a[0] * b[1] - a[1] * b[0], 0) / 2;
}
export const polygonArea = (polygon) => Math.abs(signedArea(polygon));
export function distanceToSegment(p, a, b) {
  const x = b[0] - a[0],
    y = b[1] - a[1];
  const lengthSquared = x * x + y * y;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((p[0] - a[0]) * x + (p[1] - a[1]) * y) / lengthSquared));
  return Math.hypot(p[0] - a[0] - t * x, p[1] - a[1] - t * y);
}
export const minBoundaryDistance = (p, polygon) =>
  Math.min(...edges(polygon).map(([a, b]) => distanceToSegment(p, a, b)));
function rayInside(p, polygon) {
  let inside = false;
  for (const [a, b] of edges(polygon)) {
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < a[0] + ((p[1] - a[1]) * (b[0] - a[0])) / (b[1] - a[1])
    )
      inside = !inside;
  }
  return inside;
}
/** -1 outside, 0 on/within EPS of boundary, 1 strictly inside. */
export function pointLocation(p, polygon) {
  if (minBoundaryDistance(p, polygon) <= EPS) return 0;
  return rayInside(p, polygon) ? 1 : -1;
}
export const pointInPolygon = (p, polygon) => pointLocation(p, polygon) >= 0;
/** Positive inside; callers supply certified disjoint components, not overlapping polygons. */
export function signedDistance(p, polygons) {
  return polygons.reduce((value, polygon) => {
    const d = minBoundaryDistance(p, polygon);
    return Math.max(value, d === 0 ? 0 : rayInside(p, polygon) ? d : -d);
  }, -Infinity);
}
/** Near-contact is reported as contact so certificate callers can reject ambiguity. */
export function segmentRelation(a, b, c, d) {
  for (let axis = 0; axis < 2; axis++) {
    if (
      Math.max(a[axis], b[axis]) < Math.min(c[axis], d[axis]) - EPS ||
      Math.max(c[axis], d[axis]) < Math.min(a[axis], b[axis]) - EPS
    )
      return 'none';
  }
  const values = [orient(a, b, c), orient(a, b, d), orient(c, d, a), orient(c, d, b)];
  if (values[0] * values[1] < 0 && values[2] * values[3] < 0) return 'cross';
  if (values.every((v) => Math.abs(v) <= EPS)) {
    const axis = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? 0 : 1;
    const overlap =
      Math.min(Math.max(a[axis], b[axis]), Math.max(c[axis], d[axis])) -
      Math.max(Math.min(a[axis], b[axis]), Math.min(c[axis], d[axis]));
    return overlap > EPS ? 'overlap' : overlap >= -EPS ? 'touch' : 'none';
  }
  if (
    Math.min(
      distanceToSegment(a, c, d),
      distanceToSegment(b, c, d),
      distanceToSegment(c, a, b),
      distanceToSegment(d, a, b),
    ) <= EPS
  )
    return 'touch';
  return 'none';
}
export function isSimplePolygon(polygon) {
  if (polygon.length < 3 || polygonArea(polygon) <= EPS) return false;
  const segments = edges(polygon);
  for (let i = 0; i < segments.length; i++) {
    const [a, b] = segments[i];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) <= EPS) return false;
    for (let j = i + 1; j < segments.length; j++) {
      const relation = segmentRelation(a, b, ...segments[j]);
      const adjacent = j === i + 1 || (i === 0 && j === segments.length - 1);
      if (relation !== 'none' && (!adjacent || relation !== 'touch')) return false;
    }
  }
  return true;
}
export function sharedEdge(a, b, c, d) {
  return (samePoint(a, c) && samePoint(b, d)) || (samePoint(a, d) && samePoint(b, c));
}
export const hasEdge = (polygon, a, b) => edges(polygon).some(([c, d]) => sharedEdge(a, b, c, d));
/** Stitch polygons along exactly shared edges; invalid graphs throw instead of being repaired. */
export function stitchBody(interior, attachments) {
  const polygons = [interior, ...attachments.map((a) => a.polygon)];
  const boundary = [];
  for (const polygon of polygons) {
    const ring = signedArea(polygon) < 0 ? [...polygon].reverse() : polygon;
    for (const [a, b] of edges(ring)) {
      const reverse = boundary.findIndex(([c, d]) => samePoint(a, d) && samePoint(b, c));
      if (reverse >= 0) boundary.splice(reverse, 1);
      else boundary.push([a, b]);
    }
  }
  if (!boundary.length) throw new Error('Empty stitched boundary');
  const result = [],
    start = boundary[0][0];
  let at = start;
  for (let step = 0; boundary.length && step <= 256; step++) {
    const next = boundary.map(([a], i) => (samePoint(a, at) ? i : -1)).filter((i) => i >= 0);
    if (next.length !== 1) throw new Error('Ambiguous stitched boundary');
    result.push(at);
    const edge = boundary.splice(next[0], 1)[0];
    at = edge[1];
    if (samePoint(at, start)) break;
  }
  if (boundary.length || !samePoint(at, start) || !isSimplePolygon(result))
    throw new Error('Disconnected or non-simple stitched boundary');
  return result;
}
export function inverseLambert([x, y]) {
  const radiusSquared = x * x + y * y;
  if (!Number.isFinite(radiusSquared) || radiusSquared >= 4)
    throw new RangeError('Outside Lambert chart');
  const scale = Math.sqrt(1 - radiusSquared / 4);
  return [x * scale, y * scale, 1 - radiusSquared / 2];
}
export function forwardLambert([x, y, z]) {
  if (![x, y, z].every(Number.isFinite) || z <= -1 || Math.abs(Math.hypot(x, y, z) - 1) > 1e-9)
    throw new RangeError('Invalid unit vector or chart antipode');
  const scale = Math.sqrt(2 / (1 + z));
  return [x * scale, y * scale];
}
export function scaleCandidate(candidate, scale) {
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError('Invalid candidate scale');
  const point = (p) => [p[0] * scale, p[1] * scale];
  const polygon = (p) => p.map(point);
  return {
    ...candidate,
    interior: polygon(candidate.interior),
    interiorWitness: point(candidate.interiorWitness),
    bodyBoundary: polygon(candidate.bodyBoundary),
    attachments: candidate.attachments.map((a) => ({
      ...a,
      polygon: polygon(a.polygon),
      root: a.root.map(point),
      collarHeight: a.collarHeight * scale,
    })),
    bay: candidate.bay
      ? {
          ...candidate.bay,
          polygon: polygon(candidate.bay.polygon),
          mouth: candidate.bay.mouth.map(point),
          witness: point(candidate.bay.witness),
        }
      : null,
    islands: candidate.islands.map((i) => ({ ...i, polygon: polygon(i.polygon) })),
  };
}
