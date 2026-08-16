/** Canvas and export backends that consume renderer-neutral scene contracts from core. */

import type { RenderNode, RenderPoint, RenderScene } from '@ttrpg-map/core';

export {
  ATLAS_DISPLAY_COORDINATE_SPACE,
  ATLAS_DISPLAY_HEIGHT_TICKS,
  ATLAS_DISPLAY_PROJECTION_ID,
  ATLAS_DISPLAY_PROJECTION_METADATA,
  ATLAS_DISPLAY_PROJECTION_VERSION,
  ATLAS_DISPLAY_SEAM_LONGITUDE_TICKS,
  ATLAS_DISPLAY_SEAM_POLICY_VERSION,
  ATLAS_DISPLAY_WIDTH_TICKS,
  ATLAS_PROJECTION_DIAGNOSTIC_CODES,
  ATLAS_PROJECTION_SEMANTIC_TOLERANCE_TICKS,
  type AtlasDisplayPoint,
  type AtlasDisplayProjectionMetadata,
  type AtlasProjectedCoastline,
  type AtlasProjectedCoastlinePath,
  type AtlasProjectedPathId,
  type AtlasProjectionDiagnostic,
  type AtlasProjectionDiagnosticCode,
  type AtlasProjectionResult,
  projectAtlasCanonicalCoastline,
} from './atlas-display-projection.js';

/** Draws a render scene into a Canvas 2D context without changing its semantic interpretation. */
export function renderSceneToCanvas(context: CanvasRenderingContext2D, scene: RenderScene): void {
  for (const node of scene.nodes) {
    renderNodeToCanvas(context, node);
  }
}

/** Serializes a render scene as canonical SVG markup in the scene's node order. */
export function renderSceneToSvg(scene: RenderScene): string {
  const nodes = scene.nodes.map(renderNodeToSvg).join('\n  ');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${formatNumber(scene.widthPx)}" height="${formatNumber(scene.heightPx)}" viewBox="0 0 ${formatNumber(scene.widthPx)} ${formatNumber(scene.heightPx)}" role="img" aria-label="Inked map scene">`,
    `  ${nodes}`,
    '</svg>',
  ].join('\n');
}

function renderNodeToCanvas(context: CanvasRenderingContext2D, node: RenderNode): void {
  switch (node.kind) {
    case 'rectangle':
      context.fillStyle = node.fillColor;
      context.fillRect(node.xPx, node.yPx, node.widthPx, node.heightPx);
      return;
    case 'polygon':
      drawCanvasPath(context, node.points, true);
      context.fillStyle = node.paint.fillColor;
      context.fill();
      context.strokeStyle = node.paint.strokeColor;
      context.lineWidth = node.paint.strokeWidthPx;
      context.lineJoin = 'round';
      context.stroke();
      return;
    case 'polyline':
      drawCanvasPath(context, node.points, false);
      context.strokeStyle = node.strokeColor;
      context.lineWidth = node.strokeWidthPx;
      context.lineJoin = 'round';
      context.lineCap = 'round';
      context.stroke();
      return;
    case 'label':
      context.fillStyle = node.fillColor;
      context.font = `${String(node.fontWeight)} ${formatNumber(node.fontSizePx)}px ${node.fontFamily}`;
      context.textAlign = node.textAnchor === 'middle' ? 'center' : node.textAnchor;
      context.fillText(node.text, node.position.xPx, node.position.yPx);
      return;
  }
}

function drawCanvasPath(
  context: CanvasRenderingContext2D,
  points: readonly RenderPoint[],
  isClosed: boolean,
): void {
  const firstPoint = points[0];

  if (firstPoint === undefined) {
    return;
  }

  context.beginPath();
  context.moveTo(firstPoint.xPx, firstPoint.yPx);

  for (const point of points.slice(1)) {
    context.lineTo(point.xPx, point.yPx);
  }

  if (isClosed) {
    context.closePath();
  }
}

function renderNodeToSvg(node: RenderNode): string {
  switch (node.kind) {
    case 'rectangle':
      return `<rect data-render-node-id="${escapeXml(node.id)}" data-source-id="${escapeXml(node.sourceId)}" x="${formatNumber(node.xPx)}" y="${formatNumber(node.yPx)}" width="${formatNumber(node.widthPx)}" height="${formatNumber(node.heightPx)}" fill="${escapeXml(node.fillColor)}"/>`;
    case 'polygon':
      return `<polygon data-render-node-id="${escapeXml(node.id)}" data-source-id="${escapeXml(node.sourceId)}" points="${formatPoints(node.points)}" fill="${escapeXml(node.paint.fillColor)}" stroke="${escapeXml(node.paint.strokeColor)}" stroke-width="${formatNumber(node.paint.strokeWidthPx)}" stroke-linejoin="round"/>`;
    case 'polyline':
      return `<polyline data-render-node-id="${escapeXml(node.id)}" data-source-id="${escapeXml(node.sourceId)}" points="${formatPoints(node.points)}" fill="none" stroke="${escapeXml(node.strokeColor)}" stroke-width="${formatNumber(node.strokeWidthPx)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'label':
      return `<text data-render-node-id="${escapeXml(node.id)}" data-source-id="${escapeXml(node.sourceId)}" x="${formatNumber(node.position.xPx)}" y="${formatNumber(node.position.yPx)}" fill="${escapeXml(node.fillColor)}" font-family="${escapeXml(node.fontFamily)}" font-size="${formatNumber(node.fontSizePx)}" font-weight="${formatNumber(node.fontWeight)}" text-anchor="${node.textAnchor}">${escapeXml(node.text)}</text>`;
  }
}

function formatPoints(points: readonly RenderPoint[]): string {
  return points.map((point) => `${formatNumber(point.xPx)},${formatNumber(point.yPx)}`).join(' ');
}

function formatNumber(value: number): string {
  return String(value);
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
}
