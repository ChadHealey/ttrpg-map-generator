import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';

import { expect, it } from 'vitest';

import { sha256 } from './measure.mjs';
import { inputs } from './run.mjs';

const read = (path) => readFile(new URL(path, import.meta.url));
const receipt = JSON.parse(await read('comparison-r1/results.json'));
const cases = await inputs();
function pixels(bytes) {
  const data = [];
  for (let at = 8; at < bytes.length;) {
    const size = bytes.readUInt32BE(at);
    if (bytes.toString('ascii', at + 4, at + 8) === 'IDAT')
      data.push(bytes.subarray(at + 8, at + 8 + size));
    at += 12 + size;
  }
  return inflateSync(Buffer.concat(data));
}
it('binds all source/definition/input receipts and twelve exact repeats without Git history or network', async () => {
  expect(receipt.reports).toHaveLength(12);
  expect(receipt.baselines).toHaveLength(12);
  for (const [path, digest] of Object.entries(receipt.sources))
    expect(sha256(await read(path))).toBe(digest);
  const old = JSON.parse(await read('../issue-164/comparison/results.json'));
  for (const row of receipt.reports) {
    expect(row.input).toEqual(cases.find((input) => input.id === row.input.id));
    expect(row.exactRepeat).toBe(true);
    expect(row.geometry.anchorChecks).toBe(80400);
    expect(row.geometry.seamLandAnchors).toBeGreaterThan(0);
    expect(row.geometry.poleChecks).toBe(722);
    expect(row.calibration.owners.every((owner) => owner.steps === 24)).toBe(true);
    const baseline = receipt.baselines.find(
      (b) => b.family === row.family && b.input.id === row.input.id,
    );
    const retained = old.reports.find(
      (b) => b.family === row.family && b.input.id === row.input.id,
    );
    expect(baseline.calibration).toEqual(retained.calibration);
    expect(baseline.after.waterPercent).toBeCloseTo(retained.previewWaterPercent, 8);
    for (const phase of [row.before, row.after, baseline.before, baseline.after]) {
      expect(
        phase.ownerShares.reduce((sum, owner) => sum + owner.spherePercent, 0) + phase.waterPercent,
      ).toBeCloseTo(100, 8);
      expect(
        phase.components.reduce((sum, component) => sum + component.landPercent, 0),
      ).toBeCloseTo(100, 8);
      expect(phase.guardContact.upperFraction).toBeGreaterThanOrEqual(
        phase.guardContact.confirmedFraction,
      );
      expect(phase.guardContact.upperFraction).toBeLessThanOrEqual(1);
    }
    const full = await read(`comparison-r1/${row.family}-${row.input.id}.png`),
      half = await read(`comparison-r1/${row.family}-${row.input.id}-simplified.png`);
    expect(sha256(full)).toBe(row.pngSha256);
    expect(sha256(half)).toBe(row.simplifiedSha256);
    expect([full.readUInt32BE(16), full.readUInt32BE(20)]).toEqual([1600, 800]);
    expect([half.readUInt32BE(16), half.readUInt32BE(20)]).toEqual([800, 400]);
    const big = pixels(full),
      small = pixels(half),
      expected = Buffer.alloc(small.length);
    for (let y = 0; y < 400; y++)
      for (let x = 0; x < 800; x++) {
        const source = y * 2 * 4801 + x * 6 + 1,
          target = y * 2401 + x * 3 + 1;
        big.copy(expected, target, source, source + 3);
      }
    expect(small.equals(expected)).toBe(true);
  }
});
it('retains failed quotas as disqualifications rather than weakening coverage or relabeling success', () => {
  const failures = receipt.reports.filter((row) => !row.numericEligible);
  expect(failures.map((row) => `${row.family}/${row.input.id}`)).toEqual([
    'envelope/normal-01',
    'envelope/connected-majority',
    'envelope/fragmented-islands',
  ]);
  for (const row of failures) {
    expect(row.calibration.status).toBe('infeasible');
    expect(row.calibration.owners.some((owner) => owner.status === 'capacity-failed')).toBe(true);
    expect(Math.abs(row.fullCoverageErrorPercent)).toBeGreaterThan(0.25);
  }
  for (const row of receipt.reports.filter((row) => row.numericEligible))
    expect(Math.abs(row.fullCoverageErrorPercent)).toBeLessThanOrEqual(0.25);
});
it('records independent zero/abundant retained-output probes, merged/vanished satellites and realized coast distances', () => {
  expect(receipt.probes).toHaveLength(8);
  for (const probe of receipt.probes) {
    expect(probe.exactRepeat).toBe(true);
    expect(probe.input.seed).toBe(cases[0].seed);
    expect(probe.input.controls).toEqual({ ...cases[0].controls, [probe.control]: probe.value });
    const expectedIsolated = Math.ceil(probe.input.controls.islandAbundancePercent / 25) * 4;
    const expectedGrouped = Math.ceil(probe.input.controls.archipelagoAbundancePercent / 15) * 4;
    expect(probe.islands.isolated).toBe(expectedIsolated);
    expect(probe.islands.grouped).toBe(expectedGrouped);
    expect(Object.values(probe.islands.statuses).reduce((a, b) => a + b, 0)).toBe(
      expectedIsolated + expectedGrouped,
    );
    for (const satellite of probe.islands.satellites) {
      expect(satellite.retainedWinningSamples).toBe(
        satellite.principalSamples + satellite.detachedSamples,
      );
      expect(satellite.centerToRealizedPrincipalCoastRad).toBeGreaterThanOrEqual(0);
      expect(satellite.centerToRealizedPrincipalCoastRad).toBeLessThanOrEqual(Math.PI);
    }
  }
  for (const family of ['envelope', 'cellular'])
    for (const control of ['islandAbundancePercent', 'archipelagoAbundancePercent']) {
      const zero = receipt.probes.find(
        (p) => p.family === family && p.control === control && p.value === 0,
      );
      const abundant = receipt.probes.find(
        (p) => p.family === family && p.control === control && p.value === 100,
      );
      expect(zero.gridSha256).not.toBe(abundant.gridSha256);
      expect(abundant.islands.statuses).not.toEqual(zero.islands.statuses);
    }
});
