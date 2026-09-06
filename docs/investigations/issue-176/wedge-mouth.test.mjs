import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { polygonArea } from '../issue-169/geometry.mjs';
import { certifyCandidate as previous } from '../issue-174/certificates.mjs';
import { certifyCandidate } from './certificates.mjs';
import { certifyWedgeMouth } from './wedge-mouth.mjs';
import { clipExpandedWedge, excludesWedgeSegment, wedgeFunctions } from './wedge-segment.mjs';

const a = [0.65, -0.12],
  b = [0.65, 0.12];
function example(expanded = true) {
  const interior = [
    [-0.6, -0.45],
    expanded ? [0.85, -0.35] : [0.35, -0.5],
    a,
    [0.38, -0.08],
    [0.34, 0.09],
    b,
    expanded ? [0.9, 0.4] : [0.35, 0.52],
    [-0.55, 0.5],
  ];
  return structuredClone({
    id: 'owner-0',
    primary: false,
    interior,
    interiorWitness: [0, 0],
    bodyBoundary: interior,
    attachments: [],
    islands: [],
    bay: {
      mouthKind: 'wedge-geodesic',
      mouth: [a, b],
      polygon: [a, b, [0.34, 0.09], [0.38, -0.08]],
      witness: [0.42, 0],
    },
  });
}
const quota = (c) =>
  [c.interior, ...c.attachments.map((x) => x.polygon), ...c.islands.map((x) => x.polygon)].reduce(
    (s, p) => s + polygonArea(p),
    0,
  ) /
  (4 * Math.PI);
const check = (c) => certifyCandidate(c, { quota: quota(c) });
const codes = (c) => check(c).failures.map((f) => f.code);
function rotate(c, angle) {
  const p = ([x, y]) => [
      x * Math.cos(angle) - y * Math.sin(angle),
      x * Math.sin(angle) + y * Math.cos(angle),
    ],
    ring = (ps) => ps.map(p);
  return {
    ...c,
    interior: ring(c.interior),
    bodyBoundary: ring(c.bodyBoundary),
    interiorWitness: p(c.interiorWitness),
    bay: {
      ...c.bay,
      mouth: ring(c.bay.mouth),
      polygon: ring(c.bay.polygon),
      witness: p(c.bay.witness),
    },
  };
}
const segment = (p, q, structuralShoulders = false) =>
  excludesWedgeSegment(p, q, a, b, { structuralShoulders });

describe('issue-176 water wedge', () => {
  it('accepts useful seaward land while retaining area and conservative targets', () => {
    const c = example(),
      before = structuredClone(c),
      r = check(c);
    expect(r.failures).toEqual([]);
    expect(c).toEqual(before);
    expect(r.metrics.area).toBe(quota(c));
    expect(r.metrics.bay).toMatchObject({
      mouthKind: 'wedge-geodesic',
      assurance: 'binary64-diagnostic',
    });
    expect(r.metrics.bay.openingLower).toBeCloseTo(0.20888274222635053, 14);
    expect(r.metrics.bay.depthLower).toBeCloseTo(0.20017929463358594, 14);
    expect(r.metrics.bay.depthOpeningRatioLower).toBeCloseTo(0.7259375, 14);
    c.bay.mouthKind = 'supporting-geodesic';
    expect(check(c)).toEqual(previous(c, { quota: quota(c) }));
    expect(codes(c)).toEqual(Array(4).fill('bay-positive-support'));
  });
  it('preserves whole-ring reversal and rotation with exact prior supporting results', () => {
    const c = example(),
      r = check(c);
    c.bay.polygon.reverse();
    c.bay.mouth.reverse();
    expect(check(c).metrics.bay).toEqual(r.metrics.bay);
    for (let i = 0; i < 12; i++) {
      const rotated = rotate(c, (i * Math.PI) / 6),
        result = check(rotated);
      expect(result.failures).toEqual([]);
      expect(result.metrics.bay.depthLower).toBeCloseTo(r.metrics.bay.depthLower, 13);
      const support = rotate(example(false), (i * Math.PI) / 6);
      support.bay.mouthKind = 'supporting-geodesic';
      expect(check(support)).toEqual(previous(support, { quota: quota(support) }));
      expect(check(support).ok).toBe(true);
    }
  });
  it('rejects segment crossings despite both endpoints outside, face edges and tangencies', () => {
    const functions = wedgeFunctions(a, b);
    for (const p of [
      [0.8, -0.3],
      [0.8, 0.3],
    ])
      expect(functions.some((g) => g(p) < 0)).toBe(true);
    for (const [p, q] of [
      [
        [0.8, -0.3],
        [0.8, 0.3],
      ],
      [a, b],
      [
        [0.78, -0.144],
        [0.91, -0.168],
      ],
      [
        [0.65, -0.2],
        [0.65, 0.2],
      ],
      [[0.6, -0.2], a],
      [
        [0.6505, -0.001],
        [0.651, 0.001],
      ],
      [
        [0.9, 0],
        [1, 0],
      ],
    ])
      expect(segment(p, q).excluded).toBe(false);
  });
  it('uses exact active faces over entire shoulder edges, including the affine-L counterexample', () => {
    for (const [p, q] of [
      [a, [0.66, -0.12]],
      [b, [0.66, 0.12]],
      [a, [0.78, -0.144]],
      [a, b],
    ])
      expect(segment(p, q, true).excluded).toBe(false);
    for (const [p, q] of [
      [a, [0.85, -0.35]],
      [a, [0.38, -0.08]],
      [b, [0.9, 0.4]],
      [b, [0.34, 0.09]],
    ]) {
      expect(segment(p, q, true).excluded).toBe(true);
      expect(segment(q, p, true).excluded).toBe(true);
      expect(segment(p, q, false).excluded).toBe(false);
    }
    expect(segment([a[0] + 1e-13, a[1]], [0.85, -0.35], true).excluded).toBe(false);
  });
  it('conservatively rejects near-parallel, near-empty and nonfinite clipping', () => {
    const affine =
      (A, B) =>
      ([t]) =>
        A + t * (B - A);
    // Individually possible constraints contradict by less than parameter slack.
    const constraints = [
      affine(-0.5 - 1e-10, 0.5 - 1e-10),
      affine(0.5 - 5e-13 - 1e-10, -0.5 - 5e-13 - 1e-10),
      () => 1,
    ];
    expect(clipExpandedWedge([0], [1], constraints).excluded).toBe(false);
    expect(clipExpandedWedge([0], [1], [affine(-5e-11, 2e-11), () => 1, () => 1]).excluded).toBe(
      false,
    );
    expect(clipExpandedWedge([0], [1], [() => -2e-10, () => 1, () => 1]).excluded).toBe(true);
    expect(clipExpandedWedge([0], [1], [() => NaN, () => 1, () => 1]).excluded).toBe(false);
    expect(segment([0.8, -0.3], [0.8, -0.2]).excluded).toBe(true);
  });
  it('rejects actual lens and farther wedge islands but accepts seaward islands outside the sector', () => {
    for (const polygon of [
      [
        [0.6505, -0.001],
        [0.651, 0],
        [0.6505, 0.001],
      ],
      [
        [0.8, -0.01],
        [0.82, 0],
        [0.8, 0.01],
      ],
    ]) {
      const c = example();
      c.islands = [{ id: 'island', kind: 'island', polygon }];
      expect(check(c).failures).toContainEqual(
        expect.objectContaining({ code: 'bay-positive-wedge', featureId: 'island' }),
      );
    }
    const c = example();
    c.islands = [
      {
        id: 'island',
        kind: 'island',
        polygon: [
          [0.75, 0.6],
          [0.77, 0.6],
          [0.76, 0.62],
        ],
      },
    ];
    expect(check(c).failures).toEqual([]);
  });
  it('checks roles independently and never waives their shoulder contacts', () => {
    const c = example();
    c.attachments = [
      {
        id: 'role',
        kind: 'lobe',
        root: [a, [0.38, -0.08]],
        polygon: [[0.38, -0.08], a, [0.8, -0.01], [0.8, 0.01]],
        collar: {
          far: [
            [0.8, -0.01],
            [0.8, 0.01],
          ],
          disk: [0.7, 0],
        },
      },
    ];
    expect(check(c).failures).toContainEqual(
      expect.objectContaining({ code: 'bay-positive-wedge', featureId: 'role' }),
    );
    const island = example();
    island.islands = [{ id: 'island', kind: 'island', polygon: [a, [0.7, -0.2], [0.72, -0.19]] }];
    expect(check(island).failures).toContainEqual(
      expect.objectContaining({ code: 'bay-positive-wedge', featureId: 'island' }),
    );
  });
  it('retains planar pocket, witness, cap and strict dispatch boundaries', () => {
    const c = example();
    c.islands = [
      {
        id: 'island',
        kind: 'island',
        polygon: [
          [0.45, 0],
          [0.47, 0],
          [0.46, 0.01],
        ],
      },
    ];
    expect(codes(c)).toContain('water-intrusion');
    for (const p of [
      [-0.3, 0],
      [-1.9, 0],
    ]) {
      const bad = example();
      bad.bay.witness = p;
      expect(codes(bad)).toContain('bay-witness');
    }
    const offside = example();
    offside.bay.witness = [0.7, 0];
    expect(codes(offside)).toContain('bay-witness-support');
    const pocket = example();
    pocket.bay.polygon[2] = [0.7, 0.2];
    expect(codes(pocket)).toContain('bay-pocket-support');
    const wrong = example();
    wrong.bay.mouth.reverse();
    expect(codes(wrong)).toContain('bay-mouth-order');
    const missing = example();
    missing.bay.mouth[0] = [0.65, -0.12 + 1e-13];
    expect(codes(missing)).toContain('bay-mouth-order');
    for (const mode of ['wedge', '', null, {}, []]) {
      const bad = example();
      bad.bay.mouthKind = mode;
      expect(codes(bad)).toContain('invalid-geometry');
    }
    const cap = example();
    cap.interior[0] = [-1.4, -0.4];
    cap.bodyBoundary = structuredClone(cap.interior);
    expect(codes(cap)).toContain('bay-support-chart');
    const origin = example();
    origin.bay.mouth = [
      [0.6, 0],
      [0.8, 0],
    ];
    origin.bay.polygon = [...origin.bay.mouth, [0.5, 0.2]];
    expect(codes(origin)).toContain('bay-origin-support');
    expect(codes(origin)).not.toContain('bay-mouth-not-radial');
  });
  it('executes the largest primary bay floor without pretending missing anatomy passes', () => {
    const c = example(),
      validated = check(c),
      checks = [],
      failures = [];
    c.primary = true;
    expect(codes(c)).toEqual(expect.arrayContaining(['missing-lobes', 'missing-peninsula']));
    const bodyArea = 0.13106846473029043 * (1 - 0.0095);
    const result = certifyWedgeMouth(c, {
      c: Math.cos(validated.metrics.angularRadius / 2),
      angularRadius: validated.metrics.angularRadius,
      bodyArea,
      fail: (...args) => failures.push(args),
      minimum: (actual, required, code) => checks.push({ actual, required, code }),
      maximum: () => {},
    });
    expect(failures).toEqual([]);
    expect(checks).toContainEqual({
      actual: result.removedAreaLower / bodyArea,
      required: 0.02,
      code: 'bay-removed-share',
    });
    expect(result.removedAreaLower / bodyArea).toBeGreaterThan(0.02 + 1e-9);
    const tiny = example();
    tiny.primary = true;
    tiny.bay.polygon[2] = [0.63, 0.09];
    tiny.bay.polygon[3] = [0.63, -0.08];
    expect(codes(tiny)).toContain('bay-removed-share');
  });
  it('rejects malformed and oversized inputs in the wedge mode', () => {
    for (const patch of [
      { mouth: null },
      { mouth: [] },
      { witness: [Infinity, 0] },
      { polygon: Array(257).fill([0, 0]) },
    ]) {
      const c = example();
      Object.assign(c.bay, patch);
      expect(() => check(c)).not.toThrow();
      expect(check(c).ok).toBe(false);
    }
    const c = example();
    c.attachments = Array(9).fill({});
    expect(certifyCandidate(c, { quota: 0.1 }).ok).toBe(false);
  });
});

it('matches all 54 frozen radial receipts directly', async () => {
  let count = 0;
  for (const revision of ['r1', 'r2']) {
    const data = JSON.parse(
      await readFile(
        new URL(`../issue-172/comparison-${revision}/results.json`, import.meta.url),
        'utf8',
      ),
    );
    for (const report of data.reports)
      for (const owner of report.construction.owners) {
        expect(certifyCandidate(owner.candidate, { quota: owner.quota })).toEqual(
          owner.certificate,
        );
        count++;
      }
  }
  expect(count).toBe(54);
});
