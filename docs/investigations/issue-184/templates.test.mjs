import assert from 'node:assert/strict';

import { test } from 'vitest';

import { probes as oldProbes, worldInputs as oldWorldInputs } from '../issue-183/corpus.mjs';
import { constructTemplate as oldTemplate } from '../issue-183/templates.mjs';
import { probes, worldInputs } from './corpus.mjs';
import {
  constructTemplate,
  controlRecipe,
  EXTENSION_REVISION,
  TEMPLATE_LIMIT,
} from './templates.mjs';

test('fixed9/134 corpus is exactly the frozen183 corpus', () => {
  assert.deepEqual(probes(), oldProbes());
  assert.deepEqual(worldInputs(), oldWorldInputs());
  assert.equal(TEMPLATE_LIMIT, 16);
  assert.equal(EXTENSION_REVISION, 'issue-184-large-bay-r3');
});
test('C and subordinate candidates retain exact geometry or the same bounded site failure', () => {
  const outcome = (construct, options) => {
    try {
      return { ok: true, candidate: construct(options) };
    } catch (error) {
      return {
        ok: false,
        name: error.name,
        message: error.message,
        siteReceipts: error.siteReceipts,
      };
    }
  };
  let accepted = 0;
  const recipe = controlRecipe(worldInputs()[0].controls);
  for (const seed of ['1', '2'])
    for (const layoutPreference of [0, 1, 2]) {
      const options = {
        id: 'owner-0',
        primary: false,
        quota: 0.04393153526970954,
        recipe,
        seed,
        templateIndex: 0,
        layoutPreference,
      };
      const actual = outcome(constructTemplate, options);
      assert.deepEqual(actual, outcome(oldTemplate, options));
      if (actual.ok) accepted++;
    }
  for (const templateIndex of [0, 1, 2, 3]) {
    const options = {
      id: 'owner-0',
      primary: true,
      quota: 0.13106846473029043,
      recipe,
      seed: '1',
      templateIndex,
      layoutPreference: 2,
    };
    const actual = outcome(constructTemplate, options);
    assert.deepEqual(actual, outcome(oldTemplate, options));
    if (actual.ok) accepted++;
  }
  assert(accepted > 0);
});
test('sixteen candidates remain finite with explicit invalid direct-input rejection', () => {
  const recipe = controlRecipe(worldInputs()[0].controls);
  for (const templateIndex of [-1, 16, 17, 1.5])
    assert.throws(
      () => constructTemplate({ quota: 0.13, recipe, seed: '1', templateIndex }),
      RangeError,
    );
  for (const seed of ['', 1, null])
    assert.throws(
      () => constructTemplate({ quota: 0.13, recipe, seed, templateIndex: 12 }),
      RangeError,
    );
});
