import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { test } from 'vitest';

import { captureSources } from './run.mjs';
import { hash, HERE } from './runtime.mjs';
import { validateRetainedAuthority, verifyRetainedEvidence } from './verify-retained.mjs';

const evidence = join(HERE, 'evidence-r1');
async function authority() {
  return [
    await readFile(join(evidence, 'source-manifest.json')),
    JSON.parse(gunzipSync(await readFile(join(evidence, 'source-snapshot.json.gz')))),
    await captureSources(),
  ];
}
test('exact retained authority permits only the declared policy formatting transition', async () => {
  const result = await verifyRetainedEvidence();
  assert.equal(result.verified, true);
  assert.equal(result.replay, false);
  assert.equal(result.evaluatedFieldSamples, 0);
  assert.equal(result.sources, 116);
  assert.equal(result.outputArtifacts, 26);
  assert.notEqual(
    result.formattingTransition.capturedSha256,
    result.formattingTransition.currentFormattedSha256,
  );
});
test('changed current policy meaning and changed executable source both reject', async () => {
  const [manifest, snapshot, trusted] = await authority();
  const changedPolicy = structuredClone(trusted);
  changedPolicy.snapshot['docs/investigations/issue-186/policy.md'] += '\nA different policy.\n';
  await assert.rejects(
    validateRetainedAuthority(manifest, snapshot, changedPolicy),
    /formatting transition/,
  );
  const changedSource = structuredClone(trusted);
  changedSource.snapshot['docs/investigations/issue-186/policy.ts'] +=
    '\nthrow Error("untrusted");';
  await assert.rejects(
    validateRetainedAuthority(manifest, snapshot, changedSource),
    /Every other current trusted source/,
  );
});
test('coherently rehashed captured source cannot replace original manifest authority', async () => {
  const [bytes, snapshot, trusted] = await authority(),
    manifest = JSON.parse(bytes),
    key = 'docs/investigations/issue-186/policy.ts';
  snapshot[key] += '\nthrow Error("untrusted");';
  manifest.sources[key] = hash(snapshot[key]);
  await assert.rejects(
    validateRetainedAuthority(Buffer.from(JSON.stringify(manifest)), snapshot, trusted),
    /pre-field manifest authority/,
  );
});
test('changed checkpoint or tool metadata cannot pass the doc-only exception', async () => {
  const [bytes, snapshot, trusted] = await authority();
  for (const key of ['nodeVersion', 'typescriptVersion', 'prettierVersion']) {
    const changed = structuredClone(trusted);
    changed.manifest[key] = 'different';
    await assert.rejects(validateRetainedAuthority(bytes, snapshot, changed), /manifest fields/);
  }
  const changed = structuredClone(trusted);
  changed.manifest.checkpoint.rows[0].input.seed = 'unapproved';
  await assert.rejects(validateRetainedAuthority(bytes, snapshot, changed), /manifest fields/);
});
test('coherently changed result and completion cannot pass pinned result authority', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'issue186-retained-'));
  try {
    await cp(evidence, directory, { recursive: true });
    const bytes = Buffer.from('{"fabricated":true}\n'),
      completion = JSON.parse(await readFile(join(directory, 'completion.json')));
    await writeFile(join(directory, 'decision.json'), bytes);
    completion.artifacts['decision.json'] = hash(bytes);
    await writeFile(join(directory, 'completion.json'), JSON.stringify(completion));
    await assert.rejects(verifyRetainedEvidence(directory), /completion authority/);
  } finally {
    await rm(directory, { recursive: true });
  }
});
test('unhashed result changes and unknown files are rejected', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'issue186-retained-'));
  try {
    await cp(evidence, directory, { recursive: true });
    await writeFile(join(directory, 'unknown.json'), '{}');
    await assert.rejects(verifyRetainedEvidence(directory));
    await rm(join(directory, 'unknown.json'));
    await writeFile(join(directory, 'decision.json'), '{}');
    await assert.rejects(verifyRetainedEvidence(directory), /Retained artifact/);
  } finally {
    await rm(directory, { recursive: true });
  }
});
