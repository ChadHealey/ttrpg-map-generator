import { describe, expect, it } from 'vitest';

import { inputs } from '../issue-165/run.mjs';
import { assessReadiness } from './readiness.mjs';
import { constructOwners } from './templates.mjs';

// These are rejection regressions. They preserve the desired thresholds rather than qualify
// the failed local recipe as a successful candidate when its individual role checks pass.
describe('issue-170 local rejection gate', () => {
  it('retains the packing and diversity failures despite individually certified owners', async () => {
    const reports = (await inputs()).map((input) => ({
      input,
      construction: constructOwners(input),
    }));
    expect(reports.every(({ construction }) => construction.ok)).toBe(true);
    const result = assessReadiness(reports);
    expect(result.readyForComparison).toBe(false);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'packing-obtuse-bound', inputId: 'connected-majority' }),
        expect.objectContaining({ code: 'accepted-layout-diversity', requiredLayoutCount: 3 }),
      ]),
    );
  });
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
