import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

import { afterEach, expect, it } from 'vitest';

import { certifyCandidate } from '../issue-178/certificates.mjs';
import { CERTIFICATE_OPTIONS, inputs } from './corpus.mjs';
import { hash } from './sources.mjs';
import { verifySecond } from './stage2.mjs';

const base = new URL('./evidence/state-2/', import.meta.url),
  temporary = [];
afterEach(async () => {
  await Promise.all(temporary.splice(0).map((p) => rm(p, { recursive: true })));
});
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'issue187-final-review-'));
  temporary.push(dir);
  await cp(fileURLToPath(base), dir, { recursive: true });
  return dir;
}
it('preserves the exact three-anchor source diff and all 60 declared final certificate receipts', async () => {
  const first = await readFile(new URL('./states/state-1/layout.mjs', import.meta.url), 'utf8');
  const second = await readFile(new URL('./states/state-2/layout.mjs', import.meta.url), 'utf8');
  expect(second).toBe(
    first
      .replace('  [0.18, -0.49],', '  [0.3, -0.55],')
      .replace('  [0.49, -0.38],', '  [0.8, -0.5],')
      .replace('  [0.51, -0.3],', '  [0.65, -0.35],'),
  );
  const reports = JSON.parse(gunzipSync(await readFile(new URL('reports.json.gz', base))));
  expect(reports.map((r) => r.input)).toEqual(inputs());
  for (const report of reports)
    expect(
      certifyCandidate(report.candidate, { quota: report.input.quota, ...CERTIFICATE_OPTIONS }),
    ).toEqual(report.certificate);
});
it('replays final geometry/images and verifies the actual predecessor through the separate guard', async () => {
  expect(await verifySecond()).toEqual({
    verified: true,
    stage: 'state-2',
    cases: 60,
    passed: 60,
    images: 2,
    predecessorVerified: true,
  });
});
it('rejects coherently rehashed retained review/authorization substitution against trusted prerequisites', async () => {
  const dir = await fixture(),
    reviewPath = 'docs/investigations/issue-187/independent-design-review-state2.md',
    authorizationPath = 'docs/investigations/issue-187/states/state-2/authorization.json';
  const manifest = JSON.parse(await readFile(join(dir, 'source-manifest.json'))),
    snapshot = JSON.parse(gunzipSync(await readFile(join(dir, 'sources.json.gz')))),
    receipt = JSON.parse(await readFile(join(dir, 'receipt.json')));
  snapshot[reviewPath] += '\nSubstituted review';
  const authorization = JSON.parse(snapshot[authorizationPath]);
  authorization.hashes.review = hash(snapshot[reviewPath]);
  snapshot[authorizationPath] = JSON.stringify(authorization);
  manifest.declaration = authorization;
  manifest.sources[reviewPath] = hash(snapshot[reviewPath]);
  manifest.sources[authorizationPath] = hash(snapshot[authorizationPath]);
  const bytes = JSON.stringify(manifest);
  receipt.sourceManifestSha256 = hash(bytes);
  await writeFile(join(dir, 'source-manifest.json'), bytes);
  await writeFile(join(dir, 'sources.json.gz'), gzipSync(Buffer.from(JSON.stringify(snapshot))));
  await writeFile(join(dir, 'receipt.json'), JSON.stringify(receipt));
  await expect(verifySecond(dir)).rejects.toThrow('trusted second-state closure and prerequisites');
});
it('rejects changed images and a coherently rehashed false final outcome', async () => {
  const dir = await fixture(),
    image = await readFile(join(dir, 'panel.png'));
  await writeFile(join(dir, 'panel.png'), 'changed image');
  await expect(verifySecond(dir)).rejects.toThrow('Artifact hash: panel.png');
  await writeFile(join(dir, 'panel.png'), image);
  const summary = JSON.parse(await readFile(join(dir, 'summary.json'))),
    receipt = JSON.parse(await readFile(join(dir, 'receipt.json')));
  summary.passed = 59;
  receipt.passed = 59;
  const bytes = JSON.stringify(summary);
  receipt.artifacts['summary.json'] = hash(bytes);
  await writeFile(join(dir, 'summary.json'), bytes);
  await writeFile(join(dir, 'receipt.json'), JSON.stringify(receipt));
  await expect(verifySecond(dir)).rejects.toThrow('Exact second-state receipt and image replay');
});
