/** Author a whole coast first; partition only at the candidate's predeclared indices. */
import { signedArea } from '../issue-169/geometry.mjs';

const validPoint = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
export function sampleCoast(anchors, { steps = 3, tension = 0.16 } = {}) {
  if (
    !Array.isArray(anchors) ||
    anchors.length < 6 ||
    anchors.length > 80 ||
    !anchors.every(validPoint) ||
    !Number.isInteger(steps) ||
    steps < 1 ||
    steps > 4 ||
    anchors.length * steps > 180 ||
    !Number.isFinite(tension) ||
    tension < 0 ||
    tension > 0.25
  )
    throw new RangeError('Invalid bounded coast sampling');
  const n = anchors.length,
    coast = [];
  for (let i = 0; i < n; i++) {
    const a = anchors[i],
      b = anchors[(i + 1) % n],
      prev = anchors[(i + n - 1) % n],
      next = anchors[(i + 2) % n];
    const c = a.map((v, k) => v + tension * (b[k] - prev[k])),
      d = b.map((v, k) => v - tension * (next[k] - a[k]));
    for (let j = 0; j < steps; j++) {
      const t = j / steps,
        u = 1 - t;
      coast.push(
        j === 0
          ? [...a]
          : [0, 1].map(
              (k) =>
                u * u * u * a[k] + 3 * u * u * t * c[k] + 3 * u * t * t * d[k] + t * t * t * b[k],
            ),
      );
    }
  }
  return coast;
}

export function partitionCoast(id, { coast, roles, bay, interiorWitness, islandAnchors = [] }) {
  if (
    typeof id !== 'string' ||
    !id ||
    !Array.isArray(coast) ||
    coast.length < 6 ||
    coast.length > 180 ||
    !coast.every(validPoint) ||
    !Array.isArray(roles) ||
    roles.length > 8 ||
    !validPoint(interiorWitness) ||
    !Array.isArray(islandAnchors) ||
    islandAnchors.length > 6
  )
    throw new RangeError('Invalid declared coast partition');
  const n = coast.length,
    index = (i) => Number.isInteger(i) && i >= 0 && i < n;
  const interval = (start, end) => {
    if (!index(start) || !index(end) || start === end)
      throw new RangeError('Invalid coast interval');
    return Array.from({ length: ((end - start + n) % n) + 1 }, (_, j) => (start + j) % n);
  };
  const occupied = new Set(),
    removed = new Set();
  const attachments = roles.map((role, i) => {
    if (
      !role ||
      !['lobe', 'peninsula'].includes(role.kind) ||
      !Array.isArray(role.far) ||
      role.far.length !== 2 ||
      !validPoint(role.disk)
    )
      throw new RangeError('Invalid role witness');
    const indices = interval(role.start, role.end);
    if (
      indices.length < 4 ||
      indices.some((j) => occupied.has(j)) ||
      !role.far.every((j) => index(j) && indices.slice(1, -1).includes(j)) ||
      role.far[0] === role.far[1]
    )
      throw new RangeError('Overlapping or invalid fixed role intervals');
    for (const j of indices) occupied.add(j);
    for (const j of indices.slice(1, -1)) removed.add(j);
    return {
      id: `${id}/${role.kind}-${i}`,
      kind: role.kind,
      root: [coast[role.start], coast[role.end]],
      polygon: indices.map((j) => coast[j]),
      collar: { far: role.far.map((j) => coast[j]), disk: [...role.disk] },
    };
  });
  let pocket = null;
  if (bay) {
    const indices = interval(bay.start, bay.end);
    if (indices.length < 3 || indices.some((j) => occupied.has(j)) || !validPoint(bay.witness))
      throw new RangeError('Invalid protected bay interval');
    pocket = {
      polygon: indices.map((j) => coast[j]),
      mouth: [coast[bay.start], coast[bay.end]],
      witness: [...bay.witness],
    };
  }
  if (!islandAnchors.every(index)) throw new RangeError('Invalid margin anchor index');
  const ccw = signedArea(coast) > 0;
  return {
    interior: coast.filter((_, i) => !removed.has(i)),
    interiorWitness: [...interiorWitness],
    attachments,
    bay: pocket,
    islandAnchorEdges: islandAnchors.map((i) =>
      ccw ? [coast[i], coast[(i + 1) % n]] : [coast[(i + 1) % n], coast[i]],
    ),
  };
}
