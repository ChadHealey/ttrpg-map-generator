import assert from 'node:assert/strict';

import { test } from 'vitest';

import { createField as baselineField } from '../issue-164/morphology.mjs';
import { certifyCandidate } from '../issue-169/certificates.mjs';
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

  assert.ok(result.owners.filter((o) => !o.primary).every((o) => o.radius < 0.6));
  assert.ok(primary.candidate.bay);
  assert.ok(Math.abs(primary.certificate.metrics.interior.share - 0.727) < 1e-12);
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

test('retains local certificates and the balanced-cap rejection without changing quotas', () => {
  const cases = [
    {
      seed: '1085102592571150095',
      controls: {
        ...controls,
        targetWaterCoveragePercent: 60,
        continentCountIntent: 6,
        continentDistribution: 'balanced',
        fragmentationPercent: 55,
        islandAbundancePercent: 55,
        archipelagoAbundancePercent: 50,
        oceanConnectivity: 'connectedMajority',
      },
    },
    {
      seed: '18364758544493064720',
      controls: {
        ...controls,
        targetWaterCoveragePercent: 70,
        continentCountIntent: 5,
        fragmentationPercent: 90,
        islandAbundancePercent: 95,
        archipelagoAbundancePercent: 95,
      },
    },
  ];
  for (const input of cases) {
    const result = constructOwners(input);
    assert.equal(result.ok, true, JSON.stringify(result.receipts.filter((r) => !r.ok)));
    assert.ok(result.owners.every((o) => o.certificate.metrics.vertexCount <= 256));
    assert.ok(result.owners.every((o) => o.candidate.islands.length <= 11));
    if (input.controls.continentDistribution === 'balanced')
      assert.ok(
        result.owners
          .map((o) => o.radius)
          .sort((a, b) => b - a)
          .slice(0, 2)
          .reduce((a, b) => a + b, 0) +
          0.05 >
          Math.PI / 2,
      );
  }
});

test('records the missing third accepted layout while retaining deterministic geometry variation', () => {
  const owners = [];
  for (const seed of ['1', '2', '3', '4']) {
    const result = constructOwners({ ...input, seed });
    assert.equal(result.ok, true, JSON.stringify(result.failures));
    assert.deepEqual(constructOwners({ ...input, seed }), result);
    owners.push(...result.owners.filter((o) => o.primary));
  }
  assert.deepEqual([...new Set(owners.map((o) => o.candidate.layoutIndex))].sort(), [1, 2]);
  const requiredLayoutCount = 3;
  assert.ok(new Set(owners.map((o) => o.candidate.layoutIndex)).size < requiredLayoutCount);
  const representatives = [1, 2].map((layout) =>
    owners.find((o) => o.candidate.layoutIndex === layout),
  );
  const rootAngle = (o) => {
    const [a, b] = o.candidate.attachments.find((a) => a.kind === 'peninsula').root;
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  };
  assert.ok(Math.abs(rootAngle(representatives[0]) - rootAngle(representatives[1])) > 0.5);
  const lobeAreas = (o) =>
    o.certificate.metrics.roles.filter((r) => r.kind === 'lobe').map((r) => r.share);
  assert.ok(lobeAreas(representatives[0])[1] > lobeAreas(representatives[0])[0] * 1.5);
  assert.ok(lobeAreas(representatives[1])[0] > lobeAreas(representatives[1])[1] * 1.5);
  const normalized = (o) =>
    o.candidate.bodyBoundary.map((p) => p.map((v) => v / Math.sqrt(o.quota)));
  const sameLayout = owners.filter((o) => o.candidate.layoutIndex === 1);
  assert.notDeepEqual(normalized(sameLayout[0]), normalized(sameLayout[1]));
});
