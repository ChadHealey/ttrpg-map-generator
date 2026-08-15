import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';

const stagedOutput = execFileSync(
  'git',
  ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'],
  { encoding: 'utf8' },
);

const stagedFiles = stagedOutput.split('\0').filter(Boolean);
const addedOutput = execFileSync(
  'git',
  ['diff', '--cached', '--name-only', '--diff-filter=A', '-z'],
  { encoding: 'utf8' },
);
const addedFiles = addedOutput.split('\0').filter(Boolean);
const fixtureChangeOutput = execFileSync(
  'git',
  ['diff', '--cached', '--name-only', '--diff-filter=ACMRD', '-z'],
  { encoding: 'utf8' },
);
const fixtureChangedFiles = fixtureChangeOutput.split('\0').filter(Boolean);
const forbiddenDirectories = /(^|\/)(node_modules|dist|target|coverage)(\/|$)/u;
const forbiddenExtensions = /\.(log|pem|key|tmp)$/iu;
const forbiddenNames = new Set(['.DS_Store', 'id_dsa', 'id_ecdsa', 'id_ed25519', 'id_rsa']);

const violations = stagedFiles.filter((file) => {
  const fileName = basename(file);
  const isEnvironmentFile = fileName.startsWith('.env') && fileName !== '.env.example';
  const isUserProject = file.endsWith('.mapworld') && !file.startsWith('fixtures/');

  return (
    forbiddenDirectories.test(file) ||
    forbiddenExtensions.test(file) ||
    forbiddenNames.has(fileName) ||
    isEnvironmentFile ||
    isUserProject
  );
});

function getGeneratedFixtureId(file) {
  const patterns = [
    /^fixtures\/manifests\/([a-z0-9]+(?:-[a-z0-9]+)*)\.fixture\.generated\.json$/u,
    /^fixtures\/fixed-seeds\/([a-z0-9]+(?:-[a-z0-9]+)*)\/expected\//u,
    /^fixtures\/saved-projects\/v[0-9]+\/([a-z0-9]+(?:-[a-z0-9]+)*)\//u,
    /^fixtures\/(?:canonical-svg|visual-gallery)\/([a-z0-9]+(?:-[a-z0-9]+)*)\//u,
  ];
  for (const pattern of patterns) {
    const fixtureId = pattern.exec(file)?.[1];
    if (fixtureId !== undefined) {
      return fixtureId;
    }
  }
  return undefined;
}

const changedFixtureIds = [
  ...new Set(
    fixtureChangedFiles.map(getGeneratedFixtureId).filter((fixtureId) => fixtureId !== undefined),
  ),
];
const addedReviewIds = new Set(
  addedFiles
    .map(
      (file) =>
        /^fixtures\/fixed-seeds\/([a-z0-9]+(?:-[a-z0-9]+)*)\/reviews\/[0-9]{4}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u.exec(
          file,
        )?.[1],
    )
    .filter((fixtureId) => fixtureId !== undefined),
);
const fixturePolicyViolations = [];

function readRegistryRevision(revision) {
  try {
    const contents = execFileSync('git', ['show', revision], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const value = JSON.parse(contents);
    return new Map(
      Array.isArray(value.fixtures)
        ? value.fixtures.map((entry) => [entry.fixtureId, JSON.stringify(entry)])
        : [],
    );
  } catch {
    return new Map();
  }
}

if (fixtureChangedFiles.includes('fixtures/registry.json')) {
  const previousRegistry = readRegistryRevision('HEAD:fixtures/registry.json');
  const stagedRegistry = readRegistryRevision(':fixtures/registry.json');
  for (const fixtureId of previousRegistry.keys()) {
    if (!stagedRegistry.has(fixtureId)) {
      fixturePolicyViolations.push(
        `Registered fixture ${fixtureId} cannot be retired without a dedicated reviewed workflow.`,
      );
    }
  }
  for (const [fixtureId, entry] of stagedRegistry) {
    if (previousRegistry.get(fixtureId) !== entry) {
      changedFixtureIds.push(fixtureId);
    }
  }
}

for (const file of fixtureChangedFiles) {
  const reviewFixtureId =
    /^fixtures\/fixed-seeds\/([a-z0-9]+(?:-[a-z0-9]+)*)\/reviews\/[0-9]{4}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u.exec(
      file,
    )?.[1];
  if (reviewFixtureId !== undefined && !addedFiles.includes(file)) {
    fixturePolicyViolations.push(`Review records are append-only and cannot be changed: ${file}`);
  }
}

const uniqueChangedFixtureIds = [...new Set(changedFixtureIds)];

if (uniqueChangedFixtureIds.length > 1) {
  fixturePolicyViolations.push(
    `Generated evidence changed for multiple fixtures: ${uniqueChangedFixtureIds.join(', ')}`,
  );
}
for (const fixtureId of uniqueChangedFixtureIds) {
  if (!addedReviewIds.has(fixtureId)) {
    fixturePolicyViolations.push(
      `Generated evidence for ${fixtureId} requires a newly added numbered review record.`,
    );
  }
}

if (violations.length > 0) {
  console.error('Refusing to commit forbidden or machine-local files:');
  for (const file of violations) {
    console.error(`- ${file}`);
  }
  process.exitCode = 1;
}

if (fixturePolicyViolations.length > 0) {
  console.error('Refusing an unsafe generated-fixture update:');
  for (const violation of fixturePolicyViolations) {
    console.error(`- ${violation}`);
  }
  process.exitCode = 1;
}
