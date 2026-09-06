/** Issue-177 immutable integrated-flank comparison with frozen numeric machinery. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { format } from 'prettier';
import ts from 'typescript';

import { inputs } from '../issue-165/run.mjs';
import { localGate, render } from '../issue-172/run.mjs';
import { constructOwners } from './templates.mjs';
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
  const revision = 'issue-177-r1';
  const comparison = mode.startsWith('--compare');
  const output = resolve(target);
  if (!output.startsWith(HERE) || output === HERE.slice(0, -1))
    throw new Error('Evidence must use a new revision directory inside issue-177.');
  await mkdir(output, { recursive: false });
  const sources = {},
    sourceSnapshot = {};
  const pending = [
    'run.mjs',
    'readiness.mjs',
    'experiment.md',
    '../issue-175/design.md',
    '../issue-171/design.md',
    '../issue-164/comparison/results.json',
  ];
  const allowed = resolve(HERE, '..');
  while (pending.length) {
    const file = pending.shift();
    if (Object.hasOwn(sourceSnapshot, file)) continue;
    const absolute = resolve(HERE, file);
    assert(absolute.startsWith(allowed + '/'), 'Source outside investigations');
    const source = await readFile(absolute, 'utf8');
    sourceSnapshot[file] = source;
    sources[file] = hash(source);
    if (!file.endsWith('.mjs')) continue;
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const imports = [];
    function visit(node) {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        imports.push(node.moduleSpecifier.text);
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0])
      )
        imports.push(node.arguments[0].text);
      ts.forEachChild(node, visit);
    }
    visit(tree);
    for (const specifier of imports.filter((name) => name.startsWith('.')))
      pending.push(relative(HERE, resolve(dirname(absolute), specifier)));
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
