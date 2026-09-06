/** At most two immutable issue184 nine-row comparisons; never overwrites an evidence directory. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { format } from 'prettier';
import ts from 'typescript';

import { render } from '../issue-172/run.mjs';
import { worldInputs as inputs } from './corpus.mjs';
import { fullGate } from './gate.mjs';
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
  const comparison = mode.startsWith('--compare');
  const output = resolve(target);
  const match = /^(comparison|local-gate)-r([12])$/.exec(basename(output));
  assert(
    match &&
      dirname(output) === HERE.slice(0, -1) &&
      match[1] === (comparison ? 'comparison' : 'local-gate'),
    'Use the new issue-184 comparison-r1/r2 or local-gate-r1/r2 directory matching the mode',
  );
  const revision = `issue-184-world-r${match[2]}`;
  const inputsForRun = await inputs();
  let predecessor;
  if (match[2] === '2') {
    const priorManifestBytes = await readFile(join(HERE, 'comparison-r1/manifest.json'));
    const priorResultsBytes = await readFile(join(HERE, 'comparison-r1/results.json'));
    const priorManifest = JSON.parse(priorManifestBytes);
    const prior = JSON.parse(priorResultsBytes);
    assert.equal(priorManifest.revision, 'issue-184-world-r1');
    assert.equal(priorManifest.kind, 'comparison');
    assert.deepEqual(priorManifest.inputs, inputsForRun);
    assert.equal(
      prior.revision,
      'issue-184-world-r1',
      'R2 requires the completed retained first matrix',
    );
    assert.deepEqual(
      prior.reports.map((report) => report.input),
      inputsForRun,
      'Retained first matrix must contain all nine inputs',
    );
    predecessor = {
      revision: prior.revision,
      manifestSha256: hash(priorManifestBytes),
      resultsSha256: hash(priorResultsBytes),
    };
    await readFile(join(HERE, 'revision-r2.md'), 'utf8');
  }
  await mkdir(output, { recursive: false });
  const sources = {},
    sourceSnapshot = {};
  const declarations = await readdir(HERE);
  assert(declarations.includes('state-2.md'), 'Missing declared second state');
  const pending = [
    'run.mjs',
    'experiment.md',
    'local-findings.md',
    'design.md',
    ...['state-2.md', 'state-3.md'].filter((file) => declarations.includes(file)),
    '../issue-178/design.md',
    '../issue-164/visual-contract.md',
    '../issue-164/comparison/results.json',
    ...(match[2] === '2' ? ['revision-r2.md'] : []),
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
    assert.equal(tree.parseDiagnostics.length, 0, `Source parse failure: ${file}`);
    const imports = [];
    function visit(node) {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        imports.push(node.moduleSpecifier.text);
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        assert(ts.isStringLiteral(node.arguments[0]), `Unresolved dynamic import: ${file}`);
        imports.push(node.arguments[0].text);
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
    for (const specifier of imports.filter((name) => name.startsWith('.'))) {
      assert(specifier.endsWith('.mjs'), `Unsupported relative runtime import: ${specifier}`);
      pending.push(relative(HERE, resolve(dirname(absolute), specifier)));
    }
  }
  await json(join(output, 'manifest.json'), {
    revision,
    sources,
    inputs: inputsForRun,
    kind: comparison ? 'comparison' : 'local-certificate-gate',
    ...(predecessor ? { predecessor } : {}),
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
  const gate = fullGate(construct);
  await json(join(output, 'local-gate.json'), gate);
  if (!comparison || !gate.readyForComparison) {
    await verifySourceIntegrity();
    console.log(
      JSON.stringify({
        completeCohortPassed: gate.completeCohortPassed,
        readyForComparison: gate.readyForComparison,
        failures: gate.failures,
        rows: gate.rows,
      }),
    );
    return;
  }
  const reports = [];
  for (const input of inputsForRun) {
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
