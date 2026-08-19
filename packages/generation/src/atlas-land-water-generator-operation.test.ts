import {
  type AtlasSampleReader,
  createDeterministicRandomStream,
  DEFAULT_ATLAS_CONTROLS,
  type DeterministicRandomStream,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import {
  generateAtlasLandWaterFull,
  generateAtlasLandWaterPreview,
  validateAtlasLandWaterRealization,
} from './atlas-land-water-generator.js';
import {
  type AtlasGenerationProgress,
  type AtlasLandWaterProposedPatch,
  createAtlasLandWaterGenerationInput,
} from './atlas-land-water-generator-contract.js';
import {
  cancellationController,
  FIXED_ATLAS_LAND_WATER_ASPECT_ID,
  FIXED_ATLAS_MACRO_ELEVATION_ASPECT_ID,
  FIXED_ATLAS_WORLD_MAP_ID,
  FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
  fixedAtlasInput,
  fixedAtlasRuntime,
  generateFixedAtlasFull,
} from './atlas-land-water-test-support.js';

describe('atlas land/water determinism and isolation', () => {
  it('repeats every full tick and classification with fresh streams and different scheduling', async () => {
    const input = fixedAtlasInput();
    const unrelated = required(createDeterministicRandomStream(input.macroElevationSeedMetadata));
    const first = await generateAtlasLandWaterFull(
      input,
      fixedAtlasRuntime(input, { operationId: 'atlas-repeat-a' }),
    );
    const second = await generateAtlasLandWaterFull(
      input,
      fixedAtlasRuntime(input, {
        operationId: 'atlas-repeat-b',
        yieldControl: () => {
          unrelated.nextUint64();
          return Promise.resolve();
        },
      }),
    );
    expect(first.status).toBe('proposed-full');
    expect(second.status).toBe('proposed-full');
    if (first.status !== 'proposed-full' || second.status !== 'proposed-full') return;
    expectExactArrays(
      first.patch.records.macroElevation.values,
      second.patch.records.macroElevation.values,
    );
    expectExactArrays(
      first.patch.records.landWaterClassification.samples,
      second.patch.records.landWaterClassification.samples,
    );
    expect(first.patch.records.landWaterClassification.seaLevelContourDoubledTicks).toBe(
      second.patch.records.landWaterClassification.seaLevelContourDoubledTicks,
    );
    expectEquivalentPatches(first.patch, second.patch);
  }, 30_000);

  it('keeps macro proposal bytes and ticks fixed when only water target changes', async () => {
    const baselineInput = fixedAtlasInput();
    const changedInput = fixedAtlasInput(undefined, {
      ...DEFAULT_ATLAS_CONTROLS,
      targetWaterCoveragePercent: 66,
    });
    const baseline = await generateAtlasLandWaterFull(
      baselineInput,
      fixedAtlasRuntime(baselineInput),
    );
    const changed = await generateAtlasLandWaterFull(changedInput, fixedAtlasRuntime(changedInput));
    expect(baseline.status).toBe('proposed-full');
    expect(changed.status).toBe('proposed-full');
    if (baseline.status !== 'proposed-full' || changed.status !== 'proposed-full') return;
    expectExactArrays(
      baseline.patch.records.macroElevation.values,
      changed.patch.records.macroElevation.values,
    );
    expectEquivalentMacroProposals(baseline.patch.replacements[0], changed.patch.replacements[0]);
    expect(baseline.patch.replacements[1].parameters.targetWaterCoveragePercent).toBe(65);
    expect(changed.patch.replacements[1].parameters.targetWaterCoveragePercent).toBe(66);
    expect(baseline.patch.records.landWaterClassification.seaLevelContourDoubledTicks).not.toBe(
      changed.patch.records.landWaterClassification.seaLevelContourDoubledTicks,
    );
  }, 30_000);

  it('keeps macro proposal bytes and ticks fixed when only ocean intent changes', async () => {
    const baselineInput = fixedAtlasInput();
    const changedInput = fixedAtlasInput(undefined, {
      ...DEFAULT_ATLAS_CONTROLS,
      oceanConnectivity: 'multipleBasins',
    });
    const baseline = await generateAtlasLandWaterFull(
      baselineInput,
      fixedAtlasRuntime(baselineInput),
    );
    const changed = await generateAtlasLandWaterFull(changedInput, fixedAtlasRuntime(changedInput));
    expect(baseline.status).toBe('proposed-full');
    expect(changed.status).toBe('proposed-full');
    if (baseline.status !== 'proposed-full' || changed.status !== 'proposed-full') return;
    expectExactArrays(
      baseline.patch.records.macroElevation.values,
      changed.patch.records.macroElevation.values,
    );
    expectEquivalentMacroProposals(baseline.patch.replacements[0], changed.patch.replacements[0]);
    expect(baseline.patch.replacements[1].parameters.oceanConnectivity).toBe('singleGlobal');
    expect(changed.patch.replacements[1].parameters.oceanConnectivity).toBe('multipleBasins');
  }, 30_000);

  it('changes preview macro ticks for every documented macro control and no classification control', async () => {
    const baselineInput = fixedAtlasInput();
    const baseline = await generateAtlasLandWaterPreview(
      baselineInput,
      fixedAtlasRuntime(baselineInput),
    );
    expect(baseline.status).toBe('preview');
    if (baseline.status !== 'preview') return;
    const baselineFingerprint = macroFingerprint(baseline.preview.macroElevationValues);
    const macroChanges = [
      { worldCircumferenceKm: 41_000 },
      { continentCountIntent: 5 },
      { continentDistribution: 'balanced' as const },
      { fragmentationPercent: 36 },
      { islandAbundancePercent: 36 },
      { archipelagoAbundancePercent: 26 },
      { polarCharacter: 'landBiased' as const },
    ];
    for (const change of macroChanges) {
      const input = fixedAtlasInput(undefined, {
        ...DEFAULT_ATLAS_CONTROLS,
        ...change,
      });
      const result = await generateAtlasLandWaterPreview(input, fixedAtlasRuntime(input));
      expect(result.status).toBe('preview');
      if (result.status !== 'preview') return;
      expect(macroFingerprint(result.preview.macroElevationValues)).not.toBe(baselineFingerprint);
    }

    for (const change of [
      { targetWaterCoveragePercent: 66 },
      { oceanConnectivity: 'multipleBasins' as const },
    ]) {
      const input = fixedAtlasInput(undefined, {
        ...DEFAULT_ATLAS_CONTROLS,
        ...change,
      });
      const result = await generateAtlasLandWaterPreview(input, fixedAtlasRuntime(input));
      expect(result.status).toBe('preview');
      if (result.status !== 'preview') return;
      expectExactArrays(baseline.preview.macroElevationValues, result.preview.macroElevationValues);
    }
  }, 30_000);

  it('ignores object insertion, ambient random/clock/locale hooks, and the zero-draw classification stream', async () => {
    const input = reversedInput();
    const expected = await generateFixedAtlasFull();
    const bombStream = throwingStream();
    const originalRandom = Math.random;
    const originalNow = globalThis.Date.now.bind(globalThis.Date);
    const localeCompareDescriptor = Object.getOwnPropertyDescriptor(
      String.prototype,
      'localeCompare',
    );
    Math.random = () => {
      throw new Error('Ambient randomness reached deterministic generation.');
    };
    globalThis.Date.now = () => {
      throw new Error('Wall clock reached deterministic generation.');
    };
    Object.defineProperty(String.prototype, 'localeCompare', {
      configurable: true,
      value: () => {
        throw new Error('Locale ordering reached deterministic generation.');
      },
      writable: true,
    });
    try {
      const actual = await generateAtlasLandWaterFull(
        input,
        fixedAtlasRuntime(input, { landWaterClassificationRandom: bombStream }),
      );
      expect(actual.status).toBe('proposed-full');
      if (actual.status !== 'proposed-full') return;
      expectEquivalentPatches(actual.patch, expected.patch);
    } finally {
      Math.random = originalRandom;
      globalThis.Date.now = originalNow;
      if (localeCompareDescriptor !== undefined) {
        Object.defineProperty(String.prototype, 'localeCompare', localeCompareDescriptor);
      }
    }
  }, 30_000);
});

describe('atlas land/water progress and cancellation', () => {
  it('reports bounded monotonic progress through validation and terminal completion', async () => {
    const input = fixedAtlasInput();
    const events: AtlasGenerationProgress[] = [];
    const result = await generateAtlasLandWaterFull(
      input,
      fixedAtlasRuntime(input, {
        operationId: 'atlas-progress-proof',
        progress: events,
      }),
    );
    expect(result.status).toBe('proposed-full');
    expect(events.length).toBeGreaterThan(10);
    expect(events[0]).toMatchObject({
      operationId: 'atlas-progress-proof',
      stage: 'preparing',
      completedWork: 0,
      totalWork: 1_000,
      isTerminal: false,
    });
    for (let index = 1; index < events.length; index += 1) {
      expect(events[index]?.completedWork).toBeGreaterThanOrEqual(
        events[index - 1]?.completedWork ?? 0,
      );
    }
    expect(events.some(({ stage }) => stage === 'validating-proposal')).toBe(true);
    expect(events.filter(({ isTerminal }) => isTerminal)).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({
      stage: 'completed',
      completedWork: 1_000,
      totalWork: 1_000,
      stageCompletedWork: 1,
      stageTotalWork: 1,
      isCancellationRequested: false,
      isTerminal: true,
    });
  }, 30_000);

  it('cancels early, middle, and late with no full proposal and preserves later output', async () => {
    const input = fixedAtlasInput();
    const expected = await generateFixedAtlasFull();
    for (const cancellationWork of [0, 500, 980]) {
      const cancellation = cancellationController();
      const events: AtlasGenerationProgress[] = [];
      const result = await generateAtlasLandWaterFull(
        input,
        fixedAtlasRuntime(input, {
          operationId: `atlas-cancel-${String(cancellationWork)}`,
          cancellation,
          progress: events,
          observeProgress(progress) {
            if (!progress.isTerminal && progress.completedWork >= cancellationWork) {
              cancellation.request();
            }
          },
        }),
      );
      expect(result).toMatchObject({
        status: 'cancelled',
        diagnostics: [{ code: 'atlas.land-water.cancelled' }],
      });
      expect(result).not.toHaveProperty('patch');
      expect(events.at(-1)).toMatchObject({
        stage: 'cancelled',
        isCancellationRequested: true,
        isTerminal: true,
      });
    }

    const completed = await generateAtlasLandWaterFull(input, fixedAtlasRuntime(input));
    expect(completed.status).toBe('proposed-full');
    if (completed.status !== 'proposed-full') return;
    expectEquivalentPatches(completed.patch, expected.patch);
  }, 30_000);

  it('rejects a shared sequential stream with a stable diagnostic and no proposal', async () => {
    const input = fixedAtlasInput();
    const shared = required(createDeterministicRandomStream(input.macroElevationSeedMetadata));
    const result = await generateAtlasLandWaterFull(
      input,
      fixedAtlasRuntime(input, {
        macroElevationRandom: shared,
        landWaterClassificationRandom: shared,
      }),
    );
    expect(result).toMatchObject({
      status: 'invalid',
      diagnostics: [{ code: 'atlas.land-water.runtime-invalid', severity: 'error' }],
    });
    expect(result).not.toHaveProperty('patch');
  });

  it('reports unrealizable controls with stable actionable diagnostics', () => {
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
      false,
      25.000_001,
    );
    const diagnostic = diagnostics.find(
      ({ code }) => code === 'atlas.land-water.water-coverage-unsatisfied',
    );
    expect(diagnostic).toMatchObject({
      severity: 'error',
      target: { aspectId: FIXED_ATLAS_LAND_WATER_ASPECT_ID },
    });
    expect(diagnostic?.suggestedAction).toContain('do not accept');
    expect(diagnostics.map(({ code }) => code)).toStrictEqual([
      'atlas.land-water.water-coverage-unsatisfied',
      'atlas.land-water.ocean-connectivity-unsupported',
      'atlas.land-water.ocean-connectivity-unverified',
    ]);
  });
});

function reversedInput() {
  const controls = Object.fromEntries(Object.entries(DEFAULT_ATLAS_CONTROLS).reverse());
  const source = Object.fromEntries(
    Object.entries({
      worldSeed: '81985529216486895',
      worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
      worldSurfaceEntityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
      macroElevationAspectId: FIXED_ATLAS_MACRO_ELEVATION_ASPECT_ID,
      landWaterClassificationAspectId: FIXED_ATLAS_LAND_WATER_ASPECT_ID,
      macroElevationVariantRevision: 0,
      landWaterClassificationVariantRevision: 0,
      controls,
    }).reverse(),
  );
  const parsed = createAtlasLandWaterGenerationInput(source);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  return parsed.value;
}

function throwingStream(): DeterministicRandomStream {
  const fail = (): never => {
    throw new Error('Classification stream version 1 must make zero random draws.');
  };
  return Object.freeze({
    nextUint64: fail,
    nextUint32: fail,
    nextFloat64: fail,
    nextInt: fail,
  });
}

function macroFingerprint(values: readonly number[]): string {
  let fingerprint = 0xcbf29ce484222325n;
  for (const value of values) {
    for (let shift = 0; shift < 32; shift += 8) {
      fingerprint ^= BigInt((value >>> shift) & 0xff);
      fingerprint = BigInt.asUintN(64, fingerprint * 0x100000001b3n);
    }
  }
  return fingerprint.toString(16).padStart(16, '0');
}

function expectExactArrays<Value>(
  left: AtlasSampleReader<Value>,
  right: AtlasSampleReader<Value>,
): void {
  expect(left).toHaveLength(right.length);
  for (let index = 0; index < left.length; index += 1) {
    if (left.at(index) !== right.at(index)) {
      throw new Error(`Canonical atlas arrays differ at index ${String(index)}.`);
    }
  }
}

function expectEquivalentPatches(
  left: AtlasLandWaterProposedPatch,
  right: AtlasLandWaterProposedPatch,
): void {
  expectExactArrays(left.records.macroElevation.values, right.records.macroElevation.values);
  expectExactArrays(
    left.records.landWaterClassification.samples,
    right.records.landWaterClassification.samples,
  );
  expect(comparablePatch(left)).toStrictEqual(comparablePatch(right));
}

function comparablePatch(patch: AtlasLandWaterProposedPatch) {
  return {
    ...patch,
    records: {
      ...patch.records,
      macroElevation: {
        ...patch.records.macroElevation,
        values: patch.records.macroElevation.values.length,
      },
      landWaterClassification: {
        ...patch.records.landWaterClassification,
        samples: patch.records.landWaterClassification.samples.length,
      },
    },
    replacements: [
      {
        ...patch.replacements[0],
        output: {
          ...patch.replacements[0].output,
          values: patch.replacements[0].output.values.length,
        },
      },
      {
        ...patch.replacements[1],
        output: {
          ...patch.replacements[1].output,
          samples: patch.replacements[1].output.samples.length,
        },
      },
    ],
  };
}

function expectEquivalentMacroProposals(
  left: AtlasLandWaterProposedPatch['replacements'][0],
  right: AtlasLandWaterProposedPatch['replacements'][0],
): void {
  expectExactArrays(left.output.values, right.output.values);
  expect({ ...left, output: { ...left.output, values: left.output.values.length } }).toStrictEqual({
    ...right,
    output: { ...right.output, values: right.output.values.length },
  });
}

function required<Value>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly diagnostic: unknown },
): Value {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostic));
  return result.value;
}
