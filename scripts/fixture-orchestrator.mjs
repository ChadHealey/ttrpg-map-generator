import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';

import {
  listFixtureFiles,
  readFixtureJson,
  readRequiredFile,
  requireNonSymlinkComponents,
  resolveFixturePath,
} from './fixture-files.mjs';
import { validateManifest } from './fixture-schema.mjs';

function compareCodePoints(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function firstJsonDifference(left, right, path = '$') {
  if (Object.is(left, right)) return undefined;
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return `${path}.length: checked-in=${left.length}, regenerated=${right.length}`;
    }
    for (let index = 0; index < left.length; index += 1) {
      const difference = firstJsonDifference(left[index], right[index], `${path}[${index}]`);
      if (difference !== undefined) return difference;
    }
    return undefined;
  } else if (
    typeof left === 'object' &&
    left !== null &&
    typeof right === 'object' &&
    right !== null
  ) {
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort(
      compareCodePoints,
    );
    for (const key of keys) {
      const difference = firstJsonDifference(left[key], right[key], `${path}.${key}`);
      if (difference !== undefined) return difference;
    }
    return undefined;
  }
  return `${path}: checked-in=${JSON.stringify(left)}, regenerated=${JSON.stringify(right)}`;
}

function jsonByteDifference(checkedIn, regenerated) {
  try {
    return firstJsonDifference(JSON.parse(checkedIn), JSON.parse(regenerated));
  } catch {
    return undefined;
  }
}

function getReadPermissionArguments(paths) {
  const allowed = new Set();
  for (const path of paths) {
    for (const resolvedPath of [resolve(path), realpathSync(path)]) {
      let currentPath = resolvedPath;
      while (currentPath !== dirname(currentPath)) {
        allowed.add(currentPath);
        currentPath = dirname(currentPath);
      }
    }
  }
  return [...allowed].sort(compareCodePoints).map((path) => `--allow-fs-read=${path}`);
}

function fixtureFileExists(repositoryRoot, fixtureRelativePath) {
  requireNonSymlinkComponents(repositoryRoot, fixtureRelativePath);
  const status = lstatSync(resolveFixturePath(repositoryRoot, fixtureRelativePath), {
    throwIfNoEntry: false,
  });
  if (status === undefined) {
    return false;
  }
  if (!status.isFile() || status.isSymbolicLink()) {
    throw new Error(`Fixture path must be a regular file: ${fixtureRelativePath}`);
  }
  return true;
}

export function loadStoredFixture(
  repositoryRoot,
  entry,
  { allowMissing = false, allowChangedSourceDefinition = false } = {},
) {
  if (allowMissing && !fixtureFileExists(repositoryRoot, entry.manifestPath)) {
    return undefined;
  }
  const value = readFixtureJson(repositoryRoot, entry.manifestPath, `${entry.fixtureId} manifest`);
  return validateManifest(repositoryRoot, entry, value, {
    verifySourceDefinition: !allowChangedSourceDefinition,
  });
}

function assertCandidateFileList(candidateRepositoryRoot, entry, validatedManifest) {
  const actual = listFixtureFiles(candidateRepositoryRoot);
  const expected = [
    entry.manifestPath,
    ...validatedManifest.artifacts.map(({ path }) => path),
  ].sort(compareCodePoints);
  if (actual.length !== expected.length || actual.some((path, index) => path !== expected[index])) {
    throw new Error(`${entry.fixtureId} runner wrote an unexpected candidate file.`);
  }
}

export function withGeneratedCandidate(repositoryRoot, entry, reviewRecordPath, callback) {
  readRequiredFile(repositoryRoot, entry.runnerPath, `${entry.fixtureId} runner`);
  const sourceDefinitionPath = `fixed-seeds/${entry.fixtureId}/fixture-definition.json`;
  const sourceDefinitionBytes = readRequiredFile(
    repositoryRoot,
    sourceDefinitionPath,
    `${entry.fixtureId} source definition`,
  );
  const reviewRecordBytes = readRequiredFile(
    repositoryRoot,
    reviewRecordPath,
    `${entry.fixtureId} review record`,
  );

  const candidateRepositoryRoot = mkdtempSync(resolve(tmpdir(), 'ttrpg-fixture-candidate-'));
  const outputRoot = resolve(candidateRepositoryRoot, 'fixtures');
  const inputRoot = resolve(candidateRepositoryRoot, 'inputs');
  mkdirSync(outputRoot);
  mkdirSync(inputRoot);
  const sourceDefinition = resolve(inputRoot, 'fixture-definition');
  const reviewRecord = resolve(inputRoot, 'review-record');
  writeFileSync(sourceDefinition, sourceDefinitionBytes);
  writeFileSync(reviewRecord, reviewRecordBytes);
  chmodSync(sourceDefinition, 0o444);
  chmodSync(reviewRecord, 0o444);
  try {
    execFileSync(
      process.execPath,
      [
        '--permission',
        ...getReadPermissionArguments([repositoryRoot, candidateRepositoryRoot]),
        `--allow-fs-write=${candidateRepositoryRoot}`,
        resolveFixturePath(repositoryRoot, entry.runnerPath),
        '--fixture-id',
        entry.fixtureId,
        '--source-definition',
        sourceDefinition,
        '--review-record',
        reviewRecord,
        '--review-record-path',
        reviewRecordPath,
        '--output-root',
        outputRoot,
      ],
      { cwd: candidateRepositoryRoot, stdio: 'inherit' },
    );
    const value = readFixtureJson(
      candidateRepositoryRoot,
      entry.manifestPath,
      `${entry.fixtureId} candidate manifest`,
    );
    const validatedManifest = validateManifest(repositoryRoot, entry, value, {
      artifactsRepositoryRoot: candidateRepositoryRoot,
    });
    assertCandidateFileList(candidateRepositoryRoot, entry, validatedManifest);
    return callback({ candidateRepositoryRoot, validatedManifest });
  } finally {
    rmSync(candidateRepositoryRoot, { force: true, recursive: true });
  }
}

export function compareCandidateWithStored(
  repositoryRoot,
  entry,
  stored,
  candidateRepositoryRoot,
  candidate,
) {
  const paths = [...candidate.artifacts.map(({ path }) => path), entry.manifestPath];
  if (stored.artifacts.length !== candidate.artifacts.length) {
    throw new Error(
      `${entry.fixtureId} regenerated artifact list differs from checked-in evidence.`,
    );
  }
  for (const path of paths) {
    const checkedIn = readRequiredFile(repositoryRoot, path, 'Checked-in fixture evidence');
    const regenerated = readRequiredFile(
      candidateRepositoryRoot,
      path,
      'Regenerated fixture evidence',
    );
    if (!checkedIn.equals(regenerated)) {
      if (path === entry.manifestPath) {
        const difference = firstJsonDifference(stored, candidate);
        throw new Error(
          `Regenerated fixture evidence differs: ${path}${difference === undefined ? '' : ` (${difference})`}`,
        );
      }
      const difference = jsonByteDifference(checkedIn, regenerated);
      throw new Error(
        `Regenerated fixture evidence differs: ${path}${difference === undefined ? '' : ` (${difference})`}`,
      );
    }
  }
}

export function compareGeneratedCandidates(
  entry,
  leftRepositoryRoot,
  left,
  rightRepositoryRoot,
  right,
) {
  if (left.artifacts.length !== right.artifacts.length) {
    throw new Error(`${entry.fixtureId} produced different artifact lists in repeated runs.`);
  }
  const paths = [entry.manifestPath, ...left.artifacts.map(({ path }) => path)];
  for (const path of paths) {
    const leftBytes = readRequiredFile(leftRepositoryRoot, path, 'First fixture candidate');
    const rightBytes = readRequiredFile(rightRepositoryRoot, path, 'Repeated fixture candidate');
    if (!leftBytes.equals(rightBytes)) {
      throw new Error(`Fixture runner is not repeatable for the update inputs: ${path}`);
    }
  }
}

export function getChangedArtifactPaths(
  repositoryRoot,
  stored,
  candidateRepositoryRoot,
  candidate,
) {
  const storedPaths = new Set(stored?.artifacts.map(({ path }) => path) ?? []);
  const candidatePaths = new Set(candidate.artifacts.map(({ path }) => path));
  const allPaths = [...new Set([...storedPaths, ...candidatePaths])].sort(compareCodePoints);
  return allPaths.filter((path) => {
    if (!storedPaths.has(path) || !candidatePaths.has(path)) {
      return true;
    }
    return !readRequiredFile(repositoryRoot, path, 'Checked-in fixture evidence').equals(
      readRequiredFile(candidateRepositoryRoot, path, 'Candidate fixture evidence'),
    );
  });
}

function atomicWriteFixtureFile(repositoryRoot, fixtureRelativePath, bytes) {
  const destination = resolveFixturePath(repositoryRoot, fixtureRelativePath);
  const relativeParent = dirname(fixtureRelativePath);
  requireNonSymlinkComponents(repositoryRoot, relativeParent);
  mkdirSync(dirname(destination), { recursive: true });
  requireNonSymlinkComponents(repositoryRoot, fixtureRelativePath);
  const temporary = `${destination}.fixture-update.tmp`;
  if (lstatSync(temporary, { throwIfNoEntry: false }) !== undefined) {
    throw new Error(`Fixture update temporary path already exists: ${fixtureRelativePath}`);
  }
  try {
    writeFileSync(temporary, bytes);
    renameSync(temporary, destination);
  } catch (error) {
    if (lstatSync(temporary, { throwIfNoEntry: false })?.isFile() === true) {
      unlinkSync(temporary);
    }
    throw error;
  }
}

export function installCandidate(
  repositoryRoot,
  entry,
  stored,
  candidateRepositoryRoot,
  candidate,
  verifyInstalled,
) {
  const candidatePaths = candidate.artifacts.map(({ path }) => path);
  const storedPaths = new Set(stored?.artifacts.map(({ path }) => path) ?? []);
  for (const path of candidatePaths) {
    if (!storedPaths.has(path) && fixtureFileExists(repositoryRoot, path)) {
      throw new Error(`Fixture update refuses to overwrite an unowned existing file: ${path}`);
    }
  }
  const removedPaths = (stored?.artifacts ?? [])
    .map(({ path }) => path)
    .filter((path) => !candidatePaths.includes(path));
  const installPaths = [...candidatePaths, entry.manifestPath];
  const touchedPaths = [...new Set([...installPaths, ...removedPaths])];
  const backups = new Map();
  for (const path of touchedPaths) {
    backups.set(
      path,
      fixtureFileExists(repositoryRoot, path)
        ? readFileSync(resolveFixturePath(repositoryRoot, path))
        : undefined,
    );
  }

  try {
    for (const path of candidatePaths) {
      atomicWriteFixtureFile(
        repositoryRoot,
        path,
        readRequiredFile(candidateRepositoryRoot, path, 'Candidate fixture evidence'),
      );
    }
    for (const path of removedPaths) {
      unlinkSync(resolveFixturePath(repositoryRoot, path));
    }
    atomicWriteFixtureFile(
      repositoryRoot,
      entry.manifestPath,
      readRequiredFile(candidateRepositoryRoot, entry.manifestPath, 'Candidate fixture manifest'),
    );
    verifyInstalled();
  } catch (error) {
    for (const [path, backup] of backups) {
      const destination = resolveFixturePath(repositoryRoot, path);
      if (backup === undefined) {
        if (lstatSync(destination, { throwIfNoEntry: false })?.isFile() === true) {
          unlinkSync(destination);
        }
      } else {
        atomicWriteFixtureFile(repositoryRoot, path, backup);
      }
    }
    throw new Error(`Failed to install fixture ${entry.fixtureId}; restored previous files.`, {
      cause: error,
    });
  }
}
