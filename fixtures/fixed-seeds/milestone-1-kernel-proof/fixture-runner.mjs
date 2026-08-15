import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { format } from 'prettier';
import ts from 'typescript';

const args = process.argv.slice(2);
const fixtureId = argument('--fixture-id');
const sourceDefinitionPath = argument('--source-definition');
const reviewRecordPath = argument('--review-record');
const fixtureReviewRecordPath = argument('--review-record-path');
const outputRoot = argument('--output-root');
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const definitionBytes = readFileSync(sourceDefinitionPath);
const definition = JSON.parse(definitionBytes.toString('utf8'));
const reviewBytes = readFileSync(reviewRecordPath);
const { core, generation, persistence, support } = await loadProjectModules();

assert.equal(fixtureId, 'milestone-1-kernel-proof');
assert.equal(definition.fixtureDefinitionVersion, 1);
assert.deepEqual(definition.versions, expectedVersions());

const baseline = support.proofDocument();
const repeatedBaseline = support.proofDocument();
const firstReroll = reroll(baseline);
const repeatedReroll = reroll(baseline);
const rerolled = firstReroll.document;
assert.deepEqual(repeatedBaseline, baseline);
assert.deepEqual(repeatedReroll.document, rerolled);
assert.deepEqual(firstReroll.committedAspectIds, [generation.PROOF_MARKER_ASPECT_ID]);
assert.deepEqual(firstReroll.dependencyEffects, []);

const baselineOutline = support.aspect(baseline, generation.PROOF_OUTLINE_ASPECT_ID);
const baselineMarkers = support.aspect(baseline, generation.PROOF_MARKER_ASPECT_ID);
const rerolledOutline = support.aspect(rerolled, generation.PROOF_OUTLINE_ASPECT_ID);
const rerolledMarkers = support.aspect(rerolled, generation.PROOF_MARKER_ASPECT_ID);
assert.deepEqual(rerolledOutline, baselineOutline);
assert.notDeepEqual(rerolledMarkers.acceptedOutput, baselineMarkers.acceptedOutput);
assert.deepEqual(support.markerIds(rerolledMarkers), support.markerIds(baselineMarkers));
assert.deepEqual(support.markerIds(baselineMarkers), expectedMarkerIds());
assert.equal(rerolledMarkers.variantRevision, support.REVISION_ONE);
assert.equal(rerolledOutline.variantRevision, support.REVISION_ZERO);
assert.deepEqual(unselectedMapState(rerolled), unselectedMapState(baseline));

const packageResult = value(persistence.encodeMapworld(rerolled));
const repeatedPackage = value(persistence.encodeMapworld(reorderedDocument(rerolled)));
assert.deepEqual(repeatedPackage, packageResult);
const reopened = value(persistence.decodeMapworld(packageResult));
assert.deepEqual(value(persistence.encodeMapworld(reopened)), packageResult);
assert.deepEqual(
  value(
    persistence.canonicalAspectBytes(support.aspect(reopened, generation.PROOF_OUTLINE_ASPECT_ID)),
  ),
  value(persistence.canonicalAspectBytes(rerolledOutline)),
);
assert.deepEqual(
  value(
    persistence.canonicalAspectBytes(support.aspect(reopened, generation.PROOF_MARKER_ASPECT_ID)),
  ),
  value(persistence.canonicalAspectBytes(rerolledMarkers)),
);
assertGeneratorFreePersistenceSources();

const canonicalArtifacts = [
  aspectArtifact('baseline', 'proof-markers', baselineMarkers),
  outputArtifact('baseline', 'proof-markers', baselineMarkers),
  aspectArtifact('baseline', 'proof-outline', baselineOutline),
  outputArtifact('baseline', 'proof-outline', baselineOutline),
  aspectArtifact('rerolled', 'proof-markers', rerolledMarkers),
  outputArtifact('rerolled', 'proof-markers', rerolledMarkers),
  aspectArtifact('rerolled', 'proof-outline', rerolledOutline),
  outputArtifact('rerolled', 'proof-outline', rerolledOutline),
];
const savedArtifacts = packageResult.files.map(savedProjectArtifact);
const artifacts = [...canonicalArtifacts, ...savedArtifacts].sort(compareByPath);
for (const artifact of artifacts) write(artifact.path, artifact.bytes);

const expectedPath = (checkpoint, name, suffix) =>
  `fixed-seeds/${fixtureId}/expected/${checkpoint}/${name}.${suffix}.canonical`;
const manifest = {
  fixtureManifestVersion: 1,
  fixtureId,
  generated: true,
  editPolicy: 'regenerate-only',
  generatingCommand: `pnpm fixtures:update --fixture ${fixtureId} --review-record ${fixtureReviewRecordPath}`,
  sourceDefinition: {
    path: `fixed-seeds/${fixtureId}/fixture-definition.json`,
    sha256: sha256(definitionBytes),
  },
  worldSeed: definition.worldSeed,
  stableIds: definition.stableIds,
  versions: definition.versions,
  checkpointRevisions: definition.checkpoints,
  expectedAssertions: [
    {
      assertionId: 'marker-aspect-changes',
      operator: 'bytes-not-equal',
      reviewPurpose: 'Prove the selected marker accepted record changes after its reroll.',
      leftArtifactPath: expectedPath('baseline', 'proof-markers', 'aspect'),
      rightArtifactPath: expectedPath('rerolled', 'proof-markers', 'aspect'),
    },
    {
      assertionId: 'marker-output-changes',
      operator: 'bytes-not-equal',
      reviewPurpose: 'Prove marker placements change independently of revision metadata.',
      leftArtifactPath: expectedPath('baseline', 'proof-markers', 'output'),
      rightArtifactPath: expectedPath('rerolled', 'proof-markers', 'output'),
    },
    {
      assertionId: 'outline-remains-isolated',
      operator: 'bytes-equal',
      reviewPurpose: 'Prove the unselected outline accepted record remains byte-identical.',
      leftArtifactPath: expectedPath('baseline', 'proof-outline', 'aspect'),
      rightArtifactPath: expectedPath('rerolled', 'proof-outline', 'aspect'),
    },
    {
      assertionId: 'runner-validates-persistence-round-trip',
      operator: 'runner-pass',
      reviewPurpose:
        'Prove deterministic encoding, authoritative checksums, generator-free decode, and exact reopen.',
    },
  ],
  reviewPurpose:
    'Prove selective reroll isolation plus deterministic, checksummed, generator-free mapworld v1 restoration.',
  reviewRecord: { path: fixtureReviewRecordPath, sha256: sha256(reviewBytes) },
  generatedRoots: [`fixed-seeds/${fixtureId}/expected`, `saved-projects/v1/${fixtureId}`],
  artifacts: artifacts.map((artifact) =>
    Object.fromEntries(Object.entries(artifact).filter(([key]) => key !== 'bytes')),
  ),
};
write(
  `manifests/${fixtureId}.fixture.generated.json`,
  await format(JSON.stringify(manifest), { parser: 'json' }),
);

function reroll(document) {
  const proposal = support.proposeMarkers(document, support.REVISION_ONE);
  assert.equal(proposal.status, 'proposed');
  const command = generation.createCommitAspectProposalCommand(proposal, support.REVISION_ZERO, []);
  const result = core.commitAspectProposal(document, command);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result;
}

function unselectedMapState(document) {
  const map = support.rootMap(document);
  return {
    worldDocumentId: document.worldDocumentId,
    rootMapId: document.rootMapId,
    entities: map.entities,
    constraints: map.constraints,
    locks: map.locks,
    decoration: map.decoration,
    layout: map.layout,
  };
}

function reorderedDocument(document) {
  const map = support.rootMap(document);
  return {
    ...document,
    maps: [
      {
        ...map,
        entities: [...map.entities].reverse(),
        aspects: [...map.aspects].reverse(),
        constraints: [...map.constraints].reverse(),
        locks: [...map.locks].reverse(),
      },
    ],
  };
}

function aspectArtifact(checkpoint, name, aspect) {
  return canonicalArtifact(
    checkpoint,
    name,
    'aspect',
    aspect.aspectId,
    value(persistence.canonicalAspectBytes(aspect)),
  );
}

function outputArtifact(checkpoint, name, aspect) {
  return canonicalArtifact(
    checkpoint,
    name,
    'output',
    aspect.aspectId,
    value(persistence.canonicalAspectOutputBytes(aspect)),
  );
}

function canonicalArtifact(checkpoint, name, boundary, aspectId, bytes) {
  const digest = sha256(bytes);
  const isAspect = boundary === 'aspect';
  return {
    path: `fixed-seeds/${fixtureId}/expected/${checkpoint}/${name}.${boundary}.canonical`,
    kind: isAspect ? 'canonical-aspect-bytes' : 'canonical-aspect-output-bytes',
    checkpoint,
    aspectId,
    byteLength: bytes.byteLength,
    ...(isAspect ? { canonicalAspectSha256: digest } : { canonicalAspectOutputSha256: digest }),
    fixtureIntegritySha256: digest,
    bytes,
  };
}

function savedProjectArtifact(file) {
  const path = `saved-projects/v1/${fixtureId}/rerolled.mapworld/${file.path}`;
  return {
    path,
    kind:
      file.path === 'manifest.json' ? 'saved-project-manifest' : 'saved-project-authoritative-file',
    checkpoint: 'rerolled',
    byteLength: file.bytes.byteLength,
    fixtureIntegritySha256: sha256(file.bytes),
    bytes: file.bytes,
  };
}

function expectedMarkerIds() {
  return Object.entries(definition.stableIds)
    .filter(([name]) => /^marker[0-9]{3}Id$/u.test(name))
    .map(([, id]) => id)
    .sort(compareText);
}

function expectedVersions() {
  return {
    acceptedAspectSchemaVersion: persistence.ACCEPTED_ASPECT_SCHEMA_VERSION,
    deterministicStreamVersion: core.DETERMINISTIC_STREAM_VERSION,
    mapDocumentSchemaVersion: persistence.MAP_DOCUMENT_SCHEMA_VERSION,
    markerGeneratorVersion: 1,
    markerParameterSchemaVersion: 1,
    outlineGeneratorVersion: 1,
    outlineParameterSchemaVersion: 1,
    packageSchemaVersion: persistence.MAPWORLD_SCHEMA_VERSION,
    packageVersion: persistence.MAPWORLD_PACKAGE_VERSION,
    proofInputTransformVersion: core.COORDINATE_TRANSFORM_VERSION,
    seedDerivationVersion: core.SEED_DERIVATION_VERSION,
    worldIndexSchemaVersion: persistence.WORLD_INDEX_SCHEMA_VERSION,
  };
}

function assertGeneratorFreePersistenceSources() {
  const sources = readdirSync(resolve(repositoryRoot, 'packages/persistence/src'))
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => readFileSync(resolve(repositoryRoot, 'packages/persistence/src', name), 'utf8'))
    .join('\n');
  assert.doesNotMatch(sources, /@ttrpg-map\/generation/u);
}

async function loadProjectModules() {
  const runtimeRoot = resolve(outputRoot, '..', 'runtime');
  const coreDirectory = transpilePackage('core', runtimeRoot, {});
  const generationDirectory = transpilePackage('generation', runtimeRoot, {
    '@ttrpg-map/core': '../core/index.js',
  });
  const zodUrl = pathToFileURL(
    realpathSync(resolve(repositoryRoot, 'packages/persistence/node_modules/zod/index.js')),
  ).href;
  const persistenceDirectory = transpilePackage('persistence', runtimeRoot, {
    '@ttrpg-map/core': '../core/index.js',
    zod: zodUrl,
  });
  return {
    core: await import(pathToFileURL(resolve(coreDirectory, 'index.js')).href),
    generation: await import(pathToFileURL(resolve(generationDirectory, 'index.js')).href),
    persistence: await import(pathToFileURL(resolve(persistenceDirectory, 'index.js')).href),
    support: await import(
      pathToFileURL(resolve(generationDirectory, 'selective-reroll-test-support.js')).href
    ),
  };
}

function transpilePackage(packageName, runtimeRoot, replacements) {
  const sourceDirectory = resolve(repositoryRoot, 'packages', packageName, 'src');
  const runtimeDirectory = resolve(runtimeRoot, packageName);
  mkdirSync(runtimeDirectory, { recursive: true });
  const sourceNames = readdirSync(sourceDirectory)
    .filter(
      (name) =>
        name.endsWith('.ts') &&
        !name.endsWith('.d.ts') &&
        !name.endsWith('.test.ts') &&
        !name.endsWith('.type-test.ts'),
    )
    .sort(compareText);
  for (const sourceName of sourceNames) {
    const source = readFileSync(resolve(sourceDirectory, sourceName), 'utf8');
    let output = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
      fileName: sourceName,
    }).outputText;
    for (const [specifier, replacement] of Object.entries(replacements)) {
      output = output
        .replaceAll(`'${specifier}'`, `'${replacement}'`)
        .replaceAll(`"${specifier}"`, `"${replacement}"`);
    }
    writeFileSync(resolve(runtimeDirectory, sourceName.replace(/\.ts$/u, '.js')), output);
  }
  return runtimeDirectory;
}

function argument(name) {
  const index = args.indexOf(name);
  if (index === -1 || args[index + 1] === undefined)
    throw new Error(`Missing fixture runner argument ${name}.`);
  return args[index + 1];
}

function value(result) {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics ?? result.diagnostic));
  return result.value;
}

function write(path, contents) {
  const destination = resolve(outputRoot, path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, contents);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareByPath(left, right) {
  return compareText(left.path, right.path);
}
