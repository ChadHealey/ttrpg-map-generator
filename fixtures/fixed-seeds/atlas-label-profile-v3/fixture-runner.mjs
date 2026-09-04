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
const modules = await loadModules();

assert.equal(fixtureId, 'atlas-label-profile-v3');
assert.equal(definition.fixtureDefinitionVersion, 1);
assert.equal(definition.fixtureId, fixtureId);

const rows = [
  createRow('sparse', ['A', 'Ava Vale', 'The Verdant Reach', 'Eldermere II'], 24),
  createRow(
    'dense',
    Array.from({ length: 36 }, (_value, index) => denseName(index)),
    18,
  ),
];
const style = Object.freeze({
  styleId: 'atlas-style.restrained-ink',
  styleBehaviorVersion: 1,
  tokenVersion: 1,
});
const artifacts = [];

for (const row of rows) {
  const request = Object.freeze({ scene: row.scene, style });
  const svg = value(modules.exportAtlasSceneToSvgWithLabels(request));
  const repeatedSvg = value(modules.exportAtlasSceneToSvgWithLabels(request));
  assert.deepEqual(repeatedSvg.bytes, svg.bytes);
  assert.equal(svg.profileId, 'atlas-svg-v3');
  assert.equal(svg.svg.includes('<text'), false);
  for (const name of row.names) assert.match(svg.svg, new RegExp(`<title>${name}</title>`, 'u'));
  assert.ok(svg.svg.indexOf('data-placement-id=') > svg.svg.indexOf('atlas/coastline/0000'));

  const pngRequest = Object.freeze({
    ...request,
    dimensions: Object.freeze({ widthPx: 1600, heightPx: 800 }),
  });
  const png = value(await modules.exportAtlasSceneToPngWithLabelsAsync(pngRequest, pngRuntime()));
  const repeatedPng = value(
    await modules.exportAtlasSceneToPngWithLabelsAsync(pngRequest, pngRuntime()),
  );
  assert.deepEqual(repeatedPng.bytes, png.bytes);
  assert.equal(png.profileId, 'atlas-png-v3');

  artifacts.push(
    artifact(
      `canonical-svg/${fixtureId}/${row.checkpoint}.svg`,
      'canonical-svg',
      row.checkpoint,
      Buffer.from(svg.bytes),
    ),
    artifact(
      `fixed-seeds/${fixtureId}/expected/${row.checkpoint}/atlas-label.scene.canonical`,
      'canonical-render-scene',
      row.checkpoint,
      Buffer.from(await format(JSON.stringify(row.scene), { parser: 'json' })),
    ),
    artifact(
      `visual-gallery/${fixtureId}/${row.checkpoint}.png`,
      'visual-evidence',
      row.checkpoint,
      Buffer.from(png.bytes),
    ),
  );
}

const denseLarge = value(
  await modules.exportAtlasSceneToPngWithLabelsAsync(
    {
      scene: rows[1].scene,
      style,
      dimensions: Object.freeze({ widthPx: 8192, heightPx: 4096 }),
    },
    pngRuntime(),
  ),
);
assert.equal(denseLarge.widthPx, 8192);
assert.equal(denseLarge.heightPx, 4096);

artifacts.sort(compareByPath);
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
      assertionId: 'runner-validates-v3-label-profile-contract',
      operator: 'runner-pass',
      reviewPurpose:
        'Prove v3 acceptance, source-linked accessibility titles, post-coastline order, exact repeated SVG/PNG bytes, and bounded large output.',
    },
  ],
  reviewPurpose:
    'Provide sparse and dense canonical/visual evidence for exact outlined atlas labels without changing released v1/v2 contracts.',
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

function createRow(checkpoint, displayNames, fontSizePx) {
  const metrics = value(modules.createAtlasGlyphMetricSnapshot(modules.glyphPack));
  const names = displayNames.map((displayName, index) => ({
    entityId: entityId(index),
    nameKind: 'landmass',
    nameContentBehaviorVersion: 1,
    lexiconVersion: 1,
    variantRevision: 0,
    origin: 'generated',
    displayName,
    comparisonKey: displayName.toLowerCase(),
  }));
  const placementResult = modules.resolveAtlasLabelPlacements({
    mapId: definition.stableIds.mapId,
    worldSeed: definition.worldSeed,
    sceneExtent: {
      minXTicks: 0,
      minYTicks: 0,
      maxXTicks: 2048 * 1024,
      maxYTicks: 1024 * 1024,
    },
    metrics,
    candidates: names.map((nameContent, index) => ({
      nameContent,
      placementVariantRevision: 0,
      glyphPackSha256: metrics.packSha256,
      priority: 100 - index,
      fontSizeTicks: fontSizePx * 1024,
      anchor: {
        xTicks:
          (checkpoint === 'sparse' ? [24, 500, 980, 1500][index] : 140 + (index % 6) * 320) * 1024,
        yTicks: (checkpoint === 'sparse' ? 300 : 120 + Math.floor(index / 6) * 150) * 1024,
      },
      variants: [{ variantKey: 'center', baselineOffset: { xTicks: 0, yTicks: 0 } }],
    })),
  });
  assert.equal(placementResult.ok, true);
  if (!placementResult.ok) throw new Error(JSON.stringify(placementResult.diagnostics));
  assert.equal(placementResult.proposals.length, displayNames.length);
  const placements = placementResult.proposals.map(({ output }) => output);
  const layer = value(
    modules.composeAtlasVectorLabelLayer(
      { names: Object.freeze(names), placements: Object.freeze(placements) },
      modules.glyphPack,
      '#282a24',
    ),
  );
  const base = physicalOverlayScene();
  const scene = Object.freeze({
    ...base,
    sceneCompositionVersion: 4,
    nodes: Object.freeze([...base.nodes, ...modules.expandAtlasVectorLabelLayer(layer)]),
    vectorLabels: layer,
  });
  return Object.freeze({ checkpoint, names: Object.freeze(displayNames), scene });
}

function physicalOverlayScene() {
  const paperEntityId = '22222222-2222-4222-8222-222222222222';
  const waterEntityId = '33333333-3333-4333-8333-333333333333';
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
    sourceWorldMapId: definition.stableIds.mapId,
    projection: modules.ATLAS_DISPLAY_PROJECTION_METADATA,
    widthPx: 2048,
    heightPx: 1024,
    nodes: [
      rectangle(
        'atlas/background/paper',
        paperEntityId,
        '55555555-5555-4555-8555-555555555555',
        '#eadcba',
      ),
      rectangle(
        'atlas/background/water',
        waterEntityId,
        '66666666-6666-4666-8666-666666666666',
        '#afbec0',
      ),
      {
        id: 'atlas/land/main',
        kind: 'compoundPath',
        sourceId: definition.stableIds.landEntityId,
        sourceAspectId: definition.stableIds.landAspectId,
        relatedSourceIds: [waterEntityId],
        subpaths: [{ points: landPoints }],
        fillColor: '#c9c39a',
        fillRule: 'evenodd',
      },
      {
        id: 'atlas/physical/relief/0000',
        kind: 'compoundPath',
        sourceId: definition.stableIds.physicalEntityId,
        sourceAspectId: definition.stableIds.physicalAspectId,
        relatedSourceIds: [definition.stableIds.landEntityId],
        subpaths: [{ points: landPoints.slice(1, 5) }],
        fillColor: '#718c8e',
        fillRule: 'evenodd',
      },
      polyline(
        'atlas/paper/grain-0000',
        paperEntityId,
        '55555555-5555-4555-8555-555555555555',
        '#d9c8a3',
        0.55,
        80,
      ),
      polyline(
        'atlas-water/echo/0000',
        waterEntityId,
        '66666666-6666-4666-8666-666666666666',
        '#718c8e',
        0.75,
        90,
      ),
      polyline(
        'atlas-water/mark/0000',
        waterEntityId,
        '66666666-6666-4666-8666-666666666666',
        '#718c8e',
        0.6,
        120,
      ),
      {
        id: 'atlas/coastline/0000',
        kind: 'polyline',
        sourceId: definition.stableIds.landEntityId,
        sourceAspectId: definition.stableIds.landAspectId,
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

function polyline(id, sourceId, sourceAspectId, strokeColor, strokeWidthPx, offset) {
  return {
    id,
    kind: 'polyline',
    sourceId,
    sourceAspectId,
    relatedSourceIds: [],
    points: [
      { xPx: offset, yPx: offset },
      { xPx: offset + 200, yPx: offset + 50 },
    ],
    strokeColor,
    strokeWidthPx,
  };
}

function entityId(index) {
  return `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
}

function denseName(index) {
  const letter = String.fromCharCode(65 + (index % 26));
  return index < 26 ? `Dense ${letter}` : `Dense A ${letter}`;
}

function pngRuntime() {
  return {
    isCancellationRequested: () => false,
    reportProgress: () => undefined,
    yieldControl: () => Promise.resolve(),
  };
}

async function loadModules() {
  const runtimeRoot = resolve(outputRoot, '..', 'runtime');
  const coreDirectory = transpilePackage('core', runtimeRoot, {});
  const assetsDirectory = transpilePackage('assets', runtimeRoot, {
    '@ttrpg-map/core': '../core/index.js',
  });
  const renderDirectory = transpilePackage('render', runtimeRoot, {
    '@ttrpg-map/core': '../core/index.js',
  });
  const core = await import(pathToFileURL(resolve(coreDirectory, 'index.js')).href);
  const assets = await import(pathToFileURL(resolve(assetsDirectory, 'index.js')).href);
  return {
    ...core,
    ...(await import(pathToFileURL(resolve(renderDirectory, 'atlas-png-export.js')).href)),
    ...(await import(pathToFileURL(resolve(renderDirectory, 'atlas-svg-export.js')).href)),
    ...(await import(pathToFileURL(resolve(renderDirectory, 'atlas-display-projection.js')).href)),
    ...(await import(pathToFileURL(resolve(renderDirectory, 'atlas-vector-label.js')).href)),
    glyphPack: assets.ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_PACK,
  };
}

function transpilePackage(packageName, runtimeRoot, replacements) {
  const sourceDirectory = resolve(repositoryRoot, 'packages', packageName, 'src');
  const runtimeDirectory = resolve(runtimeRoot, packageName);
  mkdirSync(runtimeDirectory, { recursive: true });
  for (const sourceName of readdirSync(sourceDirectory)
    .filter(
      (name) =>
        name.endsWith('.ts') &&
        !name.endsWith('.d.ts') &&
        !name.endsWith('.test.ts') &&
        !name.endsWith('.type-test.ts'),
    )
    .sort()) {
    const sourcePath = resolve(sourceDirectory, sourceName);
    let output = ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
      fileName: sourcePath,
    }).outputText;
    for (const [specifier, replacement] of Object.entries(replacements))
      output = output
        .replaceAll(`'${specifier}'`, `'${replacement}'`)
        .replaceAll(`"${specifier}"`, `"${replacement}"`);
    writeFileSync(resolve(runtimeDirectory, sourceName.replace(/\.ts$/u, '.js')), output);
  }
  return runtimeDirectory;
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
  if (index === -1 || args[index + 1] === undefined)
    throw new Error(`Missing fixture runner argument ${name}.`);
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
