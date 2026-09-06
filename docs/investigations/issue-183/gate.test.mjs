import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

import { test } from 'vitest';

import { probes } from './corpus.mjs';
import { assessRows } from './gate.mjs';

const rows = await Promise.all(
  probes().map(
    async (p) =>
      JSON.parse(
        gunzipSync(
          await readFile(new URL(`./readiness-recipe-3/${p.input.id}.json.gz`, import.meta.url)),
        ),
      ).result,
  ),
);
test('all134 certified and placed rows plus three ordinary layouts open comparison gate', () =>
  assert.equal(assessRows(rows).readyForComparison, true));
test('a missing or substituted declared input cannot open comparison gate', () => {
  assert.equal(assessRows(rows.slice(1)).readyForComparison, false);
  const changed = structuredClone(rows);
  changed[0].probe.input.seed = 'different';
  assert.equal(assessRows(changed).readyForComparison, false);
});
test('one failed placement or lost ordinary layout closes the comparison gate', () => {
  const changed = structuredClone(rows);
  changed[0].status = 'placement-no-proposal';
  assert.equal(assessRows(changed).readyForComparison, false);
  const copied = structuredClone(rows);
  for (const r of copied)
    for (const o of r.construction.owners) if (o.primary) o.candidate.layoutIndex = 0;
  assert.equal(assessRows(copied).readyForComparison, false);
});
