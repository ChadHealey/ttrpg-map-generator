import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const core = await loadCore();

assert.equal(fixtureId, 'seed-derivation-v1');
assert.equal(definition.fixtureDefinitionVersion, 1);
assert.equal(definition.vectors.length, 6);

const generated = definition.vectors.map(generateVector);
const generatedByCheckpoint = new Map(generated.map((vector) => [vector.checkpoint, vector]));
assert.deepEqual(
  generatedVector('root-child-a').canonicalBytes,
  generatedVector('root-child-b').canonicalBytes,
);
assert.deepEqual(
  generatedVector('shared-child-a').canonicalBytes,
  generatedVector('shared-child-b').canonicalBytes,
);
assert.notDeepEqual(
  generatedVector('map-entity-r0').canonicalBytes,
  generatedVector('map-entity-r1').canonicalBytes,
);

const artifacts = generated
  .map(({ artifactPath, canonicalBytes, checkpoint }) => {
    write(artifactPath, canonicalBytes);
    const digest = sha256(canonicalBytes);
    return {
      path: artifactPath,
      kind: 'canonical-kernel-vector',
      checkpoint,
      byteLength: canonicalBytes.byteLength,
      canonicalKernelVectorSha256: digest,
      fixtureIntegritySha256: digest,
    };
  })
  .sort(compareByPath);

const manifestPath = `manifests/${fixtureId}.fixture.generated.json`;
const expectedPath = (checkpoint) =>
  `fixed-seeds/${fixtureId}/expected/${checkpoint}/seed.kernel.canonical`;
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
  stableIds: {
    boundaryPortalId: definition.stableIds.boundaryPortalId,
    childMapAId: definition.stableIds.childMapAId,
    childMapBId: definition.stableIds.childMapBId,
    entityId: definition.stableIds.entityId,
    mapId: definition.stableIds.mapId,
    markerAspectId: definition.stableIds.markerAspectId,
    rootSurfaceId: definition.stableIds.rootSurfaceId,
  },
  versions: {
    deterministicStreamVersion: definition.versions.deterministicStreamVersion,
    generatorVersion: definition.generatorVersion,
    seedDerivationVersion: definition.versions.seedDerivationVersion,
  },
  checkpointRevisions: Object.fromEntries(
    [...definition.vectors]
      .sort((left, right) => compareText(left.checkpoint, right.checkpoint))
      .map((vector) => [vector.checkpoint, { 'proof.markers': vector.variantRevision }]),
  ),
  expectedAssertions: [
    {
      assertionId: 'map-entity-revision-changes-vector',
      operator: 'bytes-not-equal',
      reviewPurpose: 'Prove the selected aspect revision changes its complete seed vector.',
      leftArtifactPath: expectedPath('map-entity-r0'),
      rightArtifactPath: expectedPath('map-entity-r1'),
    },
    {
      assertionId: 'root-child-contexts-agree',
      operator: 'bytes-equal',
      reviewPurpose: 'Prove child map identity does not enter a root-coordinate namespace.',
      leftArtifactPath: expectedPath('root-child-a'),
      rightArtifactPath: expectedPath('root-child-b'),
    },
    {
      assertionId: 'runner-validates-seed-vectors',
      operator: 'runner-pass',
      reviewPurpose: 'Prove the core reproduces all ADR-0006 bytes and samples.',
    },
    {
      assertionId: 'shared-child-contexts-agree',
      operator: 'bytes-equal',
      reviewPurpose: 'Prove child map identity does not enter a shared-boundary namespace.',
      leftArtifactPath: expectedPath('shared-child-a'),
      rightArtifactPath: expectedPath('shared-child-b'),
    },
  ],
  reviewPurpose:
    'Prove cross-platform seed derivation, stream compatibility, revision isolation, and cross-child agreement.',
  reviewRecord: { path: fixtureReviewRecordPath, sha256: sha256(reviewBytes) },
  generatedRoots: [`fixed-seeds/${fixtureId}/expected`],
  artifacts,
};
write(manifestPath, await format(JSON.stringify(manifest), { parser: 'json' }));

function generateVector(vector) {
  const rawInput = {
    seedDerivationVersion: definition.versions.seedDerivationVersion,
    deterministicStreamVersion: definition.versions.deterministicStreamVersion,
    seedScope: vector.seedScope,
    worldSeed: definition.worldSeed,
    generatorId: definition.generatorId,
    generatorVersion: definition.generatorVersion,
    aspectName: definition.aspectName,
    variantRevision: vector.variantRevision,
    ...(vector.seedScope === 'map/entity'
      ? { mapId: definition.stableIds.mapId, entityId: definition.stableIds.entityId }
      : vector.seedScope === 'root-coordinate'
        ? { rootSurfaceId: definition.stableIds.rootSurfaceId, point: vector.point }
        : { boundaryPortalId: definition.stableIds.boundaryPortalId }),
  };
  const input = value(core.parseSeedInput(rawInput));
  const encoded = value(core.encodeSeedInput(input));
  assert.equal(value(core.validateSeedInputEncodingV1(encoded)), true);
  const derivedSeed = value(core.deriveSeed(input));
  const stream = value(core.createDeterministicRandomStream(input));
  const actual = {
    encodedByteLength: encoded.byteLength,
    encodedHex: hex(encoded),
    derivedSeedHex: derivedSeed.hex,
    nextUint64: Array.from({ length: 6 }, () => stream.nextUint64().toString(10)),
    ...(vector.checkpoint === 'map-entity-r0'
      ? {
          independentSamples: {
            nextUint32: value(core.createDeterministicRandomStream(input)).nextUint32(),
            nextFloat64: value(core.createDeterministicRandomStream(input)).nextFloat64(),
            nextInt1000: value(core.createDeterministicRandomStream(input)).nextInt(1_000),
          },
        }
      : {}),
  };
  assert.deepEqual(actual, vector.expected);
  const canonicalBytes = Buffer.from(`${JSON.stringify(actual, null, 2)}\n`, 'utf8');
  return {
    artifactPath: `fixed-seeds/${fixtureId}/expected/${vector.checkpoint}/seed.kernel.canonical`,
    canonicalBytes,
    checkpoint: vector.checkpoint,
  };
}

function generatedVector(checkpoint) {
  const vector = generatedByCheckpoint.get(checkpoint);
  if (vector === undefined) throw new Error(`Missing generated checkpoint ${checkpoint}.`);
  return vector;
}

async function loadCore() {
  const sourceDirectory = resolve(repositoryRoot, 'packages/core/src');
  const runtimeDirectory = resolve(outputRoot, '..', 'core-runtime');
  mkdirSync(runtimeDirectory);
  const sourceNames = readdirSync(sourceDirectory)
    .filter(
      (name) =>
        name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.type-test.ts'),
    )
    .sort(compareText);
  for (const sourceName of sourceNames) {
    const source = readFileSync(resolve(sourceDirectory, sourceName), 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
      fileName: sourceName,
    }).outputText;
    writeFileSync(resolve(runtimeDirectory, sourceName.replace(/\.ts$/u, '.js')), output);
  }
  return import(pathToFileURL(resolve(runtimeDirectory, 'index.js')).href);
}

function argument(name) {
  const index = args.indexOf(name);
  if (index === -1 || args[index + 1] === undefined) {
    throw new Error(`Missing fixture runner argument ${name}.`);
  }
  return args[index + 1];
}

function value(result) {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostic));
  return result.value;
}

function write(path, contents) {
  const destination = resolve(outputRoot, path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, contents);
}

function hex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
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
