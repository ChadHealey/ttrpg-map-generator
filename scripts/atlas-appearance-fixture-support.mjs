import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export function appearanceProof(core, assets, definition, input, records) {
  const sourceSnapshot = sourceSnapshotOf(records);
  const baselineInput = appearanceInput(core, definition, input, records, 'initial-appearance', 0);
  const baselineResult = assets.generateAtlasAppearance(
    baselineInput,
    appearanceRuntime(core, assets, baselineInput),
  );
  const rebuiltResult = assets.generateAtlasAppearance(
    baselineInput,
    appearanceRuntime(core, assets, baselineInput),
  );
  const rerollInput = appearanceInput(core, definition, input, records, 'appearance-reroll', 1);
  const rerolledResult = assets.generateAtlasAppearance(
    rerollInput,
    appearanceRuntime(core, assets, rerollInput),
  );
  for (const result of [baselineResult, rebuiltResult, rerolledResult]) {
    assert.equal(result.status, 'proposed');
    if (result.status !== 'proposed') throw new Error(JSON.stringify(result.diagnostics));
  }
  if (
    baselineResult.status !== 'proposed' ||
    rebuiltResult.status !== 'proposed' ||
    rerolledResult.status !== 'proposed'
  ) {
    throw new Error('Atlas appearance proof requires three valid proposals.');
  }

  const baseline = baselineResult.patch;
  const rerolled = rerolledResult.patch;
  assert.deepEqual(rebuiltResult.patch, baseline);
  assert.deepEqual(sourceSnapshotOf(records), sourceSnapshot);
  assert.notDeepEqual(
    rerolled.appearance.coastlineAppearance,
    baseline.appearance.coastlineAppearance,
  );
  assert.notDeepEqual(rerolled.appearance.waterDecoration, baseline.appearance.waterDecoration);
  assert.notDeepEqual(rerolled.appearance.paperTreatment, baseline.appearance.paperTreatment);
  assert.equal(rerolled.explicitlyIncrementedAspectIds.length, 3);
  assert.equal(
    baseline.replacements.every(
      ({ seedMetadata }) => seedMetadata.entityId === baseline.appearance.atlasPresentationEntityId,
    ),
    true,
  );
  assert.equal(
    new Set(baseline.replacements.map(({ seedMetadata }) => seedMetadata.generatorId)).size,
    3,
  );
  const paths = baseline.appearance.waterDecoration.paths;
  assert.ok(paths.some(({ kind }) => kind === 'coastal-echo'));
  assert.ok(paths.some(({ kind }) => kind === 'water-mark'));
  assertDecorationSafety(core, records, paths);

  return {
    records: baseline.appearance,
    style: assets.RESTRAINED_INK_ATLAS_STYLE,
    stableIds: {
      atlasPresentationEntityId: baseline.appearance.atlasPresentationEntityId,
      coastlineAppearanceAspectId: aspectIdFor(baseline, 'atlas.coastlineAppearance'),
      paperTreatmentAspectId: aspectIdFor(baseline, 'atlas.paperTreatment'),
      waterDecorationAspectId: aspectIdFor(baseline, 'atlas.waterDecoration'),
    },
    vector: {
      generatorManifestVersion: assets.ATLAS_APPEARANCE_GENERATOR_MANIFEST_VERSION,
      parameterSchemaVersion: assets.ATLAS_APPEARANCE_PARAMETER_SCHEMA_VERSION,
      styleId: assets.RESTRAINED_INK_ATLAS_STYLE.styleId,
      styleBehaviorVersion: assets.RESTRAINED_INK_ATLAS_STYLE.styleBehaviorVersion,
      styleTokenVersion: assets.RESTRAINED_INK_ATLAS_STYLE.tokenVersion,
      ringDecisionCount: baseline.appearance.coastlineAppearance.ringDecisions.length,
      coastalEchoCount: paths.filter(({ kind }) => kind === 'coastal-echo').length,
      waterMarkCount: paths.filter(({ kind }) => kind === 'water-mark').length,
      paperGrainDensityPermille: baseline.appearance.paperTreatment.grainDensityPermille,
      appearancePrimitiveTraversalSha256: hashCanonicalPrimitiveTraversal(baseline.appearance),
      rerolledAppearancePrimitiveTraversalSha256: hashCanonicalPrimitiveTraversal(
        rerolled.appearance,
      ),
    },
    invariants: {
      acceptedSourceUnchanged: true,
      deterministicRebuildEqual: true,
      independentAspectSeeds: true,
      appearanceRerollChangesAllThreeOutputs: true,
      appearanceRerollPreservesGeography: true,
      planetNativeDecorationPaths: true,
    },
  };
}

function appearanceInput(core, definition, input, records, operationMode, revisionValue) {
  const revision = parsed(core.createVariantRevision(revisionValue));
  for (const kind of [
    'atlas.coastlineAppearance',
    'atlas.waterDecoration',
    'atlas.paperTreatment',
  ]) {
    assert.equal(definition.checkpoints.baseline[kind], 0);
  }
  return Object.freeze({
    worldSeed: input.worldSeed,
    worldMapId: input.worldMapId,
    records,
    variantRevisions: Object.freeze({
      coastlineAppearance: revision,
      waterDecoration: revision,
      paperTreatment: revision,
    }),
    operationMode,
  });
}

function appearanceRuntime(core, assets, input) {
  const seeds = assets.createAtlasAppearanceSeedInputs(input);
  return Object.freeze({
    coastlineAppearanceRandom: parsed(
      core.createDeterministicRandomStream(seeds.coastlineAppearance),
    ),
    waterDecorationRandom: parsed(core.createDeterministicRandomStream(seeds.waterDecoration)),
    paperTreatmentRandom: parsed(core.createDeterministicRandomStream(seeds.paperTreatment)),
  });
}

function aspectIdFor(patch, aspectName) {
  const replacement = patch.replacements.find(({ target }) => target.aspectName === aspectName);
  assert.ok(replacement);
  return replacement.target.aspectId;
}

function sourceSnapshotOf(records) {
  return {
    macroElevation: records.macroElevation,
    landWaterClassification: records.landWaterClassification,
    landmasses: records.landmasses,
    islandGroups: records.islandGroups,
    waterBodies: records.waterBodies,
    coastline: records.coastline,
  };
}

function assertDecorationSafety(core, records, paths) {
  const waterBodies = new Map(
    records.waterBodies.map((waterBody) => [waterBody.entityId, waterBody]),
  );
  const chartMarginTicks = (14 * core.PLANET_TICKS_PER_TURN) / 2_048;
  for (const path of paths) {
    assert.ok(path.points.length >= 2);
    for (const [index, point] of path.points.entries()) {
      assert.equal(
        records.landWaterClassification.samples[sampleIndexForPoint(core, point)],
        'water',
      );
      assert.ok(point.longitudeTicks > core.PLANET_LONGITUDE_MIN_TICKS + chartMarginTicks);
      assert.ok(point.longitudeTicks < core.PLANET_LONGITUDE_MAX_TICKS - chartMarginTicks);
      assert.ok(point.latitudeTicks > core.PLANET_LATITUDE_MIN_TICKS + chartMarginTicks);
      assert.ok(point.latitudeTicks < core.PLANET_LATITUDE_MAX_TICKS - chartMarginTicks);
      const previous = path.points[index - 1];
      if (previous !== undefined) {
        assert.ok(
          Math.abs(point.longitudeTicks - previous.longitudeTicks) <=
            core.PLANET_TICKS_PER_TURN / 2,
        );
      }
      if (path.kind === 'water-mark') {
        const owner = waterBodies.get(path.sourceEntityId);
        assert.ok(owner);
        assert.equal(membershipOwns(owner.membership, sampleIndexForPoint(core, point)), true);
      }
    }
  }
}

function sampleIndexForPoint(core, point) {
  const latitudeStep = core.PLANET_TICKS_PER_TURN / 2 / core.ATLAS_FULL_LATITUDE_BAND_COUNT;
  const longitudeStep = core.PLANET_TICKS_PER_TURN / core.ATLAS_FULL_LONGITUDE_CELL_COUNT;
  const latitudeIndex = Math.max(
    0,
    Math.min(
      core.ATLAS_FULL_LATITUDE_BAND_COUNT,
      Math.round((point.latitudeTicks - core.PLANET_LATITUDE_MIN_TICKS) / latitudeStep),
    ),
  );
  if (latitudeIndex === 0 || latitudeIndex === core.ATLAS_FULL_LATITUDE_BAND_COUNT) {
    return core.atlasStorageIndex(0, latitudeIndex);
  }
  const longitudeIndex = modulo(
    Math.round((point.longitudeTicks - core.PLANET_LONGITUDE_MIN_TICKS) / longitudeStep),
    core.ATLAS_FULL_LONGITUDE_CELL_COUNT,
  );
  return core.atlasStorageIndex(longitudeIndex, latitudeIndex);
}

function membershipOwns(membership, index) {
  return membership.sampleRanges.some(
    ({ startIndex, endIndexExclusive }) => index >= startIndex && index < endIndexExclusive,
  );
}

function hashCanonicalPrimitiveTraversal(value) {
  const hash = createHash('sha256');
  hash.update('ttrpg-map/atlas-appearance/v1\0');
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

function parsed(result) {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostic ?? result.diagnostics));
  return result.value;
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function modulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}
