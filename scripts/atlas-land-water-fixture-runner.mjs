import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { appearanceProof } from './atlas-appearance-fixture-support.mjs';
import { coastlineProof } from './atlas-coastline-fixture-support.mjs';
import {
  argument,
  assertDisposablePreview,
  assertPngProgress,
  assertProgress,
  assertSeamAndPoleBehavior,
  assertSharedAnchors,
  classificationCounts,
  expectedStableIds,
  fixtureRuntime,
  formatJson,
  hashPrimitiveTraversal,
  loadProjectModules,
  macroTickBytes,
  packedClassificationBytes,
  parsed,
  sha256,
  sortedRecord,
  write,
} from './atlas-land-water-fixture-runner-support.mjs';
import {
  assertAppearanceRerollIsolation,
  assertEquivalentAtlasGeography,
  assertGeographyRerollIsolation,
  createCanonicalAspectDigestIndex,
  createInitialAcceptedAtlas,
  createRenderCheckpointEvidence,
  decodeAcceptedPackage,
  encodeAcceptedPackage,
  makeReopenComparison,
} from './atlas-persistence-fixture-support.mjs';
import { projectionProof } from './atlas-projection-fixture-support.mjs';
import { sceneProof } from './atlas-scene-fixture-support.mjs';
import { expectedVersions, semanticProof } from './atlas-semantic-fixture-support.mjs';

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
  const {
    assets,
    core,
    desktopGeneration,
    desktopReopen,
    desktopSupport,
    generation,
    persistence,
    render,
  } = await loadProjectModules(outputRoot);
  const includesSemantic = definition.versions.atlasSemanticPolicyVersion !== undefined;
  const includesCoastline = definition.versions.atlasCoastlineGeometryBehaviorVersion !== undefined;
  const includesProjection = definition.versions.atlasDisplayProjectionVersion !== undefined;
  const includesAppearance = definition.versions.atlasStyleBehaviorVersion !== undefined;
  const usesPersistenceEvidence = definition.fixtureDefinitionVersion === 2;
  assert.equal(includesProjection && !includesCoastline, false);
  assert.equal(includesAppearance && !includesProjection, false);

  assert.equal(fixtureId, expectedFixtureId);
  assert.equal(definition.fixtureId, fixtureId);
  assert.ok(definition.fixtureDefinitionVersion === 1 || usesPersistenceEvidence);
  assert.equal(
    definition.evidenceBoundary,
    usesPersistenceEvidence
      ? 'persistence-canonical-accepted-aspects-v1'
      : 'pre-persistence-atlas-generator-kernel-v1',
  );
  assert.equal(Object.hasOwn(definition, 'notCanonicalAspectBytes'), !usesPersistenceEvidence);
  if (!usesPersistenceEvidence) assert.equal(definition.notCanonicalAspectBytes, true);
  assert.deepEqual(
    definition.versions,
    usesPersistenceEvidence
      ? expectedVersions(
          core,
          generation,
          assets,
          render,
          persistence,
          includesSemantic,
          includesCoastline,
          includesProjection,
          includesAppearance,
        )
      : expectedVersions(
          core,
          generation,
          assets,
          render,
          undefined,
          includesSemantic,
          includesCoastline,
          includesProjection,
          includesAppearance,
        ),
  );
  assert.deepEqual(definition.stableIds, expectedStableIds(core, definition));
  const legacyVersions = withoutPersistenceVersions(definition.versions);
  const legacyDefinition = {
    ...definition,
    evidenceBoundary: 'pre-persistence-atlas-generator-kernel-v1',
    versions: legacyVersions,
  };

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
    fixtureRuntime(core, input, `${fixtureId}:preview`, previewProgress),
  );
  assert.equal(previewResult.status, 'preview');
  if (previewResult.status !== 'preview') throw new Error(JSON.stringify(previewResult));
  assertDisposablePreview(previewResult.preview);
  assertProgress(previewProgress, `${fixtureId}:preview`);

  const fullProgress = [];
  const fullResult = await generation.generateAtlasLandWaterFull(
    input,
    fixtureRuntime(core, input, `${fixtureId}:full`, fullProgress),
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
    legacyDefinition,
    records.landWaterClassification.seaLevelContourDoubledTicks,
    macroBytes,
    classificationBytes,
  );
  const sampleCounts = classificationCounts(records.landWaterClassification.samples);
  assert.ok(sampleCounts.land > 0);
  assert.ok(sampleCounts.water > 0);
  const semantic = includesSemantic
    ? semanticProof(core, generation, definition, input, records)
    : undefined;
  assert.equal(includesCoastline && semantic === undefined, false);
  const coastline =
    includesCoastline && semantic !== undefined
      ? coastlineProof(core, generation, definition, input, semantic)
      : undefined;
  const projection =
    !includesProjection || coastline === undefined
      ? undefined
      : projectionProof(render, coastline.records);
  const appearance =
    !includesAppearance || coastline === undefined || semantic === undefined
      ? undefined
      : appearanceProof(core, assets, definition, input, {
          ...semantic.records,
          coastline: coastline.records,
        });
  const scene =
    projection === undefined ||
    coastline === undefined ||
    semantic === undefined ||
    appearance === undefined
      ? undefined
      : sceneProof(
          render,
          { ...semantic.records, coastline: coastline.records },
          appearance.records,
          appearance.style,
        );
  assert.ok(semantic);
  assert.ok(coastline);
  assert.ok(appearance);
  assert.ok(scene);
  const baselineAccepted = createInitialAcceptedAtlas({
    appearance,
    coastline,
    core,
    desktopSupport,
    full: fullResult,
    input,
    scene,
    semantic,
  });
  let geographyRerolledAccepted;
  let appearanceRerolledAccepted;
  if (fixtureId === 'milestone-2-atlas-proof') {
    const geographyRerolled = await desktopGeneration.productionAtlasWorkflowGeneration.commit(
      {
        operationId: `${fixtureId}:geography-rerolled`,
        operation: 'geography-reroll',
        worldSeed: definition.worldSeed,
        controls: input.controls,
        accepted: baselineAccepted,
      },
      workflowRuntime(),
    );
    assert.equal(
      geographyRerolled.ok,
      true,
      geographyRerolled.ok ? undefined : JSON.stringify(geographyRerolled),
    );
    if (!geographyRerolled.ok) throw new Error(JSON.stringify(geographyRerolled));
    geographyRerolledAccepted = geographyRerolled.accepted;
    assertGeographyRerollIsolation(core, baselineAccepted, geographyRerolledAccepted);

    const appearanceRerolled = await desktopGeneration.productionAtlasWorkflowGeneration.commit(
      {
        operationId: `${fixtureId}:appearance-rerolled`,
        operation: 'appearance-reroll',
        worldSeed: definition.worldSeed,
        controls: input.controls,
        accepted: geographyRerolledAccepted,
      },
      workflowRuntime(),
    );
    assert.equal(
      appearanceRerolled.ok,
      true,
      appearanceRerolled.ok ? undefined : JSON.stringify(appearanceRerolled),
    );
    if (!appearanceRerolled.ok) throw new Error(JSON.stringify(appearanceRerolled));
    appearanceRerolledAccepted = appearanceRerolled.accepted;
    assertAppearanceRerollIsolation(geographyRerolledAccepted, appearanceRerolledAccepted);
  }

  const vector = {
    kernelVectorVersion: 1,
    canonicalJsonFormatting: 'prettier-json-print-width-100-v1',
    evidenceBoundary: legacyDefinition.evidenceBoundary,
    notCanonicalAspectBytes: true,
    notCanonicalAspectOutputBytes: true,
    fixtureId,
    worldSeed: definition.worldSeed,
    stableIds: definition.stableIds,
    controls: input.controls,
    versions: legacyVersions,
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
      ...(semantic === undefined ? {} : { semantic: semantic.vector }),
      ...(coastline === undefined ? {} : { coastline: coastline.vector }),
      ...(projection === undefined ? {} : { projection: projection.vector }),
      ...(appearance === undefined ? {} : { appearance: appearance.vector }),
      ...(scene === undefined ? {} : { scene: scene.vector }),
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
      ...(semantic === undefined ? {} : { semantic: semantic.invariants }),
      ...(coastline === undefined ? {} : { coastline: coastline.invariants }),
      ...(projection === undefined ? {} : { projection: projection.invariants }),
      ...(appearance === undefined ? {} : { appearance: appearance.invariants }),
      ...(scene === undefined ? {} : { scene: scene.invariants }),
    },
  };
  const canonicalBytes = Buffer.from(await formatJson(vector), 'utf8');
  const kernelArtifactPath = `fixed-seeds/${fixtureId}/expected/baseline/atlas-land-water.kernel.canonical`;
  write(outputRoot, kernelArtifactPath, canonicalBytes);
  const kernelDigest = sha256(canonicalBytes);
  const kernelArtifact = {
    path: kernelArtifactPath,
    kind: 'canonical-kernel-vector',
    checkpoint: 'baseline',
    byteLength: canonicalBytes.byteLength,
    canonicalKernelVectorSha256: kernelDigest,
    fixtureIntegritySha256: kernelDigest,
  };
  const artifacts = [kernelArtifact];
  if (!usesPersistenceEvidence) {
    await writeRenderCheckpoint(
      outputRoot,
      fixtureId,
      'baseline',
      baselineAccepted.scene,
      appearance.style,
      render,
      artifacts,
      true,
    );
    const manifest = legacyFixtureManifest({
      artifacts,
      definition,
      definitionBytes,
      fixtureId,
      reviewBytes,
      fixtureReviewRecordPath,
      semantic,
      coastline,
      appearance,
    });
    write(outputRoot, `manifests/${fixtureId}.fixture.generated.json`, await formatJson(manifest));
    return;
  }
  const acceptedIndexes = new Map();
  acceptedIndexes.set(
    'baseline',
    await writeAcceptedAspectIndex(
      outputRoot,
      fixtureId,
      'baseline',
      baselineAccepted,
      persistence,
      artifacts,
    ),
  );
  await writeRenderCheckpoint(
    outputRoot,
    fixtureId,
    'baseline',
    baselineAccepted.scene,
    appearance.style,
    render,
    artifacts,
    true,
  );

  let appearanceRender;
  let reopenedRender;
  if (geographyRerolledAccepted !== undefined && appearanceRerolledAccepted !== undefined) {
    acceptedIndexes.set(
      'geography-rerolled',
      await writeAcceptedAspectIndex(
        outputRoot,
        fixtureId,
        'geography-rerolled',
        geographyRerolledAccepted,
        persistence,
        artifacts,
      ),
    );
    await writeRenderCheckpoint(
      outputRoot,
      fixtureId,
      'geography-rerolled',
      geographyRerolledAccepted.scene,
      appearance.style,
      render,
      artifacts,
      true,
    );
    const appearanceIndex = await writeAcceptedAspectIndex(
      outputRoot,
      fixtureId,
      'appearance-rerolled',
      appearanceRerolledAccepted,
      persistence,
      artifacts,
    );
    acceptedIndexes.set('appearance-rerolled', appearanceIndex);
    appearanceRender = await writeRenderCheckpoint(
      outputRoot,
      fixtureId,
      'appearance-rerolled',
      appearanceRerolledAccepted.scene,
      appearance.style,
      render,
      artifacts,
      true,
    );

    const encodedPackage = encodeAcceptedPackage(persistence, appearanceRerolledAccepted.document);
    for (const file of encodedPackage.files) {
      const artifactPath = `saved-projects/v1/${fixtureId}/appearance-rerolled.mapworld/${file.path}`;
      write(outputRoot, artifactPath, file.bytes);
      const digest = sha256(file.bytes);
      artifacts.push({
        path: artifactPath,
        kind:
          file.path === 'manifest.json'
            ? 'saved-project-manifest'
            : 'saved-project-authoritative-file',
        checkpoint: 'appearance-rerolled',
        byteLength: file.bytes.byteLength,
        fixtureIntegritySha256: digest,
      });
    }
    const decodedDocument = decodeAcceptedPackage(persistence, encodedPackage);
    const reencodedPackage = encodeAcceptedPackage(persistence, decodedDocument);
    assert.deepEqual(reencodedPackage, encodedPackage);
    const decodedMacro = decodedDocument.maps[0]?.aspects.find(
      ({ aspectName }) => aspectName === 'worldTerrain.macroElevation',
    );
    const decodedClassification = decodedDocument.maps[0]?.aspects.find(
      ({ aspectName }) => aspectName === 'worldSurface.landWaterClassification',
    );
    assert.equal(
      core.isCompactMacroElevationSampleReader(decodedMacro?.acceptedOutput.values),
      true,
    );
    assert.equal(
      core.isCompactLandWaterSampleReader(decodedClassification?.acceptedOutput.samples),
      true,
    );
    const reopened = desktopReopen.reopenAcceptedAtlas(decodedDocument);
    assert.equal(reopened.ok, true, reopened.ok ? undefined : JSON.stringify(reopened));
    if (!reopened.ok) throw new Error(JSON.stringify(reopened));
    assert.equal(reopened.accepted.document, decodedDocument);
    assertEquivalentAtlasGeography(
      core,
      reopened.accepted.geography,
      appearanceRerolledAccepted.geography,
    );
    assert.deepEqual(reopened.accepted.appearance, appearanceRerolledAccepted.appearance);
    assert.deepEqual(reopened.accepted.scene, appearanceRerolledAccepted.scene);
    const reopenedIndex = createCanonicalAspectDigestIndex(
      persistence,
      reopened.accepted.document,
      'reopened',
    );
    reopenedRender = await writeRenderCheckpoint(
      outputRoot,
      fixtureId,
      'reopened',
      reopened.accepted.scene,
      appearance.style,
      render,
      artifacts,
      false,
    );
    const reopenComparison = makeReopenComparison({
      appearanceIndex,
      appearanceRender,
      reopenedIndex,
      reopenedRender,
    });
    const reopenBytes = Buffer.from(await formatJson(reopenComparison), 'utf8');
    const reopenPath = `fixed-seeds/${fixtureId}/expected/reopened/accepted-atlas.reopen.canonical`;
    write(outputRoot, reopenPath, reopenBytes);
    const reopenDigest = sha256(reopenBytes);
    artifacts.push({
      path: reopenPath,
      kind: 'reopen-comparison-report',
      checkpoint: 'reopened',
      byteLength: reopenBytes.byteLength,
      reopenComparisonSha256: reopenDigest,
      fixtureIntegritySha256: reopenDigest,
    });
  }
  const expectedAssertions = [
    {
      assertionId: 'runner-validates-accepted-atlas-evidence',
      operator: 'runner-pass',
      reviewPurpose:
        fixtureId === 'milestone-2-atlas-proof'
          ? 'Prove exact generation, transactional reroll isolation, persistence-owned canonical evidence, checksum-validated save, generator-free reopen, and deterministic exports.'
          : 'Prove exact generation plus persistence-owned canonical accepted aspect/output evidence for this fixed matrix row.',
    },
    ...(fixtureId === 'milestone-2-atlas-proof' ? mainWorkflowAssertions(fixtureId) : []),
  ].sort((left, right) =>
    left.assertionId < right.assertionId ? -1 : left.assertionId > right.assertionId ? 1 : 0,
  );
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
    stableIds: sortedRecord({
      ...definition.stableIds,
      ...semantic.stableIds,
      ...coastline.stableIds,
      ...appearance.stableIds,
      ...(geographyRerolledAccepted === undefined
        ? {}
        : checkpointStableIds('geographyRerolled', geographyRerolledAccepted.document)),
    }),
    versions: definition.versions,
    checkpointRevisions: definition.checkpoints,
    expectedAssertions,
    reviewPurpose:
      fixtureId === 'milestone-2-atlas-proof'
        ? 'Prove the complete accepted Milestone 2 atlas lifecycle across isolated rerolls, persistence-owned canonical state, authoritative save, generator-free reopen, scenes, SVG, and PNG.'
        : 'Prove one Milestone 2 matrix row at the persistence-owned canonical accepted aspect/output boundary while retaining its separate geometry and visual evidence.',
    reviewRecord: { path: fixtureReviewRecordPath, sha256: sha256(reviewBytes) },
    generatedRoots: [
      `canonical-svg/${fixtureId}`,
      `fixed-seeds/${fixtureId}/expected`,
      ...(fixtureId === 'milestone-2-atlas-proof' ? [`saved-projects/v1/${fixtureId}`] : []),
      `visual-gallery/${fixtureId}`,
    ],
    artifacts: artifacts.sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    ),
  };
  write(outputRoot, `manifests/${fixtureId}.fixture.generated.json`, await formatJson(manifest));
}

async function writeAcceptedAspectIndex(
  outputRoot,
  fixtureId,
  checkpoint,
  accepted,
  persistence,
  artifacts,
) {
  const index = createCanonicalAspectDigestIndex(persistence, accepted.document, checkpoint);
  const bytes = Buffer.from(await formatJson(index), 'utf8');
  const path = `fixed-seeds/${fixtureId}/expected/${checkpoint}/accepted-aspects.aspects.index.canonical`;
  write(outputRoot, path, bytes);
  const digest = sha256(bytes);
  artifacts.push({
    path,
    kind: 'canonical-aspect-digest-index',
    checkpoint,
    byteLength: bytes.byteLength,
    canonicalAspectDigestIndexSha256: digest,
    fixtureIntegritySha256: digest,
  });
  return index;
}

async function writeRenderCheckpoint(
  outputRoot,
  fixtureId,
  checkpoint,
  scene,
  style,
  render,
  artifacts,
  includeScene,
) {
  const evidence = await createRenderCheckpointEvidence({
    assertPngProgress,
    formatJson,
    includeScene,
    render,
    scene,
    style,
  });
  if (evidence.sceneBytes !== undefined) {
    const scenePath = `fixed-seeds/${fixtureId}/expected/${checkpoint}/atlas-render-scene.scene.canonical`;
    write(outputRoot, scenePath, evidence.sceneBytes);
    artifacts.push({
      path: scenePath,
      kind: 'canonical-render-scene',
      checkpoint,
      byteLength: evidence.sceneBytes.byteLength,
      canonicalSceneSha256: evidence.sceneSha256,
      fixtureIntegritySha256: evidence.sceneSha256,
    });
  }
  const svgPath = `canonical-svg/${fixtureId}/${checkpoint}.svg`;
  write(outputRoot, svgPath, evidence.svgBytes);
  artifacts.push({
    path: svgPath,
    kind: 'canonical-svg',
    checkpoint,
    byteLength: evidence.svgBytes.byteLength,
    canonicalSvgSha256: evidence.svgSha256,
    fixtureIntegritySha256: evidence.svgSha256,
  });
  const pngPath = `visual-gallery/${fixtureId}/${checkpoint}.png`;
  write(outputRoot, pngPath, evidence.pngBytes);
  artifacts.push({
    path: pngPath,
    kind: 'visual-evidence',
    checkpoint,
    byteLength: evidence.pngBytes.byteLength,
    visualEvidenceSha256: evidence.pngSha256,
    fixtureIntegritySha256: evidence.pngSha256,
    ...evidence.pngMetadata,
  });
  return evidence;
}

function workflowRuntime() {
  return Object.freeze({
    isCancellationRequested: () => false,
    reportProgress: () => {},
    yieldControl: () => Promise.resolve(),
  });
}

function withoutPersistenceVersions(versions) {
  const legacy = { ...versions };
  for (const field of [
    'acceptedAspectSchemaVersion',
    'mapDocumentSchemaVersion',
    'mapworldPackageVersion',
    'mapworldSchemaVersion',
    'worldIndexSchemaVersion',
  ]) {
    delete legacy[field];
  }
  return legacy;
}

function checkpointStableIds(prefix, document) {
  const map = document.maps[0];
  assert.ok(map);
  const entities = [...map.entities]
    .map(({ entityId }) => entityId)
    .sort()
    .map((entityId, index) => [`${prefix}EntityId${String(index).padStart(3, '0')}`, entityId]);
  const aspects = [...map.aspects]
    .map(({ aspectId }) => aspectId)
    .sort()
    .map((aspectId, index) => [`${prefix}AspectId${String(index).padStart(3, '0')}`, aspectId]);
  return Object.fromEntries([...aspects, ...entities]);
}

/** Keep already reviewed v1 rows reproducible while fixtures migrate independently to v2. */
function legacyFixtureManifest({
  artifacts,
  appearance,
  coastline,
  definition,
  definitionBytes,
  fixtureId,
  fixtureReviewRecordPath,
  reviewBytes,
  semantic,
}) {
  return {
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
    stableIds: sortedRecord({
      ...definition.stableIds,
      ...semantic.stableIds,
      ...coastline.stableIds,
      ...appearance.stableIds,
    }),
    versions: definition.versions,
    checkpointRevisions: definition.checkpoints,
    expectedAssertions: [
      {
        assertionId: 'runner-validates-full-generator-kernel',
        operator: 'runner-pass',
        reviewPurpose:
          'Prove exact geography plus independently seeded accepted appearance, bounded ink, masked decoration, paper treatment, and shared-scene backend evidence.',
      },
    ],
    reviewPurpose:
      'Prove the restrained version-1 ink style and appearance isolation over unchanged accepted atlas geography before persistence integration.',
    reviewRecord: { path: fixtureReviewRecordPath, sha256: sha256(reviewBytes) },
    generatedRoots: [
      `canonical-svg/${fixtureId}`,
      `fixed-seeds/${fixtureId}/expected`,
      `visual-gallery/${fixtureId}`,
    ],
    artifacts: artifacts.sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    ),
  };
}

function mainWorkflowAssertions(fixtureId) {
  const expected = (checkpoint) =>
    `fixed-seeds/${fixtureId}/expected/${checkpoint}/accepted-aspects.aspects.index.canonical`;
  const svg = (checkpoint) => `canonical-svg/${fixtureId}/${checkpoint}.svg`;
  const png = (checkpoint) => `visual-gallery/${fixtureId}/${checkpoint}.png`;
  return [
    {
      assertionId: 'appearance-reroll-changes-accepted-set',
      operator: 'bytes-not-equal',
      leftArtifactPath: expected('geography-rerolled'),
      rightArtifactPath: expected('appearance-rerolled'),
      reviewPurpose: 'Prove the appearance transaction changes complete accepted aspect bytes.',
    },
    {
      assertionId: 'appearance-reroll-changes-png',
      operator: 'bytes-not-equal',
      leftArtifactPath: png('geography-rerolled'),
      rightArtifactPath: png('appearance-rerolled'),
      reviewPurpose: 'Prove the appearance reroll is visible in deterministic raster output.',
    },
    {
      assertionId: 'appearance-reroll-changes-svg',
      operator: 'bytes-not-equal',
      leftArtifactPath: svg('geography-rerolled'),
      rightArtifactPath: svg('appearance-rerolled'),
      reviewPurpose: 'Prove the appearance reroll is visible in canonical vector output.',
    },
    {
      assertionId: 'geography-reroll-changes-accepted-set',
      operator: 'bytes-not-equal',
      leftArtifactPath: expected('baseline'),
      rightArtifactPath: expected('geography-rerolled'),
      reviewPurpose: 'Prove the geography transaction changes complete accepted aspect bytes.',
    },
    {
      assertionId: 'reopen-preserves-png',
      operator: 'bytes-equal',
      leftArtifactPath: png('appearance-rerolled'),
      rightArtifactPath: png('reopened'),
      reviewPurpose: 'Prove checksum-validated generator-free reopen has no PNG drift.',
    },
    {
      assertionId: 'reopen-preserves-svg',
      operator: 'bytes-equal',
      leftArtifactPath: svg('appearance-rerolled'),
      rightArtifactPath: svg('reopened'),
      reviewPurpose: 'Prove checksum-validated generator-free reopen has no SVG drift.',
    },
  ];
}
