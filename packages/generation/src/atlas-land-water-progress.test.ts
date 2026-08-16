import { describe, expect, it } from 'vitest';

import {
  generateAtlasLandWaterFull,
  generateAtlasLandWaterPreview,
} from './atlas-land-water-generator.js';
import type { AtlasGenerationProgress } from './atlas-land-water-generator-contract.js';
import {
  atlasLandWaterInvalidResult,
  validateAtlasLandWaterRealization,
} from './atlas-land-water-generator-diagnostics.js';
import { AtlasLandWaterProgressReporter } from './atlas-land-water-progress.js';
import {
  cancellationController,
  fixedAtlasInput,
  fixedAtlasRuntime,
} from './atlas-land-water-test-support.js';
import {
  WORLD_ATLAS_FULL_PROFILE,
  WORLD_ATLAS_PREVIEW_PROFILE,
} from './atlas-sampling-profiles.js';

describe('atlas terminal progress states', () => {
  it('routes validation-invalid full and preview profiles through one monotonic failed event', () => {
    const input = fixedAtlasInput();
    const diagnostics = validateAtlasLandWaterRealization(
      input,
      {
        parameterSchemaVersion: 1,
        classificationBehaviorVersion: 1,
        sharedThresholdProfileId: 'world-atlas-preview-v1',
        acceptedProfileId: 'world-atlas-full-v1',
        realizationVersion: 1,
        maximumWaterCoverageErrorBasisPoints: 25,
        targetWaterCoveragePercent: 65,
        oceanConnectivity: 'singleGlobal',
      },
      true,
      25.000_001,
    );

    for (const profileId of [
      WORLD_ATLAS_FULL_PROFILE.profileId,
      WORLD_ATLAS_PREVIEW_PROFILE.profileId,
    ] as const) {
      const events: AtlasGenerationProgress[] = [];
      const reporter = new AtlasLandWaterProgressReporter(
        fixedAtlasRuntime(input, {
          operationId: `atlas-validation-failure:${profileId}`,
          progress: events,
        }),
        profileId,
      );
      reporter.report('validating-proposal', 2, 3, 980, 980);
      const result = atlasLandWaterInvalidResult(reporter, diagnostics);
      reporter.fail();

      expect(result.status).toBe('invalid');
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'atlas.land-water.water-coverage-unsatisfied' }),
        ]),
      );
      expect(result).not.toHaveProperty('patch');
      expect(result).not.toHaveProperty('preview');
      expectMonotonicSingleTerminal(events, {
        stage: 'failed',
        completedWork: 980,
        isCancellationRequested: false,
      });
    }
  });

  it('reports a full yield-hook failure as failed, never cancelled, with no patch', async () => {
    const input = fixedAtlasInput();
    const events: AtlasGenerationProgress[] = [];
    const result = await generateAtlasLandWaterFull(
      input,
      fixedAtlasRuntime(input, {
        operationId: 'atlas-full-yield-failure',
        progress: events,
        yieldControl: () => Promise.reject(new Error('Injected cooperative yield failure.')),
      }),
    );

    expect(result).toMatchObject({
      status: 'invalid',
      diagnostics: [{ code: 'atlas.land-water.runtime-invalid' }],
    });
    expect(result).not.toHaveProperty('patch');
    expect(events.some(({ stage }) => stage === 'cancelled')).toBe(false);
    expectMonotonicSingleTerminal(events, {
      stage: 'failed',
      isCancellationRequested: false,
    });
  });

  it('reports a preview observer failure as failed, never cancelled, with no preview', async () => {
    const input = fixedAtlasInput();
    const events: AtlasGenerationProgress[] = [];
    let shouldThrow = true;
    const result = await generateAtlasLandWaterPreview(
      input,
      fixedAtlasRuntime(input, {
        operationId: 'atlas-preview-observer-failure',
        progress: events,
        observeProgress() {
          if (!shouldThrow) return;
          shouldThrow = false;
          throw new Error('Injected progress observer failure.');
        },
      }),
    );

    expect(result).toMatchObject({
      status: 'invalid',
      diagnostics: [{ code: 'atlas.land-water.runtime-invalid' }],
    });
    expect(result).not.toHaveProperty('preview');
    expect(events.some(({ stage }) => stage === 'cancelled')).toBe(false);
    expectMonotonicSingleTerminal(events, {
      stage: 'failed',
      completedWork: 0,
      isCancellationRequested: false,
    });
  });

  it('keeps preview cancellation distinct and returns no disposable preview', async () => {
    const input = fixedAtlasInput();
    const cancellation = cancellationController();
    const events: AtlasGenerationProgress[] = [];
    const result = await generateAtlasLandWaterPreview(
      input,
      fixedAtlasRuntime(input, {
        operationId: 'atlas-preview-cancellation',
        cancellation,
        progress: events,
        observeProgress(progress) {
          if (!progress.isTerminal && progress.completedWork >= 300) cancellation.request();
        },
      }),
    );

    expect(result).toMatchObject({
      status: 'cancelled',
      diagnostics: [{ code: 'atlas.land-water.cancelled' }],
    });
    expect(result).not.toHaveProperty('preview');
    expect(events.some(({ stage }) => stage === 'failed')).toBe(false);
    expectMonotonicSingleTerminal(events, {
      stage: 'cancelled',
      isCancellationRequested: true,
    });
  });
});

function expectMonotonicSingleTerminal(
  events: readonly AtlasGenerationProgress[],
  expectedTerminal: Readonly<{
    completedWork?: number;
    isCancellationRequested: boolean;
    stage: 'cancelled' | 'failed';
  }>,
): void {
  expect(events.length).toBeGreaterThan(0);
  for (let index = 1; index < events.length; index += 1) {
    expect(events[index]?.completedWork).toBeGreaterThanOrEqual(
      events[index - 1]?.completedWork ?? 0,
    );
  }
  expect(events.filter(({ isTerminal }) => isTerminal)).toHaveLength(1);
  expect(events.at(-1)).toMatchObject({ ...expectedTerminal, isTerminal: true });
}
