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
const render = await loadRenderModule();

assert.equal(fixtureId, 'atlas-physical-overlay-profile-v2');
assert.equal(definition.fixtureDefinitionVersion, 1);
assert.equal(definition.fixtureId, fixtureId);

const scene = physicalOverlayScene(definition.stableIds, render.ATLAS_DISPLAY_PROJECTION_METADATA);
const style = {
  styleId: 'atlas-style.restrained-ink',
  styleBehaviorVersion: 1,
  tokenVersion: 1,
};
const svgRequest = Object.freeze({
  scene,
  style: Object.freeze(style),
});
const pngRequest = Object.freeze({
  scene,
  style: Object.freeze(style),
  dimensions: Object.freeze({ widthPx: 1600, heightPx: 800 }),
});

const v1Svg = render.exportAtlasSceneToSvg(svgRequest);
assert.equal(v1Svg.ok, false);
if (!v1Svg.ok)
  assert.match(v1Svg.diagnostics.map(({ message }) => message).join('\n'), /atlas-svg-v2/u);
const svg = value(render.exportAtlasSceneToSvgWithPhysicalOverlays(svgRequest));
const repeatedSvg = value(render.exportAtlasSceneToSvgWithPhysicalOverlays(svgRequest));
assert.deepEqual(repeatedSvg.bytes, svg.bytes);

const firstPng = await render.exportAtlasSceneToPngWithPhysicalOverlaysAsync(
  pngRequest,
  pngRuntime(),
);
const secondPng = await render.exportAtlasSceneToPngWithPhysicalOverlaysAsync(
  pngRequest,
  pngRuntime(),
);
assert.equal(firstPng.ok, true);
assert.equal(secondPng.ok, true);
if (!firstPng.ok || !secondPng.ok) throw new Error('Physical-overlay PNG export failed.');
assert.deepEqual(secondPng.value.bytes, firstPng.value.bytes);
assert.equal(firstPng.value.profileId, 'atlas-png-v2');
assert.equal(firstPng.value.resources.hasFullSizeRasterSurface, false);

const physicalIndex = svg.svg.indexOf('data-render-node-id="atlas/physical/relief/0000"');
const coastlineIndex = svg.svg.indexOf('data-render-node-id="atlas/coastline/0000"');
assert.ok(physicalIndex > svg.svg.indexOf('data-render-node-id="atlas/land/main"'));
assert.ok(coastlineIndex > physicalIndex);
assert.match(svg.svg, /data-source-id="88888888-8888-4888-8888-888888888888"/u);
assert.match(svg.svg, /data-source-aspect-id="99999999-9999-4999-8999-999999999999"/u);

const artifacts = [
  artifact(
    `canonical-svg/${fixtureId}/baseline.svg`,
    'canonical-svg',
    'baseline',
    Buffer.from(svg.bytes),
  ),
  artifact(
    `fixed-seeds/${fixtureId}/expected/baseline/atlas-physical-overlay.scene.canonical`,
    'canonical-render-scene',
    'baseline',
    Buffer.from(await format(JSON.stringify(scene), { parser: 'json' })),
  ),
  artifact(
    `visual-gallery/${fixtureId}/baseline.png`,
    'visual-evidence',
    'baseline',
    Buffer.from(firstPng.value.bytes),
  ),
].sort(compareByPath);
for (const candidate of artifacts) write(candidate.path, candidate.bytes);

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
      assertionId: 'runner-validates-v2-profile-contract',
      operator: 'runner-pass',
      reviewPurpose:
        'Prove v1 rejection, v2 acceptance, canonical source links, exact repeated bytes, and physical-overlay paint order.',
    },
  ],
  reviewPurpose:
    'Provide bounded visual and canonical evidence that the opt-in v2 physical overlay remains visible below continuous coastline ink.',
  reviewRecord: { path: fixtureReviewRecordPath, sha256: sha256(reviewBytes) },
  generatedRoots: [
    `canonical-svg/${fixtureId}`,
    `fixed-seeds/${fixtureId}/expected`,
    `visual-gallery/${fixtureId}`,
  ],
  artifacts: artifacts.map((candidate) =>
    Object.fromEntries(Object.entries(candidate).filter(([key]) => key !== 'bytes')),
  ),
};
write(
  `manifests/${fixtureId}.fixture.generated.json`,
  await format(JSON.stringify(manifest), { parser: 'json' }),
);

function physicalOverlayScene(stableIds, projection) {
  const paperEntityId = '22222222-2222-4222-8222-222222222222';
  const waterEntityId = '33333333-3333-4333-8333-333333333333';
  const paperAspectId = '55555555-5555-4555-8555-555555555555';
  const waterAspectId = '66666666-6666-4666-8666-666666666666';
  const landPoints = [
    { xPx: 260, yPx: 180 },
    { xPx: 1710, yPx: 170 },
    { xPx: 1850, yPx: 520 },
    { xPx: 1430, yPx: 830 },
    { xPx: 730, yPx: 860 },
    { xPx: 190, yPx: 560 },
  ];
  return {
    authority: 'disposable-render-scene',
    sceneKind: 'whole-world-atlas',
    sceneCompositionVersion: 3,
    levelOfDetail: 'normal-atlas',
    coordinateSpace: 'atlas-display-equirectangular-v1',
    sourceWorldMapId: stableIds.worldMapId,
    projection,
    widthPx: 2048,
    heightPx: 1024,
    nodes: [
      rectangle('atlas/background/paper', paperEntityId, paperAspectId, '#eadcba'),
      rectangle('atlas/background/water', waterEntityId, waterAspectId, '#afbec0'),
      {
        id: 'atlas/land/main',
        kind: 'compoundPath',
        sourceId: stableIds.landEntityId,
        sourceAspectId: stableIds.landAspectId,
        relatedSourceIds: [waterEntityId],
        subpaths: [{ points: landPoints }],
        fillColor: '#c9c39a',
        fillRule: 'evenodd',
      },
      {
        id: 'atlas/physical/relief/0000',
        kind: 'compoundPath',
        sourceId: stableIds.physicalEntityId,
        sourceAspectId: stableIds.physicalAspectId,
        relatedSourceIds: [stableIds.landEntityId],
        subpaths: [
          {
            points: [
              { xPx: 600, yPx: 360 },
              { xPx: 1500, yPx: 330 },
              { xPx: 1590, yPx: 560 },
              { xPx: 1280, yPx: 720 },
              { xPx: 760, yPx: 680 },
              { xPx: 500, yPx: 530 },
            ],
          },
        ],
        fillColor: '#718c8e',
        fillRule: 'evenodd',
      },
      polyline('atlas/paper/grain-0000', paperEntityId, paperAspectId, '#d9c8a3', 0.55, 80),
      polyline('atlas-water/echo/0000', waterEntityId, waterAspectId, '#718c8e', 0.75, 90, [
        stableIds.landEntityId,
      ]),
      polyline('atlas-water/mark/0000', waterEntityId, waterAspectId, '#718c8e', 0.6, 120),
      {
        id: 'atlas/coastline/0000',
        kind: 'polyline',
        sourceId: stableIds.landEntityId,
        sourceAspectId: stableIds.landAspectId,
        relatedSourceIds: [waterEntityId],
        points: [...landPoints, landPoints[0]],
        strokeColor: '#282a24',
        strokeWidthPx: 2,
      },
    ],
  };
}

function rectangle(id, sourceId, sourceAspectId, fillColor) {
  return {
    id,
    kind: 'rectangle',
    sourceId,
    sourceAspectId,
    relatedSourceIds: [],
    xPx: 0,
    yPx: 0,
    widthPx: 2048,
    heightPx: 1024,
    fillColor,
  };
}

function polyline(
  id,
  sourceId,
  sourceAspectId,
  strokeColor,
  strokeWidthPx,
  offset,
  relatedSourceIds = [],
) {
  return {
    id,
    kind: 'polyline',
    sourceId,
    sourceAspectId,
    relatedSourceIds,
    points: [
      { xPx: offset, yPx: offset },
      { xPx: offset + 200, yPx: offset + 50 },
    ],
    strokeColor,
    strokeWidthPx,
  };
}

function pngRuntime() {
  return {
    isCancellationRequested: () => false,
    reportProgress: () => undefined,
    yieldControl: () => Promise.resolve(),
  };
}

async function loadRenderModule() {
  const runtimeRoot = resolve(outputRoot, '..', 'runtime');
  transpilePackage('core', runtimeRoot, {});
  const renderDirectory = transpilePackage('render', runtimeRoot, {
    '@ttrpg-map/core': '../core/index.js',
  });
  return {
    ...(await import(pathToFileURL(resolve(renderDirectory, 'atlas-png-export.js')).href)),
    ...(await import(pathToFileURL(resolve(renderDirectory, 'atlas-svg-export.js')).href)),
    ...(await import(pathToFileURL(resolve(renderDirectory, 'atlas-display-projection.js')).href)),
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
    .sort();
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

function artifact(path, kind, checkpoint, bytes) {
  const digest = sha256(bytes);
  return {
    path,
    kind,
    checkpoint,
    byteLength: bytes.byteLength,
    fixtureIntegritySha256: digest,
    ...(kind === 'canonical-render-scene' ? { canonicalSceneSha256: digest } : {}),
    ...(kind === 'canonical-svg' ? { canonicalSvgSha256: digest } : {}),
    ...(kind === 'visual-evidence' ? { visualEvidenceSha256: digest } : {}),
    bytes,
  };
}

function value(result) {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function argument(name) {
  const index = args.indexOf(name);
  if (index === -1 || args[index + 1] === undefined) {
    throw new Error(`Missing fixture runner argument ${name}.`);
  }
  return args[index + 1];
}

function write(path, contents) {
  const destination = resolve(outputRoot, path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, contents);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function compareByPath(left, right) {
  return left.path < right.path ? -1 : left.path > right.path ? 1 : 0;
}
