/** Bind the known local stage to trusted current source before any saved-source execution. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { captureSources, hash } from '../issue-177/local-evidence.mjs';

const BASE = new URL('.', import.meta.url),
  STAGE = new URL('local-diagnostics/recipe-1/', BASE),
  DEPENDENCIES = [
    'local-evidence.mjs',
    '../issue-177/local-evidence.mjs',
    '../issue-164/render-comparison.mjs',
    '../issue-164/morphology.mjs',
    '../issue-169/geometry.mjs',
  ];
function validatePaths(manifest, trustedSources) {
  assert.equal(manifest.entry, 'layout-large.mjs');
  assert.deepEqual(Object.keys(manifest.sources).sort(), Object.keys(trustedSources).sort());
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), [...DEPENDENCIES].sort());
  const files = Object.values(manifest.sources);
  assert.equal(new Set(files).size, files.length);
  assert.deepEqual(
    [...files].sort(),
    Array.from({ length: files.length }, (_, i) => `source-${String(i).padStart(2, '0')}.mjs.txt`),
  );
  assert.deepEqual(
    Object.keys(manifest.artifacts).sort(),
    [...files, 'report.json', 'panel.png'].sort(),
  );
}
export function validateLocalSnapshot({ manifest, files, trustedSources, trustedDependencies }) {
  validatePaths(manifest, trustedSources);
  assert.deepEqual(Object.keys(files).sort(), Object.keys(manifest.artifacts).sort());
  assert.deepEqual(manifest.dependencies, trustedDependencies);
  for (const [path, source] of Object.entries(trustedSources))
    assert.equal(
      Buffer.from(files[manifest.sources[path]]).toString('utf8'),
      source,
      `Untrusted local source: ${path}`,
    );
  for (const [name, expected] of Object.entries(manifest.artifacts))
    assert.equal(hash(files[name]), expected, name);
}
export async function readTrustedLocalStage() {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', STAGE), 'utf8')),
    trustedSources = {
      ...(await captureSources('../issue-182/layout-large.mjs')),
      ...(await captureSources('../issue-178/certificates.mjs')),
    },
    trustedDependencies = Object.fromEntries(
      await Promise.all(
        DEPENDENCIES.map(async (path) => [path, hash(await readFile(new URL(path, BASE)))]),
      ),
    );
  // Reject all manifest-controlled paths before opening the named artifact files.
  validatePaths(manifest, trustedSources);
  assert.deepEqual(
    (await readdir(STAGE)).sort(),
    ['manifest.json', ...Object.keys(manifest.artifacts)].sort(),
  );
  const files = Object.fromEntries(
    await Promise.all(
      Object.keys(manifest.artifacts).map(async (name) => [
        name,
        await readFile(new URL(name, STAGE)),
      ]),
    ),
  );
  return { manifest, files, trustedSources, trustedDependencies };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  validateLocalSnapshot(await readTrustedLocalStage());
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL('local-evidence.mjs', BASE)), '--verify', 'recipe-1'],
    { stdio: 'inherit' },
  );
}
