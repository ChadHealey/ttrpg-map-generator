export const PACKAGED_PREVIEW_DISPATCH_CODE = 'KeyP' as const;

export async function requestProductionCoarsePreview<TControls>(
  requestPreview: (seed: string, controls: TControls) => Promise<unknown>,
  seed: string,
  controls: TControls,
  present: (operation: Promise<unknown>) => Promise<void>,
): Promise<void> {
  await present(requestPreview(seed, controls));
}

interface PreviewDispatchKeyEvent {
  readonly altKey: boolean;
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly repeat: boolean;
  preventDefault(): void;
}

export function isPackagedPreviewDispatch(event: PreviewDispatchKeyEvent): boolean {
  return (
    event.code === PACKAGED_PREVIEW_DISPATCH_CODE &&
    event.metaKey &&
    event.altKey &&
    event.ctrlKey &&
    !event.repeat
  );
}

/**
 * Installs the release-observer-only no-scroll dispatch. Ordinary builds pass `enabled=false` and
 * install nothing; the handler delegates to the same action as the visible preview control.
 */
export function installPackagedPreviewDispatch(
  target: EventTarget,
  enabled: boolean,
  requestPreview: () => void,
): () => void {
  if (!enabled) return () => undefined;
  const listener = (rawEvent: Event): void => {
    const event = rawEvent as KeyboardEvent;
    if (!isPackagedPreviewDispatch(event)) return;
    event.preventDefault();
    requestPreview();
  };
  target.addEventListener('keydown', listener);
  return () => {
    target.removeEventListener('keydown', listener);
  };
}
