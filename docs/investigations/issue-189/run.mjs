/** Manifest-first, fixed D3 pass; computational replay is separate from hashes-only checks. */
import assert from 'node:assert/strict';
import { mkdir, readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

import { format, version as prettierVersion } from 'prettier';
import ts from 'typescript';

import { BUDGET, corpus } from './corpus.mjs';
import { sampleField, semantic } from './measure.mjs';
import { Budget, evaluateRows } from './pipeline.mjs';
import { hash, HERE, loadRuntime, ROOT, runtimeSources } from './runtime.mjs';
export const CHECKPOINT = 'docs/investigations/issue-184/comparison-r2';
export const PINS = {
  'manifest.json': 'd22fdb4517ccbecfde3ce5e7501a2dd607ec1607479c8e3a62b7127d5092c5ac',
  'results.json': '7e2e81a9e6395f5d6902190319c3e823076fdeb53eb7d807efee415a126a5bee',
};
const FROZEN_ENTRIES = [
  'issue-184/templates.mjs',
  'issue-170/placement.mjs',
  'issue-169/field.mjs',
  'issue-180/audit-final.mjs',
  'issue-178/certificates.mjs',
  'issue-164/morphology.mjs',
  'issue-169/geometry.mjs',
].map((x) => 'docs/investigations/' + x);
const FIXED = [
  'runtime.mjs',
  'bridge.ts',
  'corpus.mjs',
  'metrics.mjs',
  'pipeline.mjs',
  'measure.mjs',
  'run.mjs',
  'policy.md',
  'implementation-notes.md',
  'independent-design-review.md',
  'independent-source-review.md',
  'tsconfig.json',
  'harness.test.mjs',
  'evidence.test.mjs',
]
  .map((x) => 'docs/investigations/issue-189/' + x)
  .concat([
    'packages/core/package.json',
    'packages/generation/package.json',
    'package.json',
    'pnpm-lock.yaml',
    'tsconfig.base.json',
    'docs/investigations/issue-181/child-plan.md',
    'docs/investigations/issue-181/production-contract.md',
    'docs/investigations/issue-180/findings.md',
    'docs/investigations/issue-186/findings.md',
  ]);
export const json = (value) => format(JSON.stringify(value), { parser: 'json', printWidth: 100 });
async function trustedRead(file) {
  assert(
    !file.startsWith('/') && !file.includes('\\') && resolve(ROOT, file) === join(ROOT, file),
    'Noncanonical source path',
  );
  const actual = await realpath(join(ROOT, file));
  assert(actual.startsWith(ROOT + sep), 'Escaped source root');
  return readFile(actual, 'utf8');
}
export async function checkpoint() {
  const bytes = {};
  for (const [name, pin] of Object.entries(PINS)) {
    bytes[name] = await readFile(join(ROOT, CHECKPOINT, name));
    assert.equal(hash(bytes[name]), pin, 'Frozen checkpoint changed');
  }
  const manifest = JSON.parse(bytes['manifest.json']),
    results = JSON.parse(bytes['results.json']);
  assert.equal(manifest.revision, 'issue-184-world-r2');
  assert.equal(results.revision, manifest.revision);
  assert.deepEqual(results.sources, manifest.sources);
  assert.equal(
    manifest.sources['templates.mjs'],
    '9020f000f78edc226fd08fa507c6d87ddb6fbcd69be2db06ec176463d4d6a26f',
  );
  return { manifest, reference: { directory: CHECKPOINT, pins: PINS } };
}
export async function frozenSources(manifest) {
  const pending = [...FROZEN_ENTRIES],
    sources = {};
  while (pending.length) {
    const file = pending.shift();
    if (Object.hasOwn(sources, file)) continue;
    assert(
      /^docs\/investigations\/issue-\d+\/[a-z0-9-]+\.mjs$/.test(file),
      'Unexpected frozen source',
    );
    const text = await trustedRead(file);
    const key = relative(join(ROOT, 'docs/investigations/issue-184'), join(ROOT, file))
      .split(sep)
      .join('/');
    assert.equal(hash(text), manifest.sources[key], `Frozen source changed: ${file}`);
    sources[file] = text;
    const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    assert.equal(tree.parseDiagnostics.length, 0);
    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
        assert(ts.isStringLiteral(node.moduleSpecifier));
        const name = node.moduleSpecifier.text;
        if (['node:crypto', 'node:assert/strict'].includes(name)) return;
        assert(
          name.startsWith('.') && name.endsWith('.mjs'),
          `Unexpected frozen import ${name} in ${file}`,
        );
        pending.push(relative(ROOT, resolve(ROOT, dirname(file), name)));
      }
      assert(
        !(ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword),
        'Unexpected frozen dynamic import',
      );
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
  return sources;
}
export async function captureSources() {
  const frozen = await checkpoint(),
    runtime = await runtimeSources(),
    geometry = await frozenSources(frozen.manifest),
    sources = { ...runtime, ...geometry };
  for (const file of FIXED) sources[file] = await trustedRead(file);
  const snapshot = Object.fromEntries(Object.entries(sources).sort(([a], [b]) => (a < b ? -1 : 1)));
  return {
    runtime,
    snapshot,
    manifest: {
      revision: 'issue-189-D3-r1',
      checkpoint: frozen.reference,
      nodeVersion: process.versions.node,
      typescriptVersion: ts.version,
      prettierVersion,
      inputs: corpus(),
      budget: BUDGET,
      sources: Object.fromEntries(Object.entries(snapshot).map(([f, s]) => [f, hash(s)])),
    },
  };
}
export async function verifyAuthority(directory) {
  const trusted = await captureSources(),
    manifest = JSON.parse(await readFile(join(directory, 'source-manifest.json'))),
    snapshot = JSON.parse(gunzipSync(await readFile(join(directory, 'source-snapshot.json.gz'))));
  assert.deepEqual(manifest, trusted.manifest, 'Manifest differs from trusted authority');
  assert.deepEqual(snapshot, trusted.snapshot, 'Snapshot differs from trusted current closure');
  return trusted;
}
async function runtimeFor(captured) {
  const loaded = await loadRuntime(captured.runtime);
  try {
    const modules = await Promise.all(
      FROZEN_ENTRIES.map((f) => import(pathToFileURL(join(ROOT, f)).href)),
    );
    return { ...loaded, ...Object.assign({}, ...modules), sampleField, semantic };
  } catch (e) {
    await loaded.close();
    throw e;
  }
}
async function evaluate(captured, visit) {
  const runtime = await runtimeFor(captured);
  try {
    return await evaluateRows(runtime, new Budget(), async (name, value) =>
      visit(name, Buffer.isBuffer(value) ? value : await json(value)),
    );
  } finally {
    await runtime.close();
  }
}
export async function prepare(directory) {
  const captured = await captureSources();
  await mkdir(directory);
  await writeFile(join(directory, 'source-manifest.json'), await json(captured.manifest), {
    flag: 'wx',
  });
  await writeFile(
    join(directory, 'source-snapshot.json.gz'),
    gzipSync(Buffer.from(JSON.stringify(captured.snapshot))),
    { flag: 'wx' },
  );
  return {
    prepared: true,
    sources: Object.keys(captured.snapshot).length,
    manifestSha256: hash(await readFile(join(directory, 'source-manifest.json'))),
    budget: BUDGET,
  };
}
export async function runEvidence(directory) {
  const captured = await verifyAuthority(directory);
  assert.deepEqual((await readdir(directory)).sort(), [
    'source-manifest.json',
    'source-snapshot.json.gz',
  ]);
  const artifacts = {};
  await evaluate(captured, async (name, bytes) => {
    await writeFile(join(directory, name), bytes, { flag: 'wx' });
    artifacts[name] = hash(bytes);
  });
  assert.deepEqual(
    (await captureSources()).manifest,
    captured.manifest,
    'Sources changed during pass',
  );
  await writeFile(
    join(directory, 'completion.json'),
    await json({
      complete: true,
      artifacts,
      sourceManifestSha256: hash(await readFile(join(directory, 'source-manifest.json'))),
    }),
    { flag: 'wx' },
  );
}
export function expectedArtifacts(decision) {
  assert.equal(decision.revision, 'issue-189-D3-r1');
  assert.equal(decision.selectedProposal, null);
  assert.equal(decision.fullPublicDomainSupported, false);
  assert(
    Array.isArray(decision.fields) &&
      decision.fields.length <= 18 &&
      new Set(decision.fields).size === decision.fields.length &&
      decision.fields.every((k) => /^[a-f0-9]{64}$/.test(k)),
  );
  assert.deepEqual(
    decision.rows.map((r) => r.id),
    corpus().map((r) => r.id),
  );
  for (const [key, max] of Object.entries(new Budget().counts)) {
    assert.equal(max, 0);
    assert(
      Number.isSafeInteger(decision.counts[key]) &&
        decision.counts[key] >= 0 &&
        decision.counts[key] <= BUDGET[key],
    );
  }
  assert.equal(decision.counts.uniqueFieldCalls, decision.fields.length);
  return [
    'decision.json',
    ...corpus().map((r) => r.id + '.json'),
    ...decision.fields.flatMap((k) => [`field-${k}.json`, `field-${k}.bits`]),
  ].sort();
}
export async function verifyEvidence(directory, { replay = false } = {}) {
  const captured = await verifyAuthority(directory),
    completion = JSON.parse(await readFile(join(directory, 'completion.json'))),
    decision = JSON.parse(await readFile(join(directory, 'decision.json')));
  const expected = expectedArtifacts(decision);
  assert.equal(completion.complete, true);
  assert.equal(
    completion.sourceManifestSha256,
    hash(await readFile(join(directory, 'source-manifest.json'))),
  );
  assert.deepEqual(
    Object.keys(completion.artifacts).sort(),
    expected,
    'Missing/extra artifact hashes',
  );
  assert.deepEqual(
    (await readdir(directory)).sort(),
    [...expected, 'completion.json', 'source-manifest.json', 'source-snapshot.json.gz'].sort(),
  );
  for (const file of expected)
    assert.equal(hash(await readFile(join(directory, file))), completion.artifacts[file], file);
  for (const input of corpus()) {
    const receipt = JSON.parse(await readFile(join(directory, input.id + '.json')));
    assert.deepEqual(receipt.input, input, 'Row/input changed');
    assert.equal(receipt.inputValid, true);
    assert.equal(receipt.status, decision.rows.find((r) => r.id === input.id).status);
    if (receipt.fieldKey !== null)
      assert(decision.fields.includes(receipt.fieldKey) || receipt.status === 'dedup-no-proposal');
  }
  if (replay)
    await evaluate(captured, async (name, bytes) =>
      assert.equal(hash(bytes), completion.artifacts[name], `Replay differs: ${name}`),
    );
  assert.deepEqual((await captureSources()).manifest, captured.manifest);
  return {
    verified: true,
    replay,
    sources: Object.keys(captured.snapshot).length,
    rows: decision.rows.length,
    counts: decision.counts,
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2],
    directory = join(HERE, 'evidence-r1');
  assert(['--prepare', '--run', '--verify', '--hashes-only'].includes(mode));
  if (mode === '--prepare') console.log(JSON.stringify(await prepare(directory)));
  else if (mode === '--run') await runEvidence(directory);
  else
    console.log(JSON.stringify(await verifyEvidence(directory, { replay: mode === '--verify' })));
}
