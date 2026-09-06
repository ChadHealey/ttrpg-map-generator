import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { test } from 'vitest';

import { EPS, pointLocation, polygonArea, stitchBody } from '../issue-169/geometry.mjs';
import { certifyCandidate as previous } from '../issue-176/certificates.mjs';
import { certifyCandidate } from './certificates.mjs';
import { taperExample } from './taper-example.mjs';

const mode = 'root-and-far';
const snapshots = await Promise.all(
  [
    '../issue-172/local-diagnostics/final.json',
    '../issue-177/local-diagnostics/final/report.json',
  ].map(async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))),
);
function bayExample(mouthKind) {
  const a = [0.65, -0.12],
    b = [0.65, 0.12],
    upper = [0.34, 0.09],
    lower = [0.38, -0.08];
  const interior = [[-0.6, -0.45], [0.35, -0.5], a, lower, upper, b, [0.35, 0.52], [-0.55, 0.5]];
  return {
    id: 'bay-owner',
    primary: false,
    interior,
    interiorWitness: [0, 0],
    bodyBoundary: interior,
    attachments: [],
    islands: [],
    bay: { mouthKind, polygon: [a, b, upper, lower], mouth: [a, b], witness: [0.42, 0] },
  };
}
test('absent and explicit root mode reproduce every retained radial and wedge receipt without schema changes', () => {
  for (const snapshot of snapshots)
    for (const { result } of snapshot.reports)
      for (const owner of result.owners) {
        const options = { quota: owner.quota },
          old = previous(owner.candidate, options);
        assert.deepEqual(old, owner.certificate);
        assert.deepEqual(certifyCandidate(owner.candidate, options), old);
        assert.deepEqual(
          certifyCandidate(owner.candidate, { ...options, collarWidthUpperMode: 'root' }),
          old,
        );
      }
});
test('supporting and wedge success and rejection remain exactly equal in historical mode', () => {
  for (const mouthKind of ['supporting-geodesic', 'wedge-geodesic']) {
    const candidate = bayExample(mouthKind),
      quota = polygonArea(candidate.interior) / (4 * Math.PI);
    for (const bad of [false, true]) {
      if (bad) candidate.bay.mouth.reverse();
      const old = previous(candidate, { quota });
      assert.equal(old.ok, !bad);
      assert.deepEqual(certifyCandidate(candidate, { quota }), old);
      assert.deepEqual(certifyCandidate(candidate, { quota, collarWidthUpperMode: 'root' }), old);
    }
  }
});
test('a broad-root tapered subordinate passes only the explicit validated far-upper mode', () => {
  const { candidate, quota } = taperExample(),
    before = structuredClone(candidate);
  const old = previous(candidate, { quota }),
    result = certifyCandidate(candidate, { quota, collarWidthUpperMode: mode });
  assert.deepEqual(
    old.failures.map((f) => f.code),
    ['peninsula-width-max', 'peninsula-ratio'],
  );
  assert.deepEqual(result.failures, []);
  assert.deepEqual(candidate, before);
  assert.deepEqual(certifyCandidate(candidate, { quota, collarWidthUpperMode: mode }), result);
  const a = old.metrics.roles[0],
    b = result.metrics.roles[0],
    c = Math.cos(result.metrics.angularRadius / 2);
  assert.equal(b.widthUpperWitness, 'far');
  assert.equal(b.widthUpperRoot, (0.6 + 2 * EPS) / c);
  assert.equal(b.widthUpperFar, (0.12 + 2 * EPS) / c);
  assert.equal(b.widthUpper, b.widthUpperFar);
  assert.equal(b.extentWidthRatioLower, b.extentLower / b.widthUpper);
  for (const key of [
    'area',
    'share',
    'widthLower',
    'extentLower',
    'extentUpper',
    'firstDiskRadiusLower',
    'opposingChainDistance',
    'collarPolygon',
    'distalPolygon',
    'collarArea',
    'distalArea',
  ])
    assert.deepEqual(b[key], a[key], key);
  assert.equal(result.metrics.area, quota);
  assert(polygonArea(candidate.attachments[0].polygon) > 0.08157039410355812);
});
test('narrower root wins and an exact root/far tie selects root deterministically', () => {
  for (const rootHalfWidth of [0.055, 0.06]) {
    const { candidate, quota } = taperExample({ rootHalfWidth });
    const r = certifyCandidate(candidate, { quota, collarWidthUpperMode: mode });
    assert.equal(r.ok, true, JSON.stringify(r.failures));
    const role = r.metrics.roles[0];
    assert.equal(role.widthUpperWitness, 'root');
    assert.equal(role.widthUpper, role.widthUpperRoot);
    if (rootHalfWidth === 0.06) assert.equal(role.widthUpperRoot, role.widthUpperFar);
    else assert(role.widthUpperRoot < role.widthUpperFar);
  }
});
test('invalid global options and nonfinite or degenerate far records reject without mode fallback', () => {
  const { candidate, quota } = taperExample();
  for (const collarWidthUpperMode of ['', null, 0, NaN, Infinity, {}, 'far', 'ROOT']) {
    const r = certifyCandidate(candidate, { quota, collarWidthUpperMode });
    assert.equal(r.ok, false);
    assert.equal(r.failures[0].code, 'invalid-input');
    assert.deepEqual(r.metrics.roles, []);
  }
  for (const point of [
    [Infinity, 0],
    [NaN, 0],
    [0.48, -0.06],
  ]) {
    const c = structuredClone(candidate);
    c.attachments[0].collar.far[1] = point;
    const r = certifyCandidate(c, { quota, collarWidthUpperMode: mode });
    assert.equal(r.ok, false);
    assert.deepEqual(r.metrics.roles, []);
  }
});
test('a distal or missing disk does not become eligible because the far bound is small', () => {
  const { candidate, quota } = taperExample();
  for (const disk of [undefined, [0.5, 0], [0.475, 0]]) {
    const c = structuredClone(candidate);
    c.attachments[0].collar.disk = disk;
    const r = certifyCandidate(c, { quota, collarWidthUpperMode: mode });
    assert.equal(r.ok, false);
    assert(
      r.failures.some((f) =>
        ['invalid-geometry', 'first-disk-outside-collar', 'first-disk'].includes(f.code),
      ),
    );
  }
});

test('a spiral collar minimum across its exterior gap is not promoted to an upper witness', () => {
  const end = 2 * Math.PI - 0.02,
    farAngle = end - 0.01;
  const angles = Array.from({ length: 49 }, (_, i) => (farAngle * i) / 48).concat(end);
  const point = (theta, outer) => {
    const radius = 0.8 * (0.9 + (0.19 * theta) / end + (outer ? 0.2 : 0));
    return [radius * Math.cos(theta), radius * Math.sin(theta)];
  };
  const inner = angles.map((t) => point(t, false)),
    outer = angles.map((t) => point(t, true));
  const root = [inner[0], outer[0]],
    far = [inner[48], outer[48]],
    theta = 0.3,
    radius = 0.8 * (1 + (0.19 * theta) / end);
  const attachment = {
    id: 'spiral/p',
    kind: 'peninsula',
    root,
    polygon: [...inner, ...outer.toReversed()],
    collar: { far, disk: [radius * Math.cos(theta), radius * Math.sin(theta)] },
  };
  const interior = [root[0], root[1], [0.7, -0.006], [0.62, -0.2], [0.36, -0.2], [0.36, -0.005]];
  const candidate = {
    id: 'spiral',
    primary: false,
    interior,
    interiorWitness: [0.49, -0.1],
    attachments: [attachment],
    islands: [],
    bodyBoundary: stitchBody(interior, [attachment]),
  };
  const quota = polygonArea(candidate.bodyBoundary) / (4 * Math.PI);
  const result = certifyCandidate(candidate, { quota, collarWidthUpperMode: mode });
  assert.deepEqual(
    result.failures.map((f) => f.code),
    ['attachment-width', 'peninsula-extent-max', 'peninsula-width-max'],
  );
  const role = result.metrics.roles[0],
    c = Math.cos(result.metrics.angularRadius / 2);
  const shortest = [root[1], far[0]],
    distance = Math.hypot(...shortest[0].map((x, i) => x - shortest[1][i]));
  assert.equal(role.opposingChainDistance, distance);
  assert.equal(
    pointLocation(
      shortest[0].map((x, i) => (x + shortest[1][i]) / 2),
      role.collarPolygon,
    ),
    -1,
  );
  assert(role.firstDiskRadiusLower > 0.04);
  assert.equal(role.widthUpper, Math.min(role.widthUpperRoot, role.widthUpperFar));
  assert(role.widthUpper > (5 * distance) / c);
  assert(role.widthLower < 0.08);
  assert(result.metrics.vertexCount <= 256);
});
