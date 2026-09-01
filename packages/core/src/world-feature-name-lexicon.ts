/** Project-owned, ASCII-only lexical data for version-1 world feature name content. */

import { createBehaviorVersion } from './compatibility.js';
import type { WorldFeatureNameKind, WorldFeatureNameLexicon } from './world-feature-name-model.js';

const WORDS = [
  'amber',
  'ash',
  'blue',
  'copper',
  'dawn',
  'ember',
  'frost',
  'golden',
  'iron',
  'mist',
  'silver',
  'storm',
  'sun',
  'thorn',
  'white',
  'willow',
] as const;

/**
 * These source tokens were authored for this repository. They are not copied from an external
 * corpus, contain only lowercase ASCII letters, and have no license or runtime dependency.
 */
export const WORLD_FEATURE_NAME_LEXICON_V1: WorldFeatureNameLexicon = Object.freeze({
  version: required(createBehaviorVersion(1)),
  firstWords: WORDS,
  secondWords: Object.freeze({
    landmass: Object.freeze(['crown', 'expanse', 'march', 'reach', 'shore', 'vale']),
    'island-group': Object.freeze(['arch', 'chain', 'keys', 'shoals', 'steps', 'ward']),
    'water-body': Object.freeze(['basin', 'deep', 'gulf', 'reach', 'sea', 'sound']),
    'mountain-system': Object.freeze(['crags', 'heights', 'peaks', 'range', 'spines', 'walls']),
    watershed: Object.freeze(['basin', 'divide', 'fold', 'hollow', 'run', 'wash']),
    river: Object.freeze(['flow', 'river', 'run', 'stream', 'water', 'way']),
    lake: Object.freeze(['lake', 'mere', 'pool', 'tarn', 'water', 'well']),
  } satisfies Readonly<Record<WorldFeatureNameKind, readonly string[]>>),
});

function required<Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false },
): Value {
  if (!result.ok) throw new Error('Internal world-feature lexicon version is invalid.');
  return result.value;
}
