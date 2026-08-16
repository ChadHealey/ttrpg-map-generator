import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export function coastlineProof(core, generation, definition, input, semantic) {
  const worldCoastlineEntityId = core.deriveAtlasSingletonEntityIds(
    input.worldMapId,
  ).worldCoastlineEntityId;
  const generationInput = {
    worldSeed: input.worldSeed,
    worldMapId: input.worldMapId,
    worldCoastlineEntityId,
    records: semantic.records,
    previousAcceptedAspects: [],
  };
  const result = generation.generateAtlasCanonicalCoastline(generationInput);
  assert.equal(result.status, 'proposed');
  if (result.status !== 'proposed') throw new Error(JSON.stringify(result.diagnostics));
  assert.deepEqual(core.validateAtlasGeographyRecords(result.patch.records), { ok: true });
  assert.deepEqual(generation.generateAtlasCanonicalCoastline(generationInput), result);
  assert.deepEqual(result.patch.explicitlyIncrementedAspectIds, []);
  assert.equal(result.patch.replacement.target.variantRevision, 0);
  assert.ok(result.patch.rawPointCount >= result.patch.canonicalPointCount);
  assert.ok(result.patch.canonicalPointCount > 0);
  const rings = result.patch.records.coastline.rings;
  assert.ok(rings.length > 0);
  assert.equal(isStrictlyOrdered(rings.map(({ ringId }) => ringId)), true);
  assert.equal(
    rings.every(
      ({ sourceBoundaryFingerprint, waterBodyIds }) =>
        /^[0-9a-f]{64}$/.test(sourceBoundaryFingerprint) && waterBodyIds.length > 0,
    ),
    true,
  );
  if (definition.fixtureId === 'milestone-2-atlas-seam-crossing') {
    assert.ok(rings.some(({ points }) => ringCrossesSeam(core, points)));
  }
  const coastlineAspectId = result.patch.replacement.target.aspect.aspectId;
  return {
    stableIds: {
      coastlineAspectId,
      worldCoastlineEntityId,
      ...indexedStableIds(
        'coastlineRingId',
        rings.map(({ ringId }) => ringId),
      ),
    },
    vector: {
      geometryBehaviorVersion: result.patch.records.coastline.geometryBehaviorVersion,
      extractionAlgorithmVersion: result.patch.records.coastline.extractionAlgorithmVersion,
      simplificationPolicyVersion: result.patch.records.coastline.simplificationPolicyVersion,
      simplificationToleranceTicks: result.patch.records.coastline.simplificationToleranceTicks,
      topologyValidationVersion: result.patch.records.coastline.topologyValidationVersion,
      winding: result.patch.records.coastline.winding,
      repairPolicy: result.patch.records.coastline.repairPolicy,
      replacementAspectName: result.patch.replacement.target.aspectName,
      dependencyAspectIds: result.patch.replacement.dependencyAspects.map(
        ({ aspectId }) => aspectId,
      ),
      rawPointCount: result.patch.rawPointCount,
      canonicalPointCount: result.patch.canonicalPointCount,
      ringCount: rings.length,
      coastlinePrimitiveTraversalSha256: hashCanonicalPrimitiveTraversal(
        result.patch.records.coastline,
      ),
    },
    invariants: {
      validatedCanonicalCoastlineRecords: true,
      exactSourceLinks: true,
      stableRingOrder: true,
      seamCrossingRingCount: rings.filter(({ points }) => ringCrossesSeam(core, points)).length,
      southPoleClassification: result.patch.records.landWaterClassification.samples[0],
      northPoleClassification:
        result.patch.records.landWaterClassification.samples[
          result.patch.records.landWaterClassification.samples.length - 1
        ],
    },
  };
}

function ringCrossesSeam(core, points) {
  return points.some((point, index) => {
    const next = points[(index + 1) % points.length];
    return (
      next !== undefined &&
      Math.abs(point.longitudeTicks - next.longitudeTicks) > core.PLANET_TICKS_PER_TURN / 2
    );
  });
}

function hashCanonicalPrimitiveTraversal(value) {
  const hash = createHash('sha256');
  hash.update('ttrpg-map/atlas-canonical-coastline/v1\0');
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

function indexedStableIds(prefix, values) {
  return Object.fromEntries(
    values.map((value, index) => [`${prefix}${String(index).padStart(3, '0')}`, value]),
  );
}

function isStrictlyOrdered(values) {
  return values.every((value, index) => index === 0 || values[index - 1] < value);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
