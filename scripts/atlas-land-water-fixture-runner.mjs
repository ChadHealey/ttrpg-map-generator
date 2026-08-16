import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { format } from 'prettier';
import ts from 'typescript';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function runAtlasLandWaterFixture(expectedFixtureId) {
  const args = process.argv.slice(2);
  const fixtureId = argument(args, '--fixture-id');
  const sourceDefinitionPath = argument(args, '--source-definition');
  const reviewRecordPath = argument(args, '--review-record');
  const fixtureReviewRecordPath = argument(args, '--review-record-path');
  const outputRoot = argument(args, '--output-root');
  const definitionBytes = readFileSync(sourceDefinitionPath);
  const definition = JSON.parse(definitionBytes.toString('utf8'));
  const reviewBytes = readFileSync(reviewRecordPath);
  const { core, generation } = await loadProjectModules(outputRoot);

  assert.equal(fixtureId, expectedFixtureId);
  assert.equal(definition.fixtureId, fixtureId);
  assert.equal(definition.fixtureDefinitionVersion, 1);
  assert.equal(definition.evidenceBoundary, 'pre-persistence-atlas-generator-kernel-v1');
  assert.equal(definition.notCanonicalAspectBytes, true);
  assert.deepEqual(definition.versions, expectedVersions(core, generation));
  assert.deepEqual(definition.stableIds, expectedStableIds(core, definition));

  const input = parsed(
    generation.createAtlasLandWaterGenerationInput({
      worldSeed: definition.worldSeed,
      worldMapId: definition.stableIds.worldMapId,
      worldSurfaceEntityId: definition.stableIds.worldSurfaceEntityId,
      macroElevationAspectId: definition.stableIds.macroElevationAspectId,
      landWaterClassificationAspectId: definition.stableIds.landWaterClassificationAspectId,
      macroElevationVariantRevision: definition.checkpoints.baseline['worldTerrain.macroElevation'],
      landWaterClassificationVariantRevision:
        definition.checkpoints.baseline['worldSurface.landWaterClassification'],
      controls: definition.controls,
    }),
  );
  const previewProgress = [];
  const previewResult = await generation.generateAtlasLandWaterPreview(
    input,
    runtime(core, input, `${fixtureId}:preview`, previewProgress),
  );
  assert.equal(previewResult.status, 'preview');
  if (previewResult.status !== 'preview') throw new Error(JSON.stringify(previewResult));
  assertDisposablePreview(previewResult.preview);
  assertProgress(previewProgress, `${fixtureId}:preview`);

  const fullProgress = [];
  const fullResult = await generation.generateAtlasLandWaterFull(
    input,
    runtime(core, input, `${fixtureId}:full`, fullProgress),
  );
  assert.equal(fullResult.status, 'proposed-full');
  if (fullResult.status !== 'proposed-full') throw new Error(JSON.stringify(fullResult));
  assertProgress(fullProgress, `${fixtureId}:full`);
  assert.deepEqual(core.validateAtlasLandWaterRecords(fullResult.patch.records), []);
  assert.equal(fullResult.patch.replacements.length, 2);
  assert.equal(fullResult.patch.replacements[0].target.aspectName, 'worldTerrain.macroElevation');
  assert.deepEqual(fullResult.patch.replacements[0].dependencyAspects, []);
  assert.equal(
    fullResult.patch.replacements[1].target.aspectName,
    'worldSurface.landWaterClassification',
  );
  assert.deepEqual(fullResult.patch.replacements[1].dependencyAspects, [
    { aspectId: definition.stableIds.macroElevationAspectId },
  ]);
  assert.ok(
    fullResult.realization.absoluteWaterCoverageErrorBasisPoints <=
      generation.ATLAS_WATER_COVERAGE_TOLERANCE_BASIS_POINTS,
  );
  assert.ok(
    fullResult.diagnostics.some(
      ({ code }) => code === 'atlas.land-water.ocean-connectivity-unverified',
    ),
  );
  assert.ok(fullResult.diagnostics.every(({ severity }) => severity !== 'error'));

  const records = fullResult.patch.records;
  const preview = previewResult.preview;
  const shared = assertSharedAnchors(generation, preview, records);
  const seam = assertSeamAndPoleBehavior(core, generation, input, records);
  const macroBytes = macroTickBytes(records.macroElevation.values);
  const classificationBytes = packedClassificationBytes(records.landWaterClassification.samples);
  const macroSha256 = sha256(macroBytes);
  const classificationSha256 = sha256(classificationBytes);
  const primitiveTraversalSha256 = hashPrimitiveTraversal(
    definition,
    records.landWaterClassification.seaLevelContourDoubledTicks,
    macroBytes,
    classificationBytes,
  );
  const sampleCounts = classificationCounts(records.landWaterClassification.samples);
  assert.ok(sampleCounts.land > 0);
  assert.ok(sampleCounts.water > 0);

  const vector = {
    kernelVectorVersion: 1,
    canonicalJsonFormatting: 'prettier-json-print-width-100-v1',
    evidenceBoundary: definition.evidenceBoundary,
    notCanonicalAspectBytes: true,
    notCanonicalAspectOutputBytes: true,
    fixtureId,
    worldSeed: definition.worldSeed,
    stableIds: definition.stableIds,
    controls: input.controls,
    versions: definition.versions,
    profiles: {
      full: {
        profileId: generation.WORLD_ATLAS_FULL_PROFILE.profileId,
        longitudeCellCount: generation.WORLD_ATLAS_FULL_PROFILE.longitudeCellCount,
        latitudeBandCount: generation.WORLD_ATLAS_FULL_PROFILE.latitudeBandCount,
        sampleCount: records.macroElevation.values.length,
      },
      preview: {
        profileId: generation.WORLD_ATLAS_PREVIEW_PROFILE.profileId,
        longitudeCellCount: generation.WORLD_ATLAS_PREVIEW_PROFILE.longitudeCellCount,
        latitudeBandCount: generation.WORLD_ATLAS_PREVIEW_PROFILE.latitudeBandCount,
        sampleCount: preview.macroElevationValues.length,
      },
    },
    proposal: {
      replacementAspectNames: fullResult.patch.replacements.map(({ target }) => target.aspectName),
      classificationDependencyAspectIds: fullResult.patch.replacements[1].dependencyAspects.map(
        ({ aspectId }) => aspectId,
      ),
      seaLevelContourDoubledTicks: records.landWaterClassification.seaLevelContourDoubledTicks,
      macroFieldTicksSha256: macroSha256,
      landWaterPackedBitsSha256: classificationSha256,
      primitiveTraversalSha256,
      sampleCounts,
      realization: fullResult.realization,
      diagnosticCodes: fullResult.diagnostics.map(({ code }) => code),
    },
    invariants: {
      validatedAcceptedOutputRecords: true,
      sharedAnchorCount: shared.anchorCount,
      sharedAnchorFieldTickDifferences: shared.fieldDifferences,
      sharedAnchorClassificationDifferences: shared.classificationDifferences,
      sharedSeaLevelContourDoubledTicks: shared.seaLevelContourDoubledTicks,
      southPole: seam.southPole,
      northPole: seam.northPole,
      canonicalSeamIdentityTicks: seam.canonicalIdentityTicks,
      adjacentSeamDeltaTicks: seam.adjacentDeltaTicks,
      progress: {
        previewReportCount: previewProgress.length,
        fullReportCount: fullProgress.length,
        totalWork: generation.ATLAS_GENERATION_PROGRESS_TOTAL_WORK,
      },
    },
  };
  const canonicalBytes = Buffer.from(await formatJson(vector), 'utf8');
  const artifactPath = `fixed-seeds/${fixtureId}/expected/baseline/atlas-land-water.kernel.canonical`;
  write(outputRoot, artifactPath, canonicalBytes);
  const digest = sha256(canonicalBytes);
  const artifact = {
    path: artifactPath,
    kind: 'canonical-kernel-vector',
    checkpoint: 'baseline',
    byteLength: canonicalBytes.byteLength,
    canonicalKernelVectorSha256: digest,
    fixtureIntegritySha256: digest,
  };
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
        assertionId: 'runner-validates-full-generator-kernel',
        operator: 'runner-pass',
        reviewPurpose:
          'Prove exact full-profile generation, output validation, nesting, seam/pole behavior, progress, and declared realization tolerances.',
      },
    ],
    reviewPurpose:
      'Prove the version-1 atlas macro-elevation and land/water generator for one fixed seed/control row before accepted-aspect persistence integration.',
    reviewRecord: { path: fixtureReviewRecordPath, sha256: sha256(reviewBytes) },
    generatedRoots: [`fixed-seeds/${fixtureId}/expected`],
    artifacts: [artifact],
  };
  write(outputRoot, `manifests/${fixtureId}.fixture.generated.json`, await formatJson(manifest));
}

async function formatJson(value) {
  const options = { parser: 'json', printWidth: 100 };
  const firstPass = await format(JSON.stringify(value), options);
  return format(firstPass, options);
}

function expectedVersions(core, generation) {
  return {
    atlasFieldBehaviorVersion: generation.ATLAS_FIELD_ALGORITHM_VERSION,
    atlasGeneratorManifestVersion: generation.ATLAS_LAND_WATER_GENERATOR_MANIFEST_VERSION,
    atlasGeographyContractVersion: core.ATLAS_GEOGRAPHY_CONTRACT_VERSION,
    atlasParameterSchemaVersion: generation.ATLAS_LAND_WATER_PARAMETER_SCHEMA_VERSION,
    atlasPreviewVersion: generation.ATLAS_LAND_WATER_PREVIEW_VERSION,
    atlasRealizationVersion: generation.ATLAS_LAND_WATER_REALIZATION_VERSION,
    atlasSamplingPolicyVersion: generation.ATLAS_SAMPLING_POLICY_VERSION,
    deterministicStreamVersion: core.DETERMINISTIC_STREAM_VERSION,
    landWaterClassificationBehaviorVersion: generation.ATLAS_LAND_WATER_CLASSIFICATION_VERSION,
    landWaterClassificationGeneratorVersion: 1,
    macroElevationGeneratorVersion: 1,
    seedDerivationVersion: core.SEED_DERIVATION_VERSION,
  };
}

function expectedStableIds(core, definition) {
  const worldMapId = parsed(core.parseStableId('map', definition.stableIds.worldMapId));
  const worldSurfaceEntityId = core.deriveAtlasSingletonEntityIds(worldMapId).worldSurfaceEntityId;
  return {
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

function runtime(core, input, operationId, progress) {
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

function assertDisposablePreview(preview) {
  assert.equal(preview.previewKind, 'disposable-atlas-land-water');
  assert.equal(preview.authority, 'disposable');
  assert.equal(preview.isPromotable, false);
  for (const forbidden of ['aspectId', 'variantRevision', 'status', 'packagePath']) {
    assert.equal(Object.hasOwn(preview, forbidden), false);
  }
}

function assertProgress(progress, operationId) {
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

function assertSharedAnchors(generation, preview, records) {
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

function assertSeamAndPoleBehavior(core, generation, input, records) {
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

function macroTickBytes(values) {
  const bytes = Buffer.allocUnsafe(values.length * 4);
  for (let index = 0; index < values.length; index += 1) {
    bytes.writeInt32BE(values[index], index * 4);
  }
  return bytes;
}

function packedClassificationBytes(samples) {
  const bytes = Buffer.alloc(Math.ceil(samples.length / 8));
  for (let index = 0; index < samples.length; index += 1) {
    if (samples[index] === 'land') bytes[index >>> 3] |= 1 << (7 - (index & 7));
  }
  return bytes;
}

function classificationCounts(samples) {
  let land = 0;
  for (const sample of samples) if (sample === 'land') land += 1;
  return { land, water: samples.length - land };
}

function hashPrimitiveTraversal(definition, threshold, macroBytes, classificationBytes) {
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

async function loadProjectModules(outputRoot) {
  const runtimeRoot = resolve(outputRoot, '..', 'atlas-runtime');
  const coreDirectory = transpilePackage('core', runtimeRoot, {});
  const generationDirectory = transpilePackage('generation', runtimeRoot, {
    '@ttrpg-map/core': '../core/index.js',
  });
  return {
    core: await import(pathToFileURL(resolve(coreDirectory, 'index.js')).href),
    generation: await import(pathToFileURL(resolve(generationDirectory, 'index.js')).href),
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

function argument(args, name) {
  const index = args.indexOf(name);
  if (index === -1 || args[index + 1] === undefined) {
    throw new Error(`Missing fixture runner argument ${name}.`);
  }
  return args[index + 1];
}

function parsed(result) {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics ?? result.diagnostic));
  return result.value;
}

function write(outputRoot, path, contents) {
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
