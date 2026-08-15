import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const eslint = new ESLint({ cwd: repositoryRoot });
const ambientRandomSource = 'export const sample = Math.random();\n';

describe('deterministic Math.random lint boundary', () => {
  it.each([
    'packages/generation/src/generator-contracts.ts',
    'packages/assets/src/index.ts',
    'packages/render/src/index.ts',
    'packages/core/src/deterministic-random-stream.ts',
    'packages/core/src/seed-derivation.ts',
    'packages/core/src/seed-input.ts',
    'packages/core/src/sha-256.ts',
  ])('rejects ambient randomness in %s', async (filePath) => {
    const [result] = await eslint.lintText(ambientRandomSource, {
      filePath: resolve(repositoryRoot, filePath),
    });
    expect(result?.messages).toEqual(
      expect.arrayContaining([expect.objectContaining({ ruleId: 'no-restricted-syntax' })]),
    );
  });

  it('does not broaden the prohibition to unrelated core modules', async () => {
    const [result] = await eslint.lintText(ambientRandomSource, {
      filePath: resolve(repositoryRoot, 'packages/core/src/identity.ts'),
    });
    expect(result?.messages.some(({ ruleId }) => ruleId === 'no-restricted-syntax')).toBe(false);
  });
});
