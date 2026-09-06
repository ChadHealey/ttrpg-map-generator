import { describe, expect, it } from 'vitest';

import { assessReadiness, packingFailures } from './readiness.mjs';

// These are rejection regressions. They preserve the desired thresholds rather than qualify
// the failed local recipe as a successful candidate when its individual role checks pass.
describe('issue-172 local rejection gate', () => {
  it('does not count a control-only layout toward ordinary diversity', () => {
    const row = (id, layouts) => ({
      input: { id, controls: { continentCountIntent: layouts.length } },
      construction: {
        ok: true,
        owners: layouts.map((layoutIndex, i) => ({
          id: `owner-${i}`,
          radius: 0.5,
          certificate: { ok: true },
          candidate: { primary: true, layoutIndex },
        })),
      },
    });
    const result = assessReadiness([row('normal-01', [1, 2]), row('connected-majority', [0])]);
    expect(result.readyForComparison).toBe(false);
    expect(result.failures).toContainEqual(
      expect.objectContaining({
        code: 'accepted-layout-diversity',
        observedLayouts: [1, 2],
      }),
    );
  });
  it('does not interpret a geometric necessary condition as a rejection of feasible smaller caps', () => {
    const reports = [
      {
        input: { id: 'normal-01', controls: { continentCountIntent: 6 } },
        construction: {
          ok: true,
          owners: Array.from({ length: 6 }, (_, i) => ({
            id: `owner-${i}`,
            radius: 0.7,
            certificate: { ok: true },
            candidate: { primary: true, layoutIndex: i % 3 },
          })),
        },
      },
    ];
    expect(assessReadiness(reports)).toEqual({ readyForComparison: true, failures: [] });
  });
});

describe('issue-172 necessary packing bounds', () => {
  it('rejects the independently proved retained four-owner obstructions', () => {
    expect(
      packingFailures(
        [1.1391717987182857, 0.7311773783120331, 1.1391717987182857, 0.7311773783120331],
        'two-plus-two',
      ),
    ).toContainEqual(expect.objectContaining({ code: 'packing-two-plus-two-bound' }));
    expect(
      packingFailures(
        [1.0139846732370452, 1.0139846732370452, 0.6570801690645831, 1.0139846732370452],
        'three-plus-one',
      ),
    ).toContainEqual(expect.objectContaining({ code: 'packing-three-plus-one-bound' }));
  });
  it('rejects impossible pairs/triples and preserves feasible tetrahedral/octahedral witnesses', () => {
    expect(packingFailures([1.6, 1.6], 'pair')).toContainEqual(
      expect.objectContaining({ code: 'packing-antipodal-bound' }),
    );
    expect(packingFailures([0.1, 1.1, 1.1, 1.1], 'triple')).toContainEqual(
      expect.objectContaining({ code: 'packing-primary-triple-bound' }),
    );
    expect(packingFailures([0.8, 0.8, 0.8, 0.8], 'tetrahedron')).toEqual([]);
    expect(packingFailures([0.01, 1.01, 1.01, 1.01], 'positive-cross-dot')).toEqual([]);
    expect(packingFailures(Array(6).fill(0.75), 'octahedron')).toEqual([]);
    expect(packingFailures(Array(6).fill(0.8), 'obtuse')).toContainEqual(
      expect.objectContaining({ code: 'packing-obtuse-bound' }),
    );
  });
});
