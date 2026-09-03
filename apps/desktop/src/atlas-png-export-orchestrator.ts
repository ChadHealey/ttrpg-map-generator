/** Desktop orchestration for generator-free canonical atlas PNG export and native commit. */

import { downloadDir, join } from '@tauri-apps/api/path';
import { RESTRAINED_INK_ATLAS_STYLE } from '@ttrpg-map/assets';
import { formatWorldSeed, sha256 } from '@ttrpg-map/core';
import {
  ATLAS_PNG_DEFAULT_DIMENSIONS,
  ATLAS_PNG_DIAGNOSTIC_CODES,
  type AtlasPngDimensions,
  type AtlasPngExportProgress,
  type AtlasPngPhysicalOverlayExportProgress,
  exportAtlasSceneToPngAsync,
  exportAtlasSceneToPngWithPhysicalOverlaysAsync,
} from '@ttrpg-map/render';

import {
  ATLAS_PNG_NATIVE_DIAGNOSTIC_CODES,
  type AtlasPngNativeWriteReceipt,
  requestNativeAtlasPngWrite,
} from './atlas-png-native-boundary.js';
import type { AcceptedAtlasState } from './atlas-workflow-generation.js';
import type { NativeMapworldInvoke } from './mapworld-native-boundary.js';
import { tauriMapworldInvoke } from './tauri-mapworld-invoke.js';

export const ATLAS_PNG_DESKTOP_DIAGNOSTIC_CODES = Object.freeze({
  acceptedAtlasRequired: 'atlas-png.accepted-atlas.required',
  destinationUnavailable: 'atlas-png.destination.unavailable',
} as const);

export interface AtlasPngWorkflowProgress {
  readonly operationId: string;
  readonly stage: string;
  readonly completedWork: number;
  readonly totalWork: number;
  readonly isCancellationRequested: boolean;
  readonly isTerminal: boolean;
}

export interface AtlasPngWorkflowRuntime {
  readonly operationId: string;
  readonly isCancellationRequested: () => boolean;
  readonly reportProgress: (progress: AtlasPngWorkflowProgress) => void;
  readonly yieldControl: () => Promise<void>;
  readonly beginNativeCommit: () => void;
}

export interface AtlasPngDestinationPort {
  readonly defaultTargetPath: (worldSeed: string) => Promise<string | undefined>;
  readonly write: (request: {
    readonly targetPath: string;
    readonly bytes: Uint8Array;
    readonly expectedSha256: string;
  }) => Promise<
    | { readonly ok: true; readonly value: AtlasPngNativeWriteReceipt }
    | {
        readonly ok: false;
        readonly diagnostic: { readonly code: string; readonly message: string };
      }
  >;
}

export interface AtlasPngWorkflowReceipt extends AtlasPngNativeWriteReceipt {
  readonly profileId: 'atlas-png-v1' | 'atlas-png-v2';
  readonly profileVersion: 1 | 2;
  readonly widthPx: number;
  readonly heightPx: number;
}

export type AtlasPngWorkflowResult =
  | { readonly ok: true; readonly receipt: AtlasPngWorkflowReceipt }
  | {
      readonly ok: false;
      readonly isCancelled: boolean;
      readonly diagnosticCodes: readonly string[];
      readonly message: string;
    };

export function createNativeAtlasPngDestination(
  invoke: NativeMapworldInvoke = tauriMapworldInvoke,
): AtlasPngDestinationPort {
  return Object.freeze({
    async defaultTargetPath(worldSeed: string): Promise<string | undefined> {
      try {
        return await join(await downloadDir(), `atlas-${worldSeed}.png`);
      } catch {
        return undefined;
      }
    },
    write: (request: Parameters<AtlasPngDestinationPort['write']>[0]) =>
      requestNativeAtlasPngWrite(invoke, request),
  });
}

export const productionAtlasPngDestination = createNativeAtlasPngDestination();

/** Export only the exact accepted scene; accepted semantic records remain untouched. */
export async function exportAcceptedAtlasPng(
  accepted: AcceptedAtlasState | undefined,
  requestedTargetPath: string | undefined,
  runtime: AtlasPngWorkflowRuntime,
  destination: AtlasPngDestinationPort = productionAtlasPngDestination,
  dimensions: AtlasPngDimensions = ATLAS_PNG_DEFAULT_DIMENSIONS,
): Promise<AtlasPngWorkflowResult> {
  if (accepted === undefined) {
    return failure(
      ATLAS_PNG_DESKTOP_DIAGNOSTIC_CODES.acceptedAtlasRequired,
      'Accept or reopen a complete atlas before exporting PNG.',
    );
  }
  const targetPath =
    requestedTargetPath ??
    (await destination.defaultTargetPath(formatWorldSeed(accepted.document.worldSeed)));
  if (targetPath === undefined) {
    return failure(
      ATLAS_PNG_DESKTOP_DIAGNOSTIC_CODES.destinationUnavailable,
      'Choose a writable PNG destination or make the desktop downloads directory available.',
    );
  }

  let exportTotalWork = 0;
  const request = { scene: accepted.scene, style: RESTRAINED_INK_ATLAS_STYLE, dimensions };
  const exportRuntime = {
    isCancellationRequested: runtime.isCancellationRequested,
    reportProgress: (value: AtlasPngExportProgress | AtlasPngPhysicalOverlayExportProgress) => {
      exportTotalWork = value.totalWork;
      runtime.reportProgress(mapProgress(runtime, value));
    },
    yieldControl: runtime.yieldControl,
  };
  const png = hasPhysicalOverlayNodes(accepted.scene)
    ? await exportAtlasSceneToPngWithPhysicalOverlaysAsync(request, exportRuntime)
    : await exportAtlasSceneToPngAsync(request, exportRuntime);
  if (!png.ok) {
    const first = png.diagnostics[0];
    return Object.freeze({
      ok: false,
      isCancelled: first?.code === ATLAS_PNG_DIAGNOSTIC_CODES.cancelled,
      diagnosticCodes: Object.freeze(png.diagnostics.map(({ code }) => code)),
      message: first?.message ?? 'Atlas PNG rasterization failed.',
    });
  }

  const totalWork = exportTotalWork + 1;
  if (runtime.isCancellationRequested()) {
    runtime.reportProgress(
      progress(runtime, 'cancelled-before-write', exportTotalWork, totalWork, true),
    );
    return failure(
      ATLAS_PNG_DIAGNOSTIC_CODES.cancelled,
      'Atlas PNG export was cancelled before any destination file was committed.',
      true,
    );
  }

  const expectedSha256 = hex(sha256(png.value.bytes));
  runtime.reportProgress(
    progress(runtime, 'writing-atomically', exportTotalWork, totalWork, false),
  );
  runtime.beginNativeCommit();
  const written = await destination.write({
    targetPath,
    bytes: png.value.bytes,
    expectedSha256,
  });
  if (!written.ok) {
    runtime.reportProgress(progress(runtime, 'failed', exportTotalWork, totalWork, true));
    return failure(written.diagnostic.code, written.diagnostic.message);
  }
  if (!receiptMatches(written.value, targetPath, expectedSha256, png.value.bytes.byteLength)) {
    runtime.reportProgress(progress(runtime, 'failed', exportTotalWork, totalWork, true));
    return failure(
      ATLAS_PNG_NATIVE_DIAGNOSTIC_CODES.ioFailed,
      'Native atlas PNG export returned an invalid or unverified receipt.',
    );
  }

  runtime.reportProgress(progress(runtime, 'completed', totalWork, totalWork, true));
  return Object.freeze({
    ok: true,
    receipt: Object.freeze({
      ...written.value,
      profileId: png.value.profileId,
      profileVersion: png.value.profileVersion,
      widthPx: png.value.widthPx,
      heightPx: png.value.heightPx,
    }),
  });
}

function mapProgress(
  runtime: AtlasPngWorkflowRuntime,
  value: AtlasPngExportProgress | AtlasPngPhysicalOverlayExportProgress,
): AtlasPngWorkflowProgress {
  return progress(
    runtime,
    `png-${value.stage}`,
    Math.min(value.completedWork, value.totalWork),
    value.totalWork + 1,
    value.stage === 'cancelled' || value.stage === 'failed',
  );
}

function hasPhysicalOverlayNodes(scene: AcceptedAtlasState['scene']): boolean {
  return scene.nodes.some(({ id }) => id.startsWith('atlas/physical/'));
}

function progress(
  runtime: AtlasPngWorkflowRuntime,
  stage: string,
  completedWork: number,
  totalWork: number,
  isTerminal: boolean,
): AtlasPngWorkflowProgress {
  return Object.freeze({
    operationId: runtime.operationId,
    stage,
    completedWork,
    totalWork,
    isCancellationRequested: runtime.isCancellationRequested(),
    isTerminal,
  });
}

function receiptMatches(
  receipt: AtlasPngNativeWriteReceipt,
  targetPath: string,
  expectedSha256: string,
  byteLength: number,
): boolean {
  return (
    receipt.targetPath === targetPath &&
    receipt.sha256 === expectedSha256 &&
    receipt.byteLength === byteLength
  );
}

function failure(
  code: string,
  message: string,
  isCancelled = false,
): Extract<AtlasPngWorkflowResult, { readonly ok: false }> {
  return Object.freeze({
    ok: false,
    isCancelled,
    diagnosticCodes: Object.freeze([code]),
    message,
  });
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
