/** ZERO useful geometry calls: trusted-source, ledger and artifact verification only. */
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { inputs } from './corpus.mjs';
import {
  artifacts,
  BASE_FILES,
  claim,
  digest,
  hashes,
  json,
  phaseReceipt,
  REPLAY_FILES,
  unpack,
  validateResult,
  validateSecondDeclaration,
} from './data.mjs';
import { capture, HERE } from './sources.mjs';

export const directory = (stage) => join(HERE, 'evidence', stage);
export async function prospective(stage) {
  const captured = await capture(stage);
  if (stage === 'state-2') validateSecondDeclaration(captured.snapshot);
  const manifest = { ...captured.manifest, inputHash: digest(await json(inputs())) };
  return { captured, manifest, bytes: Buffer.from(await json(manifest)) };
}
/** Requires completed initial/repeat, and optionally replay. Does not authenticate self-hashes alone. */
export async function inspect(stage, withReplay = false, target = directory(stage)) {
  const expected = [...BASE_FILES, ...(withReplay ? REPLAY_FILES : [])];
  assert.deepEqual((await readdir(target)).sort(), expected.toSorted(), 'Exact phase inventory');
  const source = await prospective(stage),
    files = {};
  for (const p of expected) files[p] = await readFile(join(target, p));
  assert.deepEqual(files['source-manifest.json'], source.bytes, 'Trusted current manifest');
  assert.deepEqual(
    JSON.parse(gunzipSync(files['sources.json.gz'])),
    source.captured.snapshot,
    'Trusted current source bytes',
  );
  assert.equal(files['inputs.json'].toString(), await json(inputs()), 'Fixed input corpus');
  const manifestHash = digest(source.bytes);
  const initial = {
    reports: JSON.parse(gunzipSync(files['reports.json.gz'])),
    summary: JSON.parse(files['summary.json']),
    images: { 'panel.png': files['panel.png'], 'panel-half.png': files['panel-half.png'] },
  };
  validateResult(initial);
  const initialOutputs = await artifacts(initial);
  for (const [p, b] of Object.entries(initialOutputs))
    assert.deepEqual(b, files[p], 'Canonical initial artifact');
  for (const phase of ['initial', 'repeat', ...(withReplay ? ['replay'] : [])]) {
    assert.deepEqual(
      JSON.parse(files[`${phase}-claim.json`]),
      claim(stage, phase, manifestHash, source.manifest.inputHash),
      'Exact reserved phase',
    );
    const result = phase === 'initial' ? initial : unpack(files[`${phase}-result.json.gz`]);
    const receipt = await phaseReceipt(stage, phase, manifestHash, result, true);
    assert.deepEqual(JSON.parse(files[`${phase}-receipt.json`]), receipt, 'Exact phase receipt');
    assert.deepEqual(
      await artifacts(result),
      initialOutputs,
      'Same encoded outcomes across reserved phases',
    );
  }
  if (stage === 'state-2') await verify('state-1'); // Source/authority only; never computational replay.
  return { source, files, initial, manifestHash };
}
export async function authorityDraft(stage) {
  const checked = await inspect(stage, true);
  return {
    revision: 'issue-190-authority-r1',
    stage,
    sourceManifestSha256: checked.manifestHash,
    artifactHashes: hashes(checked.files),
  };
}
export async function verify(stage, target = directory(stage)) {
  const checked = await inspect(stage, true, target);
  const authority = JSON.parse(await readFile(join(HERE, 'authority', `${stage}.json`), 'utf8'));
  assert.deepEqual(
    authority,
    {
      revision: 'issue-190-authority-r1',
      stage,
      sourceManifestSha256: checked.manifestHash,
      artifactHashes: hashes(checked.files),
    },
    'External reviewed authority',
  );
  return {
    verified: true,
    stage,
    cases: 60,
    passed: checked.initial.summary.passed,
    reservedSlots: 180,
    bodyCertificateCalls:
      JSON.parse(checked.files['initial-receipt.json']).certificateCalls +
      JSON.parse(checked.files['repeat-receipt.json']).certificateCalls +
      JSON.parse(checked.files['replay-receipt.json']).certificateCalls,
    geometryCallsThisVerification: 0,
  };
}
