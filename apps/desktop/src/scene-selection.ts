import type { RenderNode, RenderPoint, RenderScene } from '@ttrpg-map/core';

/** Returns the topmost render node whose selectable shape contains the scene point. */
export function findTopmostNodeAt(
  scene: Pick<RenderScene, 'nodes'>,
  point: RenderPoint,
): RenderNode | undefined {
  for (let index = scene.nodes.length - 1; index >= 0; index -= 1) {
    const node = scene.nodes[index];
    if (node !== undefined && isPointInNode(point, node)) return node;
  }
  return undefined;
}

function isPointInNode(point: RenderPoint, node: RenderNode): boolean {
  switch (node.kind) {
    case 'rectangle':
      return (
        point.xPx >= node.xPx &&
        point.xPx <= node.xPx + node.widthPx &&
        point.yPx >= node.yPx &&
        point.yPx <= node.yPx + node.heightPx
      );
    case 'polygon':
      return isPointInPolygon(point, node.points);
    case 'polyline':
      return isPointNearPolyline(point, node.points, node.strokeWidthPx / 2 + 8);
    case 'label':
      return (
        Math.abs(point.xPx - node.position.xPx) <= node.fontSizePx * 5 &&
        Math.abs(point.yPx - node.position.yPx) <= node.fontSizePx
      );
  }
}

function isPointInPolygon(point: RenderPoint, points: readonly RenderPoint[]): boolean {
  let isInside = false;
  for (
    let currentIndex = 0, previousIndex = points.length - 1;
    currentIndex < points.length;
    previousIndex = currentIndex, currentIndex += 1
  ) {
    const current = points[currentIndex];
    const previous = points[previousIndex];
    if (current === undefined || previous === undefined) continue;
    const intersects =
      current.yPx > point.yPx !== previous.yPx > point.yPx &&
      point.xPx <
        ((previous.xPx - current.xPx) * (point.yPx - current.yPx)) / (previous.yPx - current.yPx) +
          current.xPx;
    if (intersects) isInside = !isInside;
  }
  return isInside;
}

function isPointNearPolyline(
  point: RenderPoint,
  points: readonly RenderPoint[],
  thresholdPx: number,
): boolean {
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    if (
      start !== undefined &&
      end !== undefined &&
      distanceToSegment(point, start, end) <= thresholdPx
    ) {
      return true;
    }
  }
  return false;
}

function distanceToSegment(point: RenderPoint, start: RenderPoint, end: RenderPoint): number {
  const deltaXPx = end.xPx - start.xPx;
  const deltaYPx = end.yPx - start.yPx;
  const lengthSquared = deltaXPx ** 2 + deltaYPx ** 2;
  if (lengthSquared === 0) return Math.hypot(point.xPx - start.xPx, point.yPx - start.yPx);
  const positionRatio = Math.min(
    1,
    Math.max(
      0,
      ((point.xPx - start.xPx) * deltaXPx + (point.yPx - start.yPx) * deltaYPx) / lengthSquared,
    ),
  );
  return Math.hypot(
    point.xPx - (start.xPx + positionRatio * deltaXPx),
    point.yPx - (start.yPx + positionRatio * deltaYPx),
  );
}
