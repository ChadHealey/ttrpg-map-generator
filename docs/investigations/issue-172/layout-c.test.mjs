import { describe, expect, it } from 'vitest';

import { hasEdge, polygonArea, stitchBody } from '../issue-169/geometry.mjs';
import { certifyCandidate } from './certificates.mjs';
import { buildCoast } from './layout-c.mjs';

function fittedBody(quota) {
  const raw = buildCoast('owner-c');
  const boundary = stitchBody(raw.interior, raw.attachments);
  const scale = Math.sqrt((4 * Math.PI * quota) / polygonArea(boundary));
  const point = (p) => p.map((v) => v * scale),
    polygon = (p) => p.map(point);
  return {
    id: 'owner-c',
    primary: true,
    interior: polygon(raw.interior),
    interiorWitness: point(raw.interiorWitness),
    bodyBoundary: polygon(boundary),
    attachments: raw.attachments.map((a) => ({
      ...a,
      root: polygon(a.root),
      polygon: polygon(a.polygon),
      collar: { far: polygon(a.collar.far), disk: point(a.collar.disk) },
    })),
    bay: {
      polygon: polygon(raw.bay.polygon),
      mouth: polygon(raw.bay.mouth),
      witness: point(raw.bay.witness),
    },
    islands: [],
  };
}

describe('issue-172 northern-shelf direct coast', () => {
  it('certifies complete body anatomy at the retained large, ordinary and balanced body budgets', () => {
    for (const ownerQuota of [0.13106846473029043, 0.10494186046511626, 0.06666666666666667]) {
      const quota = ownerQuota * 0.9905;
      const result = certifyCandidate(fittedBody(quota), { quota });
      expect(result.failures).toEqual([]);
      expect(result.ok).toBe(true);
    }
  });
  it('declares six actual exposed compact margin edges with repeatable independent geometry', () => {
    const a = buildCoast('owner-c'),
      b = buildCoast('owner-c');
    expect(a).toEqual(b);
    const boundary = stitchBody(a.interior, a.attachments);
    expect(a.islandAnchorEdges).toHaveLength(6);
    for (const edge of a.islandAnchorEdges) expect(hasEdge(boundary, ...edge)).toBe(true);
    a.interior[0][0] += 0.1;
    expect(a).not.toEqual(b);
  });
});
