import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { test } from 'vitest';

import { createField as baselineField } from '../issue-164/morphology.mjs';
import { polygonArea } from '../issue-169/geometry.mjs';
import { certifyCandidate } from '../issue-176/certificates.mjs';
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
    { layoutPreference: -1 },
    { layoutPreference: 3 },
    { layoutPreference: 1.5 },
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

test('ordinary accepted layouts and seeded within-layout coast differences survive fitting', () => {
  const owners = inputs
    .slice(0, 4)
    .flatMap((i) => constructOwners(i).owners.filter((o) => o.primary));
  assert.deepEqual([...new Set(owners.map((o) => o.candidate.layoutIndex))].sort(), [0, 1, 2]);
  const pair = owners.filter((o) => o.candidate.layoutIndex === 0).slice(0, 2);
  assert.equal(pair.length, 2);
  const [a, b] = pair;
  assert.notDeepEqual(a.candidate.anatomy, b.candidate.anatomy);
  const rms = Math.sqrt(
    a.candidate.bodyBoundary.reduce(
      (sum, p, i) =>
        sum +
        p.reduce(
          (s, x, k) =>
            s + (x / Math.sqrt(a.quota) - b.candidate.bodyBoundary[i][k] / Math.sqrt(b.quota)) ** 2,
          0,
        ),
      0,
    ) / a.candidate.bodyBoundary.length,
  );
  assert(rms > 0.01, `Quota-normalized coast RMS ${rms}`);
});

test('balanced compactness rejection preserves a successful certificate as a separate receipt', () => {
  const result = constructOwners(inputs.find((i) => i.id === 'connected-majority'));
  assert(result.owners.every((o) => o.radius <= BALANCED_GUARD_CEILING));
  const rejected = result.receipts.filter((r) =>
    r.failures.some((f) => f.code === 'balanced-guard-preference'),
  );
  // A preference rejection must preserve the independent geometry result whenever it occurs.
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

test('islands use compact finite irregular shapes and independent directions with a visible size hierarchy', () => {
  const r = constructOwners(inputs.find((i) => i.id === 'fragmented-islands'));
  for (const owner of r.owners) {
    const receipts = owner.candidate.siteReceipts;
    assert(new Set(receipts.map((r) => r.shapeIndex)).size >= 2);
    assert(new Set(receipts.map((r) => r.angle)).size === receipts.length);
    const islands = owner.candidate.islands.filter((i) => i.kind === 'island');
    assert(polygonArea(islands[0].polygon) > 4 * polygonArea(islands.at(-1).polygon));
    assert(owner.candidate.islands.every((i) => i.polygon.length >= 6 && i.polygon.length <= 7));
  }
});

test('cyclic seed rotation distributes primary preferences before finite fallback', () => {
  for (const input of inputs.slice(0, 4)) {
    const result = constructOwners(input),
      primary = result.owners.filter((o) => o.primary);
    const preferences = primary.map(
      (o) => result.receipts.find((r) => r.ownerId === o.id).layoutPreference,
    );
    for (let i = 1; i < preferences.length; i++)
      assert.equal(preferences[i], (preferences[0] + i) % 3);
    assert.equal(new Set(primary.map((o) => o.candidate.layoutIndex)).size, primary.length);
  }
});

test('three compact subordinate coasts retain explicit witnesses and paid members', () => {
  const owners = inputs
    .slice(0, 4)
    .flatMap((i) => constructOwners(i).owners.filter((o) => !o.primary));
  assert.deepEqual([...new Set(owners.map((o) => o.candidate.layoutIndex))].sort(), [0, 1, 2]);
  for (const o of owners) {
    assert.equal(o.candidate.bodyBoundary.length, 32);
    assert.deepEqual(o.candidate.interiorWitness, [0, 0]);
    assert.equal(o.candidate.bay, null);
    assert.deepEqual(o.candidate.attachments, []);
    assert(o.radius < 0.6);
  }
});

test('mapping preserves reviewed wedge mouth semantics through quota and polar transforms', () => {
  for (const input of inputs)
    for (const o of constructOwners(input).owners.filter((o) => o.primary))
      assert.equal(o.candidate.bay.mouthKind, 'wedge-geodesic');
});
