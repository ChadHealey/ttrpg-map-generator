/** Canonical public-address lattice, weighted quota calibration, exact identity receipts. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
export function lattice(runtime, profile) {
  const { generation: g, policy, core } = runtime,
    width = profile.longitudeCellCount,
    height = profile.latitudeBandCount;
  const points = [],
    weights = [];
  const add = (x, y) => {
    const p = g.getAtlasGridVertex(profile, x, y);
    points.push(policy.vector(p));
    weights.push(
      y === 0 || y === height
        ? 0
        : core.roundTiesAwayFromZero(Math.cos(core.planetPointToAngles(p).latitudeRad) * 2 ** 20),
    );
  };
  add(0, 0);
  for (let y = 1; y < height; y++) for (let x = 0; x < width; x++) add(x, y);
  add(0, height);
  return { profile, points, weights, totalWeight: weights.reduce((a, b) => a + b, 0) };
}
export function calibrate(field, grid) {
  const lists = field.owners.map(() => []);
  grid.points.forEach((point, index) => {
    const s = field.score(point);
    if (s.owner >= 0 && s.score > 0)
      lists[s.owner].push({ index, score: s.score, weight: grid.weights[index] });
  });
  const cutoffs = [],
    failures = [];
  lists.forEach((list, i) => {
    list.sort((a, b) => b.score - a.score || a.index - b.index);
    const target = field.owners[i].quota * grid.totalWeight;
    let sum = 0,
      index = 0;
    while (index < list.length && sum < target) {
      sum += list[index].weight;
      index++;
    }
    if (sum < target || index === list.length || index === 0) {
      failures.push(`quota.capacity.${i}`);
      cutoffs.push(1);
      return;
    }
    cutoffs.push((list[index - 1].score + list[index].score) / 2);
  });
  return { ok: failures.length === 0, cutoffs, failures };
}
export function tickHash(field) {
  const bytes = Buffer.alloc(field.sampleCount * 4);
  let index = 0;
  const height = field.profile.latitudeBandCount,
    width = field.profile.longitudeCellCount;
  for (let y = 0; y <= height; y++) {
    const count = y === 0 || y === height ? 1 : width;
    for (let x = 0; x < count; x++) bytes.writeInt32BE(field.valueAt(x, y), 4 * index++);
  }
  return createHash('sha256').update(bytes).digest('hex');
}
export function identities(runtime, preview, full) {
  const g = runtime.generation,
    profile = preview.profile;
  let shared = 0;
  for (let y = 0; y <= profile.latitudeBandCount; y++) {
    const count = y === 0 || y === profile.latitudeBandCount ? 1 : profile.longitudeCellCount;
    for (let x = 0; x < count; x++) {
      if (full) {
        const a = g.getFullProfileAddressForPreview(x, y);
        assert.equal(preview.valueAt(x, y), full.valueAt(a.longitudeIndex, a.latitudeIndex));
      }
      shared++;
    }
  }
  for (const f of [preview, full].filter(Boolean)) {
    const p = f.profile;
    for (const y of [0, p.latitudeBandCount])
      for (let x = 0; x < p.longitudeCellCount; x++) {
        assert.deepEqual(g.getAtlasGridVertex(p, x, y), g.getAtlasGridVertex(p, 0, y));
        assert.equal(f.valueAt(x, y), f.valueAt(0, y));
      }
    for (let y = 1; y < p.latitudeBandCount; y++) {
      const left = g.getAtlasGridVertex(p, 0, y);
      const right = runtime.core.createPlanetPoint(
        Math.PI,
        runtime.core.planetPointToAngles(left).latitudeRad,
      );
      assert(right.ok);
      assert.deepEqual(right.value, left);
    }
  }
  return {
    sharedAnchors: full ? shared : 0,
    sharedTickError: full ? 0 : null,
    seamIdentity: true,
    uniquePoleSamples: 2,
  };
}
