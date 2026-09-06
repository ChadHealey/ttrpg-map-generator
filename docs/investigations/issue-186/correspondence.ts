/** Transient raw anchor membership and explicit simplification predecessor; no semantic IDs. */
import {
  getAtlasSampleStorageIndex,
  type ProposedPlanetRing,
  type QuantizedSphericalField,
} from '@ttrpg-map/generation';

import type { Policy } from './policy.js';
export type Digest = (bytes: Uint8Array) => string;
export function componentGraph(field: QuantizedSphericalField, policy: Policy, digest: Digest) {
  const n = field.sampleCount,
    w = field.profile.longitudeCellCount,
    h = field.profile.latitudeBandCount,
    parent = new Int32Array(n).fill(-1),
    expectedTransitions = new Set<string>();
  const id = (x: number, y: number) => getAtlasSampleStorageIndex(field.profile, x, y);
  for (let y = 0; y <= h; y++)
    for (let x = 0; x < (y === 0 || y === h ? 1 : w); x++) {
      const i = id(x, y);
      if (field.valueAt(x, y) > 0) parent[i] = i;
    }
  const find = (input: number): number => {
    let p = input;
    while (parent[p] !== p) {
      const q = parent[p];
      if (q === undefined || q < 0) throw new RangeError('Missing land anchor');
      p = q;
    }
    let i = input;
    while (i !== p) {
      const q = parent[i];
      if (q === undefined) throw new RangeError('Missing member');
      parent[i] = p;
      i = q;
    }
    return p;
  };
  const edge = (a: number, b: number) => {
    const pa = parent[a],
      pb = parent[b];
    if (pa === undefined || pb === undefined) throw new RangeError('Invalid edge');
    if (pa >= 0 && pb >= 0) {
      const ra = find(a),
        rb = find(b);
      parent[Math.max(ra, rb)] = Math.min(ra, rb);
    } else if (pa >= 0 || pb >= 0)
      expectedTransitions.add(pa >= 0 ? `${String(a)}:${String(b)}` : `${String(b)}:${String(a)}`);
  };
  for (let y = 1; y < h; y++)
    for (let x = 0; x < w; x++) {
      edge(id(x, y), id((x + 1) % w, y));
      edge(id(x, y), id(x, y - 1));
      if (y === h - 1) edge(id(x, y), id(0, h));
    }
  for (let y = 1; y < h - 1; y++)
    for (let x = 0; x < w; x++) {
      const coords = [
        [x, y],
        [(x + 1) % w, y],
        [(x + 1) % w, y + 1],
        [x, y + 1],
      ] as const;
      const v = coords.map(([a, b]) => field.valueAt(a, b));
      const [a, b, c, d] = v;
      if (a === undefined || b === undefined || c === undefined || d === undefined)
        throw new Error('Missing cell');
      if (a > 0 === c > 0 && b > 0 === d > 0 && a > 0 !== b > 0) {
        const offset = policy === 'H' ? 1 : 0;
        const det =
          BigInt(2 * a - offset) * BigInt(2 * c - offset) -
          BigInt(2 * b - offset) * BigInt(2 * d - offset);
        if ((det >= 0n && a > 0) || (det < 0n && b > 0)) {
          const first = det >= 0n ? coords[0] : coords[1],
            second = det >= 0n ? coords[2] : coords[3];
          edge(id(...first), id(...second));
        }
      }
    }
  const members = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    if ((parent[i] ?? -1) < 0) continue;
    const root = find(i);
    let list = members.get(root);
    if (!list) {
      list = [];
      members.set(root, list);
    }
    list.push(i);
  }
  const components = new Map(
    [...members].map(([root, list]) => {
      const bytes = new Uint8Array(list.length * 4),
        view = new DataView(bytes.buffer);
      list.forEach((i, k) => {
        view.setUint32(k * 4, i, true);
      });
      return [root, { key: `private-anchor-component:${digest(bytes)}`, anchorCount: list.length }];
    }),
  );
  return {
    componentAt: (i: number) =>
      Number.isSafeInteger(i) && i >= 0 && i < n && (parent[i] ?? -1) >= 0
        ? components.get(find(i))
        : undefined,
    components: [...components.values()],
    expectedTransitions,
  };
}
export function ringCorrespondence(
  rings: readonly ProposedPlanetRing[],
  graph: ReturnType<typeof componentGraph>,
  digest: Digest,
) {
  const failures: string[] = [],
    seen = new Set<string>();
  const records = rings.map((ring, index) => {
    const keys = new Set<string>();
    if (
      ring.sourceTransitions?.length !== ring.points.length ||
      ring.leftLandSampleIndices?.length !== ring.points.length
    )
      failures.push('raw-source-array-missing');
    for (const t of ring.sourceTransitions ?? []) {
      const key = `${String(t.landSampleIndex)}:${String(t.waterSampleIndex)}`;
      if (!graph.expectedTransitions.has(key) || seen.has(key))
        failures.push('raw-transition-coverage');
      seen.add(key);
      const c = graph.componentAt(t.landSampleIndex);
      if (c) keys.add(c.key);
      else failures.push('raw-land-membership-missing');
    }
    for (const i of ring.leftLandSampleIndices ?? []) {
      const c = graph.componentAt(i);
      if (c) keys.add(c.key);
      else failures.push('raw-left-membership-missing');
    }
    if (keys.size !== 1) failures.push('ambiguous-raw-component');
    return {
      rawIndex: index,
      rawPredecessorKey: `private-raw-ring:${String(index)}:${digest(new TextEncoder().encode(JSON.stringify(ring)))}`,
      componentKey: keys.size === 1 ? [...keys][0] : null,
      vertexCount: ring.points.length,
    };
  });
  if (seen.size !== graph.expectedTransitions.size) failures.push('raw-transition-coverage');
  const represented = new Set(records.map((r) => r.componentKey));
  for (const c of graph.components)
    if (!represented.has(c.key)) failures.push('sampled-component-without-ring');
  return { components: graph.components, rings: records, failures: [...new Set(failures)] };
}
export function validateSimplifiedPredecessor(
  raw: ProposedPlanetRing,
  simplified: ProposedPlanetRing,
): boolean {
  if (
    simplified.points.length < 3 ||
    !raw.sourceTransitions ||
    simplified.points.length !== simplified.sourceTransitions?.length
  )
    return false;
  const token = (ring: ProposedPlanetRing, i: number) =>
    JSON.stringify([ring.points[i], ring.sourceTransitions?.[i]]);
  const old = raw.points.map((_, i) => token(raw, i)),
    reduced = simplified.points.map((_, i) => token(simplified, i));
  const start = old.indexOf(reduced[0] ?? '');
  if (start < 0 || old.lastIndexOf(reduced[0] ?? '') !== start) return false;
  let cursor = 0;
  for (const key of reduced) {
    while (cursor < old.length && old[(start + cursor) % old.length] !== key) cursor++;
    if (cursor >= old.length) return false;
    cursor++;
  }
  return true;
}
