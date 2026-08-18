/** Canonical dependency-free PNG export orchestration for an accepted whole-world atlas scene. */

import {
  ATLAS_PNG_ENCODER_DIAGNOSTIC_CODES,
  createAtlasPngRowEncoder,
} from './atlas-png-encoder.js';
import {
  ATLAS_PNG_DEFAULT_DIMENSIONS,
  ATLAS_PNG_DIAGNOSTIC_CODES,
  ATLAS_PNG_EXPORT_PROFILE_ID,
  ATLAS_PNG_EXPORT_VERSION,
  ATLAS_PNG_MAXIMUM_BYTES,
  ATLAS_PNG_MAXIMUM_COMPRESSED_ASSEMBLY_BYTES,
  ATLAS_PNG_MAXIMUM_CONCURRENT_ENCODED_BYTES,
  type AtlasPngExportProgress,
  type AtlasPngExportRequest,
  type AtlasPngExportResources,
  type AtlasPngExportResult,
  type AtlasPngExportRuntime,
} from './atlas-png-profile.js';
import { atlasPngRasterTotalWork, rasterizeAtlasPngRows } from './atlas-png-rasterizer.js';
import { atlasPngDiagnostic, validateAtlasPngExportRequest } from './atlas-png-validation.js';

export * from './atlas-png-profile.js';

const PROGRESS_REPORT_CHECKPOINTS = 8;
const EVENT_LOOP_YIELD_CHECKPOINTS = 64;

/** Rasterize and encode without allocating a whole-output RGB or RGBA surface. */
export async function exportAtlasSceneToPngAsync(
  request: AtlasPngExportRequest,
  runtime: AtlasPngExportRuntime,
): Promise<AtlasPngExportResult> {
  const requestedDimensions = request.dimensions ?? ATLAS_PNG_DEFAULT_DIMENSIONS;
  const provisionalTotal =
    2 + atlasPngRasterTotalWork(request.scene.nodes.length, requestedDimensions.heightPx);
  runtime.reportProgress(progress('validating', 0, provisionalTotal, false));
  if (runtime.isCancellationRequested()) return cancelled(runtime, provisionalTotal, 0);

  const validated = validateAtlasPngExportRequest(request);
  if (!validated.ok) {
    runtime.reportProgress(progress('failed', 0, provisionalTotal, true));
    return validated;
  }

  const { dimensions, scene } = validated.value;
  const totalWork = 2 + atlasPngRasterTotalWork(scene.nodes.length, dimensions.heightPx);
  const createdEncoder = createAtlasPngRowEncoder({
    widthPx: dimensions.widthPx,
    heightPx: dimensions.heightPx,
    maximumOutputBytes: ATLAS_PNG_MAXIMUM_BYTES,
  });
  if (!createdEncoder.ok) {
    runtime.reportProgress(progress('failed', 1, totalWork, true));
    return failure(ATLAS_PNG_DIAGNOSTIC_CODES.encodingFailed, createdEncoder.diagnostic.message);
  }

  runtime.reportProgress(progress('preparing', 1, totalWork, false));
  if (runtime.isCancellationRequested()) return cancelled(runtime, totalWork, 1);

  let encoderDiagnostic: { readonly code: string; readonly message: string } | undefined;
  let checkpointCount = 0;
  let lastReportedWork = 1;
  const preparationBoundary = 1 + scene.nodes.length;
  const raster = await rasterizeAtlasPngRows({
    scene,
    dimensions,
    initialCompletedWork: 1,
    writeRow(row) {
      const written = createdEncoder.encoder.writeRow(row);
      if (!written.ok) encoderDiagnostic = written.diagnostic;
      return written.ok;
    },
    runtime: {
      isCancellationRequested: runtime.isCancellationRequested,
      async checkpoint(completedWork) {
        checkpointCount += 1;
        lastReportedWork = Math.max(lastReportedWork, completedWork);
        if (checkpointCount % PROGRESS_REPORT_CHECKPOINTS === 0) {
          runtime.reportProgress(
            progress(
              completedWork <= preparationBoundary ? 'preparing' : 'rasterizing',
              lastReportedWork,
              totalWork,
              false,
            ),
          );
        }
        if (checkpointCount % EVENT_LOOP_YIELD_CHECKPOINTS === 0) {
          await runtime.yieldControl();
        }
      },
    },
  });
  if (!raster.ok) {
    if (raster.failure.reason === 'cancelled') {
      return cancelled(runtime, totalWork, lastReportedWork);
    }
    runtime.reportProgress(progress('failed', lastReportedWork, totalWork, true));
    const code =
      encoderDiagnostic?.code === ATLAS_PNG_ENCODER_DIAGNOSTIC_CODES.outputTooLarge
        ? ATLAS_PNG_DIAGNOSTIC_CODES.outputTooLarge
        : ATLAS_PNG_DIAGNOSTIC_CODES.resourceLimitExceeded;
    return failure(code, encoderDiagnostic?.message ?? raster.failure.message);
  }
  if (runtime.isCancellationRequested()) return cancelled(runtime, totalWork, lastReportedWork);

  runtime.reportProgress(progress('verifying', totalWork - 1, totalWork, false));
  const encoded = createdEncoder.encoder.finish();
  if (!encoded.ok) {
    runtime.reportProgress(progress('failed', totalWork - 1, totalWork, true));
    const code =
      encoded.diagnostic.code === ATLAS_PNG_ENCODER_DIAGNOSTIC_CODES.outputTooLarge
        ? ATLAS_PNG_DIAGNOSTIC_CODES.outputTooLarge
        : ATLAS_PNG_DIAGNOSTIC_CODES.encodingFailed;
    return failure(code, encoded.diagnostic.message);
  }
  if (encoded.bytes.byteLength > ATLAS_PNG_MAXIMUM_BYTES) {
    runtime.reportProgress(progress('failed', totalWork - 1, totalWork, true));
    return failure(
      ATLAS_PNG_DIAGNOSTIC_CODES.outputTooLarge,
      `The canonical PNG exceeds the ${String(ATLAS_PNG_MAXIMUM_BYTES)}-byte atlas limit.`,
    );
  }

  const resources: AtlasPngExportResources = Object.freeze({
    ...raster.resources,
    outputPixelCount: dimensions.widthPx * dimensions.heightPx,
    maximumRawRgbRowBytes: dimensions.widthPx * 3,
    maximumFilteredRowBytes: dimensions.widthPx * 3 + 1,
    maximumLiveRowBufferBytes: dimensions.widthPx * 3 * 2 + (dimensions.widthPx * 3 + 1),
    maximumCompressedAssemblyBytes: ATLAS_PNG_MAXIMUM_COMPRESSED_ASSEMBLY_BYTES,
    maximumConcurrentEncodedBytes: ATLAS_PNG_MAXIMUM_CONCURRENT_ENCODED_BYTES,
    maximumEncodedBytes: ATLAS_PNG_MAXIMUM_BYTES,
    hasFullSizeRasterSurface: false,
  });
  runtime.reportProgress(progress('completed', totalWork, totalWork, true));
  return {
    ok: true,
    value: Object.freeze({
      profileId: ATLAS_PNG_EXPORT_PROFILE_ID,
      profileVersion: ATLAS_PNG_EXPORT_VERSION,
      widthPx: dimensions.widthPx,
      heightPx: dimensions.heightPx,
      byteLength: encoded.bytes.byteLength,
      bytes: encoded.bytes,
      resources,
    }),
  };
}

function failure(
  code: Parameters<typeof atlasPngDiagnostic>[0],
  message: string,
): AtlasPngExportResult {
  return { ok: false, diagnostics: Object.freeze([atlasPngDiagnostic(code, message)]) };
}

function progress(
  stage: AtlasPngExportProgress['stage'],
  completedWork: number,
  totalWork: number,
  isTerminal: boolean,
): AtlasPngExportProgress {
  return Object.freeze({
    profileId: ATLAS_PNG_EXPORT_PROFILE_ID,
    stage,
    completedWork,
    totalWork,
    isTerminal,
  });
}

function cancelled(
  runtime: AtlasPngExportRuntime,
  totalWork: number,
  completedWork: number,
): AtlasPngExportResult {
  runtime.reportProgress(progress('cancelled', completedWork, totalWork, true));
  return failure(
    ATLAS_PNG_DIAGNOSTIC_CODES.cancelled,
    'Atlas PNG export was cancelled before any destination file was committed.',
  );
}
