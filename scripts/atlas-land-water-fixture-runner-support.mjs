/** Shared assertions, hashing, and isolated package loading for atlas fixture runners. */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { format } from 'prettier';
import ts from 'typescript';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function formatJson(value) {
  const options = { parser: 'json', printWidth: 100 };
  const firstPass = await format(JSON.stringify(value), options);
  return format(firstPass, options);
}

export function expectedStableIds(core, definition) {
  const worldMapId = parsed(core.parseStableId('map', definition.stableIds.worldMapId));
  const singletons = core.deriveAtlasSingletonEntityIds(worldMapId);
  const worldSurfaceEntityId = singletons.worldSurfaceEntityId;
  return {
    ...(definition.versions.atlasStyleBehaviorVersion === undefined
      ? {}
      : {
          atlasPresentationEntityId: singletons.atlasPresentationEntityId,
          coastlineAppearanceAspectId: core.deriveAtlasAspectId(
            singletons.atlasPresentationEntityId,
            'atlas.coastlineAppearance',
          ),
          paperTreatmentAspectId: core.deriveAtlasAspectId(
            singletons.atlasPresentationEntityId,
            'atlas.paperTreatment',
          ),
          waterDecorationAspectId: core.deriveAtlasAspectId(
            singletons.atlasPresentationEntityId,
            'atlas.waterDecoration',
          ),
        }),
    landWaterClassificationAspectId: core.deriveAtlasAspectId(
      worldSurfaceEntityId,
      'worldSurface.landWaterClassification',
    ),
    macroElevationAspectId: core.deriveAtlasAspectId(
      worldSurfaceEntityId,
      'worldTerrain.macroElevation',
    ),
    worldMapId,
    worldSurfaceEntityId,
  };
}

export function fixtureRuntime(core, input, operationId, progress) {
  const macro = parsed(core.createDeterministicRandomStream(input.macroElevationSeedMetadata));
  const classification = parsed(
    core.createDeterministicRandomStream(input.landWaterClassificationSeedMetadata),
  );
  assert.notEqual(macro, classification);
  return Object.freeze({
    operationId,
    macroElevationRandom: macro,
    landWaterClassificationRandom: classification,
    cancellation: Object.freeze({
      cancellationVersion: 1,
      isCancellationRequested: () => false,
    }),
    reportProgress: (value) => progress.push(value),
    yieldControl: () => Promise.resolve(),
  });
}

export function assertDisposablePreview(preview) {
  assert.equal(preview.previewKind, 'disposable-atlas-land-water');
  assert.equal(preview.authority, 'disposable');
  assert.equal(preview.isPromotable, false);
  for (const forbidden of ['aspectId', 'variantRevision', 'status', 'packagePath']) {
    assert.equal(Object.hasOwn(preview, forbidden), false);
  }
}

export function assertProgress(progress, operationId) {
  assert.ok(progress.length > 1);
  let previous = -1;
  for (const report of progress) {
    assert.equal(report.operationId, operationId);
    assert.equal(report.totalWork, 1_000);
    assert.ok(report.completedWork >= previous);
    previous = report.completedWork;
  }
  assert.deepEqual(progress.at(-1), {
    ...progress.at(-1),
    stage: 'completed',
    completedWork: 1_000,
    isCancellationRequested: false,
    isTerminal: true,
  });
}

export function assertPngProgress(render, progress) {
  assert.ok(progress.length > 2);
  let previous = -1;
  for (const report of progress) {
    assert.equal(report.profileId, render.ATLAS_PNG_EXPORT_PROFILE_ID);
    assert.ok(report.completedWork >= previous);
    assert.ok(report.completedWork <= report.totalWork);
    previous = report.completedWork;
  }
  assert.deepEqual(progress.at(-1), {
    ...progress.at(-1),
    stage: 'completed',
    completedWork: progress.at(-1).totalWork,
    isTerminal: true,
  });
}

export function assertSharedAnchors(generation, preview, records) {
  let anchorCount = 0;
  let fieldDifferences = 0;
  let classificationDifferences = 0;
  for (
    let latitudeIndex = 0;
    latitudeIndex <= generation.WORLD_ATLAS_PREVIEW_PROFILE.latitudeBandCount;
    latitudeIndex += 1
  ) {
    const longitudeCount =
      latitudeIndex === 0 ||
      latitudeIndex === generation.WORLD_ATLAS_PREVIEW_PROFILE.latitudeBandCount
        ? 1
        : generation.WORLD_ATLAS_PREVIEW_PROFILE.longitudeCellCount;
    for (let longitudeIndex = 0; longitudeIndex < longitudeCount; longitudeIndex += 1) {
      const previewIndex = generation.getAtlasSampleStorageIndex(
        generation.WORLD_ATLAS_PREVIEW_PROFILE,
        longitudeIndex,
        latitudeIndex,
      );
      const fullAddress = generation.getFullProfileAddressForPreview(longitudeIndex, latitudeIndex);
      const fullIndex = generation.getAtlasSampleStorageIndex(
        generation.WORLD_ATLAS_FULL_PROFILE,
        fullAddress.longitudeIndex,
        fullAddress.latitudeIndex,
      );
      anchorCount += 1;
      if (preview.macroElevationValues[previewIndex] !== records.macroElevation.values[fullIndex]) {
        fieldDifferences += 1;
      }
      if (
        preview.landWaterSamples[previewIndex] !==
        records.landWaterClassification.samples[fullIndex]
      ) {
        classificationDifferences += 1;
      }
    }
  }
  assert.equal(fieldDifferences, 0);
  assert.equal(classificationDifferences, 0);
  assert.equal(anchorCount, 130_562);
  assert.equal(
    preview.seaLevelContourDoubledTicks,
    records.landWaterClassification.seaLevelContourDoubledTicks,
  );
  return {
    anchorCount,
    fieldDifferences,
    classificationDifferences,
    seaLevelContourDoubledTicks: preview.seaLevelContourDoubledTicks,
  };
}

export function assertSeamAndPoleBehavior(core, generation, input, records) {
  const adapter = generation.createAtlasMacroElevationFieldAdapter(
    generation.atlasMacroElevationParameters(input.controls),
    parsed(core.createDeterministicRandomStream(input.macroElevationSeedMetadata)),
  );
  const positiveSeam = parsed(core.createPlanetPoint(Math.PI, 0.31));
  const negativeSeam = parsed(core.createPlanetPoint(-Math.PI, 0.31));
  const canonicalIdentityTicks = Math.abs(
    adapter.sample(positiveSeam) - adapter.sample(negativeSeam),
  );
  assert.equal(canonicalIdentityTicks, 0);
  const east = parsed(core.createPlanetPoint(Math.PI - core.PLANET_ANGULAR_STEP_RAD, 0.31));
  const west = parsed(core.createPlanetPoint(-Math.PI + core.PLANET_ANGULAR_STEP_RAD, 0.31));
  const adjacentDeltaTicks = Math.abs(adapter.sample(east) - adapter.sample(west));
  assert.ok(adjacentDeltaTicks <= 2);
  const lastIndex = records.macroElevation.values.length - 1;
  return {
    southPole: {
      sampleCount: 1,
      fieldTicks: records.macroElevation.values[0],
      classification: records.landWaterClassification.samples[0],
    },
    northPole: {
      sampleCount: 1,
      fieldTicks: records.macroElevation.values[lastIndex],
      classification: records.landWaterClassification.samples[lastIndex],
    },
    canonicalIdentityTicks,
    adjacentDeltaTicks,
  };
}

export function macroTickBytes(values) {
  const bytes = Buffer.allocUnsafe(values.length * 4);
  for (let index = 0; index < values.length; index += 1) {
    bytes.writeInt32BE(values[index], index * 4);
  }
  return bytes;
}

export function packedClassificationBytes(samples) {
  const bytes = Buffer.alloc(Math.ceil(samples.length / 8));
  for (let index = 0; index < samples.length; index += 1) {
    if (samples[index] === 'land') bytes[index >>> 3] |= 1 << (7 - (index & 7));
  }
  return bytes;
}

export function classificationCounts(samples) {
  let land = 0;
  for (const sample of samples) if (sample === 'land') land += 1;
  return { land, water: samples.length - land };
}

export function hashPrimitiveTraversal(definition, threshold, macroBytes, classificationBytes) {
  const header = Buffer.from(
    JSON.stringify({
      boundary: definition.evidenceBoundary,
      worldSeed: definition.worldSeed,
      stableIds: definition.stableIds,
      controls: definition.controls,
      versions: definition.versions,
      threshold,
    }),
    'utf8',
  );
  return createHash('sha256')
    .update('ttrpg-map/atlas-land-water-generator-kernel/v1\0')
    .update(header)
    .update(macroBytes)
    .update(classificationBytes)
    .digest('hex');
}

export async function loadProjectModules(outputRoot) {
  const runtimeRoot = resolve(outputRoot, '..', 'atlas-runtime');
  const coreDirectory = transpilePackage('core', runtimeRoot, {});
  const generationDirectory = transpilePackage('generation', runtimeRoot, {
    '@ttrpg-map/core': '../core/index.js',
  });
  const renderDirectory = transpilePackage('render', runtimeRoot, {
    '@ttrpg-map/core': '../core/index.js',
  });
  const assetsDirectory = transpilePackage('assets', runtimeRoot, {
    '@ttrpg-map/core': '../core/index.js',
  });
  const persistenceDirectory = transpilePackage('persistence', runtimeRoot, {
    '@ttrpg-map/core': '../core/index.js',
    zod: pathToFileURL(
      createRequire(resolve(repositoryRoot, 'packages', 'persistence', 'package.json')).resolve(
        'zod',
      ),
    ).href,
  });
  const desktopDirectory = transpileDesktopFiles(runtimeRoot, {
    '@ttrpg-map/assets': '../assets/index.js',
    '@ttrpg-map/core': '../core/index.js',
    '@ttrpg-map/generation': '../generation/index.js',
    '@ttrpg-map/render': '../render/index.js',
  });
  return {
    assets: await import(pathToFileURL(resolve(assetsDirectory, 'index.js')).href),
    core: await import(pathToFileURL(resolve(coreDirectory, 'index.js')).href),
    desktopGeneration: await import(
      pathToFileURL(resolve(desktopDirectory, 'atlas-workflow-generation.js')).href
    ),
    desktopReopen: await import(
      pathToFileURL(resolve(desktopDirectory, 'atlas-workflow-reopen.js')).href
    ),
    desktopSupport: await import(
      pathToFileURL(resolve(desktopDirectory, 'atlas-workflow-generation-support.js')).href
    ),
    generation: await import(pathToFileURL(resolve(generationDirectory, 'index.js')).href),
    persistence: await import(pathToFileURL(resolve(persistenceDirectory, 'index.js')).href),
    render: await import(pathToFileURL(resolve(renderDirectory, 'index.js')).href),
  };
}

function transpileDesktopFiles(runtimeRoot, replacements) {
  const sourceDirectory = resolve(repositoryRoot, 'apps', 'desktop', 'src');
  const runtimeDirectory = resolve(runtimeRoot, 'desktop');
  mkdirSync(runtimeDirectory, { recursive: true });
  for (const sourceName of [
    'atlas-workflow-generation-support.ts',
    'atlas-workflow-generation.ts',
    'atlas-workflow-reopen.ts',
  ]) {
    transpileSourceFile(sourceDirectory, runtimeDirectory, sourceName, replacements);
  }
  return runtimeDirectory;
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
    transpileSourceFile(sourceDirectory, runtimeDirectory, sourceName, replacements);
  }
  return runtimeDirectory;
}

function transpileSourceFile(sourceDirectory, runtimeDirectory, sourceName, replacements) {
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

export function argument(args, name) {
  const index = args.indexOf(name);
  if (index === -1 || args[index + 1] === undefined) {
    throw new Error(`Missing fixture runner argument ${name}.`);
  }
  return args[index + 1];
}

export function parsed(result) {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics ?? result.diagnostic));
  return result.value;
}

export function write(outputRoot, path, contents) {
  const destination = resolve(outputRoot, path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, contents);
}

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function sortedRecord(value) {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => compareText(left, right)),
  );
}
