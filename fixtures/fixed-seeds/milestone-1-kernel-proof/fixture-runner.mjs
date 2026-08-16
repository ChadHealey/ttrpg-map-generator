import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { format } from 'prettier';
import ts from 'typescript';

import { renderSceneToDeterministicPng } from '../../../scripts/render-scene-png.mjs';

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
const { core, desktop, generation, persistence, render } = await loadProjectModules();

assert.equal(fixtureId, 'milestone-1-kernel-proof');
assert.equal(definition.fixtureDefinitionVersion, 1);
assert.deepEqual(definition.versions, expectedVersions());

const baseline = generation.createMilestoneOneProofDocument(definition.worldSeed);
const repeatedBaseline = generation.createMilestoneOneProofDocument(definition.worldSeed);
const firstProposal = generation.proposeMilestoneOneMarkers(
  baseline,
  generation.MILESTONE_ONE_REVISION_ONE,
);
const repeatedProposal = generation.proposeMilestoneOneMarkers(
  baseline,
  generation.MILESTONE_ONE_REVISION_ONE,
);
assert.deepEqual(repeatedProposal, firstProposal);
const firstReroll = generation.rerollMilestoneOneMarkers(baseline);
const repeatedReroll = generation.rerollMilestoneOneMarkers(baseline);
assert.equal(firstReroll.ok, true);
assert.equal(repeatedReroll.ok, true);
if (!firstReroll.ok || !repeatedReroll.ok) throw new Error('Marker reroll transaction failed.');
const rerolled = firstReroll.document;
assert.deepEqual(repeatedBaseline, baseline);
assert.deepEqual(repeatedReroll.document, rerolled);
assert.deepEqual(firstReroll.committedAspectIds, [generation.PROOF_MARKER_ASPECT_ID]);
assert.deepEqual(firstReroll.dependencyEffects, []);

const baselineAspects = generation.milestoneOneProofAspects(baseline);
const repeatedBaselineAspects = generation.milestoneOneProofAspects(repeatedBaseline);
const rerolledAspects = generation.milestoneOneProofAspects(rerolled);
const baselineOutline = baselineAspects.outline;
const baselineMarkers = baselineAspects.markers;
const rerolledOutline = rerolledAspects.outline;
const rerolledMarkers = rerolledAspects.markers;
assert.deepEqual(aspectBytes(repeatedBaselineAspects.outline), aspectBytes(baselineOutline));
assert.deepEqual(aspectBytes(repeatedBaselineAspects.markers), aspectBytes(baselineMarkers));
assert.deepEqual(rerolledOutline, baselineOutline);
assert.notDeepEqual(rerolledMarkers.acceptedOutput, baselineMarkers.acceptedOutput);
assert.deepEqual(
  generation.milestoneOneMarkerIds(rerolled),
  generation.milestoneOneMarkerIds(baseline),
);
assert.deepEqual(generation.milestoneOneMarkerIds(baseline), expectedMarkerIds());
assert.equal(rerolledMarkers.variantRevision, generation.MILESTONE_ONE_REVISION_ONE);
assert.equal(rerolledOutline.variantRevision, generation.MILESTONE_ONE_REVISION_ZERO);
assert.deepEqual(unselectedMapState(rerolled), unselectedMapState(baseline));

const packageResult = value(persistence.encodeMapworld(rerolled));
const repeatedPackage = value(persistence.encodeMapworld(reorderedDocument(rerolled)));
assert.deepEqual(repeatedPackage, packageResult);
const reopened = value(persistence.decodeMapworld(packageResult));
assert.deepEqual(value(persistence.encodeMapworld(reopened)), packageResult);
const reopenedAspects = generation.milestoneOneProofAspects(reopened);
assert.deepEqual(aspectBytes(reopenedAspects.outline), aspectBytes(rerolledOutline));
assert.deepEqual(outputBytes(reopenedAspects.outline), outputBytes(rerolledOutline));
assert.deepEqual(aspectBytes(reopenedAspects.markers), aspectBytes(rerolledMarkers));
assert.deepEqual(outputBytes(reopenedAspects.markers), outputBytes(rerolledMarkers));
assert.deepEqual(unselectedMapState(reopened), unselectedMapState(rerolled));
assertGeneratorFreePersistenceSources();

const baselineScene = proofScene(baseline);
const rerolledScene = proofScene(rerolled);
const reopenedScene = proofScene(reopened);
assertRenderComparison(baselineScene, rerolledScene, reopenedScene);

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
const renderArtifacts = [
  svgArtifact('baseline', baselineScene),
  svgArtifact('reopened', reopenedScene),
  svgArtifact('rerolled', rerolledScene),
  visualArtifact('baseline', baselineScene),
  visualArtifact('reopened', reopenedScene),
  visualArtifact('rerolled', rerolledScene),
];
const artifacts = [...canonicalArtifacts, ...renderArtifacts, ...savedArtifacts].sort(
  compareByPath,
);
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
      assertionId: 'baseline-render-changes-on-marker-reroll',
      operator: 'bytes-not-equal',
      reviewPurpose: 'Prove marker reroll creates a visible structural render delta.',
      leftArtifactPath: `canonical-svg/${fixtureId}/baseline.svg`,
      rightArtifactPath: `canonical-svg/${fixtureId}/rerolled.svg`,
    },
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
      assertionId: 'reopened-render-equals-rerolled',
      operator: 'bytes-equal',
      reviewPurpose: 'Prove native-authoritative reopen has no render-scene or SVG drift.',
      leftArtifactPath: `canonical-svg/${fixtureId}/reopened.svg`,
      rightArtifactPath: `canonical-svg/${fixtureId}/rerolled.svg`,
    },
    {
      assertionId: 'runner-validates-persistence-round-trip',
      operator: 'runner-pass',
      reviewPurpose:
        'Prove deterministic encoding, authoritative checksums, generator-free decode, and exact reopen.',
    },
  ],
  reviewPurpose:
    'Prove selective reroll isolation, stable RenderScene derivation, and deterministic, checksummed, generator-free mapworld v1 restoration.',
  reviewRecord: { path: fixtureReviewRecordPath, sha256: sha256(reviewBytes) },
  generatedRoots: [
    `canonical-svg/${fixtureId}`,
    `fixed-seeds/${fixtureId}/expected`,
    `saved-projects/v1/${fixtureId}`,
    `visual-gallery/${fixtureId}`,
  ],
  artifacts: artifacts.map((artifact) =>
    Object.fromEntries(Object.entries(artifact).filter(([key]) => key !== 'bytes')),
  ),
};
write(
  `manifests/${fixtureId}.fixture.generated.json`,
  await format(JSON.stringify(manifest), { parser: 'json' }),
);

function unselectedMapState(document) {
  const map = generation.milestoneOneRootMap(document);
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
  const map = generation.milestoneOneRootMap(document);
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

function aspectBytes(aspect) {
  return value(persistence.canonicalAspectBytes(aspect));
}

function outputBytes(aspect) {
  return value(persistence.canonicalAspectOutputBytes(aspect));
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

function svgArtifact(checkpoint, scene) {
  const bytes = Buffer.from(render.renderSceneToSvg(scene), 'utf8');
  const digest = sha256(bytes);
  return {
    path: `canonical-svg/${fixtureId}/${checkpoint}.svg`,
    kind: 'canonical-svg',
    checkpoint,
    byteLength: bytes.byteLength,
    canonicalSvgSha256: digest,
    fixtureIntegritySha256: digest,
    bytes,
  };
}

function visualArtifact(checkpoint, scene) {
  const bytes = renderSceneToDeterministicPng(scene);
  return {
    path: `visual-gallery/${fixtureId}/${checkpoint}.png`,
    kind: 'visual-evidence',
    checkpoint,
    byteLength: bytes.byteLength,
    fixtureIntegritySha256: sha256(bytes),
    bytes,
  };
}

function proofScene(document) {
  const aspects = generation.milestoneOneProofAspects(document);
  return desktop.createMilestoneOneProofScene({
    sourceEntityId: generation.MILESTONE_ONE_PROOF_ENTITY_ID,
    outline: aspects.outline.acceptedOutput.points,
    markers: aspects.markers.acceptedOutput.markers,
  });
}

function assertRenderComparison(baselineScene, rerolledScene, reopenedScene) {
  assert.equal(baselineScene.widthPx, 960);
  assert.equal(baselineScene.heightPx, 600);
  const outline = (scene) => scene.nodes.find(({ id }) => id === 'milestone-one-proof-outline');
  const markers = (scene) =>
    scene.nodes.filter(({ id }) => id.startsWith('milestone-one-proof-marker-'));
  const baselineMarkers = markers(baselineScene);
  const rerolledMarkers = markers(rerolledScene);
  assert.deepEqual(outline(baselineScene), outline(rerolledScene));
  assert.deepEqual(outline(rerolledScene), outline(reopenedScene));
  assert.deepEqual(
    baselineMarkers.map(({ id }) => id),
    rerolledMarkers.map(({ id }) => id),
  );
  assert.equal(baselineMarkers.length, 9);
  assert.notDeepEqual(baselineMarkers, rerolledMarkers);
  assert.deepEqual(rerolledMarkers, markers(reopenedScene));
  assert.notDeepEqual(baselineScene, rerolledScene);
  assert.deepEqual(rerolledScene, reopenedScene);
  for (const node of baselineScene.nodes) {
    assert.equal(node.sourceId, generation.MILESTONE_ONE_PROOF_ENTITY_ID);
  }
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
  const renderDirectory = transpilePackage('render', runtimeRoot, {
    '@ttrpg-map/core': '../core/index.js',
  });
  const desktopDirectory = resolve(runtimeRoot, 'desktop');
  mkdirSync(desktopDirectory, { recursive: true });
  transpileSourceFile(
    resolve(repositoryRoot, 'apps/desktop/src/milestone-one-proof-scene.ts'),
    resolve(desktopDirectory, 'milestone-one-proof-scene.js'),
    { '@ttrpg-map/core': '../core/index.js' },
  );
  return {
    core: await import(pathToFileURL(resolve(coreDirectory, 'index.js')).href),
    desktop: await import(
      pathToFileURL(resolve(desktopDirectory, 'milestone-one-proof-scene.js')).href
    ),
    generation: await import(pathToFileURL(resolve(generationDirectory, 'index.js')).href),
    persistence: await import(pathToFileURL(resolve(persistenceDirectory, 'index.js')).href),
    render: await import(pathToFileURL(resolve(renderDirectory, 'index.js')).href),
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
    transpileSourceFile(
      resolve(sourceDirectory, sourceName),
      resolve(runtimeDirectory, sourceName.replace(/\.ts$/u, '.js')),
      replacements,
    );
  }
  return runtimeDirectory;
}

function transpileSourceFile(sourcePath, destinationPath, replacements) {
  const source = readFileSync(sourcePath, 'utf8');
  let output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
    fileName: sourcePath,
  }).outputText;
  for (const [specifier, replacement] of Object.entries(replacements)) {
    output = output
      .replaceAll(`'${specifier}'`, `'${replacement}'`)
      .replaceAll(`"${specifier}"`, `"${replacement}"`);
  }
  writeFileSync(destinationPath, output);
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
