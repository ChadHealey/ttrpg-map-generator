/** Investigation-only local gate and immutable fixed-input comparison receipts. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { format } from 'prettier';

import { landFraction, sampleGrid } from '../issue-164/morphology.mjs';
import { png, smoke } from '../issue-164/render-comparison.mjs';
import { inputs } from '../issue-165/run.mjs';
import { createPlacedField } from '../issue-169/field.mjs';
import { placeOwners } from './placement.mjs';
import { assessReadiness } from './readiness.mjs';
import { constructOwners } from './templates.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const json = async (path, value) =>
  writeFile(path, await format(JSON.stringify(value), { parser: 'json', printWidth: 100 }));
export function gridBytes(grid) {
  const bytes = Buffer.alloc(grid.values.length * 5);
  for (let i = 0; i < grid.values.length; i++) {
    bytes.writeInt32BE(grid.values[i], i * 5);
    bytes.writeInt8(grid.owners[i], i * 5 + 4);
  }
  return bytes;
}
export function coverage(grid, owners, input) {
  const water = 100 * (1 - landFraction(grid, 0));
  const areas = owners.map(() => 0);
  let total = 0;
  for (let y = 0; y <= grid.height; y++) {
    const weight = grid.weights[y];
    total += grid.width * weight;
    for (let x = 0; x < grid.width; x++) {
      const i = y * grid.width + x;
      if (grid.values[i] > 0) areas[grid.owners[i]] += weight;
    }
  }
  return {
    waterPercent: water,
    errorPercentagePoints: water - input.controls.targetWaterCoveragePercent,
    owners: owners.map((owner, i) => ({
      id: owner.id,
      quota: owner.quota,
      realizedSphereFraction: areas[i] / total,
      errorPercentagePoints: 100 * (areas[i] / total - owner.quota),
    })),
  };
}
export async function localGate(construct = constructOwners) {
  const reports = [];
  for (const input of await inputs()) {
    const construction = construct(input);
    assert.deepEqual(construction, construct(input));
    reports.push({ input, construction, exactRepeat: true });
  }
  return {
    reports,
    exactRepeat: true,
    ...assessReadiness(reports),
    completeCohortPassed: reports.every(
      ({ input, construction }) =>
        construction.ok &&
        construction.owners.length === input.controls.continentCountIntent &&
        new Set(construction.owners.map((owner) => owner.id)).size === construction.owners.length &&
        construction.owners.every((owner) => owner.certificate.ok) &&
        construction.owners.some((owner) => owner.candidate.primary),
    ),
  };
}
export function render(input, construct = constructOwners) {
  const construction = construct(input);
  if (!construction.ok)
    return {
      report: { input, stage: 'construction-failed', numericEligible: false, construction },
    };
  const placement = placeOwners(construction.owners, input.seed);
  if (!placement.ok)
    return {
      report: { input, stage: 'placement-failed', numericEligible: false, construction, placement },
    };
  const field = createPlacedField(placement.owners, input);
  const preview = sampleGrid(field, 400, 200),
    full = sampleGrid(field, 1600, 800);
  const previewCoverage = coverage(preview, placement.owners, input);
  const fullCoverage = coverage(full, placement.owners, input);
  let geometry;
  try {
    geometry = smoke(field, preview, full, 0);
  } catch (error) {
    return {
      report: {
        input,
        stage: 'geometry-invariant-failed',
        numericEligible: false,
        construction,
        placement,
        previewCoverage,
        fullCoverage,
        geometryFailure: { name: error.name, message: error.message },
      },
    };
  }
  const mask = Uint8Array.from(full.values.subarray(0, 1600 * 800), (v) => Number(v > 0));
  const halfMask = new Uint8Array(800 * 400);
  for (let y = 0; y < 400; y++)
    for (let x = 0; x < 800; x++) halfMask[y * 800 + x] = mask[y * 2 * 1600 + x * 2];
  const nativeImage = png(mask, 1600, 800),
    halfImage = png(halfMask, 800, 400);
  const numericEligible =
    Math.abs(previewCoverage.errorPercentagePoints) <= 0.25 &&
    Math.abs(fullCoverage.errorPercentagePoints) <= 0.25 &&
    previewCoverage.owners.every(
      (owner) =>
        Math.abs(owner.errorPercentagePoints) <= 0.25 / input.controls.continentCountIntent,
    );
  return {
    nativeImage,
    halfImage,
    report: {
      input,
      stage: numericEligible ? 'numeric-gates-passed' : 'coverage-failed',
      numericEligible,
      construction,
      placement,
      previewCoverage,
      fullCoverage,
      geometry,
      geometryCheckScope:
        'seam/pole aliases and exact nested anchors; not topology or feature survival',
      previewGridSha256: hash(gridBytes(preview)),
      fullGridSha256: hash(gridBytes(full)),
      maskSha256: hash(mask),
      nativeImageSha256: hash(nativeImage),
      halfImageSha256: hash(halfImage),
      humanVisualDecision: 'pending',
      productionSelection: false,
    },
  };
}
async function main() {
  const mode = process.argv[2],
    target = process.argv[3];
  if (!['--local-gate', '--compare', '--local-gate-r2', '--compare-r2'].includes(mode) || !target)
    throw new Error('Use --local-gate[-r2] NEW_DIRECTORY or --compare[-r2] NEW_DIRECTORY.');
  const isR2 = mode.endsWith('-r2');
  const construct = isR2 ? (await import('./templates-r2.mjs')).constructOwners : constructOwners;
  const revision = isR2 ? 'issue-170-r2' : 'issue-170-r1';
  const comparison = mode.startsWith('--compare');
  const output = resolve(target);
  if (!output.startsWith(HERE) || output === HERE.slice(0, -1))
    throw new Error('Evidence must use a new revision directory inside issue-170.');
  await mkdir(output, { recursive: false });
  const sources = {},
    sourceSnapshot = {};
  for (const file of [
    'experiment.md',
    'templates.mjs',
    'design.md',
    '../issue-169/certificates.mjs',
    '../issue-169/geometry.mjs',
    '../issue-169/placement.mjs',
    '../issue-169/templates.mjs',
    'placement.mjs',
    'readiness.mjs',
    '../issue-169/field.mjs',
    'run.mjs',
    '../issue-164/morphology.mjs',
    '../issue-164/render-comparison.mjs',
    '../issue-165/run.mjs',
    '../issue-164/comparison/results.json',
    ...(isR2 ? ['templates-r2.mjs', 'revision-r2.md'] : []),
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
