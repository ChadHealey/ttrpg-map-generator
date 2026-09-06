/** Reproduce immutable inputs, baseline diagnostics, two complete new runs, and focused control probes. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { format } from 'prettier';

import {
  calibrate as oldCalibrate,
  createField as oldField,
  FAMILIES,
  landFraction,
  sampleGrid,
} from '../issue-164/morphology.mjs';
import { png, smoke } from '../issue-164/render-comparison.mjs';
import { budgetShares, calibrate, createField, REVISION, TOLERANCE_PERCENT } from './field.mjs';
import { gridBytes, islandEffects, maskAt, measure, sha256 } from './measure.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
export async function inputs() {
  const baseline = JSON.parse(await readFile(join(HERE, '../issue-164/comparison/results.json')));
  const selected = baseline.reports
    .filter((row) => row.family === 'envelope')
    .map((row) => row.input);
  assert.deepEqual(
    selected.map((row) => row.id),
    [
      'normal-01',
      'normal-02',
      'normal-03',
      'normal-04',
      'connected-majority',
      'fragmented-islands',
    ],
  );
  for (const input of selected)
    assert.deepEqual(
      input,
      baseline.reports.find((row) => row.family === 'cellular' && row.input.id === input.id).input,
    );
  return selected;
}
export function baselineReport(family, input) {
  const field = oldField(family, input),
    preview = sampleGrid(field, 400, 200);
  const calibration = oldCalibrate(preview, input.controls.targetWaterCoveragePercent);
  return {
    revision: 'issue-164-r2',
    budgetInterpretation: 'inferred squared-size proxy; baseline had no area quotas',
    shares: budgetShares(field.owners),
    calibration,
    before: measure(field, preview, 0),
    after: measure(field, preview, calibration.threshold),
    previewGridSha256: sha256(gridBytes(preview)),
  };
}
export function render(family, input) {
  const field = createField(family, input),
    initial = sampleGrid(field, 400, 200),
    before = measure(field, initial);
  const calibration = calibrate(field),
    preview = sampleGrid(field, 400, 200),
    after = measure(field, preview);
  const full = sampleGrid(field, 1600, 800),
    mask = maskAt(full),
    bytes = gridBytes(full);
  const simplified = new Uint8Array(800 * 400);
  for (let y = 0; y < 400; y++)
    for (let x = 0; x < 800; x++) simplified[y * 800 + x] = mask[y * 2 * 1600 + x * 2];
  const image = png(mask, 1600, 800),
    half = png(simplified, 800, 400);
  const fullWaterPercent = 100 * (1 - landFraction(full, 0));
  const fullCoverageErrorPercent = fullWaterPercent - input.controls.targetWaterCoveragePercent;
  return {
    bytes,
    mask,
    image,
    half,
    report: {
      family,
      input,
      revision: REVISION,
      intendedOwnerLandShares: budgetShares(field.owners),
      calibration,
      before,
      after,
      changes: {
        waterPercent: after.waterPercent - before.waterPercent,
        ownerSpherePercent: after.ownerShares.map(
          (row, i) => row.spherePercent - before.ownerShares[i].spherePercent,
        ),
        guardContactConfirmedFraction:
          after.guardContact.confirmedFraction - before.guardContact.confirmedFraction,
        guardContactUpperFraction:
          after.guardContact.upperFraction - before.guardContact.upperFraction,
      },
      fullWaterPercent,
      fullCoverageErrorPercent,
      numericEligible:
        calibration.status === 'calibrated' &&
        Math.abs(fullCoverageErrorPercent) <= TOLERANCE_PERCENT &&
        Math.abs(after.coverageErrorPercent) <= TOLERANCE_PERCENT,
      geometry: smoke(field, preview, full, 0),
      islands: islandEffects(field, preview),
      initialPreviewGridSha256: sha256(gridBytes(initial)),
      previewGridSha256: sha256(gridBytes(preview)),
      fullGridSha256: sha256(bytes),
      maskSha256: sha256(mask),
      pngSha256: sha256(image),
      simplifiedSha256: sha256(half),
    },
  };
}
export function probe(family, input) {
  const field = createField(family, input),
    calibration = calibrate(field),
    grid = sampleGrid(field, 400, 200);
  return {
    family,
    input,
    calibration,
    measures: measure(field, grid),
    islands: islandEffects(field, grid),
    gridSha256: sha256(gridBytes(grid)),
  };
}
const json = async (path, value) =>
  writeFile(path, await format(JSON.stringify(value), { parser: 'json', printWidth: 100 }));
async function main() {
  // Explicit output is required, avoiding accidental overwrite of a human-reviewed revision.
  if (!process.argv[2])
    throw new Error('Pass a new output directory; never overwrite reviewed evidence');
  const output = resolve(process.argv[2]);
  if (output !== HERE.slice(0, -1) && !output.startsWith(HERE)) {
    // Repeats may use disposable directories; no source/baseline writer exists.
    assert(!output.includes('/issue-164'));
  }
  await mkdir(output, { recursive: false });
  const reports = [],
    baselines = [],
    cases = await inputs();
  for (const family of FAMILIES)
    for (const input of cases) {
      const first = render(family, input),
        repeat = render(family, input);
      for (const key of ['bytes', 'mask', 'image', 'half', 'report'])
        assert.deepEqual(first[key], repeat[key]);
      await writeFile(join(output, `${family}-${input.id}.png`), first.image);
      await writeFile(join(output, `${family}-${input.id}-simplified.png`), first.half);
      reports.push({ ...first.report, exactRepeat: true });
      baselines.push({ family, input, ...baselineReport(family, input) });
      console.log(
        `${family}/${input.id}: ${first.report.calibration.status}; water ${first.report.fullWaterPercent.toFixed(3)}%; exact repeat`,
      );
    }
  const probes = [];
  for (const family of FAMILIES)
    for (const control of ['islandAbundancePercent', 'archipelagoAbundancePercent'])
      for (const value of [0, 100]) {
        const input = {
          ...cases[0],
          id: `normal-01-${control}-${value}`,
          controls: { ...cases[0].controls, [control]: value },
        };
        const first = probe(family, input);
        assert.deepEqual(first, probe(family, input));
        probes.push({ control, value, ...first, exactRepeat: true });
        console.log(`${family}/${control}=${value}: ${JSON.stringify(first.islands.statuses)}`);
      }
  const sources = {};
  for (const file of [
    'experiment.md',
    'field.mjs',
    'measure.mjs',
    'run.mjs',
    '../issue-164/morphology.mjs',
    '../issue-164/render-comparison.mjs',
    '../issue-164/comparison/results.json',
  ])
    sources[file] = sha256(await readFile(join(HERE, file)));
  await json(join(output, 'results.json'), {
    generated: true,
    editPolicy: 'regenerate into new directory; preserve reviewed revisions',
    revision: REVISION,
    prerequisiteCommit: 'd7b0755e9bf77e62dee0bc080a7048e111046b47',
    sources,
    reports,
    baselines,
    probes,
  });
  await json(join(output, 'runtime.json'), {
    platform: process.platform,
    architecture: process.arch,
    node: process.version,
    versions: { v8: process.versions.v8, zlib: process.versions.zlib },
    repeatScope: 'local process; macOS/Linux equality unproven',
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
