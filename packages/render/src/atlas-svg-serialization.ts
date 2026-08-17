/** Pure atlas SVG markup serialization after export-policy validation. */

import type { RenderNode, RenderPoint } from '@ttrpg-map/core';

import type { AtlasRenderScene } from './atlas-scene.js';
import type { AtlasSvgDimensions, AtlasSvgStyleMetadata } from './atlas-svg-export.js';

export interface AtlasSvgSerializationInput {
  readonly scene: AtlasRenderScene;
  readonly style: AtlasSvgStyleMetadata;
  readonly dimensions: AtlasSvgDimensions;
  readonly profileId: string;
  readonly profileVersion: number;
  readonly fontPolicy: string;
}

const UTF8_ENCODER = new TextEncoder();

export function serializeAtlasSvg(input: AtlasSvgSerializationInput): string {
  return `${[
    ...atlasSvgHeaderLines(input),
    ...input.scene.nodes.map((node) => `    ${renderAtlasSvgNode(node)}`),
    ...atlasSvgFooterLines(),
  ].join('\n')}\n`;
}

export function atlasSvgHeaderLines(input: AtlasSvgSerializationInput): string[] {
  const { dimensions, scene, style } = input;
  const metadata = JSON.stringify({
    exportProfileId: input.profileId,
    exportProfileVersion: input.profileVersion,
    sourceWorldMapId: scene.sourceWorldMapId,
    sceneCompositionVersion: scene.sceneCompositionVersion,
    coordinateSpace: scene.coordinateSpace,
    projectionId: scene.projection.projectionId,
    projectionVersion: scene.projection.projectionVersion,
    seamPolicyVersion: scene.projection.seamPolicyVersion,
    styleId: style.styleId,
    styleBehaviorVersion: style.styleBehaviorVersion,
    styleTokenVersion: style.tokenVersion,
    widthMillimeters: dimensions.widthMillimeters,
    heightMillimeters: dimensions.heightMillimeters,
    viewBox: [0, 0, scene.widthPx, scene.heightPx],
    fontPolicy: input.fontPolicy,
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${formatNumber(dimensions.widthMillimeters)}mm" height="${formatNumber(dimensions.heightMillimeters)}mm" viewBox="0 0 ${formatNumber(scene.widthPx)} ${formatNumber(scene.heightPx)}" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="atlas-svg-v1-title" data-export-profile="${input.profileId}" data-export-version="${String(input.profileVersion)}">`,
    '  <title id="atlas-svg-v1-title">Whole-world atlas</title>',
    `  <metadata id="atlas-svg-v1-metadata">${escapeXml(metadata)}</metadata>`,
    '  <defs>',
    '    <clipPath id="atlas-svg-v1-clip" clipPathUnits="userSpaceOnUse">',
    `      <rect x="0" y="0" width="${formatNumber(scene.widthPx)}" height="${formatNumber(scene.heightPx)}"/>`,
    '    </clipPath>',
    '  </defs>',
    '  <g id="atlas-svg-v1-scene" clip-path="url(#atlas-svg-v1-clip)" shape-rendering="geometricPrecision">',
  ];
}

export function atlasSvgFooterLines(): readonly string[] {
  return ['  </g>', '</svg>'];
}

export function renderAtlasSvgNode(node: RenderNode): string {
  const common = `id="${svgId('node', node.id)}" data-render-node-id="${escapeXml(node.id)}" ${renderSourceAttributes(node)}`;
  switch (node.kind) {
    case 'rectangle':
      return `<rect ${common} x="${formatNumber(node.xPx)}" y="${formatNumber(node.yPx)}" width="${formatNumber(node.widthPx)}" height="${formatNumber(node.heightPx)}" fill="${node.fillColor}"/>`;
    case 'polygon':
      return `<polygon ${common} points="${formatPoints(node.points)}" fill="${node.paint.fillColor}" stroke="${node.paint.strokeColor}" stroke-width="${formatNumber(node.paint.strokeWidthPx)}" stroke-linejoin="round"/>`;
    case 'compoundPath':
      return `<path ${common} d="${formatSubpaths(node.subpaths)}" fill="${node.fillColor}" fill-rule="${node.fillRule}"/>`;
    case 'polyline':
      return `<polyline ${common} points="${formatPoints(node.points)}" fill="none" stroke="${node.strokeColor}" stroke-width="${formatNumber(node.strokeWidthPx)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'label':
      throw new Error('Validated atlas-svg-v1 scenes cannot contain rendered text.');
  }
}

function renderSourceAttributes(node: RenderNode): string {
  const related = node.relatedSourceIds ?? [];
  return `data-source-id="${escapeXml(node.sourceId)}" data-source-aspect-id="${escapeXml(node.sourceAspectId ?? '')}" data-related-source-ids="${escapeXml(related.join(','))}"`;
}

function formatSubpaths(subpaths: readonly { readonly points: readonly RenderPoint[] }[]): string {
  return subpaths
    .map(({ points }) => {
      const first = points[0];
      if (first === undefined) return '';
      const rest = points
        .slice(1)
        .map((point) => `L ${formatPoint(point)}`)
        .join(' ');
      return `M ${formatPoint(first)}${rest.length === 0 ? '' : ` ${rest}`} Z`;
    })
    .join(' ');
}

function formatPoints(points: readonly RenderPoint[]): string {
  return points.map(formatPoint).join(' ');
}

function formatPoint(point: RenderPoint): string {
  return `${formatNumber(point.xPx)},${formatNumber(point.yPx)}`;
}

/** Version 1 uses fixed six-place rounding, trimmed zeros, and one spelling for negative zero. */
function formatNumber(value: number): string {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  if (Object.is(rounded, -0) || rounded === 0) return '0';
  return rounded.toFixed(6).replace(/\.?0+$/u, '');
}

function svgId(prefix: string, value: string): string {
  let encoded = '';
  for (const byte of UTF8_ENCODER.encode(value)) {
    const character = String.fromCharCode(byte);
    encoded += /^[A-Za-z0-9.-]$/u.test(character)
      ? character
      : `_x${byte.toString(16).padStart(2, '0')}`;
  }
  return `${prefix}-${encoded}`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
