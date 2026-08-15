import { posix } from 'node:path';

import { readRequiredFile, sha256, verifyArtifacts, verifyFile } from './fixture-files.mjs';

const FIXTURE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ASSERTION_OPERATORS = new Set(['bytes-equal', 'bytes-not-equal', 'runner-pass']);
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const REVIEW_RECORD_PATTERN =
  /^fixed-seeds\/([a-z0-9]+(?:-[a-z0-9]+)*)\/reviews\/[0-9]{4}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u;
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const ARTIFACT_KINDS = new Set([
  'canonical-aspect-bytes',
  'canonical-aspect-output-bytes',
  'canonical-svg',
  'saved-project-authoritative-file',
  'saved-project-manifest',
  'visual-evidence',
]);
const REVIEW_HEADINGS = [
  'Intended behavior',
  'Changed evidence',
  'Version and compatibility consequence',
  'Evidence reviewed',
];

function fail(message) {
  throw new Error(message);
}

function requireRecord(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object.`);
  }
  return value;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${label} must be a non-empty string.`);
  }
  return value;
}

function requireSha256(value, label) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    fail(`${label} must be a lowercase SHA-256 digest.`);
  }
  return value;
}

function compareCodePoints(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireSortedUnique(values, label) {
  const sorted = [...values].sort(compareCodePoints);
  if (
    new Set(values).size !== values.length ||
    sorted.some((value, index) => value !== values[index])
  ) {
    fail(`${label} must be unique and sorted by code point.`);
  }
}

export function requireFixtureRelativePath(value, label) {
  const fixturePath = requireNonEmptyString(value, label);
  if (
    fixturePath.includes('\\') ||
    fixturePath.startsWith('/') ||
    fixturePath.includes('\0') ||
    fixturePath === '.' ||
    posix.normalize(fixturePath) !== fixturePath ||
    fixturePath.split('/').includes('..')
  ) {
    fail(`${label} must be a normalized POSIX path below fixtures/.`);
  }
  return fixturePath;
}

export function validateRegistry(value) {
  const registry = requireRecord(value, 'Fixture registry');
  if (registry.schemaVersion !== 1) {
    fail('Fixture registry schemaVersion must be 1.');
  }
  if (!Array.isArray(registry.fixtures)) {
    fail('Fixture registry fixtures must be an array.');
  }

  const entries = registry.fixtures.map((candidate, index) => {
    const entry = requireRecord(candidate, `Fixture registry entry ${index}`);
    const fixtureId = requireNonEmptyString(
      entry.fixtureId,
      `Fixture registry entry ${index} fixtureId`,
    );
    if (!FIXTURE_ID_PATTERN.test(fixtureId)) {
      fail(`Fixture ID must be ASCII kebab-case: ${fixtureId}`);
    }
    const manifestPath = requireFixtureRelativePath(
      entry.manifestPath,
      `${fixtureId} manifestPath`,
    );
    const runnerPath = requireFixtureRelativePath(entry.runnerPath, `${fixtureId} runnerPath`);
    if (manifestPath !== `manifests/${fixtureId}.fixture.generated.json`) {
      fail(`${fixtureId} manifestPath must use the conventional generated-manifest location.`);
    }
    if (runnerPath !== `fixed-seeds/${fixtureId}/fixture-runner.mjs`) {
      fail(`${fixtureId} runnerPath must use the conventional runner location.`);
    }
    return { fixtureId, manifestPath, runnerPath };
  });

  requireSortedUnique(
    entries.map(({ fixtureId }) => fixtureId),
    'Fixture registry IDs',
  );
  return entries;
}

export function validateReviewRecord(repositoryRoot, fixtureId, reviewRecordPath) {
  const relativePath = requireFixtureRelativePath(reviewRecordPath, 'Review record path');
  const match = REVIEW_RECORD_PATTERN.exec(relativePath);
  if (match?.[1] !== fixtureId) {
    fail(`Review record must be a numbered Markdown file for ${fixtureId}.`);
  }
  const bytes = readRequiredFile(repositoryRoot, relativePath, 'Review record');
  const contents = bytes.toString('utf8');
  const headings = [...contents.matchAll(/^## ([^\r\n]+)$/gmu)];
  const sections = REVIEW_HEADINGS.map((heading) => {
    const matches = headings.filter((match) => match[1] === heading);
    if (matches.length !== 1) {
      fail(`Review record must contain exactly one "## ${heading}" heading.`);
    }
    const match = matches[0];
    const start = match.index + match[0].length;
    const next = headings.find((candidate) => candidate.index > match.index);
    const body = contents.slice(start, next?.index).trim();
    if (body === '') {
      fail(`Review record section "## ${heading}" must not be empty.`);
    }
    return { body, index: match.index };
  });
  if (sections.some((section, index) => index > 0 && section.index < sections[index - 1].index)) {
    fail('Review record headings must use the documented order.');
  }

  const changedEvidencePaths = sections[1].body
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const path = /^- `([^`]+)`$/u.exec(line)?.[1];
      if (path === undefined) {
        fail('Changed evidence must contain only Markdown bullets with fixture-relative paths.');
      }
      return requireFixtureRelativePath(path, 'Changed evidence path');
    });
  if (changedEvidencePaths.length === 0) {
    fail('Changed evidence must list at least one generated artifact path.');
  }
  requireSortedUnique(changedEvidencePaths, 'Changed evidence paths');
  return { bytes, changedEvidencePaths };
}

function validateNamedRecord(value, label, valueValidator) {
  const record = requireRecord(value, label);
  const entries = Object.entries(record);
  if (entries.length === 0) {
    fail(`${label} must not be empty.`);
  }
  requireSortedUnique(
    entries.map(([key]) => key),
    `${label} keys`,
  );
  for (const [key, entryValue] of entries) {
    requireNonEmptyString(key, `${label} key`);
    valueValidator(entryValue, `${label}.${key}`);
  }
}

function isWithin(path, root) {
  return path === root || path.startsWith(`${root}/`);
}

function validateArtifact(candidate, index, fixtureId) {
  const artifact = requireRecord(candidate, `Artifact ${index}`);
  const artifactPath = requireFixtureRelativePath(artifact.path, `Artifact ${index} path`);
  const kind = requireNonEmptyString(artifact.kind, `Artifact ${index} kind`);
  if (!ARTIFACT_KINDS.has(kind)) {
    fail(`Artifact ${artifactPath} has an unknown evidence kind.`);
  }
  if (!Number.isSafeInteger(artifact.byteLength) || artifact.byteLength < 0) {
    fail(`Artifact ${artifactPath} byteLength must be a non-negative safe integer.`);
  }
  const checkpoint = requireNonEmptyString(
    artifact.checkpoint,
    `Artifact ${artifactPath} checkpoint`,
  );
  if (!FIXTURE_ID_PATTERN.test(checkpoint)) {
    fail(`Artifact ${artifactPath} checkpoint must be ASCII kebab-case.`);
  }
  const expectedRoot = `fixed-seeds/${fixtureId}/expected/${checkpoint}`;
  const savedProjectRoot = `saved-projects/v1/${fixtureId}/${checkpoint}.mapworld`;
  const isOwnedPath =
    (kind === 'canonical-aspect-bytes' &&
      isWithin(artifactPath, expectedRoot) &&
      artifactPath.endsWith('.aspect.canonical')) ||
    (kind === 'canonical-aspect-output-bytes' &&
      isWithin(artifactPath, expectedRoot) &&
      artifactPath.endsWith('.output.canonical')) ||
    (kind === 'canonical-svg' && artifactPath === `canonical-svg/${fixtureId}/${checkpoint}.svg`) ||
    (kind === 'visual-evidence' &&
      artifactPath === `visual-gallery/${fixtureId}/${checkpoint}.png`) ||
    (kind === 'saved-project-manifest' && artifactPath === `${savedProjectRoot}/manifest.json`) ||
    (kind === 'saved-project-authoritative-file' &&
      isWithin(artifactPath, savedProjectRoot) &&
      artifactPath !== `${savedProjectRoot}/manifest.json` &&
      !isWithin(artifactPath, `${savedProjectRoot}/cache`) &&
      !isWithin(artifactPath, `${savedProjectRoot}/previews`));
  if (!isOwnedPath) {
    fail(`Artifact ${artifactPath} does not match its fixture, checkpoint, and evidence kind.`);
  }
  const aspectId = artifact.aspectId;
  if (kind.startsWith('canonical-aspect-')) {
    if (typeof aspectId !== 'string' || !UUID_PATTERN.test(aspectId)) {
      fail(`Artifact ${artifactPath} requires a canonical aspectId.`);
    }
  } else if (aspectId !== undefined) {
    fail(`Artifact ${artifactPath} may only declare aspectId for canonical aspect evidence.`);
  }
  const fixtureIntegritySha256 = requireSha256(
    artifact.fixtureIntegritySha256,
    `Artifact ${artifactPath} fixtureIntegritySha256`,
  );
  const evidenceDigestField =
    kind === 'canonical-aspect-bytes'
      ? 'canonicalAspectSha256'
      : kind === 'canonical-aspect-output-bytes'
        ? 'canonicalAspectOutputSha256'
        : kind === 'canonical-svg'
          ? 'canonicalSvgSha256'
          : undefined;
  const evidenceDigest =
    evidenceDigestField === undefined
      ? undefined
      : requireSha256(
          artifact[evidenceDigestField],
          `Artifact ${artifactPath} ${evidenceDigestField}`,
        );
  for (const field of [
    'canonicalAspectSha256',
    'canonicalAspectOutputSha256',
    'canonicalSvgSha256',
  ]) {
    if (field !== evidenceDigestField && artifact[field] !== undefined) {
      fail(`Artifact ${artifactPath} cannot declare ${field} for evidence kind ${kind}.`);
    }
  }
  if (evidenceDigest !== undefined && evidenceDigest !== fixtureIntegritySha256) {
    fail(`Artifact ${artifactPath} canonical evidence hash must match its exact artifact bytes.`);
  }
  return {
    path: artifactPath,
    kind,
    checkpoint,
    ...(typeof aspectId === 'string' ? { aspectId } : {}),
    byteLength: artifact.byteLength,
    fixtureIntegritySha256,
    ...(evidenceDigestField === undefined ? {} : { [evidenceDigestField]: evidenceDigest }),
  };
}

function validateExpectedAssertions(value, fixtureId, artifacts) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${fixtureId} expectedAssertions must be a non-empty array.`);
  }
  const artifactKinds = new Map(artifacts.map((artifact) => [artifact.path, artifact.kind]));
  const assertions = value.map((candidate, index) => {
    const assertion = requireRecord(candidate, `${fixtureId} expectedAssertions[${index}]`);
    const assertionId = requireNonEmptyString(
      assertion.assertionId,
      `${fixtureId} expectedAssertions[${index}].assertionId`,
    );
    if (!FIXTURE_ID_PATTERN.test(assertionId)) {
      fail(`Expected assertion ID must be ASCII kebab-case: ${assertionId}`);
    }
    const operator = requireNonEmptyString(
      assertion.operator,
      `${fixtureId} expectedAssertions[${index}].operator`,
    );
    if (!ASSERTION_OPERATORS.has(operator)) {
      fail(`Expected assertion ${assertionId} has an unknown operator.`);
    }
    const reviewPurpose = requireNonEmptyString(
      assertion.reviewPurpose,
      `${fixtureId} expectedAssertions[${index}].reviewPurpose`,
    );
    if (operator === 'runner-pass') {
      if (assertion.leftArtifactPath !== undefined || assertion.rightArtifactPath !== undefined) {
        fail(`Runner assertion ${assertionId} cannot name artifact operands.`);
      }
      return { assertionId, operator, reviewPurpose };
    }
    const leftArtifactPath = requireFixtureRelativePath(
      assertion.leftArtifactPath,
      `${assertionId} leftArtifactPath`,
    );
    const rightArtifactPath = requireFixtureRelativePath(
      assertion.rightArtifactPath,
      `${assertionId} rightArtifactPath`,
    );
    if (
      leftArtifactPath === rightArtifactPath ||
      artifactKinds.get(leftArtifactPath) === undefined ||
      artifactKinds.get(leftArtifactPath) !== artifactKinds.get(rightArtifactPath)
    ) {
      fail(`Expected assertion ${assertionId} must compare two different artifacts of one kind.`);
    }
    return { assertionId, operator, reviewPurpose, leftArtifactPath, rightArtifactPath };
  });
  requireSortedUnique(
    assertions.map(({ assertionId }) => assertionId),
    `${fixtureId} expected assertion IDs`,
  );
  return assertions;
}

function evaluateExpectedAssertions(repositoryRoot, assertions) {
  for (const assertion of assertions) {
    if (assertion.operator === 'runner-pass') {
      continue;
    }
    const left = readRequiredFile(repositoryRoot, assertion.leftArtifactPath, 'Assertion artifact');
    const right = readRequiredFile(
      repositoryRoot,
      assertion.rightArtifactPath,
      'Assertion artifact',
    );
    const areEqual = left.equals(right);
    if (
      (assertion.operator === 'bytes-equal' && !areEqual) ||
      (assertion.operator === 'bytes-not-equal' && areEqual)
    ) {
      fail(`Expected assertion failed: ${assertion.assertionId}`);
    }
  }
}

export function validateManifest(
  repositoryRoot,
  entry,
  value,
  { artifactsRepositoryRoot = repositoryRoot } = {},
) {
  const manifest = requireRecord(value, `${entry.fixtureId} manifest`);
  if (manifest.fixtureManifestVersion !== 1 || manifest.fixtureId !== entry.fixtureId) {
    fail(`${entry.fixtureId} manifest must use version 1 and match its registry ID.`);
  }
  if (manifest.generated !== true || manifest.editPolicy !== 'regenerate-only') {
    fail(`${entry.fixtureId} manifest must identify generated, regenerate-only evidence.`);
  }

  const reviewRecord = requireRecord(manifest.reviewRecord, `${entry.fixtureId} reviewRecord`);
  const reviewRecordPath = requireFixtureRelativePath(
    reviewRecord.path,
    `${entry.fixtureId} reviewRecord path`,
  );
  const expectedCommand = `pnpm fixtures:update -- --fixture ${entry.fixtureId} --review-record ${reviewRecordPath}`;
  if (manifest.generatingCommand !== expectedCommand) {
    fail(`${entry.fixtureId} generatingCommand must be the exact targeted update command.`);
  }

  const sourceDefinition = requireRecord(
    manifest.sourceDefinition,
    `${entry.fixtureId} sourceDefinition`,
  );
  const sourcePath = requireFixtureRelativePath(
    sourceDefinition.path,
    `${entry.fixtureId} sourceDefinition path`,
  );
  if (sourcePath !== `fixed-seeds/${entry.fixtureId}/fixture-definition.json`) {
    fail(`${entry.fixtureId} source definition must use the conventional location.`);
  }
  const worldSeed = requireNonEmptyString(manifest.worldSeed, `${entry.fixtureId} worldSeed`);
  if (!/^(?:0|[1-9][0-9]*)$/u.test(worldSeed)) {
    fail(`${entry.fixtureId} worldSeed must be a canonical base-10 unsigned-integer string.`);
  }

  validateNamedRecord(manifest.stableIds, `${entry.fixtureId} stableIds`, requireNonEmptyString);
  validateNamedRecord(manifest.versions, `${entry.fixtureId} versions`, (version, label) => {
    if (
      (typeof version !== 'string' || version === '') &&
      (!Number.isSafeInteger(version) || version < 0)
    ) {
      fail(`${label} must be a non-empty string or non-negative safe integer.`);
    }
  });
  validateNamedRecord(
    manifest.checkpointRevisions,
    `${entry.fixtureId} checkpointRevisions`,
    (revisions, label) => {
      validateNamedRecord(revisions, label, (revision, revisionLabel) => {
        if (!Number.isSafeInteger(revision) || revision < 0) {
          fail(`${revisionLabel} must be a non-negative safe integer.`);
        }
      });
    },
  );

  requireNonEmptyString(manifest.reviewPurpose, `${entry.fixtureId} reviewPurpose`);

  if (!Array.isArray(manifest.generatedRoots) || manifest.generatedRoots.length === 0) {
    fail(`${entry.fixtureId} generatedRoots must be a non-empty array.`);
  }
  const generatedRoots = manifest.generatedRoots.map((root, index) =>
    requireFixtureRelativePath(root, `${entry.fixtureId} generatedRoots[${index}]`),
  );
  requireSortedUnique(generatedRoots, `${entry.fixtureId} generatedRoots`);
  const allowedRootPrefixes = [
    `canonical-svg/${entry.fixtureId}`,
    `fixed-seeds/${entry.fixtureId}/expected`,
    `saved-projects/v1/${entry.fixtureId}`,
    `visual-gallery/${entry.fixtureId}`,
  ];
  for (const root of generatedRoots) {
    if (!allowedRootPrefixes.some((prefix) => isWithin(root, prefix))) {
      fail(`${entry.fixtureId} generated root is outside its owned evidence paths: ${root}`);
    }
  }

  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
    fail(`${entry.fixtureId} artifacts must be a non-empty array.`);
  }
  const artifacts = manifest.artifacts.map((artifact, index) =>
    validateArtifact(artifact, index, entry.fixtureId),
  );
  requireSortedUnique(
    artifacts.map(({ path }) => path),
    `${entry.fixtureId} artifact paths`,
  );
  const caseFoldedPaths = artifacts.map(({ path }) => path.toLowerCase());
  if (new Set(caseFoldedPaths).size !== caseFoldedPaths.length) {
    fail(`${entry.fixtureId} artifact paths must not collide on case-insensitive filesystems.`);
  }

  verifyFile(
    repositoryRoot,
    sourcePath,
    requireSha256(sourceDefinition.sha256, `${entry.fixtureId} source SHA-256`),
  );
  const { bytes: reviewBytes, changedEvidencePaths } = validateReviewRecord(
    repositoryRoot,
    entry.fixtureId,
    reviewRecordPath,
  );
  if (
    sha256(reviewBytes) !== requireSha256(reviewRecord.sha256, `${entry.fixtureId} review SHA-256`)
  ) {
    fail(`${entry.fixtureId} review record SHA-256 does not match its bytes.`);
  }
  const expectedAssertions = validateExpectedAssertions(
    manifest.expectedAssertions,
    entry.fixtureId,
    artifacts,
  );
  verifyArtifacts(artifactsRepositoryRoot, generatedRoots, artifacts);
  evaluateExpectedAssertions(artifactsRepositoryRoot, expectedAssertions);
  return {
    artifacts,
    changedEvidencePaths,
    expectedAssertions,
    generatedRoots,
    manifest,
    reviewRecordPath,
  };
}
