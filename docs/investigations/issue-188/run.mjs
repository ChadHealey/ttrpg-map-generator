/** Bounded immutable local capture and trusted-source replay. */
import assert from 'node:assert/strict';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

import { format } from 'prettier';

import { inputs } from './corpus.mjs';
import { capture, hash, HERE, loadTrustedRuntime, stageEntry } from './sources.mjs';

const json = (value) => format(JSON.stringify(value), { parser: 'json', printWidth: 100 });
const FILES = [
  'source-manifest.json',
  'sources.json.gz',
  'inputs.json',
  'reports.json.gz',
  'summary.json',
  'panel.png',
  'panel-half.png',
  'receipt.json',
];
const outputDirectory = (stage) => join(HERE, 'evidence', stage);
async function reconstruct(captured) {
  const { layout, evaluator, corpus } = await loadTrustedRuntime(captured);
  const declared = corpus.inputs();
  assert.deepEqual(declared, inputs(), 'Pinned corpus differs from current fixed inputs');
  const first = evaluator.evaluate(layout.buildFixture, declared),
    second = evaluator.evaluate(layout.buildFixture, corpus.inputs());
  assert.deepEqual(first, second, 'Exact repeated local geometry and image bytes');
  return first;
}
async function artifacts(result) {
  return {
    'reports.json.gz': gzipSync(Buffer.from(JSON.stringify(result.reports) + '\n')),
    'summary.json': Buffer.from(await json(result.summary)),
    ...result.images,
  };
}
export async function record(stage) {
  const captured = await capture(stage),
    directory = outputDirectory(stage);
  await mkdir(join(HERE, 'evidence'), { recursive: true });
  await mkdir(directory, { recursive: false });
  const manifest = { ...captured.manifest, inputHash: hash(await json(inputs())) };
  // These bytes exist before the first import or evaluation of new geometry.
  await writeFile(join(directory, 'source-manifest.json'), await json(manifest), { flag: 'wx' });
  await writeFile(
    join(directory, 'sources.json.gz'),
    gzipSync(Buffer.from(JSON.stringify(captured.snapshot) + '\n')),
    { flag: 'wx' },
  );
  await writeFile(join(directory, 'inputs.json'), await json(inputs()), { flag: 'wx' });
  const result = await reconstruct(captured);
  assert.deepEqual(
    (await capture(stage)).snapshot,
    captured.snapshot,
    'Source changed during capture',
  );
  const outputs = await artifacts(result);
  for (const [file, bytes] of Object.entries(outputs))
    await writeFile(join(directory, file), bytes, { flag: 'wx' });
  await writeFile(
    join(directory, 'receipt.json'),
    await json({
      stage,
      complete: true,
      cases: 2,
      passed: result.summary.passed,
      constructionErrors: result.summary.constructionErrors,
      artifacts: Object.fromEntries(
        Object.entries(outputs).map(([file, bytes]) => [file, hash(bytes)]),
      ),
    }),
    { flag: 'wx' },
  );
  return { stage, recorded: true, ...result.summary };
}
export async function verify(stage, directory = outputDirectory(stage)) {
  stageEntry(stage);
  assert.deepEqual(
    (await readdir(directory)).sort(),
    [...FILES].sort(),
    'Exact local artifact inventory',
  );
  const captured = await capture(stage),
    manifest = JSON.parse(await readFile(join(directory, 'source-manifest.json'), 'utf8'));
  assert.deepEqual(
    manifest,
    { ...captured.manifest, inputHash: hash(await json(inputs())) },
    'Retained manifest differs from trusted current stage closure',
  );
  const snapshot = JSON.parse(gunzipSync(await readFile(join(directory, 'sources.json.gz'))));
  assert.deepEqual(
    snapshot,
    captured.snapshot,
    'Retained source differs from trusted current source',
  );
  assert.equal(
    await readFile(join(directory, 'inputs.json'), 'utf8'),
    await json(inputs()),
    'Exact declared input corpus',
  );
  const receipt = JSON.parse(await readFile(join(directory, 'receipt.json'), 'utf8'));
  assert.deepEqual(
    Object.keys(receipt).sort(),
    ['stage', 'complete', 'cases', 'passed', 'constructionErrors', 'artifacts'].sort(),
  );
  assert.equal(receipt.stage, stage);
  assert.equal(receipt.complete, true);
  assert.equal(receipt.cases, 2);
  assert.deepEqual(
    Object.keys(receipt.artifacts).sort(),
    ['reports.json.gz', 'summary.json', 'panel.png', 'panel-half.png'].sort(),
  );
  const saved = {};
  for (const [file, digest] of Object.entries(receipt.artifacts)) {
    saved[file] = await readFile(join(directory, file));
    assert.equal(hash(saved[file]), digest, `Artifact hash: ${file}`);
  }
  // No retained source executes; only the trusted matching in-memory closure is loaded now.
  const result = await reconstruct(captured);
  assert.deepEqual(saved, await artifacts(result), 'Exact local receipt and image replay');
  assert.equal(receipt.passed, result.summary.passed);
  assert.equal(receipt.constructionErrors, result.summary.constructionErrors);
  assert.deepEqual(
    (await capture(stage)).snapshot,
    captured.snapshot,
    'Source changed during replay',
  );
  return {
    stage,
    verified: true,
    cases: 2,
    passed: result.summary.passed,
    images: 2,
    sources: Object.keys(captured.snapshot).length,
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert(
    process.argv.length === 4 && ['--record', '--verify'].includes(process.argv[2]),
    'Use --record/--verify components',
  );
  console.log(
    JSON.stringify(
      process.argv[2] === '--record'
        ? await record(process.argv[3])
        : await verify(process.argv[3]),
    ),
  );
}
