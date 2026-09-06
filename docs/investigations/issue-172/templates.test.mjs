import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { test } from 'vitest';

import { createField as baselineField } from '../issue-164/morphology.mjs';
import { polygonArea } from '../issue-169/geometry.mjs';
import { certifyCandidate } from './certificates.mjs';
import {
  BALANCED_GUARD_CEILING,
  constructOwners,
  constructTemplate,
  controlRecipe,
  TEMPLATE_LIMIT,
} from './templates.mjs';

const inputs = JSON.parse(
  await readFile(new URL('./local-diagnostics/inputs.json', import.meta.url), 'utf8'),
);
const input = inputs[0],
  controls = input.controls;

test('malformed seeds and direct template boundaries reject before geometry', () => {
  for (const seed of [undefined, null, '', 1, 1n, {}, ['1']]) {
    const result = constructOwners({ ...input, seed });
    assert.equal(result.ok, false);
    assert.deepEqual(result.owners, []);
    assert.deepEqual(result.receipts, []);
    assert.equal(result.failures[0].code, 'invalid-input');
  }
  const args = { quota: 0.10494186046511626, recipe: controlRecipe(controls) };
  for (const patch of [
    { seed: '' },
    { seed: 1 },
    { templateIndex: -1 },
    { templateIndex: TEMPLATE_LIMIT },
    { templateIndex: 0.5 },
    { quota: NaN },
    { quota: 0 },
    { quota: 1 },
    { recipe: { ...args.recipe, islandShare: -0.1 } },
    { recipe: { ...args.recipe, islandCount: 0 } },
    { recipe: { ...args.recipe, polarStretch: 2 } },
  ])
    assert.throws(() => constructTemplate({ ...args, ...patch }), RangeError);
});

test('all six complete local owner sets are deterministic, paid and within fixed budgets', () => {
  for (const input of inputs) {
    const result = constructOwners(input);
    assert.equal(result.ok, true, JSON.stringify(result.failures));
    assert.equal(result.owners.length, input.controls.continentCountIntent);
    assert.deepEqual(constructOwners(input), result);
    assert(result.receipts.length <= input.controls.continentCountIntent * TEMPLATE_LIMIT);
    for (const owner of result.owners) {
      assert.equal(owner.certificate.ok, true);
      assert.deepEqual(
        certifyCandidate(owner.candidate, { quota: owner.quota, nominalClearance: 0.05 }),
        owner.certificate,
      );
      assert(owner.certificate.metrics.vertexCount <= 256);
      assert(owner.candidate.islands.length <= 11);
      assert(
        owner.candidate.siteReceipts.every(
          (r) => r.attempt >= 1 && r.attempt <= 24 && r.anchor >= 0 && r.anchor < 6,
        ),
      );
      assert(Math.abs(owner.certificate.metrics.area - owner.quota) < 1e-12);
      for (const [kind, share, count] of [
        ['island', result.recipe.islandShare, result.recipe.islandCount],
        ['archipelago', result.recipe.archipelagoShare, result.recipe.archipelagoCount],
      ]) {
        const islands = owner.candidate.islands.filter((i) => i.kind === kind);
        assert.equal(islands.length, count);
        assert(
          Math.abs(
            islands.reduce((a, i) => a + polygonArea(i.polygon), 0) / (4 * Math.PI) -
              owner.quota * share,
          ) < 1e-12,
        );
      }
    }
  }
});

test('legacy squared-size quotas and primary classification are preserved', () => {
  for (const input of inputs) {
    const old = baselineField('envelope', input),
      result = constructOwners(input),
      total = old.owners.reduce((a, o) => a + o.size ** 2, 0),
      max = Math.max(...old.owners.map((o) => o.size ** 2));
    assert.deepEqual(
      result.owners.map((o) => o.quota),
      old.owners.map(
        (o) => ((1 - input.controls.targetWaterCoveragePercent / 100) * o.size ** 2) / total,
      ),
    );
    assert.deepEqual(
      result.owners.map((o) => o.primary),
      old.owners.map((o) => o.size ** 2 >= max * 0.5),
    );
  }
});

test('ordinary accepted layouts have distinct literal root placements, including same-seed primaries', () => {
  const owners = inputs
    .slice(0, 4)
    .flatMap((i) => constructOwners(i).owners.filter((o) => o.primary));
  assert.deepEqual([...new Set(owners.map((o) => o.candidate.layoutIndex))].sort(), [0, 1, 2]);
  const same = constructOwners(inputs[1]).owners.filter((o) => o.primary);
  assert.equal(new Set(same.map((o) => o.candidate.layoutIndex)).size, 3);
  const directions = same.map((o) => {
    const p = o.candidate.attachments.find((a) => a.kind === 'peninsula').root;
    return Math.atan2(p[0][1] + p[1][1], p[0][0] + p[1][0]);
  });
  for (let i = 0; i < 3; i++)
    for (let j = i + 1; j < 3; j++)
      assert(Math.acos(Math.cos(directions[i] - directions[j])) > 0.3);
});

test('balanced compactness rejection preserves a successful certificate as a separate receipt', () => {
  const result = constructOwners(inputs.find((i) => i.id === 'connected-majority'));
  assert(result.owners.every((o) => o.radius <= BALANCED_GUARD_CEILING));
  const rejected = result.receipts.filter((r) =>
    r.failures.some((f) => f.code === 'balanced-guard-preference'),
  );
  assert(rejected.length > 0);
  assert(rejected.every((r) => r.certificateOk && !r.ok));
});

test('each zero abundance removes only its own independently paid category', () => {
  for (const [control, kind] of [
    ['islandAbundancePercent', 'island'],
    ['archipelagoAbundancePercent', 'archipelago'],
  ]) {
    const result = constructOwners({ ...input, controls: { ...controls, [control]: 0 } });
    assert(result.ok, JSON.stringify(result.failures));
    for (const owner of result.owners) {
      assert(owner.candidate.islands.every((i) => i.kind !== kind));
      assert(owner.candidate.islands.some((i) => i.kind !== kind));
      assert(Math.abs(owner.certificate.metrics.area - owner.quota) < 1e-12);
    }
  }
});

test('unrealizable small primary quota exhausts its finite budget without threshold relaxation', () => {
  const result = constructOwners({
    ...input,
    controls: {
      ...controls,
      continentCountIntent: 8,
      continentDistribution: 'balanced',
      targetWaterCoveragePercent: 80,
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.failures.length, 8);
  assert.equal(result.receipts.length, 8 * TEMPLATE_LIMIT);
  assert(result.receipts.some((r) => r.failures.some((f) => f.code === 'bay-depth')));
});
