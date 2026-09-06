import assert from 'node:assert/strict';

import { afterAll, beforeAll, test } from 'vitest';

import * as geometry from '../issue-169/geometry.mjs';
import { evaluateProfile } from './measure.mjs';
import { checkpoint } from './run.mjs';
import { hash, loadRuntime, runtimeSources } from './runtime.mjs';
import { evaluateSynthetics, IDS, syntheticTicks } from './synthetics.mjs';
let runtime, records;
beforeAll(async () => {
  runtime = await loadRuntime();
  records = await evaluateSynthetics(runtime, hash);
}, 30000);
afterAll(async () => {
  await runtime?.close();
});
test('retains exactly eight declared cases with real quantizer half ties and clamp endpoints', () => {
  assert.deepEqual(
    records.map((r) => r.id),
    IDS,
  );
  assert.deepEqual(records[0].ticks, [-(2 ** 24), -(2 ** 24), -1, 0, 0, 0, 0, 1, 2 ** 24, 2 ** 24]);
  assert.equal(records[0].saturationCount, 2);
  assert.equal(runtime.policy.halfContour(), 1);
  for (const x of [NaN, Infinity, -Infinity]) assert.throws(() => runtime.policy.normalize(x));
});
test('Z rejects entire zero-anchor and exact-saddle cases without favorable-cell fallback', () => {
  for (const id of ['plateau', 'anchor-crossing', 'tangent-contact']) {
    const z = records.find((r) => r.id === id).policies[0];
    assert.equal(z.status, 'no-proposal');
    assert(z.failures.includes('zero-anchor-degeneracy'));
    assert.equal(z.rawRingCount, null);
  }
  const z = records.find((r) => r.id === 'saddles').policies[0];
  assert.equal(z.status, 'no-proposal');
  assert(z.failures.includes('zero-saddle-degeneracy'));
});
test('H classification uses the public production coverage and exact error rounding', () => {
  for (const r of records.slice(1)) {
    assert.equal(
      r.classification.realizedWaterCoveragePercent,
      r.reference.realizedWaterCoveragePercent,
    );
    assert.equal(
      r.classification.absoluteWaterCoverageErrorBasisPoints,
      r.reference.absoluteWaterCoverageErrorBasisPoints,
    );
  }
  const t = records.find((r) => r.id === 'tangent-contact').policies[1];
  assert.equal(t.status, 'extracted');
  assert.equal(t.rawRingCount, 0);
});
test('regular seam, pole and neck/island retain complete raw correspondence for both policies', () => {
  for (const id of ['seam', 'poles', 'neck-and-island']) {
    for (const p of records.find((r) => r.id === id).policies) {
      assert.equal(p.status, 'extracted', `${id}/${p.policy}: ${p.failures}`);
      assert.deepEqual(p.correspondence.failures, []);
      assert.equal(p.correspondence.components.length, id === 'seam' ? 1 : 2);
      assert.equal(
        new Set(p.correspondence.rings.map((r) => r.rawPredecessorKey)).size,
        p.rawRingCount,
      );
      assert(p.simplifiedVertexCount <= p.rawVertexCount);
    }
  }
});
test('rejects missing anchors, out-of-range ticks and undeclared policy', () => {
  const { profile, ticks } = syntheticTicks('seam', runtime.generation);
  assert.throws(() => runtime.policy.fieldFromTicks(profile, ticks.subarray(1)));
  ticks[0] = 2 ** 24 + 1;
  assert.throws(() => runtime.policy.fieldFromTicks(profile, ticks));
  ticks[0] = -16;
  const f = runtime.policy.fieldFromTicks(profile, ticks);
  assert.throws(() => runtime.policy.extractPolicy(f, 'third', hash));
});
test('rejects altered or omitted source closure before compiling any supplied source', async () => {
  const sources = await runtimeSources(),
    key = 'docs/investigations/issue-186/policy.ts';
  await assert.rejects(
    loadRuntime({ ...sources, [key]: sources[key] + '\nthrow new Error("never execute");' }),
    /trusted current closure/,
  );
  const missing = { ...sources };
  delete missing[key];
  await assert.rejects(loadRuntime(missing), /trusted current closure/);
});
test('pins displacement rounding and rejects ambiguous or changed simplification predecessors', () => {
  assert.equal(runtime.policy.interpolateContourTick(-2, -1, -1, 1), -1);
  assert.equal(runtime.policy.interpolateContourTick(-1, -2, 1, -1), -2);
  const { profile, ticks } = syntheticTicks('seam', runtime.generation);
  const result = runtime.policy.extractPolicy(
    runtime.policy.fieldFromTicks(profile, ticks),
    'H',
    hash,
  );
  const raw = result.extraction.rings[0],
    simple = result.simplified[0].ring;
  assert(runtime.policy.validateSimplifiedPredecessor(raw, simple));
  assert.equal(
    runtime.policy.validateSimplifiedPredecessor(raw, { ...simple, sourceTransitions: undefined }),
    false,
  );
  assert.equal(
    runtime.policy.validateSimplifiedPredecessor(raw, {
      ...simple,
      points: [
        { ...simple.points[0], latitudeTicks: simple.points[0].latitudeTicks + 1 },
        ...simple.points.slice(1),
      ],
    }),
    false,
  );
});

test('the existing seam synthetic traverses the complete sampling/measurement pipeline without checkpoint field evaluation', async () => {
  const { reports } = await checkpoint(),
    report = reports[0],
    { profile, ticks } = syntheticTicks('seam', runtime.generation);
  const syntheticField = {
    evaluate: (v) => {
      const y = Math.round(
          ((Math.asin(Math.max(-1, Math.min(1, v[2]))) + Math.PI / 2) / Math.PI) * 256,
        ),
        x =
          y === 0 || y === 256
            ? 0
            : ((Math.round(((Math.atan2(v[1], v[0]) + Math.PI) / (2 * Math.PI)) * 512) % 512) +
                512) %
              512;
      return ticks[runtime.generation.getAtlasSampleStorageIndex(profile, x, y)] / 2 ** 24;
    },
  };
  const evaluated = await evaluateProfile(report, profile, runtime, syntheticField, geometry);
  assert.deepEqual(evaluated.samples.ticks, ticks);
  assert.equal(evaluated.summary.classification.status, 'completed');
  assert.equal(evaluated.summary.policies.length, 2);
  assert(
    evaluated.summary.policies.every(
      (p) => p.attempted && p.extractionStatus !== 'policy-exception',
    ),
  );
  assert(evaluated.summary.policies.every((p) => !p.proposalEligible));
}, 30000);
