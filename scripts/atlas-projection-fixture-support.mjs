import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export function projectionProof(render, coastline) {
  const sourceBefore = hashCanonicalPrimitiveTraversal(
    'ttrpg-map/atlas-projection-source-immutability/v1\0',
    coastline,
  );
  const first = render.projectAtlasCanonicalCoastline(coastline);
  const second = render.projectAtlasCanonicalCoastline(coastline);
  assert.deepEqual(first, second);
  assert.equal(first.ok, true);
  if (!first.ok) throw new Error(JSON.stringify(first.diagnostics));
  assert.equal(first.value.authority, 'disposable');
  assert.equal(first.value.projection.authority, 'disposable-display');
  assert.equal(first.value.projection.logicalAspectRatio, 2);
  assert.equal(first.value.projection.semanticToleranceTicks, 0);
  assert.equal(
    hashCanonicalPrimitiveTraversal(
      'ttrpg-map/atlas-projection-source-immutability/v1\0',
      coastline,
    ),
    sourceBefore,
  );

  const paths = first.value.paths;
  assert.ok(paths.length >= coastline.rings.length);
  assert.equal(isStrictlyOrdered(paths.map(({ pathId }) => pathId)), true);
  const pathsByRing = new Map();
  let pointCount = 0;
  let seamEndpointCount = 0;
  for (const path of paths) {
    const sourceRing = coastline.rings.find(({ ringId }) => ringId === path.sourceRingId);
    assert.ok(sourceRing);
    assert.equal(path.sourceBoundaryFingerprint, sourceRing.sourceBoundaryFingerprint);
    assert.equal(path.sourceEntityId, sourceRing.landmassId);
    assert.equal(path.landmassId, sourceRing.landmassId);
    assert.deepEqual(path.waterBodyIds, sourceRing.waterBodyIds);
    assert.ok(path.points.length >= 2);
    pointCount += path.points.length;
    pathsByRing.set(path.sourceRingId, (pathsByRing.get(path.sourceRingId) ?? 0) + 1);
    for (const point of path.points) {
      assert.ok(point.xDisplayTicks >= 0);
      assert.ok(point.xDisplayTicks <= render.ATLAS_DISPLAY_WIDTH_TICKS);
      assert.ok(point.yDisplayTicks >= 0);
      assert.ok(point.yDisplayTicks <= render.ATLAS_DISPLAY_HEIGHT_TICKS);
      if (point.xDisplayTicks === 0 || point.xDisplayTicks === render.ATLAS_DISPLAY_WIDTH_TICKS) {
        seamEndpointCount += 1;
      }
    }
    for (let index = 1; index < path.points.length; index += 1) {
      assert.ok(
        Math.abs(path.points[index].xDisplayTicks - path.points[index - 1].xDisplayTicks) <=
          render.ATLAS_DISPLAY_WIDTH_TICKS / 2,
      );
    }
  }

  const seamSplitRingCount = [...pathsByRing.values()].filter((count) => count > 1).length;
  return {
    vector: {
      projectionId: first.value.projection.projectionId,
      projectionVersion: first.value.projection.projectionVersion,
      seamPolicyVersion: first.value.projection.seamPolicyVersion,
      coordinateSpace: first.value.projection.coordinateSpace,
      authority: first.value.projection.authority,
      seamLongitudeTicks: first.value.projection.seamLongitudeTicks,
      widthDisplayTicks: first.value.projection.widthDisplayTicks,
      heightDisplayTicks: first.value.projection.heightDisplayTicks,
      logicalAspectRatio: first.value.projection.logicalAspectRatio,
      semanticToleranceTicks: first.value.projection.semanticToleranceTicks,
      sourceGeometryBehaviorVersion: first.value.sourceGeometryBehaviorVersion,
      pathCount: paths.length,
      pointCount,
      seamSplitRingCount,
      seamEndpointCount,
      projectedPrimitiveTraversalSha256: hashCanonicalPrimitiveTraversal(
        'ttrpg-map/atlas-projected-coastline/v1\0',
        first.value,
      ),
    },
    invariants: {
      sourceCoastlineUnchanged: true,
      sourceIdentityAndProvenancePreserved: true,
      stablePathIdentityAndOrder: true,
      noWorldSpanningProjectedSegments: true,
      previewFullSemanticToleranceTicks: 0,
      canvasSvgSharedSceneCoveredByIntegrationTest: true,
    },
  };
}

function hashCanonicalPrimitiveTraversal(prefix, value) {
  const hash = createHash('sha256');
  hash.update(prefix);
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
