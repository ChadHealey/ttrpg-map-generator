/** Bounded immutable local stages. --verify never writes; --write refuses existing directories. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

import { format, resolveConfig } from 'prettier';

import { png } from '../issue-164/render-comparison.mjs';
import { pointInPolygon, polygonArea, stitchBody } from '../issue-169/geometry.mjs';
import { captureSources, hash, loadSnapshot } from '../issue-177/local-evidence.mjs';

const BASE = new URL('.', import.meta.url),
  prefix = '../issue-179/';
const option = { nominalClearance: 0.05, collarWidthUpperMode: 'root-and-far' };
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
const dependencies = [
  'local-evidence.mjs',
  '../issue-177/local-evidence.mjs',
  '../issue-164/render-comparison.mjs',
  '../issue-164/morphology.mjs',
  '../issue-169/geometry.mjs',
];
async function reconstruct(entry, sources, inputs) {
  const module = await loadSnapshot(prefix + entry, sources),
    { certifyCandidate } = await loadSnapshot('../issue-178/certificates.mjs', sources);
  let reports, panels;
  if (entry === 'templates.mjs') {
    reports = inputs.map((input) => ({ input, result: module.constructOwners(input) }));
    assert.deepEqual(
      reports,
      inputs.map((input) => ({ input, result: module.constructOwners(input) })),
    );
    panels = [];
    for (const { input, result } of reports.slice(0, 4))
      for (const owner of result.owners)
        if (
          !panels.some(
            (p) => p.primary === owner.primary && p.layoutIndex === owner.candidate.layoutIndex,
          )
        )
          panels.push({
            inputId: input.id,
            ownerId: owner.id,
            primary: owner.primary,
            layoutIndex: owner.candidate.layoutIndex,
            candidate: owner.candidate,
          });
    panels.sort((a, b) => Number(b.primary) - Number(a.primary) || a.layoutIndex - b.layoutIndex);
  } else {
    reports = quotas.flatMap((quota) =>
      anatomies.map((anatomy) => {
        const split = module.buildCoast('local-layout', { anatomy, variation: 0 });
        let candidate = {
          id: 'local-layout',
          primary: true,
          collarWidthUpperMode: option.collarWidthUpperMode,
          ...split,
          islands: [],
          bodyBoundary: stitchBody(split.interior, split.attachments),
        };
        const scale = Math.sqrt((4 * Math.PI * quota) / polygonArea(candidate.bodyBoundary));
        const map = (o) =>
          Array.isArray(o)
            ? o.length === 2 && o.every((x) => typeof x === 'number')
              ? o.map((x) => x * scale)
              : o.map(map)
            : o && typeof o === 'object'
              ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, map(v)]))
              : o;
        candidate = map(candidate);
        return {
          quota,
          anatomy,
          candidate,
          certificate: certifyCandidate(candidate, { quota, ...option }),
        };
      }),
    );
    panels = reports
      .filter((r) => r.anatomy.every((x) => x === 0))
      .map((r) => ({ quota: r.quota, candidate: r.candidate }));
  }
  const width = panels.length * 300,
    height = 300,
    span = 2.5,
    pixels = new Uint8Array(width * height);
  for (let k = 0; k < panels.length; k++) {
    const candidate = panels[k].candidate,
      polygons = [candidate.bodyBoundary, ...candidate.islands.map((i) => i.polygon)];
    for (let y = 0; y < height; y++)
      for (let x = 0; x < 300; x++)
        pixels[y * width + k * 300 + x] = polygons.some((p) =>
          pointInPolygon([(x / 300 - 0.5) * span, (0.5 - y / 300) * span], p),
        )
          ? 1
          : 0;
  }
  return {
    report: {
      scope: 'Local planar evidence, no world comparison or human acceptance',
      entry,
      option,
      inputs,
      reports,
      panels,
      width,
      height,
      span,
    },
    image: png(pixels, width, height),
  };
}
const [mode, name, entry, sourceOverride] = process.argv.slice(2);
assert(
  ['--write', '--verify'].includes(mode) && /^[a-z0-9-]+$/.test(name),
  'Use --write|--verify and a stage name',
);
const directory = new URL(`local-diagnostics/${name}/`, BASE);
if (mode === '--write') {
  assert(
    ['templates.mjs', 'layout-a.mjs', 'layout-b.mjs', 'layout-c.mjs'].includes(entry),
    'Known local entry required',
  );
  assert(
    sourceOverride === undefined ||
      /^local-diagnostics\/[a-z0-9-]+\.mjs\.txt$/.test(sourceOverride),
    'Public relative source override only',
  );
  const overrides = sourceOverride ? { [prefix + entry]: prefix + sourceOverride } : {};
  const sources = {
    ...(await captureSources(prefix + entry, overrides)),
    ...(await captureSources('../issue-178/certificates.mjs')),
  };
  const inputs = JSON.parse(await readFile(new URL('local-diagnostics/inputs.json', BASE), 'utf8'));
  const actual = await reconstruct(entry, sources, inputs);
  await mkdir(directory);
  const config = await resolveConfig(new URL('local-evidence.json', BASE).pathname),
    json = (v) => format(JSON.stringify(v), { ...config, parser: 'json' });
  const artifacts = {},
    files = {},
    dependencyHashes = {};
  let i = 0;
  async function save(path, bytes) {
    await writeFile(new URL(path, directory), bytes);
    artifacts[path] = hash(bytes);
  }
  for (const [path, source] of Object.entries(sources)) {
    const filename = `source-${String(i++).padStart(2, '0')}.mjs.txt`;
    files[path] = filename;
    await save(filename, source);
  }
  await save('report.json', await json(actual.report));
  await save('panel.png', actual.image);
  for (const path of dependencies)
    dependencyHashes[path] = hash(await readFile(new URL(path, BASE)));
  await writeFile(
    new URL('manifest.json', directory),
    await json({
      scope: 'Immutable local stage',
      entry,
      sources: files,
      artifacts,
      dependencies: dependencyHashes,
    }),
  );
  console.log(
    JSON.stringify({
      stage: name,
      reports: actual.report.reports.length,
      panels: actual.report.panels.length,
    }),
  );
} else {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
  for (const [path, expected] of Object.entries(manifest.artifacts))
    assert.equal(hash(await readFile(new URL(path, directory))), expected, path);
  for (const [path, expected] of Object.entries(manifest.dependencies))
    assert.equal(hash(await readFile(new URL(path, BASE))), expected, path);
  const sources = {};
  for (const [path, file] of Object.entries(manifest.sources))
    sources[path] = await readFile(new URL(file, directory), 'utf8');
  const expected = JSON.parse(await readFile(new URL('report.json', directory), 'utf8'));
  const actual = await reconstruct(manifest.entry, sources, expected.inputs);
  assert.deepEqual(JSON.parse(JSON.stringify(actual.report)), expected);
  assert.deepEqual(actual.image, await readFile(new URL('panel.png', directory)));
  console.log(
    JSON.stringify({
      ok: true,
      stage: name,
      reports: actual.report.reports.length,
      panels: actual.report.panels.length,
    }),
  );
}
