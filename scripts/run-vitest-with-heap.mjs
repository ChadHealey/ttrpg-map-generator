import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const vitestPath = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));
const result = spawnSync(process.execPath, [vitestPath, ...process.argv.slice(2)], {
  env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' },
  stdio: 'inherit',
});

if (result.error !== undefined) throw result.error;
process.exitCode = result.status ?? 1;
