import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync, gzipSync, inflateSync } from 'node:zlib';

import { format } from 'prettier';
import { test } from 'vitest';

import { edges, hasEdge, polygonArea, samePoint } from '../issue-169/geometry.mjs';
import { certifyCandidate as legacy } from '../issue-178/certificates.mjs';
import { certifyCandidate } from './certificates.mjs';
import { options } from './corpus.mjs';
import { buildFixture } from './fixtures.mjs';
import { record, verify } from './run.mjs';
import { hash, HERE } from './sources.mjs';

const directory = join(HERE, 'evidence', 'components');
const json = (v) => format(JSON.stringify(v), { parser: 'json', printWidth: 100 });
async function copyEvidence(action) {
  const temp = await mkdtemp(join(tmpdir(), 'issue-188-evidence-'));
  try {
    await cp(directory, temp, { recursive: true });
    return await action(temp);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
test('both frozen literals replay as subordinate component successes with an actual role bank', async () => {
  const rows = JSON.parse(gunzipSync(await readFile(join(directory, 'reports.json.gz'))));
  assert.equal(rows.length, 2);
  for (const row of rows) {
    const built = buildFixture(row.input.id);
    // Saved receipts use JSON, which serializes the reflected -0 as 0.
    assert.equal(JSON.stringify(built.candidate), JSON.stringify(row.candidate));
    assert.equal(built.quota, row.quota);
    assert.equal(row.candidate.primary, false);
    assert.equal(row.candidate.islands.length, 0);
    assert.equal(row.candidate.attachments.length, 1);
    const actual = certifyCandidate(row.candidate, { ...options, quota: row.quota });
    assert.equal(actual.ok, true);
    assert.deepEqual(actual, row.certificate);
    const old = legacy(row.candidate, { quota: row.quota, collarWidthUpperMode: 'root-and-far' });
    assert.equal(old.ok, false);
    assert(old.failures.some((f) => f.code === 'bay-coast'));
    const role = row.candidate.attachments[0];
    assert(
      edges(row.candidate.bay.polygon).some(
        ([a, b]) =>
          hasEdge(role.polygon, a, b) &&
          hasEdge(row.candidate.bodyBoundary, a, b) &&
          !hasEdge(row.candidate.interior, a, b),
      ),
    );
    assert(
      row.candidate.bay.mouth.some(
        (p) => role.polygon.some((v) => samePoint(p, v)) && !role.root.some((v) => samePoint(p, v)),
      ),
    );
    assert.equal(actual.metrics.vertexCount, 11);
    assert.equal(actual.metrics.bayTopology.coastEdges, 3);
    assert(
      Math.abs(
        polygonArea(actual.metrics.bayTopology.precutPolygon) -
          polygonArea(row.candidate.bodyBoundary) -
          polygonArea(row.candidate.bay.polygon),
      ) < 1e-12,
    );
  }
});
test('actual trusted replay and exclusive recording preserve immutable evidence', async () => {
  const before = await readFile(join(directory, 'receipt.json'));
  assert.deepEqual(await verify('components'), {
    stage: 'components',
    verified: true,
    cases: 2,
    passed: 2,
    images: 2,
    sources: 22,
  });
  await assert.rejects(record('components'), /EEXIST/);
  await assert.rejects(record('third'), /Only the complete two-fixture/);
  assert.deepEqual(await readFile(join(directory, 'receipt.json')), before);
});
test('coherently rehashed source injection rejects before retained code can execute', async () => {
  await copyEvidence(async (temp) => {
    const manifest = JSON.parse(await readFile(join(temp, 'source-manifest.json'), 'utf8'));
    const sources = JSON.parse(gunzipSync(await readFile(join(temp, 'sources.json.gz'))));
    const entry = manifest.entry;
    sources[entry] += "\nthrow new Error('UNTRUSTED SOURCE EXECUTED');\n";
    manifest.sources[entry] = hash(sources[entry]);
    await writeFile(
      join(temp, 'sources.json.gz'),
      gzipSync(Buffer.from(JSON.stringify(sources) + '\n')),
    );
    await writeFile(join(temp, 'source-manifest.json'), await json(manifest));
    await assert.rejects(verify('components', temp), /Retained manifest differs from trusted/);
  });
});
test('unknown manifest paths and unexpected artifact inventory reject before replay', async () => {
  await copyEvidence(async (temp) => {
    const manifest = JSON.parse(await readFile(join(temp, 'source-manifest.json'), 'utf8'));
    manifest.sources['../escaped.mjs'] = hash('throw 0');
    await writeFile(join(temp, 'source-manifest.json'), await json(manifest));
    await assert.rejects(verify('components', temp), /Retained manifest differs from trusted/);
  });
  await copyEvidence(async (temp) => {
    await writeFile(join(temp, 'extra.txt'), 'not in the exact inventory');
    await assert.rejects(verify('components', temp), /Exact local artifact inventory/);
  });
});
test('changed image bytes and coherently false pass summaries reject', async () => {
  await copyEvidence(async (temp) => {
    const bytes = await readFile(join(temp, 'panel.png'));
    bytes[20] ^= 1;
    await writeFile(join(temp, 'panel.png'), bytes);
    await assert.rejects(verify('components', temp), /Artifact hash/);
  });
  await copyEvidence(async (temp) => {
    const summary = JSON.parse(await readFile(join(temp, 'summary.json'), 'utf8'));
    const receipt = JSON.parse(await readFile(join(temp, 'receipt.json'), 'utf8'));
    summary.passed = 0;
    receipt.passed = 0;
    const text = await json(summary);
    receipt.artifacts['summary.json'] = hash(text);
    await writeFile(join(temp, 'summary.json'), text);
    await writeFile(join(temp, 'receipt.json'), await json(receipt));
    await assert.rejects(verify('components', temp), /Exact local receipt and image replay/);
  });
});
function decodePng(bytes) {
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  let width, height;
  const data = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset),
      kind = bytes.toString('ascii', offset + 4, offset + 8);
    const payload = bytes.subarray(offset + 8, offset + 8 + length);
    if (kind === 'IHDR') {
      width = payload.readUInt32BE(0);
      height = payload.readUInt32BE(4);
      assert.equal(payload[9], 2);
    }
    if (kind === 'IDAT') data.push(payload);
    offset += length + 12;
  }
  const rows = inflateSync(Buffer.concat(data));
  assert.equal(rows.length, (width * 3 + 1) * height);
  for (let y = 0; y < height; y++) assert.equal(rows[y * (width * 3 + 1)], 0);
  return {
    width,
    height,
    pixel: (x, y) =>
      rows.subarray(y * (width * 3 + 1) + 1 + x * 3, y * (width * 3 + 1) + 4 + x * 3),
  };
}
test('both fixed panels use declared dimensions and every half pixel is the declared native sample', async () => {
  const native = decodePng(await readFile(join(directory, 'panel.png'))),
    half = decodePng(await readFile(join(directory, 'panel-half.png')));
  assert.equal(native.width, 640);
  assert.equal(native.height, 320);
  assert.equal(half.width, 320);
  assert.equal(half.height, 160);
  for (let y = 0; y < half.height; y++)
    for (let x = 0; x < half.width; x++)
      assert.deepEqual(half.pixel(x, y), native.pixel(2 * x, 2 * y));
});
