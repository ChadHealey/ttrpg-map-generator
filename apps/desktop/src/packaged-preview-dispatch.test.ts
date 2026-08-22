import { describe, expect, it, vi } from 'vitest';

import appSource from './App.svelte?raw';
import {
  installPackagedPreviewDispatch,
  isPackagedPreviewDispatch,
  requestProductionCoarsePreview,
} from './packaged-preview-dispatch.js';

describe('packaged preview observer dispatch', () => {
  it('wires the observer chord and visible control to the same App preview action', () => {
    expect(appSource).toMatch(
      /installPackagedPreviewDispatch\([\s\S]*?window,[\s\S]*?\(\) => void preview\(\),[\s\S]*?\)/u,
    );
    expect(appSource).toMatch(
      /<button[\s\S]*?onclick=\{\(\) => void preview\(\)\}[\s\S]*?>Generate coarse preview<\/button/u,
    );
    expect(appSource.match(/onclick=\{\(\) => void preview\(\)\}/gu)).toHaveLength(1);
    expect(appSource).toMatch(
      /async function preview\(\): Promise<void> \{[\s\S]*?requestProductionCoarsePreview\([\s\S]*?workflow\.requestPreview/u,
    );
  });

  it('uses the production coarse-preview request and presentation workflow', async () => {
    const operation = Promise.resolve({ ok: true });
    const controls = { targetWaterCoveragePercent: 62 };
    const requestPreview = vi.fn(() => operation);
    const present = vi.fn(async (candidate: Promise<unknown>) => {
      await candidate;
    });

    await requestProductionCoarsePreview(requestPreview, 'proof-seed', controls, present);

    expect(requestPreview).toHaveBeenCalledWith('proof-seed', controls);
    expect(present).toHaveBeenCalledWith(operation);
  });

  it('has no effect when the test-only build flag is disabled', () => {
    const target = new EventTarget();
    const requestPreview = vi.fn();
    const remove = installPackagedPreviewDispatch(target, false, requestPreview);

    target.dispatchEvent(dispatchEvent());
    remove();

    expect(requestPreview).not.toHaveBeenCalled();
  });

  it('delegates the exact chord to the supplied production preview action without UI actions', () => {
    const target = new EventTarget();
    const requestPreview = vi.fn();
    const remove = installPackagedPreviewDispatch(target, true, requestPreview);
    const event = dispatchEvent();

    target.dispatchEvent(event);
    remove();
    target.dispatchEvent(dispatchEvent());

    expect(requestPreview).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('rejects partial chords and repeated key events', () => {
    expect(
      isPackagedPreviewDispatch({
        altKey: true,
        code: 'KeyP',
        ctrlKey: true,
        metaKey: false,
        repeat: false,
        preventDefault: vi.fn(),
      }),
    ).toBe(false);
    expect(
      isPackagedPreviewDispatch({
        altKey: true,
        code: 'KeyP',
        ctrlKey: true,
        metaKey: true,
        repeat: true,
        preventDefault: vi.fn(),
      }),
    ).toBe(false);
  });
});

function dispatchEvent(): KeyboardEvent {
  const event = new Event('keydown', { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    altKey: { value: true },
    code: { value: 'KeyP' },
    ctrlKey: { value: true },
    metaKey: { value: true },
    repeat: { value: false },
  });
  return event as KeyboardEvent;
}
