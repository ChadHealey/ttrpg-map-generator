/** Fixed four-piece authored bay splice; sampled polygons are authoritative. */
const point = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
const add = (p, q, scale) => p.map((x, k) => x + scale * q[k]);
const subtract = (p, q) => p.map((x, k) => x - q[k]);
/** Include both exact endpoints. Interior values use the declared cubic formula. */
export function cubicSamples(control, steps) {
  if (
    !Array.isArray(control) ||
    control.length !== 4 ||
    !control.every(point) ||
    !Number.isInteger(steps) ||
    steps < 1 ||
    steps > 8
  )
    throw new RangeError('Invalid fixed cubic');
  const [a, b, c, d] = control;
  return Array.from({ length: steps + 1 }, (_, i) => {
    if (i === 0) return a;
    if (i === steps) return d;
    const t = i / steps,
      u = 1 - t;
    return [0, 1].map(
      (k) => u * u * u * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t * t * t * d[k],
    );
  });
}
export function spliceCoast(old, { start, end, first, second }) {
  if (
    !Array.isArray(old) ||
    old.length < 6 ||
    old.length > 180 ||
    !old.every(point) ||
    ![start, end].every((i) => Number.isInteger(i) && i >= 0 && i < old.length) ||
    start === end ||
    !Array.isArray(first) ||
    !Array.isArray(second) ||
    first.length !== 4 ||
    second.length !== 4 ||
    ![...first, ...second].every(point) ||
    first[3].some((x, k) => x !== second[0][k])
  )
    throw new RangeError('Invalid declared coast splice');
  const n = old.length,
    e0 = old[start],
    e1 = old[end],
    prev = old[(start + n - 1) % n],
    next = old[(end + 1) % n];
  const a = first[0],
    b = second[3];
  const pieces = [
    [e0, add(e0, subtract(e0, prev), 0.5), add(a, subtract(first[1], a), -0.35), a],
    first,
    second,
    [b, add(b, subtract(b, second[2]), 0.35), add(e1, subtract(next, e1), -0.5), e1],
  ];
  const coast = pieces.flatMap((p, i) => cubicSamples(p, [4, 8, 8, 4][i]).slice(i === 0 ? 0 : 1));
  const indexMap = Array(n).fill(null);
  indexMap[start] = 0;
  indexMap[end] = 24;
  for (let i = (end + 1) % n; i !== start; i = (i + 1) % n) {
    indexMap[i] = coast.length;
    coast.push(old[i]);
  }
  if (coast.length > 180) throw new RangeError('Splice exceeds frozen partition budget');
  return { coast, indexMap, mouth: [4, 20], pieces };
}
export function retainedIndex(splice, index) {
  const value = splice.indexMap[index];
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= splice.indexMap.length ||
    !Number.isInteger(value)
  )
    throw new RangeError('Reference to removed coast sample');
  return value;
}
export function remapRoles(splice, roles) {
  return roles.map((role) => ({
    ...role,
    start: retainedIndex(splice, role.start),
    end: retainedIndex(splice, role.end),
    far: role.far.map((i) => retainedIndex(splice, i)),
  }));
}
export function remapSites(splice, sites) {
  return sites.map((i) => {
    const start = retainedIndex(splice, i),
      end = retainedIndex(splice, (i + 1) % splice.indexMap.length);
    if ((start + 1) % splice.coast.length !== end)
      throw new RangeError('Site edge crosses replaced coast');
    return start;
  });
}
