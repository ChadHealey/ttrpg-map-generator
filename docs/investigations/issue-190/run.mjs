/** Budgeted execution. record=60+60; replay=60 once; verify=ZERO useful calls. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import { inputs } from './corpus.mjs';
import { artifacts, claim, digest, json, pack, phaseReceipt } from './data.mjs';
import { HERE, loadTrustedRuntime } from './sources.mjs';
import { directory, inspect, prospective, verify } from './verify.mjs';

const write = (target, p, bytes) => writeFile(join(target, p), bytes, { flag: 'wx' });
async function reserve(stage, phase, source) {
  await write(
    directory(stage),
    `${phase}-claim.json`,
    await json(claim(stage, phase, digest(source.bytes), source.manifest.inputHash)),
  );
}
async function evaluateOnce(source) {
  const { layout, evaluator, corpus } = await loadTrustedRuntime(source.captured);
  assert.deepEqual(corpus.inputs(), inputs());
  return evaluator.evaluate(layout.buildCoast, corpus.inputs()); // EXACTLY one 60-case pass.
}
async function unchanged(stage, source) {
  assert.deepEqual(
    (await prospective(stage)).bytes,
    source.bytes,
    'Authority changed during reserved phase',
  );
}
export async function record(stage) {
  const source = await prospective(stage);
  if (stage === 'state-2') await verify('state-1');
  await mkdir(join(HERE, 'evidence'), { recursive: true });
  const target = directory(stage);
  await mkdir(target, { recursive: false });
  await write(target, 'source-manifest.json', source.bytes);
  await write(
    target,
    'sources.json.gz',
    gzipSync(Buffer.from(JSON.stringify(source.captured.snapshot) + '\n')),
  );
  await write(target, 'inputs.json', await json(inputs()));
  await reserve(stage, 'initial', source);
  const first = await evaluateOnce(source),
    outputs = await artifacts(first);
  for (const [p, b] of Object.entries(outputs)) await write(target, p, b);
  await write(
    target,
    'initial-receipt.json',
    await json(await phaseReceipt(stage, 'initial', digest(source.bytes), first)),
  );
  await unchanged(stage, source);
  await reserve(stage, 'repeat', source);
  const repeated = await evaluateOnce(source);
  await write(target, 'repeat-result.json.gz', pack(repeated));
  let match = true;
  try {
    assert.deepEqual(repeated, first);
  } catch {
    match = false;
  }
  await write(
    target,
    'repeat-receipt.json',
    await json(await phaseReceipt(stage, 'repeat', digest(source.bytes), repeated, match)),
  );
  await unchanged(stage, source);
  assert(match, 'Exact in-memory repeat failed; phase remains spent');
  return {
    recorded: true,
    stage,
    reservedSlots: 120,
    passed: first.summary.passed,
    bodyCertificateCalls: first.summary.certificateCalls + repeated.summary.certificateCalls,
  };
}
export async function replay(stage) {
  // Inventory rejects any existing replay claim before runtime loading, including incomplete attempts.
  const checked = await inspect(stage, false),
    source = checked.source;
  await reserve(stage, 'replay', source);
  const result = await evaluateOnce(source),
    target = directory(stage);
  await write(target, 'replay-result.json.gz', pack(result));
  let match = true;
  try {
    assert.deepEqual(await artifacts(result), await artifacts(checked.initial));
  } catch {
    match = false;
  }
  await write(
    target,
    'replay-receipt.json',
    await json(await phaseReceipt(stage, 'replay', digest(source.bytes), result, match)),
  );
  await unchanged(stage, source);
  assert(match, 'Trusted computational replay failed; phase remains spent');
  return {
    replayed: true,
    stage,
    reservedSlots: 60,
    bodyCertificateCalls: result.summary.certificateCalls,
    passed: result.summary.passed,
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert(
    process.argv.length === 4 && ['--record', '--replay', '--verify'].includes(process.argv[2]),
    'Use --record/--replay/--verify state-1 or state-2',
  );
  const operation = { '--record': record, '--replay': replay, '--verify': verify }[process.argv[2]];
  console.log(JSON.stringify(await operation(process.argv[3])));
}
