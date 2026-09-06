/** Capture and read-only verification. Deliberately no field/evaluator import. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

import { format } from 'prettier';

import { HERE, ROOT, runtimeSources } from './runtime.mjs';
export const hash = (x) => createHash('sha256').update(x).digest('hex');
export async function json(file, value) {
  await writeFile(file, await format(JSON.stringify(value), { parser: 'json' }), { flag: 'wx' });
}
export async function capture() {
  const sources = await runtimeSources();
  for (const name of (await readdir(HERE))
    .filter((n) => /\.(mjs|ts|json)$/.test(n) && !n.startsWith('authority'))
    .sort()) {
    sources[`docs/investigations/issue-191/${name}`] = await readFile(join(HERE, name), 'utf8');
  }
  for (const name of [
    'docs/investigations/issue-191/design.md',
    'docs/investigations/issue-191/design-state-2.md',
    'docs/investigations/issue-180/corpus.mjs',
    'docs/investigations/issue-183/corpus.mjs',
    'package.json',
    'packages/core/package.json',
    'packages/generation/package.json',
    'pnpm-lock.yaml',
    'tsconfig.base.json',
    'eslint.config.js',
    '.prettierignore',
    'docs/investigations/issue-167/README.md',
    'docs/investigations/issue-185/registry.md',
    'docs/adr/0029-separated-macro-landmass-field.md',
  ])
    sources[name] = await readFile(join(ROOT, name), 'utf8');
  const sorted = Object.fromEntries(Object.entries(sources).sort(([a], [b]) => (a < b ? -1 : 1)));
  return {
    sources: sorted,
    manifest: {
      node: process.version,
      files: Object.fromEntries(Object.entries(sorted).map(([k, v]) => [k, hash(v)])),
    },
  };
}
export async function archive(file, value) {
  await writeFile(file, gzipSync(JSON.stringify(value), { level: 9 }), { flag: 'wx' });
}
export async function readArchive(file) {
  return JSON.parse(gunzipSync(await readFile(file)));
}
export async function inventory(directory) {
  const result = {};
  for (const name of (await readdir(directory)).sort())
    result[name] = hash(await readFile(join(directory, name)));
  return result;
}
export async function verify(state = 'state-2') {
  assert.equal(state, 'state-2', 'Only repaired state 2 has complete evidence');
  const aborted = JSON.parse(await readFile(join(HERE, 'aborted-state-1.json'), 'utf8'));
  for (const [name, digest] of Object.entries(aborted.artifacts))
    assert.equal(
      hash(await readFile(join(HERE, 'state-1', name))),
      digest,
      'Aborted state 1 artifact changed',
    );
  const root = join(HERE, state),
    manifest = JSON.parse(await readFile(join(root, 'source-manifest.json'), 'utf8'));
  const current = await capture();
  assert.deepEqual(current.manifest, manifest, 'Source/runtime drift');
  assert.deepEqual(await readArchive(join(root, 'sources.json.gz')), current.sources);
  const inputs = JSON.parse(await readFile(join(root, 'inputs.json'), 'utf8'));
  const first = await readArchive(join(root, 'initial', 'results.json.gz')),
    repeat = await readArchive(join(root, 'repeat', 'results.json.gz'));
  assert.deepEqual(first, repeat, 'Repeat mismatch');
  assert.equal(first.reports.length, 146);
  assert.deepEqual(
    first.reports.map((r) => ({ input: r.input, full: r.full })),
    inputs,
  );
  const authority = JSON.parse(await readFile(join(HERE, 'authority.json'), 'utf8'));
  assert.equal(authority.manifestSha256, hash(await readFile(join(root, 'source-manifest.json'))));
  for (const phase of ['initial', 'repeat']) {
    const receipt = JSON.parse(await readFile(join(root, `${phase}-receipt.json`), 'utf8'));
    assert.deepEqual(await inventory(join(root, phase)), receipt.artifacts);
    assert.equal(hash(await readFile(join(root, `${phase}-receipt.json`))), authority[phase]);
    assert.deepEqual(
      Object.keys(receipt.artifacts).sort(),
      [
        ...inputs.map((r) => `${r.full ? 'full' : 'preview'}-${r.input.id}.json.gz`),
        ...inputs
          .filter((r) => r.full)
          .flatMap((r) => [`${r.input.id}.png`, `${r.input.id}-half.png`]),
        'results.json.gz',
      ].sort(),
    );
    assert.equal(receipt.phase, phase);
    assert.equal(receipt.counts.builds, 146);
    assert(receipt.counts.fieldEvaluations <= 75836012);
    const claim = JSON.parse(await readFile(join(root, `${phase}-claim.json`), 'utf8'));
    assert.equal(claim.manifestSha256, authority.manifestSha256);
    assert.equal(claim.inputsSha256, hash(JSON.stringify(inputs)));
    assert.equal(claim.maximumEvaluations, 75836012);
    assert.deepEqual(receipt.counts, first.counts);
    assert.equal(
      receipt.counts.fieldEvaluations,
      first.reports.reduce((sum, r) => sum + r.fieldEvaluations, 0),
    );
    for (const r of first.reports)
      if (r.full) {
        assert.equal(receipt.artifacts[`${r.input.id}.png`], r.images.native);
        assert.equal(receipt.artifacts[`${r.input.id}-half.png`], r.images.half);
      }
  }
  assert.deepEqual(authority.initialArtifacts, await inventory(join(root, 'initial')));
  return {
    status: 'verified-retained-evidence',
    fieldEvaluations: 0,
    manifestSha256: authority.manifestSha256,
  };
}
