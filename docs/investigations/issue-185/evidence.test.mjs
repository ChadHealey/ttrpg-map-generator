import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { verifyEvidence } from './run.mjs';
import { hash } from './runtime.mjs';

const temporary = [];
afterEach(async () => {
  await Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true })));
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'issue185-vector-tamper-'));
  temporary.push(root);
  const directory = join(root, 'evidence');
  await cp(fileURLToPath(new URL('./evidence-r1', import.meta.url)), directory, {
    recursive: true,
  });
  return directory;
}
describe('immutable actual scope-vector evidence', () => {
  it('verifies exact recorded vectors and rejects changed vector bytes', async () => {
    const directory = await fixture();
    expect(await verifyEvidence(directory)).toMatchObject({
      verified: true,
      matrixRows: 48,
      vectors: 6052,
      sources: 76,
    });
    await writeFile(join(directory, 'vectors.json.gz'), 'changed vector bytes');
    await expect(verifyEvidence(directory)).rejects.toThrow('Artifact hash: vectors.json.gz');
  }, 15000);
  it('rejects a coherently rehashed declared matrix row against the fixed replay', async () => {
    const directory = await fixture();
    const matrix = JSON.parse(await readFile(join(directory, 'matrix.json'), 'utf8'));
    matrix.matrix[0].ownerCount = 8;
    const bytes = Buffer.from(JSON.stringify(matrix));
    await writeFile(join(directory, 'matrix.json'), bytes);
    const receipt = JSON.parse(await readFile(join(directory, 'receipt.json'), 'utf8'));
    receipt.artifacts['matrix.json'] = hash(bytes);
    await writeFile(join(directory, 'receipt.json'), JSON.stringify(receipt));
    await expect(verifyEvidence(directory)).rejects.toThrow('Exact canonical vector/matrix replay');
  }, 15000);
});
