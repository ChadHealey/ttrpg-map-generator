import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';

function compareCodePoints(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function resolveFixturePath(repositoryRoot, fixtureRelativePath) {
  const fixturesRoot = resolve(repositoryRoot, 'fixtures');
  const resolvedPath = resolve(fixturesRoot, ...fixtureRelativePath.split('/'));
  if (!resolvedPath.startsWith(`${fixturesRoot}${sep}`)) {
    throw new Error(`Fixture path escapes fixtures/: ${fixtureRelativePath}`);
  }
  return resolvedPath;
}

export function requireNonSymlinkComponents(repositoryRoot, fixtureRelativePath) {
  let currentPath = resolve(repositoryRoot, 'fixtures');
  const rootStatus = lstatSync(currentPath, { throwIfNoEntry: false });
  if (rootStatus === undefined || !rootStatus.isDirectory() || rootStatus.isSymbolicLink()) {
    throw new Error('fixtures/ must be a regular, non-symlink directory.');
  }
  for (const component of fixtureRelativePath.split('/')) {
    currentPath = resolve(currentPath, component);
    const status = lstatSync(currentPath, { throwIfNoEntry: false });
    if (status?.isSymbolicLink() === true) {
      throw new Error(`Fixture path components cannot be symlinks: ${fixtureRelativePath}`);
    }
    if (status === undefined) {
      return;
    }
  }
}

export function readFixtureJson(repositoryRoot, fixtureRelativePath, label) {
  const bytes = readRequiredFile(repositoryRoot, fixtureRelativePath, label);
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} is not valid JSON: ${detail}`, { cause: error });
  }
}

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function readRequiredFile(repositoryRoot, fixtureRelativePath, label) {
  requireNonSymlinkComponents(repositoryRoot, fixtureRelativePath);
  const filePath = resolveFixturePath(repositoryRoot, fixtureRelativePath);
  const status = lstatSync(filePath, { throwIfNoEntry: false });
  if (status === undefined || !status.isFile() || status.isSymbolicLink()) {
    throw new Error(`${label} must be a regular, non-symlink file: ${fixtureRelativePath}`);
  }
  return readFileSync(filePath);
}

export function verifyFile(repositoryRoot, fixtureRelativePath, expectedSha256) {
  const bytes = readRequiredFile(repositoryRoot, fixtureRelativePath, 'Fixture source');
  if (sha256(bytes) !== expectedSha256) {
    throw new Error(`SHA-256 does not match checked-in bytes: ${fixtureRelativePath}`);
  }
}

function listFiles(repositoryRoot, fixtureRelativeRoot) {
  requireNonSymlinkComponents(repositoryRoot, fixtureRelativeRoot);
  const absoluteRoot = resolveFixturePath(repositoryRoot, fixtureRelativeRoot);
  const rootStatus = lstatSync(absoluteRoot, { throwIfNoEntry: false });
  if (rootStatus === undefined || !rootStatus.isDirectory() || rootStatus.isSymbolicLink()) {
    throw new Error(`Generated root must be a regular directory: ${fixtureRelativeRoot}`);
  }
  const files = [];
  const visit = (absoluteDirectory, relativeDirectory) => {
    const names = readdirSync(absoluteDirectory).sort(compareCodePoints);
    for (const name of names) {
      const absolutePath = resolve(absoluteDirectory, name);
      const relativePath = `${relativeDirectory}/${name}`;
      const status = lstatSync(absolutePath);
      if (status.isSymbolicLink()) {
        throw new Error(`Generated fixture paths cannot be symlinks: ${relativePath}`);
      }
      if (status.isDirectory()) {
        visit(absolutePath, relativePath);
      } else if (status.isFile()) {
        files.push(relativePath);
      } else {
        throw new Error(
          `Generated fixture paths must be regular files or directories: ${relativePath}`,
        );
      }
    }
  };
  visit(absoluteRoot, fixtureRelativeRoot);
  return files;
}

export function listFixtureFiles(repositoryRoot) {
  const fixturesRoot = resolve(repositoryRoot, 'fixtures');
  const rootStatus = lstatSync(fixturesRoot, { throwIfNoEntry: false });
  if (rootStatus === undefined || !rootStatus.isDirectory() || rootStatus.isSymbolicLink()) {
    throw new Error('fixtures/ must be a regular, non-symlink directory.');
  }
  const files = [];
  const visit = (absoluteDirectory, relativeDirectory) => {
    const names = readdirSync(absoluteDirectory).sort(compareCodePoints);
    for (const name of names) {
      const absolutePath = resolve(absoluteDirectory, name);
      const relativePath = relativeDirectory === '' ? name : `${relativeDirectory}/${name}`;
      const status = lstatSync(absolutePath);
      if (status.isSymbolicLink()) {
        throw new Error(`Fixture paths cannot be symlinks: ${relativePath}`);
      }
      if (status.isDirectory()) {
        visit(absolutePath, relativePath);
      } else if (status.isFile()) {
        files.push(relativePath);
      } else {
        throw new Error(`Fixture paths must be regular files or directories: ${relativePath}`);
      }
    }
  };
  visit(fixturesRoot, '');
  return files;
}

export function verifyArtifacts(repositoryRoot, generatedRoots, artifacts) {
  const discoveredPaths = generatedRoots.flatMap((root) => listFiles(repositoryRoot, root));
  const expectedPaths = artifacts.map(({ path }) => path);
  if (
    new Set(discoveredPaths).size !== discoveredPaths.length ||
    discoveredPaths.length !== expectedPaths.length ||
    discoveredPaths.some((path, index) => path !== expectedPaths[index])
  ) {
    throw new Error('Generated roots contain a missing, extra, or unlisted artifact.');
  }

  for (const artifact of artifacts) {
    const bytes = readRequiredFile(repositoryRoot, artifact.path, 'Generated artifact');
    if (
      bytes.byteLength !== artifact.byteLength ||
      sha256(bytes) !== artifact.fixtureIntegritySha256
    ) {
      throw new Error(
        `Fixture-integrity evidence does not match checked-in bytes: ${artifact.path}`,
      );
    }
  }
}
