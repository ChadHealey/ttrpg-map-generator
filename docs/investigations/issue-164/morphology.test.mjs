import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import {
  calibrate,
  CELL_LIPSCHITZ,
  createField,
  dot,
  FAMILIES,
  GAP_RAD,
  normalize,
  sampleGrid,
  spherePoint,
  stream,
} from './morphology.mjs';
import { inputs, png, sha256, smoke } from './render-comparison.mjs';

const read = (path) => readFile(new URL(path, import.meta.url));
const cases = await inputs();

describe('issue-164 bounded investigation', () => {
  it('preserves exact provenance and dimensions of all eighteen candidate PNGs', async () => {
    const rows = JSON.parse(await read('v2-provenance.json'));
    expect(rows).toHaveLength(18);
    for (const row of rows) {
      // Issue-owned copies keep verification independent of Git history and network access.
      const bytes = await read(`v2-source/${row.row}.png`);
      expect(sha256(bytes)).toBe(row.sha256);
      expect(bytes.length).toBe(row.bytes);
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1600, 800]);
    }
  });
  it('binds twelve images and exact repeat receipts to the current prototype sources', async () => {
    const results = JSON.parse(await read('comparison/results.json'));
    expect(results.reports).toHaveLength(12);
    for (const [path, digest] of Object.entries(results.sources))
      expect(sha256(await read(path))).toBe(digest);
    for (const row of results.reports) {
      const bytes = await read(`comparison/${row.family}-${row.input.id}.png`);
      expect(sha256(bytes)).toBe(row.pngSha256);
      expect(row.exactRepeat).toBe(true);
      expect(row.calibration.status).toBe('calibrated');
      expect(
        Math.abs(row.fullWaterPercent - row.input.controls.targetWaterCoveragePercent),
      ).toBeLessThan(0.25);
      expect(row.geometry.anchorChecks).toBe(80400);
    }
  });
  it.each(FAMILIES)(
    '%s repeats and preserves nested anchors, seam identity, and unique poles',
    (family) => {
      for (const input of cases) {
        const field = createField(family, input),
          preview = sampleGrid(field, 40, 20),
          full = sampleGrid(field, 80, 40);
        expect(sampleGrid(createField(family, input), 40, 20)).toEqual(preview);
        const calibration = calibrate(preview, input.controls.targetWaterCoveragePercent);
        expect(() => smoke(field, preview, full, calibration.threshold)).not.toThrow();
        // One-sided seam limits exercise continuity as well as canonical coordinate aliasing.
        for (let y = 1; y < 20; y++) {
          const latitude = Math.PI / 2 - (y * Math.PI) / 20;
          const left = field.raw(spherePoint(-Math.PI + 1e-9, latitude));
          const right = field.raw(spherePoint(Math.PI - 1e-9, latitude));
          expect(left.owner).toBe(right.owner);
          expect(left.guarded).toBe(right.guarded);
          expect(Math.abs(left.value - right.value)).toBeLessThanOrEqual(1);
        }
      }
    },
  );
  it.each(FAMILIES)(
    '%s reserves the gap for every positive contribution before any contour',
    (family) => {
      for (const input of cases) {
        const field = createField(family, input);
        if (family === 'envelope') {
          for (const [i, a] of field.owners.entries())
            for (const b of field.owners.slice(i + 1)) {
              expect(
                Math.acos(Math.max(-1, Math.min(1, dot(a.center, b.center)))) - a.radius - b.radius,
              ).toBeGreaterThanOrEqual(GAP_RAD - 1e-12);
            }
        } else
          for (const owner of field.owners) {
            const bound =
              1 +
              owner.waves.reduce(
                (sum, wave) => sum + Math.hypot(...wave.vector) * wave.amplitude,
                0,
              );
            expect(bound).toBeLessThan(CELL_LIPSCHITZ);
          }
        const random = stream(input.seed, 'gap-smoke');
        for (let i = 0; i < 500; i++) {
          const p = spherePoint(random() * Math.PI * 2, Math.asin(2 * random() - 1));
          const tangent = normalize([-p[1], p[0], 0]);
          const q = p.map(
            (v, k) => v * Math.cos(GAP_RAD * 0.999) + tangent[k] * Math.sin(GAP_RAD * 0.999),
          );
          const a = field.raw(p),
            b = field.raw(q);
          if (a.guarded && b.guarded) expect(a.owner).toBe(b.owner);
        }
      }
    },
  );
  it('returns a bounded capacity failure instead of weakening separation', () => {
    const impossible = {
      width: 2,
      height: 2,
      weights: [0, 1, 0],
      values: new Int32Array(6),
      owners: new Int8Array(6).fill(-1),
    };
    expect(calibrate(impossible, 45).status).toBe('capacity-failed');
    expect(() => createField('unknown', cases[0])).toThrow();
    expect(() =>
      createField('cellular', {
        ...cases[0],
        controls: { ...cases[0].controls, continentCountIntent: 9 },
      }),
    ).toThrow();
  });
  it('encodes the diagnostic mask without labels, strokes, or coastline repair', () => {
    const bytes = png(Uint8Array.from([0, 1, 1, 0]), 2, 2);
    let at = 8,
      data;
    while (at < bytes.length) {
      const size = bytes.readUInt32BE(at),
        type = bytes.toString('ascii', at + 4, at + 8);
      if (type === 'IDAT') data = inflateSync(bytes.subarray(at + 8, at + 8 + size));
      at += 12 + size;
    }
    expect([...data]).toEqual([0, 240, 237, 225, 42, 55, 51, 0, 42, 55, 51, 240, 237, 225]);
  });
});
