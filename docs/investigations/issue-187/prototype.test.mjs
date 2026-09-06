import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync, inflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { stitchBody } from '../issue-169/geometry.mjs';
import { sampleCoast } from '../issue-172/coast-partition.mjs';
import { certifyCandidate } from '../issue-178/certificates.mjs';
import { CERTIFICATE_OPTIONS, inputs, QUOTAS } from './corpus.mjs';
import { fit } from './evaluate.mjs';
import { buildCoast } from './states/state-1/layout.mjs';

const source = await readFile(new URL('./design.md', import.meta.url), 'utf8');
const centralTable = source
  .split('## Complete central anchor table')[1]
  .split('## Complete partition')[0];
const anchors = centralTable
  .split('\n')
  .filter((line) => /^\|\s*\d+\s*\|/.test(line))
  .map((line) => {
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((s) => Number(s.trim()));
    return cells.slice(1);
  });
const reports = JSON.parse(
  gunzipSync(await readFile(new URL('./evidence/state-1/reports.json.gz', import.meta.url))),
);
describe('reviewed whole-coast A literal and body-only receipt contract', () => {
  it('matches the reviewed central table and all actual root/far/site identities', () => {
    expect(anchors).toHaveLength(29);
    const coast = sampleCoast(anchors, { steps: 3, tension: 0.12 });
    const split = buildCoast('literal'),
      body = stitchBody(split.interior, split.attachments);
    expect(body).toHaveLength(87);
    expect(new Set(body.map((p) => JSON.stringify(p)))).toEqual(
      new Set(coast.map((p) => JSON.stringify(p))),
    );
    for (const [i, [start, end, farA, farB]] of [
      [18, 33, 21, 30],
      [66, 81, 69, 75],
      [39, 60, 45, 54],
    ].entries()) {
      expect(split.attachments[i].root).toEqual([coast[start], coast[end]]);
      expect(split.attachments[i].collar.far).toEqual([coast[farA], coast[farB]]);
    }
    expect(split.bay.mouth).toEqual([coast[0], coast[12]]);
    expect(split.bay.polygon).toEqual(coast.slice(0, 13).reverse());
    expect(split.bay.mouthKind).toBe('wedge-geodesic');
    expect(split.islandAnchorEdges).toEqual(
      [63, 65, 79, 81, 82, 83].map((i) => [coast[i], coast[i + 1]]),
    );
  });
  it('applies the two regional formulas before partitioning and never mutates arguments or central state', () => {
    const anatomy = [1, -1],
      before = structuredClone(anatomy),
      first = buildCoast('literal');
    const moved = buildCoast('literal', { anatomy, variation: 0 });
    expect(anatomy).toEqual(before);
    expect(moved.bay.mouth).toEqual([
      [0.49, -0.22 - 0.008],
      [0.6 + 0.012, -0.005],
    ]);
    expect(moved.bay.witness).toEqual([0.28 + 0.004, -0.065 - 0.004]);
    expect(moved.attachments[0].root[0]).toEqual([0.6 + 0.02, 0.4]);
    expect(moved.attachments[1].root[1]).toEqual([0.49, -0.38 - 0.008]);
    expect(moved.attachments[0].collar.disk).toEqual([0.01, 0.525]);
    expect(moved.attachments[1].collar.disk).toEqual([-0.15 - 0.008, -0.56 + 0.006]);
    expect(moved.attachments[2]).toEqual(first.attachments[2]);
    moved.interior[0][0] = 999;
    expect(buildCoast('literal')).toEqual(first);
    expect(buildCoast('literal', { anatomy: [0, 0], variation: 3 })).toEqual(first);
  });
  it('rejects malformed or out-of-budget anatomy, variation and identifiers', () => {
    for (const anatomy of [
      null,
      [],
      [0],
      [0, 0, 0],
      ['0', 0],
      [NaN, 0],
      [Infinity, 0],
      [1.0001, 0],
    ])
      expect(() => buildCoast('literal', { anatomy })).toThrow();
    for (const variation of [-1, -0, 4, 0.5, NaN, '0', null])
      expect(() => buildCoast('literal', { variation })).toThrow();
    for (const id of ['', 0, {}, []]) expect(() => buildCoast(id)).toThrow();
  });
  it('fits the declared paid body quota once and scales every witness without mutating the raw coast', () => {
    const split = buildCoast('literal'),
      before = structuredClone(split),
      quota = QUOTAS[0];
    const fitted = fit(split, quota);
    expect(split).toEqual(before);
    expect(fitted.scale).toBe(Math.sqrt((4 * Math.PI * quota) / fitted.rawBodyArea));
    expect(fitted.candidate.primary).toBe(true);
    expect(fitted.candidate.islands).toEqual([]);
    expect(fitted.candidate.interiorWitness).toEqual(
      split.interiorWitness.map((x) => x * fitted.scale),
    );
    expect(fitted.candidate.bay.witness).toEqual(split.bay.witness.map((x) => x * fitted.scale));
    expect(fitted.candidate.attachments[1].collar.disk).toEqual(
      split.attachments[1].collar.disk.map((x) => x * fitted.scale),
    );
    expect(certifyCandidate(fitted.candidate, { quota, ...CERTIFICATE_OPTIONS }).ok).toBe(true);
  });
  it('re-certifies every retained case with its original quota and preserves meaningful negative failures', () => {
    expect(reports.map((r) => r.input)).toEqual(inputs());
    expect(reports).toHaveLength(60);
    for (const row of reports) {
      expect(row.candidate.islands).toEqual([]);
      expect(
        certifyCandidate(row.candidate, { quota: row.input.quota, ...CERTIFICATE_OPTIONS }),
      ).toEqual(row.certificate);
    }
    const row = reports[0];
    expect(
      certifyCandidate(
        { ...row.candidate, bay: null },
        { quota: row.input.quota, ...CERTIFICATE_OPTIONS },
      ).failures.some((f) => f.code === 'missing-bay'),
    ).toBe(true);
    const wrongQuota = certifyCandidate(row.candidate, {
      quota: row.input.quota + 0.01,
      ...CERTIFICATE_OPTIONS,
    });
    expect(wrongQuota.ok).toBe(false);
    expect(wrongQuota.failures.some((f) => f.code === 'quota-residual')).toBe(true);
  });
  it('retains exact native and half panel dimensions and even-coordinate pixel correspondence', async () => {
    const images = await Promise.all(
      ['panel.png', 'panel-half.png'].map(async (file) => {
        const bytes = await readFile(new URL(`./evidence/state-1/${file}`, import.meta.url));
        const width = bytes.readUInt32BE(16),
          height = bytes.readUInt32BE(20),
          data = [];
        for (let at = 8; at < bytes.length;) {
          const length = bytes.readUInt32BE(at),
            name = bytes.toString('ascii', at + 4, at + 8);
          if (name === 'IDAT') data.push(bytes.subarray(at + 8, at + 8 + length));
          at += length + 12;
        }
        return { width, height, rows: inflateSync(Buffer.concat(data)) };
      }),
    );
    const [a, b] = images;
    expect([a.width, a.height, b.width, b.height]).toEqual([900, 320, 450, 160]);
    for (let y = 0; y < b.height; y++)
      for (let x = 0; x < b.width; x++) {
        const ai = 2 * y * (3 * a.width + 1) + 1 + 6 * x,
          bi = y * (3 * b.width + 1) + 1 + 3 * x;
        assert.deepEqual(b.rows.subarray(bi, bi + 3), a.rows.subarray(ai, ai + 3));
      }
  });
});
