/** Read-only retained checks; no corpus field evaluation in the test runner. */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

import { expect, it } from 'vitest';

import { readArchive, verify } from './evidence.mjs';
import { identities, tickHash } from './lattice.mjs';
import { HERE, loadRuntime } from './runtime.mjs';
it('canonical seam/pole aliases and mapped addresses are identities without field calls', async () => {
  const runtime = await loadRuntime();
  try {
    const g = runtime.generation;
    const fake = (profile) => ({ profile, valueAt: () => 0 });
    expect(
      identities(runtime, fake(g.WORLD_ATLAS_PREVIEW_PROFILE), fake(g.WORLD_ATLAS_FULL_PROFILE)),
    ).toEqual({
      sharedAnchors: 130562,
      sharedTickError: 0,
      seamIdentity: true,
      uniquePoleSamples: 2,
    });
    for (const latitude of [-Math.PI / 2, Math.PI / 2]) {
      const a = runtime.core.createPlanetPoint(-Math.PI, latitude),
        b = runtime.core.createPlanetPoint(Math.PI, latitude);
      expect(a).toEqual(b);
    }
  } finally {
    await runtime.close();
  }
});
function pixels(bytes) {
  let offset = 8;
  const parts = [];
  while (offset < bytes.length) {
    const n = bytes.readUInt32BE(offset),
      type = bytes.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') parts.push(bytes.subarray(offset + 8, offset + 8 + n));
    offset += n + 12;
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    data: inflateSync(Buffer.concat(parts)),
  };
}
it.skipIf(!existsSync(join(HERE, 'authority.json')))(
  'retains exact repeat, coverage outcomes and unmodified half masks',
  async () => {
    expect((await verify()).fieldEvaluations).toBe(0);
    const { reports } = await readArchive(join(HERE, 'state-2/initial/results.json.gz'));
    expect(reports.filter((r) => r.full)).toHaveLength(18);
    expect(reports.filter((r) => !r.full)).toHaveLength(128);
    for (const r of reports) {
      expect(r.allocated).toHaveLength(r.input.controls.continentCountIntent);
      if (r.preview) {
        expect(r.preview.outsideOwnerLandAnchors).toBe(0);
        if (r.preview.coverageErrorBp > 25) expect(r.failures).toContain('preview.coverage');
        if (r.full) expect(r.identities.sharedTickError).toBe(0);
      }
      expect(r.ledger.every((s) => s.draws <= s.limit)).toBe(true);
      if (!r.full) continue;
      const a = pixels(await readFile(join(HERE, `state-2/initial/${r.input.id}.png`)));
      const b = pixels(await readFile(join(HERE, `state-2/initial/${r.input.id}-half.png`)));
      expect([a.width, a.height, b.width, b.height]).toEqual([1600, 800, 800, 400]);
      for (let y = 0; y < 400; y++)
        for (let x = 0; x < 800; x++)
          for (let c = 0; c < 3; c++)
            assert.equal(
              b.data[y * (800 * 3 + 1) + 1 + x * 3 + c],
              a.data[2 * y * (1600 * 3 + 1) + 1 + 2 * x * 3 + c],
            );
    }
  },
  30000,
);

it('hashes either sampled profile through its public read surface', () => {
  const f = {
    profile: { longitudeCellCount: 2, latitudeBandCount: 2 },
    sampleCount: 4,
    valueAt: () => 7,
  };
  expect(tickHash(f)).toMatch(/^[a-f0-9]{64}$/);
  expect(tickHash(f)).toBe(tickHash({ ...f }));
  expect(tickHash(f)).not.toBe(tickHash({ ...f, valueAt: () => 8 }));
});
