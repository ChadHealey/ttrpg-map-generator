import { DEFAULT_ATLAS_CONTROLS } from '@ttrpg-map/core';
import { describe, expect, it, vi } from 'vitest';

import appSource from './App.svelte?raw';
import {
  gatedAtlasFixture,
  installPackagedAtlasObserverDispatch,
  isPackagedFullAtlasDispatch,
  packagedAtlasFixtureDispatch,
  packagedAtlasObserverReceipt,
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
      /installPackagedPreviewDispatch\([\s\S]*?\(\) => void preview\(\),[\s\S]*?\)/u,
    );
    expect(appSource).toMatch(
      /installPackagedAtlasObserverDispatch\([\s\S]*?configureObserverFixture,[\s\S]*?\(\) => void acceptFull\(\),[\s\S]*?\)/u,
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
  });

  it('has no fixture or full dispatch effect in an ordinary build', () => {
    const target = new EventTarget();
    const configure = vi.fn();
    const acceptFull = vi.fn();
    const remove = installPackagedAtlasObserverDispatch(target, false, configure, acceptFull);

    target.dispatchEvent(dispatchEvent('KeyJ'));
    target.dispatchEvent(dispatchEvent('KeyF'));
    remove();

    expect(configure).not.toHaveBeenCalled();
    expect(acceptFull).not.toHaveBeenCalled();
  });

  it('dispatches exact fixture and full chords and removes the handler', () => {
    const target = new EventTarget();
    const configure = vi.fn();
    const acceptFull = vi.fn();
    const remove = installPackagedAtlasObserverDispatch(target, true, configure, acceptFull);
    const fixtureEvent = dispatchEvent('KeyL');
    const fullEvent = dispatchEvent('KeyF');

    target.dispatchEvent(fixtureEvent);
    target.dispatchEvent(fullEvent);
    remove();
    target.dispatchEvent(dispatchEvent('KeyJ'));

    expect(configure).toHaveBeenCalledTimes(1);
    expect(configure).toHaveBeenCalledWith(gatedAtlasFixture('milestone-2-atlas-control-max'));
    expect(acceptFull).toHaveBeenCalledTimes(1);
    expect(fixtureEvent.defaultPrevented).toBe(true);
    expect(fullEvent.defaultPrevented).toBe(true);
  });

  it('rejects partial, repeated, and unknown dispatch input', () => {
    expect(packagedAtlasFixtureDispatch(dispatchShape('KeyJ', { metaKey: false }))).toBeUndefined();
    expect(packagedAtlasFixtureDispatch(dispatchShape('KeyJ', { repeat: true }))).toBeUndefined();
    expect(packagedAtlasFixtureDispatch(dispatchShape('KeyM'))).toBeUndefined();
    expect(isPackagedFullAtlasDispatch(dispatchShape('KeyF', { ctrlKey: false }))).toBe(false);
    expect(isPackagedFullAtlasDispatch(dispatchShape('KeyP'))).toBe(false);
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
