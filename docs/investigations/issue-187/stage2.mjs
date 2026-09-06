/** Authoritative second-state entry. The captured first-state writer remains historical. */
import assert from 'node:assert/strict';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

import { format } from 'prettier';

import { inputs } from './corpus.mjs';
import { verify as verifyFirst } from './run.mjs';
import { capture, hash, HERE, loadTrustedRuntime, ROOT } from './sources.mjs';

const PREFIX = 'docs/investigations/issue-187/';
const PATHS = Object.freeze({
  guard: PREFIX + 'stage2.mjs',
  design: PREFIX + 'states/state-2/design.md',
  review: PREFIX + 'independent-design-review-state2.md',
  diagnosis: PREFIX + 'states/state-2/prior-disposition.md',
  priorReview: PREFIX + 'independent-local-review-state1.md',
  priorManifest: PREFIX + 'evidence/state-1/source-manifest.json',
  priorReceipt: PREFIX + 'evidence/state-1/receipt.json',
  priorSummary: PREFIX + 'evidence/state-1/summary.json',
  authorization: PREFIX + 'states/state-2/authorization.json',
});
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
const json = (value) => format(JSON.stringify(value), { parser: 'json', printWidth: 100 });
const directory = join(HERE, 'evidence/state-2');

/** Pure boundary for negative tests; caller supplies the exact fixed-path current text map. */
export function validatePrerequisites(texts) {
  assert.deepEqual(
    Object.keys(texts).sort(),
    Object.keys(PATHS).sort(),
    'Complete prerequisite inventory',
  );
  for (const [key, value] of Object.entries(texts))
    assert(typeof value === 'string' && value.trim(), `Missing prerequisite: ${key}`);
  const receipt = JSON.parse(texts.priorReceipt),
    summary = JSON.parse(texts.priorSummary),
    priorManifest = JSON.parse(texts.priorManifest),
    authorization = JSON.parse(texts.authorization);
  assert.equal(receipt.stage, 'state-1');
  assert.equal(receipt.complete, true);
  assert.equal(receipt.cases, 60);
  assert.equal(summary.total, 60);
  assert.equal(priorManifest.stage, 'state-1');
  const expected = {
    stage: 'state-2',
    predecessor: 'state-1',
    predecessorDisposition: 'rejected-local-R3',
    assistantDesignReview: 'cleared-for-fixed-60-case-local-experiment',
    hashes: Object.fromEntries(
      Object.keys(PATHS)
        .filter((key) => key !== 'authorization')
        .map((key) => [key, hash(texts[key])]),
    ),
  };
  assert.deepEqual(
    authorization,
    expected,
    'Second-state declaration or prerequisite hashes differ',
  );
  return expected;
}
async function prerequisites() {
  const texts = Object.fromEntries(
    await Promise.all(
      Object.entries(PATHS).map(async ([key, path]) => [
        key,
        await readFile(resolve(ROOT, path), 'utf8'),
      ]),
    ),
  );
  return { texts, declaration: validatePrerequisites(texts) };
}
async function captureSecond() {
  // Missing design/review/first diagnosis fails before any new geometry graph is loaded.
  const prereq = await prerequisites(),
    base = await capture('state-2');
  const snapshot = { ...base.snapshot };
  for (const [key, path] of Object.entries(PATHS)) snapshot[path] = prereq.texts[key];
  const ordered = Object.fromEntries(Object.entries(snapshot).sort(([a], [b]) => (a < b ? -1 : 1)));
  return {
    ...base,
    snapshot: ordered,
    manifest: {
      ...base.manifest,
      revision: 'issue-187-second-state-guard-r1',
      inputHash: hash(await json(inputs())),
      declaration: prereq.declaration,
      sources: Object.fromEntries(
        Object.entries(ordered).map(([path, text]) => [path, hash(text)]),
      ),
    },
  };
}
async function reconstruct(captured) {
  const { layout, evaluator, corpus } = await loadTrustedRuntime(captured);
  assert.deepEqual(corpus.inputs(), inputs());
  const result = evaluator.evaluate(layout.buildCoast, corpus.inputs());
  assert.deepEqual(
    result,
    evaluator.evaluate(layout.buildCoast, corpus.inputs()),
    'Exact second-state repeat',
  );
  return result;
}
async function artifacts(result) {
  return {
    'reports.json.gz': gzipSync(Buffer.from(JSON.stringify(result.reports) + '\n')),
    'summary.json': Buffer.from(await json(result.summary)),
    ...result.images,
  };
}
export async function recordSecond() {
  const captured = await captureSecond();
  await verifyFirst('state-1'); // All retained predecessor artifacts/source must actually replay.
  assert.deepEqual(
    (await captureSecond()).manifest,
    captured.manifest,
    'Prerequisites changed before capture',
  );
  await mkdir(directory, { recursive: false });
  await writeFile(join(directory, 'source-manifest.json'), await json(captured.manifest), {
    flag: 'wx',
  });
  await writeFile(
    join(directory, 'sources.json.gz'),
    gzipSync(Buffer.from(JSON.stringify(captured.snapshot) + '\n')),
    { flag: 'wx' },
  );
  await writeFile(join(directory, 'inputs.json'), await json(inputs()), { flag: 'wx' });
  const result = await reconstruct(captured);
  assert.deepEqual(
    (await captureSecond()).manifest,
    captured.manifest,
    'Source or prerequisites changed during execution',
  );
  const outputs = await artifacts(result);
  for (const [file, bytes] of Object.entries(outputs))
    await writeFile(join(directory, file), bytes, { flag: 'wx' });
  await writeFile(
    join(directory, 'receipt.json'),
    await json({
      stage: 'state-2',
      guardRevision: 'issue-187-second-state-guard-r1',
      complete: true,
      cases: 60,
      passed: result.summary.passed,
      constructionErrors: result.summary.constructionErrors,
      sourceManifestSha256: hash(await json(captured.manifest)),
      artifacts: Object.fromEntries(
        Object.entries(outputs).map(([file, bytes]) => [file, hash(bytes)]),
      ),
    }),
    { flag: 'wx' },
  );
  return { stage: 'state-2', recorded: true, ...result.summary };
}
export async function verifySecond(target = directory) {
  assert.deepEqual(
    (await readdir(target)).sort(),
    [...FILES].sort(),
    'Exact second-state artifact inventory',
  );
  const captured = await captureSecond(),
    savedManifest = await readFile(join(target, 'source-manifest.json'));
  assert.deepEqual(
    JSON.parse(savedManifest),
    captured.manifest,
    'Retained manifest differs from trusted second-state closure and prerequisites',
  );
  assert.deepEqual(
    JSON.parse(gunzipSync(await readFile(join(target, 'sources.json.gz')))),
    captured.snapshot,
    'Exact trusted second-state source text',
  );
  assert.equal(await readFile(join(target, 'inputs.json'), 'utf8'), await json(inputs()));
  const receipt = JSON.parse(await readFile(join(target, 'receipt.json')));
  assert.deepEqual(
    Object.keys(receipt).sort(),
    [
      'stage',
      'guardRevision',
      'complete',
      'cases',
      'passed',
      'constructionErrors',
      'sourceManifestSha256',
      'artifacts',
    ].sort(),
  );
  assert.equal(receipt.stage, 'state-2');
  assert.equal(receipt.guardRevision, 'issue-187-second-state-guard-r1');
  assert.equal(receipt.complete, true);
  assert.equal(receipt.cases, 60);
  assert.equal(receipt.sourceManifestSha256, hash(savedManifest));
  assert.deepEqual(
    Object.keys(receipt.artifacts).sort(),
    ['reports.json.gz', 'summary.json', 'panel.png', 'panel-half.png'].sort(),
  );
  const saved = {};
  for (const [file, digest] of Object.entries(receipt.artifacts)) {
    saved[file] = await readFile(join(target, file));
    assert.equal(hash(saved[file]), digest, `Artifact hash: ${file}`);
  }
  await verifyFirst('state-1');
  const result = await reconstruct(captured);
  assert.deepEqual(saved, await artifacts(result), 'Exact second-state receipt and image replay');
  assert.equal(receipt.passed, result.summary.passed);
  assert.equal(receipt.constructionErrors, result.summary.constructionErrors);
  assert.deepEqual(
    (await captureSecond()).manifest,
    captured.manifest,
    'Source or prerequisites changed during replay',
  );
  return {
    verified: true,
    stage: 'state-2',
    cases: 60,
    passed: result.summary.passed,
    images: 2,
    predecessorVerified: true,
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert(
    process.argv.length === 3 && ['--record', '--verify'].includes(process.argv[2]),
    'Use stage2.mjs --record or --verify',
  );
  console.log(
    JSON.stringify(process.argv[2] === '--record' ? await recordSecond() : await verifySecond()),
  );
}
