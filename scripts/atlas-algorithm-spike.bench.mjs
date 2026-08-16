import { afterAll, bench, describe } from 'vitest';

import { runAtlasAlgorithmSpikeCase } from '../packages/generation/src/atlas-algorithm-spike.ts';
import { MILESTONE_TWO_ATLAS_ALGORITHM_SPIKE_CASES } from '../packages/generation/src/atlas-algorithm-spike-field.ts';
import { WORLD_ATLAS_FULL_PROFILE } from '../packages/generation/src/atlas-sampling-profiles.ts';

const observations = new Map();

describe('Milestone 2 full-profile geography algorithm spike', () => {
  for (const spike of MILESTONE_TWO_ATLAS_ALGORITHM_SPIKE_CASES) {
    bench(
      spike.fixtureId,
      () => {
        const rssBefore = process.memoryUsage().rss;
        const startedAt = performance.now();
        const report = runAtlasAlgorithmSpikeCase(spike, WORLD_ATLAS_FULL_PROFILE);
        const elapsedMs = performance.now() - startedAt;
        const rssAfter = process.memoryUsage().rss;
        const prior = observations.get(spike.fixtureId);
        if (prior === undefined || elapsedMs < prior.elapsedMs) {
          observations.set(spike.fixtureId, {
            ...report,
            elapsedMs,
            rssDeltaBytes: Math.max(0, rssAfter - rssBefore),
          });
        }
      },
      { iterations: 1, time: 0, warmupIterations: 0, warmupTime: 0 },
    );
  }
});

afterAll(() => {
  const ordered = MILESTONE_TWO_ATLAS_ALGORITHM_SPIKE_CASES.map(({ fixtureId }) =>
    observations.get(fixtureId),
  ).filter((observation) => observation !== undefined);
  console.log(`ATLAS_ALGORITHM_SPIKE_REPORT\n${JSON.stringify(ordered, undefined, 2)}`);
});
