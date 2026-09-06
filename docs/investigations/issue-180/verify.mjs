/** Read-only replay of either immutable audit capture; never writes retained artifacts. */
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { posix } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { captureSources, hash, loadSnapshot } from '../issue-177/local-evidence.mjs';
const final = process.argv[2] !== '--initial';
assert(process.argv.length === 2 || ['--initial', '--final'].includes(process.argv[2]));
const BASE = new URL('.', import.meta.url),
  DIR = new URL(final ? 'evidence-final/' : 'evidence/', BASE),
  prefix = '../issue-180/';
const entries = [
  '../issue-179/templates-r2.mjs',
  '../issue-170/placement.mjs',
  '../issue-178/certificates.mjs',
  '../issue-164/morphology.mjs',
  '../issue-169/geometry.mjs',
  '../issue-169/field.mjs',
  prefix + (final ? 'audit-final.mjs' : 'audit.mjs'),
  prefix + 'corpus.mjs',
];
async function load() {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', DIR), 'utf8'));
  const snapshot = JSON.parse(await readFile(new URL('source-snapshot.json', DIR), 'utf8'));
  assert.equal(
    hash(await readFile(new URL('source-snapshot.json', DIR))),
    manifest.sourceSnapshotSha256,
  );
  // Establish trusted current closure and frozen authority before executing any snapshot source.
  const trusted = Object.assign(
    {},
    ...(await Promise.all(entries.map((entry) => captureSources(entry)))),
  );
  assert.deepEqual(snapshot, trusted, 'Snapshot must exactly match the trusted current closure');
  assert.deepEqual(Object.keys(manifest.sourceHashes).sort(), Object.keys(trusted).sort());
  for (const [path, source] of Object.entries(trusted))
    assert.equal(hash(source), manifest.sourceHashes[path], path);
  assert.deepEqual(Object.keys(manifest.verifierDependencies).sort(), [
    '../issue-177/local-evidence.mjs',
    final ? 'run-final.mjs' : 'run.mjs',
  ]);
  for (const path of [final ? 'run-final.mjs' : 'run.mjs', '../issue-177/local-evidence.mjs'])
    assert.equal(
      hash(await readFile(new URL(path, BASE))),
      manifest.verifierDependencies[path],
      path,
    );
  const frozen = JSON.parse(
    await readFile(new URL('../issue-179/comparison-r2/manifest.json', BASE), 'utf8'),
  );
  const matches = [];
  for (const [path, source] of Object.entries(trusted)) {
    const historical = posix.relative('../issue-179', path);
    if (frozen.sources[historical]) {
      assert.equal(hash(source), frozen.sources[historical], `Frozen r2 changed: ${historical}`);
      matches.push(historical);
    }
  }
  assert.deepEqual(matches, manifest.frozen179RuntimeMatches);
  assert(matches.includes('templates-r2.mjs') && matches.includes('../issue-170/placement.mjs'));
  const template = await loadSnapshot(entries[0], snapshot),
    placement = await loadSnapshot(entries[1], snapshot),
    certificate = await loadSnapshot(entries[2], snapshot),
    morphology = await loadSnapshot(entries[3], snapshot),
    geometry = await loadSnapshot(entries[4], snapshot),
    audit = await loadSnapshot(prefix + (final ? 'audit-final.mjs' : 'audit.mjs'), snapshot),
    declared = await loadSnapshot(prefix + 'corpus.mjs', snapshot);
  assert.deepEqual(manifest.probes, declared.corpus());
  assert.equal(manifest.probes.length, 160);
  const runtime = {
    ...template,
    ...placement,
    ...certificate,
    stream: morphology.stream,
    polygonArea: geometry.polygonArea,
  };
  return { manifest, snapshot, runtime, audit };
}
async function currentIntegrity(manifest) {
  const changed = [];
  for (const [path, expected] of Object.entries(manifest.sourceHashes)) {
    const actual = await readFile(new URL(path, new URL('../issue-177/', BASE)));
    if (hash(actual) !== expected) changed.push(path);
  }
  return { allSourcesUnchanged: changed.length === 0, changed };
}

const { manifest, runtime, audit } = await load(),
  completion = JSON.parse(await readFile(new URL('completion.json', DIR), 'utf8')),
  rows = [];
assert(
  completion.complete &&
    completion.rows === manifest.probes.length &&
    completion.repeatCount === 2 * manifest.probes.length,
);
const expectedFiles = [
  'manifest.json',
  'source-snapshot.json',
  'summary.json',
  'completion.json',
  ...manifest.probes.map((p) => `${p.input.id}.json.gz`),
];
assert.deepEqual((await readdir(DIR)).sort(), expectedFiles.sort());
assert.deepEqual(
  Object.keys(completion.artifacts).sort(),
  ['summary.json', ...manifest.probes.map((p) => `${p.input.id}.json.gz`)].sort(),
);
for (const [path, expected] of Object.entries(completion.artifacts))
  assert.equal(hash(await readFile(new URL(path, DIR))), expected, path);
for (const probe of manifest.probes) {
  const path = `${probe.input.id}.json.gz`,
    bytes = await readFile(new URL(path, DIR)),
    row = JSON.parse(gunzipSync(bytes));
  const actual = audit.repeatProbe(probe, runtime);
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), row, path);
  rows.push(row);
}
assert.deepEqual(
  JSON.parse(JSON.stringify(audit.summarize(rows))),
  JSON.parse(await readFile(new URL('summary.json', DIR), 'utf8')),
);
const integrity = await currentIntegrity(manifest);
assert(integrity.allSourcesUnchanged);
assert.deepEqual(integrity, completion.integrity);
console.log(
  JSON.stringify({
    ok: true,
    probes: rows.length,
    strictRepeatedCalls: rows.length * 2,
    allArtifactsAndSources: true,
    rasterCalls: 0,
  }),
);
