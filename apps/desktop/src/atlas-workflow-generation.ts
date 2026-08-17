/** Production composition of the existing atlas proposal generators and atomic transaction. */

import {
  createAtlasAppearanceSeedInputs,
  generateAtlasAppearance,
  RESTRAINED_INK_ATLAS_STYLE,
} from '@ttrpg-map/assets';
import {
  type AspectReplacementProposal,
  ATLAS_DOCUMENT_COMMAND_KIND,
  type AtlasAppearanceRecords,
  type AtlasControls,
  type AtlasGeographyRecords,
  commitAtlasProposal,
  createDeterministicRandomStream,
  deriveAtlasAspectId,
  deriveAtlasSingletonEntityIds,
  formatWorldSeed,
  parseWorldSeed,
  type RenderScene,
  type WorldDocument,
  type WorldSeed,
} from '@ttrpg-map/core';
import {
  ATLAS_GENERATION_PROGRESS_TOTAL_WORK,
  ATLAS_LAND_WATER_CANCELLATION_VERSION,
  ATLAS_LAND_WATER_PROGRESS_VERSION,
  type AtlasGenerationProgress,
  type AtlasLandWaterPreview,
  createAtlasLandWaterGenerationInput,
  generateAtlasCanonicalCoastline,
  generateAtlasLandWaterFull,
  generateAtlasLandWaterPreview,
  generateAtlasSemanticGeography,
  WORLD_ATLAS_FULL_PROFILE,
} from '@ttrpg-map/generation';
import { composeAtlasRenderScene } from '@ttrpg-map/render';

import {
  appearanceProposal,
  appearanceRevisionsFor,
  ATLAS_PROOF_ROOT_SURFACE_ID,
  ATLAS_PROOF_WORLD_MAP_ID,
  atlasEntities,
  createAtlasShell,
  explicitlyIncrementedIds,
  operationMode,
  requiredAtlasRadius,
  retainedAspectProposal,
  revisionFor,
} from './atlas-workflow-generation-support.js';

export { ATLAS_PROOF_WORLD_MAP_ID } from './atlas-workflow-generation-support.js';

export type AtlasWorkflowOperation =
  'initial-atlas' | 'control-driven-replacement' | 'geography-reroll' | 'appearance-reroll';

export interface AtlasWorkflowGenerationRequest {
  readonly operationId: string;
  readonly operation: AtlasWorkflowOperation;
  readonly worldSeed: string;
  readonly controls: AtlasControls;
  readonly accepted: AcceptedAtlasState | undefined;
}

export interface AtlasWorkflowRuntime {
  readonly isCancellationRequested: () => boolean;
  readonly reportProgress: (progress: AtlasGenerationProgress) => void;
  readonly yieldControl: () => Promise<void>;
}

export interface AcceptedAtlasState {
  readonly document: WorldDocument;
  readonly geography: AtlasGeographyRecords;
  readonly appearance: AtlasAppearanceRecords;
  readonly scene: RenderScene;
}

export type AtlasWorkflowPreviewResult =
  | {
      readonly ok: true;
      readonly preview: AtlasLandWaterPreview;
      readonly diagnosticCodes: readonly string[];
    }
  | AtlasWorkflowGenerationFailure;

export type AtlasWorkflowCommitResult =
  { readonly ok: true; readonly accepted: AcceptedAtlasState } | AtlasWorkflowGenerationFailure;

export interface AtlasWorkflowGenerationFailure {
  readonly ok: false;
  readonly isCancelled: boolean;
  readonly diagnosticCodes: readonly string[];
  readonly message: string;
}

export interface AtlasWorkflowGenerationPort {
  readonly preview: (
    request: AtlasWorkflowGenerationRequest,
    runtime: AtlasWorkflowRuntime,
  ) => Promise<AtlasWorkflowPreviewResult>;
  readonly commit: (
    request: AtlasWorkflowGenerationRequest,
    runtime: AtlasWorkflowRuntime,
  ) => Promise<AtlasWorkflowCommitResult>;
}

export const productionAtlasWorkflowGeneration: AtlasWorkflowGenerationPort = Object.freeze({
  preview: generatePreview,
  commit: generateAndCommit,
});

async function generatePreview(
  request: AtlasWorkflowGenerationRequest,
  runtime: AtlasWorkflowRuntime,
): Promise<AtlasWorkflowPreviewResult> {
  const prepared = prepareInput(request, false);
  if (!prepared.ok) return prepared;
  const result = await generateAtlasLandWaterPreview(
    prepared.input,
    landWaterRuntime(prepared.input, request.operationId, runtime),
  );
  if (result.status !== 'preview') return generatorFailure(result.status, result.diagnostics);
  return Object.freeze({
    ok: true,
    preview: result.preview,
    diagnosticCodes: Object.freeze(result.diagnostics.map(({ code }) => code)),
  });
}

async function generateAndCommit(
  request: AtlasWorkflowGenerationRequest,
  runtime: AtlasWorkflowRuntime,
): Promise<AtlasWorkflowCommitResult> {
  const prepared = prepareInput(request, request.operation === 'geography-reroll');
  if (!prepared.ok) return prepared;
  const previous = request.accepted;
  if (request.operation === 'appearance-reroll') {
    if (previous === undefined) {
      return failure(
        ['atlas.reroll.accepted-required'],
        'An appearance reroll requires an accepted atlas source.',
      );
    }
    await runtime.yieldControl();
    if (runtime.isCancellationRequested()) return cancelled();
    const retainedGeography = previous.document.maps[0]?.aspects
      .filter(({ aspectName }) => !aspectName.startsWith('atlas.'))
      .map(retainedAspectProposal);
    if (retainedGeography === undefined) {
      return failure(['atlas.transaction.source.invalid'], 'The accepted root map is missing.');
    }
    return generateAppearanceAndCommit(
      request,
      prepared,
      previous.geography,
      retainedGeography,
      runtime,
    );
  }
  const full = await generateAtlasLandWaterFull(
    prepared.input,
    landWaterRuntime(prepared.input, request.operationId, runtime, true),
  );
  if (full.status !== 'proposed-full') return generatorFailure(full.status, full.diagnostics);
  if (runtime.isCancellationRequested()) return cancelled();
  reportValidatingProgress(request.operationId, runtime);
  await runtime.yieldControl();

  const semantic = generateAtlasSemanticGeography({
    worldSeed: prepared.worldSeed,
    worldMapId: ATLAS_PROOF_WORLD_MAP_ID,
    worldSurfaceEntityId: prepared.singletonIds.worldSurfaceEntityId,
    landWaterClassificationAspectId: prepared.input.landWaterClassificationAspectId,
    records: full.patch.records,
    ...(previous === undefined ? {} : { previousRecords: previous.geography }),
    previousAcceptedAspects: previous?.document.maps[0]?.aspects ?? [],
  });
  if (semantic.status !== 'proposed') {
    return failure(
      semantic.diagnostics.map(({ code }) => code),
      semantic.diagnostics[0]?.message,
    );
  }
  if (runtime.isCancellationRequested()) return cancelled();
  reportValidatingProgress(request.operationId, runtime);
  await runtime.yieldControl();

  const coastline = generateAtlasCanonicalCoastline({
    worldSeed: prepared.worldSeed,
    worldMapId: ATLAS_PROOF_WORLD_MAP_ID,
    worldCoastlineEntityId: prepared.singletonIds.worldCoastlineEntityId,
    records: semantic.patch.records,
    previousAcceptedAspects: previous?.document.maps[0]?.aspects ?? [],
  });
  if (coastline.status !== 'proposed') {
    return failure(
      coastline.diagnostics.map(({ code }) => code),
      coastline.diagnostics[0]?.message,
    );
  }
  if (runtime.isCancellationRequested()) return cancelled();
  await runtime.yieldControl();

  return generateAppearanceAndCommit(
    request,
    prepared,
    coastline.patch.records,
    Object.freeze([
      ...full.patch.replacements,
      ...semantic.patch.replacements,
      coastline.patch.replacement,
    ]),
    runtime,
  );
}

async function generateAppearanceAndCommit(
  request: AtlasWorkflowGenerationRequest,
  prepared: Extract<ReturnType<typeof prepareInput>, { readonly ok: true }>,
  geography: AtlasGeographyRecords,
  geographyProposals: readonly AspectReplacementProposal[],
  runtime: AtlasWorkflowRuntime,
): Promise<AtlasWorkflowCommitResult> {
  const previous = request.accepted;
  reportValidatingProgress(request.operationId, runtime);
  const appearanceRevisions = appearanceRevisionsFor(request, previous);
  const appearanceInput = Object.freeze({
    worldSeed: prepared.worldSeed,
    worldMapId: ATLAS_PROOF_WORLD_MAP_ID,
    records: geography,
    variantRevisions: appearanceRevisions,
    operationMode:
      request.operation === 'appearance-reroll' ? 'appearance-reroll' : 'initial-appearance',
  } as const);
  const appearanceSeeds = createAtlasAppearanceSeedInputs(appearanceInput);
  const appearance = generateAtlasAppearance(appearanceInput, {
    coastlineAppearanceRandom: deterministicStream(appearanceSeeds.coastlineAppearance),
    waterDecorationRandom: deterministicStream(appearanceSeeds.waterDecoration),
    paperTreatmentRandom: deterministicStream(appearanceSeeds.paperTreatment),
  });
  if (appearance.status !== 'proposed') {
    return failure(
      appearance.diagnostics.map(({ code }) => code),
      appearance.diagnostics[0]?.message,
    );
  }
  if (runtime.isCancellationRequested()) return cancelled();
  await runtime.yieldControl();
  if (runtime.isCancellationRequested()) return cancelled();

  const document = previous?.document ?? createAtlasShell(prepared.worldSeed, request.controls);
  const proposedAspects: readonly AspectReplacementProposal[] = Object.freeze([
    ...geographyProposals,
    ...appearance.patch.replacements.map(appearanceProposal),
  ]);
  const transaction = commitAtlasProposal(document, {
    kind: ATLAS_DOCUMENT_COMMAND_KIND,
    operationMode: operationMode(request.operation),
    targetMapId: ATLAS_PROOF_WORLD_MAP_ID,
    expectedWorldSeed: document.worldSeed,
    expectedAspectRevisions: Object.freeze(
      (document.maps[0]?.aspects ?? []).map(({ aspectId, variantRevision }) =>
        Object.freeze({ aspectId, variantRevision }),
      ),
    ),
    controls: request.controls,
    proposedCoordinateSystem: Object.freeze({
      kind: 'planet-sphere',
      rootSurfaceId: ATLAS_PROOF_ROOT_SURFACE_ID,
      radius: requiredAtlasRadius(request.controls.worldCircumferenceKm),
    }),
    proposedEntities: atlasEntities(prepared.singletonIds, geography),
    proposedAspects,
    explicitlyIncrementedAspectIds: explicitlyIncrementedIds(request, proposedAspects),
  });
  if (!transaction.ok) {
    return failure(
      transaction.diagnostics.map(({ code }) => code),
      transaction.diagnostics[0]?.message,
    );
  }
  const scene = composeAtlasRenderScene(
    geography,
    appearance.patch.appearance,
    RESTRAINED_INK_ATLAS_STYLE,
  );
  if (!scene.ok)
    return failure(
      scene.diagnostics.map(({ code }) => code),
      scene.diagnostics[0]?.message,
    );
  runtime.reportProgress(
    Object.freeze({
      progressVersion: ATLAS_LAND_WATER_PROGRESS_VERSION,
      operationId: request.operationId,
      profileId: WORLD_ATLAS_FULL_PROFILE.profileId,
      stage: 'completed',
      completedWork: ATLAS_GENERATION_PROGRESS_TOTAL_WORK,
      totalWork: ATLAS_GENERATION_PROGRESS_TOTAL_WORK,
      stageCompletedWork: 1,
      stageTotalWork: 1,
      isCancellationRequested: false,
      isTerminal: true,
    }),
  );
  return Object.freeze({
    ok: true,
    accepted: Object.freeze({
      document: transaction.document,
      geography,
      appearance: appearance.patch.appearance,
      scene: scene.value,
    }),
  });
}

function reportValidatingProgress(operationId: string, runtime: AtlasWorkflowRuntime): void {
  runtime.reportProgress(
    Object.freeze({
      progressVersion: ATLAS_LAND_WATER_PROGRESS_VERSION,
      operationId,
      profileId: WORLD_ATLAS_FULL_PROFILE.profileId,
      stage: 'validating-proposal',
      completedWork: ATLAS_GENERATION_PROGRESS_TOTAL_WORK - 1,
      totalWork: ATLAS_GENERATION_PROGRESS_TOTAL_WORK,
      stageCompletedWork: 0,
      stageTotalWork: 1,
      isCancellationRequested: runtime.isCancellationRequested(),
      isTerminal: false,
    }),
  );
}

function prepareInput(
  request: AtlasWorkflowGenerationRequest,
  incrementMacro: boolean,
):
  | {
      readonly ok: true;
      readonly worldSeed: WorldSeed;
      readonly singletonIds: ReturnType<typeof deriveAtlasSingletonEntityIds>;
      readonly input: Extract<
        ReturnType<typeof createAtlasLandWaterGenerationInput>,
        { ok: true }
      >['value'];
    }
  | AtlasWorkflowGenerationFailure {
  const worldSeed = parseWorldSeed(request.worldSeed);
  if (!worldSeed.ok) return failure([worldSeed.diagnostic.code], worldSeed.diagnostic.message);
  const singletonIds = deriveAtlasSingletonEntityIds(ATLAS_PROOF_WORLD_MAP_ID);
  const previousAspects = request.accepted?.document.maps[0]?.aspects ?? [];
  const macro = revisionFor(previousAspects, 'worldTerrain.macroElevation', incrementMacro);
  const partition = revisionFor(previousAspects, 'worldSurface.landWaterClassification', false);
  const input = createAtlasLandWaterGenerationInput({
    worldSeed: formatWorldSeed(worldSeed.value),
    worldMapId: ATLAS_PROOF_WORLD_MAP_ID,
    worldSurfaceEntityId: singletonIds.worldSurfaceEntityId,
    macroElevationAspectId: deriveAtlasAspectId(
      singletonIds.worldSurfaceEntityId,
      'worldTerrain.macroElevation',
    ),
    landWaterClassificationAspectId: deriveAtlasAspectId(
      singletonIds.worldSurfaceEntityId,
      'worldSurface.landWaterClassification',
    ),
    macroElevationVariantRevision: macro,
    landWaterClassificationVariantRevision: partition,
    controls: request.controls,
  });
  if (!input.ok)
    return failure(
      input.diagnostics.map(({ code }) => code),
      input.diagnostics[0]?.message,
    );
  return { ok: true, worldSeed: worldSeed.value, singletonIds, input: input.value };
}

function landWaterRuntime(
  input: Extract<ReturnType<typeof createAtlasLandWaterGenerationInput>, { ok: true }>['value'],
  operationId: string,
  runtime: AtlasWorkflowRuntime,
  suppressCompleted = false,
) {
  return Object.freeze({
    operationId,
    macroElevationRandom: deterministicStream(input.macroElevationSeedMetadata),
    landWaterClassificationRandom: deterministicStream(input.landWaterClassificationSeedMetadata),
    cancellation: Object.freeze({
      cancellationVersion: ATLAS_LAND_WATER_CANCELLATION_VERSION,
      isCancellationRequested: runtime.isCancellationRequested,
    }),
    reportProgress: (progress: AtlasGenerationProgress) => {
      runtime.reportProgress(
        suppressCompleted && progress.stage === 'completed'
          ? Object.freeze({
              ...progress,
              stage: 'validating-proposal',
              completedWork: progress.totalWork - 1,
              isTerminal: false,
            })
          : progress,
      );
    },
    yieldControl: runtime.yieldControl,
  });
}

function deterministicStream(seed: Parameters<typeof createDeterministicRandomStream>[0]) {
  const result = createDeterministicRandomStream(seed);
  if (!result.ok) throw new Error(result.diagnostic.message);
  return result.value;
}

function generatorFailure(
  status: 'cancelled' | 'invalid',
  diagnostics: readonly { readonly code: string; readonly message: string }[],
): AtlasWorkflowGenerationFailure {
  return status === 'cancelled'
    ? cancelled(diagnostics.map(({ code }) => code))
    : failure(
        diagnostics.map(({ code }) => code),
        diagnostics[0]?.message,
      );
}

function cancelled(
  codes: readonly string[] = ['atlas.operation.cancelled'],
): AtlasWorkflowGenerationFailure {
  return Object.freeze({
    ok: false,
    isCancelled: true,
    diagnosticCodes: Object.freeze([...codes]),
    message: 'The atlas operation was cancelled; accepted state is unchanged.',
  });
}

function failure(codes: readonly string[], message = 'Atlas generation failed validation.') {
  return Object.freeze({
    ok: false as const,
    isCancelled: false,
    diagnosticCodes: Object.freeze([...codes]),
    message,
  });
}
