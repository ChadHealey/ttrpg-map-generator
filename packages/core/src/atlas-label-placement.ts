/** Deterministic, renderer-independent placement for accepted world-atlas labels. */

import {
  type AtlasGlyphMetricSnapshot,
  validateAtlasGlyphMetricSnapshot,
} from './atlas-glyph-pack.js';
import {
  type BehaviorVersion,
  createBehaviorVersion,
  createParameterSchemaVersion,
  createVariantRevision,
  type ParameterSchemaVersion,
  type VariantRevision,
} from './compatibility.js';
import {
  type AspectReplacementProposal,
  type GenerationDiagnostic,
  type GenerationDiagnosticCode,
  orderGenerationDiagnostics,
  parseAspectName,
  parseGenerationDiagnosticCode,
} from './generated-aspects.js';
import {
  type AspectId,
  deriveStableId,
  type EntityId,
  type MapId,
  parseGeneratorId,
  parseSemanticKey,
} from './identity.js';
import {
  DETERMINISTIC_STREAM_VERSION,
  SEED_DERIVATION_VERSION,
  type WorldSeed,
} from './seed-input.js';
import {
  deriveWorldFeatureNameAspectId,
  validateWorldFeatureNameContent,
  type WorldFeatureNameContent,
} from './world-feature-name-model.js';

export const ATLAS_LABEL_RENDER_TICKS_PER_PIXEL = 1_024 as const;
export const ATLAS_LABEL_MAX_CODE_POINTS = 64 as const;
export const ATLAS_LABEL_MAX_VARIANTS = 16 as const;

export interface AtlasLabelTickPoint {
  readonly xTicks: number;
  readonly yTicks: number;
}

export interface AtlasLabelTickBounds {
  readonly minXTicks: number;
  readonly minYTicks: number;
  readonly maxXTicks: number;
  readonly maxYTicks: number;
}

export type AtlasLabelSceneExtent = AtlasLabelTickBounds;

export interface AtlasLabelPlacementVariant {
  readonly variantKey: string;
  readonly baselineOffset: AtlasLabelTickPoint;
}

export interface AtlasLabelPlacementCandidate {
  readonly nameContent: WorldFeatureNameContent;
  readonly placementVariantRevision: VariantRevision;
  readonly glyphPackSha256: string;
  readonly priority: number;
  readonly fontSizeTicks: number;
  readonly anchor: AtlasLabelTickPoint;
  readonly variants: readonly AtlasLabelPlacementVariant[];
}

export interface AtlasLabelGlyphOrigin extends AtlasLabelTickPoint {
  readonly glyphKey: string;
  readonly codePoint: number;
}

export interface AtlasLabelPlacement {
  readonly placementId: AspectId;
  readonly sourceEntityId: EntityId;
  readonly sourceNameAspectId: AspectId;
  readonly sourceNameVariantRevision: VariantRevision;
  readonly displayText: string;
  readonly glyphAssetId: AtlasGlyphMetricSnapshot['assetId'];
  readonly glyphAssetSchemaVersion: number;
  readonly glyphBehaviorVersion: number;
  readonly glyphPackSha256: string;
  readonly placementBehaviorVersion: BehaviorVersion;
  readonly variantRevision: VariantRevision;
  readonly priority: number;
  readonly fontSizeTicks: number;
  readonly baseline: AtlasLabelTickPoint;
  readonly bounds: AtlasLabelTickBounds;
  readonly glyphOrigins: readonly AtlasLabelGlyphOrigin[];
  readonly selectedVariantKey: string;
}

export interface AtlasLabelPlacementParameters {
  readonly parameterSchemaVersion: ParameterSchemaVersion;
  readonly placementBehaviorVersion: BehaviorVersion;
  readonly glyphPackSha256: string;
}

export type AtlasLabelPlacementProposal = AspectReplacementProposal<
  AtlasLabelPlacementParameters,
  AtlasLabelPlacement
>;

export interface ResolveAtlasLabelPlacementInput {
  readonly mapId: MapId;
  readonly worldSeed: WorldSeed;
  readonly sceneExtent: AtlasLabelSceneExtent;
  readonly metrics: AtlasGlyphMetricSnapshot;
  readonly candidates: readonly AtlasLabelPlacementCandidate[];
  /** Fixed accepted peers used only when resolving one changed placement. */
  readonly acceptedPeerPlacements?: readonly AtlasLabelPlacement[];
}

export type AtlasLabelPlacementResolution =
  | {
      readonly ok: true;
      readonly proposals: readonly AtlasLabelPlacementProposal[];
      readonly diagnostics: readonly GenerationDiagnostic[];
    }
  | { readonly ok: false; readonly diagnostics: readonly GenerationDiagnostic[] };

export const ATLAS_LABEL_PLACEMENT_ASPECT_NAME = required(parseAspectName('label.placement'));
export const ATLAS_LABEL_PLACEMENT_GENERATOR_ID = required(
  parseGeneratorId('atlasLabel.placement'),
);
export const ATLAS_LABEL_PLACEMENT_BEHAVIOR_VERSION = required(createBehaviorVersion(1));
export const ATLAS_LABEL_PLACEMENT_PARAMETER_SCHEMA_VERSION = required(
  createParameterSchemaVersion(1),
);
export const ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES = {
  invalidInput: required(parseGenerationDiagnosticCode('atlas-label.placement.input.invalid')),
  metricInvalid: required(parseGenerationDiagnosticCode('atlas-label.metric.invalid')),
  metricMismatch: required(parseGenerationDiagnosticCode('atlas-label.metric.mismatch')),
  textLength: required(parseGenerationDiagnosticCode('atlas-label.text.length-invalid')),
  textSpacing: required(parseGenerationDiagnosticCode('atlas-label.text.spacing-invalid')),
  glyphUnsupported: required(parseGenerationDiagnosticCode('atlas-label.glyph.unsupported')),
  bounds: required(parseGenerationDiagnosticCode('atlas-label.placement.bounds')),
  collision: required(parseGenerationDiagnosticCode('atlas-label.placement.collision')),
} as const;

const PLACEMENT_ASPECT_KEY = required(parseSemanticKey('atlas-label-placement'));
const VARIANT_KEY_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;

/** Derive a source-owned placement identity without using label text, anchors, or ordering. */
export function deriveAtlasLabelPlacementAspectId(entityId: EntityId): AspectId {
  return deriveStableId('aspect', entityId, PLACEMENT_ASPECT_KEY);
}

/** Resolve all valid candidates in priority/placement-ID order without renderer or font access. */
export function resolveAtlasLabelPlacements(
  input: ResolveAtlasLabelPlacementInput,
): AtlasLabelPlacementResolution {
  const metricResult = validateAtlasGlyphMetricSnapshot(input.metrics);
  if (!metricResult.ok)
    return invalid(input.candidates, ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.metricInvalid);
  if (!validExtent(input.sceneExtent))
    return invalid(input.candidates, ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.invalidInput);

  const candidates = orderedCandidates(input.candidates, metricResult.value);
  if (!candidates.ok) return invalid([candidates.candidate], candidates.code);

  const peerResult = orderedPeers(
    input.acceptedPeerPlacements ?? [],
    input.sceneExtent,
    metricResult.value,
  );
  if (!peerResult.ok) return invalid(input.candidates, peerResult.code);

  const proposals: AtlasLabelPlacementProposal[] = [];
  const diagnostics: GenerationDiagnostic[] = [];
  const occupied = [...peerResult.value];
  for (const candidate of candidates.value) {
    const resolved = resolveCandidate(candidate, input.sceneExtent, metricResult.value, occupied);
    if (!resolved.ok) {
      diagnostics.push(diagnostic(candidate, resolved.code));
      continue;
    }
    occupied.push(resolved.value);
    proposals.push(proposal(input.mapId, input.worldSeed, candidate, resolved.value));
  }
  return {
    ok: true,
    proposals: Object.freeze(proposals),
    diagnostics: orderGenerationDiagnostics(diagnostics),
  };
}

function resolveCandidate(
  candidate: AtlasLabelPlacementCandidate,
  extent: AtlasLabelSceneExtent,
  metrics: AtlasGlyphMetricSnapshot,
  occupied: readonly AtlasLabelPlacement[],
):
  | { readonly ok: true; readonly value: AtlasLabelPlacement }
  | {
      readonly ok: false;
      readonly code: GenerationDiagnosticCode;
    } {
  const variants = candidate.variants;
  let sawBounds = false;
  for (const variant of variants) {
    const measured = measure(candidate, variant, metrics);
    if (measured === undefined)
      return { ok: false, code: ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.bounds };
    if (!contains(extent, measured.bounds)) {
      sawBounds = true;
      continue;
    }
    if (occupied.some(({ bounds }) => overlaps(bounds, measured.bounds))) continue;
    return { ok: true, value: placement(candidate, variant, metrics, measured) };
  }
  return {
    ok: false,
    code: sawBounds
      ? ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.bounds
      : ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.collision,
  };
}

function placement(
  candidate: AtlasLabelPlacementCandidate,
  variant: AtlasLabelPlacementVariant,
  metrics: AtlasGlyphMetricSnapshot,
  measured: MeasuredLabel,
): AtlasLabelPlacement {
  return Object.freeze({
    placementId: deriveAtlasLabelPlacementAspectId(candidate.nameContent.entityId),
    sourceEntityId: candidate.nameContent.entityId,
    sourceNameAspectId: deriveWorldFeatureNameAspectId(candidate.nameContent.entityId),
    sourceNameVariantRevision: candidate.nameContent.variantRevision,
    displayText: candidate.nameContent.displayName,
    glyphAssetId: metrics.assetId,
    glyphAssetSchemaVersion: metrics.assetSchemaVersion,
    glyphBehaviorVersion: metrics.glyphBehaviorVersion,
    glyphPackSha256: metrics.packSha256,
    placementBehaviorVersion: ATLAS_LABEL_PLACEMENT_BEHAVIOR_VERSION,
    variantRevision: candidate.placementVariantRevision,
    priority: candidate.priority,
    fontSizeTicks: candidate.fontSizeTicks,
    baseline: measured.baseline,
    bounds: measured.bounds,
    glyphOrigins: Object.freeze(measured.glyphOrigins),
    selectedVariantKey: variant.variantKey,
  });
}

function proposal(
  mapId: MapId,
  worldSeed: WorldSeed,
  candidate: AtlasLabelPlacementCandidate,
  output: AtlasLabelPlacement,
): AtlasLabelPlacementProposal {
  const seedMetadata = Object.freeze({
    seedDerivationVersion: SEED_DERIVATION_VERSION,
    deterministicStreamVersion: DETERMINISTIC_STREAM_VERSION,
    seedScope: 'map/entity' as const,
    worldSeed,
    mapId,
    entityId: candidate.nameContent.entityId,
    generatorId: ATLAS_LABEL_PLACEMENT_GENERATOR_ID,
    generatorVersion: ATLAS_LABEL_PLACEMENT_BEHAVIOR_VERSION,
    aspectName: ATLAS_LABEL_PLACEMENT_ASPECT_NAME,
    variantRevision: candidate.placementVariantRevision,
  });
  return Object.freeze({
    status: 'proposed',
    target: Object.freeze({
      mapId,
      entityId: candidate.nameContent.entityId,
      aspect: Object.freeze({ aspectId: output.placementId }),
      aspectName: ATLAS_LABEL_PLACEMENT_ASPECT_NAME,
      variantRevision: candidate.placementVariantRevision,
    }),
    generatorId: ATLAS_LABEL_PLACEMENT_GENERATOR_ID,
    generatorVersion: ATLAS_LABEL_PLACEMENT_BEHAVIOR_VERSION,
    parameterSchemaVersion: ATLAS_LABEL_PLACEMENT_PARAMETER_SCHEMA_VERSION,
    parameters: Object.freeze({
      parameterSchemaVersion: ATLAS_LABEL_PLACEMENT_PARAMETER_SCHEMA_VERSION,
      placementBehaviorVersion: ATLAS_LABEL_PLACEMENT_BEHAVIOR_VERSION,
      glyphPackSha256: output.glyphPackSha256,
    }),
    seedScope: 'map/entity',
    seedMetadata,
    dependencyAspects: Object.freeze([{ aspectId: output.sourceNameAspectId }]),
    output,
    diagnostics: Object.freeze([]),
  });
}

interface MeasuredLabel {
  readonly baseline: AtlasLabelTickPoint;
  readonly bounds: AtlasLabelTickBounds;
  readonly glyphOrigins: readonly AtlasLabelGlyphOrigin[];
}

function measure(
  candidate: AtlasLabelPlacementCandidate,
  variant: AtlasLabelPlacementVariant,
  metrics: AtlasGlyphMetricSnapshot,
): MeasuredLabel | undefined {
  const baseline = add(candidate.anchor, variant.baselineOffset);
  if (baseline === undefined) return undefined;
  const glyphByCodePoint = new Map(
    metrics.glyphs.map((glyph) => [glyph.codePoint, glyph] as const),
  );
  const kerning = new Map(
    metrics.kerningPairs.map((pair) => [
      `${pair.leftGlyphKey}\0${pair.rightGlyphKey}`,
      pair.adjustment,
    ]),
  );
  const characters = Array.from(candidate.nameContent.displayName);
  let advance = 0n;
  let bounds: AtlasLabelTickBounds | undefined;
  const glyphOrigins: AtlasLabelGlyphOrigin[] = [];
  for (const [index, character] of characters.entries()) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) return undefined;
    if (codePoint === 0x20) {
      advance +=
        BigInt(metrics.spaceAdvance) +
        BigInt(trackingAfter(index, characters.length, metrics.tracking));
      continue;
    }
    const glyph = glyphByCodePoint.get(codePoint);
    if (glyph === undefined) return undefined;
    const xTicks = addScaled(baseline.xTicks, advance, candidate.fontSizeTicks, metrics.unitsPerEm);
    if (xTicks === undefined) return undefined;
    const origin = Object.freeze({
      glyphKey: glyph.glyphKey,
      codePoint,
      xTicks,
      yTicks: baseline.yTicks,
    });
    glyphOrigins.push(origin);
    const glyphBounds = transformBounds(
      glyph.bounds,
      baseline,
      advance,
      candidate.fontSizeTicks,
      metrics.unitsPerEm,
    );
    if (glyphBounds === undefined) return undefined;
    bounds = bounds === undefined ? glyphBounds : union(bounds, glyphBounds);
    const next = characters[index + 1];
    const nextCodePoint = next?.codePointAt(0);
    const nextGlyph =
      nextCodePoint === undefined || nextCodePoint === 0x20
        ? undefined
        : glyphByCodePoint.get(nextCodePoint);
    const pairAdjustment =
      nextGlyph === undefined ? 0 : (kerning.get(`${glyph.glyphKey}\0${nextGlyph.glyphKey}`) ?? 0);
    advance +=
      BigInt(glyph.advanceWidth) +
      BigInt(pairAdjustment) +
      BigInt(trackingAfter(index, characters.length, metrics.tracking));
  }
  return bounds === undefined
    ? undefined
    : Object.freeze({ baseline, bounds, glyphOrigins: Object.freeze(glyphOrigins) });
}

function transformBounds(
  bounds: {
    readonly minX: number;
    readonly minY: number;
    readonly maxX: number;
    readonly maxY: number;
  },
  baseline: AtlasLabelTickPoint,
  advance: bigint,
  fontSizeTicks: number,
  unitsPerEm: number,
): AtlasLabelTickBounds | undefined {
  const minXTicks = addScaled(
    baseline.xTicks,
    advance + BigInt(bounds.minX),
    fontSizeTicks,
    unitsPerEm,
  );
  const maxXTicks = addScaled(
    baseline.xTicks,
    advance + BigInt(bounds.maxX),
    fontSizeTicks,
    unitsPerEm,
  );
  const minYTicks = subtractScaled(baseline.yTicks, BigInt(bounds.maxY), fontSizeTicks, unitsPerEm);
  const maxYTicks = subtractScaled(baseline.yTicks, BigInt(bounds.minY), fontSizeTicks, unitsPerEm);
  if (
    minXTicks === undefined ||
    maxXTicks === undefined ||
    minYTicks === undefined ||
    maxYTicks === undefined
  ) {
    return undefined;
  }
  return Object.freeze({ minXTicks, minYTicks, maxXTicks, maxYTicks });
}

function addScaled(
  base: number,
  units: bigint,
  fontSizeTicks: number,
  unitsPerEm: number,
): number | undefined {
  return safeInteger(
    BigInt(base) +
      roundHalfTowardPositiveInfinity(units * BigInt(fontSizeTicks), BigInt(unitsPerEm)),
  );
}

function subtractScaled(
  base: number,
  units: bigint,
  fontSizeTicks: number,
  unitsPerEm: number,
): number | undefined {
  return safeInteger(
    BigInt(base) -
      roundHalfTowardPositiveInfinity(units * BigInt(fontSizeTicks), BigInt(unitsPerEm)),
  );
}

/** Exact ADR-0025 rounding for signed values with positive denominators. */
export function roundHalfTowardPositiveInfinity(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n)
    throw new RangeError('Atlas label rounding requires a positive denominator.');
  return floorDivision(2n * numerator + denominator, 2n * denominator);
}

function orderedCandidates(
  input: readonly AtlasLabelPlacementCandidate[],
  metrics: AtlasGlyphMetricSnapshot,
):
  | { readonly ok: true; readonly value: readonly AtlasLabelPlacementCandidate[] }
  | {
      readonly ok: false;
      readonly candidate: AtlasLabelPlacementCandidate;
      readonly code: GenerationDiagnosticCode;
    } {
  const invalidCandidate = input.find(
    (candidate) => candidateProblem(candidate, metrics) !== undefined,
  );
  if (invalidCandidate !== undefined) {
    return {
      ok: false,
      candidate: invalidCandidate,
      code:
        candidateProblem(invalidCandidate, metrics) ??
        ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.invalidInput,
    };
  }
  const ordered = [...input].sort((left, right) => {
    if (left.priority > right.priority) return -1;
    if (left.priority < right.priority) return 1;
    return comparePlacementIds(left, right);
  });
  const duplicate = ordered.find(
    (candidate, index) =>
      index > 0 &&
      deriveAtlasLabelPlacementAspectId(candidate.nameContent.entityId) ===
        deriveAtlasLabelPlacementAspectId(
          ordered[index - 1]?.nameContent.entityId ?? candidate.nameContent.entityId,
        ),
  );
  return duplicate === undefined
    ? { ok: true, value: Object.freeze(ordered) }
    : {
        ok: false,
        candidate: duplicate,
        code: ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.invalidInput,
      };
}

function orderedPeers(
  peers: readonly AtlasLabelPlacement[],
  extent: AtlasLabelSceneExtent,
  metrics: AtlasGlyphMetricSnapshot,
):
  | { readonly ok: true; readonly value: readonly AtlasLabelPlacement[] }
  | {
      readonly ok: false;
      readonly code: GenerationDiagnosticCode;
    } {
  if (peers.some((peer) => !validPeer(peer, extent, metrics))) {
    return { ok: false, code: ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.metricMismatch };
  }
  const ordered = [...peers].sort((left, right) => compareIds(left.placementId, right.placementId));
  return ordered.some((peer, index) => peer.placementId === ordered[index - 1]?.placementId)
    ? { ok: false, code: ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.invalidInput }
    : { ok: true, value: Object.freeze(ordered) };
}

function candidateProblem(
  candidate: AtlasLabelPlacementCandidate,
  metrics: AtlasGlyphMetricSnapshot,
): GenerationDiagnosticCode | undefined {
  const text = candidate.nameContent.displayName;
  if (text.length === 0 || Array.from(text).length > ATLAS_LABEL_MAX_CODE_POINTS)
    return ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.textLength;
  if (!validLabelText(text)) return ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.textSpacing;
  if (
    Array.from(text).some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== 0x20 && !metrics.glyphs.some((glyph) => glyph.codePoint === codePoint);
    })
  ) {
    return ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.glyphUnsupported;
  }
  if (!validateWorldFeatureNameContent(candidate.nameContent))
    return ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.invalidInput;
  if (candidate.glyphPackSha256 !== metrics.packSha256)
    return ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.metricMismatch;
  if (
    !createVariantRevision(candidate.placementVariantRevision).ok ||
    !isSha256(candidate.glyphPackSha256) ||
    !isSafeInteger(candidate.priority) ||
    !isPositiveSafeInteger(candidate.fontSizeTicks) ||
    !validPoint(candidate.anchor) ||
    candidate.variants.length === 0 ||
    candidate.variants.length > ATLAS_LABEL_MAX_VARIANTS ||
    new Set(candidate.variants.map(({ variantKey }) => variantKey)).size !==
      candidate.variants.length ||
    !candidate.variants.every(validVariant)
  ) {
    return ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.invalidInput;
  }
  return undefined;
}

function validPeer(
  peer: AtlasLabelPlacement,
  extent: AtlasLabelSceneExtent,
  metrics: AtlasGlyphMetricSnapshot,
): boolean {
  return (
    peer.glyphAssetSchemaVersion === metrics.assetSchemaVersion &&
    peer.glyphBehaviorVersion === metrics.glyphBehaviorVersion &&
    peer.glyphPackSha256 === metrics.packSha256 &&
    validBounds(peer.bounds) &&
    contains(extent, peer.bounds)
  );
}

function validLabelText(text: string): boolean {
  return !text.startsWith(' ') && !text.endsWith(' ') && !text.includes('  ');
}

function validVariant(variant: AtlasLabelPlacementVariant): boolean {
  return VARIANT_KEY_PATTERN.test(variant.variantKey) && validPoint(variant.baselineOffset);
}

function validExtent(value: AtlasLabelSceneExtent): boolean {
  return (
    validBounds(value) && value.minXTicks < value.maxXTicks && value.minYTicks < value.maxYTicks
  );
}

function validBounds(value: AtlasLabelTickBounds): boolean {
  return (
    isSafeInteger(value.minXTicks) &&
    isSafeInteger(value.minYTicks) &&
    isSafeInteger(value.maxXTicks) &&
    isSafeInteger(value.maxYTicks) &&
    value.minXTicks <= value.maxXTicks &&
    value.minYTicks <= value.maxYTicks
  );
}

function validPoint(value: AtlasLabelTickPoint): boolean {
  return isSafeInteger(value.xTicks) && isSafeInteger(value.yTicks);
}

function trackingAfter(index: number, count: number, tracking: number): number {
  return index + 1 < count ? tracking : 0;
}

function contains(container: AtlasLabelTickBounds, target: AtlasLabelTickBounds): boolean {
  return (
    target.minXTicks >= container.minXTicks &&
    target.minYTicks >= container.minYTicks &&
    target.maxXTicks <= container.maxXTicks &&
    target.maxYTicks <= container.maxYTicks
  );
}

function overlaps(left: AtlasLabelTickBounds, right: AtlasLabelTickBounds): boolean {
  return (
    left.minXTicks < right.maxXTicks &&
    left.maxXTicks > right.minXTicks &&
    left.minYTicks < right.maxYTicks &&
    left.maxYTicks > right.minYTicks
  );
}

function union(left: AtlasLabelTickBounds, right: AtlasLabelTickBounds): AtlasLabelTickBounds {
  return Object.freeze({
    minXTicks: Math.min(left.minXTicks, right.minXTicks),
    minYTicks: Math.min(left.minYTicks, right.minYTicks),
    maxXTicks: Math.max(left.maxXTicks, right.maxXTicks),
    maxYTicks: Math.max(left.maxYTicks, right.maxYTicks),
  });
}

function add(
  left: AtlasLabelTickPoint,
  right: AtlasLabelTickPoint,
): AtlasLabelTickPoint | undefined {
  const xTicks = safeInteger(BigInt(left.xTicks) + BigInt(right.xTicks));
  const yTicks = safeInteger(BigInt(left.yTicks) + BigInt(right.yTicks));
  return xTicks === undefined || yTicks === undefined
    ? undefined
    : Object.freeze({ xTicks, yTicks });
}

function safeInteger(value: bigint): number | undefined {
  const result = Number(value);
  return Number.isSafeInteger(result) ? result : undefined;
}

function floorDivision(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  return numerator < 0n && numerator % denominator !== 0n ? quotient - 1n : quotient;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return isSafeInteger(value) && value > 0;
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/u.test(value);
}

function comparePlacementIds(
  left: AtlasLabelPlacementCandidate,
  right: AtlasLabelPlacementCandidate,
): number {
  return compareIds(
    deriveAtlasLabelPlacementAspectId(left.nameContent.entityId),
    deriveAtlasLabelPlacementAspectId(right.nameContent.entityId),
  );
}

function compareIds(left: string, right: string): -1 | 0 | 1 {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function diagnostic(
  candidate: AtlasLabelPlacementCandidate,
  code: GenerationDiagnosticCode,
): GenerationDiagnostic {
  return Object.freeze({
    code,
    severity: 'error',
    target: Object.freeze({
      aspectId: deriveAtlasLabelPlacementAspectId(candidate.nameContent.entityId),
    }),
    message: diagnosticMessage(code),
    suggestedAction: 'Adjust the explicit label candidate or placement controls and resolve again.',
  });
}

function invalid(
  candidates: readonly AtlasLabelPlacementCandidate[],
  code: GenerationDiagnosticCode,
): AtlasLabelPlacementResolution {
  const fallback = candidates[0];
  if (fallback === undefined) {
    return { ok: false, diagnostics: Object.freeze([]) };
  }
  return { ok: false, diagnostics: Object.freeze([diagnostic(fallback, code)]) };
}

function diagnosticMessage(code: GenerationDiagnosticCode): string {
  const messages: Readonly<Record<string, string>> = {
    [ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.invalidInput]:
      'Atlas label placement input is invalid.',
    [ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.metricInvalid]:
      'Atlas label metric snapshot is invalid.',
    [ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.metricMismatch]:
      'Atlas label metric snapshot does not match accepted peers.',
    [ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.textLength]: 'Atlas label text length is invalid.',
    [ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.textSpacing]: 'Atlas label text spacing is invalid.',
    [ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.glyphUnsupported]:
      'Atlas label contains an unsupported glyph.',
    [ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.bounds]:
      'No supplied atlas label variant remains inside the fixed extent.',
    [ATLAS_LABEL_PLACEMENT_DIAGNOSTIC_CODES.collision]:
      'Every in-bounds atlas label variant collides with an accepted placement.',
  };
  return messages[code] ?? 'Atlas label placement failed.';
}

function required<Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false },
): Value {
  if (!result.ok) throw new Error('Internal atlas label placement contract constant is invalid.');
  return result.value;
}
