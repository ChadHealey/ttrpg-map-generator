/** Read-only replay of 45 receipts and the original labeled PNG. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { BASE, hash, loadSnapshot } from '../../local-evidence.mjs';

const directory = new URL('.', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
for (const [path, expected] of Object.entries(manifest.artifacts))
  assert.equal(hash(await readFile(new URL(path, directory))), expected, path);
for (const [path, expected] of Object.entries(manifest.dependencies))
  assert.equal(hash(await readFile(new URL(path, BASE))), expected, path);
const sources = {};
for (const [path, name] of Object.entries(manifest.sources))
  sources[path] = await readFile(new URL(name, directory), 'utf8');
const module = await loadSnapshot(manifest.entry, sources);
const actual = module.reconstruct();
const expected = JSON.parse(await readFile(new URL('report.json', directory), 'utf8'));
assert.deepEqual(
  actual,
  Object.fromEntries(
    Object.entries(expected).filter(([key]) => !['sourceSha256', 'dependencies'].includes(key)),
  ),
);
const python = process.argv[2] ?? 'python3';
const drawing = fileURLToPath(new URL('draw.py', directory));
const metadata = JSON.parse(execFileSync(python, [drawing, '--metadata'], { encoding: 'utf8' }));
assert.deepEqual(metadata, manifest.drawingDependencies);
const image = execFileSync(python, [drawing], {
  input: JSON.stringify(actual),
  maxBuffer: 10 * 1024 * 1024,
});
assert.deepEqual(image, await readFile(new URL('panel.png', directory)));
console.log(
  JSON.stringify({
    ok: true,
    receipts: actual.reports.length,
    variants: actual.variants.length,
    originalPngBytes: true,
  }),
);
