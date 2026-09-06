import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

import { test } from 'vitest';

import { probes } from './corpus.mjs';
import { assessRows } from './gate.mjs';

for (const revision of [2, 3]) {
  const rows = await Promise.all(
    probes().map(async (probe) =>
      JSON.parse(
        gunzipSync(
          await readFile(
            new URL(`./readiness-recipe-${revision}/${probe.input.id}.json.gz`, import.meta.url),
          ),
        ),
      ),
    ),
  );
  test(`state${revision} retains all 134 exact repeated complete paid constructions and placements`, () => {
    assert.equal(rows.length, 134);
    for (const row of rows) {
      const r = row.result;
      assert.equal(r.status, 'geometry-and-placement-pass', r.probe.input.id);
      assert.deepEqual(r.issues, []);
      assert.equal(r.construction.owners.length, r.probe.input.controls.continentCountIntent);
      assert.equal(r.placement.owners.length, r.construction.owners.length);
      assert.equal(row.repeat.equal, true);
      assert.equal(row.repeat.firstSha256, row.repeat.secondSha256);
    }
  });
  test(`actual ordinary and named large layouts open the source-frozen state${revision} gate`, async () => {
    const gate = assessRows(rows.map((r) => r.result));
    assert.equal(gate.readyForComparison, true);
    assert.deepEqual(gate.layouts, [0, 1, 2]);
    assert.deepEqual(gate.recoveredRows, [
      { id: 'default-001', primaryLayouts: [3] },
      { id: 'default-004', primaryLayouts: [3] },
      { id: 'default-006', primaryLayouts: [3] },
    ]);
    assert.deepEqual(
      gate,
      JSON.parse(await readFile(new URL(`./readiness-result-r${revision}.json`, import.meta.url))),
    );
  });
}
