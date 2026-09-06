import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

import { test } from 'vitest';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function shadow() {
  const temporary = await mkdtemp(join(tmpdir(), 'issue180-verifier-test-'));
  for (const name of await readdir(root)) {
    if (name === 'issue-180') continue;
    await symlink(join(root, name), join(temporary, name));
  }
  const base = join(temporary, 'issue-180');
  await mkdir(base);
  for (const name of [
    'verify.mjs',
    'run-final.mjs',
    'audit-final.mjs',
    'corpus.mjs',
    'evidence-final',
  ])
    await cp(join(root, 'issue-180', name), join(base, name), { recursive: true });
  const evidence = join(base, 'evidence-final');
  return { temporary, base, evidence };
}
async function mutateJson(path, change) {
  const object = JSON.parse(await readFile(path));
  change(object);
  await writeFile(path, JSON.stringify(object));
}
for (const mode of ['source', 'omitted-hash', 'changed-row', 'changed-input']) {
  test(`read-only verifier rejects ${mode} tampering in disposable evidence`, async () => {
    const { temporary, base, evidence } = await shadow();
    try {
      if (mode === 'source') {
        const path = join(evidence, 'source-snapshot.json');
        const key = '../issue-180/audit-final.mjs';
        await mutateJson(path, (s) => {
          s[key] = "process.stdout.write('UNTRUSTED_SOURCE_EXECUTED');\n" + s[key];
        });
        const snapshot = JSON.parse(await readFile(path));
        const bytes = await readFile(path);
        await mutateJson(join(evidence, 'manifest.json'), (m) => {
          m.sourceHashes[key] = sha(snapshot[key]);
          m.sourceSnapshotSha256 = sha(bytes);
        });
      } else if (mode === 'omitted-hash') {
        await mutateJson(join(evidence, 'completion.json'), (m) => {
          delete m.artifacts['default-001.json.gz'];
        });
      } else if (mode === 'changed-row') {
        const path = join(evidence, 'default-001.json.gz');
        const row = JSON.parse(gunzipSync(await readFile(path)));
        row.result.status = 'geometry-and-placement-pass';
        const bytes = gzipSync(Buffer.from(JSON.stringify(row)));
        await writeFile(path, bytes);
        await mutateJson(join(evidence, 'completion.json'), (m) => {
          m.artifacts['default-001.json.gz'] = sha(bytes);
        });
      } else {
        await mutateJson(join(evidence, 'manifest.json'), (m) => {
          m.probes[0].input.seed = 'replaced-seed';
        });
      }
      const result = spawnSync(process.execPath, [join(base, 'verify.mjs'), '--final'], {
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /AssertionError/);
      assert(!result.stdout.includes('UNTRUSTED_SOURCE_EXECUTED'));
      if (mode === 'changed-row') assert.match(result.stderr, /default-001.json.gz/);
      if (mode === 'changed-input') assert.match(result.stderr, /replaced-seed/);
      if (mode === 'omitted-hash') assert.match(result.stderr, /default-001.json.gz/);
      if (mode === 'source')
        assert.match(result.stderr, /Snapshot must exactly match the trusted current closure/);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });
}
