import assert from 'node:assert/strict';

import { test } from 'vitest';

import { createField as baselineField } from '../issue-164/morphology.mjs';
import { certifyCandidate } from './certificates.mjs';
import { constructOwners, constructTemplate, controlRecipe, TEMPLATE_LIMIT } from './templates.mjs';
const controls = {
  worldCircumferenceKm: 40000,
  targetWaterCoveragePercent: 65,
  continentCountIntent: 4,
  continentDistribution: 'varied',
  fragmentationPercent: 35,
  islandAbundancePercent: 35,
  archipelagoAbundancePercent: 25,
  oceanConnectivity: 'singleGlobal',
  polarCharacter: 'neutral',
};
const input = { id: 'normal-01', seed: '1', controls };
test('rejects malformed seed types before creating any owner or receipt', () => {
  for (const seed of [undefined, null, '', 1, 1n, {}, ['1']]) {
    const result = constructOwners({ ...input, seed });
    assert.equal(result.ok, false);
    assert.deepEqual(result.owners, []);
    assert.deepEqual(result.receipts, []);
    assert.equal(result.failures[0].code, 'invalid-input');
  }
});
test('complete normal-01 primary clears every continuous predicate at unchanged quota', () => {
  const result = constructOwners(input);
  assert.equal(result.ok, true, JSON.stringify(result.failures));
  assert.equal(result.owners.length, 4);
  const primary = result.owners[0];
  assert.equal(primary.quota, (0.35 * 0.9025) / 2.41);
  assert.equal(primary.certificate.ok, true);
  assert.equal(primary.candidate.attachments.length, 3);
  assert.ok(primary.candidate.bay);
  assert.ok(Math.abs(primary.certificate.metrics.interior.share - 0.7) < 1e-12);
  assert.deepEqual(constructOwners(input), result);
  assert.ok(result.receipts.every((r) => r.templateIndex < TEMPLATE_LIMIT));
});
test('squared-size quotas and declared roles preserve legacy template sizes', () => {
  const old = baselineField('envelope', input),
    result = constructOwners(input);
  const total = old.owners.reduce((a, o) => a + o.size ** 2, 0);
  assert.deepEqual(
    result.owners.map((o) => o.quota),
    old.owners.map((o) => (0.35 * o.size ** 2) / total),
  );
  assert.deepEqual(
    result.owners.map((o) => o.primary),
    [true, true, false, false],
  );
});
test('independent abundance zero removes its reserved components before fitting', () => {
  for (const [control, kind] of [
    ['islandAbundancePercent', 'island'],
    ['archipelagoAbundancePercent', 'archipelago'],
  ]) {
    const recipe = controlRecipe({ ...controls, [control]: 0 });
    const candidate = constructTemplate({ quota: 0.13106846473029043, recipe, templateIndex: 3 });
    assert.ok(candidate.islands.every((i) => i.kind !== kind));
    assert.ok(candidate.islands.some((i) => i.kind !== kind));
    const certificate = certifyCandidate(candidate, {
      quota: 0.13106846473029043,
      nominalClearance: 0.05,
    });
    assert.ok(Math.abs(certificate.metrics.quotaError) < 1e-12);
  }
});
test('control domain matches public ranges and finite geometry mappings are explicit', () => {
  for (const c of [
    { worldCircumferenceKm: 9000 },
    { worldCircumferenceKm: 41001 },
    { targetWaterCoveragePercent: 44 },
    { targetWaterCoveragePercent: 81 },
  ])
    assert.equal(
      constructOwners({ ...input, controls: { ...controls, ...c } }).failures[0].code,
      'invalid-input',
    );
  assert.equal(
    controlRecipe({ ...controls, oceanConnectivity: 'multipleBasins' }).oceanConnectivity,
    'multipleBasins',
  );
  assert.equal(controlRecipe({ ...controls, fragmentationPercent: 100 }).fragmentationBand, 3);
  const recipe = controlRecipe({
    ...controls,
    islandAbundancePercent: 100,
    archipelagoAbundancePercent: 100,
  });
  assert.equal(recipe.islandCount + recipe.archipelagoCount, 11);
  const base = constructTemplate({
    quota: 0.13106846473029043,
    recipe: controlRecipe(controls),
    templateIndex: 3,
  });
  for (const polarCharacter of ['landBiased', 'oceanBiased']) {
    const candidate = constructTemplate({
      quota: 0.13106846473029043,
      recipe: controlRecipe({ ...controls, polarCharacter }),
      templateIndex: 3,
    });
    assert.notDeepEqual(candidate.interior, base.interior);
    assert.ok(
      Math.abs(certifyCandidate(candidate, { quota: 0.13106846473029043 }).metrics.quotaError) <
        1e-12,
    );
  }
});
test('too-small owner quota yields explicit exhausted local budget without target relaxation', () => {
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
  assert.equal(result.receipts.length, 8 * TEMPLATE_LIMIT);
  assert.equal(result.failures.length, 8);
  assert.ok(result.receipts.some((r) => r.failures.some((f) => f.code === 'bay-depth')));
});
