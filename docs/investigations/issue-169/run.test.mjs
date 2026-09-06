import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { test } from 'vitest';

import { budgetShares, createField } from '../issue-165/field.mjs';
import { coverage, gridBytes } from './run.mjs';

test('the retained normal-01 fixed caps remain insufficient even with the owner tolerance', async () => {
  const base = new URL('../issue-165/', import.meta.url);
  const receipt = JSON.parse(await readFile(new URL('comparison-r1/results.json', base), 'utf8'));
  for (const [path, expected] of Object.entries(receipt.sources))
    assert.equal(
      createHash('sha256')
        .update(await readFile(new URL(path, base)))
        .digest('hex'),
      expected,
    );
  const row = receipt.reports.find((r) => r.family === 'envelope' && r.input.id === 'normal-01');
  const field = createField('envelope', row.input),
    shares = budgetShares(field.owners);
  const tolerance = 0.0025 / row.input.controls.continentCountIntent;
  for (let i = 0; i < 2; i++) {
    const quota = (1 - row.input.controls.targetWaterCoveragePercent / 100) * shares[i];
    assert(Math.abs(quota - row.calibration.owners[i].quota) < 1e-15);
    assert(quota - tolerance > (1 - Math.cos(field.owners[i].radius)) / 2);
  }
});

test('coverage uses spherical row weights and reports target-relative owner pp', () => {
  const grid = {
    width: 2,
    height: 2,
    weights: [0, 1, 0],
    values: Int32Array.from([1, 1, 1, -1, 1, 1]),
    owners: Int8Array.from([0, 0, 0, 0, 0, 0]),
  };
  const report = coverage(grid, [{ id: 'owner-0', quota: 0.4 }], {
    controls: { targetWaterCoveragePercent: 50 },
  });
  assert.equal(report.waterPercent, 50);
  assert.equal(report.errorPercentagePoints, 0);
  assert.equal(report.owners[0].realizedSphereFraction, 0.5);
  assert(Math.abs(report.owners[0].errorPercentagePoints - 10) < 1e-12);
});
test('canonical diagnostic bytes have explicit big-endian signed values and owners', () => {
  const bytes = gridBytes({
    values: Int32Array.from([0x1020304, -2]),
    owners: Int8Array.from([3, -1]),
  });
  assert.equal(bytes.toString('hex'), '0102030403fffffffeff');
});
