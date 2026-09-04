/** Canonical scene records and exact contour expansion for outlined atlas labels. */

import {
  type AcceptedAtlasLabelRecords,
  type AspectId,
  ATLAS_GLYPH_PACK_MAX_POINTS,
  ATLAS_GLYPH_PACK_UNITS_PER_EM,
  ATLAS_LABEL_MAX_CODE_POINTS,
  ATLAS_LABEL_PLACEMENT_BEHAVIOR_VERSION,
  ATLAS_LABEL_RENDER_TICKS_PER_PIXEL,
  type AtlasGlyph,
  type AtlasGlyphPack,
  deriveAtlasLabelPlacementAspectId,
  deriveWorldFeatureNameAspectId,
  type EntityId,
  parseStableId,
  parseVariantRevision,
  parseWorldFeatureNameDisplayName,
  type RenderCompoundPath,
  type RenderPoint,
  sha256,
  validateAtlasGlyphPack,
  validateWorldFeatureNameContent,
} from '@ttrpg-map/core';

export const ATLAS_VECTOR_LABEL_MAXIMUM_NODES = 256 as const;
export const ATLAS_VECTOR_LABEL_MAXIMUM_GLYPH_INSTANCES = 4_096 as const;
export const ATLAS_VECTOR_LABEL_MAXIMUM_STORED_POINTS = 250_000 as const;
export const ATLAS_VECTOR_LABEL_FONT_POLICY = 'outlined-ascii-glyphs-v1' as const;

const RELEASED_GLYPH_ASSET_ID = 'atlas-glyphs.alegreya-medium-ascii-v1' as const;
const RELEASED_GLYPH_PACK_SHA256 =
  'aafd639d37f5e6a9f4a2be8e773dd8a74bb96760486c800c28c827de624bb557' as const;
// SHA-256 of each released definition's canonical {glyphKey, codePoint, contours} JSON. A scene
// carries only used definitions, so these commitments authenticate the subset without importing
// the sibling assets package or copying the full pack into every disposable scene.
const RELEASED_GLYPH_DEFINITION_SHA256: Readonly<Record<string, string>> = Object.freeze({
  A: '30e761a2031594cbe27e103b54293992e5abfa8ad401d961efad453c2f25a79a',
  B: '1884451fe6197dcdd2f60ba5572bc4cccd03c79e38a8c22acf3dccc643918487',
  C: '4cd2d5335a6de8b630866ee9a4a450f74e249511072ce00cd4cd81ff986dc173',
  D: '1272b4b9744e8dd3ced5b64e577683058da1000f9832925d516ecb6f497bc436',
  E: '50b64138bcbca14d7381d89c65a4bd84dcb3b215fb72b819de589556784b957c',
  F: 'f98dfe119a850387170651f52e8313b2dfdedf388fcb3d14088808ee10efdbe3',
  G: '9d050245aebdbe5a6b5a5eaf0718eda3b1bbc822d5ba1ff5acbce712302e1368',
  H: '03ecc2e91e2017135fd6d6bd76b98da40981d915959685ce97e886faae80581e',
  I: 'bda53033a37a96464ca1ba74c3ee28f3ba3303ff24f8e47ada83974e5f80f704',
  J: '3b1022fcadea82400ec025ec589da563f982e405bb8534f7579ddcd8cb08fbae',
  K: '23ec51c366067843d91e341ca5f87342813bf4809f6b1995ba90fc25a055ac32',
  L: '927d8f313cec800c96a62a140baed1ab51f47ada3140d93b10d678d07967e9fc',
  M: 'cbafc17957c33f99f22553dab33905c6ae0d7750c51c0521fabd8c24f3ecccd3',
  N: 'f53850545d490274c39787a16187b0e447614d5a5936b2aa2357a32d79ebd822',
  O: '49402a3adeab4aa36810acae9c64b74948e9e1f7ac81b5e0b84a9634ea639a33',
  P: 'd5e98ef9d85badcee89ceee04c3915a0f4a419ebfd363cda25c7a659e431afa3',
  Q: '1257d699e685eb8e06476606ce090e0bddb04476fc340921d02239f1def2d8aa',
  R: '479909e5505a079a917cd6e8c12ca3e810473f4f06a2ca08328f3eba06c4ff7c',
  S: '8a117f6d31ba7a3eb304e8dc5ace39029fcdfc389cd6e3ced05fcb21812266b6',
  T: '96656075c12f210bb538c4c3eaced5559650d56dcdccdb433827864e70ec6893',
  U: 'f8f73f9e6b815ec15615b73280b6b0bcc0e352c33e82970c9fcd4fb1b41af154',
  V: '94281a910e3c5bee29e3df6fbc2e2eae0d9020fb5a818c36f10512f418ac4a5d',
  W: 'f14c9abf2fc46c5375318da501a8e3c82d6966ccb3a4876463518409b282099c',
  X: '735d4a67bb6fd5f7ff4c546bd523169b07ad433776d97f2477a5efd604048007',
  Y: '12379eb4ebe51a7f8b23185b0bb4bd0ac6bde92dda16ae385601ca0a03ba67f3',
  Z: '1566272f4f0b702521ef2718a6a407fe6e623b54a6ebd1defb8bbe2459bb691c',
  a: '484549db47ecf2f5c275c5ae0405f1069cb8cc196a2d9fbd53655a9726853168',
  b: 'c374ae24abaee6b5adac93faeaad599a08cde01ffb76fd490ee8daaf4d0af445',
  c: 'be716e736aa0dd48c377e74840a197c5dd8407dc4a0f130d048b714b33e817bc',
  d: 'cf52525aab6212bf45e814367add2b4ffd8f8091562ac316d1b6ebb9d8cc123f',
  e: '010c60c43e7056d12fd27360600937a852118a5cec9f9110e69941f75101e966',
  f: '55df69f75909ce9b6a8a69999f1c5ef88540dac750f7d1b29548b2ab5b1bee73',
  g: '3ee1ac74adbed8d74894a6c6c175882d2159f296a97f00d5f113deb683a72207',
  h: '98ebe78e8fcaebe84555540c32acd4399825d115937bcafab7e0a52867966648',
  i: '46e46977bb507d01157b8665fcdf13ba969b9f04c38dcedb95c4a74ffbe74234',
  j: '107a0e4dd5b4c07bf175c90d115da9fe090609061bd3d2010c6973d64f09a2f4',
  k: '55e7aa15bb451fa053bfa79ee7ade45ae6849ec4c9e769e927ac275e5a602f7b',
  l: '7eda428eded26eab4337a95c0c8d86eda6007214927f53cc228c43d3e44f4900',
  m: '7a0b41d88fddb3320cedbfacb42b18f01dcb4f192b47703a7b65db142f09015e',
  n: '54730812b2b2d98d85a37add5db68e4758bd8d43d5ab990abf702071015e7f74',
  o: '5109751e33cc1c557cef7759af08cffff4e8e1e64da3a06c95979993deb43ea8',
  p: 'f43d7c8e36e562e8efe80e86d5e542856ff637d0e2681dafbbed10803a8e81b5',
  q: '1d176daed85939b64aac8521f076b03ea929b57582de1fde9224e4fea31c1d22',
  r: 'abcb78cbf67958f89e9add07a3d5abec435891d59f53c6397a54de3d837e7337',
  s: '62c6f29ab65dfc307e228e2432a044a278af36af08b0a1617a9e9ebfa3565f23',
  t: 'd5566abcf486b3e4a94bd3f45ba30f3cddac5a215d284a91f955fa132be0bb36',
  u: '3432c12d99bf524d95c45a8dab8411b2884ba6dd6f1a169b763381d7cc2aefd2',
  v: 'f2552d82c2d069fa08e632dc265107c985e65dd4720bbe39d2bca16acb1357ea',
  w: '66616ea0e8f1a3848cd7c6670c183acbdcf8936d1097ab89ca80d65158975332',
  x: 'a1acdc575c8915eb962ff76e935d146d87d163489a959e9fe3c0a9426ae76be9',
  y: 'c2b49b0611cff919b1d68be23353bc69fecbb6c7c59ade5e019284c753ae6d6d',
  z: 'f6f3ef5c8976ef540d6a8ad42219ed83aa5f85bb644b794bd2bd6baf8d0821e6',
});
const COLOR_PATTERN = /^#[0-9a-f]{6}$/u;
const GLYPH_KEY_PATTERN = /^[A-Za-z]$/u;
const PLACEMENT_VARIANT_KEY_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;
const UTF8_ENCODER = new TextEncoder();

export interface AtlasVectorGlyphDefinition {
  readonly glyphKey: string;
  readonly codePoint: number;
  readonly contours: readonly {
    readonly points: readonly { readonly x: number; readonly y: number }[];
  }[];
}

export interface AtlasVectorGlyphInstance {
  readonly glyphKey: string;
  readonly originXTicks: number;
  readonly originYTicks: number;
}

export interface AtlasVectorLabelNode {
  readonly id: string;
  readonly sourceId: EntityId;
  readonly sourceNameAspectId: AspectId;
  readonly sourceNameVariantRevision: number;
  readonly placementId: AspectId;
  readonly placementVariantRevision: number;
  readonly accessibilityText: string;
  readonly priority: number;
  readonly fontSizeTicks: number;
  readonly bounds: {
    readonly minXTicks: number;
    readonly minYTicks: number;
    readonly maxXTicks: number;
    readonly maxYTicks: number;
  };
  readonly fillColor: string;
  readonly glyphs: readonly AtlasVectorGlyphInstance[];
}

export interface AtlasVectorLabelLayer {
  readonly glyphAssetId: AtlasGlyphPack['assetId'];
  readonly glyphAssetSchemaVersion: number;
  readonly glyphBehaviorVersion: number;
  readonly glyphPackSha256: string;
  readonly unitsPerEm: typeof ATLAS_GLYPH_PACK_UNITS_PER_EM;
  readonly definitions: readonly AtlasVectorGlyphDefinition[];
  readonly nodes: readonly AtlasVectorLabelNode[];
}

export interface AtlasVectorLabelDiagnostic {
  readonly code:
    | 'atlas-vector-label.accepted.invalid'
    | 'atlas-vector-label.glyph-pack.invalid'
    | 'atlas-vector-label.reference.invalid'
    | 'atlas-vector-label.resource.exceeded'
    | 'atlas-vector-label.geometry.invalid';
  readonly message: string;
  readonly sourceId?: string;
}

export type AtlasVectorLabelCompositionResult =
  | { readonly ok: true; readonly value: AtlasVectorLabelLayer }
  | { readonly ok: false; readonly diagnostics: readonly AtlasVectorLabelDiagnostic[] };

export interface ValidatedAtlasVectorLabelLayer {
  readonly layer: AtlasVectorLabelLayer;
  readonly expanded: readonly RenderCompoundPath[];
  readonly definitionPointCount: number;
  readonly expandedPointCount: number;
}

export type AtlasVectorLabelValidationResult =
  | { readonly ok: true; readonly value: ValidatedAtlasVectorLabelLayer }
  | { readonly ok: false; readonly diagnostics: readonly AtlasVectorLabelDiagnostic[] };

export type AtlasVectorLabelAsyncValidationResult =
  AtlasVectorLabelValidationResult | { readonly cancelled: true };

export interface AtlasVectorLabelValidationRuntime {
  readonly isCancellationRequested: () => boolean;
  readonly yieldControl: () => Promise<void>;
}

const VALIDATION_BATCH_SIZE = 256;

/** Validate accepted records against one released pack and retain only glyphs used by the scene. */
export function composeAtlasVectorLabelLayer(
  records: AcceptedAtlasLabelRecords,
  glyphPack: AtlasGlyphPack,
  fillColor: string,
): AtlasVectorLabelCompositionResult {
  const pack = validateAtlasGlyphPack(glyphPack);
  if (!pack.ok) {
    return invalid(
      'atlas-vector-label.glyph-pack.invalid',
      pack.diagnostics[0]?.message ?? 'Glyph pack is invalid.',
    );
  }
  if (records.placements.length > ATLAS_VECTOR_LABEL_MAXIMUM_NODES) {
    return invalid('atlas-vector-label.resource.exceeded', 'The scene exceeds 256 vector labels.');
  }
  if (!COLOR_PATTERN.test(fillColor)) {
    return invalid(
      'atlas-vector-label.geometry.invalid',
      'The vector-label fill token is invalid.',
    );
  }
  const names = new Map(records.names.map((name) => [name.entityId, name] as const));
  const nameClaims = new Set(
    records.names.map((name) => `${name.nameKind}\0${name.comparisonKey}`),
  );
  if (
    names.size !== records.names.length ||
    nameClaims.size !== records.names.length ||
    records.names.some(
      (name) =>
        !validateWorldFeatureNameContent(name) || !parseStableId('entity', name.entityId).ok,
    )
  ) {
    return invalid(
      'atlas-vector-label.accepted.invalid',
      'Accepted atlas label names must be valid and unique by source and naming domain.',
    );
  }
  const glyphByKey = new Map(pack.value.glyphs.map((glyph) => [glyph.glyphKey, glyph] as const));
  const usedKeys = new Set<string>();
  let instanceCount = 0;
  const nodes: AtlasVectorLabelNode[] = [];
  const ordered = [...records.placements].sort(
    (left, right) =>
      left.priority - right.priority || compareText(left.placementId, right.placementId),
  );
  if (new Set(ordered.map(({ placementId }) => placementId)).size !== ordered.length) {
    return invalid(
      'atlas-vector-label.accepted.invalid',
      'Accepted atlas label placements must have unique identities.',
    );
  }
  if (new Set(ordered.map(({ sourceEntityId }) => sourceEntityId)).size !== ordered.length) {
    return invalid(
      'atlas-vector-label.accepted.invalid',
      'Accepted atlas label placements must be unique by named source.',
    );
  }
  for (const placement of ordered) {
    const name = names.get(placement.sourceEntityId);
    if (
      name === undefined ||
      placement.placementId !== deriveAtlasLabelPlacementAspectId(placement.sourceEntityId) ||
      placement.sourceNameAspectId !== deriveWorldFeatureNameAspectId(placement.sourceEntityId) ||
      placement.sourceNameVariantRevision !== name.variantRevision ||
      placement.displayText !== name.displayName ||
      (placement as { readonly glyphAssetId: unknown }).glyphAssetId !== pack.value.assetId ||
      placement.glyphAssetSchemaVersion !== pack.value.assetSchemaVersion ||
      placement.glyphBehaviorVersion !== pack.value.glyphBehaviorVersion ||
      placement.glyphPackSha256 !== pack.value.canonicalPackSha256 ||
      placement.placementBehaviorVersion !== ATLAS_LABEL_PLACEMENT_BEHAVIOR_VERSION ||
      !parseVariantRevision(placement.sourceNameVariantRevision).ok ||
      !parseVariantRevision(placement.variantRevision).ok ||
      !PLACEMENT_VARIANT_KEY_PATTERN.test(placement.selectedVariantKey)
    ) {
      return invalid(
        'atlas-vector-label.reference.invalid',
        'An accepted label does not match its accepted name or released glyph pack.',
        placement.sourceEntityId,
      );
    }
    if (Array.from(placement.displayText).length > ATLAS_LABEL_MAX_CODE_POINTS) {
      return invalid(
        'atlas-vector-label.accepted.invalid',
        'An accepted label exceeds the released text limit.',
        placement.sourceEntityId,
      );
    }
    if (
      !Number.isSafeInteger(placement.priority) ||
      !Number.isSafeInteger(placement.fontSizeTicks) ||
      placement.fontSizeTicks <= 0 ||
      !safeInteger(placement.baseline.xTicks) ||
      !safeInteger(placement.baseline.yTicks) ||
      placement.bounds.minXTicks < 0 ||
      placement.bounds.minYTicks < 0 ||
      placement.bounds.maxXTicks > 2_048 * ATLAS_LABEL_RENDER_TICKS_PER_PIXEL ||
      placement.bounds.maxYTicks > 1_024 * ATLAS_LABEL_RENDER_TICKS_PER_PIXEL ||
      placement.bounds.minXTicks >= placement.bounds.maxXTicks ||
      placement.bounds.minYTicks >= placement.bounds.maxYTicks
    ) {
      return invalid(
        'atlas-vector-label.geometry.invalid',
        'Accepted label bounds, font size, or priority are invalid.',
        placement.sourceEntityId,
      );
    }
    const visibleCharacters = Array.from(placement.displayText).filter(
      (character) => character !== ' ',
    );
    if (visibleCharacters.length !== placement.glyphOrigins.length) {
      return invalid(
        'atlas-vector-label.reference.invalid',
        'Accepted label glyph origins do not match its exact display text.',
        placement.sourceEntityId,
      );
    }
    const glyphs: AtlasVectorGlyphInstance[] = [];
    for (const [index, origin] of placement.glyphOrigins.entries()) {
      const glyph = glyphByKey.get(origin.glyphKey);
      if (
        glyph?.codePoint !== origin.codePoint ||
        visibleCharacters[index]?.codePointAt(0) !== origin.codePoint ||
        !safeInteger(origin.xTicks) ||
        !safeInteger(origin.yTicks)
      ) {
        return invalid(
          'atlas-vector-label.reference.invalid',
          'An accepted label references an invalid glyph origin.',
          placement.sourceEntityId,
        );
      }
      usedKeys.add(origin.glyphKey);
      glyphs.push(
        Object.freeze({
          glyphKey: origin.glyphKey,
          originXTicks: origin.xTicks,
          originYTicks: origin.yTicks,
        }),
      );
    }
    instanceCount += glyphs.length;
    if (instanceCount > ATLAS_VECTOR_LABEL_MAXIMUM_GLYPH_INSTANCES) {
      return invalid(
        'atlas-vector-label.resource.exceeded',
        'The scene exceeds 4096 visible glyph instances.',
      );
    }
    if (!Object.values(placement.bounds).every(safeInteger)) {
      return invalid(
        'atlas-vector-label.geometry.invalid',
        'Accepted label tick geometry is outside the safe-integer range.',
        placement.sourceEntityId,
      );
    }
    nodes.push(
      Object.freeze({
        id: `atlas/labels/${placement.placementId}`,
        sourceId: placement.sourceEntityId,
        sourceNameAspectId: placement.sourceNameAspectId,
        sourceNameVariantRevision: placement.sourceNameVariantRevision,
        placementId: placement.placementId,
        placementVariantRevision: placement.variantRevision,
        accessibilityText: placement.displayText,
        priority: placement.priority,
        fontSizeTicks: placement.fontSizeTicks,
        bounds: Object.freeze({ ...placement.bounds }),
        fillColor,
        glyphs: Object.freeze(glyphs),
      }),
    );
  }
  const definitions = pack.value.glyphs
    .filter(({ glyphKey }) => usedKeys.has(glyphKey))
    .map(definition);
  const pointCount = definitions.reduce(
    (total, glyph) =>
      total + glyph.contours.reduce((sum, contour) => sum + contour.points.length, 0),
    0,
  );
  if (pointCount > ATLAS_GLYPH_PACK_MAX_POINTS) {
    return invalid(
      'atlas-vector-label.resource.exceeded',
      'The used glyph definition table exceeds 50000 points.',
    );
  }
  const layer = Object.freeze({
    glyphAssetId: pack.value.assetId,
    glyphAssetSchemaVersion: pack.value.assetSchemaVersion,
    glyphBehaviorVersion: pack.value.glyphBehaviorVersion,
    glyphPackSha256: pack.value.canonicalPackSha256,
    unitsPerEm: pack.value.unitsPerEm,
    definitions: Object.freeze(definitions),
    nodes: Object.freeze(nodes),
  });
  const validated = validateAndExpandAtlasVectorLabelLayer(layer);
  if (!validated.ok) return validated;
  return { ok: true, value: layer };
}

/** Fail-closed validation for imported or otherwise untrusted scene-version-4 label layers. */
export function validateAndExpandAtlasVectorLabelLayer(
  input: unknown,
): AtlasVectorLabelValidationResult {
  const steps = validateAndExpandAtlasVectorLabelLayerSteps(input);
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}

/** Run the same fail-closed validation with cooperative cancellation between bounded work batches. */
export async function validateAndExpandAtlasVectorLabelLayerAsync(
  input: unknown,
  runtime: AtlasVectorLabelValidationRuntime,
): Promise<AtlasVectorLabelAsyncValidationResult> {
  const steps = validateAndExpandAtlasVectorLabelLayerSteps(input);
  let step = steps.next();
  while (!step.done) {
    if (runtime.isCancellationRequested()) return { cancelled: true };
    await runtime.yieldControl();
    if (runtime.isCancellationRequested()) return { cancelled: true };
    step = steps.next();
  }
  return step.value;
}

function* validateAndExpandAtlasVectorLabelLayerSteps(
  input: unknown,
): Generator<void, AtlasVectorLabelValidationResult> {
  if (!isRecord(input) || !Array.isArray(input.definitions) || !Array.isArray(input.nodes)) {
    return invalid(
      'atlas-vector-label.accepted.invalid',
      'The vector-label layer shape is invalid.',
    );
  }
  const layer = input as unknown as AtlasVectorLabelLayer;
  if (
    input.glyphAssetId !== RELEASED_GLYPH_ASSET_ID ||
    layer.glyphAssetSchemaVersion !== 1 ||
    layer.glyphBehaviorVersion !== 1 ||
    input.unitsPerEm !== ATLAS_GLYPH_PACK_UNITS_PER_EM ||
    layer.glyphPackSha256 !== RELEASED_GLYPH_PACK_SHA256
  ) {
    return invalid(
      'atlas-vector-label.glyph-pack.invalid',
      'The vector-label layer does not identify the released glyph pack.',
    );
  }
  if (
    layer.nodes.length === 0 ||
    layer.nodes.length > ATLAS_VECTOR_LABEL_MAXIMUM_NODES ||
    layer.definitions.length === 0
  ) {
    return invalid(
      'atlas-vector-label.resource.exceeded',
      'The vector-label layer exceeds its node or definition limits.',
    );
  }

  const definitionByKey = new Map<string, AtlasVectorGlyphDefinition>();
  const pointsByKey = new Map<string, number>();
  let definitionPointCount = 0;
  let previousDefinitionKey: string | undefined;
  let workSinceCheckpoint = 0;
  for (const candidate of layer.definitions as readonly unknown[]) {
    if (!isRecord(candidate) || !Array.isArray(candidate.contours)) {
      return invalid('atlas-vector-label.glyph-pack.invalid', 'A glyph definition is malformed.');
    }
    const glyph = candidate as unknown as AtlasVectorGlyphDefinition;
    if (
      !GLYPH_KEY_PATTERN.test(glyph.glyphKey) ||
      glyph.codePoint !== glyph.glyphKey.codePointAt(0) ||
      glyph.contours.length === 0 ||
      definitionByKey.has(glyph.glyphKey) ||
      (previousDefinitionKey !== undefined && previousDefinitionKey >= glyph.glyphKey)
    ) {
      return invalid(
        'atlas-vector-label.glyph-pack.invalid',
        'Glyph definitions must be unique, ordered supported ASCII outlines.',
      );
    }
    let glyphPointCount = 0;
    for (const contour of glyph.contours as readonly unknown[]) {
      if (!isRecord(contour) || !Array.isArray(contour.points) || contour.points.length < 3) {
        return invalid('atlas-vector-label.glyph-pack.invalid', 'A glyph contour is malformed.');
      }
      for (const point of contour.points as readonly unknown[]) {
        if (!isRecord(point) || !safeInteger(point.x) || !safeInteger(point.y)) {
          return invalid(
            'atlas-vector-label.geometry.invalid',
            'Glyph definition coordinates must be safe integers.',
          );
        }
        workSinceCheckpoint += 1;
        if (workSinceCheckpoint >= VALIDATION_BATCH_SIZE) {
          workSinceCheckpoint = 0;
          yield;
        }
      }
      glyphPointCount += contour.points.length;
    }
    definitionPointCount += glyphPointCount;
    if (definitionPointCount > ATLAS_GLYPH_PACK_MAX_POINTS) {
      return invalid(
        'atlas-vector-label.resource.exceeded',
        'The used glyph definition table exceeds 50000 points.',
      );
    }
    if (glyphDefinitionSha256(glyph) !== RELEASED_GLYPH_DEFINITION_SHA256[glyph.glyphKey]) {
      return invalid(
        'atlas-vector-label.glyph-pack.invalid',
        'A glyph definition does not match the released glyph pack.',
      );
    }
    definitionByKey.set(glyph.glyphKey, glyph);
    pointsByKey.set(glyph.glyphKey, glyphPointCount);
    previousDefinitionKey = glyph.glyphKey;
    yield;
  }

  const usedKeys = new Set<string>();
  const sourceIds = new Set<string>();
  const placementIds = new Set<string>();
  let glyphInstanceCount = 0;
  let expandedPointCount = 0;
  let previousNode: AtlasVectorLabelNode | undefined;
  for (const candidate of layer.nodes as readonly unknown[]) {
    if (!validLayerNodeShape(candidate)) {
      return invalid('atlas-vector-label.accepted.invalid', 'A vector-label node is malformed.');
    }
    const node = candidate;
    const visibleCharacters = Array.from(node.accessibilityText).filter(
      (character) => character !== ' ',
    );
    if (
      node.id !== `atlas/labels/${node.placementId}` ||
      !parseStableId('entity', node.sourceId).ok ||
      !parseStableId('aspect', node.sourceNameAspectId).ok ||
      !parseStableId('aspect', node.placementId).ok ||
      node.sourceNameAspectId !== deriveWorldFeatureNameAspectId(node.sourceId) ||
      node.placementId !== deriveAtlasLabelPlacementAspectId(node.sourceId) ||
      !parseVariantRevision(node.sourceNameVariantRevision).ok ||
      !parseVariantRevision(node.placementVariantRevision).ok ||
      !parseWorldFeatureNameDisplayName(node.accessibilityText).ok ||
      Array.from(node.accessibilityText).length > ATLAS_LABEL_MAX_CODE_POINTS ||
      !safeInteger(node.priority) ||
      !safeInteger(node.fontSizeTicks) ||
      node.fontSizeTicks <= 0 ||
      !validTickBounds(node.bounds) ||
      !COLOR_PATTERN.test(node.fillColor) ||
      visibleCharacters.length !== node.glyphs.length ||
      sourceIds.has(node.sourceId) ||
      placementIds.has(node.placementId) ||
      (previousNode !== undefined && compareLabelNodes(previousNode, node) >= 0)
    ) {
      return invalid(
        'atlas-vector-label.reference.invalid',
        'Vector-label nodes must retain canonical accepted identities, text, geometry, and order.',
        node.sourceId,
      );
    }
    sourceIds.add(node.sourceId);
    placementIds.add(node.placementId);
    previousNode = node;
    for (const [index, candidateGlyph] of (node.glyphs as readonly unknown[]).entries()) {
      if (
        !isRecord(candidateGlyph) ||
        typeof candidateGlyph.glyphKey !== 'string' ||
        typeof candidateGlyph.originXTicks !== 'number' ||
        typeof candidateGlyph.originYTicks !== 'number'
      ) {
        return invalid('atlas-vector-label.accepted.invalid', 'A vector-label node is malformed.');
      }
      const glyph = candidateGlyph as unknown as AtlasVectorGlyphInstance;
      const definition = definitionByKey.get(glyph.glyphKey);
      const pointCount = pointsByKey.get(glyph.glyphKey);
      if (
        definition === undefined ||
        pointCount === undefined ||
        visibleCharacters[index] !== glyph.glyphKey ||
        !safeInteger(glyph.originXTicks) ||
        !safeInteger(glyph.originYTicks)
      ) {
        return invalid(
          'atlas-vector-label.reference.invalid',
          'A vector-label node references an invalid glyph instance.',
          node.sourceId,
        );
      }
      usedKeys.add(glyph.glyphKey);
      glyphInstanceCount += 1;
      expandedPointCount += pointCount;
      if (
        glyphInstanceCount > ATLAS_VECTOR_LABEL_MAXIMUM_GLYPH_INSTANCES ||
        definitionPointCount + expandedPointCount > ATLAS_VECTOR_LABEL_MAXIMUM_STORED_POINTS
      ) {
        return invalid(
          'atlas-vector-label.resource.exceeded',
          'The vector-label layer exceeds its glyph-instance or stored-point budget.',
        );
      }
      workSinceCheckpoint += 1;
      if (workSinceCheckpoint >= VALIDATION_BATCH_SIZE) {
        workSinceCheckpoint = 0;
        yield;
      }
    }
    yield;
  }
  if (usedKeys.size !== definitionByKey.size) {
    return invalid(
      'atlas-vector-label.glyph-pack.invalid',
      'The vector-label layer must contain exactly its used glyph definitions.',
    );
  }

  const expanded: RenderCompoundPath[] = [];
  try {
    for (const node of layer.nodes) {
      expanded.push(expandAtlasVectorLabelNode(layer, node));
      yield;
    }
  } catch {
    return invalid(
      'atlas-vector-label.geometry.invalid',
      'Vector-label contour expansion exceeds the safe-integer range.',
    );
  }
  for (const [index, renderNode] of expanded.entries()) {
    const labelNode = layer.nodes[index];
    // Placement unions scale advance+bounds once; contour expansion scales the already-rounded
    // origin and point separately, so the two mandated paths may differ by one render tick.
    if (labelNode === undefined) {
      return invalid(
        'atlas-vector-label.geometry.invalid',
        'Expanded glyph contours must remain inside their accepted tick bounds.',
      );
    }
    for (const subpath of renderNode.subpaths) {
      for (const { xPx, yPx } of subpath.points) {
        if (
          xPx < 0 ||
          xPx > 2_048 ||
          yPx < 0 ||
          yPx > 1_024 ||
          xPx < (labelNode.bounds.minXTicks - 1) / ATLAS_LABEL_RENDER_TICKS_PER_PIXEL ||
          xPx > (labelNode.bounds.maxXTicks + 1) / ATLAS_LABEL_RENDER_TICKS_PER_PIXEL ||
          yPx < (labelNode.bounds.minYTicks - 1) / ATLAS_LABEL_RENDER_TICKS_PER_PIXEL ||
          yPx > (labelNode.bounds.maxYTicks + 1) / ATLAS_LABEL_RENDER_TICKS_PER_PIXEL
        ) {
          return invalid(
            'atlas-vector-label.geometry.invalid',
            'Expanded glyph contours must remain inside their accepted tick bounds.',
            labelNode.sourceId,
          );
        }
        workSinceCheckpoint += 1;
        if (workSinceCheckpoint >= VALIDATION_BATCH_SIZE) {
          workSinceCheckpoint = 0;
          yield;
        }
      }
    }
    yield;
  }
  return {
    ok: true,
    value: Object.freeze({
      layer,
      expanded,
      definitionPointCount,
      expandedPointCount,
    }),
  };
}

/** Expand the canonical glyph table with exact signed widened-integer arithmetic. */
export function expandAtlasVectorLabelNode(
  layer: AtlasVectorLabelLayer,
  node: AtlasVectorLabelNode,
): RenderCompoundPath {
  const definitions = new Map(layer.definitions.map((glyph) => [glyph.glyphKey, glyph] as const));
  const subpaths = node.glyphs.flatMap((instance) => {
    const glyph = definitions.get(instance.glyphKey);
    if (glyph === undefined)
      throw new RangeError(`Missing atlas glyph definition ${instance.glyphKey}.`);
    return glyph.contours.map((contour) =>
      Object.freeze({
        points: Object.freeze(
          contour.points.map((point) => expandedPoint(point, instance, node.fontSizeTicks)),
        ),
      }),
    );
  });
  return Object.freeze({
    id: node.id,
    kind: 'compoundPath',
    sourceId: node.sourceId,
    sourceAspectId: node.sourceNameAspectId,
    relatedSourceIds: Object.freeze([]),
    subpaths: Object.freeze(subpaths),
    fillColor: node.fillColor,
    fillRule: 'evenodd',
  });
}

export function expandAtlasVectorLabelLayer(
  layer: AtlasVectorLabelLayer,
): readonly RenderCompoundPath[] {
  return Object.freeze(layer.nodes.map((node) => expandAtlasVectorLabelNode(layer, node)));
}

function expandedPoint(
  point: { readonly x: number; readonly y: number },
  origin: AtlasVectorGlyphInstance,
  fontSizeTicks: number,
): RenderPoint {
  const xTicks =
    BigInt(origin.originXTicks) +
    roundHalfTowardPositiveInfinity(
      BigInt(point.x) * BigInt(fontSizeTicks),
      BigInt(ATLAS_GLYPH_PACK_UNITS_PER_EM),
    );
  const yTicks =
    BigInt(origin.originYTicks) -
    roundHalfTowardPositiveInfinity(
      BigInt(point.y) * BigInt(fontSizeTicks),
      BigInt(ATLAS_GLYPH_PACK_UNITS_PER_EM),
    );
  const x = Number(xTicks);
  const y = Number(yTicks);
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y))
    throw new RangeError('Expanded atlas glyph point exceeds the safe-integer range.');
  return Object.freeze({
    xPx: x / ATLAS_LABEL_RENDER_TICKS_PER_PIXEL,
    yPx: y / ATLAS_LABEL_RENDER_TICKS_PER_PIXEL,
  });
}

function roundHalfTowardPositiveInfinity(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const floor = remainder < 0n ? quotient - 1n : quotient;
  const positiveRemainder = numerator - floor * denominator;
  return positiveRemainder * 2n >= denominator ? floor + 1n : floor;
}

function definition(glyph: AtlasGlyph): AtlasVectorGlyphDefinition {
  return Object.freeze({
    glyphKey: glyph.glyphKey,
    codePoint: glyph.codePoint,
    contours: Object.freeze(
      glyph.contours.map((contour) =>
        Object.freeze({
          points: Object.freeze(contour.points.map((point) => Object.freeze({ ...point }))),
        }),
      ),
    ),
  });
}

function glyphDefinitionSha256(glyph: AtlasVectorGlyphDefinition): string {
  const canonical = {
    glyphKey: glyph.glyphKey,
    codePoint: glyph.codePoint,
    contours: glyph.contours.map((contour) => ({
      points: contour.points.map(({ x, y }) => ({ x, y })),
    })),
  };
  return Array.from(sha256(UTF8_ENCODER.encode(JSON.stringify(canonical))), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function invalid(
  code: AtlasVectorLabelDiagnostic['code'],
  message: string,
  sourceId?: string,
): { readonly ok: false; readonly diagnostics: readonly AtlasVectorLabelDiagnostic[] } {
  return {
    ok: false,
    diagnostics: Object.freeze([
      Object.freeze({ code, message, ...(sourceId === undefined ? {} : { sourceId }) }),
    ]),
  };
}

function validLayerNodeShape(input: unknown): input is AtlasVectorLabelNode {
  if (!isRecord(input) || !isRecord(input.bounds) || !Array.isArray(input.glyphs)) return false;
  return (
    typeof input.id === 'string' &&
    typeof input.sourceId === 'string' &&
    typeof input.sourceNameAspectId === 'string' &&
    typeof input.sourceNameVariantRevision === 'number' &&
    typeof input.placementId === 'string' &&
    typeof input.placementVariantRevision === 'number' &&
    typeof input.accessibilityText === 'string' &&
    typeof input.priority === 'number' &&
    typeof input.fontSizeTicks === 'number' &&
    typeof input.fillColor === 'string' &&
    typeof input.bounds.minXTicks === 'number' &&
    typeof input.bounds.minYTicks === 'number' &&
    typeof input.bounds.maxXTicks === 'number' &&
    typeof input.bounds.maxYTicks === 'number'
  );
}

function validTickBounds(bounds: AtlasVectorLabelNode['bounds']): boolean {
  return (
    Object.values(bounds).every(safeInteger) &&
    bounds.minXTicks >= 0 &&
    bounds.minYTicks >= 0 &&
    bounds.maxXTicks <= 2_048 * ATLAS_LABEL_RENDER_TICKS_PER_PIXEL &&
    bounds.maxYTicks <= 1_024 * ATLAS_LABEL_RENDER_TICKS_PER_PIXEL &&
    bounds.minXTicks < bounds.maxXTicks &&
    bounds.minYTicks < bounds.maxYTicks
  );
}

function compareLabelNodes(left: AtlasVectorLabelNode, right: AtlasVectorLabelNode): number {
  return left.priority - right.priority || compareText(left.placementId, right.placementId);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
