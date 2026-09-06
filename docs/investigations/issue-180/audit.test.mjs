import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { test } from 'vitest';

import { stream } from '../issue-164/morphology.mjs';
import { polygonArea } from '../issue-169/geometry.mjs';
import * as placement from '../issue-170/placement.mjs';
import { controlRecipe } from '../issue-170/templates.mjs';
import { certifyCandidate } from '../issue-178/certificates.mjs';
import * as template from '../issue-179/templates-r2.mjs';
import { checkConstruction, checkPlacement, evaluateProbe, repeatProbe } from './audit-final.mjs';
import { corpus, DEFAULT_CONTROLS } from './corpus.mjs';

const input = { id: 'retained-seed-test', seed: '1', controls: { ...DEFAULT_CONTROLS } };
const runtime = { ...template, ...placement, stream, polygonArea, certifyCandidate };
// This is the already-retained seed1, not any of the 128 additional probes.
const construction = template.constructOwners(input);
const placed = placement.placeOwners(construction.owners, input.seed);
const codes = (issues) => issues.map((i) => i.code);

test('manifest contains 128 unique additional seeds and 32 valid declared control probes', () => {
  const probes = corpus();
  assert.equal(probes.length, 160);
  assert.equal(new Set(probes.map((p) => p.input.id)).size, 160);
  assert.equal(new Set(probes.slice(0, 128).map((p) => p.input.seed)).size, 128);
  assert(probes.slice(0, 128).every((p) => p.input.seed !== '1'));
  for (const p of probes) assert.doesNotThrow(() => controlRecipe(p.input.controls));
  for (const [key, expected] of Object.entries({
    continentCountIntent: [1, 4, 8],
    oceanConnectivity: ['singleGlobal', 'connectedMajority', 'multipleBasins'],
    polarCharacter: ['neutral', 'landBiased', 'oceanBiased'],
    continentDistribution: ['balanced', 'varied', 'oneDominant'],
  }))
    assert.deepEqual(
      [...new Set(probes.map((p) => p.input.controls[key]))].sort(),
      expected.sort(),
    );
});

test('retained seed passes independent quota/certificate/payment and placement checks', () => {
  assert(construction.ok && placed.ok);
  assert.deepEqual(checkConstruction(input, construction, runtime), []);
  assert.deepEqual(checkPlacement(construction, placed, runtime), []);
});

test('accepted owners cannot omit their selection ledger or silently change quotas', () => {
  const missing = structuredClone(construction);
  missing.receipts = [];
  assert(codes(checkConstruction(input, missing, runtime)).includes('audit.selection-ledger'));
  const changed = structuredClone(construction);
  changed.owners[0].quota += 0.001;
  assert(codes(checkConstruction(input, changed, runtime)).includes('audit.owner-budget-or-role'));
});

test('partial no-proposal retains every exhausted attempt and never invokes placement', () => {
  const failed = structuredClone(construction),
    owner = failed.owners.pop();
  failed.ok = false;
  failed.receipts = failed.receipts.filter((r) => r.ownerId !== owner.id);
  failed.receipts.push(
    ...Array.from({ length: template.TEMPLATE_LIMIT }, (_, templateIndex) => ({
      ownerId: owner.id,
      quota: owner.quota,
      templateIndex,
      ok: false,
      certificateOk: false,
      failures: [{ code: 'declared-test-failure' }],
    })),
  );
  failed.failures = [
    {
      code: 'template-budget-exhausted',
      ownerId: owner.id,
      quota: owner.quota,
      candidateCount: template.TEMPLATE_LIMIT,
    },
  ];
  const result = evaluateProbe(
    { cohort: 'test', input },
    {
      ...runtime,
      constructOwners: () => failed,
      placeOwners: () => assert.fail('Partial owner set must not be placed'),
    },
  );
  assert.equal(result.status, 'construction-no-proposal');
  assert.deepEqual(result.construction, failed);
  failed.receipts.pop();
  assert(codes(checkConstruction(input, failed, runtime)).includes('audit.exhaustion-ledger'));
});

test('invalid placement budgets, reflected frames, and invalid gaps are rejected', () => {
  for (const bad of [undefined, NaN, -1, 0.5, placement.MAX_CENTER_EVALUATIONS + 1]) {
    assert(
      codes(checkPlacement(construction, { ...placed, candidateCount: bad }, runtime)).includes(
        'audit.placement-budget',
      ),
    );
  }
  const reflected = structuredClone(placed);
  reflected.owners[0].north = reflected.owners[0].north.map((x) => -x);
  assert(codes(checkPlacement(construction, reflected, runtime)).includes('audit.placement-frame'));
  const collision = structuredClone(placed);
  collision.owners[1].center = [...collision.owners[0].center];
  assert(codes(checkPlacement(construction, collision, runtime)).includes('audit.placement-gap'));
});

test('genuine placement exhaustion and unsuccessful prior attempts remain visible', () => {
  const failedPlacement = {
    ok: false,
    owners: [],
    failures: [{ code: 'search-exhausted' }],
    attempts: 64,
    candidateCount: 100,
  };
  const result = evaluateProbe(
    { cohort: 'test', input },
    { ...runtime, constructOwners: () => construction, placeOwners: () => failedPlacement },
  );
  assert.equal(result.status, 'placement-no-proposal');
  assert.deepEqual(result.placement, failedPlacement);
  const history = { ...placed, failures: [{ code: 'prior-attempt-failed' }] };
  assert.deepEqual(checkPlacement(construction, history, runtime), []);
});

test('repeat protocol fails on a changed result rather than publishing a favorable repeat', () => {
  let calls = 0;
  assert.throws(
    () =>
      repeatProbe(
        { cohort: 'test', input },
        {
          ...runtime,
          constructOwners: () => ({ ...construction, revision: String(calls++) }),
          placeOwners: () => placed,
        },
      ),
    /repeat differs/,
  );
});

// Exact receipt reproduction uses the checked owner's declared floating-point quota.
test('independent near-equal quota arithmetic does not fabricate receipt disagreement', () => {
  for (const patch of [{ continentDistribution: 'balanced' }, { targetWaterCoveragePercent: 80 }]) {
    const i = { ...input, controls: { ...input.controls, ...patch } };
    const c = template.constructOwners(i);
    assert(c.ok);
    assert.deepEqual(checkConstruction(i, c, runtime), []);
  }
});

test('retained successful control fingerprints prove no-op groups without equating failures', async () => {
  const summary = JSON.parse(
    await readFile(new URL('./evidence-final/summary.json', import.meta.url)),
  );
  const baseline = summary.controlFingerprints.find((r) => r.id === 'control-baseline');
  const group = [
    'circumference-min',
    'circumference-max',
    'ocean-majority',
    'ocean-multiple',
    ...[0, 25, 26, 51, 52, 77, 78, 100].map((n) => `fragmentation-${n}`),
  ];
  for (const name of group) {
    const row = summary.controlFingerprints.find((r) => r.id === `control-${name}`);
    assert.equal(row.status, 'geometry-and-placement-pass');
    assert.equal(row.geometry, baseline.geometry);
    assert.equal(row.placement, baseline.placement);
  }
  for (const name of ['polar-land', 'polar-ocean']) {
    const row = summary.controlFingerprints.find((r) => r.id === `control-${name}`);
    assert.equal(row.status, 'geometry-and-placement-pass');
    assert.notEqual(row.geometry, baseline.geometry);
    assert.notEqual(row.placement, baseline.placement);
  }
});
