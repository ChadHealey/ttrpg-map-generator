import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

import { afterEach, expect, it } from 'vitest';

import { record, verify } from './run.mjs';
import { hash, stageEntry } from './sources.mjs';

const temporary = [];
afterEach(async () => {
  await Promise.all(temporary.splice(0).map((p) => rm(p, { recursive: true })));
});
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'issue187-review-'));
  temporary.push(directory);
  await cp(fileURLToPath(new URL('./evidence/state-1', import.meta.url)), directory, {
    recursive: true,
  });
  return directory;
}
it('exact replay succeeds and an existing state or third state cannot be overwritten', async () => {
  expect(await verify('state-1')).toMatchObject({
    verified: true,
    cases: 60,
    passed: 60,
    images: 2,
  });
  await expect(record('state-1')).rejects.toMatchObject({ code: 'EEXIST' });
  expect(() => stageEntry('state-3')).toThrow('Only two');
});
it('rejects coherently rehashed source injection and unknown paths before geometry import', async () => {
  const directory = await fixture(),
    key = 'docs/investigations/issue-187/states/state-1/layout.mjs';
  const manifest = JSON.parse(await readFile(join(directory, 'source-manifest.json')));
  const snapshot = JSON.parse(gunzipSync(await readFile(join(directory, 'sources.json.gz'))));
  snapshot[key] += '\nthrow new Error("untrusted retained geometry must not execute");';
  manifest.sources[key] = hash(snapshot[key]);
  await writeFile(join(directory, 'source-manifest.json'), JSON.stringify(manifest));
  await writeFile(
    join(directory, 'sources.json.gz'),
    gzipSync(Buffer.from(JSON.stringify(snapshot))),
  );
  await expect(verify('state-1', directory)).rejects.toThrow('trusted current stage closure');
  manifest.sources['../../untrusted.mjs'] = 'a'.repeat(64);
  await writeFile(join(directory, 'source-manifest.json'), JSON.stringify(manifest));
  await expect(verify('state-1', directory)).rejects.toThrow('trusted current stage closure');
});
it('rejects changed images and coherently rehashed false summary outcomes', async () => {
  const directory = await fixture();
  const original = await readFile(join(directory, 'panel-half.png'));
  await writeFile(join(directory, 'panel-half.png'), 'changed image');
  await expect(verify('state-1', directory)).rejects.toThrow('Artifact hash: panel-half.png');
  await writeFile(join(directory, 'panel-half.png'), original);
  const summary = JSON.parse(await readFile(join(directory, 'summary.json')));
  summary.passed = 0;
  const bytes = JSON.stringify(summary),
    receipt = JSON.parse(await readFile(join(directory, 'receipt.json')));
  receipt.artifacts['summary.json'] = hash(bytes);
  await writeFile(join(directory, 'summary.json'), bytes);
  await writeFile(join(directory, 'receipt.json'), JSON.stringify(receipt));
  await expect(verify('state-1', directory)).rejects.toThrow(
    'Exact local receipt and image replay',
  );
});
