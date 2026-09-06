import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { pointLocation, polygonArea } from '../issue-169/geometry.mjs';
import { constructOwners as constructR1 } from '../issue-172/templates.mjs';
import { constructOwners as constructR2 } from '../issue-172/templates-r2.mjs';
import { certifyCandidate } from './certificates.mjs';
import { certifySupportingMouth } from './supporting-mouth.mjs';

function example({
  a = [0.65, -0.12],
  b = [0.65, 0.12],
  upper = [0.34, 0.09],
  lower = [0.38, -0.08],
} = {}) {
  const interior = [[-0.6, -0.45], [0.35, -0.5], a, lower, upper, b, [0.35, 0.52], [-0.55, 0.5]];
  return structuredClone({
    id: 'owner-0',
    primary: false,
    interior,
    interiorWitness: [0, 0],
    bodyBoundary: interior,
    attachments: [],
    islands: [],
    bay: {
      mouthKind: 'supporting-geodesic',
      polygon: [a, b, upper, lower],
      mouth: [a, b],
      witness: [0.42, 0],
    },
  });
}
function quota(c) {
  return (
    (polygonArea(c.interior) +
      c.attachments.reduce((s, a) => s + polygonArea(a.polygon), 0) +
      c.islands.reduce((s, a) => s + polygonArea(a.polygon), 0)) /
    (4 * Math.PI)
  );
}
const check = (c) => certifyCandidate(c, { quota: quota(c) });
const codes = (c) => check(c).failures.map((f) => f.code);
function transform(c, point) {
  const ring = (p) => p.map(point);
  return {
    ...c,
    interior: ring(c.interior),
    interiorWitness: point(c.interiorWitness),
    bodyBoundary: ring(c.bodyBoundary),
    bay: {
      ...c.bay,
      polygon: ring(c.bay.polygon),
      mouth: ring(c.bay.mouth),
      witness: point(c.bay.witness),
    },
  };
}

describe('issue-174 explicit supporting geodesic mouth', () => {
  it('accepts the reviewed local bay with sufficient measurements and unchanged paid land area', () => {
    const c = example(),
      before = structuredClone(c),
      r = check(c);
    expect(r.failures).toEqual([]);
    expect(c).toEqual(before);
    expect(r.metrics.area).toBe(quota(c));
    expect(r.metrics.bay).toMatchObject({
      mouthKind: 'supporting-geodesic',
      assurance: 'binary64-diagnostic',
    });
    expect(r.metrics.bay.openingLower).toBeCloseTo(0.22248595461286988, 14);
    expect(r.metrics.bay.openingUpper).toBeCloseTo(0.25889274718588495, 14);
    expect(r.metrics.bay.depthLower).toBeCloseTo(0.21321570650400032, 14);
    expect(r.metrics.bay.depthOpeningRatioLower).toBeCloseTo(0.8235677083333334, 14);
    expect(r.metrics.bay.removedAreaLower * 4 * Math.PI).toBeCloseTo(0.05935, 14);
    expect(r.metrics.bay).not.toHaveProperty('opening');
    expect(check(c)).toEqual(r);
  });
  it('normalizes whole-ring reversal consistently without accepting a mouth-only reversal', () => {
    const c = example(),
      forward = check(c);
    c.bay.polygon.reverse();
    c.bay.mouth.reverse();
    const before = structuredClone(c),
      reverse = check(c);
    expect(reverse.failures).toEqual([]);
    expect(reverse.metrics.bay).toEqual(forward.metrics.bay);
    expect(c).toEqual(before);
    c.bay.mouth.reverse();
    expect(codes(c)).toContain('bay-mouth-order');
    const shifted = example();
    shifted.bay.mouth[0] = [0.65, -0.12 + 1e-13];
    expect(codes(shifted)).toContain('bay-mouth-order');
  });
  it('rejects unknown dispatch and never falls back from supporting mode', () => {
    for (const kind of ['supporting', '', null, 1, {}, []]) {
      const c = example();
      c.bay.mouthKind = kind;
      expect(codes(c)).toContain('invalid-geometry');
    }
    const radial = example();
    delete radial.bay.mouthKind;
    expect(codes(radial)).toContain('bay-mouth-not-radial');
    const near = transform(example(), ([x, y]) => [0.6 + y, 0.3 * (x - 0.65) + 5e-11]);
    expect(codes(near)).toContain('bay-origin-support');
    expect(codes(near)).not.toContain('bay-mouth-not-radial');
  });
  it('rejects additional chord contacts, positive mouth edges and the wrong support side', () => {
    const touching = example();
    touching.interior[6] = [0.65, 0.52];
    touching.bodyBoundary = structuredClone(touching.interior);
    expect(codes(touching)).toContain('bay-positive-support');
    const crossing = example();
    crossing.interior[6] = [0.72, 0.52];
    crossing.bodyBoundary = structuredClone(crossing.interior);
    expect(codes(crossing)).toContain('bay-positive-support');
    const bridged = example();
    bridged.interior.splice(3, 2);
    bridged.bodyBoundary = structuredClone(bridged.interior);
    expect(codes(bridged)).toContain('bay-positive-mouth-edge');
  });
  it('rejects an island wholly in the outward lens even though the planar pocket is empty', () => {
    const c = example(),
      polygon = [
        [0.6505, -0.001],
        [0.651, 0],
        [0.6505, 0.001],
      ];
    expect(polygon.every((p) => pointLocation(p, c.bay.polygon) === -1)).toBe(true);
    expect(polygon.every((p) => pointLocation(p, c.interior) === -1)).toBe(true);
    c.islands = [{ id: 'owner-0/island-0', kind: 'island', polygon }];
    expect(check(c).failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'bay-positive-support', featureId: 'owner-0/island-0' }),
      ]),
    );
    const shoulder = example();
    shoulder.islands = [
      {
        id: 'island-0',
        kind: 'island',
        polygon: [shoulder.bay.mouth[0], [0.68, -0.13], [0.67, -0.1]],
      },
    ];
    expect(check(shoulder).failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'bay-positive-support', featureId: 'island-0', actual: 0 }),
      ]),
    );
  });
  it('checks declared roles as well as the stitched boundary and retained planar pocket', () => {
    const c = example(),
      a = c.interior[0],
      b = c.interior[1];
    c.attachments = [
      {
        id: 'role-0',
        kind: 'lobe',
        root: [a, b],
        polygon: [b, a, [-0.6, -0.75], [0.7, -0.65]],
        collar: {
          far: [
            [-0.6, -0.75],
            [0.7, -0.65],
          ],
          disk: [0, -0.6],
        },
      },
    ];
    expect(check(c).failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'bay-positive-support', featureId: 'role-0' }),
      ]),
    );
    const intrusion = example();
    intrusion.islands = [
      {
        id: 'island-0',
        kind: 'island',
        polygon: [
          [0.45, 0],
          [0.47, 0],
          [0.46, 0.01],
        ],
      },
    ];
    expect(codes(intrusion)).toContain('water-intrusion');
    expect(codes(intrusion)).not.toContain('bay-positive-support');
  });
  it('retains invalid witness, cap and numerical margin failures', () => {
    const outside = example();
    outside.bay.witness = [-0.3, 0];
    expect(codes(outside)).toContain('bay-witness');
    outside.bay.witness = [-1.9, 0];
    expect(codes(outside)).toEqual(expect.arrayContaining(['bay-witness', 'bay-witness-cap']));
    const cap = transform(example(), (p) => p.map((x) => x * 1.8));
    expect(codes(cap)).toContain('bay-support-chart');
    const tiny = example({ a: [0.65, -1e-12], b: [0.65, 1e-12] });
    expect(check(tiny).ok).toBe(false);
    const margin = example();
    margin.interior[6] = [0.65 - 5e-11, 0.52];
    margin.bodyBoundary = structuredClone(margin.interior);
    expect(codes(margin)).toContain('bay-positive-support');
  });
  it('uses conservative opening, witness line depth, ratio and planar removed area gates', () => {
    expect(codes(example({ a: [0.65, -0.05], b: [0.65, 0.05] }))).toContain('bay-opening-min');
    expect(codes(example({ a: [0.65, -0.17], b: [0.65, 0.17] }))).toContain('bay-opening-max');
    const shallow = example();
    shallow.bay.witness = [0.6, 0];
    expect(codes(shallow)).toEqual(expect.arrayContaining(['bay-depth', 'bay-ratio']));
    const small = example({
      a: [0.65, -0.07],
      b: [0.65, 0.07],
      upper: [0.42, 0.012],
      lower: [0.4, -0.01],
    });
    small.primary = true;
    small.bay.witness = [0.43, 0];
    expect(codes(small)).toContain('bay-removed-share');
    const primary = example();
    primary.primary = true;
    expect(codes(primary)).toEqual(expect.arrayContaining(['missing-lobes', 'missing-peninsula']));
    expect(codes(primary)).not.toContain('bay-removed-share');
  });
  it('applies the primary bay-area gate at the largest retained body quota in a standalone bay check', () => {
    const c = example(),
      validated = check(c),
      minimumChecks = [],
      failures = [];
    c.primary = true;
    const bodyArea = 0.13106846473029043 * (1 - 0.0095);
    const result = certifySupportingMouth(c, {
      c: Math.cos(validated.metrics.angularRadius / 2),
      angularRadius: validated.metrics.angularRadius,
      bodyArea,
      fail: (...failure) => failures.push(failure),
      minimum: (actual, required, code) => minimumChecks.push({ actual, required, code }),
      maximum: () => {},
    });
    expect(failures).toEqual([]);
    const gate = minimumChecks.find((item) => item.code === 'bay-removed-share');
    expect(gate.required).toBe(0.02);
    expect(gate.actual).toBe(result.removedAreaLower / bodyArea);
    expect(gate.actual).toBeGreaterThan(0.02 + 1e-9);
    expect(result.removedAreaLower * 4 * Math.PI).toBeCloseTo(0.05935, 14);
  });
  it('rejects malformed and oversized finite inputs before unbounded geometry work', () => {
    for (const patch of [
      { mouth: null },
      { mouth: [] },
      { witness: [NaN, 0] },
      { polygon: [] },
      {
        mouth: [
          [0.65, 0],
          [0.65, 0],
        ],
      },
    ]) {
      const c = example();
      Object.assign(c.bay, patch);
      expect(() => check(c)).not.toThrow();
      expect(check(c).ok).toBe(false);
    }
    const many = example();
    many.attachments = Array(9).fill({});
    expect(certifyCandidate(many, { quota: 0.1 }).failures.map((f) => f.code)).toContain(
      'invalid-input',
    );
    const ring = example();
    ring.bay.polygon = Array(257).fill([0, 0]);
    expect(codes(ring)).toContain('invalid-geometry');
  });
});

it('preserves both retained radial six-input cohorts and explicit radial mode byte for byte', async () => {
  const inputs = JSON.parse(
    await readFile(new URL('../issue-172/local-diagnostics/inputs.json', import.meta.url), 'utf8'),
  );
  for (const construct of [constructR1, constructR2])
    for (const input of inputs) {
      const result = construct(input);
      expect(result.ok).toBe(true);
      for (const owner of result.owners) {
        expect(certifyCandidate(owner.candidate, { quota: owner.quota })).toEqual(
          owner.certificate,
        );
        if (owner.candidate.bay) {
          const c = structuredClone(owner.candidate);
          c.bay.mouthKind = 'radial';
          expect(certifyCandidate(c, { quota: owner.quota })).toEqual(owner.certificate);
        }
      }
    }
});
