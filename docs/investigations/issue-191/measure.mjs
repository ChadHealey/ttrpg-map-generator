/** Sample-only area and exact 3D nearest-pair gap; no anatomy certification. */
import { dot } from './placement.mjs';
function tree(indices, points) {
  const lo = [Infinity, Infinity, Infinity],
    hi = [-Infinity, -Infinity, -Infinity];
  for (const index of indices)
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], points[index][k]);
      hi[k] = Math.max(hi[k], points[index][k]);
    }
  if (indices.length <= 32) return { lo, hi, indices, size: indices.length };
  const widths = hi.map((v, k) => v - lo[k]),
    axis = widths.indexOf(Math.max(...widths));
  indices.sort((a, b) => points[a][axis] - points[b][axis] || a - b);
  const mid = Math.floor(indices.length / 2);
  return {
    lo,
    hi,
    size: indices.length,
    left: tree(indices.slice(0, mid), points),
    right: tree(indices.slice(mid), points),
  };
}
function lower(a, b) {
  let d = 0;
  for (let k = 0; k < 3; k++) d += Math.max(0, a.lo[k] - b.hi[k], b.lo[k] - a.hi[k]) ** 2;
  return d;
}
export function nearestGap(groups, points) {
  const trees = groups.map((ids) => (ids.length ? tree(ids, points) : null));
  let best = 4,
    visits = 0,
    pair = null;
  function visit(a, b) {
    if (++visits > 20000000) throw new Error('gap.node-budget-exhausted');
    if (lower(a, b) >= best) return;
    if (a.indices && b.indices) {
      for (const i of a.indices)
        for (const j of b.indices) {
          const d = points[i].reduce((s, v, k) => s + (v - points[j][k]) ** 2, 0);
          if (d < best) {
            best = d;
            pair = [i, j];
          }
        }
      return;
    }
    const splitA = !a.indices && (b.indices || a.size >= b.size);
    const pairs = splitA
      ? [
          [a.left, b],
          [a.right, b],
        ]
      : [
          [a, b.left],
          [a, b.right],
        ];
    pairs.sort((p, q) => lower(...p) - lower(...q));
    for (const p of pairs) visit(...p);
  }
  for (let i = 0; i < trees.length; i++)
    for (let j = i + 1; j < trees.length; j++) if (trees[i] && trees[j]) visit(trees[i], trees[j]);
  return {
    minimumRad: pair ? 2 * Math.asin(Math.min(1, Math.sqrt(best) / 2)) : null,
    anchorPair: pair,
    nodeVisits: visits,
  };
}
export function measure(field, grid, samples) {
  const labels = new Int8Array(samples.length).fill(-1),
    groups = field.owners.map(() => []),
    areas = field.owners.map(() => 0);
  let outside = 0;
  for (let i = 0; i < samples.length; i++)
    if (samples.at(i) === 'land') {
      const owner = field.owners.findIndex(
        (o) => dot(o.center, grid.points[i]) > Math.cos(o.guard),
      );
      if (owner < 0) {
        outside++;
        continue;
      }
      labels[i] = owner;
      groups[owner].push(i);
      areas[owner] += grid.weights[i];
    }
  const { longitudeCellCount: w, latitudeBandCount: h } = grid.profile;
  const seen = new Uint8Array(samples.length),
    queue = new Int32Array(samples.length),
    mainAreas = areas.map(() => 0);
  const index = (x, y) =>
    y === 0 ? 0 : y === h ? samples.length - 1 : 1 + (y - 1) * w + ((x + w) % w);
  for (let start = 0; start < labels.length; start++) {
    if (labels[start] < 0 || seen[start]) continue;
    let head = 0,
      tail = 1,
      area = 0;
    queue[0] = start;
    seen[start] = 1;
    const enqueue = (at) => {
      if (!seen[at] && labels[at] === labels[start]) {
        seen[at] = 1;
        queue[tail++] = at;
      }
    };
    while (head < tail) {
      const at = queue[head++];
      area += grid.weights[at];
      if (at === 0 || at === labels.length - 1) {
        for (let x = 0; x < w; x++) enqueue(index(x, at === 0 ? 1 : h - 1));
      } else {
        const y = Math.floor((at - 1) / w) + 1,
          x = (at - 1) % w;
        enqueue(index(x - 1, y));
        enqueue(index(x + 1, y));
        enqueue(index(x, y - 1));
        enqueue(index(x, y + 1));
      }
    }
    mainAreas[labels[start]] = Math.max(mainAreas[labels[start]], area);
  }
  const largest = Math.max(...mainAreas),
    gap = nearestGap(groups, grid.points);
  return {
    outsideOwnerLandAnchors: outside,
    gap,
    primaryCountByArea: mainAreas.filter((a) => a > 0 && a >= largest / 2).length,
    owners: field.owners.map((o, i) => ({
      id: o.id,
      quota: o.quota,
      realized: areas[i] / grid.totalWeight,
      errorBp: Math.abs(areas[i] / grid.totalWeight - o.quota) * 10000,
      mainBodyArea: mainAreas[i] / grid.totalWeight,
      islandReserve: o.reserve,
    })),
    poles: { south: samples.at(0), north: samples.at(samples.length - 1) },
  };
}
