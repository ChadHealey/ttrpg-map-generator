import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

import { test } from 'vitest';

import { buildCoast as oldB } from '../issue-179/layout-b.mjs';
import { buildCoast as oldC } from '../issue-179/layout-c.mjs';
import { buildCoast as oldA } from '../issue-179/layout-r2-a.mjs';
import {
  constructOwners as frozen182Owners,
  constructTemplate as frozen182,
} from '../issue-182/templates.mjs';
import { probes, retainedInputs, worldInputs } from './corpus.mjs';
import { buildCoast as newA } from './layout-a.mjs';
import { buildCoast as newB } from './layout-b.mjs';
import { buildCoast as newC } from './layout-c.mjs';
import { constructOwners, constructTemplate, controlRecipe, TEMPLATE_LIMIT } from './templates.mjs';

test('nine fixed comparison rows preserve old six and declared large-primary seeds exactly', async () => {
  assert.deepEqual(
    retainedInputs,
    JSON.parse(
      await readFile(new URL('../issue-179/local-diagnostics/inputs.json', import.meta.url)),
    ),
  );
  assert.equal(worldInputs().length, 9);
  assert.deepEqual(
    worldInputs()
      .slice(6)
      .map((i) => i.id),
    ['default-001', 'default-004', 'default-006'],
  );
  assert.equal(probes().length, 134);
});
test('bay-only edits preserve every raw attachment, fixed collar and declared interior witnesses', () => {
  for (const [old, changed] of [
    [oldA, newA],
    [oldB, newB],
    [oldC, newC],
  ])
    for (const anatomy of [
      [0, 0],
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ])
      for (let variation = 0; variation < 4; variation++) {
        const before = old('same', { anatomy, variation }),
          after = changed('same', { anatomy, variation });
        assert.deepEqual(after.attachments, before.attachments);
        if (old === oldB) {
          assert.deepEqual(after.interiorWitness, [0.06, -0.185]);
          assert.notDeepEqual(after.bay.polygon, before.bay.polygon);
        } else {
          assert.deepEqual(after, before);
        }
        assert.equal(after.bay.mouthKind, before.bay.mouthKind);
      }
});
test('all four182 fallback candidates and seed streams remain byte-for-byte identical', () => {
  const input = worldInputs()[6],
    recipe = controlRecipe(input.controls);
  for (let templateIndex = 12; templateIndex < 16; templateIndex++) {
    const o = {
      id: 'owner-0',
      primary: true,
      quota: 0.17451657458563533,
      seed: input.seed,
      recipe,
      templateIndex,
      layoutPreference: 1,
    };
    assert.deepEqual(constructTemplate(o), frozen182(o));
  }
  assert.equal(TEMPLATE_LIMIT, 16);
});
test('recipe3 retains45 passing body/corner certificates, with no target changes', async () => {
  const r = JSON.parse(
    await readFile(new URL('./local-diagnostics/recipe-3/report.json', import.meta.url)),
  );
  assert.equal(r.reports.length, 45);
  assert(r.reports.every((r) => r.certificate.ok));
});
test('full paid readiness preserves all134 owner sets and three actual ordinary layouts', async () => {
  const layouts = new Set();
  for (const probe of probes()) {
    const row = JSON.parse(
      gunzipSync(
        await readFile(new URL(`./readiness-recipe-3/${probe.input.id}.json.gz`, import.meta.url)),
      ),
    );
    assert.equal(row.result.status, 'geometry-and-placement-pass', probe.input.id);
    assert.equal(row.result.construction.owners.length, probe.input.controls.continentCountIntent);
    assert.deepEqual(
      JSON.parse(JSON.stringify(constructOwners(probe.input))),
      row.result.construction,
    );
    if (retainedInputs.slice(0, 4).some((i) => i.id === probe.input.id))
      for (const owner of row.result.construction.owners)
        if (owner.primary) layouts.add(owner.candidate.layoutIndex);
  }
  assert(layouts.has(0) && layouts.has(1) && layouts.has(2));
});

test('retained subordinate owners remain exactly frozen182 geometry and payments', () => {
  for (const input of retainedInputs) {
    const before = frozen182Owners(input),
      after = constructOwners(input);
    for (const owner of after.owners.filter((o) => !o.primary))
      assert.deepEqual(
        owner,
        before.owners.find((o) => o.id === owner.id),
      );
  }
});
