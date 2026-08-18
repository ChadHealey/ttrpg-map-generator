/** Desktop orchestration for generator-free canonical atlas SVG export and native commit. */

import { downloadDir, join } from '@tauri-apps/api/path';
import { RESTRAINED_INK_ATLAS_STYLE } from '@ttrpg-map/assets';
import { formatWorldSeed, sha256 } from '@ttrpg-map/core';
import {
  ATLAS_SVG_DEFAULT_DIMENSIONS,
  ATLAS_SVG_DIAGNOSTIC_CODES,
  type AtlasSvgExportProgress,
  exportAtlasSceneToSvgAsync,
} from '@ttrpg-map/render';

import {
  type AtlasSvgNativeWriteReceipt,
  requestNativeAtlasSvgWrite,
} from './atlas-svg-native-boundary.js';
import type { AcceptedAtlasState } from './atlas-workflow-generation.js';
import type { NativeMapworldInvoke } from './mapworld-native-boundary.js';
import { tauriMapworldInvoke } from './tauri-mapworld-invoke.js';

export const ATLAS_SVG_DESKTOP_DIAGNOSTIC_CODES = Object.freeze({
  destinationUnavailable: 'atlas-svg.destination.unavailable',
  acceptedAtlasRequired: 'atlas-svg.accepted-atlas.required',
} as const);

export interface AtlasSvgWorkflowProgress {
  readonly operationId: string;
  readonly stage: string;
  readonly completedWork: number;
  readonly totalWork: number;
  readonly isCancellationRequested: boolean;
  readonly isTerminal: boolean;
}

export interface AtlasSvgWorkflowRuntime {
  readonly operationId: string;
  readonly isCancellationRequested: () => boolean;
  readonly reportProgress: (progress: AtlasSvgWorkflowProgress) => void;
  readonly yieldControl: () => Promise<void>;
  readonly beginNativeCommit: () => void;
}

export interface AtlasSvgDestinationPort {
  readonly defaultTargetPath: (worldSeed: string) => Promise<string | undefined>;
  readonly write: (request: {
    readonly targetPath: string;
    readonly bytes: Uint8Array;
    readonly expectedSha256: string;
  }) => Promise<
    | { readonly ok: true; readonly value: AtlasSvgNativeWriteReceipt }
    | {
        readonly ok: false;
        readonly diagnostic: { readonly code: string; readonly message: string };
      }
  >;
}

export interface AtlasSvgWorkflowReceipt extends AtlasSvgNativeWriteReceipt {
  readonly profileId: 'atlas-svg-v1';
  readonly profileVersion: 1;
  readonly widthMillimeters: number;
  readonly heightMillimeters: number;
}

export type AtlasSvgWorkflowResult =
  | { readonly ok: true; readonly receipt: AtlasSvgWorkflowReceipt }
  | {
      readonly ok: false;
      readonly isCancelled: boolean;
      readonly diagnosticCodes: readonly string[];
      readonly message: string;
    };

export function createNativeAtlasSvgDestination(
  invoke: NativeMapworldInvoke = tauriMapworldInvoke,
): AtlasSvgDestinationPort {
  return Object.freeze({
    async defaultTargetPath(worldSeed: string): Promise<string | undefined> {
      try {
        return await join(await downloadDir(), `atlas-${worldSeed}.svg`);
      } catch {
        return undefined;
      }
    },
    write: (request: Parameters<AtlasSvgDestinationPort['write']>[0]) =>
      requestNativeAtlasSvgWrite(invoke, request),
  });
}

export const productionAtlasSvgDestination = createNativeAtlasSvgDestination();

/** Export only the already reconstructed scene; accepted document records remain untouched. */
export async function exportAcceptedAtlasSvg(
  accepted: AcceptedAtlasState | undefined,
  requestedTargetPath: string | undefined,
  runtime: AtlasSvgWorkflowRuntime,
  destination: AtlasSvgDestinationPort = productionAtlasSvgDestination,
): Promise<AtlasSvgWorkflowResult> {
  if (accepted === undefined) {
    return failure(
      ATLAS_SVG_DESKTOP_DIAGNOSTIC_CODES.acceptedAtlasRequired,
      'Accept or reopen a complete atlas before exporting SVG.',
    );
  }
  const targetPath =
    requestedTargetPath ??
    (await destination.defaultTargetPath(formatWorldSeed(accepted.document.worldSeed)));
  if (targetPath === undefined) {
    return failure(
      ATLAS_SVG_DESKTOP_DIAGNOSTIC_CODES.destinationUnavailable,
      'Choose a writable SVG destination or make the desktop downloads directory available.',
    );
  }
  const totalWork = accepted.scene.nodes.length + 1;
  const svg = await exportAtlasSceneToSvgAsync(
    {
      scene: accepted.scene,
      style: RESTRAINED_INK_ATLAS_STYLE,
      dimensions: ATLAS_SVG_DEFAULT_DIMENSIONS,
    },
    {
      isCancellationRequested: runtime.isCancellationRequested,
      reportProgress: (value) => {
        runtime.reportProgress(mapProgress(runtime, value, totalWork));
      },
      yieldControl: runtime.yieldControl,
    },
  );
  if (!svg.ok) {
    const first = svg.diagnostics[0];
    return Object.freeze({
      ok: false,
      isCancelled: first?.code === ATLAS_SVG_DIAGNOSTIC_CODES.cancelled,
      diagnosticCodes: Object.freeze(svg.diagnostics.map(({ code }) => code)),
      message: first?.message ?? 'Atlas SVG serialization failed.',
    });
  }
  if (runtime.isCancellationRequested()) {
    return failure(
      ATLAS_SVG_DIAGNOSTIC_CODES.cancelled,
      'Atlas SVG export was cancelled before any destination file was committed.',
      true,
    );
  }
  const expectedSha256 = hex(sha256(svg.value.bytes));
  runtime.reportProgress(
    progress(runtime, 'writing-atomically', accepted.scene.nodes.length, totalWork, false),
  );
  runtime.beginNativeCommit();
  const written = await destination.write({
    targetPath,
    bytes: svg.value.bytes,
    expectedSha256,
  });
  if (!written.ok) {
    runtime.reportProgress(
      progress(runtime, 'failed', accepted.scene.nodes.length, totalWork, true),
    );
    return failure(written.diagnostic.code, written.diagnostic.message);
  }
  runtime.reportProgress(progress(runtime, 'completed', totalWork, totalWork, true));
  return Object.freeze({
    ok: true,
    receipt: Object.freeze({
      ...written.value,
      profileId: svg.value.profileId,
      profileVersion: svg.value.profileVersion,
      widthMillimeters: svg.value.widthMillimeters,
      heightMillimeters: svg.value.heightMillimeters,
    }),
  });
}

function mapProgress(
  runtime: AtlasSvgWorkflowRuntime,
  value: AtlasSvgExportProgress,
  totalWork: number,
): AtlasSvgWorkflowProgress {
  return progress(
    runtime,
    `svg-${value.stage}`,
    Math.min(value.completedNodes, totalWork - 1),
    totalWork,
    value.stage === 'cancelled' || value.stage === 'failed',
  );
}

function progress(
  runtime: AtlasSvgWorkflowRuntime,
  stage: string,
  completedWork: number,
  totalWork: number,
  isTerminal: boolean,
): AtlasSvgWorkflowProgress {
  return Object.freeze({
    operationId: runtime.operationId,
    stage,
    completedWork,
    totalWork,
    isCancellationRequested: runtime.isCancellationRequested(),
    isTerminal,
  });
}

function failure(
  code: string,
  message: string,
  isCancelled = false,
): Extract<AtlasSvgWorkflowResult, { readonly ok: false }> {
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
