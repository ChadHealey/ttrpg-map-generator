/** Pure diagnostic arithmetic, never a new semantic policy or role certificate. */
import assert from 'node:assert/strict';

import { hash } from './runtime.mjs';
export const POLAR_TICK_CUTOFF = 715827883;
export const digest = (x) => hash(JSON.stringify(x));
const area = (p) =>
  Math.abs(
    p.reduce((s, a, i) => {
      const b = p[(i + 1) % p.length];
      return s + a[0] * b[1] - a[1] * b[0];
    }, 0),
  ) / 2;
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
export function hull(points) {
  assert(points.length >= 3 && points.every((p) => p.length === 2 && p.every(Number.isFinite)));
  const p = [...new Map(points.map((p) => [JSON.stringify(p), p])).values()].sort(
    (a, b) => a[0] - b[0] || a[1] - b[1],
  );
  const half = (items) => {
    const result = [];
    for (const p of items) {
      while (result.length >= 2 && cross(result.at(-2), result.at(-1), p) <= 0) result.pop();
      result.push(p);
    }
    return result;
  };
  return [...half(p).slice(0, -1), ...half([...p].reverse()).slice(0, -1)];
}
export function fragmentation(owners) {
  const primary = owners
    .filter((o) => o.primary)
    .map((o) => {
      const body = o.candidate.bodyBoundary,
        bodyArea = area(body),
        hullArea = area(hull(body));
      assert(bodyArea > 0 && hullArea >= bodyArea - 1e-12);
      return {
        id: o.id,
        quota: o.quota,
        bodySha256: digest(body),
        quotaNormalizedBodySha256: digest(body.map((p) => p.map((x) => x / Math.sqrt(o.quota)))),
        bodyArea,
        hullArea,
        hullDeficit: 1 - bodyArea / hullArea,
      };
    });
  assert(primary.length > 0);
  return {
    primary,
    quotaWeightedHullDeficit:
      primary.reduce((s, o) => s + o.quota * o.hullDeficit, 0) /
      primary.reduce((s, o) => s + o.quota, 0),
    scope:
      'LAEA body concavity; excludes detached islands; not spherical coast length or semantic fragmentation',
  };
}
export function ratio(numerator, denominator) {
  assert(
    Number.isSafeInteger(numerator) &&
      numerator >= 0 &&
      Number.isSafeInteger(denominator) &&
      denominator > 0 &&
      numerator <= denominator,
  );
  return {
    numerator: String(numerator),
    denominator: String(denominator),
    fraction: numerator / denominator,
  };
}
export function compareRatio(a, b) {
  const n =
    BigInt(a.numerator) * BigInt(b.denominator) - BigInt(b.numerator) * BigInt(a.denominator);
  return n < 0n ? -1 : n > 0n ? 1 : 0;
}
export function polarComparison(ocean, neutral, land) {
  if (!ocean || !neutral || !land) return { status: 'not-evaluated-incomplete-pair' };
  const comparisons = Object.fromEntries(
    ['north', 'south', 'combined'].map((key) => [
      key,
      {
        oceanVsNeutral: compareRatio(ocean[key], neutral[key]),
        landVsNeutral: compareRatio(land[key], neutral[key]),
        oceanDelta: ocean[key].fraction - neutral[key].fraction,
        landDelta: land[key].fraction - neutral[key].fraction,
      },
    ]),
  );
  return {
    status: 'evaluated',
    comparisons,
    necessaryDirectionPass:
      comparisons.combined.oceanVsNeutral < 0 &&
      comparisons.combined.landVsNeutral > 0 &&
      ['north', 'south'].every(
        (k) => comparisons[k].oceanVsNeutral <= 0 && comparisons[k].landVsNeutral >= 0,
      ),
    generalMonotonicityProved: false,
    visualEffectThresholdSelected: false,
  };
}
export function oceanPredicate(result, mode) {
  assert(['singleGlobal', 'connectedMajority', 'multipleBasins'].includes(mode));
  if (!result.ok)
    return { status: 'semantic-mode-unsupported', reason: result.reason, pass: false };
  const regions = result.regions,
    open = regions.filter((r) => r.enclosure === 'open-marine'),
    byId = new Map(open.map((r) => [r.analysisIndex, r]));
  const errors = [],
    seen = new Set(),
    components = [];
  if (byId.size !== open.length || !open.length) errors.push('empty-or-duplicate-open-regions');
  for (const r of regions) {
    if (!Number.isSafeInteger(r.sphericalAreaWeight) || r.sphericalAreaWeight < 0)
      errors.push('invalid-region-area');
    if (
      r.enclosure === 'enclosed' &&
      (r.waterBodyKind !== 'sea' || r.connectedRegionIndices.length)
    )
      errors.push('invalid-enclosed-sea');
    for (const id of r.connectedRegionIndices)
      if (
        !byId.has(id) ||
        id === r.analysisIndex ||
        !byId.get(id).connectedRegionIndices.includes(r.analysisIndex)
      )
        errors.push('invalid-or-nonreciprocal-link');
  }
  for (const start of open) {
    if (seen.has(start.analysisIndex)) continue;
    const queue = [start.analysisIndex],
      members = [];
    seen.add(start.analysisIndex);
    while (queue.length) {
      const r = byId.get(queue.shift());
      members.push(r);
      for (const id of r.connectedRegionIndices)
        if (byId.has(id) && !seen.has(id)) {
          seen.add(id);
          queue.push(id);
        }
    }
    const roots = members.filter((r) => r.waterBodyKind === 'oceanBasin').length;
    if (roots !== 1) errors.push('root-count-not-one');
    components.push({
      regionIndices: members.map((r) => r.analysisIndex).sort((a, b) => a - b),
      rootCount: roots,
      areaWeight: members.reduce((s, r) => s + r.sphericalAreaWeight, 0),
    });
  }
  const total = open.reduce((s, r) => s + r.sphericalAreaWeight, 0),
    largest = components.reduce((m, c) => Math.max(m, c.areaWeight), 0);
  const biggest = [...open].sort(
    (a, b) =>
      b.sphericalAreaWeight - a.sphericalAreaWeight ||
      (a.sampleRanges[0]?.startIndex ?? 0) - (b.sampleRanges[0]?.startIndex ?? 0),
  )[0];
  const rootCount = open.filter((r) => r.waterBodyKind === 'oceanBasin').length;
  if (mode === 'multipleBasins') {
    if (open.length < 2 || rootCount !== open.length || components.length < 2)
      errors.push('multiple-basin-roots-unsatisfied');
  } else if (
    biggest?.waterBodyKind !== 'oceanBasin' ||
    (mode === 'singleGlobal' && rootCount !== 1)
  )
    errors.push('largest-region-root-unsatisfied');
  if (mode === 'singleGlobal' && components.length !== 1) errors.push('single-global-unsatisfied');
  if (mode === 'connectedMajority' && !(total > 0 && BigInt(largest) * 100n >= BigInt(total) * 90n))
    errors.push('connected-majority-unsatisfied');
  return {
    status: errors.length ? 'semantic-predicate-failure' : 'semantic-outcome-pass',
    pass: !errors.length,
    errors,
    allocatedOpenRegionCount: open.length,
    clearanceCoreCount:
      open.length >= 2 ? { exact: open.length } : { exact: null, possible: [0, 1] },
    enclosedRegionCount: regions.length - open.length,
    basinRootCount: rootCount,
    components,
    largestOpenComponentShare: total > 0 ? ratio(largest, total) : null,
    scope: 'Unchanged policy-1 allocated regions; no fabricated raw clearance labels or EntityIds',
  };
}
