/** One-shot state runner. Verify never loads the evaluation module or runtime. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { rows, sweep } from './corpus.mjs';
import { archive, capture, hash, inventory, json, verify } from './evidence.mjs';
import { HERE, loadRuntime } from './runtime.mjs';
const [mode, state] = process.argv.slice(2);
assert.equal(state, 'state-2', 'State 1 is spent; only the final repaired state is executable');
if (mode === '--verify') console.log(JSON.stringify(await verify(state)));
else {
  assert.equal(mode, '--record');
  const root = join(HERE, state),
    inputs = [
      ...rows.map((input) => ({ input, full: true })),
      ...sweep.map((input) => ({ input, full: false })),
    ];
  const snapshot = await capture();
  await mkdir(root);
  await json(join(root, 'source-manifest.json'), snapshot.manifest);
  await archive(join(root, 'sources.json.gz'), snapshot.sources);
  await json(join(root, 'inputs.json'), inputs);
  const manifestSha256 = hash(await readFile(join(root, 'source-manifest.json')));
  const parameters = JSON.parse(await readFile(join(HERE, `${state}.json`), 'utf8'));
  let first;
  const phaseReceipts = {};
  for (const phase of ['initial', 'repeat']) {
    assert.deepEqual((await capture()).manifest, snapshot.manifest, 'Source changed before phase');
    await json(join(root, `${phase}-claim.json`), {
      phase,
      manifestSha256,
      inputsSha256: hash(JSON.stringify(inputs)),
      maximumEvaluations: 75836012,
    });
    const destination = join(root, phase);
    await mkdir(destination);
    const runtime = await loadRuntime();
    try {
      const { evaluate } = await import('./evaluate.mjs');
      const result = await evaluate(runtime, parameters, inputs, async (report, images) => {
        if (images) {
          await writeFile(join(destination, `${report.input.id}.png`), images.native, {
            flag: 'wx',
          });
          await writeFile(join(destination, `${report.input.id}-half.png`), images.half, {
            flag: 'wx',
          });
        }
        await archive(
          join(destination, `${report.full ? 'full' : 'preview'}-${report.input.id}.json.gz`),
          report,
        );
        console.log(
          `${phase} ${report.full ? 'full' : 'preview'} ${report.input.id}: ${report.outcome} ${report.failures.join(',')}`,
        );
      });
      await archive(join(destination, 'results.json.gz'), result);
      await json(join(root, `${phase}-receipt.json`), {
        phase,
        counts: result.counts,
        artifacts: await inventory(destination),
      });
      phaseReceipts[phase] = hash(await readFile(join(root, `${phase}-receipt.json`)));
      if (first) assert.deepEqual(result, first, 'Repeat differs; both phases retained');
      else first = result;
    } finally {
      await runtime.close();
    }
  }
  await json(join(HERE, 'authority.json'), {
    manifestSha256,
    ...phaseReceipts,
    initialArtifacts: await inventory(join(root, 'initial')),
  });
  console.log(JSON.stringify(await verify(state)));
}
