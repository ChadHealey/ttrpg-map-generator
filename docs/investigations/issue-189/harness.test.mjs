import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { test } from 'vitest';

import { BUDGET, capacity, corpus, DEFAULTS, expectedDuplicate } from './corpus.mjs';
import { compareRatio, fragmentation, oceanPredicate, polarComparison, ratio } from './metrics.mjs';
import {
  Budget,
  constructRows,
  evaluateRows,
  fieldInput,
  groupFields,
  pairReports,
} from './pipeline.mjs';
import { loadRuntime } from './runtime.mjs';
const root = (id, weight, links = [], kind = 'oceanBasin', enclosure = 'open-marine') => ({
  analysisIndex: id,
  sphericalAreaWeight: weight,
  connectedRegionIndices: links,
  waterBodyKind: kind,
  enclosure,
  sampleRanges: [{ startIndex: id, endIndexExclusive: id + 1 }],
});
test('exact public parser admits 30 declared controls and refuses malformed extra keys', async () => {
  const r = await loadRuntime();
  try {
    const rows = corpus();
    assert.equal(rows.length, 30);
    assert.equal(new Set(rows.map((r) => r.id)).size, 30);
    for (const row of rows) assert(r.core.parseAtlasControls(row.controls).ok);
    assert(!r.core.parseAtlasControls({ ...DEFAULTS, undeclared: 1 }).ok);
    assert(!r.core.parseAtlasControls({ ...DEFAULTS, targetWaterCoveragePercent: 44 }).ok);
    assert(!r.core.parseAtlasControls({ ...DEFAULTS, continentCountIntent: 1.5 }).ok);
    assert.deepEqual(
      rows.filter((r) => capacity(r.controls)).map((r) => r.id),
      ['boundary-count1-water45', 'boundary-count1-water58'],
    );
    assert.equal(rows.filter((r) => expectedDuplicate(r.id)).length, 10);
    assert.throws(() => r.bridge.fieldFromTicks(new Int32Array(130562)), /full-profile/);
    assert.throws(() => r.bridge.immutableReader(['land']), /exactly/);
    assert.equal(r.bridge.normalize(-0), 0);
    assert.equal(r.bridge.normalize(2), 1);
  } finally {
    await r.close();
  }
});
test('analytic capacity is a valid-input no-attempt result and 59 is not declared feasible', () => {
  let calls = 0;
  const runtime = {
    core: { parseAtlasControls: (c) => ({ ok: true, value: c }), validateAtlasControls: () => [] },
    constructOwners: () => {
      calls++;
      throw Error('should never run');
    },
  };
  const input = corpus().find((r) => r.id === 'boundary-count1-water45'),
    result = constructRows(runtime, new Budget(), [input]);
  assert.equal(calls, 0);
  assert.equal(result[0].inputValid, true);
  assert.equal(result[0].status, 'unsupported-family-capacity');
  assert.equal(
    capacity({ ...DEFAULTS, continentCountIntent: 1, targetWaterCoveragePercent: 59 }),
    null,
  );
});
test('budgets reject before excess work and include attempted exceptions', () => {
  const b = new Budget();
  b.charge('uniqueFieldCalls', 18);
  assert.throws(() => b.charge('uniqueFieldCalls'));
  assert.equal(b.counts.uniqueFieldCalls, 18);
  assert.throws(() => b.charge('semanticCalls', NaN));
  assert.throws(() => b.charge('other'));
  assert.equal(BUDGET.scalarEvaluations, 18 * 2095106);
  const runtime = {
    core: { parseAtlasControls: (c) => ({ ok: true, value: c }), validateAtlasControls: () => [] },
    constructOwners: () => {
      throw Error('injected');
    },
  };
  const rows = constructRows(runtime, new Budget(), corpus().slice(0, 2));
  assert(rows.every((r) => r.status === 'construction-exception'));
  assert(
    rows.every((r) => r.stages.some((s) => s.stage === 'construction' && s.status === 'attempted')),
  );
});
test('marine graph predicate retains majority 90/10 and rejects 89/11, wrong roots and false extra oceans', () => {
  assert(
    oceanPredicate({ ok: true, regions: [root(0, 90), root(1, 10)] }, 'connectedMajority').pass,
  );
  assert(
    !oceanPredicate({ ok: true, regions: [root(0, 89), root(1, 11)] }, 'connectedMajority').pass,
  );
  assert(!oceanPredicate({ ok: true, regions: [root(0, 90), root(1, 10)] }, 'singleGlobal').pass);
  assert(oceanPredicate({ ok: true, regions: [root(0, 90), root(1, 10)] }, 'multipleBasins').pass);
  assert(
    !oceanPredicate(
      { ok: true, regions: [root(0, 90, [], 'sea'), root(1, 10)] },
      'connectedMajority',
    ).pass,
  );
  const one = oceanPredicate(
    { ok: true, regions: [root(0, 90), root(1, 10, [], 'sea', 'enclosed')] },
    'singleGlobal',
  );
  assert(one.pass);
  assert.deepEqual(one.clearanceCoreCount, { exact: null, possible: [0, 1] });
  assert.equal(one.largestOpenComponentShare.fraction, 1);
  assert(
    !oceanPredicate({ ok: true, regions: [root(0, 60, [1]), root(1, 40, [0])] }, 'singleGlobal')
      .pass,
  );
  assert.equal(
    oceanPredicate({ ok: false, reason: 'fewer than two' }, 'multipleBasins').status,
    'semantic-mode-unsupported',
  );
});
test('global polar comparisons use exact rational ordering and retain hemispheric reversal', () => {
  assert.equal(
    compareRatio(
      { numerator: '9007199254740992', denominator: '9007199254740993' },
      { numerator: '9007199254740991', denominator: '9007199254740992' },
    ),
    1,
  );
  const v = (n) => ({ north: ratio(n, 100), south: ratio(n, 100), combined: ratio(n, 100) });
  assert(polarComparison(v(10), v(20), v(30)).necessaryDirectionPass);
  assert(
    !polarComparison({ ...v(10), north: ratio(21, 100) }, v(20), v(30)).necessaryDirectionPass,
  );
  assert.equal(polarComparison(null, v(20), v(30)).status, 'not-evaluated-incomplete-pair');
});
test('hull deficit measures body concavity independently of paid islands and affine placement', () => {
  const p = [
      [0, 0],
      [2, 0],
      [2, 2],
      [1, 1],
      [0, 2],
    ],
    make = (p) => [
      { id: 'x', quota: 0.1, primary: true, candidate: { bodyBoundary: p, islands: [] } },
    ];
  const base = fragmentation(make(p));
  assert.equal(base.primary[0].hullDeficit, 0.25);
  const moved = p.map(([x, y]) => [10 - 3 * y, 4 + 3 * x]);
  assert(Math.abs(fragmentation(make(moved)).quotaWeightedHullDeficit - 0.25) < 1e-12);
  const islands = make(p);
  islands[0].candidate.islands = [
    {
      polygon: [
        [50, 50],
        [51, 50],
        [50, 51],
      ],
    },
  ];
  assert.deepEqual(fragmentation(islands), base);
});
async function retainedRows() {
  const r = JSON.parse(
    await readFile(new URL('../issue-184/comparison-r2/normal-01.json', import.meta.url)),
  );
  return {
    input: corpus()[0],
    status: 'geometry-pass',
    construction: r.construction,
    placement: r.placement,
  };
}
test('dedup excludes only three recipe echoes and preserves candidate geometry/certificates/selected choices', async () => {
  const base = await retainedRows(),
    other = structuredClone(base);
  other.input = corpus()[1];
  other.construction.recipe.oceanConnectivity = 'connectedMajority';
  assert.deepEqual(fieldInput(base), fieldInput(other));
  assert.equal(groupFields([base, other]).groups.length, 1);
  const changed = structuredClone(other);
  changed.placement.owners[0].candidate.bodyBoundary[0][0] += 0.001;
  assert.equal(groupFields([base, changed]).failures[0].code, 'expected-dedup-mismatch');
  const failed = { ...base, status: 'construction-no-proposal', placement: { owners: [] } };
  assert.throws(() => fieldInput(failed));
  assert.equal(groupFields([failed]).groups.length, 0);
});
test('one semantic exception does not hide a shared counterpart or trigger resampling', async () => {
  const base = await retainedRows();
  let calls = 0;
  const runtime = {
    core: { parseAtlasControls: (c) => ({ ok: true, value: c }), validateAtlasControls: () => [] },
    constructOwners: () => structuredClone(base.construction),
    checkConstruction: () => [],
    placeOwners: () => structuredClone(base.placement),
    checkPlacement: () => [],
    sampleField: async () => {
      calls++;
      return {
        ok: true,
        bits: Buffer.from([1]),
        summary: { status: 'completed', coverage: { totalCoveragePass: true } },
      };
    },
    semantic: (_, mode) => {
      if (mode === 'singleGlobal') throw Error('injected semantic failure');
      return { predicate: { pass: true } };
    },
  };
  const saved = {},
    result = await evaluateRows(
      runtime,
      new Budget(),
      async (n, v) => {
        saved[n] = v;
      },
      corpus().slice(0, 2),
    );
  assert.equal(calls, 1);
  assert.equal(result.rows[0].status, 'semantic-exception');
  assert.equal(result.rows[1].status, 'diagnostics-completed');
  assert.equal(result.counts.semanticCalls, 2);
  assert(saved['paired-1-baseline.json'].fieldSummary);
});
test('a partial field failure retains its completed evidence and all dependent rows', async () => {
  const base = await retainedRows();
  const runtime = {
    core: { parseAtlasControls: (c) => ({ ok: true, value: c }), validateAtlasControls: () => [] },
    constructOwners: () => structuredClone(base.construction),
    checkConstruction: () => [],
    placeOwners: () => structuredClone(base.placement),
    checkPlacement: () => [],
    sampleField: async () => ({
      ok: false,
      bits: Buffer.from([1]),
      summary: {
        status: 'partition-exception',
        coverage: { totalCoveragePass: true },
        actualAnchors: 2095106,
      },
    }),
    semantic: () => {
      throw Error('must not attempt');
    },
  };
  const saved = {},
    b = new Budget();
  const d = await evaluateRows(
    runtime,
    b,
    async (n, v) => {
      saved[n] = v;
    },
    corpus().slice(0, 2),
  );
  assert(d.rows.every((r) => r.status === 'field-no-proposal'));
  assert.equal(b.counts.semanticCalls, 0);
  assert.equal(saved['paired-1-baseline.json'].fieldSummary.coverage.totalCoveragePass, true);
});

test('failed coverage or a post-sampling exception blocks paired control success while preserving raw metrics', () => {
  const names = ['polar-ocean', 'baseline', 'polar-land'],
    make = () =>
      names.map((name, i) => ({
        input: { id: `paired-1-${name}` },
        geometryValid: true,
        fieldSummary: {
          status: 'completed',
          coverage: { totalCoveragePass: true },
          polar: {
            north: ratio(10 + i * 10, 100),
            south: ratio(10 + i * 10, 100),
            combined: ratio(10 + i * 10, 100),
          },
        },
        semantic: { predicate: { pass: true } },
      }));
  const rows = make();
  assert(pairReports(rows)[0].polar.completeControlDiagnosticPass);
  rows[0].fieldSummary.coverage.totalCoveragePass = false;
  const failed = pairReports(rows)[0].polar;
  assert(failed.rawComparison.necessaryDirectionPass);
  assert(!failed.necessaryDirectionPass);
  assert(!failed.completeControlDiagnosticPass);
  const partial = make();
  partial[2].fieldSummary.status = 'partition-exception';
  assert(!pairReports(partial)[0].polar.necessaryDirectionPass);
});
