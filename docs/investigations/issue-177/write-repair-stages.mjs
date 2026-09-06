/** Create one NEW immutable local stage; existing directories are never replaced. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { format, resolveConfig } from 'prettier';

import { BASE, captureSources, hash, reconstruct } from './local-evidence.mjs';

const presets = {
  'b-extent-rejected': {
    kind: 'layout',
    entry: 'layout-b.mjs',
    overrides: { 'layout-b.mjs': 'local-diagnostics/b-macro-extent-failure.mjs.txt' },
  },
  'b-share-rejected': {
    kind: 'layout',
    entry: 'layout-b.mjs',
    overrides: { 'layout-b.mjs': 'local-diagnostics/b-macro-share-failure.mjs.txt' },
  },
};
const stage = process.argv[2],
  name = process.argv[3] ?? stage;
assert(
  presets[stage] && /^[a-z0-9-]+$/.test(name),
  'Use b-extent-rejected|b-share-rejected and an optional new stage name',
);
const directory = new URL(`local-diagnostics/${name}/`, BASE),
  preset = presets[stage];
const sources = await captureSources(preset.entry, preset.overrides);
const inputs = JSON.parse(await readFile(new URL('local-diagnostics/inputs.json', BASE), 'utf8'));
const actual = await reconstruct({ ...preset, sources, inputs });
await mkdir(directory); // EEXIST is deliberate: never rewrite retained evidence.
const config = await resolveConfig(fileURLToPath(new URL('local-evidence.json', BASE)));
const json = async (value) => format(JSON.stringify(value), { ...config, parser: 'json' });
const artifacts = {},
  files = {};
async function save(path, bytes) {
  await writeFile(new URL(path, directory), bytes);
  artifacts[path] = hash(bytes);
}
let index = 0;
for (const [path, source] of Object.entries(sources)) {
  const filename = `source-${String(index++).padStart(2, '0')}.mjs.txt`;
  files[path] = filename;
  await save(filename, source);
}
await save('inputs.json', await json(inputs));
const { image, ...report } = actual;
await save(
  'report.json',
  await json({
    scope: 'Local planar evidence; no world placement or human acceptance',
    stage,
    kind: preset.kind,
    ...report,
  }),
);
await save('panel.png', image);
const dependencies = {};
for (const path of [
  'local-evidence.mjs',
  'write-local.mjs',
  'write-repair-stages.mjs',
  'verify-local.mjs',
  '../issue-164/render-comparison.mjs',
  '../issue-164/morphology.mjs',
  '../issue-169/geometry.mjs',
])
  dependencies[path] = hash(await readFile(new URL(path, BASE)));
await writeFile(
  new URL('manifest.json', directory),
  await json({
    scope: 'Immutable local stage',
    stage,
    kind: preset.kind,
    entry: preset.entry,
    sources: files,
    artifacts,
    dependencies,
  }),
);
console.log(
  JSON.stringify({
    stage: name,
    reportCount: actual.reports.length,
    panelCount: actual.panels.length,
  }),
);
