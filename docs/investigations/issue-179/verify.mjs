/** Read-only receipt/hash verification. Never executes retained source or rerenders scalar grids. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, join, posix, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

import { assessReadiness } from './readiness.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const BASELINE = '../issue-164/comparison/results.json';
const IDS = [
  'normal-01',
  'normal-02',
  'normal-03',
  'normal-04',
  'connected-majority',
  'fragmented-islands',
];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const digest = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const finite = (value) => typeof value === 'number' && Number.isFinite(value);

function sourcePath(root, path) {
  assert(
    typeof path === 'string' && /^[A-Za-z0-9_./-]+\.(mjs|md|json)$/.test(path),
    'invalid source path',
  );
  assert(!isAbsolute(path) && posix.normalize(path) === path, 'source path must be plain relative');
  const absolute = resolve(root, path);
  assert(absolute.startsWith(resolve(root, '..') + sep), 'source path escapes investigations');
  return absolute;
}

function imports(source, file) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  assert.equal(tree.parseDiagnostics.length, 0, `source parse failure: ${file}`);
  const result = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier)
      result.push({ path: node.moduleSpecifier.text, dynamic: false });
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      assert(ts.isStringLiteral(node.arguments[0]), `unresolved dynamic import: ${file}`);
      result.push({ path: node.arguments[0].text, dynamic: true });
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return result;
}

function complete(input, construction) {
  const owners = construction.owners;
  return (
    construction.ok === true &&
    Array.isArray(owners) &&
    owners.length === input.controls.continentCountIntent &&
    new Set(owners.map((owner) => owner.id)).size === owners.length &&
    owners.every(
      (owner) => owner.certificate.ok === true && finite(owner.radius) && owner.radius > 0,
    ) &&
    owners.some((owner) => owner.candidate.primary === true)
  );
}

function checkCoverage(coverage, input, owners) {
  assert(
    finite(coverage.waterPercent) && coverage.waterPercent >= 0 && coverage.waterPercent <= 100,
    'invalid coverage',
  );
  assert(finite(coverage.errorPercentagePoints), 'invalid coverage error');
  assert(
    Math.abs(
      coverage.errorPercentagePoints -
        (coverage.waterPercent - input.controls.targetWaterCoveragePercent),
    ) < 1e-10,
    'inconsistent coverage error',
  );
  assert.deepEqual(
    coverage.owners.map((owner) => owner.id),
    owners.map((owner) => owner.id),
    'coverage owners',
  );
  coverage.owners.forEach((owner, i) => {
    assert.equal(owner.quota, owners[i].quota, 'coverage quota');
    assert(
      finite(owner.realizedSphereFraction) &&
        owner.realizedSphereFraction >= 0 &&
        owner.realizedSphereFraction <= 1,
      'invalid realized owner area',
    );
    assert(
      finite(owner.errorPercentagePoints) &&
        Math.abs(owner.errorPercentagePoints - 100 * (owner.realizedSphereFraction - owner.quota)) <
          1e-10,
      'inconsistent owner area error',
    );
  });
  assert(
    Math.abs(
      coverage.owners.reduce((sum, owner) => sum + owner.realizedSphereFraction, 0) -
        (1 - coverage.waterPercent / 100),
    ) < 1e-10,
    'owner coverage does not sum to total land',
  );
}

/** Historical revisions may differ from current files; requireCurrent is for the latest precommit evidence. */
export async function verifyEvidence(
  directory,
  { requireCurrent = false, sourceRoot = HERE } = {},
) {
  const output = resolve(directory);
  const files = new Set(await readdir(output));
  const load = async (name) => JSON.parse(await readFile(join(output, name), 'utf8'));
  const manifest = await load('manifest.json');
  assert(['issue-179-r1', 'issue-179-r2'].includes(manifest.revision), 'unsupported revision');
  assert(
    ['local-certificate-gate', 'comparison'].includes(manifest.kind),
    'unsupported evidence kind',
  );
  const snapshot = await load('source-snapshot.json');
  assert.deepEqual(
    Object.keys(snapshot).sort(),
    Object.keys(manifest.sources).sort(),
    'source inventory mismatch',
  );
  const changedSources = [];
  const allowedCurrentRoot = (await realpath(resolve(sourceRoot, '..'))) + sep;
  for (const [file, expected] of Object.entries(manifest.sources)) {
    const absolute = sourcePath(sourceRoot, file);
    assert(
      digest(expected) && typeof snapshot[file] === 'string',
      `invalid source record: ${file}`,
    );
    assert.equal(sha256(snapshot[file]), expected, `source hash: ${file}`);
    try {
      const actualPath = await realpath(absolute);
      assert(actualPath.startsWith(allowedCurrentRoot), 'source symlink escapes investigations');
      if (sha256(await readFile(actualPath)) !== expected) changedSources.push(file);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      changedSources.push(file);
    }
  }
  for (const required of [
    'run.mjs',
    'templates.mjs',
    '../issue-178/certificates.mjs',
    'readiness.mjs',
    BASELINE,
  ])
    assert(Object.hasOwn(snapshot, required), `missing required captured source: ${required}`);
  const checkedImports = [];
  for (const [file, source] of Object.entries(snapshot)) {
    if (!file.endsWith('.mjs')) continue;
    for (const imported of imports(source, file)) {
      assert(
        !isAbsolute(imported.path) && !imported.path.startsWith('file:'),
        `absolute runtime import: ${file}`,
      );
      if (!imported.path.startsWith('.')) continue;
      assert(imported.path.endsWith('.mjs'), `unsupported relative runtime import: ${file}`);
      const target = posix.normalize(posix.join(posix.dirname(file), imported.path));
      sourcePath(sourceRoot, target);
      assert(
        Object.hasOwn(snapshot, target),
        `missing captured runtime source: ${target} imported by ${file}`,
      );
      checkedImports.push({ from: file, to: target });
    }
  }
  if (manifest.revision === 'issue-179-r2')
    for (const file of ['run-r2.mjs', 'revision-r2.md'])
      assert(Object.hasOwn(snapshot, file), `missing r2 source: ${file}`);
  assert.deepEqual(
    await load('integrity.json'),
    { sourceHashesVerified: true, changedSources: [] },
    'incomplete source integrity receipt',
  );
  const baselineText = await readFile(new URL(BASELINE, import.meta.url), 'utf8');
  assert.equal(snapshot[BASELINE], baselineText, 'changed retained baseline');
  const baseline = JSON.parse(baselineText);
  const expectedInputs = baseline.reports
    .filter((row) => row.family === 'envelope')
    .map((row) => row.input);
  assert.deepEqual(
    expectedInputs.map((input) => input.id),
    IDS,
    'baseline input inventory',
  );
  assert.deepEqual(manifest.inputs, expectedInputs, 'exact six retained inputs');
  const gate = await load('local-gate.json');
  assert.deepEqual(
    gate.reports.map((report) => report.input),
    expectedInputs,
    'local input inventory',
  );
  assert.equal(gate.exactRepeat, true, 'local repeat receipt');
  assert(
    gate.reports.every((report) => report.exactRepeat === true),
    'per-owner-set repeat receipt',
  );
  for (const { construction } of gate.reports)
    for (const owner of construction.owners)
      if (owner.certificate?.ok === true)
        assert.equal(
          owner.certificate.metrics?.collarWidthUpperMode,
          'root-and-far',
          'accepted owner must use the declared root-and-far certificate mode',
        );
  assert.equal(
    gate.completeCohortPassed,
    gate.reports.every(({ input, construction }) => complete(input, construction)),
    'complete cohort consistency',
  );
  const readiness = assessReadiness(gate.reports);
  assert.equal(gate.readyForComparison, readiness.readyForComparison, 'readiness consistency');
  assert.deepEqual(gate.failures, readiness.failures, 'readiness failure inventory');
  const compared = manifest.kind === 'comparison' && gate.readyForComparison;
  const expectedImages = [];
  if (!compared) {
    assert(!files.has('results.json'), 'unexpected comparison results after local rejection');
    for (const id of IDS)
      assert(!files.has(`${id}.json`), 'unexpected comparison row after local gate');
  } else {
    const results = await load('results.json');
    assert.equal(results.revision, manifest.revision, 'result revision');
    assert.deepEqual(results.sources, manifest.sources, 'result source inventory');
    assert.deepEqual(
      results.reports.map((report) => report.input),
      expectedInputs,
      'comparison input inventory',
    );
    for (const [index, report] of results.reports.entries()) {
      const id = report.input.id;
      assert.deepEqual(await load(`${id}.json`), report, `individual row: ${id}`);
      assert.deepEqual(
        report.construction,
        gate.reports[index].construction,
        `construction receipt: ${id}`,
      );
      assert.equal(report.exactRepeat, true, `comparison repeat receipt: ${id}`);
      assert(
        report.productionSelection === undefined || report.productionSelection === false,
        'unsupported production selection',
      );
      assert(
        report.humanVisualDecision === undefined || report.humanVisualDecision === 'pending',
        'unsupported human acceptance claim',
      );
      const rendered = ['numeric-gates-passed', 'coverage-failed'].includes(report.stage);
      if (rendered || report.stage === 'geometry-invariant-failed') {
        assert.equal(report.placement.ok, true, 'placement success receipt');
        assert.deepEqual(
          report.placement.owners.map(({ center, east, north, ...owner }) => {
            assert(
              [center, east, north].every(
                (axis) => Array.isArray(axis) && axis.length === 3 && axis.every(finite),
              ),
              'placement frame record',
            );
            return owner;
          }),
          report.construction.owners,
          'placed owner identity and quota',
        );
        checkCoverage(report.previewCoverage, report.input, report.placement.owners);
        checkCoverage(report.fullCoverage, report.input, report.placement.owners);
      }
      if (rendered) {
        assert.equal(report.geometry.seamChecks, 201, 'seam receipt');
        assert.equal(report.geometry.poleChecks, 722, 'pole receipt');
        assert.equal(report.geometry.anchorChecks, 80400, 'nested anchor receipt');
        const eligible =
          Math.abs(report.previewCoverage.errorPercentagePoints) <= 0.25 &&
          Math.abs(report.fullCoverage.errorPercentagePoints) <= 0.25 &&
          report.previewCoverage.owners.every(
            (owner) =>
              Math.abs(owner.errorPercentagePoints) <=
              0.25 / report.input.controls.continentCountIntent,
          );
        assert.equal(report.numericEligible, eligible, 'numeric eligibility');
        assert.equal(
          report.stage,
          eligible ? 'numeric-gates-passed' : 'coverage-failed',
          'numeric stage',
        );
        assert.equal(report.humanVisualDecision, 'pending', 'human review remains pending');
        assert.equal(report.productionSelection, false, 'production remains unselected');
        for (const field of ['previewGridSha256', 'fullGridSha256', 'maskSha256'])
          assert(digest(report[field]), `missing scalar digest: ${field}`);
        for (const [suffix, field, width, height] of [
          ['', 'nativeImageSha256', 1600, 800],
          ['-half', 'halfImageSha256', 800, 400],
        ]) {
          const name = `${id}${suffix}.png`,
            bytes = await readFile(join(output, name));
          assert.equal(sha256(bytes), report[field], `image hash: ${name}`);
          assert(
            bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
              bytes.toString('ascii', 12, 16) === 'IHDR',
            `PNG header: ${name}`,
          );
          assert.equal(bytes.readUInt32BE(16), width, `PNG width: ${name}`);
          assert.equal(bytes.readUInt32BE(20), height, `PNG height: ${name}`);
          expectedImages.push(name);
        }
      } else {
        assert(
          ['construction-failed', 'placement-failed', 'geometry-invariant-failed'].includes(
            report.stage,
          ),
          'unknown failed stage',
        );
        assert.equal(report.numericEligible, false, 'failed row eligibility');
        if (report.stage === 'construction-failed') assert.equal(report.construction.ok, false);
        if (report.stage === 'placement-failed') assert.equal(report.placement.ok, false);
        if (report.stage === 'geometry-invariant-failed')
          assert.equal(typeof report.geometryFailure.message, 'string');
        assert(
          !Object.hasOwn(report, 'nativeImageSha256') && !Object.hasOwn(report, 'halfImageSha256'),
          'failed row claims images',
        );
      }
    }
  }
  assert.deepEqual(
    [...files].filter((file) => /\.png$/i.test(file)).sort(),
    expectedImages.sort(),
    'unexpected or missing row images',
  );
  if (requireCurrent)
    assert.deepEqual(changedSources, [], 'latest evidence differs from current sources');
  return {
    verified: true,
    revision: manifest.revision,
    kind: manifest.kind,
    rows: 6,
    imageCount: expectedImages.length,
    sourceCount: Object.keys(snapshot).length,
    checkedRuntimeImports: checkedImports.length,
    currentSourcesMatch: changedSources.length === 0,
    changedSources,
    scope:
      'Source text, dependency closure, receipt consistency and PNG bytes verified. Scalar grids, constructor repeats, world rerenders, cross-platform equality and human visual acceptance were not independently rerun or established.',
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2),
    requireCurrent = args.includes('--require-current');
  const directories = args.filter((arg) => arg !== '--require-current');
  assert.equal(directories.length, 1, 'Use verify.mjs DIRECTORY [--require-current]');
  process.stdout.write(
    JSON.stringify(await verifyEvidence(directories[0], { requireCurrent }), null, 2) + '\n',
  );
}
