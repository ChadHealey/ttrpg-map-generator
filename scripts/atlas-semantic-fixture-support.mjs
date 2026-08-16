import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export function expectedVersions(
  core,
  generation,
  render,
  includesSemantic,
  includesCoastline = false,
  includesProjection = false,
) {
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
    ...(includesSemantic
      ? {
          atlasSemanticClassificationVersion: core.ATLAS_SEMANTIC_CLASSIFICATION_VERSION,
          atlasSemanticGeneratorManifestVersion:
            generation.ATLAS_SEMANTIC_GENERATOR_MANIFEST_VERSION,
          atlasSemanticParameterSchemaVersion: generation.ATLAS_SEMANTIC_PARAMETER_SCHEMA_VERSION,
          atlasSemanticPolicyVersion: generation.ATLAS_SEMANTIC_POLICY_VERSION,
        }
      : {}),
    ...(includesCoastline
      ? {
          atlasCoastlineExtractionAlgorithmVersion:
            core.ATLAS_COASTLINE_EXTRACTION_ALGORITHM_VERSION,
          atlasCoastlineGeneratorManifestVersion:
            generation.ATLAS_COASTLINE_GENERATOR_MANIFEST_VERSION,
          atlasCoastlineGeometryBehaviorVersion: core.ATLAS_COASTLINE_GEOMETRY_BEHAVIOR_VERSION,
          atlasCoastlineParameterSchemaVersion: generation.ATLAS_COASTLINE_PARAMETER_SCHEMA_VERSION,
          atlasCoastlineSimplificationPolicyVersion:
            core.ATLAS_COASTLINE_SIMPLIFICATION_POLICY_VERSION,
          atlasCoastlineTopologyValidationVersion: core.ATLAS_COASTLINE_TOPOLOGY_VALIDATION_VERSION,
        }
      : {}),
    ...(includesProjection
      ? {
          atlasDisplayProjectionVersion: render.ATLAS_DISPLAY_PROJECTION_VERSION,
          atlasDisplaySeamPolicyVersion: render.ATLAS_DISPLAY_SEAM_POLICY_VERSION,
          atlasSceneCompositionVersion: render.ATLAS_SCENE_COMPOSITION_VERSION,
        }
      : {}),
  };
}

export function semanticProof(core, generation, definition, input, records) {
  const result = generation.generateAtlasSemanticGeography({
    worldSeed: input.worldSeed,
    worldMapId: input.worldMapId,
    worldSurfaceEntityId: input.worldSurfaceEntityId,
    landWaterClassificationAspectId: input.landWaterClassificationAspectId,
    records,
    previousAcceptedAspects: [],
  });
  assert.equal(result.status, 'proposed');
  if (result.status !== 'proposed') throw new Error(JSON.stringify(result.diagnostics));
  assert.deepEqual(core.validateAtlasSemanticGeographyRecords(result.patch.records), { ok: true });
  assert.deepEqual(result.patch.explicitlyIncrementedAspectIds, []);
  assert.equal(
    result.patch.replacements.every(({ target }) => target.variantRevision === 0),
    true,
  );
  assertSemanticFixturePurpose(definition.fixtureId, result.patch.records);
  const semanticRecords = {
    semanticClassificationVersion: result.patch.records.semanticClassificationVersion,
    worldMapId: result.patch.records.worldMapId,
    worldSurfaceEntityId: result.patch.records.worldSurfaceEntityId,
    landWaterClassificationAspectId: result.patch.records.landWaterClassificationAspectId,
    landmasses: result.patch.records.landmasses,
    islandGroups: result.patch.records.islandGroups,
    waterBodies: result.patch.records.waterBodies,
  };
  const ownedSampleCount = [...semanticRecords.landmasses, ...semanticRecords.waterBodies].reduce(
    (total, entity) => total + entity.membership.sampleCount,
    0,
  );
  assert.equal(ownedSampleCount, records.landWaterClassification.samples.length);
  const semanticEntityIds = [
    ...semanticRecords.landmasses.map(({ entityId }) => entityId),
    ...semanticRecords.islandGroups.map(({ entityId }) => entityId),
    ...semanticRecords.waterBodies.map(({ entityId }) => entityId),
  ].sort(compareText);
  const semanticAspectIds = result.patch.replacements
    .map(({ target }) => target.aspect.aspectId)
    .sort(compareText);
  const surfaceComponentIds = [
    ...semanticRecords.landmasses.map(({ componentId }) => componentId),
    ...semanticRecords.waterBodies.map(({ componentId }) => componentId),
  ].sort(compareText);
  return {
    records: result.patch.records,
    replacements: result.patch.replacements,
    stableIds: {
      ...indexedStableIds('semanticAspectId', semanticAspectIds),
      ...indexedStableIds('semanticEntityId', semanticEntityIds),
      ...indexedStableIds('surfaceComponentId', surfaceComponentIds),
    },
    vector: {
      semanticClassificationVersion: core.ATLAS_SEMANTIC_CLASSIFICATION_VERSION,
      semanticPolicyVersion: generation.ATLAS_SEMANTIC_POLICY_VERSION,
      semanticParameterSchemaVersion: generation.ATLAS_SEMANTIC_PARAMETER_SCHEMA_VERSION,
      replacementAspectNames: result.patch.replacements.map(({ target }) => target.aspectName),
      removedAspectIds: result.patch.removedAspectIds,
      explicitlyIncrementedAspectIds: result.patch.explicitlyIncrementedAspectIds,
      kindCounts: countKinds(semanticRecords),
      semanticPrimitiveTraversalSha256: hashCanonicalPrimitiveTraversal(semanticRecords),
    },
    invariants: {
      exactOwnedSampleCount: ownedSampleCount,
      landmassCount: semanticRecords.landmasses.length,
      islandGroupCount: semanticRecords.islandGroups.length,
      waterBodyCount: semanticRecords.waterBodies.length,
      stableEntityOrder: isStrictlyOrdered(semanticEntityIds),
      stableAspectOrder: isStrictlyOrdered(semanticAspectIds),
      validatedSemanticRecords: true,
    },
  };
}

function indexedStableIds(prefix, values) {
  return Object.fromEntries(
    values.map((value, index) => [`${prefix}${String(index).padStart(3, '0')}`, value]),
  );
}

function assertSemanticFixturePurpose(fixtureId, records) {
  if (fixtureId === 'milestone-2-atlas-fragmented-islands') {
    assert.ok(records.landmasses.some(({ kind }) => kind === 'majorIsland'));
    assert.ok(records.landmasses.some(({ kind }) => kind === 'island'));
    assert.deepEqual(records.islandGroups.map(({ kind }) => kind).sort(compareText), [
      'archipelago',
      'islandChain',
    ]);
  }
  if (fixtureId === 'milestone-2-atlas-control-max') {
    assert.ok(records.waterBodies.filter(({ kind }) => kind === 'oceanBasin').length >= 2);
  }
  if (fixtureId === 'milestone-2-atlas-control-min') {
    assert.equal(records.landmasses.filter(({ kind }) => kind === 'continent').length, 1);
  }
  if (fixtureId === 'milestone-2-atlas-seam-crossing') {
    assert.ok(records.landmasses.some((landmass) => membershipCrossesSeam(landmass.membership)));
  }
}

function membershipCrossesSeam(membership) {
  for (let latitudeIndex = 1; latitudeIndex < 1_024; latitudeIndex += 1) {
    const west = 1 + (latitudeIndex - 1) * 2_048;
    const east = west + 2_047;
    if (ownsSample(membership.sampleRanges, west) && ownsSample(membership.sampleRanges, east)) {
      return true;
    }
  }
  return false;
}

function ownsSample(ranges, index) {
  return ranges.some(
    ({ startIndex, endIndexExclusive }) => index >= startIndex && index < endIndexExclusive,
  );
}

function countKinds(records) {
  const count = (values, kind) => values.filter((value) => value.kind === kind).length;
  return {
    continent: count(records.landmasses, 'continent'),
    majorIsland: count(records.landmasses, 'majorIsland'),
    island: count(records.landmasses, 'island'),
    islandChain: count(records.islandGroups, 'islandChain'),
    archipelago: count(records.islandGroups, 'archipelago'),
    oceanBasin: count(records.waterBodies, 'oceanBasin'),
    marginalSea: records.waterBodies.filter(
      ({ kind, enclosure }) => kind === 'sea' && enclosure === 'open-marine',
    ).length,
    enclosedSea: records.waterBodies.filter(
      ({ kind, enclosure }) => kind === 'sea' && enclosure === 'enclosed',
    ).length,
  };
}

function hashCanonicalPrimitiveTraversal(value) {
  const hash = createHash('sha256');
  hash.update('ttrpg-map/atlas-semantic-geography/v1\0');
  updateCanonicalPrimitiveHash(hash, value);
  return hash.digest('hex');
}

function updateCanonicalPrimitiveHash(hash, value) {
  if (value === null) {
    hash.update('n;');
    return;
  }
  if (Array.isArray(value)) {
    hash.update(`a${String(value.length)}[`);
    for (const item of value) updateCanonicalPrimitiveHash(hash, item);
    hash.update(']');
    return;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort(compareText);
    hash.update(`o${String(keys.length)}{`);
    for (const key of keys) {
      updateCanonicalPrimitiveHash(hash, key);
      updateCanonicalPrimitiveHash(hash, value[key]);
    }
    hash.update('}');
    return;
  }
  const encoded = JSON.stringify(value);
  hash.update(`${typeof value}:${String(encoded.length)}:${encoded};`);
}

function isStrictlyOrdered(values) {
  return values.every((value, index) => index === 0 || values[index - 1] < value);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
