import { describe, expect, it } from 'vitest';

import { certifyCandidate } from './certificates.mjs';
import {
  distanceToSegment,
  forwardLambert,
  inverseLambert,
  isSimplePolygon,
  minBoundaryDistance,
  pointInPolygon,
  polygonArea,
  scaleCandidate,
  segmentRelation,
  signedArea,
  signedDistance,
  stitchBody,
} from './geometry.mjs';

const square = [
  [-0.3, -0.3],
  [0.3, -0.3],
  [0.3, 0.3],
  [-0.3, 0.3],
];
function body(interior = square, attachments = [], bay = null) {
  return {
    id: 'owner-0',
    primary: false,
    interior: structuredClone(interior),
    interiorWitness: [0, 0],
    attachments,
    bay,
    islands: [],
    bodyBoundary: stitchBody(interior, attachments),
  };
}
const quotaOf = (candidate) =>
  (polygonArea(candidate.interior) +
    candidate.attachments.reduce((s, a) => s + polygonArea(a.polygon), 0) +
    candidate.islands.reduce((s, a) => s + polygonArea(a.polygon), 0)) /
  (4 * Math.PI);
const check = (candidate, quota = quotaOf(candidate)) =>
  certifyCandidate(candidate, { quota, nominalClearance: 0.05 });
const codes = (candidate) => check(candidate).failures.map((f) => f.code);
function lobeBody(kind = 'lobe') {
  const w = kind === 'lobe' ? 0.16 : 0.12,
    h = kind === 'lobe' ? 0.08 : 0.065;
  const interior = [
    [-0.3, -0.3],
    [0.3, -0.3],
    [0.3, -w / 2],
    [0.3, w / 2],
    [0.3, 0.3],
    [-0.3, 0.3],
  ];
  const root = [
    [0.3, -w / 2],
    [0.3, w / 2],
  ];
  const polygon = [
    root[0],
    root[1],
    [0.3 + h, w / 2],
    [0.51, 0.13],
    [0.64, 0.02],
    [0.52, -0.12],
    [0.3 + h, -w / 2],
  ];
  return body(interior, [{ id: 'feature-0', kind, polygon, root, collarHeight: h }]);
}
function bayBody() {
  const mouth = [
      [0.7, 0],
      [0.45, 0],
    ],
    tip = [0.5, -0.3];
  const interior = [[-0.4, -0.4], [0.6, -0.4], mouth[0], tip, mouth[1], [0.5, 0.4], [-0.4, 0.4]];
  const result = body(interior, [], {
    polygon: [mouth[0], mouth[1], tip],
    mouth,
    witness: [0.53, -0.22],
  });
  result.interiorWitness = [-0.1, 0];
  return result;
}

describe('issue-169 equal-area geometry', () => {
  it('round-trips chart coordinates and keeps the unit sphere, including beyond a hemisphere', () => {
    for (const radius of [0, 0.2, 0.8, 1.5, 1.8])
      for (let i = 0; i < 24; i++) {
        const angle = (i * Math.PI) / 12,
          point = [radius * Math.cos(angle), radius * Math.sin(angle)];
        const sphere = inverseLambert(point),
          restored = forwardLambert(sphere);
        expect(Math.hypot(...sphere)).toBeCloseTo(1, 14);
        expect(Math.hypot(restored[0] - point[0], restored[1] - point[1])).toBeLessThan(1e-13);
      }
    expect(() => inverseLambert([2, 0])).toThrow();
    expect(() => forwardLambert([0, 0, -1])).toThrow();
  });
  it('corroborates the global metric bounds without assuming geodesic cap convexity', () => {
    const capRadius = 1.8,
      c = Math.sqrt(1 - capRadius ** 2 / 4);
    for (let i = 1; i < 31; i++) {
      const u = [capRadius * Math.cos(i), capRadius * Math.sin(i)];
      const v = [0.8 * Math.cos(i * 1.7), 0.8 * Math.sin(i * 1.7)];
      const p = inverseLambert(u),
        q = inverseLambert(v);
      const d = Math.acos(
        Math.max(
          -1,
          Math.min(
            1,
            p.reduce((s, x, j) => s + x * q[j], 0),
          ),
        ),
      );
      const planar = Math.hypot(u[0] - v[0], u[1] - v[1]);
      expect(d).toBeGreaterThanOrEqual(c * planar - 1e-14);
      expect(d).toBeLessThanOrEqual(planar / c + 1e-14);
    }
  });
  it('measures area, distance and exact field sign independently of conservative topology tolerance', () => {
    expect(polygonArea(square)).toBeCloseTo(0.36, 14);
    expect(signedArea([...square].reverse())).toBeCloseTo(-0.36, 14);
    expect(distanceToSegment([0.6, 0.4], [-0.3, 0.3], [0.3, 0.3])).toBeCloseTo(
      Math.hypot(0.3, 0.1),
      14,
    );
    expect(minBoundaryDistance([0, 0], square)).toBe(0.3);
    expect(pointInPolygon([0, 0], square)).toBe(true);
    expect(signedDistance([0.3 + 5e-11, 0], [square])).toBeLessThan(0);
    expect(signedDistance([0.3 - 5e-11, 0], [square])).toBeGreaterThan(0);
    expect(signedDistance([0.3, 0], [square])).toBe(0);
  });
  it('rejects crossed, overlapping and self-touching boundaries and stitches only one simple ring', () => {
    expect(segmentRelation([0, 0], [1, 1], [0, 1], [1, 0])).toBe('cross');
    expect(segmentRelation([-0.005, 0], [0.005, 0], [0, -5e-9], [0, 1])).toBe('cross');
    expect(segmentRelation([0, 0], [2, 0], [1, 0], [3, 0])).toBe('overlap');
    expect(
      isSimplePolygon([
        [0, 0],
        [1, 1],
        [0, 1],
        [1, 0],
      ]),
    ).toBe(false);
    expect(
      isSimplePolygon([
        [0, 0],
        [1, 0],
        [0.5, 0.5],
        [1, 1],
        [0, 1],
        [0.5, 0.5],
      ]),
    ).toBe(false);
    expect(() =>
      stitchBody(square, [
        {
          polygon: [
            [0.5, 0],
            [0.6, 0],
            [0.6, 0.1],
          ],
        },
      ]),
    ).toThrow();
    const candidate = lobeBody();
    expect(polygonArea(candidate.bodyBoundary)).toBeCloseTo(quotaOf(candidate) * 4 * Math.PI, 13);
  });
});

describe('issue-169 measured continuous certificates', () => {
  it('certifies a subordinate disk, a single attachment and a protected radial bay', () => {
    for (const candidate of [body(), lobeBody(), lobeBody('peninsula'), bayBody()]) {
      const report = check(candidate);
      expect(report.failures).toEqual([]);
      expect(report.ok).toBe(true);
      expect(report.metrics.guardRadius - report.metrics.angularRadius).toBeCloseTo(0.05, 14);
    }
  });
  it('preserves the algebraic area ledger when uniformly scaling before placement', () => {
    const original = lobeBody(),
      snapshot = structuredClone(original);
    const scaled = scaleCandidate(original, 1.2);
    expect(original).toEqual(snapshot);
    expect(quotaOf(scaled)).toBeCloseTo(quotaOf(original) * 1.44, 14);
    expect(scaled.attachments[0].collarHeight).toBe(original.attachments[0].collarHeight * 1.2);
    expect(check(scaled).metrics.quotaError).toBeCloseTo(0, 14);
    expect(
      check(original, quotaOf(original) + 0.01).failures.some((f) => f.code === 'quota-residual'),
    ).toBe(true);
  });
  it('cannot pass a primary by attaching labels to a broad polygon', () => {
    const candidate = body();
    candidate.primary = true;
    expect(codes(candidate)).toEqual(
      expect.arrayContaining(['missing-lobes', 'missing-peninsula', 'missing-bay']),
    );
    const thin = body([
      [-0.6, -0.02],
      [0.6, -0.02],
      [0.6, 0.02],
      [-0.6, 0.02],
    ]);
    expect(codes(thin)).toContain('interior-radius');
  });
  it('rejects extra bridges, changed body geometry and a head returning into its collar', () => {
    const candidate = lobeBody();
    const backward = structuredClone(candidate);
    backward.attachments[0].polygon.splice(3, 0, [0.34, 0.01]);
    expect(codes(backward)).toContain('head-enters-collar');
    const bridge = structuredClone(candidate);
    bridge.attachments[0].polygon.splice(3, 0, [0.3, 0.2]);
    expect(codes(bridge)).toContain('attachment-topology');
    const changed = structuredClone(candidate);
    changed.bodyBoundary = structuredClone(square);
    expect(codes(changed)).toContain('body-boundary-mismatch');
  });
  it('does not certify a narrow root, oversized peninsula or an absent first interior disk', () => {
    const narrow = scaleCandidate(lobeBody(), 0.5);
    expect(codes(narrow)).toContain('attachment-width');
    const long = scaleCandidate(lobeBody('peninsula'), 1.5);
    expect(codes(long)).toEqual(
      expect.arrayContaining(['peninsula-extent-max', 'peninsula-width-max']),
    );
    const shallow = lobeBody();
    shallow.attachments[0].collarHeight = 0.02;
    expect(codes(shallow)).toContain('first-disk');
  });
  it('rejects offshore, filled and nonradial water pockets rather than reporting nominal bay dimensions', () => {
    const offshore = bayBody();
    offshore.bay.polygon = [
      [0.8, 0],
      [1, 0],
      [0.9, -0.2],
    ];
    expect(codes(offshore)).toContain('bay-coast');
    const filled = bayBody();
    filled.islands = [
      {
        id: 'island-0',
        kind: 'island',
        polygon: [
          [0.52, -0.2],
          [0.54, -0.2],
          [0.53, -0.23],
        ],
      },
    ];
    expect(codes(filled)).toContain('water-intrusion');
    const nonradial = bayBody();
    nonradial.bay.mouth[0] = [0.7, 1e-13];
    expect(codes(nonradial)).toContain('bay-mouth-not-radial');
    const shallow = bayBody();
    shallow.bay.witness = [0.54, -0.03];
    expect(codes(shallow)).toContain('bay-depth');
  });
  it('rejects contact islands, invalid chart coordinates and exceeded finite budgets', () => {
    const touching = body();
    touching.islands = [
      {
        id: 'island-0',
        kind: 'island',
        polygon: [
          [0.3, 0],
          [0.45, 0],
          [0.4, 0.1],
        ],
      },
    ];
    expect(codes(touching)).toContain('island-body-contact');
    expect(check(scaleCandidate(body(), 8), 0.1).failures.map((f) => f.code)).toContain(
      'chart-domain',
    );
    const nonfinite = body();
    nonfinite.interior[0][0] = NaN;
    expect(check(nonfinite, 0.1).failures.map((f) => f.code)).toContain('invalid-geometry');
    const malformed = body();
    malformed.attachments = [null];
    expect(check(malformed, 0.1).failures.map((f) => f.code)).toContain('invalid-input');
    const excessive = body();
    excessive.interior = Array.from({ length: 257 }, (_, i) => [Math.cos(i), Math.sin(i)]);
    expect(check(excessive, 0.1).failures.map((f) => f.code)).toContain('invalid-geometry');
  });
});
