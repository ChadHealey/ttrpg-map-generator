/** Version-1 restrained limited-color ink treatment for the whole-world atlas. */

import {
  ATLAS_STYLE_TOKEN_VERSION,
  type AtlasStyleTokens,
  parseSemanticKey,
} from '@ttrpg-map/core';

export const RESTRAINED_INK_ATLAS_STYLE_BEHAVIOR_VERSION = 1 as const;

export const RESTRAINED_INK_ATLAS_STYLE: AtlasStyleTokens = Object.freeze({
  styleId: styleId('atlas-style.restrained-ink'),
  styleBehaviorVersion: RESTRAINED_INK_ATLAS_STYLE_BEHAVIOR_VERSION,
  tokenVersion: ATLAS_STYLE_TOKEN_VERSION,
  colors: Object.freeze({
    ink: '#282a24',
    water: '#afbec0',
    waterInk: '#71888b',
    land: '#c9c39a',
    paper: '#eadcba',
    paperGrain: '#d9c8a3',
  }),
  coastline: Object.freeze({
    primaryWidthPx: 1.55,
    pressureVariationPx: 0.38,
    maximumWobblePx: 0.72,
    primaryWavelengthPx: 38,
    secondaryWavelengthPx: 71,
    pressureWavelengthPx: 54,
    strokeSegmentLengthPx: 18,
  }),
  waterDecoration: Object.freeze({
    echoWidthPx: 0.82,
    waterMarkWidthPx: 0.78,
  }),
  paper: Object.freeze({
    grainCount: 420,
    grainLengthPx: 2.6,
    grainWidthPx: 0.55,
  }),
});

function styleId(input: string) {
  const parsed = parseSemanticKey(input);
  if (!parsed.ok) throw new Error(parsed.diagnostic.message);
  return parsed.value;
}
