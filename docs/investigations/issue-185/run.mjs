/** Immutable private seed vectors; verification binds current trusted source before execution. */
import assert from 'node:assert/strict';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

import { format, version as prettierVersion } from 'prettier';
import ts from 'typescript';

import { runMatrix } from './matrix.mjs';
import { hash, HERE, loadRuntime, ROOT, runtimeSources } from './runtime.mjs';

const REVISION = 'issue-185-scopes-r1';
const FIXED = [
  'docs/investigations/issue-185/runtime.mjs',
  'docs/investigations/issue-185/matrix.mjs',
  'docs/investigations/issue-185/run.mjs',
  'docs/investigations/issue-185/registry.md',
  'docs/investigations/issue-185/tsconfig.json',
  'packages/core/package.json',
  'package.json',
  'pnpm-lock.yaml',
  'docs/investigations/issue-181/production-contract.md',
  'docs/investigations/issue-181/child-plan.md',
  'docs/investigations/issue-179/templates-r2.mjs',
  'docs/investigations/issue-182/templates.mjs',
  'docs/investigations/issue-170/placement.mjs',
  'packages/generation/src/atlas-land-water-generator-contract.ts',
  'packages/generation/src/atlas-land-water-generator-metadata.ts',
];
const FILES = [
  'source-manifest.json',
  'source-snapshot.json.gz',
  'vectors.json.gz',
  'matrix.json',
  'receipt.json',
];
const json = (value) => format(JSON.stringify(value), { parser: 'json', printWidth: 100 });
export async function capture() {
  const runtime = await runtimeSources();
  const snapshot = { ...runtime };
  for (const file of FIXED) snapshot[file] = await readFile(join(ROOT, file), 'utf8');
  const ordered = Object.fromEntries(Object.entries(snapshot).sort(([a], [b]) => (a < b ? -1 : 1)));
  return {
    runtime,
    snapshot: ordered,
    manifest: {
      revision: REVISION,
      typescriptVersion: ts.version,
      prettierVersion,
      nodeVersion: process.versions.node,
      sources: Object.fromEntries(
        Object.entries(ordered).map(([file, source]) => [file, hash(source)]),
      ),
    },
  };
}
async function evaluate(captured) {
  const loaded = await loadRuntime(captured.runtime);
  try {
    return runMatrix(loaded.registry, loaded.core);
  } finally {
    await loaded.close();
  }
}
async function artifacts(result) {
  const { vectors, ...matrix } = result;
  return {
    'vectors.json.gz': gzipSync(Buffer.from(JSON.stringify(vectors) + '\n')),
    'matrix.json': Buffer.from(await json(matrix)),
  };
}
export async function recordEvidence() {
  const directory = join(HERE, 'evidence-r1');
  const captured = await capture();
  await mkdir(directory, { recursive: false });
  await writeFile(join(directory, 'source-manifest.json'), await json(captured.manifest));
  await writeFile(
    join(directory, 'source-snapshot.json.gz'),
    gzipSync(Buffer.from(JSON.stringify(captured.snapshot) + '\n')),
  );
  const result = await evaluate(captured);
  assert.deepEqual(
    (await capture()).snapshot,
    captured.snapshot,
    'Source changed during vector execution',
  );
  const outputs = await artifacts(result);
  for (const [file, bytes] of Object.entries(outputs))
    await writeFile(join(directory, file), bytes);
  await writeFile(
    join(directory, 'receipt.json'),
    await json({
      revision: REVISION,
      sourceHashesVerified: true,
      artifacts: Object.fromEntries(
        Object.entries(outputs).map(([file, bytes]) => [file, hash(bytes)]),
      ),
      matrixRows: result.matrix.length,
      vectors: result.vectors.length,
    }),
  );
  return {
    recorded: true,
    matrixRows: result.matrix.length,
    vectors: result.vectors.length,
    sources: Object.keys(captured.snapshot).length,
  };
}
export async function verifyEvidence(directory = join(HERE, 'evidence-r1')) {
  assert.deepEqual(
    (await readdir(directory)).sort(),
    [...FILES].sort(),
    'Exact evidence file inventory',
  );
  const captured = await capture();
  const manifest = JSON.parse(await readFile(join(directory, 'source-manifest.json'), 'utf8'));
  assert.deepEqual(
    manifest,
    captured.manifest,
    'Captured source manifest differs from trusted current closure',
  );
  const snapshot = JSON.parse(
    gunzipSync(await readFile(join(directory, 'source-snapshot.json.gz'))),
  );
  assert.deepEqual(
    snapshot,
    captured.snapshot,
    'Captured source text differs from trusted current closure',
  );
  const receipt = JSON.parse(await readFile(join(directory, 'receipt.json'), 'utf8'));
  assert.deepEqual(
    Object.keys(receipt).sort(),
    ['revision', 'sourceHashesVerified', 'artifacts', 'matrixRows', 'vectors'].sort(),
    'Receipt fields',
  );
  assert.equal(receipt.revision, REVISION);
  assert.equal(receipt.sourceHashesVerified, true);
  assert.deepEqual(Object.keys(receipt.artifacts).sort(), ['matrix.json', 'vectors.json.gz']);
  const saved = {};
  for (const file of ['matrix.json', 'vectors.json.gz']) {
    saved[file] = await readFile(join(directory, file));
    assert.equal(hash(saved[file]), receipt.artifacts[file], `Artifact hash: ${file}`);
  }
  // Only the trusted current public-entry closure is compiled after all retained source checks.
  const result = await evaluate(captured),
    expected = await artifacts(result);
  assert.deepEqual(saved, expected, 'Exact canonical vector/matrix replay');
  assert.equal(receipt.matrixRows, result.matrix.length);
  assert.equal(receipt.vectors, result.vectors.length);
  assert.deepEqual(
    (await capture()).snapshot,
    captured.snapshot,
    'Source changed during verification',
  );
  return {
    verified: true,
    matrixRows: result.matrix.length,
    vectors: result.vectors.length,
    sources: Object.keys(snapshot).length,
    execution:
      'Trusted current source only; no retained source execution, geometry, world render or production adoption.',
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert(
    process.argv.length === 3 && ['--record', '--verify'].includes(process.argv[2]),
    'Use run.mjs --record or --verify',
  );
  console.log(
    JSON.stringify(
      process.argv[2] === '--record' ? await recordEvidence() : await verifyEvidence(),
    ),
  );
}
