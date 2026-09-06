import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

import { test } from 'vitest';

import { polygonArea, stitchBody } from '../issue-169/geometry.mjs';
import { certifyCandidate as legacy } from '../issue-178/certificates.mjs';
import { taperExample } from '../issue-178/taper-example.mjs';
import { certifyCandidate } from './certificates.mjs';
import { partitionCoast } from './coast-partition.mjs';
import { certifyBayTopology } from './topology.mjs';

// Historical 173/178 baseline only. The two useful 188 literals are intentionally not imported.
function baseline() {
  const a = [0.65, -0.12],
    b = [0.65, 0.12],
    upper = [0.34, 0.09],
    lower = [0.38, -0.08];
  const interior = [[-0.6, -0.45], [0.35, -0.5], a, lower, upper, b, [0.35, 0.52], [-0.55, 0.5]];
  return {
    id: 'baseline',
    primary: false,
    interior,
    interiorWitness: [0, 0],
    bodyBoundary: interior,
    attachments: [],
    islands: [],
    bay: {
      mouthKind: 'wedge-geodesic',
      polygon: [a, b, upper, lower],
      mouth: [a, b],
      witness: [0.42, 0],
    },
  };
}
const quota = (c) =>
  (polygonArea(c.interior) +
    c.attachments.reduce((s, p) => s + polygonArea(p.polygon), 0) +
    c.islands.reduce((s, p) => s + polygonArea(p.polygon), 0)) /
  (4 * Math.PI);
const check = (c) =>
  certifyCandidate(c, {
    quota: quota(c),
    bayCoastMode: 'whole-body',
    collarWidthUpperMode: 'root-and-far',
  });
const codes = (r) => r.failures.map((f) => f.code);

test('historical baseline whole-body pass, reversed rings and exact ordered mouth preserve input', () => {
  const c = baseline(),
    before = structuredClone(c),
    first = check(c);
  assert.equal(first.ok, true, JSON.stringify(first.failures));
  assert.deepEqual(c, before);
  c.interior = c.interior.toReversed();
  c.bodyBoundary = c.bodyBoundary.toReversed();
  c.bay.polygon.reverse();
  c.bay.mouth.reverse();
  const reverse = check(c);
  assert.equal(reverse.ok, true);
  assert.deepEqual(reverse.metrics.bay, first.metrics.bay);
});
test('missing and interior modes delegate every retained radial/wedge case exactly', async () => {
  for (const path of [
    '../issue-172/comparison-r1/results.json',
    '../issue-172/comparison-r2/results.json',
    '../issue-177/local-diagnostics/final/report.json',
  ]) {
    const saved = JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
    const rows = saved.rows ?? saved.reports;
    assert(Array.isArray(rows));
    for (const row of rows)
      for (const owner of (row.result ?? row.construction).owners) {
        for (const collarWidthUpperMode of ['root', 'root-and-far']) {
          const options = { quota: owner.quota, collarWidthUpperMode };
          const old = legacy(owner.candidate, options);
          assert.deepEqual(certifyCandidate(owner.candidate, options), old);
          assert.deepEqual(
            certifyCandidate(owner.candidate, { ...options, bayCoastMode: 'interior' }),
            old,
          );
        }
      }
  }
});
test('unknown mode, unsupported mouth, malformed ring and wrong mouth order never fallback', () => {
  const c = baseline();
  for (const bayCoastMode of [null, '', false, 0, {}, 'union'])
    assert.equal(certifyCandidate(c, { quota: quota(c), bayCoastMode }).ok, false);
  for (const value of [
    undefined,
    null,
    { ...c.bay, mouthKind: 'radial' },
    { ...c.bay, witness: [NaN, 0] },
    { ...c.bay, mouth: c.bay.mouth.toReversed() },
    { ...c.bay, polygon: [...c.bay.polygon, c.bay.polygon[0]] },
  ]) {
    const bad = { ...c, bay: value };
    assert.equal(check(bad).ok, false);
  }
});
test('whole-body delegation retains primary inventory, quota and invalid positive geometry failures', () => {
  const c = baseline();
  c.primary = true;
  const r = check(c);
  assert(codes(r).includes('missing-lobes'));
  assert(codes(r).includes('missing-peninsula'));
  assert(!codes(r).includes('missing-bay'));
  assert.equal(r.metrics.bay, undefined);
  assert(
    codes(certifyCandidate(baseline(), { quota: 0.2, bayCoastMode: 'whole-body' })).includes(
      'quota-residual',
    ),
  );
  const bad = baseline();
  bad.interior[0] = [Infinity, 0];
  const invalid = certifyCandidate(bad, { quota: 0.1, bayCoastMode: 'whole-body' });
  assert(codes(invalid).includes('invalid-geometry'));
});
test('partial, hidden and disconnected pocket coast cannot qualify by endpoint coincidence', () => {
  for (const mutate of [
    (c) => c.bay.polygon.splice(2, 0, [0.495, 0.105]),
    (c) => {
      c.bay.polygon[2] = [0.3, 0.2];
    },
    (c) => {
      [c.bay.polygon[2], c.bay.polygon[3]] = [c.bay.polygon[3], c.bay.polygon[2]];
    },
  ]) {
    const c = baseline();
    mutate(c);
    assert.equal(check(c).ok, false);
  }
});
test('pocket witness must be inside E and outside all positive land', () => {
  for (const witness of [
    [0, 0],
    [1.5, 0],
    [0.7, 0],
    [NaN, 0],
  ]) {
    const c = baseline();
    c.bay.witness = witness;
    assert.equal(check(c).ok, false);
  }
});
test('islands in pocket, outward lens or at a structural shoulder remain forbidden', () => {
  for (const polygon of [
    [
      [0.5, -0.01],
      [0.52, -0.01],
      [0.51, 0.01],
    ],
    [
      [0.6514, -0.0001],
      [0.6516, -0.0001],
      [0.6515, 0.0001],
    ],
    [
      [0.65, -0.12],
      [0.69, -0.15],
      [0.7, -0.13],
    ],
    [
      [0.649, -0.001],
      [0.651, -0.001],
      [0.65, 0.001],
    ],
  ]) {
    const c = baseline();
    c.islands = [{ id: 'bad-island', kind: 'island', polygon }];
    assert.equal(check(c).ok, false);
  }
});
test('topology helper rejects role intrusion and mouth/root junction without blanket waiver', () => {
  const c = baseline();
  c.attachments = [
    {
      id: 'intruder',
      polygon: [
        [0.48, -0.02],
        [0.52, -0.02],
        [0.5, 0.02],
      ],
      root: [
        [0.1, 0],
        [0.2, 0],
      ],
    },
  ];
  const failures = [];
  certifyBayTopology(c, (code) => failures.push(code));
  assert(failures.includes('bay-role-contact'));
  c.attachments[0].root[0] = c.bay.mouth[0];
  const junction = [];
  assert.equal(
    certifyBayTopology(c, (code) => junction.push(code)),
    null,
  );
  assert.deepEqual(junction, ['bay-mouth-root-junction']);
});
test('partition allows fixed coast overlap while retaining role and witness identities', () => {
  // Combinatorial square data only; not either useful 188 literal or a claimed certificate.
  const coast = [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
    [1, 1],
    [0, 1],
  ];
  const s = {
    coast,
    roles: [{ kind: 'lobe', start: 0, end: 3, far: [1, 2], disk: [1, 0.1] }],
    bay: { start: 2, end: 4, witness: [1.5, 0.8] },
    interiorWitness: [0.2, 0.5],
  };
  const before = structuredClone(s),
    p = partitionCoast('square', s);
  assert.deepEqual(p.attachments[0].root, [coast[0], coast[3]]);
  assert.deepEqual(p.attachments[0].collar.far, [coast[1], coast[2]]);
  assert.deepEqual(p.bay.polygon, [coast[4], coast[3], coast[2]]);
  assert.deepEqual(s, before);
  assert.throws(
    () => partitionCoast('square', { ...s, roles: [...s.roles, ...s.roles] }),
    /Overlapping/,
  );
  assert.throws(
    () => partitionCoast('square', { ...s, bay: { ...s.bay, start: 0, end: 1 } }),
    /nontrivial/,
  );
});

test('retained full primary keeps every inventory and collar obligation in new mode', async () => {
  const reports = JSON.parse(
    gunzipSync(
      await readFile(new URL('../issue-187/evidence/state-1/reports.json.gz', import.meta.url)),
    ),
  );
  const original = reports[0].candidate;
  assert.equal(original.primary, true);
  assert.equal(check(original).ok, true);
  for (const [index, role] of original.attachments.entries()) {
    const kind = role.kind;
    const c = structuredClone(original);
    c.attachments.splice(index, 1);
    const result = check(c);
    assert.equal(result.ok, false);
    assert(codes(result).includes(kind === 'lobe' ? 'missing-lobes' : 'missing-peninsula'));
  }
  for (const mutation of [
    (c) => {
      c.attachments[0].collar.disk = c.bay.witness;
    },
    (c) => {
      c.attachments[0].collar.far[0] = c.attachments[0].root[0];
    },
    (c) => {
      c.attachments[0].polygon[2] = c.bay.witness;
    },
    (c) => {
      c.bodyBoundary.splice(2, 1);
    },
  ]) {
    const c = structuredClone(original);
    mutation(c);
    const result = check(c);
    assert.equal(result.ok, false);
    assert.equal(
      result.metrics.bay,
      undefined,
      'Failed positive proof cannot reach whole-body bay acceptance',
    );
  }
});

test('primary early return and surviving peninsula share cannot be waived with missing bay', () => {
  const early = baseline();
  early.primary = true;
  early.interiorWitness = null;
  const invalid = certifyCandidate(early, { quota: 0.1, bayCoastMode: 'whole-body' });
  assert(codes(invalid).includes('invalid-input'));
  assert(codes(invalid).includes('bay-body-delegation'));
  const { candidate: c } = taperExample();
  c.primary = true;
  const [a, b] = c.attachments[0].root;
  c.interior = [[-1.2, -0.9], [0.2, -0.9], a, b, [0.2, 0.9], [-1.2, 0.9]];
  c.bodyBoundary = stitchBody(c.interior, c.attachments);
  c.bay = baseline().bay;
  const result = check(c);
  assert(codes(result).includes('peninsula-share'));
  assert(codes(result).includes('missing-lobes'));
  assert.equal(result.metrics.bay, undefined);
});
