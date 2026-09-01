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
  atlasDisplayPointFromPlanetPoint,
  type AtlasDisplayPointResult,
  type AtlasDisplayProjectionMetadata,
  type AtlasProjectedCoastline,
  type AtlasProjectedCoastlinePath,
  type AtlasProjectedDisplayPath,
  type AtlasProjectedPathId,
  type AtlasProjectionDiagnostic,
  type AtlasProjectionDiagnosticCode,
  type AtlasProjectionResult,
  atlasScenePointFromDisplayPoint,
  planetPointFromAtlasDisplayPoint,
  planetPointFromAtlasScenePoint,
  projectAtlasCanonicalCoastline,
  projectAtlasPlanetPolyline,
} from './atlas-display-projection.js';
export {
  ATLAS_PNG_COLOR_PROFILE,
  ATLAS_PNG_DEFAULT_DIMENSIONS,
  ATLAS_PNG_DIAGNOSTIC_CODES,
  ATLAS_PNG_ENCODING_POLICY,
  ATLAS_PNG_EXPORT_PROFILE_ID,
  ATLAS_PNG_EXPORT_VERSION,
  ATLAS_PNG_FONT_POLICY,
  ATLAS_PNG_MAXIMUM_BYTES,
  ATLAS_PNG_MAXIMUM_COMPRESSED_ASSEMBLY_BYTES,
  ATLAS_PNG_MAXIMUM_CONCURRENT_ENCODED_BYTES,
  ATLAS_PNG_PHYSICAL_OVERLAY_EXPORT_PROFILE_ID,
  ATLAS_PNG_PHYSICAL_OVERLAY_EXPORT_VERSION,
  ATLAS_PNG_SUPPORTED_DIMENSIONS,
  ATLAS_PNG_SUPPORTED_STYLE_ID,
  ATLAS_PNG_TILE_POLICY,
  type AtlasPngDiagnostic,
  type AtlasPngDiagnosticCode,
  type AtlasPngDimensions,
  type AtlasPngExport,
  type AtlasPngExportProgress,
  type AtlasPngExportRequest,
  type AtlasPngExportResources,
  type AtlasPngExportResult,
  type AtlasPngExportRuntime,
  type AtlasPngPhysicalOverlayExport,
  type AtlasPngPhysicalOverlayExportProgress,
  type AtlasPngPhysicalOverlayExportRequest,
  type AtlasPngPhysicalOverlayExportResult,
  type AtlasPngPhysicalOverlayExportRuntime,
  type AtlasPngSceneInput,
  type AtlasPngStyleMetadata,
  exportAtlasSceneToPngAsync,
  exportAtlasSceneToPngWithPhysicalOverlaysAsync,
} from './atlas-png-export.js';
export {
  ATLAS_SCENE_COMPOSITION_VERSION,
  ATLAS_SCENE_DIAGNOSTIC_CODES,
  ATLAS_SCENE_HEIGHT_PX,
  ATLAS_SCENE_LEVELS_OF_DETAIL,
  ATLAS_SCENE_WIDTH_PX,
  type AtlasRenderScene,
  type AtlasSceneCompositionOptions,
  type AtlasSceneCompositionResult,
  type AtlasSceneDiagnostic,
  type AtlasSceneDiagnosticCode,
  type AtlasSceneLevelOfDetail,
  composeAtlasRenderScene,
} from './atlas-scene.js';
export {
  ATLAS_SVG_DEFAULT_DIMENSIONS,
  ATLAS_SVG_DIAGNOSTIC_CODES,
  ATLAS_SVG_DIMENSION_LIMITS,
  ATLAS_SVG_EXPORT_PROFILE_ID,
  ATLAS_SVG_EXPORT_VERSION,
  ATLAS_SVG_FONT_POLICY,
  ATLAS_SVG_MAXIMUM_BYTES,
  ATLAS_SVG_PHYSICAL_OVERLAY_EXPORT_PROFILE_ID,
  ATLAS_SVG_PHYSICAL_OVERLAY_EXPORT_VERSION,
  ATLAS_SVG_SUPPORTED_STYLE_ID,
  type AtlasSvgDiagnostic,
  type AtlasSvgDiagnosticCode,
  type AtlasSvgDimensions,
  type AtlasSvgExport,
  type AtlasSvgExportProgress,
  type AtlasSvgExportRequest,
  type AtlasSvgExportResult,
  type AtlasSvgExportRuntime,
  type AtlasSvgPhysicalOverlayExport,
  type AtlasSvgPhysicalOverlayExportProgress,
  type AtlasSvgPhysicalOverlayExportRequest,
  type AtlasSvgPhysicalOverlayExportResult,
  type AtlasSvgPhysicalOverlayExportRuntime,
  type AtlasSvgSceneInput,
  type AtlasSvgStyleMetadata,
  exportAtlasSceneToSvg,
  exportAtlasSceneToSvgAsync,
  exportAtlasSceneToSvgWithPhysicalOverlays,
  exportAtlasSceneToSvgWithPhysicalOverlaysAsync,
} from './atlas-svg-export.js';

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
    case 'compoundPath':
      context.beginPath();
      for (const subpath of node.subpaths) appendCanvasSubpath(context, subpath.points, true);
      context.fillStyle = node.fillColor;
      context.fill(node.fillRule);
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
  context.beginPath();
  appendCanvasSubpath(context, points, isClosed);
}

function appendCanvasSubpath(
  context: CanvasRenderingContext2D,
  points: readonly RenderPoint[],
  isClosed: boolean,
): void {
  const firstPoint = points[0];

  if (firstPoint === undefined) {
    return;
  }

  context.moveTo(firstPoint.xPx, firstPoint.yPx);

  for (const point of points.slice(1)) {
    context.lineTo(point.xPx, point.yPx);
  }

  if (isClosed) {
    context.closePath();
  }
}

function renderNodeToSvg(node: RenderNode): string {
  const sourceAttributes = renderSourceAttributes(node);
  switch (node.kind) {
    case 'rectangle':
      return `<rect data-render-node-id="${escapeXml(node.id)}" ${sourceAttributes} x="${formatNumber(node.xPx)}" y="${formatNumber(node.yPx)}" width="${formatNumber(node.widthPx)}" height="${formatNumber(node.heightPx)}" fill="${escapeXml(node.fillColor)}"/>`;
    case 'polygon':
      return `<polygon data-render-node-id="${escapeXml(node.id)}" ${sourceAttributes} points="${formatPoints(node.points)}" fill="${escapeXml(node.paint.fillColor)}" stroke="${escapeXml(node.paint.strokeColor)}" stroke-width="${formatNumber(node.paint.strokeWidthPx)}" stroke-linejoin="round"/>`;
    case 'compoundPath':
      return `<path data-render-node-id="${escapeXml(node.id)}" ${sourceAttributes} d="${formatSubpaths(node.subpaths)}" fill="${escapeXml(node.fillColor)}" fill-rule="${node.fillRule}"/>`;
    case 'polyline':
      return `<polyline data-render-node-id="${escapeXml(node.id)}" ${sourceAttributes} points="${formatPoints(node.points)}" fill="none" stroke="${escapeXml(node.strokeColor)}" stroke-width="${formatNumber(node.strokeWidthPx)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'label':
      return `<text data-render-node-id="${escapeXml(node.id)}" ${sourceAttributes} x="${formatNumber(node.position.xPx)}" y="${formatNumber(node.position.yPx)}" fill="${escapeXml(node.fillColor)}" font-family="${escapeXml(node.fontFamily)}" font-size="${formatNumber(node.fontSizePx)}" font-weight="${formatNumber(node.fontWeight)}" text-anchor="${node.textAnchor}">${escapeXml(node.text)}</text>`;
  }
}

function renderSourceAttributes(node: RenderNode): string {
  const attributes = [`data-source-id="${escapeXml(node.sourceId)}"`];
  if (node.sourceAspectId !== undefined) {
    attributes.push(`data-source-aspect-id="${escapeXml(node.sourceAspectId)}"`);
  }
  if (node.relatedSourceIds !== undefined) {
    attributes.push(`data-related-source-ids="${escapeXml(node.relatedSourceIds.join(','))}"`);
  }
  return attributes.join(' ');
}

function formatSubpaths(subpaths: readonly { readonly points: readonly RenderPoint[] }[]): string {
  return subpaths
    .map(({ points }) => {
      const first = points[0];
      if (first === undefined) return '';
      const remainder = points
        .slice(1)
        .map((point) => `L ${formatNumber(point.xPx)},${formatNumber(point.yPx)}`)
        .join(' ');
      return `M ${formatNumber(first.xPx)},${formatNumber(first.yPx)}${remainder === '' ? '' : ` ${remainder}`} Z`;
    })
    .filter(Boolean)
    .join(' ');
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
