import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { rows, sweep } from './corpus.mjs';
import { createField, quotas } from './field.mjs';
import { calibrate } from './lattice.mjs';
import { nearestGap } from './measure.mjs';
import { streams } from './streams.mjs';
const p = JSON.parse(await readFile(new URL('./state-1.json', import.meta.url), 'utf8'));
const synthetic = (patch = {}) => ({
  id: 'synthetic',
  seed: 'test-only-not-corpus',
  controls: { ...rows[0].controls, ...patch },
});
describe('private structured field invariants (synthetic only)', () => {
  it('freezes exact eighteen rows and all 128 sweep seeds', () => {
    expect(rows).toHaveLength(18);
    expect(sweep).toHaveLength(128);
    expect(rows.slice(6)).toEqual(sweep.slice(0, 12));
    expect(sweep.map((r) => r.seed)).toEqual(
      Array.from({ length: 128 }, (_, i) => String(180000000000000001n + BigInt(i))),
    );
  });
  it('preserves count 1..8 and sums immutable distribution quotas', () => {
    for (let n = 1; n <= 8; n++)
      for (const distribution of ['balanced', 'varied', 'oneDominant']) {
        const input = synthetic({ continentCountIntent: n, continentDistribution: distribution });
        const q = quotas(input, p, streams(input.seed));
        expect(q).toHaveLength(n);
        expect(q.reduce((s, o) => s + o.quota, 0)).toBeCloseTo(0.35, 14);
        if (distribution === 'balanced') expect(new Set(q.map((o) => o.quota)).size).toBe(1);
        if (distribution === 'oneDominant' && n > 1)
          expect(q[0].quota / q[1].quota).toBeCloseTo(5, 14);
      }
  });
  it('has no land in a minimum-gap corridor at any tested legal contour', () => {
    const f = createField(synthetic({ continentCountIntent: 2, polarCharacter: 'oceanBiased' }), p);
    expect(f.ok).toBe(true);
    // Cap centers separated by exactly radius+radius+0.05. A 0.05 guard reserve on each side.
    const separation = 1.25;
    for (let i = 0; i < 2; i++) {
      const a = i * separation;
      Object.assign(f.owners[i], {
        radius: 0.6,
        guard: 0.55,
        center: [Math.cos(a), Math.sin(a), 0],
        east: [-Math.sin(a), Math.cos(a), 0],
        north: [0, 0, 1],
      });
    }
    for (let i = 0; i <= 100; i++) {
      const a = 0.6 + (0.05 * i) / 100,
        point = [Math.cos(a), Math.sin(a), 0];
      expect(f.score(point)).toEqual({ owner: -1, score: 0 });
      for (const threshold of [-0.999999, -0.9, -0.5, 0, 0.5, 0.99])
        expect(f.raw(point, [0.1, 0.1])).toBeLessThan(threshold);
    }
  });
  it('repeats field geometry, values and bounded streams exactly', () => {
    const input = synthetic(),
      a = createField(input, p),
      b = createField(input, p);
    expect(a.ok).toBe(true);
    expect(a.owners).toEqual(b.owners);
    expect(a.ledger).toEqual(b.ledger);
    for (let i = 0; i < 100; i++) {
      const lon = i * 0.17,
        z = -0.99 + i * 0.0198,
        c = Math.sqrt(1 - z * z),
        point = [c * Math.cos(lon), c * Math.sin(lon), z];
      expect(a.score(point)).toEqual(b.score(point));
    }
    expect(a.ledger.every((s) => s.draws <= s.limit)).toBe(true);
    const s = streams('synthetic'),
      r = s.stream('owner0.test', 1);
    r();
    expect(() => r()).toThrow('budget');
    expect(() => s.stream('owner0.test', 1)).toThrow('restarted');
  });
  it('pays all island cap supports from the owner allowance, with independent zero controls', () => {
    for (const patch of [
      { islandAbundancePercent: 0 },
      { archipelagoAbundancePercent: 0 },
      { islandAbundancePercent: 100, archipelagoAbundancePercent: 100 },
    ]) {
      const f = createField(synthetic(patch), p);
      expect(f.ok).toBe(true);
      for (const o of f.owners) {
        for (const r of o.reserve) expect(r.supportArea).toBeLessThanOrEqual(r.allowance + 1e-14);
        if (patch.islandAbundancePercent === 0)
          expect(o.caps.some((c) => c.category === 'island')).toBe(false);
        if (patch.archipelagoAbundancePercent === 0)
          expect(o.caps.some((c) => c.category === 'archipelagoMember')).toBe(false);
      }
    }
  });
  it('returns explicit no proposal for impossible capacity and keeps quotas', () => {
    const f = createField(synthetic({ continentCountIntent: 1, targetWaterCoveragePercent: 45 }), {
      ...p,
      capacityFactor: 2,
    });
    expect(f.ok).toBe(false);
    expect(f.allocated).toHaveLength(1);
    expect(f.failures).toContain('capacity.invalid');
  });
  it('calibrates each union once and refuses insufficient support without transfer', () => {
    const f = {
      owners: [{ quota: 0.25 }, { quota: 0.25 }],
      score: ([i]) => ({ owner: i < 4 ? 0 : 1, score: (i % 4) + 1 }),
    };
    const grid = {
      points: Array.from({ length: 8 }, (_, i) => [i]),
      weights: Array(8).fill(1),
      totalWeight: 8,
    };
    expect(calibrate(f, grid)).toEqual({ ok: true, cutoffs: [2.5, 2.5], failures: [] });
    f.owners[0].quota = 0.6;
    expect(calibrate(f, grid).ok).toBe(false);
    expect(f.owners[1].quota).toBe(0.25);
  });
  it('nearest-pair tree matches exhaustive cross-owner distances', () => {
    const points = Array.from({ length: 120 }, (_, i) => {
      const a = i * 0.17;
      return [Math.cos(a), Math.sin(a), 0];
    });
    const groups = [
      Array.from({ length: 60 }, (_, i) => i),
      Array.from({ length: 60 }, (_, i) => 60 + i),
    ];
    let min = Infinity;
    for (const i of groups[0])
      for (const j of groups[1])
        min = Math.min(min, Math.hypot(...points[i].map((v, k) => v - points[j][k])));
    expect(nearestGap(groups, points).minimumRad).toBeCloseTo(2 * Math.asin(min / 2), 13);
  });
});
