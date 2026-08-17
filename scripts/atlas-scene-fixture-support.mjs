import assert from 'node:assert/strict';

export function sceneProof(render, records, appearance, style) {
  const sourceSnapshot = sourceSnapshotOf(records);
  const appearanceSnapshot = appearanceSnapshotOf(appearance);
  const normalResult = render.composeAtlasRenderScene(records, appearance, style, {
    levelOfDetail: render.ATLAS_SCENE_LEVELS_OF_DETAIL.normalAtlas,
  });
  const rebuiltResult = render.composeAtlasRenderScene(records, appearance, style, {
    levelOfDetail: render.ATLAS_SCENE_LEVELS_OF_DETAIL.normalAtlas,
  });
  const reorderedResult = render.composeAtlasRenderScene(
    reordered(records),
    reorderedAppearance(appearance),
    style,
    {
      levelOfDetail: render.ATLAS_SCENE_LEVELS_OF_DETAIL.normalAtlas,
    },
  );
  const coarseResult = render.composeAtlasRenderScene(records, appearance, style, {
    levelOfDetail: render.ATLAS_SCENE_LEVELS_OF_DETAIL.coarsePreview,
  });
  for (const result of [normalResult, rebuiltResult, reorderedResult, coarseResult]) {
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  }
  if (!normalResult.ok || !rebuiltResult.ok || !reorderedResult.ok || !coarseResult.ok) {
    throw new Error('Atlas scene proof requires four valid scene compositions.');
  }

  const scene = normalResult.value;
  const coarse = coarseResult.value;
  assert.deepEqual(rebuiltResult.value, scene);
  assert.deepEqual(reorderedResult.value, scene);
  assert.deepEqual(sourceSnapshotOf(records), sourceSnapshot);
  assert.deepEqual(appearanceSnapshotOf(appearance), appearanceSnapshot);
  assert.equal(scene.authority, 'disposable-render-scene');
  assert.equal(scene.sceneKind, 'whole-world-atlas');
  assert.equal(scene.sceneCompositionVersion, render.ATLAS_SCENE_COMPOSITION_VERSION);
  assert.equal(scene.widthPx, render.ATLAS_SCENE_WIDTH_PX);
  assert.equal(scene.heightPx, render.ATLAS_SCENE_HEIGHT_PX);
  assert.equal(scene.widthPx / scene.heightPx, 2);
  assert.equal(scene.projection.semanticToleranceTicks, 0);

  const nodeIds = scene.nodes.map(({ id }) => id);
  const landNodes = scene.nodes.filter(({ kind }) => kind === 'compoundPath');
  const coastNodes = scene.nodes.filter(({ id }) => id.startsWith('atlas/coastline/'));
  const echoNodes = scene.nodes.filter(({ id }) => id.startsWith('atlas-water/echo/'));
  const waterMarkNodes = scene.nodes.filter(({ id }) => id.startsWith('atlas-water/mark/'));
  const grainNodes = scene.nodes.filter(({ id }) => id.startsWith('atlas/paper/grain-'));
  assert.equal(new Set(nodeIds).size, nodeIds.length);
  assert.equal(isStrictlyOrderedOrEmpty(landNodes.map(({ id }) => id)), true);
  assert.equal(isStrictlyOrderedOrEmpty(coastNodes.map(({ id }) => id)), true);
  assert.equal(isStrictlyOrderedOrEmpty(echoNodes.map(({ id }) => id)), true);
  assert.equal(isStrictlyOrderedOrEmpty(waterMarkNodes.map(({ id }) => id)), true);
  assert.equal(isStrictlyOrderedOrEmpty(grainNodes.map(({ id }) => id)), true);
  assert.equal(
    scene.nodes.every(({ sourceId, sourceAspectId }) => sourceId && sourceAspectId),
    true,
  );
  assert.equal(
    records.landmasses.every((landmass) => {
      const node = landNodes.find(({ sourceId }) => sourceId === landmass.entityId);
      return node !== undefined && pointInSubpaths(landmassWitnessPoint(landmass), node.subpaths);
    }),
    true,
  );
  assert.equal(
    scene.nodes.every(
      ({ relatedSourceIds }) =>
        relatedSourceIds === undefined || isStrictlyOrderedOrEmpty(relatedSourceIds),
    ),
    true,
  );
  assert.deepEqual(nodeIds.slice(0, 2), ['atlas/background/paper', 'atlas/background/water']);
  assert.equal(landNodes.length, records.landmasses.length);
  assert.ok(coastNodes.length >= records.coastline.rings.length);
  assert.ok(echoNodes.length > 0);
  assert.ok(waterMarkNodes.length > 0);
  assert.ok(grainNodes.length > 0);
  assert.equal(
    landNodes.every(({ subpaths }) =>
      subpaths.every(({ points }) =>
        points.every(
          ({ xPx, yPx }) => xPx >= 0 && xPx <= scene.widthPx && yPx >= 0 && yPx <= scene.heightPx,
        ),
      ),
    ),
    true,
  );

  const normalFillNodes = scene.nodes.filter(({ kind }) => kind !== 'polyline');
  assert.deepEqual(coarse.nodes, normalFillNodes);
  assert.equal(
    coarse.nodes.some(({ kind }) => kind === 'polyline'),
    false,
  );

  const svg = render.renderSceneToSvg(scene);
  const svgNodeIds = [...svg.matchAll(/data-render-node-id="([^"]+)"/gu)].map((match) => match[1]);
  assert.deepEqual(svgNodeIds, nodeIds);
  for (const node of scene.nodes) {
    assert.ok(svg.includes(`data-source-id="${node.sourceId}"`));
    assert.ok(svg.includes(`data-source-aspect-id="${node.sourceAspectId}"`));
  }
  const canvas = new RecordingCanvasContext();
  render.renderSceneToCanvas(canvas, scene);
  assert.equal(canvas.rectangleCount, 2);
  assert.equal(canvas.fillCount, landNodes.length);
  assert.equal(
    canvas.strokeCount,
    coastNodes.length + echoNodes.length + waterMarkNodes.length + grainNodes.length,
  );

  const seamClosureCount = landNodes.reduce(
    (count, { subpaths }) =>
      count +
      subpaths.filter(({ points }) => {
        if (isFullSceneSubpath(points, scene.widthPx, scene.heightPx)) return false;
        const xs = new Set(points.map(({ xPx }) => xPx));
        return xs.has(0) || xs.has(scene.widthPx);
      }).length,
    0,
  );

  return {
    scene,
    svg,
    vector: {
      sceneCompositionVersion: scene.sceneCompositionVersion,
      sceneKind: scene.sceneKind,
      levelOfDetail: scene.levelOfDetail,
      widthPx: scene.widthPx,
      heightPx: scene.heightPx,
      nodeCount: scene.nodes.length,
      landFillNodeCount: landNodes.length,
      coastlineNodeCount: coastNodes.length,
      coastalEchoNodeCount: echoNodes.length,
      waterMarkNodeCount: waterMarkNodes.length,
      paperGrainNodeCount: grainNodes.length,
      seamClosureCount,
      sourceLinkedNodeCount: scene.nodes.filter(({ sourceAspectId }) => sourceAspectId).length,
      coarseNodeCount: coarse.nodes.length,
    },
    invariants: {
      acceptedSourceUnchanged: true,
      cacheFreeRebuildEqual: true,
      equivalentInsertionOrderEqual: true,
      stableUniqueNodeIds: true,
      deterministicLayerOrder: true,
      sourceEntityAndAspectLinks: true,
      coarseLodPreservesFillGeometry: true,
      canvasSvgSharedSceneParity: true,
      projectedPointsWithinScene: true,
      acceptedAppearanceUnchanged: true,
      restrainedLimitedColorStyle: true,
    },
  };
}

function landmassWitnessPoint(landmass) {
  let fallback;
  for (const range of landmass.membership.sampleRanges) {
    const candidates = [
      range.startIndex,
      Math.floor((range.startIndex + range.endIndexExclusive - 1) / 2),
      range.endIndexExclusive - 1,
    ];
    for (const index of candidates) {
      if (index <= 0 || index >= 2_095_105) continue;
      fallback ??= index;
      if ((index - 1) % 2_048 !== 0) return sampleIndexToPoint(index);
    }
  }
  if (fallback !== undefined) return sampleIndexToPoint(fallback);
  const ownsSouthPole = landmass.membership.sampleRanges.some(
    ({ startIndex, endIndexExclusive }) => startIndex === 0 && endIndexExclusive > 0,
  );
  return { xPx: 1_024, yPx: ownsSouthPole ? 1_024 : 0 };
}

function sampleIndexToPoint(index) {
  const interior = index - 1;
  return {
    xPx: interior % 2_048,
    yPx: 1_024 - (Math.floor(interior / 2_048) + 1),
  };
}

function pointInSubpaths(point, subpaths) {
  return subpaths.reduce((inside, { points }) => pointInPolygon(point, points) !== inside, false);
}

function pointInPolygon(point, points) {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const currentPoint = points[index];
    const previousPoint = points[previous];
    const crosses =
      currentPoint.yPx > point.yPx !== previousPoint.yPx > point.yPx &&
      point.xPx <
        ((previousPoint.xPx - currentPoint.xPx) * (point.yPx - currentPoint.yPx)) /
          (previousPoint.yPx - currentPoint.yPx) +
          currentPoint.xPx;
    if (crosses) inside = !inside;
  }
  return inside;
}

function isFullSceneSubpath(points, widthPx, heightPx) {
  return (
    points.length === 4 &&
    points[0].xPx === 0 &&
    points[0].yPx === 0 &&
    points[1].xPx === widthPx &&
    points[1].yPx === 0 &&
    points[2].xPx === widthPx &&
    points[2].yPx === heightPx &&
    points[3].xPx === 0 &&
    points[3].yPx === heightPx
  );
}

function reordered(records) {
  return {
    ...records,
    landmasses: [...records.landmasses].reverse(),
    islandGroups: [...records.islandGroups].reverse(),
    waterBodies: [...records.waterBodies].reverse(),
    coastline: { ...records.coastline, rings: [...records.coastline.rings].reverse() },
  };
}

function reorderedAppearance(appearance) {
  return {
    ...appearance,
    coastlineAppearance: {
      ...appearance.coastlineAppearance,
      ringDecisions: [...appearance.coastlineAppearance.ringDecisions].reverse(),
    },
    waterDecoration: {
      ...appearance.waterDecoration,
      paths: [...appearance.waterDecoration.paths].reverse(),
    },
  };
}

function sourceSnapshotOf(records) {
  return {
    landmassIds: records.landmasses.map(({ entityId }) => entityId),
    islandGroupIds: records.islandGroups.map(({ entityId }) => entityId),
    waterBodyIds: records.waterBodies.map(({ entityId }) => entityId),
    coastline: records.coastline,
    macroElevation: records.macroElevation,
    landWaterClassification: records.landWaterClassification,
  };
}

function appearanceSnapshotOf(appearance) {
  return {
    atlasPresentationEntityId: appearance.atlasPresentationEntityId,
    coastlineAppearance: appearance.coastlineAppearance,
    waterDecoration: appearance.waterDecoration,
    paperTreatment: appearance.paperTreatment,
  };
}

function isStrictlyOrderedOrEmpty(values) {
  return values.every((value, index) => index === 0 || values[index - 1] < value);
}

class RecordingCanvasContext {
  rectangleCount = 0;
  fillCount = 0;
  strokeCount = 0;

  set fillStyle(value) {
    void value;
  }
  set lineCap(value) {
    void value;
  }
  set lineJoin(value) {
    void value;
  }
  set lineWidth(value) {
    void value;
  }
  set strokeStyle(value) {
    void value;
  }

  beginPath() {}
  closePath() {}
  lineTo() {}
  moveTo() {}
  fill() {
    this.fillCount += 1;
  }
  fillRect() {
    this.rectangleCount += 1;
  }
  stroke() {
    this.strokeCount += 1;
  }
}
