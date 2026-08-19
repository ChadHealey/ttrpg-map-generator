import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export function createInitialAcceptedAtlas({
  appearance,
  coastline,
  core,
  desktopSupport,
  full,
  input,
  scene,
  semantic,
}) {
  const singletonIds = core.deriveAtlasSingletonEntityIds(input.worldMapId);
  const geography = Object.freeze({ ...semantic.records, coastline: coastline.records });
  const document = desktopSupport.createAtlasShell(input.worldSeed, input.controls);
  const proposedAspects = Object.freeze([
    ...full.patch.replacements,
    ...semantic.replacements,
    coastline.replacement,
    ...appearance.replacements.map(desktopSupport.appearanceProposal),
  ]);
  const transaction = core.commitAtlasProposal(document, {
    kind: core.ATLAS_DOCUMENT_COMMAND_KIND,
    operationMode: desktopSupport.operationMode('initial-atlas'),
    targetMapId: input.worldMapId,
    expectedWorldSeed: document.worldSeed,
    expectedAspectRevisions: Object.freeze([]),
    controls: input.controls,
    proposedCoordinateSystem: Object.freeze({
      kind: 'planet-sphere',
      rootSurfaceId: desktopSupport.ATLAS_PROOF_ROOT_SURFACE_ID,
      radius: desktopSupport.requiredAtlasRadius(input.controls.worldCircumferenceKm),
    }),
    proposedEntities: desktopSupport.atlasEntities(singletonIds, geography),
    proposedAspects,
    explicitlyIncrementedAspectIds: Object.freeze([]),
  });
  assert.equal(transaction.ok, true, transaction.ok ? undefined : JSON.stringify(transaction));
  if (!transaction.ok) throw new Error(JSON.stringify(transaction.diagnostics));
  return Object.freeze({
    document: transaction.document,
    geography,
    appearance: appearance.records,
    scene: scene.scene,
  });
}

export function createCanonicalAspectDigestIndex(persistence, document, checkpoint) {
  const map = document.maps[0];
  assert.ok(map);
  const aspects = [...map.aspects].sort(compareByAspectId).map((aspect) => {
    const aspectBytes = requiredPersistenceValue(persistence.canonicalAspectBytes(aspect));
    const outputBytes = requiredPersistenceValue(persistence.canonicalAspectOutputBytes(aspect));
    return {
      aspectId: aspect.aspectId,
      aspectName: aspect.aspectName,
      variantRevision: aspect.variantRevision,
      canonicalAspectByteLength: aspectBytes.byteLength,
      canonicalAspectSha256: sha256(aspectBytes),
      canonicalAspectOutputByteLength: outputBytes.byteLength,
      canonicalAspectOutputSha256: sha256(outputBytes),
    };
  });
  assert.ok(aspects.length > 0);
  return {
    canonicalAspectDigestIndexVersion: 1,
    canonicalByteOwner: '@ttrpg-map/persistence',
    checkpoint,
    aspectCount: aspects.length,
    canonicalAspectSetSha256: digestEntrySet(
      aspects.map(({ aspectId, canonicalAspectByteLength, canonicalAspectSha256 }) => ({
        aspectId,
        byteLength: canonicalAspectByteLength,
        sha256: canonicalAspectSha256,
      })),
    ),
    canonicalAspectOutputSetSha256: digestEntrySet(
      aspects.map(({ aspectId, canonicalAspectOutputByteLength, canonicalAspectOutputSha256 }) => ({
        aspectId,
        byteLength: canonicalAspectOutputByteLength,
        sha256: canonicalAspectOutputSha256,
      })),
    ),
    aspects,
  };
}

export async function createRenderCheckpointEvidence({
  assertPngProgress,
  formatJson,
  includeScene,
  render,
  scene,
  style,
}) {
  const svg = render.exportAtlasSceneToSvg({ scene, style });
  assert.equal(svg.ok, true, svg.ok ? undefined : JSON.stringify(svg.diagnostics));
  if (!svg.ok) throw new Error(JSON.stringify(svg.diagnostics));
  const pngProgress = [];
  const png = await render.exportAtlasSceneToPngAsync(
    { scene, style, dimensions: { widthPx: 1_600, heightPx: 800 } },
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
  const sceneBytes = includeScene ? Buffer.from(await formatJson(scene), 'utf8') : undefined;
  const svgBytes = Buffer.from(svg.value.svg, 'utf8');
  const pngBytes = Buffer.from(png.value.bytes);
  return {
    sceneBytes,
    svgBytes,
    pngBytes,
    sceneSha256:
      sceneBytes === undefined ? sha256(Buffer.from(await formatJson(scene))) : sha256(sceneBytes),
    svgSha256: sha256(svgBytes),
    pngSha256: sha256(pngBytes),
    pngMetadata: {
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
    },
  };
}

export function encodeAcceptedPackage(persistence, document) {
  return requiredPersistenceValue(persistence.encodeMapworld(document));
}

export function decodeAcceptedPackage(persistence, packageValue) {
  return requiredPersistenceValue(persistence.decodeMapworld(packageValue));
}

export function assertGeographyRerollIsolation(core, baseline, geographyRerolled) {
  const baselineById = aspectsById(baseline.document);
  const rerolledById = aspectsById(geographyRerolled.document);
  assertDocumentEnvelopeUnchanged(baseline.document, geographyRerolled.document, false);
  assert.deepEqual(
    controlParameterSnapshot(geographyRerolled.document),
    controlParameterSnapshot(baseline.document),
  );
  for (const aspectName of [
    'atlas.coastlineAppearance',
    'atlas.paperTreatment',
    'atlas.waterDecoration',
  ]) {
    const before = aspectByName(baseline.document, aspectName);
    const after = aspectByName(geographyRerolled.document, aspectName);
    assert.deepEqual(stableAspectContract(after), stableAspectContract(before));
  }
  assert.deepEqual(
    aspectByName(geographyRerolled.document, 'atlas.paperTreatment'),
    aspectByName(baseline.document, 'atlas.paperTreatment'),
  );
  assert.equal(
    aspectByName(geographyRerolled.document, 'worldTerrain.macroElevation').variantRevision,
    1,
  );
  assert.equal(
    core.atlasSampleReadersEqual(
      aspectByName(geographyRerolled.document, 'worldTerrain.macroElevation').acceptedOutput.values,
      aspectByName(baseline.document, 'worldTerrain.macroElevation').acceptedOutput.values,
    ),
    false,
  );
  assert.equal(baseline.document.worldSeed, geographyRerolled.document.worldSeed);
  assert.deepEqual(
    aspectByName(baseline.document, 'worldTerrain.macroElevation').parameters,
    aspectByName(geographyRerolled.document, 'worldTerrain.macroElevation').parameters,
  );
  assert.deepEqual(
    baseline.document.maps[0].coordinateSystem,
    geographyRerolled.document.maps[0].coordinateSystem,
  );
  for (const [aspectId, before] of baselineById) {
    const after = rerolledById.get(aspectId);
    if (after === undefined || before.aspectName === 'worldTerrain.macroElevation') continue;
    assert.equal(after.aspectId, before.aspectId);
    assert.equal(after.variantRevision, before.variantRevision);
  }
  assert.ok(baselineById.size > 0 && rerolledById.size > 0);
}

export function assertAppearanceRerollIsolation(geographyRerolled, appearanceRerolled) {
  const previousById = aspectsById(geographyRerolled.document);
  const rerolledById = aspectsById(appearanceRerolled.document);
  assertDocumentEnvelopeUnchanged(geographyRerolled.document, appearanceRerolled.document, true);
  assert.deepEqual(
    controlParameterSnapshot(appearanceRerolled.document),
    controlParameterSnapshot(geographyRerolled.document),
  );
  assert.deepEqual([...rerolledById.keys()].sort(), [...previousById.keys()].sort());
  for (const [aspectId, aspect] of previousById) {
    if (aspect.aspectName.startsWith('atlas.')) continue;
    assert.deepEqual(rerolledById.get(aspectId), aspect);
  }
  for (const aspectName of [
    'atlas.coastlineAppearance',
    'atlas.paperTreatment',
    'atlas.waterDecoration',
  ]) {
    const before = aspectByName(geographyRerolled.document, aspectName);
    const after = aspectByName(appearanceRerolled.document, aspectName);
    assert.deepEqual(
      {
        ...stableAspectContract(after),
        seedMetadata: undefined,
        variantRevision: undefined,
      },
      {
        ...stableAspectContract(before),
        seedMetadata: undefined,
        variantRevision: undefined,
      },
    );
    assert.equal(after.aspectId, before.aspectId);
    assert.equal(after.variantRevision, 1);
    assert.notDeepEqual(after.acceptedOutput, before.acceptedOutput);
  }
  assert.equal(appearanceRerolled.geography, geographyRerolled.geography);
}

export function assertEquivalentAtlasGeography(core, actual, expected) {
  assert.equal(
    core.atlasSampleReadersEqual(actual.macroElevation.values, expected.macroElevation.values),
    true,
  );
  assert.equal(
    core.atlasSampleReadersEqual(
      actual.landWaterClassification.samples,
      expected.landWaterClassification.samples,
    ),
    true,
  );
  assert.deepEqual(
    {
      ...actual,
      macroElevation: { ...actual.macroElevation, values: '<compact>' },
      landWaterClassification: {
        ...actual.landWaterClassification,
        samples: '<compact>',
      },
    },
    {
      ...expected,
      macroElevation: { ...expected.macroElevation, values: '<compact>' },
      landWaterClassification: {
        ...expected.landWaterClassification,
        samples: '<compact>',
      },
    },
  );
}

function assertDocumentEnvelopeUnchanged(beforeDocument, afterDocument, includeEntities) {
  const beforeWorld = { ...beforeDocument };
  const afterWorld = { ...afterDocument };
  delete beforeWorld.maps;
  delete afterWorld.maps;
  assert.deepEqual(afterWorld, beforeWorld);
  assert.equal(afterDocument.maps.length, beforeDocument.maps.length);
  for (const [index, beforeMap] of beforeDocument.maps.entries()) {
    const afterMap = afterDocument.maps[index];
    assert.ok(afterMap);
    const beforeEnvelope = { ...beforeMap };
    const afterEnvelope = { ...afterMap };
    delete beforeEnvelope.aspects;
    delete beforeEnvelope.entities;
    delete afterEnvelope.aspects;
    delete afterEnvelope.entities;
    assert.deepEqual(afterEnvelope, beforeEnvelope);
    if (includeEntities) assert.deepEqual(afterMap.entities, beforeMap.entities);
  }
}

function controlParameterSnapshot(document) {
  return {
    macroElevation: aspectByName(document, 'worldTerrain.macroElevation').parameters,
    landWaterClassification: aspectByName(document, 'worldSurface.landWaterClassification')
      .parameters,
  };
}

function stableAspectContract(aspect) {
  return {
    status: aspect.status,
    aspectId: aspect.aspectId,
    mapId: aspect.mapId,
    entityId: aspect.entityId,
    aspectName: aspect.aspectName,
    variantRevision: aspect.variantRevision,
    generatorId: aspect.generatorId,
    generatorVersion: aspect.generatorVersion,
    parameterSchemaVersion: aspect.parameterSchemaVersion,
    parameters: aspect.parameters,
    seedScope: aspect.seedScope,
    seedMetadata: aspect.seedMetadata,
  };
}

export function makeReopenComparison({
  appearanceIndex,
  appearanceRender,
  reopenedIndex,
  reopenedRender,
}) {
  assert.deepEqual(reopenedIndex.aspects, appearanceIndex.aspects);
  assert.equal(reopenedIndex.canonicalAspectSetSha256, appearanceIndex.canonicalAspectSetSha256);
  assert.equal(
    reopenedIndex.canonicalAspectOutputSetSha256,
    appearanceIndex.canonicalAspectOutputSetSha256,
  );
  assert.equal(reopenedRender.sceneSha256, appearanceRender.sceneSha256);
  assert.equal(reopenedRender.svgSha256, appearanceRender.svgSha256);
  assert.equal(reopenedRender.pngSha256, appearanceRender.pngSha256);
  return {
    reopenComparisonVersion: 1,
    sourceCheckpoint: 'appearance-rerolled',
    checkpoint: 'reopened',
    generatorInvocationCount: 0,
    packageChecksumsValidated: true,
    acceptedRecordsEqual: true,
    canonicalAspectSetsEqual: true,
    canonicalAspectOutputSetsEqual: true,
    sceneSemanticsEqual: true,
    canonicalSvgEqual: true,
    deterministicPngEqual: true,
    canonicalAspectSetSha256: reopenedIndex.canonicalAspectSetSha256,
    canonicalAspectOutputSetSha256: reopenedIndex.canonicalAspectOutputSetSha256,
    sceneSha256: reopenedRender.sceneSha256,
    canonicalSvgSha256: reopenedRender.svgSha256,
    deterministicPngSha256: reopenedRender.pngSha256,
  };
}

function aspectByName(document, aspectName) {
  const aspect = document.maps[0]?.aspects.find((candidate) => candidate.aspectName === aspectName);
  assert.ok(aspect, `Missing accepted aspect ${aspectName}.`);
  return aspect;
}

function aspectsById(document) {
  return new Map((document.maps[0]?.aspects ?? []).map((aspect) => [aspect.aspectId, aspect]));
}

function requiredPersistenceValue(result) {
  assert.equal(result.ok, true, result.ok ? undefined : JSON.stringify(result.diagnostics));
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function digestEntrySet(entries) {
  return sha256(Buffer.from(JSON.stringify(entries), 'utf8'));
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function compareByAspectId(left, right) {
  return left.aspectId < right.aspectId ? -1 : left.aspectId > right.aspectId ? 1 : 0;
}
