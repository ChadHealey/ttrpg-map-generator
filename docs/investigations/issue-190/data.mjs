/** Pure receipt/schema encoding. No geometry or useful constructor imports. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

import { format } from 'prettier';

import { inputs } from './corpus.mjs';

export const json = (v) => format(JSON.stringify(v), { parser: 'json', printWidth: 100 });
export const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const PHASES = Object.freeze(['initial', 'repeat', 'replay']);
export const BASE_FILES = Object.freeze([
  'source-manifest.json',
  'sources.json.gz',
  'inputs.json',
  'initial-claim.json',
  'reports.json.gz',
  'summary.json',
  'panel.png',
  'panel-half.png',
  'initial-receipt.json',
  'repeat-claim.json',
  'repeat-result.json.gz',
  'repeat-receipt.json',
]);
export const REPLAY_FILES = Object.freeze([
  'replay-claim.json',
  'replay-result.json.gz',
  'replay-receipt.json',
]);
export function claim(stage, phase, manifestSha256, inputHash) {
  assert(['state-1', 'state-2'].includes(stage));
  assert(PHASES.includes(phase));
  return {
    revision: 'issue-190-phase-r1',
    stage,
    phase,
    reservedSlots: 60,
    manifestSha256,
    inputHash,
  };
}
export function validateResult(result) {
  assert.deepEqual(
    result.reports.map((r) => r.input),
    inputs(),
    'Exact original 60 ordered cases',
  );
  assert.equal(result.summary.total, 60);
  assert.equal(result.summary.constructorCalls, 60);
  assert.equal(
    result.summary.certificateCalls,
    result.reports.filter((r) => r.certificateAttempted === true).length,
  );
  assert(result.summary.certificateCalls >= 0 && result.summary.certificateCalls <= 60);
  assert.equal(result.summary.passed, result.reports.filter((r) => r.certificate?.ok).length);
  assert.equal(result.summary.constructionErrors, result.reports.filter((r) => r.error).length);
  assert.deepEqual(Object.keys(result.images).sort(), ['panel-half.png', 'panel.png']);
}
export function pack(result) {
  return gzipSync(
    Buffer.from(
      JSON.stringify({
        ...result,
        images: Object.fromEntries(
          Object.entries(result.images).map(([p, b]) => [p, Buffer.from(b).toString('base64')]),
        ),
      }) + '\n',
    ),
  );
}
export function unpack(bytes) {
  const result = JSON.parse(gunzipSync(bytes));
  result.images = Object.fromEntries(
    Object.entries(result.images).map(([p, b]) => [p, Buffer.from(b, 'base64')]),
  );
  return result;
}
export async function artifacts(result) {
  validateResult(result);
  return {
    'reports.json.gz': gzipSync(Buffer.from(JSON.stringify(result.reports) + '\n')),
    'summary.json': Buffer.from(await json(result.summary)),
    ...result.images,
  };
}
export const hashes = (files) =>
  Object.fromEntries(Object.entries(files).map(([p, b]) => [p, digest(b)]));
export async function phaseReceipt(stage, phase, manifestSha256, result, match = true) {
  const files = await artifacts(result);
  return {
    revision: 'issue-190-phase-result-r1',
    stage,
    phase,
    manifestSha256,
    complete: true,
    match,
    reservedSlots: 60,
    constructorCalls: result.summary.constructorCalls,
    certificateCalls: result.summary.certificateCalls,
    outputHashes: hashes(files),
  };
}
export function validateSecondDeclaration(snapshot) {
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
  for (const p of paths)
    assert(typeof snapshot[p] === 'string' && snapshot[p].trim(), `Missing prerequisite ${p}`);
  const authorization = JSON.parse(snapshot[prefix + 'states/state-2/authorization.json']);
  assert.deepEqual(
    authorization,
    {
      stage: 'state-2',
      predecessor: 'state-1',
      disposition: 'rejected',
      authorization: 'approved-for-fixed-60-case-state',
      hashes: Object.fromEntries(paths.map((p) => [p, digest(snapshot[p])])),
    },
    'Exact second-state declaration',
  );
}
