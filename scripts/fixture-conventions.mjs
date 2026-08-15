import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { listFixtureFiles, readFixtureJson } from './fixture-files.mjs';
import {
  compareCandidateWithStored,
  compareGeneratedCandidates,
  getChangedArtifactPaths,
  installCandidate,
  loadStoredFixture,
  withGeneratedCandidate,
} from './fixture-orchestrator.mjs';
import { validateRegistry, validateReviewRecord } from './fixture-schema.mjs';

export const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function compareCodePoints(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function loadFixtureRegistry(repositoryRoot = REPOSITORY_ROOT) {
  return validateRegistry(readFixtureJson(repositoryRoot, 'registry.json', 'Fixture registry'));
}

function getGeneratedFixtureId(path) {
  const patterns = [
    /^manifests\/([a-z0-9]+(?:-[a-z0-9]+)*)\.fixture\.generated\.json$/u,
    /^fixed-seeds\/([a-z0-9]+(?:-[a-z0-9]+)*)\/expected\//u,
    /^saved-projects\/v[0-9]+\/([a-z0-9]+(?:-[a-z0-9]+)*)\//u,
    /^(?:canonical-svg|visual-gallery)\/([a-z0-9]+(?:-[a-z0-9]+)*)\//u,
  ];
  for (const pattern of patterns) {
    const fixtureId = pattern.exec(path)?.[1];
    if (fixtureId !== undefined) {
      return fixtureId;
    }
  }
  if (
    path.startsWith('manifests/') ||
    path.includes('/expected/') ||
    path.startsWith('saved-projects/') ||
    path.startsWith('canonical-svg/') ||
    path.startsWith('visual-gallery/')
  ) {
    throw new Error(`Generated fixture path does not follow the registered layout: ${path}`);
  }
  return undefined;
}

function validateGeneratedInventory(repositoryRoot, entries, storedFixtures, allowMissingId) {
  const registeredIds = new Set(entries.map(({ fixtureId }) => fixtureId));
  const claimedPaths = new Map(
    storedFixtures.map(({ entry, stored }) => [
      entry.fixtureId,
      new Set([entry.manifestPath, ...stored.artifacts.map(({ path }) => path)]),
    ]),
  );
  const discoveredIds = new Set();
  for (const path of listFixtureFiles(repositoryRoot)) {
    const fixtureId = getGeneratedFixtureId(path);
    if (fixtureId !== undefined) {
      discoveredIds.add(fixtureId);
      if (!registeredIds.has(fixtureId)) {
        throw new Error(`Generated evidence is not registered: ${fixtureId}`);
      }
      if (fixtureId !== allowMissingId && claimedPaths.get(fixtureId)?.has(path) !== true) {
        throw new Error(`Generated evidence is not declared by its manifest: ${path}`);
      }
    }
  }
  for (const fixtureId of registeredIds) {
    if (!discoveredIds.has(fixtureId) && fixtureId !== allowMissingId) {
      throw new Error(`Registered fixture has no generated evidence: ${fixtureId}`);
    }
  }

  const roots = storedFixtures.flatMap(({ entry, stored }) =>
    stored.generatedRoots.map((root) => ({ fixtureId: entry.fixtureId, root })),
  );
  for (const [index, left] of roots.entries()) {
    for (const right of roots.slice(index + 1)) {
      if (
        left.fixtureId !== right.fixtureId &&
        (left.root === right.root ||
          left.root.startsWith(`${right.root}/`) ||
          right.root.startsWith(`${left.root}/`))
      ) {
        throw new Error(
          `Generated roots overlap between ${left.fixtureId} and ${right.fixtureId}.`,
        );
      }
    }
  }
}

export function verifyFixtureEntry(repositoryRoot, entry, { runRunner = true } = {}) {
  const stored = loadStoredFixture(repositoryRoot, entry);
  if (runRunner) {
    withGeneratedCandidate(
      repositoryRoot,
      entry,
      stored.reviewRecordPath,
      ({ candidateRepositoryRoot, validatedManifest }) =>
        compareCandidateWithStored(
          repositoryRoot,
          entry,
          stored,
          candidateRepositoryRoot,
          validatedManifest,
        ),
    );
  }
  return stored;
}

export function checkFixtures(repositoryRoot = REPOSITORY_ROOT) {
  const entries = loadFixtureRegistry(repositoryRoot);
  const storedFixtures = entries.map((entry) => ({
    entry,
    stored: verifyFixtureEntry(repositoryRoot, entry, { runRunner: false }),
  }));
  validateGeneratedInventory(repositoryRoot, entries, storedFixtures);
  for (const { entry, stored } of storedFixtures) {
    withGeneratedCandidate(
      repositoryRoot,
      entry,
      stored.reviewRecordPath,
      ({ candidateRepositoryRoot, validatedManifest }) =>
        compareCandidateWithStored(
          repositoryRoot,
          entry,
          stored,
          candidateRepositoryRoot,
          validatedManifest,
        ),
    );
  }
  return entries.length;
}

export function parseUpdateArguments(args) {
  if (args.includes('--all') || args.includes('-u')) {
    throw new Error('Broad fixture updates are forbidden; select exactly one fixture.');
  }
  if (args.length !== 4) {
    throw new Error(
      'Usage: pnpm fixtures:update -- --fixture <fixture-id> --review-record <fixture-relative-path>',
    );
  }
  const values = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      (flag !== '--fixture' && flag !== '--review-record') ||
      values.has(flag) ||
      value === undefined ||
      value === ''
    ) {
      throw new Error('Fixture updates require one --fixture and one --review-record value.');
    }
    values.set(flag, value);
  }
  const fixtureId = values.get('--fixture');
  const reviewRecordPath = values.get('--review-record');
  if (fixtureId === undefined || reviewRecordPath === undefined) {
    throw new Error('Fixture updates require one --fixture and one --review-record value.');
  }
  return { fixtureId, reviewRecordPath };
}

function requireNewReviewRecord(repositoryRoot, reviewRecordPath) {
  try {
    execFileSync('git', ['cat-file', '-e', `HEAD:fixtures/${reviewRecordPath}`], {
      cwd: repositoryRoot,
      stdio: 'ignore',
    });
  } catch {
    return;
  }
  throw new Error('Fixture review records are append-only; add a new numbered review record.');
}

function requireExactChangedEvidence(actual, expected) {
  const sortedActual = [...actual].sort(compareCodePoints);
  const sortedExpected = [...expected].sort(compareCodePoints);
  if (
    sortedActual.length !== sortedExpected.length ||
    sortedActual.some((path, index) => path !== sortedExpected[index])
  ) {
    throw new Error('Generated changes do not match the review record Changed evidence list.');
  }
}

export function updateFixture(args, repositoryRoot = REPOSITORY_ROOT) {
  const { fixtureId, reviewRecordPath } = parseUpdateArguments(args);
  const entries = loadFixtureRegistry(repositoryRoot);
  const entry = entries.find((candidate) => candidate.fixtureId === fixtureId);
  if (entry === undefined) {
    throw new Error(`Unknown fixture ID: ${fixtureId}`);
  }
  const review = validateReviewRecord(repositoryRoot, fixtureId, reviewRecordPath);
  requireNewReviewRecord(repositoryRoot, reviewRecordPath);
  const stored = loadStoredFixture(repositoryRoot, entry, { allowMissing: true });
  const otherStoredFixtures = entries
    .filter((candidate) => candidate.fixtureId !== fixtureId)
    .map((candidate) => ({
      entry: candidate,
      stored: loadStoredFixture(repositoryRoot, candidate),
    }));
  validateGeneratedInventory(repositoryRoot, entries, otherStoredFixtures, fixtureId);

  withGeneratedCandidate(
    repositoryRoot,
    entry,
    reviewRecordPath,
    ({ candidateRepositoryRoot, validatedManifest }) => {
      withGeneratedCandidate(
        repositoryRoot,
        entry,
        reviewRecordPath,
        ({
          candidateRepositoryRoot: repeatedRepositoryRoot,
          validatedManifest: repeatedManifest,
        }) =>
          compareGeneratedCandidates(
            entry,
            candidateRepositoryRoot,
            validatedManifest,
            repeatedRepositoryRoot,
            repeatedManifest,
          ),
      );
      const changedPaths = getChangedArtifactPaths(
        repositoryRoot,
        stored,
        candidateRepositoryRoot,
        validatedManifest,
      );
      requireExactChangedEvidence(changedPaths, review.changedEvidencePaths);
      installCandidate(
        repositoryRoot,
        entry,
        stored,
        candidateRepositoryRoot,
        validatedManifest,
        () => {
          const installed = loadStoredFixture(repositoryRoot, entry);
          compareCandidateWithStored(
            repositoryRoot,
            entry,
            installed,
            candidateRepositoryRoot,
            validatedManifest,
          );
          validateGeneratedInventory(repositoryRoot, entries, [
            ...otherStoredFixtures,
            { entry, stored: installed },
          ]);
        },
      );
    },
  );
}

export function runFixtureCommand(args, repositoryRoot = REPOSITORY_ROOT) {
  const [command, ...commandArgs] = args;
  if (command === 'check' && commandArgs.length === 0) {
    return checkFixtures(repositoryRoot);
  }
  if (command === 'update') {
    updateFixture(commandArgs, repositoryRoot);
    return undefined;
  }
  throw new Error(
    'Usage: fixture-conventions.mjs check | update --fixture <fixture-id> --review-record <path>',
  );
}

const invokedPath = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const checkedCount = runFixtureCommand(process.argv.slice(2));
    if (typeof checkedCount === 'number') {
      console.log(`Verified ${checkedCount} registered deterministic fixture set(s).`);
    }
  } catch (error) {
    console.error(
      `Fixture convention error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
