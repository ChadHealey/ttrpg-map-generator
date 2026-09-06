/** One immutable combined recipe per stage. Local planar evidence, never a world selection. */
import assert from 'node:assert/strict';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';

import { format, resolveConfig } from 'prettier';

import { png } from '../issue-164/render-comparison.mjs';
import { pointInPolygon, polygonArea, stitchBody } from '../issue-169/geometry.mjs';
import { captureSources, hash, loadSnapshot } from '../issue-177/local-evidence.mjs';

const BASE = new URL('.', import.meta.url),
  prefix = '../issue-184/';
const quotas = [
  0.13106846473029043 * 0.9905,
  0.10494186046511626 * 0.9905,
  0.06666666666666667 * 0.984,
];
const anatomies = [
  [0, 0],
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];
const options = { nominalClearance: 0.05, collarWidthUpperMode: 'root-and-far' };
const [mode, stage] = process.argv.slice(2);
assert(['--write', '--verify'].includes(mode) && /^recipe-[123]$/.test(stage));
const dir = new URL(`local-diagnostics/${stage}/`, BASE);
const entries = ['a', 'b', 'large'].map((name) => prefix + `recipes/${stage}/layout-${name}.mjs`);
async function trustedSources() {
  return Object.assign(
    {},
    ...(await Promise.all(
      [...entries, '../issue-178/certificates.mjs'].map((e) => captureSources(e)),
    )),
  );
}
async function reconstruct(sources) {
  const { certifyCandidate } = await loadSnapshot('../issue-178/certificates.mjs', sources);
  const reports = [];
  for (let l = 0; l < entries.length; l++) {
    const { buildCoast } = await loadSnapshot(entries[l], sources);
    for (const quota of l === 2 ? [0.17451657458563533 * 0.9905] : quotas)
      for (const anatomy of anatomies)
        for (const variation of [0, 1, 2, 3]) {
          const split = buildCoast('local-primary', { anatomy, variation });
          const bodyBoundary = stitchBody(split.interior, split.attachments);
          const scale = Math.sqrt((4 * Math.PI * quota) / polygonArea(bodyBoundary));
          const map = (o) =>
            Array.isArray(o)
              ? o.length === 2 && o.every((x) => typeof x === 'number')
                ? o.map((x) => x * scale)
                : o.map(map)
              : o && typeof o === 'object'
                ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, map(v)]))
                : o;
          const candidate = map({
            id: 'local-primary',
            primary: true,
            ...split,
            bodyBoundary,
            islands: [],
          });
          const certificate = certifyCandidate(candidate, { quota, ...options });
          reports.push({
            layout: ['A', 'B', 'Large'][l],
            variation,
            quota,
            anatomy,
            candidate,
            certificate,
          });
        }
  }
  const panels = reports.filter(
    (r) =>
      r.quota === (r.layout === 'Large' ? 0.17451657458563533 * 0.9905 : quotas[0]) &&
      r.anatomy.every((x) => x === 0) &&
      r.variation === 0,
  );
  const width = 900,
    height = 320,
    span = 2.5,
    pixels = new Uint8Array(width * height);
  for (let k = 0; k < panels.length; k++)
    for (let y = 0; y < height; y++)
      for (let x = 0; x < 300; x++) {
        const p = [(x / 300 - 0.5) * span, (0.5 - y / height) * span];
        pixels[y * width + k * 300 + x] = pointInPolygon(p, panels[k].candidate.bodyBoundary)
          ? 1
          : 0;
      }
  return {
    report: {
      scope: 'Local planar body-only diagnostic; no detached payment/world/visual acceptance',
      stage,
      quotas,
      anatomies,
      options,
      reports,
      panelOrder: ['A', 'B', 'Large'],
      width,
      height,
      span,
    },
    image: png(pixels, width, height),
  };
}
if (mode === '--write') {
  const sources = await trustedSources();
  const result = await reconstruct(sources);
  assert.deepEqual(await reconstruct(sources), result);
  await mkdir(dir, { recursive: false });
  const config = await resolveConfig(new URL('local-evidence.json', BASE).pathname);
  const text = await format(JSON.stringify(sources), { ...config, parser: 'json' });
  const report = await format(JSON.stringify(result.report), { ...config, parser: 'json' });
  const artifacts = {
    'sources.json': hash(text),
    'report.json': hash(report),
    'panel.png': hash(result.image),
  };
  for (const [name, bytes] of [
    ['sources.json', text],
    ['report.json', report],
    ['panel.png', result.image],
  ])
    await writeFile(new URL(name, dir), bytes, { flag: 'wx' });
  await writeFile(
    new URL('manifest.json', dir),
    await format(
      JSON.stringify({
        stage,
        entries,
        artifacts,
        writer: hash(await readFile(new URL('local-evidence.mjs', BASE))),
      }),
      { ...config, parser: 'json' },
    ),
    { flag: 'wx' },
  );
  console.log(
    JSON.stringify({
      stage,
      passed: result.report.reports.filter((r) => r.certificate.ok).length,
      total: 140,
    }),
  );
} else {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', dir)));
  assert.deepEqual(manifest.entries, entries);
  assert.deepEqual((await readdir(dir)).sort(), [
    'manifest.json',
    'panel.png',
    'report.json',
    'sources.json',
  ]);
  assert.deepEqual(Object.keys(manifest.artifacts).sort(), [
    'panel.png',
    'report.json',
    'sources.json',
  ]);
  for (const [name, value] of Object.entries(manifest.artifacts))
    assert.equal(hash(await readFile(new URL(name, dir))), value, name);
  assert.equal(hash(await readFile(new URL('local-evidence.mjs', BASE))), manifest.writer);
  const sources = JSON.parse(await readFile(new URL('sources.json', dir)));
  assert.deepEqual(
    sources,
    await trustedSources(),
    'Historical recipe source changed; reject before execution',
  );
  const result = await reconstruct(sources);
  assert.deepEqual(await reconstruct(sources), result);
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.report)),
    JSON.parse(await readFile(new URL('report.json', dir))),
  );
  assert.deepEqual(result.image, await readFile(new URL('panel.png', dir)));
  console.log(JSON.stringify({ stage, verified: true, receipts: 140, images: 1 }));
}
