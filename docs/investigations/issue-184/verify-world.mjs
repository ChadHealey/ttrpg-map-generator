/** Read-only receipt/hash verification. Never executes retained source or rerenders scalar grids. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, posix, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

import { stream } from '../issue-164/morphology.mjs';
import * as placementRuntime from '../issue-170/placement.mjs';
import { checkPlacement, expectedOwners } from '../issue-180/audit-final.mjs';
import { probes, worldInputs } from '../issue-183/corpus.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const BASELINE = '../issue-164/comparison/results.json';
const IDS = [
  'normal-01',
  'normal-02',
  'normal-03',
  'normal-04',
  'connected-majority',
  'fragmented-islands',
  'default-001',
  'default-004',
  'default-006',
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

function summarizeConstruction(construction) {
  return construction.owners.map((owner) => ({
    id: owner.id,
    quota: owner.quota,
    radius: owner.radius,
    primary: owner.primary,
    layoutIndex: owner.candidate.layoutIndex,
  }));
}
function checkGate(gate) {
  const expected = probes();
  assert.equal(expected.length, 134, 'declared gate size');
  assert.equal(gate.exactRepeat, true, 'gate repeat receipt');
  assert.deepEqual(
    gate.rows.map(({ id, seed }) => ({ id, seed })),
    expected.map(({ input: { id, seed } }) => ({ id, seed })),
    'exact134 gate inventory',
  );
  const failures = [];
  for (const [index, row] of gate.rows.entries()) {
    const input = expected[index].input;
    assert(
      [
        'geometry-and-placement-pass',
        'construction-no-proposal',
        'placement-no-proposal',
        'audit-failure',
      ].includes(row.status),
      'gate status',
    );
    assert(Array.isArray(row.issues), 'gate issues');
    const owners = row.owners ?? [];
    const targets = expectedOwners(input, stream);
    assert.equal(new Set(owners.map((o) => o.id)).size, owners.length, 'gate owner identity');
    for (const owner of owners) {
      const target = targets.find((o) => o.id === owner.id);
      assert(
        target &&
          finite(owner.quota) &&
          Math.abs(owner.quota - target.quota) <= 1e-12 &&
          owner.primary === target.primary &&
          finite(owner.radius) &&
          owner.radius > 0 &&
          owner.radius + 0.02 < Math.PI &&
          Number.isInteger(owner.layoutIndex) &&
          owner.layoutIndex >= 0 &&
          owner.layoutIndex <= 3,
        'gate owner quota/role/guard',
      );
    }
    if (row.status === 'geometry-and-placement-pass') {
      assert.deepEqual(
        owners.map((o) => o.id),
        targets.map((o) => o.id),
        'complete gate owners',
      );
      assert.deepEqual(row.issues, [], 'successful gate issues');
      assert.deepEqual(row.constructionFailures, [], 'successful gate construction failures');
      assert(Array.isArray(row.placementFailures), 'placement attempt history');
    } else failures.push({ code: 'failed-probe', id: input.id, status: row.status });
  }
  const ordinary = new Set(IDS.slice(0, 4));
  const layouts = [
    ...new Set(
      gate.rows
        .filter((r) => ordinary.has(r.id))
        .flatMap((r) => (r.owners ?? []).filter((o) => o.primary).map((o) => o.layoutIndex)),
    ),
  ].sort();
  if (![0, 1, 2].every((i) => layouts.includes(i)))
    failures.push({ code: 'missing-ordinary-layout', layouts });
  const recoveredRows = IDS.slice(6).map((id) => {
    const row = gate.rows.find((entry) => entry.id === id);
    const primaryLayouts = (row?.owners ?? [])
      .filter((owner) => owner.primary)
      .map((owner) => owner.layoutIndex);
    if (
      row?.status !== 'geometry-and-placement-pass' ||
      primaryLayouts.length !== 1 ||
      primaryLayouts[0] !== 3
    )
      failures.push({ code: 'missing-recovered-layout', id });
    return { id, primaryLayouts };
  });
  const recoveredLayouts = [...new Set(recoveredRows.flatMap((row) => row.primaryLayouts))].sort();
  assert.deepEqual(gate.layouts, layouts, 'gate layout inventory');
  assert.deepEqual(gate.recoveredRows, recoveredRows, 'gate recovered row inventory');
  assert.deepEqual(gate.recoveredLayouts, recoveredLayouts, 'gate recovered layout inventory');
  assert.deepEqual(gate.failures, failures, 'gate failure inventory');
  assert.equal(gate.readyForComparison, failures.length === 0, 'gate readiness');
  assert.equal(gate.completeCohortPassed, failures.length === 0, 'gate completeness');
  return new Map(gate.rows.map((row) => [row.id, row]));
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
  assert(
    ['issue-184-world-r1', 'issue-184-world-r2'].includes(manifest.revision),
    'unsupported revision',
  );
  const secondRevision = manifest.revision === 'issue-184-world-r2';
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
    'corpus.mjs',
    'gate.mjs',
    'experiment.md',
    'local-findings.md',
    'design.md',
    'state-2.md',
    '../issue-178/design.md',
    '../issue-164/visual-contract.md',
    BASELINE,
    ...(secondRevision ? ['revision-r2.md'] : []),
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
  assert.deepEqual(
    await load('integrity.json'),
    { sourceHashesVerified: true, changedSources: [] },
    'incomplete source integrity receipt',
  );
  const baselineText = await readFile(new URL(BASELINE, import.meta.url), 'utf8');
  assert.equal(snapshot[BASELINE], baselineText, 'changed retained baseline');
  const baseline = JSON.parse(baselineText);
  const expectedInputs = worldInputs();
  assert.deepEqual(
    expectedInputs.map((input) => input.id),
    IDS,
    'declared nine-row inventory',
  );
  assert.deepEqual(
    expectedInputs.slice(0, 6),
    baseline.reports.filter((row) => row.family === 'envelope').map((row) => row.input),
    'retained six inputs',
  );
  assert.deepEqual(manifest.inputs, expectedInputs, 'exact nine declared inputs');
  if (secondRevision) {
    const priorDir = join(dirname(output), 'comparison-r1');
    const priorManifestBytes = await readFile(join(priorDir, 'manifest.json'));
    const priorResultsBytes = await readFile(join(priorDir, 'results.json'));
    assert.deepEqual(
      manifest.predecessor,
      {
        revision: 'issue-184-world-r1',
        manifestSha256: sha256(priorManifestBytes),
        resultsSha256: sha256(priorResultsBytes),
      },
      'retained R1 predecessor receipt',
    );
    const priorManifest = JSON.parse(priorManifestBytes);
    const priorResults = JSON.parse(priorResultsBytes);
    assert.equal(priorManifest.revision, 'issue-184-world-r1', 'predecessor revision');
    assert.equal(priorManifest.kind, 'comparison', 'predecessor kind');
    assert.deepEqual(priorManifest.inputs, expectedInputs, 'predecessor exact inputs');
    assert.equal(priorResults.revision, 'issue-184-world-r1', 'predecessor result revision');
    assert.deepEqual(
      priorResults.reports.map((report) => report.input),
      expectedInputs,
      'predecessor complete rows',
    );
  } else assert(!Object.hasOwn(manifest, 'predecessor'), 'R1 must not claim a predecessor');
  const gate = await load('local-gate.json');
  const gateRows = checkGate(gate);
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
    for (const report of results.reports) {
      const id = report.input.id;
      assert.deepEqual(await load(`${id}.json`), report, `individual row: ${id}`);
      assert.deepEqual(
        summarizeConstruction(report.construction),
        gateRows.get(id).owners,
        `construction receipt: ${id}`,
      );
      assert.equal(report.exactRepeat, true, `comparison repeat receipt: ${id}`);
      assert(complete(report.input, report.construction), `complete certified owner set: ${id}`);
      for (const owner of report.construction.owners)
        assert.equal(
          owner.certificate.metrics?.collarWidthUpperMode,
          'root-and-far',
          'accepted owner must use the declared root-and-far certificate mode',
        );
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
          checkPlacement(report.construction, report.placement, placementRuntime),
          [],
          'placement geometry and pair receipts',
        );
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
  const expectedFiles = [
    'manifest.json',
    'source-snapshot.json',
    'integrity.json',
    'local-gate.json',
    ...(compared ? ['results.json', ...IDS.map((id) => `${id}.json`), ...expectedImages] : []),
  ];
  assert.deepEqual([...files].sort(), expectedFiles.sort(), 'unexpected or missing evidence files');
  if (requireCurrent)
    assert.deepEqual(changedSources, [], 'latest evidence differs from current sources');
  return {
    verified: true,
    revision: manifest.revision,
    kind: manifest.kind,
    rows: 9,
    gateRows: 134,
    imageCount: expectedImages.length,
    sourceCount: Object.keys(snapshot).length,
    checkedRuntimeImports: checkedImports.length,
    currentSourcesMatch: changedSources.length === 0,
    predecessorReceiptVerified: secondRevision,
    changedSources,
    scope:
      'Source text, dependency closure, condensed134-gate consistency, row arithmetic and PNG bytes verified. R2 binds the retained R1 manifest/results bytes and nine inputs; this does not recursively reverify R1 images. Full134 certificates, scalar grids, constructor repeats, world rerenders, cross-platform equality and human visual acceptance were not independently rerun or established.',
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2),
    requireCurrent = args.includes('--require-current');
  const directories = args.filter((arg) => arg !== '--require-current');
  assert.equal(directories.length, 1, 'Use verify-world.mjs DIRECTORY [--require-current]');
  process.stdout.write(
    JSON.stringify(await verifyEvidence(directories[0], { requireCurrent }), null, 2) + '\n',
  );
}
