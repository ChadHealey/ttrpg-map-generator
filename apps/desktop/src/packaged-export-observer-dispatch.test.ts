import { DEFAULT_ATLAS_CONTROLS } from '@ttrpg-map/core';
import { describe, expect, it, vi } from 'vitest';

import appSource from './App.svelte?raw';
import {
  exportTargetPath,
  installPackagedExportObserverDispatch,
  isPackagedReopenPreparationDispatch,
  packagedExportDispatch,
  packagedExportObserverReceipt,
  type PackagedExportObserverState,
  requestExactFixtureExport,
  requestExactFixtureReopen,
} from './packaged-export-observer-dispatch.js';

describe('packaged export observer dispatch', () => {
  it('wires observer-only SVG and PNG dispatch to unchanged workflow exports', () => {
    expect(appSource).toMatch(
      /installPackagedExportObserverDispatch\([\s\S]*?VITE_PACKAGED_EXPORT_OBSERVER_DISPATCH[\s\S]*?prepareExportObserverReopenedAtlas[\s\S]*?workflow\.exportSvg\(exportTargetPath\)[\s\S]*?workflow\.exportPng\(exportTargetPath\)[\s\S]*?\)/u,
    );
    expect(appSource).toMatch(
      /async function exportSvg\(\): Promise<void> \{[\s\S]*?workflow\.exportSvg\(\)/u,
    );
    expect(appSource).toMatch(
      /async function exportPng\(\): Promise<void> \{[\s\S]*?workflow\.exportPng\(\)/u,
    );
    expect(appSource).toMatch(/onclick=\{\(\) => void exportSvg\(\)\}/u);
    expect(appSource).toMatch(/onclick=\{\(\) => void exportPng\(\)\}/u);
  });

  it('recognizes only exact nonrepeating observer export chords', () => {
    expect(packagedExportDispatch(dispatchShape('KeyV'))).toBe('svg');
    expect(packagedExportDispatch(dispatchShape('KeyN'))).toBe('png');
    expect(packagedExportDispatch(dispatchShape('KeyV', { metaKey: false }))).toBeUndefined();
    expect(packagedExportDispatch(dispatchShape('KeyN', { repeat: true }))).toBeUndefined();
    expect(packagedExportDispatch(dispatchShape('KeyP'))).toBeUndefined();
    expect(isPackagedReopenPreparationDispatch(dispatchShape('KeyR'))).toBe(true);
    expect(isPackagedReopenPreparationDispatch(dispatchShape('KeyR', { ctrlKey: false }))).toBe(
      false,
    );
  });

  it('has no dispatch or receipt effect in an ordinary build', async () => {
    const target = new EventTarget();
    const exportSvg = vi.fn(() => Promise.resolve(undefined));
    const exportPng = vi.fn(() => Promise.resolve(undefined));
    const completion = vi.fn();
    const remove = installPackagedExportObserverDispatch(
      target,
      false,
      () => reopenedState(),
      () => Promise.resolve(undefined),
      exportSvg,
      exportPng,
      completion,
    );

    target.dispatchEvent(dispatchEvent('KeyV'));
    target.dispatchEvent(dispatchEvent('KeyN'));
    await Promise.resolve();
    remove();

    expect(exportSvg).not.toHaveBeenCalled();
    expect(exportPng).not.toHaveBeenCalled();
    expect(completion).not.toHaveBeenCalled();
  });

  it('delegates exact accepted baseline preparation to unchanged lifecycle actions', async () => {
    const prepare = vi.fn(() => Promise.resolve(undefined));

    await expect(requestExactFixtureReopen(acceptedState(), prepare)).resolves.toBe(true);
    expect(prepare).toHaveBeenCalledOnce();
    for (const candidate of [
      acceptedState({ worldSeed: '1' }),
      acceptedState({ workflowPhase: 'preview' }),
      acceptedState({ isBusy: true }),
      acceptedState({ acceptedCheckpoint: 'geography-rerolled' }),
      acceptedState({ saveTargetPath: 'relative.mapworld' }),
    ]) {
      await expect(requestExactFixtureReopen(candidate, prepare)).resolves.toBe(false);
    }
    expect(prepare).toHaveBeenCalledOnce();
  });

  it('derives private sibling destinations without accepting malformed save targets', () => {
    expect(exportTargetPath('/private/tmp/run/atlas.mapworld', 'svg')).toBe(
      '/private/tmp/run/atlas.issue-97.svg',
    );
    expect(exportTargetPath('/private/tmp/run/atlas.mapworld', 'png')).toBe(
      '/private/tmp/run/atlas.issue-97.png',
    );
    expect(exportTargetPath('relative.mapworld', 'svg')).toBeUndefined();
    expect(exportTargetPath('/private/tmp/.mapworld', 'png')).toBeUndefined();
    expect(exportTargetPath('/private/tmp/atlas.svg', 'svg')).toBeUndefined();
  });

  it('delegates to production SVG only from exact generator-free reopened state', async () => {
    const acceptedIdentity = {};
    let current = reopenedState({ acceptedIdentity });
    const exportSvg = vi.fn((targetPath: string) => {
      current = reopenedState({
        acceptedIdentity,
        svgExportReceipt: svgReceipt(targetPath),
      });
      return Promise.resolve();
    });

    const completion = await requestExactFixtureExport('svg', current, exportSvg, () => current);

    expect(exportSvg).toHaveBeenCalledWith('/private/tmp/issue97/atlas.issue-97.svg');
    expect(completion).toMatchObject({
      format: 'svg',
      profileId: 'atlas-svg-v1',
      dimensions: '400x200mm',
      nativeAtomicReceiptVerified: true,
      acceptedStateUnchanged: true,
    });
  });

  it('delegates to production PNG and emits one sanitized completion receipt', async () => {
    const acceptedIdentity = {};
    let current = reopenedState({ acceptedIdentity });
    const exportPng = vi.fn((targetPath: string) => {
      current = reopenedState({
        acceptedIdentity,
        pngExportReceipt: pngReceipt(targetPath),
      });
      return Promise.resolve();
    });
    const completion = await requestExactFixtureExport('png', current, exportPng, () => current);
    const receipt = packagedExportObserverReceipt(current, completion);

    expect(receipt).toMatchObject({
      version: 'packaged-export-observer-v1',
      fixtureId: 'milestone-2-atlas-proof',
      phase: 'png-complete',
      productionSavePath: true,
      productionReopenPath: true,
      reopenComparisonPassed: true,
      reopenGeneratorInvocations: 0,
      completion: {
        profileId: 'atlas-png-v1',
        dimensions: '8192x4096px',
      },
    });
    expect(JSON.stringify(receipt)).not.toContain('/private/');
  });

  it('emits a reopened authority receipt before measured export dispatch', () => {
    const receipt = packagedExportObserverReceipt(reopenedState(), undefined);
    expect(receipt).toMatchObject({
      phase: 'reopened',
      canonicalAspectSetSha256: digest('a'),
      canonicalOutputSetSha256: digest('b'),
      canonicalCoastlineOutputSha256: digest('c'),
      renderSceneSha256: digest('d'),
      manifestSha256: digest('e'),
    });
    expect(receipt).not.toHaveProperty('completion');
  });

  it('fails closed before dispatch on fixture, phase, evidence, manifest, or generator drift', async () => {
    const productionExport = vi.fn(() => Promise.resolve(undefined));
    const cases: PackagedExportObserverState[] = [
      reopenedState({ fixtureId: undefined }),
      reopenedState({ worldSeed: '1' }),
      reopenedState({ workflowPhase: 'accepted' }),
      reopenedState({ isBusy: true }),
      reopenedState({ hasPreview: true }),
      reopenedState({ acceptedCheckpoint: 'appearance-rerolled' }),
      reopenedState({ acceptedControls: { ...DEFAULT_ATLAS_CONTROLS, fragmentationPercent: 36 } }),
      reopenedState({ reopenedManifestSha256: digest('f') }),
      reopenedState({ reopenGenerationInvocationCount: 1 }),
      reopenedState({ reopenComparison: { ...comparison(), renderSceneRestored: false } }),
      reopenedState({ saveTargetPath: 'relative.mapworld' }),
    ];

    for (const candidate of cases) {
      expect(packagedExportObserverReceipt(candidate, undefined)).toBeUndefined();
      await expect(
        requestExactFixtureExport('svg', candidate, productionExport, () => candidate),
      ).resolves.toBeUndefined();
    }
    expect(productionExport).not.toHaveBeenCalled();
  });

  it('fails closed after dispatch on accepted identity, canonical evidence, or receipt drift', async () => {
    const before = reopenedState();
    const targetPath = exportTargetPath(before.saveTargetPath, 'svg') ?? '';
    for (const after of [
      reopenedState({ acceptedIdentity: {} }),
      reopenedState({ reopenedEvidence: evidence('reopened', { renderSceneSha256: digest('f') }) }),
      reopenedState({ svgExportReceipt: svgReceipt(targetPath, { sha256: 'bad' }) }),
      reopenedState({
        svgExportReceipt: svgReceipt(targetPath, { byteLength: 32 * 1_024 * 1_024 + 1 }),
      }),
      reopenedState({ svgExportReceipt: svgReceipt('/wrong.svg') }),
      reopenedState({ svgExportReceipt: svgReceipt(targetPath, { widthMillimeters: 401 }) }),
    ]) {
      await expect(
        requestExactFixtureExport(
          'svg',
          before,
          () => Promise.resolve(undefined),
          () => after,
        ),
      ).resolves.toBeUndefined();
    }
  });

  it('clears stale completion synchronously and ignores a removed in-flight handler', async () => {
    const target = new EventTarget();
    const acceptedIdentity = {};
    let current = reopenedState({ acceptedIdentity });
    let resolveExport: (() => void) | undefined;
    const exportSvg = vi.fn(
      (targetPath: string) =>
        new Promise<void>((resolve) => {
          resolveExport = () => {
            current = reopenedState({ acceptedIdentity, svgExportReceipt: svgReceipt(targetPath) });
            resolve();
          };
        }),
    );
    const record = vi.fn();
    const remove = installPackagedExportObserverDispatch(
      target,
      true,
      () => current,
      () => Promise.resolve(undefined),
      exportSvg,
      () => Promise.resolve(undefined),
      record,
    );
    const event = dispatchEvent('KeyV');
    target.dispatchEvent(event);
    remove();
    resolveExport?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(event.defaultPrevented).toBe(true);
    expect(record).toHaveBeenCalledOnce();
    expect(record).toHaveBeenCalledWith(undefined);
  });
});

function reopenedState(
  overrides: Partial<PackagedExportObserverState> = {},
): PackagedExportObserverState {
  const acceptedIdentity = overrides.acceptedIdentity ?? {};
  return {
    fixtureId: 'milestone-2-atlas-proof',
    worldSeed: '81985529216486895',
    controls: DEFAULT_ATLAS_CONTROLS,
    workflowPhase: 'reopened',
    isBusy: false,
    hasPreview: false,
    acceptedCheckpoint: 'reopened',
    acceptedIdentity,
    acceptedWorldSeed: '81985529216486895',
    acceptedControls: DEFAULT_ATLAS_CONTROLS,
    savedEvidence: evidence('appearance-rerolled'),
    reopenedEvidence: evidence('reopened'),
    reopenComparison: comparison(),
    savedManifestSha256: digest('e'),
    reopenedManifestSha256: digest('e'),
    reopenGenerationInvocationCount: 0,
    saveTargetPath: '/private/tmp/issue97/atlas.mapworld',
    svgExportReceipt: undefined,
    pngExportReceipt: undefined,
    ...overrides,
  };
}

function acceptedState(
  overrides: Partial<PackagedExportObserverState> = {},
): PackagedExportObserverState {
  return {
    ...reopenedState(),
    workflowPhase: 'accepted',
    acceptedCheckpoint: 'baseline',
    savedEvidence: undefined,
    reopenedEvidence: undefined,
    reopenComparison: undefined,
    savedManifestSha256: undefined,
    reopenedManifestSha256: undefined,
    reopenGenerationInvocationCount: undefined,
    ...overrides,
  };
}

function evidence(
  checkpoint: string,
  overrides: Partial<NonNullable<PackagedExportObserverState['reopenedEvidence']>> = {},
) {
  return {
    checkpoint,
    canonicalAspectSetSha256: digest('a'),
    canonicalOutputSetSha256: digest('b'),
    canonicalCoastlineOutputSha256: digest('c'),
    renderSceneSha256: digest('d'),
    ...overrides,
  };
}

function comparison() {
  return {
    passed: true,
    canonicalAspectsRestored: true,
    canonicalOutputsRestored: true,
    canonicalCoastlineRestored: true,
    renderSceneRestored: true,
    manifestFingerprintRestored: true,
  };
}

function svgReceipt(
  targetPath: string,
  overrides: Partial<NonNullable<PackagedExportObserverState['svgExportReceipt']>> = {},
) {
  return {
    targetPath,
    sha256: digest('a'),
    byteLength: 800_000,
    platform: 'macos' as const,
    profileId: 'atlas-svg-v1' as const,
    profileVersion: 1 as const,
    widthMillimeters: 400,
    heightMillimeters: 200,
    ...overrides,
  };
}

function pngReceipt(
  targetPath: string,
  overrides: Partial<NonNullable<PackagedExportObserverState['pngExportReceipt']>> = {},
) {
  return {
    targetPath,
    sha256: digest('b'),
    byteLength: 1_200_000,
    platform: 'macos' as const,
    profileId: 'atlas-png-v1' as const,
    profileVersion: 1 as const,
    widthPx: 8192,
    heightPx: 4096,
    ...overrides,
  };
}

function digest(character: string): string {
  return character.repeat(64);
}

function dispatchShape(
  code: string,
  overrides: Partial<{ altKey: boolean; ctrlKey: boolean; metaKey: boolean; repeat: boolean }> = {},
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
