import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import ts from 'typescript';
import { test } from 'vitest';

import { CERTIFICATE_OPTIONS, inputs, QUOTAS } from './corpus.mjs';
import { claim, digest, pack, unpack, validateResult, validateSecondDeclaration } from './data.mjs';
import { validateInput } from './schema.mjs';
import { stageEntry } from './sources.mjs';

// Synthetic ERROR RECORDS only: no geometry, useful constructor or certificate invocation.
function syntheticErrors() {
  return {
    reports: inputs().map((input) => ({
      input,
      error: { name: 'Synthetic', message: 'not constructed' },
      certificate: null,
      certificateAttempted: false,
    })),
    summary: {
      total: 60,
      constructorCalls: 60,
      certificateCalls: 0,
      passed: 0,
      constructionErrors: 60,
    },
    images: {
      'panel.png': Buffer.from('synthetic native bytes'),
      'panel-half.png': Buffer.from('synthetic half bytes'),
    },
  };
}
test('exact fixed corpus and pure anatomy mapping preserve the declared limits', () => {
  const corpus = inputs();
  assert.equal(corpus.length, 60);
  assert.equal(new Set(corpus.map((i) => i.id)).size, 60);
  for (let q = 0; q < 3; q++)
    assert(corpus.slice(q * 20, (q + 1) * 20).every((i) => i.quota === QUOTAS[q]));
  assert.deepEqual(CERTIFICATE_OPTIONS, {
    nominalClearance: 0.05,
    bayCoastMode: 'whole-body',
    collarWidthUpperMode: 'root-and-far',
  });
  assert.deepEqual(validateInput('pure', { anatomy: [1, -1], variation: 1 }), {
    u: 0.85,
    v: -0.85,
  });
  assert.deepEqual(inputs(), corpus);
});
test('malformed inputs reject in the pure schema before any useful constructor', () => {
  for (const id of ['', null, 0, {}, []])
    assert.throws(() => validateInput(id, { anatomy: [0, 0], variation: 0 }));
  for (const anatomy of [null, [], [0], [0, 0, 0], [NaN, 0], [Infinity, 0], [1.01, 0], ['0', 0]])
    assert.throws(() => validateInput('pure', { anatomy, variation: 0 }));
  for (const variation of [-0, -1, 4, 0.1, NaN, '0', null])
    assert.throws(() => validateInput('pure', { anatomy: [0, 0], variation }));
});
test('only two states and three exclusive sixty-slot phase identities are valid', () => {
  assert(stageEntry('state-1').endsWith('/states/state-1/layout.mjs'));
  assert(stageEntry('state-2').endsWith('/states/state-2/layout.mjs'));
  for (const stage of ['third', 'state-3', '../state-1', null])
    assert.throws(() => stageEntry(stage));
  const claims = ['state-1', 'state-2'].flatMap((stage) =>
    ['initial', 'repeat', 'replay'].map((phase) => claim(stage, phase, 'manifest', 'inputs')),
  );
  assert.equal(
    claims.reduce((sum, c) => sum + c.reservedSlots, 0),
    360,
  );
  assert.throws(() => claim('state-1', 'retry', 'x', 'y'));
});
test('pure result validation distinguishes reserved slots from actual certificate attempts', () => {
  const result = syntheticErrors();
  validateResult(result);
  assert.deepEqual(unpack(pack(result)), result);
  for (const mutate of [
    (r) => r.reports.pop(),
    (r) => (r.summary.constructorCalls = 61),
    (r) => (r.summary.certificateCalls = 1),
    (r) => (r.summary.passed = 1),
    (r) => r.reports.reverse(),
  ]) {
    const bad = syntheticErrors();
    mutate(bad);
    assert.throws(() => validateResult(bad));
  }
  const thrownCertificate = syntheticErrors();
  thrownCertificate.reports[0].certificateAttempted = true;
  thrownCertificate.summary.certificateCalls = 1;
  validateResult(thrownCertificate);
});
test('second-state declaration binds the complete selected literal and predecessor authority', () => {
  const prefix = 'docs/investigations/issue-190/';
  const paths = [
    'states/state-2/layout.mjs',
    'states/state-2/design.md',
    'states/state-2/independent-review.md',
    'states/state-2/prior-disposition.md',
    'authority/state-1.json',
    'evidence/state-1/source-manifest.json',
    'evidence/state-1/initial-receipt.json',
    'evidence/state-1/repeat-receipt.json',
    'evidence/state-1/replay-receipt.json',
  ].map((p) => prefix + p);
  const snapshot = Object.fromEntries(paths.map((p) => [p, 'synthetic prerequisite text']));
  const auth = prefix + 'states/state-2/authorization.json';
  snapshot[auth] = JSON.stringify({
    stage: 'state-2',
    predecessor: 'state-1',
    disposition: 'rejected',
    authorization: 'approved-for-fixed-60-case-state',
    hashes: Object.fromEntries(paths.map((p) => [p, digest(snapshot[p])])),
  });
  validateSecondDeclaration(snapshot);
  assert.throws(() => validateSecondDeclaration({ ...snapshot, [paths[1]]: 'changed design' }));
  assert.throws(() => validateSecondDeclaration({ ...snapshot, [paths[4]]: '' }));
  const altered = JSON.parse(snapshot[auth]);
  altered.predecessor = 'state-2';
  assert.throws(() => validateSecondDeclaration({ ...snapshot, [auth]: JSON.stringify(altered) }));
});
function callsByFunction(source) {
  const tree = ts.createSourceFile(
      'source.mjs',
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    ),
    calls = {};
  assert.equal(tree.parseDiagnostics.length, 0);
  function visit(node, owner = 'top-level') {
    if (ts.isFunctionDeclaration(node)) owner = node.name?.text ?? owner;
    if (ts.isCallExpression(node)) {
      (calls[owner] ??= []).push(node.expression.getText(tree));
    }
    ts.forEachChild(node, (child) => visit(child, owner));
  }
  visit(tree);
  return calls;
}
test('source proof: record has two passes, replay one, verification and predecessor checks zero', async () => {
  const run = await readFile(new URL('./run.mjs', import.meta.url), 'utf8'),
    calls = callsByFunction(run);
  assert.equal(calls.record.filter((c) => c === 'evaluateOnce').length, 2);
  assert.equal(calls.replay.filter((c) => c === 'evaluateOnce').length, 1);
  assert(calls.replay.indexOf('inspect') < calls.replay.indexOf('reserve'));
  assert(calls.replay.indexOf('reserve') < calls.replay.indexOf('evaluateOnce'));
  const prohibited = new Set([
    'loadTrustedRuntime',
    'evaluateOnce',
    'buildCoast',
    'sampleCoast',
    'certifyCandidate',
    'render',
  ]);
  for (const path of ['./verify.mjs', './data.mjs']) {
    const text = await readFile(new URL(path, import.meta.url), 'utf8');
    for (const list of Object.values(callsByFunction(text)))
      assert(list.every((c) => !prohibited.has(c)));
  }
  assert(run.includes("{ flag: 'wx' }"), 'Exclusive phase claim writer');
  assert(run.includes('recursive: false'), 'Exclusive record directory');
});
