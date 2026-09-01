/** Immutable contracts and validation for deterministic outlined atlas glyph packs. */

import { sha256 } from './sha-256.js';

export const ATLAS_GLYPH_PACK_UNITS_PER_EM = 4_096 as const;
export const ATLAS_GLYPH_PACK_MAX_POINTS = 50_000 as const;
const ATLAS_ALEGREYA_SOURCE_URL =
  'https://github.com/google/fonts/blob/40478177239cbf3bac07908ef0738afee0f72be7/ofl/alegreya/Alegreya%5Bwght%5D.ttf';
const ATLAS_ALEGREYA_SOURCE_COMMIT = '40478177239cbf3bac07908ef0738afee0f72be7';
const ATLAS_ALEGREYA_SOURCE_SHA256 =
  'ba5564634b93a8f8ba57b48cd4f1ae7417d2b4656fbac779028679b00de3cf12';
export const ATLAS_GLYPH_PACK_SUPPORTED_CODE_POINTS = Object.freeze([
  0x20,
  ...Array.from({ length: 26 }, (_value, index) => 0x41 + index),
  ...Array.from({ length: 26 }, (_value, index) => 0x61 + index),
] as const);

export interface AtlasGlyphPoint {
  readonly x: number;
  readonly y: number;
}

export interface AtlasGlyphBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface AtlasGlyphContour {
  readonly points: readonly AtlasGlyphPoint[];
}

export interface AtlasGlyph {
  readonly glyphKey: string;
  readonly codePoint: number;
  readonly advanceWidth: number;
  readonly leftSideBearing: number;
  readonly bounds: AtlasGlyphBounds;
  readonly contours: readonly AtlasGlyphContour[];
}

export interface AtlasGlyphKerningPair {
  readonly leftGlyphKey: string;
  readonly rightGlyphKey: string;
  readonly adjustment: number;
}

export interface AtlasGlyphPackSource {
  readonly sourceUrl: string;
  readonly sourceCommit: string;
  readonly sourceSha256: string;
  readonly sourceByteLength: number;
  readonly licenseId: 'OFL-1.1';
}

export interface AtlasGlyphPack {
  readonly assetId: 'atlas-glyphs.alegreya-medium-ascii-v1';
  readonly assetSchemaVersion: 1;
  readonly glyphBehaviorVersion: 1;
  readonly unitsPerEm: typeof ATLAS_GLYPH_PACK_UNITS_PER_EM;
  readonly ascender: number;
  readonly descender: number;
  readonly lineGap: number;
  readonly tracking: number;
  readonly source: AtlasGlyphPackSource;
  readonly spaceAdvance: number;
  readonly glyphs: readonly AtlasGlyph[];
  readonly kerningPairs: readonly AtlasGlyphKerningPair[];
  readonly contourCount: number;
  readonly pointCount: number;
  readonly canonicalPackSha256: string;
}

export interface AtlasGlyphMetricSnapshot {
  readonly assetId: AtlasGlyphPack['assetId'];
  readonly assetSchemaVersion: number;
  readonly glyphBehaviorVersion: number;
  readonly packSha256: string;
  readonly unitsPerEm: number;
  readonly ascender: number;
  readonly descender: number;
  readonly lineGap: number;
  readonly tracking: number;
  readonly spaceAdvance: number;
  readonly glyphs: readonly Pick<
    AtlasGlyph,
    'glyphKey' | 'codePoint' | 'advanceWidth' | 'bounds'
  >[];
  readonly kerningPairs: readonly AtlasGlyphKerningPair[];
}

export type AtlasGlyphPackDiagnosticCode =
  | 'atlas-glyph-pack.asset.invalid'
  | 'atlas-glyph-pack.digest.mismatch'
  | 'atlas-glyph-pack.glyphs.invalid'
  | 'atlas-glyph-pack.contours.invalid'
  | 'atlas-glyph-pack.resource.exceeded';

export interface AtlasGlyphPackDiagnostic {
  readonly code: AtlasGlyphPackDiagnosticCode;
  readonly message: string;
}

export type AtlasGlyphPackValidationResult =
  | { readonly ok: true; readonly value: AtlasGlyphPack }
  | { readonly ok: false; readonly diagnostics: readonly AtlasGlyphPackDiagnostic[] };

export type AtlasGlyphMetricSnapshotResult =
  | { readonly ok: true; readonly value: AtlasGlyphMetricSnapshot }
  | { readonly ok: false; readonly diagnostics: readonly AtlasGlyphPackDiagnostic[] };

interface AtlasGlyphPackCandidate extends Omit<
  AtlasGlyphPack,
  'assetId' | 'assetSchemaVersion' | 'glyphBehaviorVersion' | 'unitsPerEm' | 'source'
> {
  readonly assetId: unknown;
  readonly assetSchemaVersion: unknown;
  readonly glyphBehaviorVersion: unknown;
  readonly unitsPerEm: unknown;
  readonly source: unknown;
}

/** Validate the exact version-1 pack without consulting a source font or rendering backend. */
export function validateAtlasGlyphPack(input: unknown): AtlasGlyphPackValidationResult {
  if (!isPack(input))
    return invalid('atlas-glyph-pack.asset.invalid', 'Glyph-pack shape is invalid.');
  const candidate = input;
  if (
    candidate.assetId !== 'atlas-glyphs.alegreya-medium-ascii-v1' ||
    candidate.assetSchemaVersion !== 1 ||
    candidate.glyphBehaviorVersion !== 1 ||
    candidate.unitsPerEm !== ATLAS_GLYPH_PACK_UNITS_PER_EM ||
    !isSafeInteger(candidate.ascender) ||
    !isSafeInteger(candidate.descender) ||
    !isSafeInteger(candidate.lineGap) ||
    !isSafeInteger(candidate.tracking) ||
    !isPositiveInteger(candidate.spaceAdvance) ||
    !validSource(candidate.source)
  ) {
    return invalid('atlas-glyph-pack.asset.invalid', 'Glyph-pack metadata is invalid.');
  }
  const supported = new Set(ATLAS_GLYPH_PACK_SUPPORTED_CODE_POINTS);
  if (
    candidate.glyphs.length !== supported.size - 1 ||
    candidate.glyphs.some((glyph) => !validGlyph(glyph, supported)) ||
    new Set(candidate.glyphs.map(({ codePoint }) => codePoint)).size !== candidate.glyphs.length ||
    new Set(candidate.glyphs.map(({ glyphKey }) => glyphKey)).size !== candidate.glyphs.length
  ) {
    return invalid('atlas-glyph-pack.glyphs.invalid', 'Glyph coverage or metrics are invalid.');
  }
  const glyphKeys = new Set(candidate.glyphs.map(({ glyphKey }) => glyphKey));
  if (
    candidate.kerningPairs.some(
      ({ leftGlyphKey, rightGlyphKey, adjustment }) =>
        !glyphKeys.has(leftGlyphKey) || !glyphKeys.has(rightGlyphKey) || !isSafeInteger(adjustment),
    ) ||
    !strictlyOrdered(
      candidate.kerningPairs,
      (pair) => `${pair.leftGlyphKey}\0${pair.rightGlyphKey}`,
    )
  ) {
    return invalid('atlas-glyph-pack.glyphs.invalid', 'Glyph kerning pairs are invalid.');
  }
  const contourCount = candidate.glyphs.reduce((total, glyph) => total + glyph.contours.length, 0);
  const pointCount = candidate.glyphs.reduce(
    (total, glyph) =>
      total + glyph.contours.reduce((sum, contour) => sum + contour.points.length, 0),
    0,
  );
  if (
    contourCount !== candidate.contourCount ||
    pointCount !== candidate.pointCount ||
    pointCount > ATLAS_GLYPH_PACK_MAX_POINTS
  ) {
    return invalid('atlas-glyph-pack.resource.exceeded', 'Glyph-pack resource totals are invalid.');
  }
  if (candidate.glyphs.some((glyph) => !validContours(glyph.contours))) {
    return invalid(
      'atlas-glyph-pack.contours.invalid',
      'Glyph contours are not canonical closed outlines.',
    );
  }
  const expectedDigest = atlasGlyphPackDigest(candidate as AtlasGlyphPack);
  if (expectedDigest !== candidate.canonicalPackSha256) {
    return invalid(
      'atlas-glyph-pack.digest.mismatch',
      'Glyph-pack canonical digest does not match its data.',
    );
  }
  return { ok: true, value: candidate as AtlasGlyphPack };
}

/** Extract the placement-safe metrics only after complete pack validation. */
export function createAtlasGlyphMetricSnapshot(
  input: AtlasGlyphPack,
): AtlasGlyphMetricSnapshotResult {
  const validated = validateAtlasGlyphPack(input);
  if (!validated.ok) return validated;
  const { value } = validated;
  return {
    ok: true,
    value: Object.freeze({
      assetId: value.assetId,
      assetSchemaVersion: value.assetSchemaVersion,
      glyphBehaviorVersion: value.glyphBehaviorVersion,
      packSha256: value.canonicalPackSha256,
      unitsPerEm: value.unitsPerEm,
      ascender: value.ascender,
      descender: value.descender,
      lineGap: value.lineGap,
      tracking: value.tracking,
      spaceAdvance: value.spaceAdvance,
      glyphs: Object.freeze(
        value.glyphs.map(({ glyphKey, codePoint, advanceWidth, bounds }) =>
          Object.freeze({
            glyphKey,
            codePoint,
            advanceWidth,
            bounds: Object.freeze({ ...bounds }),
          }),
        ),
      ),
      kerningPairs: Object.freeze(value.kerningPairs.map((pair) => Object.freeze({ ...pair }))),
    }),
  };
}

/** Return the SHA-256 digest of the canonical pack bytes with the digest field excluded. */
export function atlasGlyphPackDigest(pack: AtlasGlyphPack): string {
  const { canonicalPackSha256: _digest, ...content } = pack;
  return hex(sha256(new TextEncoder().encode(JSON.stringify(content))));
}

function validSource(source: unknown): boolean {
  if (typeof source !== 'object' || source === null) return false;
  const candidate = source as Record<string, unknown>;
  return (
    candidate.sourceUrl === ATLAS_ALEGREYA_SOURCE_URL &&
    candidate.sourceCommit === ATLAS_ALEGREYA_SOURCE_COMMIT &&
    candidate.sourceSha256 === ATLAS_ALEGREYA_SOURCE_SHA256 &&
    candidate.sourceByteLength === 425_288 &&
    candidate.licenseId === 'OFL-1.1'
  );
}

function validGlyph(glyph: AtlasGlyph, supported: ReadonlySet<number>): boolean {
  return (
    typeof glyph.glyphKey === 'string' &&
    glyph.glyphKey.length > 0 &&
    glyph.codePoint !== 0x20 &&
    supported.has(glyph.codePoint) &&
    isPositiveInteger(glyph.advanceWidth) &&
    isSafeInteger(glyph.leftSideBearing) &&
    validBounds(glyph.bounds)
  );
}

function validBounds(bounds: AtlasGlyphBounds): boolean {
  return (
    isSafeInteger(bounds.minX) &&
    isSafeInteger(bounds.minY) &&
    isSafeInteger(bounds.maxX) &&
    isSafeInteger(bounds.maxY) &&
    bounds.minX <= bounds.maxX &&
    bounds.minY <= bounds.maxY
  );
}

function validContours(contours: readonly AtlasGlyphContour[]): boolean {
  return contours.every(({ points }) => {
    if (points.length < 3 || points.some(({ x, y }) => !isSafeInteger(x) || !isSafeInteger(y)))
      return false;
    if (new Set(points.map(({ x, y }) => `${String(x)},${String(y)}`)).size < 3) return false;
    const first = points.at(0);
    if (first === undefined) return false;
    return (
      signedArea(points) < 0 &&
      first.x === minimumPoint(points).x &&
      first.y === minimumPoint(points).y
    );
  });
}

function minimumPoint(points: readonly AtlasGlyphPoint[]): AtlasGlyphPoint {
  return points.reduce((minimum, point) =>
    point.x < minimum.x || (point.x === minimum.x && point.y < minimum.y) ? point : minimum,
  );
}

function signedArea(points: readonly AtlasGlyphPoint[]): number {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length];
    if (next === undefined) throw new Error('Contour traversal lost its next point.');
    return area + point.x * next.y - next.x * point.y;
  }, 0);
}

function strictlyOrdered<T>(values: readonly T[], key: (value: T) => string): boolean {
  return values.every((value, index) => index === 0 || key(values[index - 1] as T) < key(value));
}

function isPositiveInteger(value: unknown): value is number {
  return isSafeInteger(value) && value > 0;
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function isPack(value: unknown): value is AtlasGlyphPackCandidate {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as AtlasGlyphPack).glyphs) &&
    Array.isArray((value as AtlasGlyphPack).kerningPairs)
  );
}

function invalid(
  code: AtlasGlyphPackDiagnosticCode,
  message: string,
): AtlasGlyphPackValidationResult {
  return { ok: false, diagnostics: Object.freeze([Object.freeze({ code, message })]) };
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
