import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { afterEach, describe, expect, it } from 'vitest';

import { png } from '../issue-164/render-comparison.mjs';
import { probes, worldInputs } from './corpus.mjs';
import { verifyEvidence } from './verify-world.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const temporary = [];
const baseline = await readFile(
  new URL('../issue-164/comparison/results.json', import.meta.url),
  'utf8',
);
const inputs = worldInputs();
const local = await Promise.all(
  probes().map(
    async (probe) =>
      JSON.parse(
        gunzipSync(
          await readFile(
            new URL(`./readiness-recipe-3/${probe.input.id}.json.gz`, import.meta.url),
          ),
        ),
      ).result,
  ),
);
// Synthetic PNGs exercise receipt integrity, not morphology or scalar rendering.
const native = png(new Uint8Array(1600 * 800), 1600, 800);
const half = png(new Uint8Array(800 * 400), 800, 400);
afterEach(async () => {
  await Promise.all(temporary.splice(0).map((dir) => rm(dir, { recursive: true })));
});

async function fixture({ comparison = true } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'issue183-world-verify-'));
  temporary.push(dir);
  const sourceRoot = join(dir, 'issue-183'),
    output = join(sourceRoot, 'evidence');
  await mkdir(output, { recursive: true });
  const save = (name, data) => writeFile(join(output, name), JSON.stringify(data));
  const snapshot = {
    'run.mjs': "import './dependency.mjs';\n",
    'dependency.mjs': "export { value } from './nested.mjs';\n",
    'nested.mjs': 'export const value = 1;\n',
    'recipes/recipe-3/templates.mjs': 'export const templates = [];\n',
    '../issue-178/certificates.mjs': 'export const certificate = {};\n',
    'corpus.mjs': 'export const inputs = [];\n',
    'gate.mjs': 'export const gate = {};\n',
    'experiment.md': 'Synthetic verifier fixture.\n',
    'local-findings.md': 'No visual claim.\n',
    '../issue-164/comparison/results.json': baseline,
  };
  const sources = {};
  for (const [name, source] of Object.entries(snapshot)) {
    const path = resolve(sourceRoot, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, source);
    sources[name] = hash(source);
  }
  const manifest = {
    revision: 'issue-183-world-r1-recipe3',
    kind: comparison ? 'comparison' : 'local-certificate-gate',
    inputs: structuredClone(inputs),
    sources,
  };
  const gate = {
    readyForComparison: true,
    completeCohortPassed: true,
    exactRepeat: true,
    failures: [],
    layouts: [0, 1, 2],
    rows: local.map((r) => ({
      id: r.probe.input.id,
      seed: r.probe.input.seed,
      status: r.status,
      issues: r.issues,
      constructionFailures: r.construction.failures,
      placementFailures: r.placement.failures,
      owners: r.construction.owners.map((o) => ({
        id: o.id,
        quota: o.quota,
        radius: o.radius,
        primary: o.primary,
        layoutIndex: o.candidate.layoutIndex,
      })),
    })),
  };
  const results = { revision: manifest.revision, sources, reports: [] };
  for (const input of inputs) {
    const r = local.find((r) => r.probe.input.id === input.id);
    const coverage = {
      waterPercent: input.controls.targetWaterCoveragePercent,
      errorPercentagePoints: 0,
      owners: r.construction.owners.map((o) => ({
        id: o.id,
        quota: o.quota,
        realizedSphereFraction: o.quota,
        errorPercentagePoints: 0,
      })),
    };
    const report = {
      input: structuredClone(input),
      construction: structuredClone(r.construction),
      placement: structuredClone(r.placement),
      stage: 'numeric-gates-passed',
      numericEligible: true,
      exactRepeat: true,
      previewCoverage: structuredClone(coverage),
      fullCoverage: structuredClone(coverage),
      geometry: { seamChecks: 201, poleChecks: 722, anchorChecks: 80400, seamLandAnchors: 1 },
      previewGridSha256: 'a'.repeat(64),
      fullGridSha256: 'b'.repeat(64),
      maskSha256: 'c'.repeat(64),
      nativeImageSha256: hash(native),
      halfImageSha256: hash(half),
      humanVisualDecision: 'pending',
      productionSelection: false,
    };
    results.reports.push(report);
    if (comparison) {
      await save(`${input.id}.json`, report);
      await writeFile(join(output, `${input.id}.png`), native);
      await writeFile(join(output, `${input.id}-half.png`), half);
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
    manifest,
    snapshot,
    gate,
    results,
    save,
    verify: (options = {}) => verifyEvidence(output, { sourceRoot, ...options }),
    saveReport: async (index) => {
      await save(`${results.reports[index].input.id}.json`, results.reports[index]);
      await save('results.json', results);
    },
  };
}

describe('independent nine-row world evidence verification', () => {
  it('checks nine rows,134 gate entries,18 images and reports historical source drift separately', async () => {
    const f = await fixture();
    expect(await f.verify({ requireCurrent: true })).toMatchObject({
      verified: true,
      rows: 9,
      gateRows: 134,
      imageCount: 18,
      checkedRuntimeImports: 2,
      currentSourcesMatch: true,
    });
    await writeFile(join(f.sourceRoot, 'nested.mjs'), 'export const value = 2;');
    expect(await f.verify()).toMatchObject({ changedSources: ['nested.mjs'] });
    await expect(f.verify({ requireCurrent: true })).rejects.toThrow('latest evidence');
  });

  it('rejects missing or replaced comparison rows and altered declared inputs', async () => {
    const f = await fixture();
    const last = f.results.reports.pop();
    await f.save('results.json', f.results);
    await expect(f.verify()).rejects.toThrow('comparison input inventory');
    f.results.reports.push(last);
    await f.save('results.json', f.results);
    await f.save('normal-01.json', { ...f.results.reports[0], numericEligible: false });
    await expect(f.verify()).rejects.toThrow('individual row');
    await f.saveReport(0);
    f.manifest.inputs[8].seed = 'replacement-seed';
    await f.save('manifest.json', f.manifest);
    await expect(f.verify()).rejects.toThrow('exact nine declared inputs');
  });

  it('rejects incomplete134 gates, false gate successes and lost owner budgets', async () => {
    const f = await fixture({ comparison: false });
    const last = f.gate.rows.pop();
    await f.save('local-gate.json', f.gate);
    await expect(f.verify()).rejects.toThrow('exact134 gate inventory');
    f.gate.rows.push(last);
    f.gate.rows[0].owners[0].quota += 0.001;
    await f.save('local-gate.json', f.gate);
    await expect(f.verify()).rejects.toThrow('gate owner quota/role/guard');
  });

  it('rejects source tampering, missing transitive closure and escaped source paths', async () => {
    const f = await fixture({ comparison: false });
    f.snapshot['nested.mjs'] += '// tamper';
    await f.save('source-snapshot.json', f.snapshot);
    await expect(f.verify()).rejects.toThrow('source hash');
    delete f.snapshot['nested.mjs'];
    delete f.manifest.sources['nested.mjs'];
    await f.save('source-snapshot.json', f.snapshot);
    await f.save('manifest.json', f.manifest);
    await expect(f.verify()).rejects.toThrow('missing captured runtime source');
    f.snapshot['../../outside.json'] = '{}';
    f.manifest.sources['../../outside.json'] = hash('{}');
    await f.save('source-snapshot.json', f.snapshot);
    await f.save('manifest.json', f.manifest);
    await expect(f.verify()).rejects.toThrow('escapes investigations');
  });

  it('rejects changed PNG bytes and enforces explicit no-image rows after geometry failure', async () => {
    const f = await fixture();
    await writeFile(join(f.output, 'normal-01.png'), Buffer.from('changed'));
    await expect(f.verify()).rejects.toThrow('image hash');
    const row = f.results.reports[0];
    row.stage = 'geometry-invariant-failed';
    row.numericEligible = false;
    row.geometryFailure = { message: 'Synthetic invariant failure' };
    delete row.nativeImageSha256;
    delete row.halfImageSha256;
    await f.saveReport(0);
    await unlink(join(f.output, 'normal-01.png'));
    await unlink(join(f.output, 'normal-01-half.png'));
    expect(await f.verify()).toMatchObject({ imageCount: 16 });
    await writeFile(join(f.output, 'normal-01.png'), native);
    await expect(f.verify()).rejects.toThrow('unexpected or missing row images');
  });

  it('retains preview-owner gates while treating full-owner error as diagnostic', async () => {
    const f = await fixture();
    const row = f.results.reports[0];
    for (const [index, sign] of [
      [0, 1],
      [1, -1],
    ]) {
      const owner = row.fullCoverage.owners[index];
      owner.realizedSphereFraction += sign * 0.0012;
      owner.errorPercentagePoints = sign * 0.12;
    }
    await f.saveReport(0);
    expect((await f.verify()).verified).toBe(true);
    row.previewCoverage = structuredClone(row.fullCoverage);
    await f.saveReport(0);
    await expect(f.verify()).rejects.toThrow('numeric eligibility');
    row.numericEligible = false;
    row.stage = 'coverage-failed';
    await f.saveReport(0);
    expect((await f.verify()).imageCount).toBe(18);
  });

  it('rejects certificate-mode and placement-frame claims inconsistent with the fixed contract', async () => {
    const f = await fixture();
    const row = f.results.reports[0];
    row.construction.owners[0].certificate.metrics.collarWidthUpperMode = 'root';
    await f.saveReport(0);
    await expect(f.verify()).rejects.toThrow('root-and-far');
    row.construction.owners[0].certificate.metrics.collarWidthUpperMode = 'root-and-far';
    row.placement.owners[0].north = row.placement.owners[0].north.map((v) => -v);
    await f.saveReport(0);
    await expect(f.verify()).rejects.toThrow('placement geometry and pair receipts');
  });
});
