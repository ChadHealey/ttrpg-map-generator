/** Read-only local stage verification; no writes or artifact regeneration on disk. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { BASE, hash, reconstruct } from './local-evidence.mjs';

const name = process.argv[2];
assert(typeof name === 'string' && /^[a-z0-9-]+$/.test(name), 'Supply a retained local stage name');
const directory = new URL(`local-diagnostics/${name}/`, BASE);
const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
for (const [path, expected] of Object.entries(manifest.artifacts))
  assert.equal(hash(await readFile(new URL(path, directory))), expected, path);
for (const [path, expected] of Object.entries(manifest.dependencies))
  assert.equal(hash(await readFile(new URL(path, BASE))), expected, path);
const sources = {};
for (const [path, filename] of Object.entries(manifest.sources))
  sources[path] = await readFile(new URL(filename, directory), 'utf8');
const inputs = JSON.parse(await readFile(new URL('inputs.json', directory), 'utf8'));
const actual = await reconstruct({ kind: manifest.kind, entry: manifest.entry, sources, inputs });
const expected = JSON.parse(await readFile(new URL('report.json', directory), 'utf8'));
const { image, ...report } = actual;
assert.deepEqual(
  JSON.parse(JSON.stringify(report)),
  Object.fromEntries(
    Object.entries(expected).filter(([key]) => !['scope', 'stage', 'kind'].includes(key)),
  ),
);
assert.deepEqual(image, await readFile(new URL('panel.png', directory)));
console.log(
  JSON.stringify({
    ok: true,
    stage: name,
    reportCount: actual.reports.length,
    panelCount: actual.panels.length,
  }),
);
