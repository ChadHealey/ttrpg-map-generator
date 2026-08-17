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
  const { assets, core, generation, render } = await loadProjectModules(outputRoot);
  const includesSemantic = definition.versions.atlasSemanticPolicyVersion !== undefined;
  const includesCoastline = definition.versions.atlasCoastlineGeometryBehaviorVersion !== undefined;
  const includesProjection = definition.versions.atlasDisplayProjectionVersion !== undefined;
  const includesAppearance = definition.versions.atlasStyleBehaviorVersion !== undefined;
  assert.equal(includesProjection && !includesCoastline, false);
  assert.equal(includesAppearance && !includesProjection, false);

  assert.equal(fixtureId, expectedFixtureId);
  assert.equal(definition.fixtureId, fixtureId);
  assert.equal(definition.fixtureDefinitionVersion, 1);
  assert.equal(definition.evidenceBoundary, 'pre-persistence-atlas-generator-kernel-v1');
  assert.equal(definition.notCanonicalAspectBytes, true);
  assert.deepEqual(
    definition.versions,
    expectedVersions(
      core,
      generation,
      assets,
      render,
      includesSemantic,
      includesCoastline,
      includesProjection,
      includesAppearance,
    ),
  );
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
    definition,
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
  const sceneArtifacts = [];
  if (scene !== undefined) {
    const sceneBytes = Buffer.from(await formatJson(scene.scene), 'utf8');
    const sceneArtifactPath = `fixed-seeds/${fixtureId}/expected/baseline/atlas-render-scene.scene.canonical`;
    write(outputRoot, sceneArtifactPath, sceneBytes);
    const sceneDigest = sha256(sceneBytes);
    const svgBytes = Buffer.from(scene.svg, 'utf8');
    const svgArtifactPath = `canonical-svg/${fixtureId}/baseline.svg`;
    write(outputRoot, svgArtifactPath, svgBytes);
    const svgDigest = sha256(svgBytes);
    sceneArtifacts.push(
      {
        path: svgArtifactPath,
        kind: 'canonical-svg',
        checkpoint: 'baseline',
        byteLength: svgBytes.byteLength,
        canonicalSvgSha256: svgDigest,
        fixtureIntegritySha256: svgDigest,
      },
      {
        path: sceneArtifactPath,
        kind: 'canonical-render-scene',
        checkpoint: 'baseline',
        byteLength: sceneBytes.byteLength,
        canonicalSceneSha256: sceneDigest,
        fixtureIntegritySha256: sceneDigest,
      },
    );
    const pngProgress = [];
    const png = await render.exportAtlasSceneToPngAsync(
      {
        scene: scene.scene,
        style: appearance.style,
        dimensions: { widthPx: 1_600, heightPx: 800 },
      },
      {
        isCancellationRequested: () => false,
        reportProgress: (value) => pngProgress.push(value),
        yieldControl: () => Promise.resolve(),
      },
    );
    assert.equal(png.ok, true, png.ok ? undefined : JSON.stringify(png.diagnostics));
    if (!png.ok) throw new Error(JSON.stringify(png.diagnostics));
    assertPngProgress(render, pngProgress);
    assert.deepEqual(
      {
        profileId: png.value.profileId,
        profileVersion: png.value.profileVersion,
        widthPx: png.value.widthPx,
        heightPx: png.value.heightPx,
        hasFullSizeRasterSurface: png.value.resources.hasFullSizeRasterSurface,
        maximumLiveBands: png.value.resources.maximumLiveBands,
      },
      {
        profileId: 'atlas-png-v1',
        profileVersion: 1,
        widthPx: 1_600,
        heightPx: 800,
        hasFullSizeRasterSurface: false,
        maximumLiveBands: 1,
      },
    );
    const pngBytes = png.value.bytes;
    const pngArtifactPath = `visual-gallery/${fixtureId}/baseline.png`;
    write(outputRoot, pngArtifactPath, pngBytes);
    const pngDigest = sha256(pngBytes);
    sceneArtifacts.push({
      path: pngArtifactPath,
      kind: 'visual-evidence',
      checkpoint: 'baseline',
      byteLength: pngBytes.byteLength,
      visualEvidenceSha256: pngDigest,
      fixtureIntegritySha256: pngDigest,
      pngProfileId: png.value.profileId,
      pngProfileVersion: png.value.profileVersion,
      widthPx: png.value.widthPx,
      heightPx: png.value.heightPx,
      bitDepth: render.ATLAS_PNG_COLOR_PROFILE.bitDepth,
      colorType: render.ATLAS_PNG_COLOR_PROFILE.colorType,
      srgbRenderingIntent: render.ATLAS_PNG_COLOR_PROFILE.renderingIntent,
      bandCoreHeightPx: render.ATLAS_PNG_TILE_POLICY.coreHeightPx,
      bandHaloPx: render.ATLAS_PNG_TILE_POLICY.haloPx,
      idatChunkBytes: render.ATLAS_PNG_ENCODING_POLICY.idatChunkBytes,
    });
  }
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
    stableIds:
      semantic === undefined
        ? definition.stableIds
        : sortedRecord({
            ...definition.stableIds,
            ...semantic.stableIds,
            ...(coastline === undefined ? {} : coastline.stableIds),
            ...(appearance === undefined ? {} : appearance.stableIds),
          }),
    versions: definition.versions,
    checkpointRevisions: definition.checkpoints,
    expectedAssertions: [
      {
        assertionId: 'runner-validates-full-generator-kernel',
        operator: 'runner-pass',
        reviewPurpose:
          semantic === undefined
            ? 'Prove exact full-profile generation, output validation, nesting, seam/pole behavior, progress, and declared realization tolerances.'
            : coastline === undefined
              ? 'Prove exact full-profile generation plus stable semantic classification, ownership, connectivity, containment, identity, and ordering.'
              : appearance === undefined
                ? 'Prove exact full-profile generation, semantic classification, source-linked canonical coastline geometry, simplification, topology, identity, ordering, deterministic seam-safe display projection, and cache-free atlas scene composition.'
                : 'Prove exact geography plus independently seeded accepted appearance, bounded ink, masked decoration, paper treatment, and shared-scene backend evidence.',
      },
    ],
    reviewPurpose:
      semantic === undefined
        ? 'Prove the version-1 atlas macro-elevation and land/water generator for one fixed seed/control row before accepted-aspect persistence integration.'
        : coastline === undefined
          ? 'Prove the version-1 atlas field, partition, and semantic geography generator for one fixed seed/control row before accepted-aspect persistence integration.'
          : appearance === undefined
            ? 'Prove the version-1 atlas field, partition, semantic geography, canonical coastline generator, disposable display projection, and renderer-neutral atlas scene for one fixed seed/control row before accepted-aspect persistence integration.'
            : 'Prove the restrained version-1 ink style and appearance isolation over unchanged accepted atlas geography before persistence integration.',
    reviewRecord: { path: fixtureReviewRecordPath, sha256: sha256(reviewBytes) },
    generatedRoots:
      scene === undefined
        ? [`fixed-seeds/${fixtureId}/expected`]
        : [
            `canonical-svg/${fixtureId}`,
            `fixed-seeds/${fixtureId}/expected`,
            `visual-gallery/${fixtureId}`,
          ],
    artifacts: [...sceneArtifacts, kernelArtifact].sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    ),
  };
  write(outputRoot, `manifests/${fixtureId}.fixture.generated.json`, await formatJson(manifest));
}
