import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { test } from 'vitest';

import { corpus } from './corpus.mjs';
import { canonicalBytes } from './measure.mjs';
import { Budget } from './pipeline.mjs';
import {
  captureSources,
  checkpoint,
  expectedArtifacts,
  json,
  verifyAuthority,
  verifyEvidence,
} from './run.mjs';
import { hash, loadRuntime } from './runtime.mjs';
test('canonical scalar and tick arrays have explicit little endian bytes', () => {
  assert.equal(canonicalBytes([1, -1], 'i32').toString('hex'), '01000000ffffffff');
  assert.equal(canonicalBytes([1], 'f64').toString('hex'), '000000000000f03f');
  assert.throws(() => canonicalBytes([1], 'f32'));
});
test('source closure matches immutable184 material3/world2 authority without invoking it', async () => {
  const c = await checkpoint();
  assert.equal(c.manifest.revision, 'issue-184-world-r2');
  const capture = await captureSources();
  assert.equal(capture.manifest.inputs.length, 30);
  assert.equal(capture.manifest.budget.uniqueFieldCalls, 18);
  assert(
    capture.snapshot['docs/investigations/issue-184/templates.mjs'].includes(
      'issue-184-curved-bays-r3',
    ),
  );
});
async function temporary(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'issue189-test-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true });
  }
}
async function sourceFiles(dir, c) {
  await writeFile(join(dir, 'source-manifest.json'), await json(c.manifest));
  await writeFile(
    join(dir, 'source-snapshot.json.gz'),
    gzipSync(Buffer.from(JSON.stringify(c.snapshot))),
  );
}
test('coherent rehashed supplied source and altered matrix fail before imported execution', async () => {
  const trusted = await captureSources();
  await temporary(async (dir) => {
    const changed = structuredClone(trusted),
      file = 'docs/investigations/issue-189/bridge.ts';
    changed.snapshot[file] += '\nthrow new Error("must not execute");\n';
    changed.manifest.sources[file] = hash(changed.snapshot[file]);
    await sourceFiles(dir, changed);
    await assert.rejects(verifyAuthority(dir), /Manifest differs/);
    await assert.rejects(
      loadRuntime({ ...trusted.runtime, [file]: changed.snapshot[file] }),
      /trusted current/,
    );
    const input = structuredClone(trusted);
    input.manifest.inputs[0].controls.polarCharacter = 'landBiased';
    await sourceFiles(dir, input);
    await assert.rejects(verifyAuthority(dir), /Manifest differs/);
  });
});
test('receipt shape rejects excess fields, invalid counts and missing declared rows', () => {
  const d = {
    revision: 'issue-189-D3-r1',
    selectedProposal: null,
    fullPublicDomainSupported: false,
    fields: [],
    rows: corpus().map((r) => ({ id: r.id })),
    counts: new Budget().counts,
  };
  assert.equal(expectedArtifacts(d).length, 31);
  assert.throws(() => expectedArtifacts({ ...d, rows: d.rows.slice(1) }));
  assert.throws(() => expectedArtifacts({ ...d, counts: { ...d.counts, partitions: NaN } }));
  assert.throws(() => expectedArtifacts({ ...d, fields: ['../escape'] }));
});
test('missing output hash is rejected without a computational replay', async () => {
  const captured = await captureSources();
  await temporary(async (dir) => {
    await sourceFiles(dir, captured);
    const decision = {
      revision: 'issue-189-D3-r1',
      selectedProposal: null,
      fullPublicDomainSupported: false,
      fields: [],
      rows: corpus().map((r) => ({ id: r.id })),
      counts: new Budget().counts,
    };
    await writeFile(join(dir, 'decision.json'), await json(decision));
    await writeFile(
      join(dir, 'completion.json'),
      await json({
        complete: true,
        artifacts: {},
        sourceManifestSha256: hash(await readFile(join(dir, 'source-manifest.json'))),
      }),
    );
    await assert.rejects(verifyEvidence(dir), /Missing\/extra artifact hashes/);
  });
});
