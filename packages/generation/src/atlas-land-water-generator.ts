/** Pure orchestration for version-1 whole-world macro elevation and land/water proposals. */

import {
  ATLAS_CANONICAL_FIELD_TRAVERSAL,
  ATLAS_FIELD_QUANTIZATION_SCALE,
  atlasSampleReaderToArray,
  validateAtlasLandWaterRecords,
} from '@ttrpg-map/core';

import {
  classifyAtlasLandWater,
  selectAtlasLandWaterThreshold,
} from './atlas-land-water-classification.js';
import {
  atlasLandWaterClassificationParameters,
  type AtlasLandWaterFullGenerationResult,
  type AtlasLandWaterGenerationInput,
  type AtlasLandWaterGenerationRuntime,
  type AtlasLandWaterPreview,
  type AtlasLandWaterPreviewGenerationResult,
  atlasMacroElevationParameters,
  orderedAtlasLandWaterDiagnostics,
} from './atlas-land-water-generator-contract.js';
import {
  atlasLandWaterCancelledResult,
  atlasLandWaterInvalidResult,
  atlasLandWaterInvalidRuntimeResult,
  mapAtlasLandWaterValidationDiagnostic,
  mapSeparatedMacroFieldFinding,
  validateAtlasLandWaterRealization,
  validateAtlasLandWaterRuntime,
} from './atlas-land-water-generator-diagnostics.js';
import { ATLAS_LAND_WATER_PREVIEW_VERSION } from './atlas-land-water-generator-metadata.js';
import { AtlasLandWaterProgressReporter } from './atlas-land-water-progress.js';
import {
  createAtlasLandWaterProposedPatch,
  createAtlasLandWaterRealization,
  createAtlasLandWaterRecords,
} from './atlas-land-water-proposal.js';
import {
  createAtlasMacroElevationFieldAdapter,
  sampleAtlasMacroElevationField,
} from './atlas-macro-elevation-field.js';
import {
  inspectSeparatedAtlasMacroField,
  type SeparatedAtlasMacroElevationFieldAdapter,
} from './atlas-macro-elevation-field-v2.js';
import {
  ATLAS_SAMPLING_POLICY_VERSION,
  WORLD_ATLAS_FULL_PROFILE,
  WORLD_ATLAS_PREVIEW_PROFILE,
} from './atlas-sampling-profiles.js';

export { validateAtlasLandWaterRealization } from './atlas-land-water-generator-diagnostics.js';

/** Generate accepted-profile records and two ordered aspect replacements without committing. */
export async function generateAtlasLandWaterFull(
  input: AtlasLandWaterGenerationInput,
  runtime: AtlasLandWaterGenerationRuntime,
): Promise<AtlasLandWaterFullGenerationResult> {
  const runtimeDiagnostic = validateAtlasLandWaterRuntime(input, runtime);
  if (runtimeDiagnostic !== undefined) {
    return Object.freeze({ status: 'invalid', diagnostics: Object.freeze([runtimeDiagnostic]) });
  }
  const progress = new AtlasLandWaterProgressReporter(runtime, WORLD_ATLAS_FULL_PROFILE.profileId);

  try {
    progress.report('preparing', 0, 1, 0, 0);
    if (progress.isCancellationRequested()) {
      return atlasLandWaterCancelledResult(input, progress, 'macro');
    }

    const macroParameters = atlasMacroElevationParameters(
      input.controls,
      input.macroElevationFieldBehaviorVersion,
    );
    const classificationParameters = atlasLandWaterClassificationParameters(input.controls);
    const fieldAdapter = createAtlasMacroElevationFieldAdapter(
      macroParameters,
      runtime.macroElevationRandom,
    );

    const preview = await sampleAtlasMacroElevationField(
      WORLD_ATLAS_PREVIEW_PROFILE,
      fieldAdapter,
      progress.cooperation('sampling-shared-preview-anchors', 0, 120),
    );
    if (preview.status === 'cancelled') {
      return atlasLandWaterCancelledResult(input, progress, 'macro');
    }

    const threshold = await selectAtlasLandWaterThreshold(
      preview.field,
      classificationParameters,
      progress.cooperation('selecting-land-water-threshold', 120, 220),
    );
    if (threshold.status === 'cancelled') {
      return atlasLandWaterCancelledResult(input, progress, 'classification');
    }

    const full = await sampleAtlasMacroElevationField(
      WORLD_ATLAS_FULL_PROFILE,
      fieldAdapter,
      progress.cooperation('sampling-full-macro-elevation', 220, 650),
      preview.field,
    );
    if (full.status === 'cancelled') {
      return atlasLandWaterCancelledResult(input, progress, 'macro');
    }

    const classification = await classifyAtlasLandWater(
      full.field,
      threshold.selection.contourLevel,
      input.controls.targetWaterCoveragePercent,
      progress.cooperation('classifying-land-water', 650, 880),
    );
    if (classification.status === 'cancelled') {
      return atlasLandWaterCancelledResult(input, progress, 'classification');
    }

    if (await progress.cooperateOnce('validating-proposal', 1, 3, 880, 920)) {
      return atlasLandWaterCancelledResult(input, progress, 'classification');
    }
    const records = createAtlasLandWaterRecords(
      input,
      full.field,
      threshold.selection.contourLevel,
      classification.output,
    );
    const validationDiagnostics = validateAtlasLandWaterRecords(records);
    const generatorDiagnostics = validateAtlasLandWaterRealization(
      input,
      classificationParameters,
      threshold.selection.isConnectivityProxySupported,
      classification.output.absoluteWaterCoverageErrorBasisPoints,
    );
    const macroInspection =
      input.macroElevationFieldBehaviorVersion === 2
        ? await inspectSeparatedAtlasMacroField(
            fieldAdapter as SeparatedAtlasMacroElevationFieldAdapter,
            full.field,
            threshold.selection.contourLevel,
            progress.cooperation('validating-proposal', 920, 980),
          )
        : undefined;
    if (macroInspection?.status === 'cancelled') {
      return atlasLandWaterCancelledResult(input, progress, 'macro');
    }
    const macroDiagnostics =
      macroInspection?.status === 'completed'
        ? macroInspection.report.findings.map((finding) =>
            mapSeparatedMacroFieldFinding(input, finding),
          )
        : [];
    const mappedValidationDiagnostics = validationDiagnostics.map((diagnostic) =>
      mapAtlasLandWaterValidationDiagnostic(input, diagnostic),
    );
    const diagnostics = orderedAtlasLandWaterDiagnostics([
      ...macroDiagnostics,
      ...generatorDiagnostics,
      ...mappedValidationDiagnostics,
    ]);
    if (await progress.cooperateOnce('validating-proposal', 2, 3, 920, 980)) {
      return atlasLandWaterCancelledResult(input, progress, 'classification');
    }
    if (diagnostics.some(({ severity }) => severity === 'error')) {
      return atlasLandWaterInvalidResult(progress, diagnostics);
    }

    const patch = createAtlasLandWaterProposedPatch(
      input,
      macroParameters,
      classificationParameters,
      records,
      diagnostics,
    );
    if (await progress.cooperateOnce('validating-proposal', 3, 3, 980, 999)) {
      return atlasLandWaterCancelledResult(input, progress, 'classification');
    }
    progress.complete();
    return Object.freeze({
      status: 'proposed-full',
      patch,
      realization: createAtlasLandWaterRealization(
        input.controls.targetWaterCoveragePercent,
        classification.output,
        threshold.selection.proxy.componentCount,
        threshold.selection.proxy.largestComponentPercent,
      ),
      diagnostics,
    });
  } catch {
    return atlasLandWaterInvalidRuntimeResult(input, progress);
  }
}

/** Generate the nested disposable preview; no accepted identity or revision enters its output. */
export async function generateAtlasLandWaterPreview(
  input: AtlasLandWaterGenerationInput,
  runtime: AtlasLandWaterGenerationRuntime,
): Promise<AtlasLandWaterPreviewGenerationResult> {
  const runtimeDiagnostic = validateAtlasLandWaterRuntime(input, runtime);
  if (runtimeDiagnostic !== undefined) {
    return Object.freeze({ status: 'invalid', diagnostics: Object.freeze([runtimeDiagnostic]) });
  }
  const progress = new AtlasLandWaterProgressReporter(
    runtime,
    WORLD_ATLAS_PREVIEW_PROFILE.profileId,
  );

  try {
    progress.report('preparing', 0, 1, 0, 0);
    if (progress.isCancellationRequested()) {
      return atlasLandWaterCancelledResult(input, progress, 'macro');
    }

    const macroParameters = atlasMacroElevationParameters(
      input.controls,
      input.macroElevationFieldBehaviorVersion,
    );
    const classificationParameters = atlasLandWaterClassificationParameters(input.controls);
    const fieldAdapter = createAtlasMacroElevationFieldAdapter(
      macroParameters,
      runtime.macroElevationRandom,
    );
    const sampled = await sampleAtlasMacroElevationField(
      WORLD_ATLAS_PREVIEW_PROFILE,
      fieldAdapter,
      progress.cooperation('sampling-shared-preview-anchors', 0, 450),
    );
    if (sampled.status === 'cancelled') {
      return atlasLandWaterCancelledResult(input, progress, 'macro');
    }

    const threshold = await selectAtlasLandWaterThreshold(
      sampled.field,
      classificationParameters,
      progress.cooperation('selecting-land-water-threshold', 450, 700),
    );
    if (threshold.status === 'cancelled') {
      return atlasLandWaterCancelledResult(input, progress, 'classification');
    }
    const classification = await classifyAtlasLandWater(
      sampled.field,
      threshold.selection.contourLevel,
      input.controls.targetWaterCoveragePercent,
      progress.cooperation('classifying-land-water', 700, 920),
    );
    if (classification.status === 'cancelled') {
      return atlasLandWaterCancelledResult(input, progress, 'classification');
    }

    if (
      await progress.cooperateOnce(
        'validating-proposal',
        input.macroElevationFieldBehaviorVersion === 2 ? 0 : 1,
        1,
        920,
        999,
      )
    ) {
      return atlasLandWaterCancelledResult(input, progress, 'classification');
    }
    const macroInspection =
      input.macroElevationFieldBehaviorVersion === 2
        ? await inspectSeparatedAtlasMacroField(
            fieldAdapter as SeparatedAtlasMacroElevationFieldAdapter,
            sampled.field,
            threshold.selection.contourLevel,
            progress.cooperation('validating-proposal', 920, 999),
          )
        : undefined;
    if (macroInspection?.status === 'cancelled') {
      return atlasLandWaterCancelledResult(input, progress, 'macro');
    }
    const macroDiagnostics =
      macroInspection?.status === 'completed'
        ? macroInspection.report.findings.map((finding) =>
            mapSeparatedMacroFieldFinding(input, finding),
          )
        : [];
    const diagnostics = orderedAtlasLandWaterDiagnostics([
      ...macroDiagnostics,
      ...validateAtlasLandWaterRealization(
        input,
        classificationParameters,
        threshold.selection.isConnectivityProxySupported,
        classification.output.absoluteWaterCoverageErrorBasisPoints,
      ),
    ]);
    if (diagnostics.some(({ severity }) => severity === 'error')) {
      return atlasLandWaterInvalidResult(progress, diagnostics);
    }
    const preview: AtlasLandWaterPreview = Object.freeze({
      previewKind: 'disposable-atlas-land-water',
      previewVersion: ATLAS_LAND_WATER_PREVIEW_VERSION,
      profileId: WORLD_ATLAS_PREVIEW_PROFILE.profileId,
      samplingPolicyVersion: ATLAS_SAMPLING_POLICY_VERSION,
      longitudeCellCount: WORLD_ATLAS_PREVIEW_PROFILE.longitudeCellCount,
      latitudeBandCount: WORLD_ATLAS_PREVIEW_PROFILE.latitudeBandCount,
      canonicalTraversal: ATLAS_CANONICAL_FIELD_TRAVERSAL,
      quantizationScale: ATLAS_FIELD_QUANTIZATION_SCALE,
      authority: 'disposable',
      isPromotable: false,
      controls: input.controls,
      macroElevationValues: sampled.field.copyValues(),
      seaLevelContourDoubledTicks: threshold.selection.contourLevel,
      landWaterSamples: atlasSampleReaderToArray(classification.output.samples),
    });
    progress.complete();
    return Object.freeze({
      status: 'preview',
      preview,
      realization: createAtlasLandWaterRealization(
        input.controls.targetWaterCoveragePercent,
        classification.output,
        threshold.selection.proxy.componentCount,
        threshold.selection.proxy.largestComponentPercent,
      ),
      diagnostics,
    });
  } catch {
    return atlasLandWaterInvalidRuntimeResult(input, progress);
  }
}
