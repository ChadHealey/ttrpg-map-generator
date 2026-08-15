import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const CHECKER_PATH = resolve(dirname(fileURLToPath(import.meta.url)), 'check-staged-files.mjs');
const FIXTURE_ID = 'deterministic-proof';
const GENERATED_PATH = `fixtures/fixed-seeds/${FIXTURE_ID}/expected/baseline/aspect.canonical`;
const REVIEW_PATH = `fixtures/fixed-seeds/${FIXTURE_ID}/reviews/0001-initial.md`;

function write(repositoryRoot, path, contents) {
  const absolutePath = resolve(repositoryRoot, path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents);
}

function makeCommittedRepository() {
  const repositoryRoot = mkdtempSync(resolve(tmpdir(), 'ttrpg-staged-fixtures-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repositoryRoot });
  execFileSync('git', ['config', 'user.email', 'fixture-tests@example.invalid'], {
    cwd: repositoryRoot,
  });
  execFileSync('git', ['config', 'user.name', 'Fixture Tests'], { cwd: repositoryRoot });
  write(
    repositoryRoot,
    'fixtures/registry.json',
    `${JSON.stringify(
      {
        schemaVersion: 1,
        fixtures: [
          {
            fixtureId: FIXTURE_ID,
            manifestPath: `manifests/${FIXTURE_ID}.fixture.generated.json`,
            runnerPath: `fixed-seeds/${FIXTURE_ID}/fixture-runner.mjs`,
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
  write(repositoryRoot, GENERATED_PATH, 'evidence\n');
  write(repositoryRoot, REVIEW_PATH, 'historical review\n');
  execFileSync('git', ['add', '.'], { cwd: repositoryRoot });
  execFileSync('git', ['commit', '--quiet', '-m', 'test: add fixture'], { cwd: repositoryRoot });
  return repositoryRoot;
}

function runChecker(repositoryRoot) {
  return spawnSync(process.execPath, [CHECKER_PATH], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
}

describe('staged fixture safeguards', () => {
  it('rejects deletion of generated evidence without a new review record', () => {
    const repositoryRoot = makeCommittedRepository();
    rmSync(resolve(repositoryRoot, GENERATED_PATH));
    execFileSync('git', ['add', '--update'], { cwd: repositoryRoot });

    const result = runChecker(repositoryRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/requires a newly added numbered review record/u);
  });

  it('rejects modification of an append-only review record', () => {
    const repositoryRoot = makeCommittedRepository();
    write(repositoryRoot, REVIEW_PATH, 'edited historical review\n');
    execFileSync('git', ['add', REVIEW_PATH], { cwd: repositoryRoot });

    const result = runChecker(repositoryRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Review records are append-only/u);
  });

  it('rejects removal of a registered fixture', () => {
    const repositoryRoot = makeCommittedRepository();
    write(repositoryRoot, 'fixtures/registry.json', '{"schemaVersion":1,"fixtures":[]}\n');
    execFileSync('git', ['add', 'fixtures/registry.json'], { cwd: repositoryRoot });

    const result = runChecker(repositoryRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/cannot be retired/u);
  });
});
