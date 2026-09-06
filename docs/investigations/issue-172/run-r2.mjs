/** Second and final issue-172 comparison; preserves the complete r1 runtime unchanged. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { format } from 'prettier';

import { inputs } from '../issue-165/run.mjs';
import { localGate, render } from './run.mjs';
import { constructOwners } from './templates-r2.mjs';
const HERE = fileURLToPath(new URL('.', import.meta.url));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const json = async (path, value) =>
  writeFile(path, await format(JSON.stringify(value), { parser: 'json', printWidth: 100 }));
async function main() {
  const mode = process.argv[2],
    target = process.argv[3];
  if (!['--local-gate', '--compare'].includes(mode) || !target)
    throw new Error('Use --local-gate NEW_DIRECTORY or --compare NEW_DIRECTORY.');
  const construct = constructOwners;
  const revision = 'issue-172-r2';
  const comparison = mode.startsWith('--compare');
  const output = resolve(target);
  if (!output.startsWith(HERE) || output === HERE.slice(0, -1))
    throw new Error('Evidence must use a new revision directory inside issue-172.');
  await mkdir(output, { recursive: false });
  const sources = {},
    sourceSnapshot = {};
  for (const file of [
    'experiment.md',
    'templates.mjs',
    'coast-utils.mjs',
    'layout-a.mjs',
    'layout-b.mjs',
    'layout-c.mjs',
    '../issue-171/design.md',
    'certificates.mjs',
    '../issue-169/geometry.mjs',
    '../issue-169/placement.mjs',
    '../issue-169/templates.mjs',
    '../issue-169/certificates.mjs',
    '../issue-170/templates.mjs',
    '../issue-165/field.mjs',
    '../issue-165/measure.mjs',
    '../issue-170/placement.mjs',
    'readiness.mjs',
    '../issue-169/field.mjs',
    'run.mjs',
    '../issue-164/morphology.mjs',
    '../issue-164/render-comparison.mjs',
    '../issue-165/run.mjs',
    '../issue-164/comparison/results.json',
    'run-r2.mjs',
    'templates-r2.mjs',
    'revision-r2.md',
    'coast-partition.mjs',
    'layout-r2-a.mjs',
    'layout-r2-b.mjs',
    'layout-r2-c.mjs',
  ]) {
    sourceSnapshot[file] = await readFile(join(HERE, file), 'utf8');
    sources[file] = hash(sourceSnapshot[file]);
  }
  await json(join(output, 'manifest.json'), {
    revision,
    sources,
    inputs: await inputs(),
    kind: comparison ? 'comparison' : 'local-certificate-gate',
  });
  await json(join(output, 'source-snapshot.json'), sourceSnapshot);
  async function verifySourceIntegrity() {
    const changedSources = [];
    for (const [file, expected] of Object.entries(sources))
      if (hash(await readFile(join(HERE, file))) !== expected) changedSources.push(file);
    await json(join(output, 'integrity.json'), {
      sourceHashesVerified: changedSources.length === 0,
      changedSources,
    });
    assert.equal(changedSources.length, 0, 'Source changed during the evidence run');
  }
  const gate = await localGate(construct);
  await json(join(output, 'local-gate.json'), gate);
  if (!comparison || !gate.readyForComparison) {
    await verifySourceIntegrity();
    console.log(
      JSON.stringify({
        completeCohortPassed: gate.completeCohortPassed,
        readyForComparison: gate.readyForComparison,
        failures: gate.failures,
        rows: gate.reports.map(({ input, construction }) => ({
          id: input.id,
          ok: construction.ok,
          failures: construction.failures,
        })),
      }),
    );
    return;
  }
  const reports = [];
  for (const input of await inputs()) {
    const first = render(input, construct),
      repeat = render(input, construct);
    assert.deepEqual(first, repeat);
    if (first.nativeImage) {
      await writeFile(join(output, `${input.id}.png`), first.nativeImage);
      await writeFile(join(output, `${input.id}-half.png`), first.halfImage);
    }
    reports.push({ ...first.report, exactRepeat: true });
    await json(join(output, `${input.id}.json`), reports.at(-1));
    console.log(`${input.id}: ${first.report.stage}`);
  }
  await verifySourceIntegrity();
  await json(join(output, 'results.json'), {
    revision,
    sources,
    reports,
    repeatScope: 'local process only; cross-platform equality unproved',
    editPolicy: 'immutable revision; retain failures; no human visual decisions inferred',
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
