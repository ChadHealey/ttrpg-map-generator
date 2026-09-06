/** Read-only historical integrity check after the documented policy-only formatting transition. */
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { format } from 'prettier';

import { captureSources, IDS } from './run.mjs';
import { hash, HERE } from './runtime.mjs';

const MANIFEST_SHA256 = 'cd1ffe9c03da9284f49c45faedac3d487adf023241635779c64eb0dd278ff478';
const COMPLETION_SHA256 = '427c9ca0bdacd94c7e41d96cc819952d90059e57146e307161992f9a1b7ccbbd';
const SNAPSHOT_SHA256 = '0ac3c6be52148f860418a8886ca0de97cec4749400b2bd3e34bf937b935063d8';
const POLICY = 'docs/investigations/issue-186/policy.md';
const POLICY_SHA256 = 'a8d894cc16732639d454c58877b8dd8158af4ea60813672692b9f440b4d26db6';

/** Repair only the pinned historical list indentation, then apply the bound formatter. */
export async function formattedPolicy(original) {
  assert.equal(hash(original), POLICY_SHA256, 'Exact original policy text');
  const joinedLines = new Set([73, 74, 76, 78, 79, 80, 81, 82, 83, 90, 91, 92]),
    lines = [];
  for (const [index, line] of original.split('\n').entries()) {
    if (joinedLines.has(index + 1)) {
      assert(/^ {33}\S/.test(line), 'Exact historical continuation indentation');
      lines[lines.length - 1] += ' ' + line.slice(33);
    } else lines.push(line);
  }
  const options = { parser: 'markdown', printWidth: 100 },
    result = await format(lines.join('\n'), options);
  assert.equal(await format(result, options), result, 'Stable policy formatting');
  assert.equal(result.replace(/\s/g, ''), original.replace(/\s/g, ''), 'Policy text unchanged');
  return result;
}

/** Validate the exact original authority against current trusted source, with one doc-only rule. */
export async function validateRetainedAuthority(manifestBytes, snapshot, trusted) {
  assert.equal(hash(manifestBytes), MANIFEST_SHA256, 'Exact pre-field manifest authority');
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.sources[POLICY], POLICY_SHA256, 'Exact original policy authority');
  assert.deepEqual(Object.keys(snapshot).sort(), Object.keys(manifest.sources).sort());
  for (const [path, digest] of Object.entries(manifest.sources))
    assert.equal(hash(snapshot[path]), digest, `Captured source digest: ${path}`);
  assert.equal(
    await formattedPolicy(snapshot[POLICY]),
    trusted.snapshot[POLICY],
    'Only the declared Prettier policy formatting transition is permitted',
  );
  const expectedSnapshot = { ...trusted.snapshot, [POLICY]: snapshot[POLICY] };
  assert.deepEqual(snapshot, expectedSnapshot, 'Every other current trusted source remains exact');
  const expectedManifest = {
    ...trusted.manifest,
    sources: { ...trusted.manifest.sources, [POLICY]: POLICY_SHA256 },
  };
  assert.deepEqual(manifest, expectedManifest, 'All remaining manifest fields remain exact');
  return {
    policy: POLICY,
    capturedSha256: POLICY_SHA256,
    currentFormattedSha256: hash(trusted.snapshot[POLICY]),
  };
}
export async function verifyRetainedEvidence(directory = join(HERE, 'evidence-r1')) {
  const trusted = await captureSources(),
    manifestBytes = await readFile(join(directory, 'source-manifest.json')),
    snapshotBytes = await readFile(join(directory, 'source-snapshot.json.gz')),
    completionBytes = await readFile(join(directory, 'completion.json'));
  assert.equal(hash(snapshotBytes), SNAPSHOT_SHA256, 'Exact original compressed snapshot');
  assert.equal(hash(completionBytes), COMPLETION_SHA256, 'Exact original completion authority');
  const snapshot = JSON.parse(gunzipSync(snapshotBytes)),
    transition = await validateRetainedAuthority(manifestBytes, snapshot, trusted),
    completion = JSON.parse(completionBytes);
  assert.deepEqual(Object.keys(completion).sort(), [
    'artifacts',
    'complete',
    'sourceManifestSha256',
  ]);
  assert.equal(completion.complete, true);
  assert.equal(completion.sourceManifestSha256, MANIFEST_SHA256);
  const outputs = [
    'synthetics.json',
    'decision.json',
    ...IDS.flatMap((id) =>
      ['preview', 'full'].flatMap((profile) => [
        `${id}-${profile}.json`,
        `${id}-${profile}-rings.json.gz`,
      ]),
    ),
  ];
  assert.deepEqual(Object.keys(completion.artifacts).sort(), outputs.sort());
  assert.deepEqual(
    (await readdir(directory)).sort(),
    [...outputs, 'completion.json', 'source-manifest.json', 'source-snapshot.json.gz'].sort(),
  );
  for (const [file, digest] of Object.entries(completion.artifacts))
    assert.equal(hash(await readFile(join(directory, file))), digest, `Retained artifact: ${file}`);
  assert.deepEqual(await captureSources(), trusted, 'Trusted source changed during verification');
  return {
    verified: true,
    replay: false,
    evaluatedFieldSamples: 0,
    sources: Object.keys(snapshot).length,
    outputArtifacts: outputs.length,
    sourceManifestSha256: MANIFEST_SHA256,
    formattingTransition: transition,
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 2, 'Use verify-retained.mjs without arguments');
  console.log(JSON.stringify(await verifyRetainedEvidence()));
}
