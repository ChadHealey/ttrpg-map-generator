import { expect, it } from 'vitest';

import { hasEdge, polygonArea, stitchBody } from '../issue-169/geometry.mjs';
import { certifyCandidate } from './certificates.mjs';
import { buildCoast } from './layout-r2-b.mjs';

it('keeps periodic layout R2 B roots, collars, and bay valid across the required main-body quota scales', () => {
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
    expect(body).toHaveLength(112);
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
    'owner-b/lobe-0',
    'owner-b/lobe-1',
    'owner-b/peninsula-2',
  ]);
});

it('changes regional whole-coast anchors deterministically before the fixed partition', () => {
  const first = buildCoast('owner-b', { anatomy: [-0.7, 0.6], variation: 0, fragmentationBand: 2 });
  const again = buildCoast('owner-b', { anatomy: [-0.7, 0.6], variation: 0, fragmentationBand: 2 });
  const second = buildCoast('owner-b', {
    anatomy: [0.7, -0.6],
    variation: 0,
    fragmentationBand: 2,
  });
  expect(first).toEqual(again);
  expect(first.interior).not.toEqual(second.interior);
  expect(first.attachments[1].root).not.toEqual(second.attachments[1].root);
  expect(first.attachments.map((a) => a.id)).toEqual(second.attachments.map((a) => a.id));
  expect(stitchBody(first.interior, first.attachments)).toHaveLength(112);
  for (const options of [
    { anatomy: [NaN, 0] },
    { anatomy: [2, 0] },
    { anatomy: [0] },
    { variation: 4 },
    { variation: -1 },
    { fragmentationBand: 4 },
  ])
    expect(() => buildCoast('owner-b', options)).toThrow(RangeError);
});
