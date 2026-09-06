/** Local planar rejection evidence only; never world coverage or human visual approval. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

import { format } from 'prettier';

import { png } from '../../issue-164/render-comparison.mjs';
import { pointInPolygon } from '../../issue-169/geometry.mjs';
const HERE = new URL('.', import.meta.url);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = async (value) => format(JSON.stringify(value), { parser: 'json' });
const inputsBytes = await readFile(new URL('inputs.json', HERE));
const inputs = JSON.parse(inputsBytes);
const manifest = {
  kind: 'rejected-local-planar-construction',
  status: 'REJECTED',
  inputsSha256: sha256(inputsBytes),
  scope:
    'Continuous local polygons and planar previews only. No world placement, sampled coverage, full comparison, production selection, or human visual approval.',
  stages: [],
};
manifest.dependencies = [];
for (const path of [
  '../../issue-164/morphology.mjs',
  '../../issue-164/render-comparison.mjs',
  '../../issue-169/geometry.mjs',
  '../../issue-169/certificates.mjs',
  './generate.mjs',
]) {
  const bytes = await readFile(new URL(path, HERE));
  manifest.dependencies.push({ path, sha256: sha256(bytes) });
}
manifest.exploratoryArtifacts = [];
for (const path of [
  'repair-draft.json',
  'exploratory-before.png',
  'exploratory-intermediate.png',
]) {
  const bytes = await readFile(new URL(path, HERE));
  manifest.exploratoryArtifacts.push({
    path,
    sha256: sha256(bytes),
    scope:
      'Retained exploratory local artifact; intermediate image has no exact source snapshot. Reproducible final stage images and source pairs below own the canonical local evidence.',
  });
}
for (const stage of ['before-repair', 'after-repair']) {
  const sourceFile = `${stage}-source.mjs.txt`;
  const source = await readFile(new URL(sourceFile, HERE), 'utf8');
  // Resolve the frozen source's relative imports in memory. Absolute runtime URLs are never evidence.
  const resolved = source.replace(
    /from '(\.[^']+)'/g,
    (_match, specifier) => `from '${new URL(specifier, new URL('../', HERE)).href}'`,
  );
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(resolved).toString('base64')}`
  );
  const reports = inputs.map((input) => ({ input, result: module.constructOwners(input) }));
  assert.deepEqual(
    reports,
    inputs.map((input) => ({ input, result: module.constructOwners(input) })),
  );
  const panels = [];
  for (const { input, result } of reports.slice(0, 4))
    for (const owner of result.owners.filter((owner) => owner.primary))
      if (!panels.some((panel) => panel.layoutIndex === owner.candidate.layoutIndex))
        panels.push({
          inputId: input.id,
          ownerId: owner.id,
          layoutIndex: owner.candidate.layoutIndex,
          quota: owner.quota,
          guardRadius: owner.radius,
          candidate: owner.candidate,
        });
  const panelSize = 300,
    width = panels.length * panelSize,
    height = panelSize,
    chartSpan = 2.4;
  const pixels = new Uint8Array(width * height);
  for (let panel = 0; panel < panels.length; panel++) {
    const candidate = panels[panel].candidate;
    const polygons = [candidate.bodyBoundary, ...candidate.islands.map((island) => island.polygon)];
    for (let y = 0; y < height; y++)
      for (let x = 0; x < panelSize; x++) {
        const point = [(x / panelSize - 0.5) * chartSpan, (0.5 - y / panelSize) * chartSpan];
        pixels[y * width + panel * panelSize + x] = polygons.some((polygon) =>
          pointInPolygon(point, polygon),
        )
          ? 1
          : 0;
      }
  }
  const image = png(pixels, width, height);
  assert.deepEqual(image, png(pixels, width, height));
  const reportFile = `${stage}.json`,
    imageFile = `${stage}.png`;
  const reportBytes = await json({ stage, sourceSha256: sha256(source), reports });
  await writeFile(new URL(reportFile, HERE), reportBytes);
  await writeFile(new URL(imageFile, HERE), image);
  manifest.stages.push({
    stage,
    sourceFile,
    sourceSha256: sha256(source),
    reportFile,
    reportSha256: sha256(reportBytes),
    imageFile,
    imageSha256: sha256(image),
    exactLocalRepeat: true,
    width,
    height,
    panelSize,
    chartSpan,
    panels: panels.map(({ inputId, ownerId, layoutIndex, quota, guardRadius }) => ({
      inputId,
      ownerId,
      layoutIndex,
      quota,
      guardRadius,
    })),
    assessment:
      stage === 'before-repair'
        ? 'Rejected in assistant local inspection: jigsaw/tab grammar despite passing local certificates.'
        : 'Rejected: tab grammar persists; balanced caps exceed the necessary packing ceiling and accepted default layouts omit layout 0.',
  });
}
await writeFile(new URL('manifest.json', HERE), await json(manifest));
