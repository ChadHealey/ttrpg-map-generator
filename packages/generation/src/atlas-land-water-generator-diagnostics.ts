/** Stable, actionable findings for atlas realization, validation, runtime, and cancellation. */

import type {
  AtlasGeographyDiagnostic,
  GenerationDiagnostic,
  GenerationDiagnosticCode,
} from '@ttrpg-map/core';

import type {
  AtlasLandWaterClassificationParameters,
  AtlasLandWaterGenerationInput,
  AtlasLandWaterGenerationRuntime,
} from './atlas-land-water-generator-contract.js';
import {
  ATLAS_LAND_WATER_DIAGNOSTIC_CODES,
  ATLAS_WATER_COVERAGE_TOLERANCE_BASIS_POINTS,
} from './atlas-land-water-generator-metadata.js';
import type { AtlasLandWaterProgressReporter } from './atlas-land-water-progress.js';

export function validateAtlasLandWaterRealization(
  input: AtlasLandWaterGenerationInput,
  parameters: AtlasLandWaterClassificationParameters,
  isConnectivityProxySupported: boolean,
  coverageErrorBasisPoints: number,
): readonly GenerationDiagnostic[] {
  const diagnostics: GenerationDiagnostic[] = [];
  if (coverageErrorBasisPoints > ATLAS_WATER_COVERAGE_TOLERANCE_BASIS_POINTS) {
    diagnostics.push(
      diagnostic(
        ATLAS_LAND_WATER_DIAGNOSTIC_CODES.waterCoverageUnsatisfied,
        'error',
        input.landWaterClassificationAspectId,
        'The selected shared threshold cannot realize target water coverage within the version-1 tolerance.',
        'Adjust the target or macro controls and generate a new full proposal; do not accept this partition.',
      ),
    );
  }
  if (!isConnectivityProxySupported) {
    diagnostics.push(
      diagnostic(
        ATLAS_LAND_WATER_DIAGNOSTIC_CODES.oceanConnectivityUnsupported,
        'warning',
        input.landWaterClassificationAspectId,
        'No coverage-tolerant shared threshold supports the requested sampled-connectivity proxy.',
        'Keep the valid partition for review or adjust controls; semantic ocean proof remains owned by the later classifier.',
      ),
    );
  }
  diagnostics.push(
    diagnostic(
      ATLAS_LAND_WATER_DIAGNOSTIC_CODES.oceanConnectivityUnverified,
      'warning',
      input.landWaterClassificationAspectId,
      `Ocean-connectivity intent ${parameters.oceanConnectivity} has only a transient sampled-partition proxy in this proposal.`,
      'Run the versioned semantic landmass and water-body classifier before treating ocean intent as proven.',
    ),
  );
  return Object.freeze(diagnostics);
}

export function mapAtlasLandWaterValidationDiagnostic(
  input: AtlasLandWaterGenerationInput,
  source: AtlasGeographyDiagnostic,
): GenerationDiagnostic {
  const targetsMacro =
    source.code.includes('.field.') || source.code.endsWith('.field-value.invalid');
  return diagnostic(
    ATLAS_LAND_WATER_DIAGNOSTIC_CODES.invalidOutput,
    'error',
    targetsMacro ? input.macroElevationAspectId : input.landWaterClassificationAspectId,
    `Atlas land/water record validation failed with ${source.code}.`,
    'Reject the proposal and regenerate with the declared version-1 profile and validated inputs.',
  );
}

export function validateAtlasLandWaterRuntime(
  input: AtlasLandWaterGenerationInput,
  runtime: AtlasLandWaterGenerationRuntime,
): GenerationDiagnostic | undefined {
  const hasValidOperationId =
    typeof runtime.operationId === 'string' &&
    /^[a-z0-9][a-z0-9._:-]{0,127}$/u.test(runtime.operationId);
  if (
    !hasValidOperationId ||
    runtime.macroElevationRandom === runtime.landWaterClassificationRandom
  ) {
    return diagnostic(
      ATLAS_LAND_WATER_DIAGNOSTIC_CODES.invalidRuntime,
      'error',
      input.macroElevationAspectId,
      'Atlas generation requires a stable operation ID, valid observer hooks, and two independent explicit streams.',
      'Create fresh map/entity streams from each aspect seed namespace and provide cooperative runtime hooks.',
    );
  }
  return undefined;
}

export function atlasLandWaterCancelledResult(
  input: AtlasLandWaterGenerationInput,
  progress: AtlasLandWaterProgressReporter,
  target: 'classification' | 'macro',
): { readonly status: 'cancelled'; readonly diagnostics: readonly GenerationDiagnostic[] } {
  progress.cancel();
  return Object.freeze({
    status: 'cancelled',
    diagnostics: Object.freeze([
      diagnostic(
        ATLAS_LAND_WATER_DIAGNOSTIC_CODES.cancelled,
        'warning',
        target === 'macro' ? input.macroElevationAspectId : input.landWaterClassificationAspectId,
        'Atlas generation was cooperatively cancelled before a complete proposal was produced.',
        'Restart generation from the same accepted inputs with fresh explicit aspect streams.',
      ),
    ]),
  });
}

export function atlasLandWaterInvalidRuntimeResult(
  input: AtlasLandWaterGenerationInput,
  progress: AtlasLandWaterProgressReporter,
): { readonly status: 'invalid'; readonly diagnostics: readonly GenerationDiagnostic[] } {
  const finding = diagnostic(
    ATLAS_LAND_WATER_DIAGNOSTIC_CODES.invalidRuntime,
    'error',
    input.macroElevationAspectId,
    'The injected atlas generation runtime failed while observing or yielding costly work.',
    'Retry with non-throwing progress, cancellation, and cooperative-yield capabilities.',
  );
  try {
    progress.cancel();
  } catch {
    // The returned stable finding remains authoritative when the observer itself is broken.
  }
  return Object.freeze({ status: 'invalid', diagnostics: Object.freeze([finding]) });
}

function diagnostic(
  code: GenerationDiagnosticCode,
  severity: GenerationDiagnostic['severity'],
  aspectId: AtlasLandWaterGenerationInput['macroElevationAspectId'],
  message: string,
  suggestedAction: string,
): GenerationDiagnostic {
  return Object.freeze({
    code,
    severity,
    target: Object.freeze({ aspectId }),
    message,
    suggestedAction,
  });
}
