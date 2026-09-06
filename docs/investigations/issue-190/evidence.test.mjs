/** Retained bytes and pure verification only: no new useful geometry calls. */
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync, gzipSync, inflateSync } from 'node:zlib';

import { test } from 'vitest';

import { directory, inspect, verify } from './verify.mjs';

test('external authority verifies all retained phases without useful geometry', async () => {
  assert.deepEqual(await verify('state-1'), {
    verified: true,
    stage: 'state-1',
    cases: 60,
    passed: 60,
    reservedSlots: 180,
    bodyCertificateCalls: 180,
    geometryCallsThisVerification: 0,
  });
});

test('trusted verification rejects altered source, source inventory and image bytes', async () => {
  for (const kind of ['source', 'inventory', 'image']) {
    const target = await mkdtemp(join(tmpdir(), 'issue-190-pure-evidence-'));
    try {
      await cp(directory('state-1'), target, { recursive: true });
      if (kind === 'image')
        await writeFile(join(target, 'panel.png'), Buffer.from('altered image'));
      else {
        const path = join(target, 'sources.json.gz');
        const snapshot = JSON.parse(gunzipSync(await readFile(path)));
        const entry = Object.keys(snapshot)[0];
        if (kind === 'source') snapshot[entry] += '\n// changed source\n';
        else snapshot['../untrusted.mjs'] = 'throw new Error("must not execute")';
        await writeFile(path, gzipSync(JSON.stringify(snapshot)));
      }
      await assert.rejects(inspect('state-1', true, target));
    } finally {
      await rm(target, { recursive: true, force: true });
    }
  }
});

function decode(bytes) {
  const idat = [];
  let width, height;
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const kind = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (kind === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(data[8], 8);
      assert.equal(data[9], 2);
    }
    if (kind === 'IDAT') idat.push(data);
    offset += length + 12;
  }
  const rows = inflateSync(Buffer.concat(idat));
  assert.equal(rows.length, (width * 3 + 1) * height);
  for (let y = 0; y < height; y++) assert.equal(rows[y * (width * 3 + 1)], 0);
  return { width, height, rows };
}
test('saved half panel is the exact declared decimation of saved native pixels', async () => {
  const native = decode(await readFile(join(directory('state-1'), 'panel.png')));
  const half = decode(await readFile(join(directory('state-1'), 'panel-half.png')));
  assert.deepEqual([native.width, native.height, half.width, half.height], [900, 320, 450, 160]);
  for (let y = 0; y < half.height; y++)
    for (let x = 0; x < half.width; x++)
      for (let c = 0; c < 3; c++)
        assert.equal(
          half.rows[y * (half.width * 3 + 1) + 1 + x * 3 + c],
          native.rows[2 * y * (native.width * 3 + 1) + 1 + 2 * x * 3 + c],
        );
});
