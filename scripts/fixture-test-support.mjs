import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';

export function digest(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

export function write(repositoryRoot, repositoryRelativePath, contents) {
  const path = resolve(repositoryRoot, repositoryRelativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

export function createFixtureRunner(
  paths,
  divergentArtifactPath,
  attemptedRepositoryWrite = false,
) {
  return `import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const outputRoot = args[args.indexOf('--output-root') + 1];
const fixturesRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
for (const path of ${JSON.stringify(paths)}) {
  const destination = resolve(outputRoot, path);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(resolve(fixturesRoot, path), destination);
}
${divergentArtifactPath === undefined ? '' : `writeFileSync(resolve(outputRoot, ${JSON.stringify(divergentArtifactPath)}), '{"accepted":fals}\\n');`}
${attemptedRepositoryWrite ? `try {\n  writeFileSync(resolve(fixturesRoot, 'forbidden-runner-write'), 'unsafe');\n  process.exitCode = 1;\n} catch (error) {\n  if (error?.code !== 'ERR_ACCESS_DENIED') throw error;\n}` : ''}
`;
}

export function createConstantFixtureRunner(files) {
  return `import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const outputRoot = args[args.indexOf('--output-root') + 1];
for (const [path, contents] of Object.entries(${JSON.stringify(files)})) {
  const destination = resolve(outputRoot, path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, contents);
}
`;
}

export function makeFixtureRepository() {
  const repositoryRoot = mkdtempSync(resolve(tmpdir(), 'ttrpg-fixtures-'));
  const fixtureId = 'deterministic-proof';
  const entry = {
    fixtureId,
    manifestPath: `manifests/${fixtureId}.fixture.generated.json`,
    runnerPath: `fixed-seeds/${fixtureId}/fixture-runner.mjs`,
  };
  const definition = '{"worldSeed":"17"}\n';
  const reviewRecordPath = `fixed-seeds/${fixtureId}/reviews/0001-initial-acceptance.md`;
  const baselinePath = `fixed-seeds/${fixtureId}/expected/baseline/proof-outline.aspect.canonical`;
  const rerolledPath = `fixed-seeds/${fixtureId}/expected/rerolled/proof-outline.aspect.canonical`;
  const artifact = '{"accepted":true}\n';
  const review = `# Fixture review: deterministic proof

## Intended behavior

Accept the first deterministic proof output.

## Changed evidence

- \`${baselinePath}\`
- \`${rerolledPath}\`

## Version and compatibility consequence

Initial fixture version 1; no previous fixture is migrated.

## Evidence reviewed

Semantic evidence reviewed; SVG and visual evidence are not applicable.
`;
  const artifacts = [baselinePath, rerolledPath].map((path) => ({
    path,
    kind: 'canonical-aspect-bytes',
    checkpoint: path === baselinePath ? 'baseline' : 'rerolled',
    aspectId: '54b92092-3d5f-4bca-a12c-353185de1557',
    byteLength: Buffer.byteLength(artifact),
    canonicalAspectSha256: digest(artifact),
    fixtureIntegritySha256: digest(artifact),
  }));
  const manifest = {
    fixtureManifestVersion: 1,
    fixtureId,
    generated: true,
    editPolicy: 'regenerate-only',
    generatingCommand: `pnpm fixtures:update --fixture ${fixtureId} --review-record ${reviewRecordPath}`,
    sourceDefinition: {
      path: `fixed-seeds/${fixtureId}/fixture-definition.json`,
      sha256: digest(definition),
    },
    worldSeed: '17',
    stableIds: {
      aspectId: '54b92092-3d5f-4bca-a12c-353185de1557',
      worldDocumentId: '29646d87-2997-44f8-8b6d-7153f93e6e99',
    },
    versions: {
      generatorVersion: 1,
      seedDerivationVersion: 1,
    },
    checkpointRevisions: {
      baseline: { 'proof.outline': 0 },
      rerolled: { 'proof.outline': 0 },
    },
    expectedAssertions: [
      {
        assertionId: 'baseline-outline-repeats-after-reroll',
        operator: 'bytes-equal',
        reviewPurpose: 'Prove the unselected outline remains byte-identical.',
        leftArtifactPath: baselinePath,
        rightArtifactPath: rerolledPath,
      },
      {
        assertionId: 'runner-reproduces-fixture',
        operator: 'runner-pass',
        reviewPurpose: 'Prove the fixture runner completes its runtime assertions.',
      },
    ],
    reviewPurpose: 'Prove deterministic canonical aspect evidence.',
    reviewRecord: { path: reviewRecordPath, sha256: digest(review) },
    generatedRoots: [
      `fixed-seeds/${fixtureId}/expected/baseline`,
      `fixed-seeds/${fixtureId}/expected/rerolled`,
    ],
    artifacts,
  };

  write(repositoryRoot, `fixtures/fixed-seeds/${fixtureId}/fixture-definition.json`, definition);
  write(repositoryRoot, `fixtures/${reviewRecordPath}`, review);
  write(repositoryRoot, `fixtures/${baselinePath}`, artifact);
  write(repositoryRoot, `fixtures/${rerolledPath}`, artifact);
  write(repositoryRoot, `fixtures/${entry.manifestPath}`, `${JSON.stringify(manifest, null, 2)}\n`);
  write(
    repositoryRoot,
    `fixtures/${entry.runnerPath}`,
    createFixtureRunner([entry.manifestPath, baselinePath, rerolledPath]),
  );
  write(
    repositoryRoot,
    'fixtures/registry.json',
    `${JSON.stringify({ schemaVersion: 1, fixtures: [entry] }, null, 2)}\n`,
  );
  return { baselinePath, entry, manifest, repositoryRoot, rerolledPath };
}
