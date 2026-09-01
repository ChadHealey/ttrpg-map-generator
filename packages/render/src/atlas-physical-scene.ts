/** Disposable, source-linked physical overlays from accepted M3 atlas records. */

import {
  type AspectId,
  type AtlasStyleTokens,
  deriveWorldPhysicalContextAspectId,
  type EntityId,
  type RenderNode,
  type RenderPoint,
  type RenderScene,
  type WorldPhysicalContextRecords,
} from '@ttrpg-map/core';

import {
  type AtlasProjectedDisplayPath,
  atlasScenePointFromDisplayPoint,
  projectAtlasPlanetPolyline,
} from './atlas-display-projection.js';

/**
 * Build one stable physical-overlay layer. Numeric prefixes make the reviewed hierarchy explicit:
 * biome boundaries, watershed divides, relief, lakes, then rivers. Coastline ink remains outside
 * this layer and is composed above all of these nodes.
 */
export function composeAtlasPhysicalSceneNodes(
  physical: WorldPhysicalContextRecords,
  style: AtlasStyleTokens,
  scene: Pick<RenderScene, 'widthPx' | 'heightPx'>,
): readonly RenderNode[] {
  const nodes: RenderNode[] = [];
  const biomeAspectId = physical.biomeBelts.provenance.ownerAspectId;
  const watershedAspectId = physical.watersheds.provenance.ownerAspectId;
  const mountainAspectId = physical.mountainSystems.ownerAspectId;
  const riverAspectId = physicalAspectId(physical, 'worldHydrology.majorRivers');
  const lakeAspectId = physicalAspectId(physical, 'worldHydrology.majorLakes');

  for (const belt of representativeBiomeBelts(physical)) {
    nodes.push(
      ...biomeNodes(
        `atlas/physical/01-biome/${belt.entityId}`,
        belt.entityId,
        biomeAspectId,
        [physical.worldSurfaceEntityId],
        belt.boundaryPoints,
        style.colors.waterInk,
        2,
        scene,
      ),
    );
  }
  for (const watershed of physical.watersheds.watersheds) {
    nodes.push(
      ...watershed.divideLines.flatMap((line, index) =>
        polylineNodes(
          `atlas/physical/02-watershed/${watershed.entityId}/${ordinal(index)}`,
          watershed.entityId,
          watershedAspectId,
          relatedIds([watershed.outletEntityId]),
          line,
          false,
          style.colors.waterInk,
          2,
          scene,
          32,
        ),
      ),
    );
  }
  for (const system of physical.mountainSystems.systems) {
    nodes.push(
      ...system.centerlines.flatMap((line, index) =>
        mountainNodes(
          `atlas/physical/03-mountain/${system.entityId}/${ordinal(index)}`,
          system.entityId,
          mountainAspectId,
          [physical.worldSurfaceEntityId],
          line,
          style,
          scene,
        ),
      ),
    );
  }
  for (const lake of physical.majorLakes) {
    const paths = projectAtlasPlanetPolyline(lake.ring, true);
    paths.forEach((path, index) => {
      const id = `atlas/physical/04-lake/${lake.entityId}/${ordinal(index)}`;
      const relatedSourceIds = relatedIds([lake.watershedId, lake.outletRiverId]);
      if (path.isClosed) {
        nodes.push(
          ...closedLakeNodes(
            id,
            `${id}/outline`,
            lake.entityId,
            lakeAspectId,
            relatedSourceIds,
            path,
            style,
            scene,
          ),
        );
      } else {
        nodes.push(
          polylineNode(
            id,
            lake.entityId,
            lakeAspectId,
            relatedSourceIds,
            path,
            style.colors.waterInk,
            2,
            scene,
            30,
          ),
        );
      }
    });
  }
  for (const river of physical.majorRivers) {
    nodes.push(
      ...polylineNodes(
        `atlas/physical/05-river/${river.entityId}`,
        river.entityId,
        riverAspectId,
        relatedIds([
          river.watershedId,
          river.sourceEntityId,
          river.outletEntityId,
          ...river.joinsRiverIds,
        ]),
        river.centerline,
        false,
        style.colors.waterInk,
        2,
        scene,
        42,
      ),
    );
  }
  return Object.freeze(nodes.sort((left, right) => compareText(left.id, right.id)));
}

/**
 * Biome contours may coincide with coastlines where a biome reaches the sea. Draw them as a
 * small, source-derived inland inset so the climate/biome context remains distinguishable while
 * the canonical coastline stays authoritative and on top.
 */
function biomeNodes(
  idPrefix: string,
  sourceId: EntityId,
  sourceAspectId: AspectId,
  relatedSourceIds: readonly EntityId[],
  points: Parameters<typeof projectAtlasPlanetPolyline>[0],
  strokeColor: string,
  strokeWidthPx: number,
  scene: Pick<RenderScene, 'widthPx' | 'heightPx'>,
): readonly RenderNode[] {
  return projectAtlasPlanetPolyline(points, true).map((path, index) =>
    polylineNodeFromPoints(
      `${idPrefix}/${ordinal(index)}`,
      sourceId,
      sourceAspectId,
      relatedSourceIds,
      insetTowardCentroid(renderPoints(path, scene), 8, scene),
      strokeColor,
      strokeWidthPx,
    ),
  );
}

/** Keep the broadest deterministic climate/biome boundaries legible at atlas scale. */
function representativeBiomeBelts(physical: WorldPhysicalContextRecords) {
  const selectedByBiome = new Map<string, number>();
  return [...physical.biomeBelts.beltSummaries]
    .filter(({ biomeKey }) => biomeKey !== 'water')
    .sort(
      (left, right) =>
        compareText(left.biomeKey, right.biomeKey) ||
        right.boundaryPoints.length - left.boundaryPoints.length ||
        compareText(left.entityId, right.entityId),
    )
    .filter(({ biomeKey }) => {
      const selected = selectedByBiome.get(biomeKey) ?? 0;
      selectedByBiome.set(biomeKey, selected + 1);
      return selected < 3;
    })
    .sort((left, right) => compareText(left.entityId, right.entityId));
}

function physicalAspectId(
  physical: WorldPhysicalContextRecords,
  kind: 'worldHydrology.majorLakes' | 'worldHydrology.majorRivers',
): AspectId {
  return deriveWorldPhysicalContextAspectId(physical.worldSurfaceEntityId, kind);
}

function polylineNodes(
  idPrefix: string,
  sourceId: EntityId,
  sourceAspectId: AspectId,
  relatedSourceIds: readonly EntityId[],
  points: Parameters<typeof projectAtlasPlanetPolyline>[0],
  isClosed: boolean,
  strokeColor: string,
  strokeWidthPx: number,
  scene: Pick<RenderScene, 'widthPx' | 'heightPx'>,
  minimumLengthPx: number,
): readonly RenderNode[] {
  return projectAtlasPlanetPolyline(points, isClosed).map((path, index) =>
    polylineNode(
      `${idPrefix}/${ordinal(index)}`,
      sourceId,
      sourceAspectId,
      relatedSourceIds,
      path,
      strokeColor,
      strokeWidthPx,
      scene,
      minimumLengthPx,
    ),
  );
}

function mountainNodes(
  idPrefix: string,
  sourceId: EntityId,
  sourceAspectId: AspectId,
  relatedSourceIds: readonly EntityId[],
  points: Parameters<typeof projectAtlasPlanetPolyline>[0],
  style: AtlasStyleTokens,
  scene: Pick<RenderScene, 'widthPx' | 'heightPx'>,
): readonly RenderNode[] {
  return projectAtlasPlanetPolyline(points, false).flatMap((path, index) => {
    const id = `${idPrefix}/${ordinal(index)}`;
    const line = polylineNode(
      id,
      sourceId,
      sourceAspectId,
      relatedSourceIds,
      path,
      style.colors.ink,
      2,
      scene,
      34,
    );
    return [
      line,
      ...mountainHatchNodes(id, sourceId, sourceAspectId, relatedSourceIds, line, scene),
    ];
  });
}

/** Three restrained cross-ridge hatches make short accepted mountain centerlines legible at atlas scale. */
function mountainHatchNodes(
  idPrefix: string,
  sourceId: EntityId,
  sourceAspectId: AspectId,
  relatedSourceIds: readonly EntityId[],
  line: RenderNode,
  scene: Pick<RenderScene, 'widthPx' | 'heightPx'>,
): readonly RenderNode[] {
  if (line.kind !== 'polyline') return [];
  const first = line.points[0];
  const last = line.points.at(-1);
  if (first === undefined || last === undefined) return [];
  const dx = last.xPx - first.xPx;
  const dy = last.yPx - first.yPx;
  const length = Math.hypot(dx, dy);
  if (length === 0) return [];
  const normal = { xPx: -dy / length, yPx: dx / length };
  return [-0.25, 0, 0.25].map((position, index) => {
    const center = {
      xPx: first.xPx + dx * (0.5 + position),
      yPx: first.yPx + dy * (0.5 + position),
    };
    const halfLength = 5;
    return Object.freeze({
      id: `${idPrefix}/hatch/${ordinal(index)}`,
      kind: 'polyline' as const,
      sourceId,
      sourceAspectId,
      relatedSourceIds,
      points: Object.freeze([
        pointInsideScene(
          center.xPx - normal.xPx * halfLength,
          center.yPx - normal.yPx * halfLength,
          scene,
        ),
        pointInsideScene(
          center.xPx + normal.xPx * halfLength,
          center.yPx + normal.yPx * halfLength,
          scene,
        ),
      ]),
      strokeColor: line.strokeColor,
      strokeWidthPx: 1.5,
    });
  });
}

function polylineNode(
  id: string,
  sourceId: EntityId,
  sourceAspectId: AspectId,
  relatedSourceIds: readonly EntityId[],
  path: AtlasProjectedDisplayPath,
  strokeColor: string,
  strokeWidthPx: number,
  scene: Pick<RenderScene, 'widthPx' | 'heightPx'>,
  minimumLengthPx = 0,
): RenderNode {
  const points = ensureMinimumPolylineLength(renderPoints(path, scene), minimumLengthPx, scene);
  return polylineNodeFromPoints(
    id,
    sourceId,
    sourceAspectId,
    relatedSourceIds,
    points,
    strokeColor,
    strokeWidthPx,
  );
}

function polylineNodeFromPoints(
  id: string,
  sourceId: EntityId,
  sourceAspectId: AspectId,
  relatedSourceIds: readonly EntityId[],
  points: readonly RenderPoint[],
  strokeColor: string,
  strokeWidthPx: number,
): RenderNode {
  return Object.freeze({
    id,
    kind: 'polyline',
    sourceId,
    sourceAspectId,
    relatedSourceIds,
    points,
    strokeColor,
    strokeWidthPx,
  });
}

function closedLakeNodes(
  id: string,
  outlineId: string,
  sourceId: EntityId,
  sourceAspectId: AspectId,
  relatedSourceIds: readonly EntityId[],
  path: AtlasProjectedDisplayPath,
  style: AtlasStyleTokens,
  scene: Pick<RenderScene, 'widthPx' | 'heightPx'>,
): readonly RenderNode[] {
  const points = ensureMinimumClosedExtent(renderPoints(path, scene), 30, scene);
  return Object.freeze([
    Object.freeze({
      id,
      kind: 'compoundPath' as const,
      sourceId,
      sourceAspectId,
      relatedSourceIds,
      subpaths: Object.freeze([Object.freeze({ points })]),
      fillColor: style.colors.water,
      fillRule: 'evenodd' as const,
    }),
    polylineNodeFromPoints(
      outlineId,
      sourceId,
      sourceAspectId,
      relatedSourceIds,
      points,
      style.colors.waterInk,
      2,
    ),
  ]);
}

function renderPoints(
  path: AtlasProjectedDisplayPath,
  scene: Pick<RenderScene, 'widthPx' | 'heightPx'>,
): readonly RenderPoint[] {
  return Object.freeze(path.points.map((point) => atlasScenePointFromDisplayPoint(point, scene)));
}

function pointInsideScene(
  xPx: number,
  yPx: number,
  scene: Pick<RenderScene, 'widthPx' | 'heightPx'>,
): RenderPoint {
  return Object.freeze({
    xPx: Math.max(0, Math.min(scene.widthPx, xPx)),
    yPx: Math.max(0, Math.min(scene.heightPx, yPx)),
  });
}

/**
 * Preserve the accepted path exactly when it is already legible. Tiny M3 features otherwise get
 * a deterministic atlas-scale footprint around their own centroid; this is disposable styling,
 * not a change to the accepted geometry.
 */
function ensureMinimumPolylineLength(
  points: readonly RenderPoint[],
  minimumLengthPx: number,
  scene: Pick<RenderScene, 'widthPx' | 'heightPx'>,
): readonly RenderPoint[] {
  if (minimumLengthPx <= 0 || polylineLength(points) >= minimumLengthPx) return points;
  return scaleAroundCentroid(points, minimumLengthPx / Math.max(polylineLength(points), 1), scene);
}

function ensureMinimumClosedExtent(
  points: readonly RenderPoint[],
  minimumExtentPx: number,
  scene: Pick<RenderScene, 'widthPx' | 'heightPx'>,
): readonly RenderPoint[] {
  if (points.length === 0) return points;
  const xExtent =
    Math.max(...points.map(({ xPx }) => xPx)) - Math.min(...points.map(({ xPx }) => xPx));
  const yExtent =
    Math.max(...points.map(({ yPx }) => yPx)) - Math.min(...points.map(({ yPx }) => yPx));
  const extent = Math.max(xExtent, yExtent);
  if (extent >= minimumExtentPx) return points;
  if (extent === 0) return minimumClosedFootprint(points[0], minimumExtentPx, scene);
  return scaleAroundCentroid(points, minimumExtentPx / extent, scene);
}

function minimumClosedFootprint(
  anchor: RenderPoint | undefined,
  minimumExtentPx: number,
  scene: Pick<RenderScene, 'widthPx' | 'heightPx'>,
): readonly RenderPoint[] {
  if (anchor === undefined) return Object.freeze([]);
  const halfExtent = minimumExtentPx / 2;
  const left = Math.max(0, Math.min(scene.widthPx - minimumExtentPx, anchor.xPx - halfExtent));
  const top = Math.max(0, Math.min(scene.heightPx - minimumExtentPx, anchor.yPx - halfExtent));
  return Object.freeze([
    Object.freeze({ xPx: left, yPx: top }),
    Object.freeze({ xPx: left + minimumExtentPx, yPx: top }),
    Object.freeze({ xPx: left + minimumExtentPx, yPx: top + minimumExtentPx }),
    Object.freeze({ xPx: left, yPx: top + minimumExtentPx }),
    Object.freeze({ xPx: left, yPx: top }),
  ]);
}

function polylineLength(points: readonly RenderPoint[]): number {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (previous === undefined || current === undefined) continue;
    length += Math.hypot(current.xPx - previous.xPx, current.yPx - previous.yPx);
  }
  return length;
}

function scaleAroundCentroid(
  points: readonly RenderPoint[],
  scale: number,
  scene: Pick<RenderScene, 'widthPx' | 'heightPx'>,
): readonly RenderPoint[] {
  const center = points.reduce(
    (total, point) => ({ xPx: total.xPx + point.xPx, yPx: total.yPx + point.yPx }),
    { xPx: 0, yPx: 0 },
  );
  const centroid = { xPx: center.xPx / points.length, yPx: center.yPx / points.length };
  const scaled = points.map((point) => ({
    xPx: centroid.xPx + (point.xPx - centroid.xPx) * scale,
    yPx: centroid.yPx + (point.yPx - centroid.yPx) * scale,
  }));
  const minimumX = Math.min(...scaled.map(({ xPx }) => xPx));
  const maximumX = Math.max(...scaled.map(({ xPx }) => xPx));
  const minimumY = Math.min(...scaled.map(({ yPx }) => yPx));
  const maximumY = Math.max(...scaled.map(({ yPx }) => yPx));
  const translateX =
    minimumX < 0 ? -minimumX : maximumX > scene.widthPx ? scene.widthPx - maximumX : 0;
  const translateY =
    minimumY < 0 ? -minimumY : maximumY > scene.heightPx ? scene.heightPx - maximumY : 0;
  return Object.freeze(
    scaled.map(({ xPx, yPx }) => Object.freeze({ xPx: xPx + translateX, yPx: yPx + translateY })),
  );
}

function insetTowardCentroid(
  points: readonly RenderPoint[],
  insetPx: number,
  scene: Pick<RenderScene, 'widthPx' | 'heightPx'>,
): readonly RenderPoint[] {
  if (points.length === 0) return points;
  const center = points.reduce(
    (total, point) => ({ xPx: total.xPx + point.xPx, yPx: total.yPx + point.yPx }),
    { xPx: 0, yPx: 0 },
  );
  const centroid = { xPx: center.xPx / points.length, yPx: center.yPx / points.length };
  return Object.freeze(
    points.map((point) => {
      const dx = centroid.xPx - point.xPx;
      const dy = centroid.yPx - point.yPx;
      const distance = Math.hypot(dx, dy);
      if (distance === 0) return point;
      const distanceToMove = Math.min(insetPx, distance / 2);
      return pointInsideScene(
        point.xPx + (dx / distance) * distanceToMove,
        point.yPx + (dy / distance) * distanceToMove,
        scene,
      );
    }),
  );
}

function relatedIds(ids: readonly (EntityId | undefined)[]): readonly EntityId[] {
  return Object.freeze([...new Set(ids.filter(isDefined))].sort(compareText));
}

function ordinal(index: number): string {
  return String(index).padStart(4, '0');
}

function isDefined<Value>(value: Value | undefined): value is Value {
  return value !== undefined;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
