import { DEFAULT_ATLAS_CONTROLS } from '@ttrpg-map/core';
import { describe, expect, it, vi } from 'vitest';

import appSource from './App.svelte?raw';
import {
  gatedAtlasFixture,
  installPackagedAtlasObserverDispatch,
  isPackagedAtlasPreviewDispatch,
  isPackagedFullAtlasDispatch,
  isPackagedGenerationCancellationAftermathDispatch,
  packagedAtlasFixtureDispatch,
  packagedAtlasObserverReceipt,
  packagedGenerationCancellationDispatch,
  type PackagedGenerationCancellationState,
  type PackagedGenerationCancellationTrial,
  requestExactFixtureGenerationCancellation,
  requestExactFixturePreview,
  requestGenerationCancellationAftermath,
  requestProductionFullAtlas,
} from './packaged-atlas-observer-dispatch.js';

describe('packaged full-atlas observer dispatch', () => {
  it('loads only the three gated repository fixture definitions with exact inputs', () => {
    expect(gatedAtlasFixture('milestone-2-atlas-proof')).toEqual({
      fixtureId: 'milestone-2-atlas-proof',
      worldSeed: '81985529216486895',
      controls: DEFAULT_ATLAS_CONTROLS,
    });
    expect(gatedAtlasFixture('milestone-2-atlas-fragmented-islands')).toMatchObject({
      fixtureId: 'milestone-2-atlas-fragmented-islands',
      worldSeed: '18364758544493064720',
      controls: {
        targetWaterCoveragePercent: 70,
        continentCountIntent: 5,
        fragmentationPercent: 90,
        islandAbundancePercent: 95,
        archipelagoAbundancePercent: 95,
      },
    });
    expect(gatedAtlasFixture('milestone-2-atlas-control-max')).toEqual({
      fixtureId: 'milestone-2-atlas-control-max',
      worldSeed: '16045690984503098046',
      controls: {
        worldCircumferenceKm: 80_000,
        targetWaterCoveragePercent: 80,
        continentCountIntent: 8,
        continentDistribution: 'oneDominant',
        fragmentationPercent: 100,
        islandAbundancePercent: 100,
        archipelagoAbundancePercent: 100,
        oceanConnectivity: 'multipleBasins',
        polarCharacter: 'oceanBiased',
      },
    });
    expect(() => gatedAtlasFixture('milestone-2-atlas-control-min')).toThrow(
      'Unknown packaged atlas observer fixture ID.',
    );
  });

  it('wires observer dispatch and visible controls to the same production actions', () => {
    expect(appSource).toMatch(
      /installPackagedPreviewDispatch\([\s\S]*?VITE_PACKAGED_PREVIEW_OBSERVER_DISPATCH[\s\S]*?\(\) => void preview\(\),[\s\S]*?\)/u,
    );
    expect(appSource).toMatch(
      /installPackagedAtlasObserverDispatch\([\s\S]*?configureObserverFixture,[\s\S]*?observerFixtureId[\s\S]*?worldSeed: seed[\s\S]*?controls[\s\S]*?\(\) => void preview\(\),[\s\S]*?\(\) => void acceptFull\(\),[\s\S]*?\)/u,
    );
    expect(appSource).toMatch(
      /onclick=\{\(\) => void preview\(\)\}[\s\S]*?>Generate coarse preview<\/button/u,
    );
    expect(appSource).toMatch(
      /onclick=\{\(\) => void acceptFull\(\)\}[\s\S]*?>Accept full atlas<\/button/u,
    );
    expect(appSource).toMatch(
      /async function acceptFull\(\): Promise<void> \{[\s\S]*?requestProductionFullAtlas\(\(\) => workflow\.acceptFull\(seed, controls\), run\)/u,
    );
    expect(appSource).toMatch(
      /startGenerationCancellationTrial[\s\S]*?requestExactFixtureGenerationCancellation\(trial,[\s\S]*?requestPreview: preview,[\s\S]*?requestFull: acceptFull,[\s\S]*?cancelActiveOperation: \(\) => workflow\.cancelActiveOperation\(\)/u,
    );
  });

  it('has no fixture or full dispatch effect in an ordinary build', () => {
    const target = new EventTarget();
    const configure = vi.fn();
    const preview = vi.fn();
    const acceptFull = vi.fn();
    const remove = installPackagedAtlasObserverDispatch(
      target,
      false,
      configure,
      () => ({
        fixtureId: 'milestone-2-atlas-proof',
        worldSeed: '81985529216486895',
        controls: DEFAULT_ATLAS_CONTROLS,
      }),
      preview,
      acceptFull,
    );

    target.dispatchEvent(dispatchEvent('KeyJ'));
    target.dispatchEvent(dispatchEvent('KeyP'));
    target.dispatchEvent(dispatchEvent('KeyF'));
    remove();

    expect(configure).not.toHaveBeenCalled();
    expect(preview).not.toHaveBeenCalled();
    expect(acceptFull).not.toHaveBeenCalled();
  });

  it('dispatches exact fixture, preview, and full chords and removes the handler', () => {
    const target = new EventTarget();
    const configure = vi.fn();
    const preview = vi.fn();
    const acceptFull = vi.fn();
    const cancelTrial = vi.fn();
    const aftermath = vi.fn();
    const fixture = gatedAtlasFixture('milestone-2-atlas-control-max');
    const remove = installPackagedAtlasObserverDispatch(
      target,
      true,
      configure,
      () => ({
        fixtureId: fixture.fixtureId,
        worldSeed: fixture.worldSeed,
        controls: fixture.controls,
      }),
      preview,
      acceptFull,
      cancelTrial,
      aftermath,
    );
    const fixtureEvent = dispatchEvent('KeyL');
    const previewEvent = dispatchEvent('KeyP');
    const fullEvent = dispatchEvent('KeyF');

    target.dispatchEvent(fixtureEvent);
    target.dispatchEvent(previewEvent);
    target.dispatchEvent(fullEvent);
    target.dispatchEvent(dispatchEvent('KeyW'));
    target.dispatchEvent(dispatchEvent('KeyG'));
    remove();
    target.dispatchEvent(dispatchEvent('KeyJ'));

    expect(configure).toHaveBeenCalledTimes(1);
    expect(configure).toHaveBeenCalledWith(gatedAtlasFixture('milestone-2-atlas-control-max'));
    expect(preview).toHaveBeenCalledTimes(1);
    expect(acceptFull).toHaveBeenCalledTimes(1);
    expect(cancelTrial).toHaveBeenCalledWith({ operation: 'preview', safePoint: 'middle' });
    expect(aftermath).toHaveBeenCalledOnce();
    expect(fixtureEvent.defaultPrevented).toBe(true);
    expect(previewEvent.defaultPrevented).toBe(true);
    expect(fullEvent.defaultPrevented).toBe(true);
  });

  it('delegates preview only after exact live fixture, canonical seed, and nine-control readback', () => {
    const fixture = gatedAtlasFixture('milestone-2-atlas-fragmented-islands');
    const preview = vi.fn();

    expect(
      requestExactFixturePreview(
        {
          fixtureId: fixture.fixtureId,
          worldSeed: fixture.worldSeed,
          controls: fixture.controls,
        },
        preview,
      ),
    ).toBe(true);
    expect(preview).toHaveBeenCalledOnce();

    for (const input of [
      { fixtureId: undefined, worldSeed: fixture.worldSeed, controls: fixture.controls },
      { fixtureId: fixture.fixtureId, worldSeed: '1', controls: fixture.controls },
      {
        fixtureId: fixture.fixtureId,
        worldSeed: fixture.worldSeed,
        controls: { ...fixture.controls, islandAbundancePercent: 94 },
      },
    ]) {
      expect(requestExactFixturePreview(input, preview)).toBe(false);
    }
    expect(preview).toHaveBeenCalledOnce();
  });

  it('rejects partial, repeated, and unknown dispatch input', () => {
    expect(packagedAtlasFixtureDispatch(dispatchShape('KeyJ', { metaKey: false }))).toBeUndefined();
    expect(packagedAtlasFixtureDispatch(dispatchShape('KeyJ', { repeat: true }))).toBeUndefined();
    expect(packagedAtlasFixtureDispatch(dispatchShape('KeyM'))).toBeUndefined();
    expect(isPackagedAtlasPreviewDispatch(dispatchShape('KeyP', { altKey: false }))).toBe(false);
    expect(isPackagedAtlasPreviewDispatch(dispatchShape('KeyP', { repeat: true }))).toBe(false);
    expect(isPackagedAtlasPreviewDispatch(dispatchShape('KeyF'))).toBe(false);
    expect(isPackagedFullAtlasDispatch(dispatchShape('KeyF', { ctrlKey: false }))).toBe(false);
    expect(isPackagedFullAtlasDispatch(dispatchShape('KeyP'))).toBe(false);
    expect(packagedGenerationCancellationDispatch(dispatchShape('KeyQ'))).toEqual({
      operation: 'preview',
      safePoint: 'early',
    });
    expect(packagedGenerationCancellationDispatch(dispatchShape('KeyD'))).toEqual({
      operation: 'full',
      safePoint: 'late',
    });
    expect(
      packagedGenerationCancellationDispatch(dispatchShape('KeyS', { repeat: true })),
    ).toBeUndefined();
    expect(isPackagedGenerationCancellationAftermathDispatch(dispatchShape('KeyG'))).toBe(true);
    expect(
      isPackagedGenerationCancellationAftermathDispatch(dispatchShape('KeyG', { metaKey: false })),
    ).toBe(false);
  });

  it.each([
    ['early', 20],
    ['middle', 600],
    ['late', 990],
  ] as const)(
    'dispatches preview cancellation at the declared %s safe point and acknowledges terminal state',
    async (safePoint, completedWork) => {
      const harness = cancellationHarness({ operation: 'preview', safePoint }, completedWork);

      const result = await requestExactFixtureGenerationCancellation(
        { operation: 'preview', safePoint },
        harness.dependencies,
      );

      expect(result?.receipt).toMatchObject({
        status: 'cancelled',
        operation: 'preview',
        safePoint,
        acknowledgementMilliseconds: 12,
        costlySchedulingStopped: true,
        previousStatePreserved: true,
        noAcceptedCommitAtAcknowledgement: true,
        terminalProgress: { stage: 'cancelled', isTerminal: true },
      });
      expect(harness.cancel).toHaveBeenCalledOnce();
      expect(harness.records.map(({ receipt }) => receipt.status)).toEqual([
        'cancellation-requested',
        'cancelled',
      ]);
    },
  );

  it('fails closed on progress regression, skipped safe point, or late accepted presentation', async () => {
    const regression = cancellationHarness(
      { operation: 'preview', safePoint: 'middle' },
      600,
      [700, 600],
    );
    const regressed = await requestExactFixtureGenerationCancellation(
      { operation: 'preview', safePoint: 'middle' },
      regression.dependencies,
    );
    expect(regressed?.receipt).toMatchObject({ status: 'invalid' });
    expect(regressed?.receipt.invalidReason).toMatch(/monotonicity/u);

    const skipped = cancellationHarness({ operation: 'preview', safePoint: 'middle' }, 990);
    const ambiguous = await requestExactFixtureGenerationCancellation(
      { operation: 'preview', safePoint: 'middle' },
      skipped.dependencies,
    );
    expect(ambiguous?.receipt).toMatchObject({
      status: 'invalid',
      invalidReason: 'declared cancellation safe point was skipped or ambiguous',
    });

    const late = cancellationHarness({ operation: 'preview', safePoint: 'early' }, 20, undefined, {
      lateAcceptedCommit: true,
    });
    const presented = await requestExactFixtureGenerationCancellation(
      { operation: 'preview', safePoint: 'early' },
      late.dependencies,
    );
    expect(presented?.receipt).toMatchObject({ status: 'invalid' });
    expect(presented?.receipt.invalidReason).toMatch(/state changed/u);
  });

  it('requires the exact disposable preview authority for full cancellation and a deterministic aftermath', async () => {
    const harness = cancellationHarness({ operation: 'full', safePoint: 'late' }, 990, undefined, {
      preview: true,
    });
    const cancelled = await requestExactFixtureGenerationCancellation(
      { operation: 'full', safePoint: 'late' },
      harness.dependencies,
    );
    expect(cancelled?.receipt).toMatchObject({
      status: 'cancelled',
      preState: {
        workflowPhase: 'preview',
        disposablePreviewPresent: true,
        acceptedAtlasPresent: false,
      },
    });

    const completed = await requestGenerationCancellationAftermath(cancelled, harness.dependencies);
    expect(completed?.receipt).toMatchObject({
      status: 'aftermath-complete',
      nextCompletionCanonicallyDeterministic: true,
      nextCompletion: {
        canonicalAspectSetSha256:
          '24ea927af4355fc5d44c1bba2cf49d7a4b47c27404d4c352267ed33ccecd90e2',
      },
    });
  });

  it('delegates full generation to the supplied production action and presentation path', async () => {
    const operation = Promise.resolve({ ok: true });
    const acceptFull = vi.fn(() => operation);
    const present = vi.fn(async (candidate: Promise<unknown>) => {
      await candidate;
    });

    await requestProductionFullAtlas(acceptFull, present);

    expect(acceptFull).toHaveBeenCalledOnce();
    expect(present).toHaveBeenCalledWith(operation);
  });

  it('emits receipts only for exact configured, preview, and structurally accepted state', () => {
    const fixture = gatedAtlasFixture('milestone-2-atlas-control-max');
    const configured = packagedAtlasObserverReceipt(
      fixture.fixtureId,
      fixture.worldSeed,
      fixture.controls,
      state(),
    );
    expect(configured).toMatchObject({
      fixtureId: fixture.fixtureId,
      phase: 'configured',
      productionPreviewPath: true,
      productionFullPath: true,
    });
    expect(
      packagedAtlasObserverReceipt(
        fixture.fixtureId,
        fixture.worldSeed,
        fixture.controls,
        state({ workflowPhase: 'preview', hasPreview: true }),
      ),
    ).toMatchObject({ phase: 'preview' });
    expect(
      packagedAtlasObserverReceipt(
        fixture.fixtureId,
        fixture.worldSeed,
        fixture.controls,
        state({
          workflowPhase: 'accepted',
          hasAcceptedAtlas: true,
          acceptedCheckpoint: 'baseline',
          sceneKind: 'whole-world-atlas',
          acceptedWorldSeed: fixture.worldSeed,
          acceptedControls: fixture.controls,
        }),
      ),
    ).toMatchObject({ phase: 'accepted' });
  });

  it('fails closed on fixture drift, incomplete state, busy state, or a wrong accepted scene', () => {
    const fixture = gatedAtlasFixture('milestone-2-atlas-proof');
    expect(
      packagedAtlasObserverReceipt(fixture.fixtureId, '1', fixture.controls, state()),
    ).toBeUndefined();
    expect(
      packagedAtlasObserverReceipt(
        fixture.fixtureId,
        fixture.worldSeed,
        { ...fixture.controls, fragmentationPercent: 36 },
        state(),
      ),
    ).toBeUndefined();
    expect(
      packagedAtlasObserverReceipt(
        fixture.fixtureId,
        fixture.worldSeed,
        fixture.controls,
        state({ isBusy: true }),
      ),
    ).toBeUndefined();
    expect(
      packagedAtlasObserverReceipt(
        fixture.fixtureId,
        fixture.worldSeed,
        fixture.controls,
        state({
          workflowPhase: 'accepted',
          hasAcceptedAtlas: true,
          acceptedCheckpoint: 'baseline',
          sceneKind: 'wrong-scene',
          acceptedWorldSeed: fixture.worldSeed,
          acceptedControls: fixture.controls,
        }),
      ),
    ).toBeUndefined();
  });
});

function state(
  overrides: Partial<Parameters<typeof packagedAtlasObserverReceipt>[3]> = {},
): Parameters<typeof packagedAtlasObserverReceipt>[3] {
  return {
    workflowPhase: 'empty',
    isBusy: false,
    hasPreview: false,
    hasAcceptedAtlas: false,
    ...overrides,
  };
}

function dispatchShape(
  code: string,
  overrides: Partial<{
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    repeat: boolean;
  }> = {},
) {
  return {
    altKey: true,
    code,
    ctrlKey: true,
    metaKey: true,
    repeat: false,
    preventDefault: vi.fn(),
    ...overrides,
  };
}

function dispatchEvent(code: string): KeyboardEvent {
  const event = new Event('keydown', { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    altKey: { value: true },
    code: { value: code },
    ctrlKey: { value: true },
    metaKey: { value: true },
    repeat: { value: false },
  });
  return event as KeyboardEvent;
}

const PROOF_AUTHORITY = {
  checkpoint: 'baseline' as const,
  aspects: [],
  canonicalAspectSetSha256: '24ea927af4355fc5d44c1bba2cf49d7a4b47c27404d4c352267ed33ccecd90e2',
  canonicalOutputSetSha256: '6b972a97afdb6e3284745596cf78edf834d6dc32d8bb99d6eac95cddd7438743',
  canonicalCoastlineOutputSha256:
    '641bcc8a9a962a2a7e9de14512e6bdfb70bdf98b5c87dda382aa8422b9c9d66c',
  renderSceneSha256: '0'.repeat(64),
};

function cancellationHarness(
  trial: PackagedGenerationCancellationTrial,
  completedWork: number,
  progressSequence: readonly number[] = [completedWork],
  options: {
    readonly accepted?: NonNullable<PackagedGenerationCancellationState['acceptedIdentity']>;
    readonly preview?: boolean;
    readonly lateAcceptedCommit?: boolean;
  } = {},
) {
  let now = 1_000;
  let resolveOperation: (() => void) | undefined;
  const accepted = options.accepted;
  let current: PackagedGenerationCancellationState = cancellationState(accepted, options.preview);
  const records: NonNullable<
    Parameters<Parameters<typeof requestExactFixtureGenerationCancellation>[1]['record']>[0]
  >[] = [];
  const cancel = vi.fn(() => {
    now += 12;
    current = {
      ...current,
      workflowPhase: options.lateAcceptedCommit ? 'accepted' : current.workflowPhase,
      acceptedIdentity: options.lateAcceptedCommit
        ? ({} as NonNullable<PackagedGenerationCancellationState['acceptedIdentity']>)
        : current.acceptedIdentity,
      acceptedCheckpoint: options.lateAcceptedCommit ? 'baseline' : current.acceptedCheckpoint,
      isBusy: false,
      progress: progress('cancelled', completedWork, true, true),
      diagnosticCodes: ['atlas.land-water.cancelled'],
    };
    resolveOperation?.();
    return { ok: true };
  });
  let progressIndex = 0;
  const begin = () => {
    current = {
      ...current,
      isBusy: true,
      progress: progress('sampling-shared-preview-anchors', progressSequence[0] ?? completedWork),
      diagnosticCodes: [],
    };
    return new Promise<void>((resolve) => {
      resolveOperation = resolve;
    });
  };
  const dependencies: Parameters<typeof requestExactFixtureGenerationCancellation>[1] = {
    currentState: () => current,
    requestPreview: begin,
    requestFull: () => {
      if (current.progress?.stage === 'cancelled') {
        const nextAccepted = {} as NonNullable<
          PackagedGenerationCancellationState['acceptedIdentity']
        >;
        current = {
          ...cancellationState(nextAccepted),
          workflowPhase: 'accepted',
          acceptedCheckpoint: 'baseline',
          progress: progress('completed', 1_000, false, true),
        };
        return Promise.resolve();
      }
      return begin();
    },
    cancelActiveOperation: cancel,
    acceptedEvidence: () => Promise.resolve(PROOF_AUTHORITY),
    record: (context) => {
      if (context !== undefined) records.push(context);
    },
    nowEpochMilliseconds: () => now,
    yieldControl: () => {
      progressIndex += 1;
      const work = progressSequence[progressIndex];
      if (work !== undefined) {
        current = { ...current, progress: progress('sampling-full-macro-elevation', work) };
      }
      return Promise.resolve();
    },
  };
  return { dependencies, cancel, records, trial };
}

function cancellationState(
  accepted?: NonNullable<PackagedGenerationCancellationState['acceptedIdentity']>,
  preview = false,
): PackagedGenerationCancellationState {
  return {
    fixtureId: 'milestone-2-atlas-proof',
    worldSeed: '81985529216486895',
    controls: DEFAULT_ATLAS_CONTROLS,
    workflowPhase: preview ? 'preview' : accepted === undefined ? 'empty' : 'accepted',
    isBusy: false,
    hasPreview: preview,
    acceptedCheckpoint: accepted === undefined ? undefined : 'baseline',
    acceptedIdentity: accepted,
    acceptedWorldSeed: accepted === undefined ? undefined : '81985529216486895',
    acceptedControls: accepted === undefined ? undefined : DEFAULT_ATLAS_CONTROLS,
    progress: accepted === undefined ? undefined : progress('completed', 1_000, false, true),
    diagnosticCodes: [],
  };
}

function progress(
  stage: string,
  completedWork: number,
  isCancellationRequested = false,
  isTerminal = false,
) {
  return {
    operationId: 'atlas:test:1',
    stage,
    completedWork,
    totalWork: 1_000,
    isCancellationRequested,
    isTerminal,
  };
}
