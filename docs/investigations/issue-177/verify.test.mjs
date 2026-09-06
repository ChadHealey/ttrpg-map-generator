import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { png } from '../issue-164/render-comparison.mjs';
import { assessReadiness } from './readiness.mjs';
import { verifyEvidence } from './verify.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const temporary = [];
const baseline = await readFile(
  new URL('../issue-164/comparison/results.json', import.meta.url),
  'utf8',
);
const inputs = JSON.parse(baseline)
  .reports.filter((row) => row.family === 'envelope')
  .map((row) => row.input);
const native = png(new Uint8Array(1600 * 800), 1600, 800);
const half = png(new Uint8Array(800 * 400), 800, 400);
afterEach(async () => {
  await Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true })));
});

async function fixture({ comparison = true, failedRow = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'issue-177-verifier-'));
  temporary.push(directory);
  const sourceRoot = join(directory, 'issue-177'),
    output = join(sourceRoot, 'evidence');
  await mkdir(output, { recursive: true });
  const save = async (name, value) => writeFile(join(output, name), JSON.stringify(value));
  const snapshot = {
    'run.mjs': "import './dependency.mjs';\n",
    'dependency.mjs': "export { value } from './nested.mjs';\n",
    'nested.mjs': 'export const value = 1;\n',
    'templates.mjs': 'export const templates = [];\n',
    '../issue-176/certificates.mjs': 'export const certificate = {};\n',
    'readiness.mjs': 'export const readiness = {};\n',
    '../issue-164/comparison/results.json': baseline,
  };
  const sources = {};
  for (const [path, source] of Object.entries(snapshot)) {
    const destination = resolve(sourceRoot, path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, source);
    sources[path] = sha256(source);
  }
  const manifest = {
    revision: 'issue-177-r1',
    kind: comparison ? 'comparison' : 'local-certificate-gate',
    sources,
    inputs,
  };
  const reports = inputs.map((input) => ({
    input,
    exactRepeat: true,
    construction: {
      ok: true,
      owners: Array.from({ length: input.controls.continentCountIntent }, (_, i) => ({
        id: `owner-${i}`,
        quota:
          (1 - input.controls.targetWaterCoveragePercent / 100) /
          input.controls.continentCountIntent,
        radius: 0.3,
        certificate: { ok: true },
        candidate: { primary: true, layoutIndex: i % 3 },
      })),
    },
  }));
  const gate = {
    reports,
    exactRepeat: true,
    completeCohortPassed: true,
    ...assessReadiness(reports),
  };
  const results = { revision: manifest.revision, sources, reports: [] };
  for (const [index, local] of reports.entries()) {
    const { input, construction } = local;
    const coverage = {
      waterPercent: input.controls.targetWaterCoveragePercent,
      errorPercentagePoints: 0,
      owners: construction.owners.map((owner) => ({
        id: owner.id,
        quota: owner.quota,
        realizedSphereFraction: owner.quota,
        errorPercentagePoints: 0,
      })),
    };
    const row =
      failedRow && index === 0
        ? {
            input,
            construction,
            exactRepeat: true,
            placement: { ok: false },
            stage: 'placement-failed',
            numericEligible: false,
          }
        : {
            input,
            construction,
            exactRepeat: true,
            stage: 'numeric-gates-passed',
            numericEligible: true,
            placement: {
              ok: true,
              owners: construction.owners.map((owner) => ({
                ...owner,
                center: [0, 0, 1],
                east: [1, 0, 0],
                north: [0, 1, 0],
              })),
            },
            previewCoverage: coverage,
            fullCoverage: coverage,
            geometry: { seamChecks: 201, poleChecks: 722, anchorChecks: 80400, seamLandAnchors: 0 },
            previewGridSha256: 'a'.repeat(64),
            fullGridSha256: 'b'.repeat(64),
            maskSha256: 'c'.repeat(64),
            nativeImageSha256: sha256(native),
            halfImageSha256: sha256(half),
            humanVisualDecision: 'pending',
            productionSelection: false,
          };
    results.reports.push(row);
    if (comparison) {
      await save(`${input.id}.json`, row);
      if (row.numericEligible) {
        await writeFile(join(output, `${input.id}.png`), native);
        await writeFile(join(output, `${input.id}-half.png`), half);
      }
    }
  }
  await save('manifest.json', manifest);
  await save('source-snapshot.json', snapshot);
  await save('integrity.json', { sourceHashesVerified: true, changedSources: [] });
  await save('local-gate.json', gate);
  if (comparison) await save('results.json', results);
  return {
    output,
    sourceRoot,
    snapshot,
    manifest,
    gate,
    results,
    save,
    verify: (options = {}) => verifyEvidence(output, { sourceRoot, ...options }),
  };
}

describe('issue-177 independent read-only evidence verification', () => {
  it('checks complete receipts and byte hashes while separating historical drift from rerender claims', async () => {
    const evidence = await fixture();
    const result = await evidence.verify({ requireCurrent: true });
    expect(result).toMatchObject({
      verified: true,
      rows: 6,
      imageCount: 12,
      currentSourcesMatch: true,
      checkedRuntimeImports: 2,
    });
    expect(result.scope).toContain('were not independently rerun');
    await writeFile(join(evidence.sourceRoot, 'nested.mjs'), 'export const value = 2;');
    expect(await evidence.verify()).toMatchObject({
      currentSourcesMatch: false,
      changedSources: ['nested.mjs'],
    });
    await expect(evidence.verify({ requireCurrent: true })).rejects.toThrow('latest evidence');
  });
  it('rejects changed image bytes and extra images for explicitly failed rows', async () => {
    const evidence = await fixture({ failedRow: true });
    expect(await evidence.verify()).toMatchObject({ imageCount: 10 });
    await writeFile(join(evidence.output, 'normal-02.png'), Buffer.from('tampered'));
    await expect(evidence.verify()).rejects.toThrow('image hash');
    await writeFile(join(evidence.output, 'normal-02.png'), native);
    await writeFile(join(evidence.output, 'normal-01.png'), native);
    await expect(evidence.verify()).rejects.toThrow('unexpected or missing row images');
  });
  it('rejects tampered source text, omitted transitive imports and escaped source paths', async () => {
    const evidence = await fixture({ comparison: false });
    evidence.snapshot['nested.mjs'] += '// changed';
    await evidence.save('source-snapshot.json', evidence.snapshot);
    await expect(evidence.verify()).rejects.toThrow('source hash');
    delete evidence.snapshot['nested.mjs'];
    delete evidence.manifest.sources['nested.mjs'];
    await evidence.save('source-snapshot.json', evidence.snapshot);
    await evidence.save('manifest.json', evidence.manifest);
    await expect(evidence.verify()).rejects.toThrow('missing captured runtime source');
    evidence.snapshot['../../outside.json'] = '{}';
    evidence.manifest.sources['../../outside.json'] = sha256('{}');
    await evidence.save('source-snapshot.json', evidence.snapshot);
    await evidence.save('manifest.json', evidence.manifest);
    await expect(evidence.verify()).rejects.toThrow('escapes investigations');
  });
  it('rejects individually altered rows and coherent attempts to change fixed input seeds', async () => {
    const evidence = await fixture();
    await evidence.save('normal-01.json', {
      ...evidence.results.reports[0],
      numericEligible: false,
    });
    await expect(evidence.verify()).rejects.toThrow('individual row');
    await evidence.save('normal-01.json', evidence.results.reports[0]);
    evidence.manifest.inputs = structuredClone(evidence.manifest.inputs);
    evidence.manifest.inputs[0].seed = 'different';
    await evidence.save('manifest.json', evidence.manifest);
    await expect(evidence.verify()).rejects.toThrow('exact six retained inputs');
  });
  it('rejects inconsistent local completion, readiness, repeats and numeric claims', async () => {
    const evidence = await fixture();
    for (const patch of [
      { completeCohortPassed: false },
      { readyForComparison: false },
      { exactRepeat: false },
    ]) {
      await evidence.save('local-gate.json', { ...evidence.gate, ...patch });
      await expect(evidence.verify()).rejects.toThrow();
    }
    await evidence.save('local-gate.json', evidence.gate);
    const row = evidence.results.reports[0];
    row.previewCoverage = structuredClone(row.previewCoverage);
    row.previewCoverage.errorPercentagePoints = 1;
    await evidence.save('results.json', evidence.results);
    await evidence.save('normal-01.json', row);
    await expect(evidence.verify()).rejects.toThrow('inconsistent coverage error');
  });
  it('requires literal dynamic dependency closure without the historical runner exemption', async () => {
    const evidence = await fixture({ comparison: false });
    const file = '../issue-172/run.mjs';
    evidence.snapshot[file] = "if (false) import('./templates-r2.mjs');\n";
    evidence.manifest.sources[file] = sha256(evidence.snapshot[file]);
    await evidence.save('source-snapshot.json', evidence.snapshot);
    await evidence.save('manifest.json', evidence.manifest);
    await expect(evidence.verify()).rejects.toThrow('missing captured runtime source');
    evidence.snapshot[file] = 'const path = "./templates-r2.mjs"; import(path);\n';
    evidence.manifest.sources[file] = sha256(evidence.snapshot[file]);
    await evidence.save('source-snapshot.json', evidence.snapshot);
    await evidence.save('manifest.json', evidence.manifest);
    await expect(evidence.verify()).rejects.toThrow('unresolved dynamic import');
  });
  it('gates preview owner error while retaining full owner errors as diagnostics', async () => {
    const evidence = await fixture();
    const row = evidence.results.reports[0];
    const altered = structuredClone(row.fullCoverage);
    altered.owners[0].realizedSphereFraction += 0.01;
    altered.owners[1].realizedSphereFraction -= 0.01;
    for (const owner of altered.owners)
      owner.errorPercentagePoints = 100 * (owner.realizedSphereFraction - owner.quota);
    row.fullCoverage = altered;
    await evidence.save('results.json', evidence.results);
    await evidence.save('normal-01.json', row);
    expect(await evidence.verify()).toMatchObject({ verified: true });
    row.previewCoverage = structuredClone(altered);
    await evidence.save('results.json', evidence.results);
    await evidence.save('normal-01.json', row);
    await expect(evidence.verify()).rejects.toThrow('numeric eligibility');
  });
  it('requires a separate r2 runner and revision record without inventing constructor filenames', async () => {
    const evidence = await fixture({ comparison: false });
    evidence.manifest.revision = 'issue-177-r2';
    await evidence.save('manifest.json', evidence.manifest);
    await expect(evidence.verify()).rejects.toThrow('missing r2 source: run-r2.mjs');
    for (const [file, source] of Object.entries({
      'run-r2.mjs': "import './templates.mjs';\n",
      'revision-r2.md': '# Second bounded revision\n',
    })) {
      evidence.snapshot[file] = source;
      evidence.manifest.sources[file] = sha256(source);
      await writeFile(join(evidence.sourceRoot, file), source);
    }
    await evidence.save('source-snapshot.json', evidence.snapshot);
    await evidence.save('manifest.json', evidence.manifest);
    expect(await evidence.verify({ requireCurrent: true })).toMatchObject({
      revision: 'issue-177-r2',
      verified: true,
    });
  });
});
