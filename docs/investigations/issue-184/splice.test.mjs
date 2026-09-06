import assert from 'node:assert/strict';

import { test } from 'vitest';

import { buildCoast as oldLarge } from '../issue-182/layout-large.mjs';
import { buildCoast as oldA } from '../issue-183/layout-a.mjs';
import { buildCoast as oldB } from '../issue-183/layout-b.mjs';
import { buildCoast as newA } from './layout-a.mjs';
import { buildCoast as newB } from './layout-b.mjs';
import { buildCoast as newLarge } from './layout-large.mjs';
import { cubicSamples, remapRoles, remapSites, retainedIndex, spliceCoast } from './splice.mjs';

const ring = Array.from({ length: 12 }, (_, i) => [
  Math.cos((i * Math.PI) / 6),
  Math.sin((i * Math.PI) / 6),
]);
const first = [
    [0.7, -0.7],
    [0.5, -0.5],
    [0.1, -0.1],
    [0, 0],
  ],
  second = [
    [0, 0],
    [-0.1, 0.1],
    [-0.5, 0.5],
    [-0.7, 0.7],
  ];
test('cyclic splice retains original point identities and exact one-time endpoints', () => {
  const s = spliceCoast(ring, { start: 10, end: 2, first, second });
  assert.equal(s.coast.length, 32);
  for (const i of [10, 2, 3, 4, 5, 6, 7, 8, 9]) assert.equal(s.coast[retainedIndex(s, i)], ring[i]);
  for (const i of [11, 0, 1]) assert.throws(() => retainedIndex(s, i), /removed/);
  assert.equal(s.coast[0], ring[10]);
  assert.equal(s.coast[24], ring[2]);
  assert.equal(s.coast[4], first[0]);
  assert.equal(s.coast[12], first[3]);
  assert.equal(s.coast[20], second[3]);
  assert.equal(s.coast.filter((p) => p === first[3]).length, 1);
});
test('removed role and site references reject instead of silently moving witnesses', () => {
  const s = spliceCoast(ring, { start: 10, end: 2, first, second });
  assert.throws(() => remapRoles(s, [{ start: 10, end: 4, far: [0, 3] }]), /removed/);
  assert.throws(() => remapSites(s, [10]), /removed|replaced/);
  assert.deepEqual(remapSites(s, [8, 9]), [retainedIndex(s, 8), retainedIndex(s, 9)]);
});
test('authored cubic sampling changes the polygon from a subdivided straight chain', () => {
  const curve = [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
    ],
    p = cubicSamples(curve, 8);
  assert.equal(p.length, 9);
  assert.equal(p[0], curve[0]);
  assert.equal(p.at(-1), curve[3]);
  assert.deepEqual(p[4], [0.5, 0.75]);
  assert(p.slice(1, -1).every((p) => p[1] > 0));
  assert.throws(() => cubicSamples(curve, 9), RangeError);
});
test('all raw roles, roots, far cuts, disks and fixed witnesses remain exact for every corner/variation', () => {
  for (const [old, changed, count] of [
    [oldA, newA, 93],
    [oldB, newB, 102],
    [oldLarge, newLarge, 90],
  ])
    for (const anatomy of [
      [0, 0],
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ])
      for (let variation = 0; variation < 4; variation++) {
        const a = old('same', { anatomy, variation }),
          b = changed('same', { anatomy, variation });
        assert.deepEqual(b.attachments, a.attachments);
        assert.deepEqual(b.interiorWitness, a.interiorWitness);
        if (old === oldB) {
          assert.deepEqual(b.bay.witness, a.bay.witness);
          assert.deepEqual(b.bay.mouth, a.bay.mouth);
        } else if (old === oldA) {
          assert.deepEqual(b.bay.witness, [0.35, -0.07]);
          assert.deepEqual(b.bay.mouth, [
            [0.63, -0.19],
            [0.595, 0.035],
          ]);
        } else {
          assert.deepEqual(b.bay.witness, [0.3 + 0.06, -0.145 - 0.025]);
          assert.deepEqual(b.bay.mouth, [
            [0.5 + 0.06, -0.235 - 0.025],
            [0.54 + 0.06, -0.06 - 0.025],
          ]);
        }
        const unique = new Set(
          [...b.interior, ...b.attachments.flatMap((r) => r.polygon)].map((p) => JSON.stringify(p)),
        );
        assert.equal(unique.size, count);
        assert.equal(b.islandAnchorEdges.length, 6);
      }
});
