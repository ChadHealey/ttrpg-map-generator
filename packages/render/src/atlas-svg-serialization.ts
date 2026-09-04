/** Pure atlas SVG markup serialization after export-policy validation. */

import type { RenderNode, RenderPoint } from '@ttrpg-map/core';

import type { AtlasRenderScene } from './atlas-scene.js';
import type { AtlasSvgDimensions, AtlasSvgStyleMetadata } from './atlas-svg-export.js';
import type { AtlasVectorGlyphDefinition, AtlasVectorLabelNode } from './atlas-vector-label.js';

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
  return serializeAtlasSvgUnchecked(input);
}

export type AtlasSvgBoundedSerializationResult =
  | { readonly ok: true; readonly value: { readonly svg: string; readonly byteLength: number } }
  | { readonly ok: false };

/** Serialize incrementally and never assemble an SVG whose UTF-8 bytes exceed the public limit. */
export function serializeAtlasSvgWithinByteLimit(
  input: AtlasSvgSerializationInput,
  maximumBytes: number,
): AtlasSvgBoundedSerializationResult {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 0) {
    return { ok: false };
  }
  const byteLength = atlasSvgSerializedByteLength(input);
  if (byteLength > maximumBytes) return { ok: false };
  return {
    ok: true,
    value: Object.freeze({ svg: serializeAtlasSvgUnchecked(input), byteLength }),
  };
}

function serializeAtlasSvgUnchecked(input: AtlasSvgSerializationInput): string {
  const labelById = new Map(
    input.scene.vectorLabels?.nodes.map((node) => [node.id, node] as const),
  );
  return `${[
    ...atlasSvgHeaderLines(input),
    ...input.scene.nodes.map((node) => {
      const label = labelById.get(node.id);
      return `    ${label === undefined ? renderAtlasSvgNode(node) : renderAtlasSvgLabelNode(node, label)}`;
    }),
    ...atlasSvgFooterLines(),
  ].join('\n')}\n`;
}

export function atlasSvgHeaderLines(input: AtlasSvgSerializationInput): string[] {
  return [
    ...atlasSvgHeaderPrefixLines(input),
    ...(input.scene.vectorLabels?.definitions ?? []).map(renderAtlasSvgGlyphDefinition),
    ...atlasSvgHeaderSuffixLines(input),
  ];
}

export function atlasSvgHeaderPrefixLines(input: AtlasSvgSerializationInput): string[] {
  const { dimensions, scene } = input;
  const svgIdPrefix = input.profileId;
  const metadata = atlasSvgMetadata(input);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${formatNumber(dimensions.widthMillimeters)}mm" height="${formatNumber(dimensions.heightMillimeters)}mm" viewBox="0 0 ${formatNumber(scene.widthPx)} ${formatNumber(scene.heightPx)}" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="${svgIdPrefix}-title" data-export-profile="${input.profileId}" data-export-version="${String(input.profileVersion)}">`,
    `  <title id="${svgIdPrefix}-title">Whole-world atlas</title>`,
    `  <metadata id="${svgIdPrefix}-metadata">${escapeXml(metadata)}</metadata>`,
    '  <defs>',
    `    <clipPath id="${svgIdPrefix}-clip" clipPathUnits="userSpaceOnUse">`,
    `      <rect x="0" y="0" width="${formatNumber(scene.widthPx)}" height="${formatNumber(scene.heightPx)}"/>`,
    '    </clipPath>',
  ];
}

export function atlasSvgHeaderSuffixLines(input: AtlasSvgSerializationInput): string[] {
  const svgIdPrefix = input.profileId;
  return [
    '  </defs>',
    `  <g id="${svgIdPrefix}-scene" clip-path="url(#${svgIdPrefix}-clip)" shape-rendering="geometricPrecision">`,
  ];
}

function atlasSvgMetadata(input: AtlasSvgSerializationInput): string {
  const { dimensions, scene, style } = input;
  return JSON.stringify({
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
}

export function renderAtlasSvgGlyphDefinition(glyph: AtlasVectorGlyphDefinition): string {
  const paths = glyph.contours
    .map(({ points }) => {
      const first = points[0];
      if (first === undefined) return '';
      return `M ${String(first.x)},${String(first.y)} ${points
        .slice(1)
        .map(({ x, y }) => `L ${String(x)},${String(y)}`)
        .join(' ')} Z`;
    })
    .join(' ');
  return `    <path id="glyph-${svgId('', glyph.glyphKey)}" data-glyph-key="${escapeXml(glyph.glyphKey)}" d="${paths}" fill-rule="evenodd"/>`;
}

export function renderAtlasSvgLabelNode(node: RenderNode, label: AtlasVectorLabelNode): string {
  const common = `id="${svgId('label', label.placementId)}" data-render-node-id="${escapeXml(node.id)}" data-source-id="${escapeXml(label.sourceId)}" data-source-aspect-id="${escapeXml(label.sourceNameAspectId)}" data-placement-id="${escapeXml(label.placementId)}"`;
  return `<g ${common}><title>${escapeXml(label.accessibilityText)}</title>${renderAtlasSvgNode(node)}</g>`;
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

function utf8ByteLength(value: string): number {
  let length = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    length += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return length;
}

interface SvgByteCounter {
  bytes: number;
}

export function atlasSvgSerializedByteLength(input: AtlasSvgSerializationInput): number {
  const counter: SvgByteCounter = { bytes: 0 };
  countTextLine(counter, '<?xml version="1.0" encoding="UTF-8"?>');
  countText(counter, '<svg xmlns="http://www.w3.org/2000/svg" width="');
  countNumber(counter, input.dimensions.widthMillimeters);
  countText(counter, 'mm" height="');
  countNumber(counter, input.dimensions.heightMillimeters);
  countText(counter, 'mm" viewBox="0 0 ');
  countNumber(counter, input.scene.widthPx);
  countText(counter, ' ');
  countNumber(counter, input.scene.heightPx);
  countText(counter, '" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="');
  countText(counter, input.profileId);
  countText(counter, '-title" data-export-profile="');
  countText(counter, input.profileId);
  countText(counter, '" data-export-version="');
  countText(counter, String(input.profileVersion));
  countTextLine(counter, '">');
  countText(counter, '  <title id="');
  countText(counter, input.profileId);
  countTextLine(counter, '-title">Whole-world atlas</title>');
  countText(counter, '  <metadata id="');
  countText(counter, input.profileId);
  countText(counter, '-metadata">');
  countEscapedXml(counter, atlasSvgMetadata(input));
  countTextLine(counter, '</metadata>');
  countTextLine(counter, '  <defs>');
  countText(counter, '    <clipPath id="');
  countText(counter, input.profileId);
  countTextLine(counter, '-clip" clipPathUnits="userSpaceOnUse">');
  countText(counter, '      <rect x="0" y="0" width="');
  countNumber(counter, input.scene.widthPx);
  countText(counter, '" height="');
  countNumber(counter, input.scene.heightPx);
  countTextLine(counter, '"/>');
  countTextLine(counter, '    </clipPath>');
  for (const definition of input.scene.vectorLabels?.definitions ?? []) {
    countGlyphDefinitionLine(counter, definition);
  }
  countTextLine(counter, '  </defs>');
  countText(counter, '  <g id="');
  countText(counter, input.profileId);
  countText(counter, '-scene" clip-path="url(#');
  countText(counter, input.profileId);
  countTextLine(counter, '-clip)" shape-rendering="geometricPrecision">');

  const labels = new Map(input.scene.vectorLabels?.nodes.map((node) => [node.id, node] as const));
  for (const node of input.scene.nodes) {
    countText(counter, '    ');
    const label = labels.get(node.id);
    if (label === undefined) countRenderNode(counter, node);
    else countRenderLabelNode(counter, node, label);
    countNewline(counter);
  }
  countTextLine(counter, '  </g>');
  countTextLine(counter, '</svg>');
  return counter.bytes;
}

function countGlyphDefinitionLine(
  counter: SvgByteCounter,
  glyph: AtlasVectorGlyphDefinition,
): void {
  countText(counter, '    <path id="glyph-');
  countSvgId(counter, '', glyph.glyphKey);
  countText(counter, '" data-glyph-key="');
  countEscapedXml(counter, glyph.glyphKey);
  countText(counter, '" d="');
  for (const [contourIndex, contour] of glyph.contours.entries()) {
    if (contourIndex > 0) countText(counter, ' ');
    const first = contour.points[0];
    if (first === undefined) continue;
    countText(counter, 'M ');
    countInteger(counter, first.x);
    countText(counter, ',');
    countInteger(counter, first.y);
    countText(counter, ' ');
    for (let pointIndex = 1; pointIndex < contour.points.length; pointIndex += 1) {
      if (pointIndex > 1) countText(counter, ' ');
      const point = contour.points[pointIndex];
      if (point === undefined) continue;
      countText(counter, 'L ');
      countInteger(counter, point.x);
      countText(counter, ',');
      countInteger(counter, point.y);
    }
    countText(counter, ' Z');
  }
  countTextLine(counter, '" fill-rule="evenodd"/>');
}

function countRenderLabelNode(
  counter: SvgByteCounter,
  node: RenderNode,
  label: AtlasVectorLabelNode,
): void {
  countText(counter, '<g id="');
  countSvgId(counter, 'label', label.placementId);
  countText(counter, '" data-render-node-id="');
  countEscapedXml(counter, node.id);
  countText(counter, '" data-source-id="');
  countEscapedXml(counter, label.sourceId);
  countText(counter, '" data-source-aspect-id="');
  countEscapedXml(counter, label.sourceNameAspectId);
  countText(counter, '" data-placement-id="');
  countEscapedXml(counter, label.placementId);
  countText(counter, '"><title>');
  countEscapedXml(counter, label.accessibilityText);
  countText(counter, '</title>');
  countRenderNode(counter, node);
  countText(counter, '</g>');
}

function countRenderNode(counter: SvgByteCounter, node: RenderNode): void {
  switch (node.kind) {
    case 'rectangle':
      countText(counter, '<rect ');
      countRenderNodeCommon(counter, node);
      countText(counter, ' x="');
      countNumber(counter, node.xPx);
      countText(counter, '" y="');
      countNumber(counter, node.yPx);
      countText(counter, '" width="');
      countNumber(counter, node.widthPx);
      countText(counter, '" height="');
      countNumber(counter, node.heightPx);
      countText(counter, '" fill="');
      countText(counter, node.fillColor);
      countText(counter, '"/>');
      return;
    case 'polygon':
      countText(counter, '<polygon ');
      countRenderNodeCommon(counter, node);
      countText(counter, ' points="');
      countPoints(counter, node.points);
      countText(counter, '" fill="');
      countText(counter, node.paint.fillColor);
      countText(counter, '" stroke="');
      countText(counter, node.paint.strokeColor);
      countText(counter, '" stroke-width="');
      countNumber(counter, node.paint.strokeWidthPx);
      countText(counter, '" stroke-linejoin="round"/>');
      return;
    case 'compoundPath':
      countText(counter, '<path ');
      countRenderNodeCommon(counter, node);
      countText(counter, ' d="');
      countSubpaths(counter, node.subpaths);
      countText(counter, '" fill="');
      countText(counter, node.fillColor);
      countText(counter, '" fill-rule="');
      countText(counter, node.fillRule);
      countText(counter, '"/>');
      return;
    case 'polyline':
      countText(counter, '<polyline ');
      countRenderNodeCommon(counter, node);
      countText(counter, ' points="');
      countPoints(counter, node.points);
      countText(counter, '" fill="none" stroke="');
      countText(counter, node.strokeColor);
      countText(counter, '" stroke-width="');
      countNumber(counter, node.strokeWidthPx);
      countText(counter, '" stroke-linecap="round" stroke-linejoin="round"/>');
      return;
    case 'label':
      throw new Error('Validated atlas-svg-v1 scenes cannot contain rendered text.');
  }
}

function countRenderNodeCommon(counter: SvgByteCounter, node: RenderNode): void {
  countText(counter, 'id="');
  countSvgId(counter, 'node', node.id);
  countText(counter, '" data-render-node-id="');
  countEscapedXml(counter, node.id);
  countText(counter, '" data-source-id="');
  countEscapedXml(counter, node.sourceId);
  countText(counter, '" data-source-aspect-id="');
  countEscapedXml(counter, node.sourceAspectId ?? '');
  countText(counter, '" data-related-source-ids="');
  for (const [index, sourceId] of (node.relatedSourceIds ?? []).entries()) {
    if (index > 0) countText(counter, ',');
    countEscapedXml(counter, sourceId);
  }
  countText(counter, '"');
}

function countSubpaths(
  counter: SvgByteCounter,
  subpaths: readonly { readonly points: readonly RenderPoint[] }[],
): void {
  for (const [subpathIndex, { points }] of subpaths.entries()) {
    if (subpathIndex > 0) countText(counter, ' ');
    const first = points[0];
    if (first === undefined) continue;
    countText(counter, 'M ');
    countPoint(counter, first);
    for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
      const point = points[pointIndex];
      if (point === undefined) continue;
      countText(counter, ' L ');
      countPoint(counter, point);
    }
    countText(counter, ' Z');
  }
}

function countPoints(counter: SvgByteCounter, points: readonly RenderPoint[]): void {
  for (const [index, point] of points.entries()) {
    if (index > 0) countText(counter, ' ');
    countPoint(counter, point);
  }
}

function countPoint(counter: SvgByteCounter, point: RenderPoint): void {
  countNumber(counter, point.xPx);
  countText(counter, ',');
  countNumber(counter, point.yPx);
}

function countSvgId(counter: SvgByteCounter, prefix: string, value: string): void {
  counter.bytes += utf8ByteLength(prefix) + 1;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    const isUnescapedAscii =
      codePoint === 0x2d ||
      codePoint === 0x2e ||
      (codePoint >= 0x30 && codePoint <= 0x39) ||
      (codePoint >= 0x41 && codePoint <= 0x5a) ||
      (codePoint >= 0x61 && codePoint <= 0x7a);
    counter.bytes += isUnescapedAscii ? 1 : utf8ByteLength(character) * 4;
  }
}

function countEscapedXml(counter: SvgByteCounter, value: string): void {
  for (const character of value) {
    counter.bytes +=
      character === '&'
        ? 5
        : character === '<' || character === '>'
          ? 4
          : character === '"'
            ? 6
            : utf8ByteLength(character);
  }
}

function countTextLine(counter: SvgByteCounter, value: string): void {
  countText(counter, value);
  countNewline(counter);
}

function countText(counter: SvgByteCounter, value: string): void {
  counter.bytes += utf8ByteLength(value);
}

function countNumber(counter: SvgByteCounter, value: number): void {
  countText(counter, formatNumber(value));
}

function countInteger(counter: SvgByteCounter, value: number): void {
  countText(counter, String(value));
}

function countNewline(counter: SvgByteCounter): void {
  counter.bytes += 1;
}
