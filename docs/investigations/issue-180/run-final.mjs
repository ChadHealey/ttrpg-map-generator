/** Manifest-first bounded audit. --verify is read-only and replays the complete frozen corpus. */
import assert from 'node:assert/strict';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { posix } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

import { format, resolveConfig } from 'prettier';

import { captureSources, hash, loadSnapshot } from '../issue-177/local-evidence.mjs';
import { corpus } from './corpus.mjs';

const BASE = new URL('.', import.meta.url),
  DIR = new URL('evidence-final/', BASE),
  prefix = '../issue-180/';
const entries = [
  '../issue-179/templates-r2.mjs',
  '../issue-170/placement.mjs',
  '../issue-178/certificates.mjs',
  '../issue-164/morphology.mjs',
  '../issue-169/geometry.mjs',
  '../issue-169/field.mjs',
  prefix + 'audit-final.mjs',
  prefix + 'corpus.mjs',
];
const config = await resolveConfig(new URL('run.json', BASE).pathname);
const json = (value) => format(JSON.stringify(value), { ...config, parser: 'json' });
async function save(path, value) {
  await writeFile(new URL(path, DIR), await json(value), { flag: 'wx' });
}
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
    'run-final.mjs',
  ]);
  for (const path of ['run-final.mjs', '../issue-177/local-evidence.mjs'])
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
    audit = await loadSnapshot(prefix + 'audit-final.mjs', snapshot),
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
const mode = process.argv[2];
assert(
  ['--prepare', '--run', '--verify', '--show'].includes(mode),
  'Use --prepare|--run|--verify|--show',
);
if (mode === '--prepare') {
  const probes = corpus(),
    previous = JSON.parse(
      await readFile(new URL('../issue-179/local-diagnostics/inputs.json', BASE), 'utf8'),
    );
  assert.equal(probes.filter((p) => p.cohort === 'additional-default').length, 128);
  assert.equal(probes.filter((p) => p.cohort === 'control').length, 32);
  assert.equal(new Set(probes.map((p) => p.input.id)).size, 160);
  const seeds = probes.filter((p) => p.cohort === 'additional-default').map((p) => p.input.seed);
  assert.equal(new Set(seeds).size, 128);
  assert(seeds.every((seed) => !previous.some((p) => p.seed === seed)));
  const snapshot = Object.assign(
    {},
    ...(await Promise.all(entries.map((entry) => captureSources(entry)))),
  );
  const frozen = JSON.parse(
    await readFile(new URL('../issue-179/comparison-r2/manifest.json', BASE), 'utf8'),
  );
  const comparisonMatches = [];
  for (const [path, source] of Object.entries(snapshot)) {
    const historical = posix.relative('../issue-179', path);
    if (frozen.sources[historical]) {
      assert.equal(hash(source), frozen.sources[historical], `Frozen r2 changed: ${historical}`);
      comparisonMatches.push(historical);
    }
  }
  assert(
    comparisonMatches.includes('templates-r2.mjs') &&
      comparisonMatches.includes('../issue-170/placement.mjs'),
  );
  const sourceText = await json(snapshot),
    sourceHashes = Object.fromEntries(
      Object.entries(snapshot).map(([path, source]) => [path, hash(source)]),
    );
  const verifierDependencies = {};
  for (const path of ['run-final.mjs', '../issue-177/local-evidence.mjs'])
    verifierDependencies[path] = hash(await readFile(new URL(path, BASE)));
  await mkdir(DIR);
  await writeFile(new URL('source-snapshot.json', DIR), sourceText, { flag: 'wx' });
  await save('manifest.json', {
    revision: 'issue-180-audit-r2',
    scope:
      'Construction and bounded placement only; no raster or production/semantic qualification',
    ordering: '128 additional decimal default seeds, then 32 predeclared same-seed control probes',
    probes,
    previousSeeds: previous.map((p) => p.seed),
    sourceHashes,
    sourceSnapshotSha256: hash(sourceText),
    verifierDependencies,
    frozen179RuntimeMatches: comparisonMatches,
    budgets: {
      additionalDefaults: 128,
      controls: 32,
      templateCandidatesPerOwner: 12,
      placementAttempts: 64,
      directionsPerOwner: 128,
      refinementSweeps: 64,
      maximumOwners: 8,
      maximumIslandsPerOwner: 11,
      uniqueVerticesPerOwner: 256,
      rasters: 0,
    },
    repeatPolicy:
      'Two complete independent calls per probe; strict deep equality before lossless JSON/gzip artifact serialization',
  });
  console.log(
    JSON.stringify({
      prepared: true,
      probes: probes.length,
      defaultSeeds: 128,
      controls: 32,
      priorFrozenSourcesMatched: comparisonMatches.length,
    }),
  );
} else if (mode === '--run') {
  const { manifest, runtime, audit } = await load();
  assert.deepEqual(
    (await readdir(DIR)).sort(),
    ['manifest.json', 'source-snapshot.json'],
    'Run requires fresh prepared evidence directory',
  );
  const rows = [],
    artifacts = {};
  for (const probe of manifest.probes) {
    const row = audit.repeatProbe(probe, runtime),
      path = `${probe.input.id}.json.gz`,
      bytes = gzipSync(Buffer.from(JSON.stringify(row)), { level: 9 });
    await writeFile(new URL(path, DIR), bytes, { flag: 'wx' });
    artifacts[path] = hash(bytes);
    rows.push(row);
    if (rows.length % 16 === 0)
      console.log(JSON.stringify({ completed: rows.length, total: manifest.probes.length }));
  }
  const summary = audit.summarize(rows),
    integrity = await currentIntegrity(manifest);
  assert(integrity.allSourcesUnchanged);
  await save('summary.json', summary);
  artifacts['summary.json'] = hash(await readFile(new URL('summary.json', DIR)));
  await save('completion.json', {
    complete: true,
    rows: rows.length,
    repeatCount: rows.length * 2,
    artifacts,
    integrity,
  });
  console.log(JSON.stringify(summary.cohorts));
} else if (mode === '--verify') {
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
    audit.summarize(rows),
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
} else {
  const id = process.argv[3];
  assert(/^(default-\d{3}|control-[a-z0-9-]+)$/.test(id), 'Declared input id required');
  const row = JSON.parse(gunzipSync(await readFile(new URL(`${id}.json.gz`, DIR))));
  console.log(await json(row));
}
