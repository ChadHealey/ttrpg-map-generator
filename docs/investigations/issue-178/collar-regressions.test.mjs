import { describe, expect, it } from 'vitest';

import { pointLocation, polygonArea, stitchBody } from '../issue-169/geometry.mjs';
import { certifyCandidate } from './certificates.mjs';

const root = [
  [0, -0.065],
  [0, 0.065],
];
const left = Array.from({ length: 5 }, (_, i) => {
  const t = i / 4;
  return [0.24 * t, -0.065 - 0.025 * (3 * t * t - 2 * t * t * t)];
});
const right = Array.from({ length: 5 }, (_, i) => {
  const t = i / 4;
  return [0.24 * t, 0.065 + 0.09 * t * t - 0.065 * t * t * t];
});
function example(kind = 'lobe') {
  const interior = [[-0.4, -0.25], [0, -0.25], root[0], root[1], [0, 0.25], [-0.4, 0.25]];
  const attachment = {
    id: 'owner-0/feature-0',
    kind,
    root,
    polygon: [
      ...left,
      [0.31, -0.105],
      [0.38, -0.035],
      [0.37, 0.04],
      [0.29, 0.1],
      ...right.toReversed(),
    ],
    collar: { far: [left.at(-1), right.at(-1)], disk: [0.13, 0] },
  };
  return structuredClone({
    id: 'owner-0',
    primary: false,
    interior,
    interiorWitness: [-0.2, 0],
    attachments: [attachment],
    bay: null,
    islands: [],
    bodyBoundary: stitchBody(interior, [attachment]),
  });
}
function quota(candidate) {
  return (
    (polygonArea(candidate.interior) +
      candidate.attachments.reduce((sum, a) => sum + polygonArea(a.polygon), 0) +
      candidate.islands.reduce((sum, a) => sum + polygonArea(a.polygon), 0)) /
    (4 * Math.PI)
  );
}
const check = (candidate) =>
  certifyCandidate(candidate, {
    quota: quota(candidate),
    nominalClearance: 0.05,
    collarWidthUpperMode: 'root-and-far',
  });
const codes = (candidate) => check(candidate).failures.map((f) => f.code);
function restitch(candidate) {
  candidate.bodyBoundary = stitchBody(candidate.interior, candidate.attachments);
  return candidate;
}

describe('issue-178 new-mode general collar rejection regressions', () => {
  it('certifies the reviewed curved example with measured component areas and a whole interior disk', () => {
    const candidate = example(),
      before = structuredClone(candidate),
      result = check(candidate);
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
    expect(candidate).toEqual(before);
    const role = result.metrics.roles[0],
      c = Math.cos(result.metrics.angularRadius / 2);
    expect(role.opposingChainDistance).toBe(0.13);
    expect(role.widthLower).toBeCloseTo(c * 0.13, 8);
    expect(role.widthUpper).toBeCloseTo(0.13 / c, 8);
    expect(role.firstDiskRadiusLower).toBeGreaterThan(0.05);
    expect(role.collarArea * 4 * Math.PI).toBeCloseTo(0.03748125, 13);
    expect((role.collarArea + role.distalArea) * 4 * Math.PI).toBeCloseTo(0.05958125, 13);
    expect(role.collarPolygon).toContainEqual(root[0]);
    expect(role.distalPolygon).not.toContainEqual(root[0]);
    expect(check(candidate)).toEqual(result);
  });
  it('derives the same topological components regardless of ring or far-endpoint array orientation', () => {
    const candidate = example(),
      reversed = structuredClone(candidate);
    reversed.attachments[0].polygon.reverse();
    reversed.attachments[0].collar.far.reverse();
    const a = check(candidate),
      b = check(reversed);
    expect(b.failures).toEqual([]);
    expect(b.metrics.roles[0].collarPolygon).toEqual(a.metrics.roles[0].collarPolygon);
    expect(b.metrics.roles[0].distalPolygon).toEqual(a.metrics.roles[0].distalPolygon);
    expect(b.metrics.roles[0].opposingChainDistance).toBe(a.metrics.roles[0].opposingChainDistance);
    expect(b.metrics.roles[0].area).toBeCloseTo(a.metrics.roles[0].area, 14);
    expect(b.metrics.roles[0].share).toBeCloseTo(a.metrics.roles[0].share, 14);
  });
  it('allows a genuine curved distal return without a rectangular head-coordinate restriction', () => {
    const candidate = example(),
      attachment = candidate.attachments[0];
    attachment.polygon.splice(9, 0, [0.2, 0.18]);
    restitch(candidate);
    expect(check(candidate).failures).toEqual([]);
    expect(check(candidate).metrics.roles[0].distalPolygon).toContainEqual([0.2, 0.18]);
  });
  it('rejects a narrow throat even though the original root stays wide', () => {
    const candidate = example(),
      attachment = candidate.attachments[0];
    const lower = [...left.slice(0, 2), [0.12, -0.015], ...left.slice(2)];
    const upper = [...right.slice(0, 2), [0.12, 0.015], ...right.slice(2)];
    attachment.polygon = [
      ...lower,
      [0.31, -0.105],
      [0.38, -0.035],
      [0.37, 0.04],
      [0.29, 0.1],
      ...upper.toReversed(),
    ];
    restitch(candidate);
    const result = check(candidate);
    expect(result.failures.map((f) => f.code)).toContain('attachment-width');
    expect(result.metrics.roles[0].opposingChainDistance).toBeCloseTo(0.03, 14);
    expect(result.metrics.roles[0].widthUpper).toBeGreaterThan(0.13);
    expect(result.metrics.roles[0].widthLower).toBeLessThan(0.03);
  });
  it('requires the entire first disk in the root-adjacent component, not just inside F', () => {
    const distal = example();
    distal.attachments[0].collar.disk = [0.3, 0];
    expect(pointLocation(distal.attachments[0].collar.disk, distal.attachments[0].polygon)).toBe(1);
    expect(codes(distal)).toContain('first-disk-outside-collar');
    const clipped = example();
    clipped.attachments[0].collar.disk = [0.22, 0];
    const result = check(clipped);
    expect(
      pointLocation(clipped.attachments[0].collar.disk, result.metrics.roles[0].collarPolygon),
    ).toBe(1);
    expect(result.failures.map((f) => f.code)).toContain('first-disk');
  });
  it('rejects root/far endpoint coincidences, missing exact vertices and a coast-edge far cut', () => {
    for (const far of [
      [root[0], right.at(-1)],
      [left.at(-1), left.at(-1)],
      [[0.24 + 1e-13, -0.09], right.at(-1)],
    ]) {
      const candidate = example();
      candidate.attachments[0].collar.far = far;
      expect(codes(candidate)).toContain('collar-far-endpoints');
    }
    const edge = example();
    edge.attachments[0].collar.far = [left[1], left[2]];
    expect(codes(edge)).toContain('collar-far-boundary');
    expect(check(edge).metrics.roles).toEqual([]);
  });
  it('rejects a far crosscut outside F or touching an undeclared boundary point', () => {
    const outside = example();
    outside.attachments[0].collar.far = [left[3], [0.31, -0.105]];
    expect(codes(outside)).toContain('collar-far-outside');
    const touching = example();
    touching.attachments[0].polygon.splice(7, 0, [0.24, 0]);
    restitch(touching);
    expect(codes(touching)).toContain('collar-far-contact');
  });
  it('rejects a second body bridge and hidden or omitted coast boundaries', () => {
    const bridge = example();
    bridge.interior = [
      [-0.4, -0.25],
      [0, -0.25],
      root[0],
      root[1],
      [0, 0.08],
      [0.3, 0.08],
      [0.3, 0.095],
      [0, 0.095],
      [0, 0.25],
      [-0.4, 0.25],
    ];
    expect(codes(bridge)).toContain('attachment-topology');
    const omitted = example();
    omitted.bodyBoundary = structuredClone(omitted.interior);
    expect(codes(omitted)).toEqual(
      expect.arrayContaining(['body-boundary-mismatch', 'collar-hidden-coast']),
    );
  });
  it('keeps peninsula measurements and primary inventory distinct from collar success', () => {
    const peninsula = example('peninsula'),
      result = check(peninsula);
    expect(result.failures).toEqual([]);
    expect(result.metrics.roles[0].extentLower).toBeGreaterThan(0.2);
    expect(result.metrics.roles[0].extentUpper).toBeLessThan(0.45);
    expect(result.metrics.roles[0].extentWidthRatioLower).toBeGreaterThan(2);
    const primary = example();
    primary.primary = true;
    expect(codes(primary)).toEqual(
      expect.arrayContaining(['missing-lobes', 'missing-peninsula', 'missing-bay']),
    );
  });
  it('retains quota, duplicate identity, protected-area and invalid-record failures', () => {
    const candidate = example();
    expect(
      certifyCandidate(candidate, { quota: quota(candidate) + 0.01 }).failures.map((f) => f.code),
    ).toContain('quota-residual');
    const duplicate = example();
    duplicate.islands = [
      {
        id: duplicate.attachments[0].id,
        kind: 'island',
        polygon: [
          [0.5, 0],
          [0.53, 0],
          [0.51, 0.03],
        ],
      },
    ];
    expect(codes(duplicate)).toContain('duplicate-id');
    const contact = example();
    contact.islands = [
      {
        id: 'island-0',
        kind: 'island',
        polygon: [
          [0.28, 0],
          [0.3, 0],
          [0.29, 0.02],
        ],
      },
    ];
    expect(codes(contact)).toContain('island-body-contact');
    const invalid = example();
    invalid.attachments[0].collar = null;
    expect(codes(invalid)).toContain('invalid-geometry');
  });
});
