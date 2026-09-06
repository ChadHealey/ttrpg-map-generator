import { describe, expect, it } from 'vitest';

import { hasEdge, polygonArea, stitchBody } from '../issue-169/geometry.mjs';
import { certifyCandidate } from '../issue-178/certificates.mjs';
import { buildCoast } from './layout-a.mjs';

function fitted(quota, anatomy) {
  const coast = buildCoast('owner-A', { anatomy }),
    bodyBoundary = stitchBody(coast.interior, coast.attachments);
  const scale = Math.sqrt((4 * Math.PI * quota) / polygonArea(bodyBoundary));
  const transform = (o) =>
    Array.isArray(o)
      ? o.length === 2 && o.every((x) => typeof x === 'number')
        ? o.map((x) => x * scale)
        : o.map(transform)
      : o && typeof o === 'object'
        ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, transform(v)]))
        : o;
  const candidate = transform({
    id: 'owner-A',
    primary: true,
    ...coast,
    bodyBoundary,
    islands: [],
  });
  return {
    candidate,
    certificate: certifyCandidate(candidate, { quota, collarWidthUpperMode: 'root-and-far' }),
  };
}

describe('issue-179 broad-root tapered A', () => {
  it('certifies three primary body quotas at declared anatomy corners without changing role identities', () => {
    for (const anatomy of [
      [0, 0],
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ])
      for (const quota of [
        0.13106846473029043 * 0.9905,
        0.10494186046511626 * 0.9905,
        (0.4 / 6) * 0.984,
      ]) {
        const { certificate } = fitted(quota, anatomy);
        expect(certificate.failures).toEqual([]);
        expect(certificate.metrics.roles.map((r) => r.kind)).toEqual(['lobe', 'lobe', 'peninsula']);
        const peninsula = certificate.metrics.roles.find((r) => r.kind === 'peninsula');
        expect(peninsula.widthUpperWitness).toBe('far');
        expect(peninsula.widthUpperRoot).toBeGreaterThan(0.16);
        if (quota < 0.07)
          expect(certificate.metrics.guardRadius).toBeLessThan((Math.PI / 2 - 0.05) / 2);
      }
  });
  it('keeps fixed exposed island edges and deterministic regional variation', () => {
    const args = { anatomy: [0.4, -0.6] },
      before = structuredClone(args),
      coast = buildCoast('A', args);
    expect(buildCoast('A', args)).toEqual(coast);
    expect(args).toEqual(before);
    expect(coast.bay.mouthKind).toBe('wedge-geodesic');
    expect(coast.islandAnchorEdges).toHaveLength(6);
    const body = stitchBody(coast.interior, coast.attachments);
    for (const [a, b] of coast.islandAnchorEdges) expect(hasEdge(body, a, b)).toBe(true);
    expect(body).toHaveLength(87);
    expect(buildCoast('A', { anatomy: [-1, -1] }).attachments[0].polygon).not.toEqual(
      buildCoast('A', { anatomy: [1, 1] }).attachments[0].polygon,
    );
    expect(coast.attachments[0].root).toEqual(
      buildCoast('A', { anatomy: [-1, -1] }).attachments[0].root,
    );
  });
  it('rejects malformed bounded anatomy instead of coercing it', () => {
    for (const anatomy of [
      [],
      [0],
      [0, 0, 0],
      [NaN, 0],
      [Infinity, 0],
      [1.001, 0],
      ['0', 0],
      {},
      null,
    ])
      expect(() => buildCoast('A', { anatomy })).toThrow(RangeError);
  });
});
