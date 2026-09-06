import { expect, it } from 'vitest';

import { hasEdge, polygonArea, stitchBody } from '../issue-169/geometry.mjs';
import { certifyCandidate } from './certificates.mjs';
import { buildCoast } from './layout-b.mjs';

it('keeps layout B roots, collars, and bay valid across the required main-body quota scales', () => {
  for (const quota of [0.13106846473029043, 0.104942, 0.06666666666666667]) {
    const raw = buildCoast('owner-b'),
      body = stitchBody(raw.interior, raw.attachments),
      scale = Math.sqrt((4 * Math.PI * quota) / polygonArea(body)),
      point = ([x, y]) => [scale * x, scale * y],
      ring = (polygon) => polygon.map(point);
    const candidate = {
      ...raw,
      id: 'owner-b',
      primary: true,
      interior: ring(raw.interior),
      interiorWitness: point(raw.interiorWitness),
      bodyBoundary: ring(body),
      islands: [],
      attachments: raw.attachments.map((a) => ({
        ...a,
        root: ring(a.root),
        polygon: ring(a.polygon),
        collar: { far: ring(a.collar.far), disk: point(a.collar.disk) },
      })),
      bay: {
        polygon: ring(raw.bay.polygon),
        mouth: ring(raw.bay.mouth),
        witness: point(raw.bay.witness),
      },
    };
    const result = certifyCandidate(candidate, { quota });
    expect(result.failures).toEqual([]);
    expect(result.metrics.roles.map((role) => role.share)).toEqual([
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    ]);
    expect(raw.islandAnchorEdges).toHaveLength(6);
    expect(raw.islandAnchorEdges.every((edge) => hasEdge(body, ...edge))).toBe(true);
  }
});

it('returns independently owned deterministic raw geometry with explicit role identity', () => {
  const a = buildCoast('owner-b'),
    b = buildCoast('owner-b');
  expect(a).toEqual(b);
  a.attachments[0].polygon[1][0] += 1;
  expect(a).not.toEqual(b);
  expect(b.attachments.map((feature) => feature.id)).toEqual([
    'owner-b/lobe-1',
    'owner-b/lobe-2',
    'owner-b/peninsula',
  ]);
});
