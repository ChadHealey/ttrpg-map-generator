import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { test } from 'vitest';

import { polygonArea, stitchBody } from '../issue-169/geometry.mjs';
import { certifyCandidate } from '../issue-178/certificates.mjs';
import { buildCoast as previousCoast } from './layout-a.mjs';
import { buildCoast } from './layout-r2-a.mjs';
import { constructOwners as previous } from './templates.mjs';
import { CERTIFICATE_OPTIONS, constructOwners, TEMPLATE_LIMIT } from './templates-r2.mjs';

const anatomies = [
  [0, 0],
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];
const quotas = [0.13106846473029043 * 0.9905, 0.10494186046511626 * 0.9905, (0.4 / 6) * 0.984];
const inputs = JSON.parse(
  await readFile(new URL('./local-diagnostics/inputs.json', import.meta.url), 'utf8'),
);
function fitted(quota, anatomy) {
  const coast = buildCoast('local-A', { anatomy }),
    bodyBoundary = stitchBody(coast.interior, coast.attachments),
    scale = Math.sqrt((4 * Math.PI * quota) / polygonArea(bodyBoundary));
  const map = (o) =>
    Array.isArray(o)
      ? o.length === 2 && o.every((x) => typeof x === 'number')
        ? o.map((x) => x * scale)
        : o.map(map)
      : o && typeof o === 'object'
        ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, map(v)]))
        : o;
  return map({
    id: 'local-A',
    primary: true,
    collarWidthUpperMode: CERTIFICATE_OPTIONS.collarWidthUpperMode,
    ...coast,
    bodyBoundary,
    islands: [],
  });
}

test('oblique A bay passes all fifteen actual paid-body quota and anatomy-corner certificates', () => {
  for (const quota of quotas)
    for (const anatomy of anatomies) {
      const candidate = fitted(quota, anatomy),
        before = structuredClone(candidate),
        certificate = certifyCandidate(candidate, { quota, ...CERTIFICATE_OPTIONS });
      assert.deepEqual(certificate.failures, []);
      assert.deepEqual(candidate, before);
      assert.equal(candidate.bodyBoundary.length, 87);
      assert.equal(candidate.bay.mouthKind, 'wedge-geodesic');
      assert(Math.abs(certificate.metrics.area - quota) < 1e-12);
    }
});

test('A bay repair preserves every declared lobe and peninsula role before area fitting', () => {
  for (const anatomy of anatomies) {
    const a = previousCoast('local-A', { anatomy }),
      b = buildCoast('local-A', { anatomy });
    assert.deepEqual(a.attachments, b.attachments);
    assert.deepEqual(a.interiorWitness, b.interiorWitness);
    assert.deepEqual(b.bay.mouth, [
      [0.66, -0.2],
      [0.73, 0.025],
    ]);
    assert.deepEqual(b.bay.witness, [0.45, -0.06]);
    assert.notDeepEqual(a.bay.polygon, b.bay.polygon);
  }
});

test('all six paid owner sets preserve exact quotas and all twenty non-A owner results', () => {
  let changedA = 0,
    unchanged = 0;
  for (const input of inputs) {
    const old = previous(input),
      result = constructOwners(input);
    assert(old.ok && result.ok, JSON.stringify(result.failures));
    assert.deepEqual(constructOwners(input), result);
    assert.deepEqual(result.recipe, old.recipe);
    assert.equal(result.owners.length, input.controls.continentCountIntent);
    assert.deepEqual(
      result.owners.map((o) => o.quota),
      old.owners.map((o) => o.quota),
    );
    assert(result.receipts.length <= result.owners.length * TEMPLATE_LIMIT);
    for (let i = 0; i < old.owners.length; i++) {
      const a = old.owners[i],
        b = result.owners[i];
      assert.deepEqual(
        certifyCandidate(b.candidate, { quota: b.quota, ...CERTIFICATE_OPTIONS }),
        b.certificate,
      );
      assert.equal(b.candidate.islands.length, a.candidate.islands.length);
      if (a.primary && a.candidate.layoutIndex === 0) {
        changedA++;
        assert.notDeepEqual(a.candidate.bay, b.candidate.bay);
        assert.deepEqual(a.candidate.anatomy, b.candidate.anatomy);
      } else {
        unchanged++;
        assert.deepEqual(b, a);
      }
    }
  }
  assert.equal(changedA, 7);
  assert.equal(unchanged, 20);
});
