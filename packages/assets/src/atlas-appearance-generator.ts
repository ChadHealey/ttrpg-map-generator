/** Independently seeded accepted appearance proposals for the Milestone 2 atlas. */

import {
  type AspectId,
  type AspectName,
  ATLAS_ASPECT_DEFINITIONS,
  ATLAS_COASTLINE_APPEARANCE_BEHAVIOR_VERSION,
  ATLAS_PAPER_TREATMENT_BEHAVIOR_VERSION,
  ATLAS_WATER_DECORATION_BEHAVIOR_VERSION,
  type AtlasAppearanceRecords,
  type AtlasCoastlineAppearance,
  type AtlasCoastlineInkDecision,
  type AtlasGeographyRecords,
  type AtlasPaperTreatment,
  type AtlasStyleProvenance,
  type AtlasWaterDecoration,
  createVariantRevision,
  deriveAtlasAspectId,
  deriveAtlasSingletonEntityIds,
  DETERMINISTIC_STREAM_VERSION,
  type DeterministicRandomStream,
  type EntityId,
  formatWorldSeed,
  type GeneratorId,
  type MapEntitySeedInput,
  type MapId,
  parseSeedInput,
  SEED_DERIVATION_VERSION,
  type VariantRevision,
  type WorldSeed,
} from '@ttrpg-map/core';

import { createAtlasWaterDecorationPaths } from './atlas-water-decoration.js';
import { RESTRAINED_INK_ATLAS_STYLE } from './restrained-ink-atlas-style.js';

export const ATLAS_APPEARANCE_GENERATOR_MANIFEST_VERSION = 1 as const;
export const ATLAS_APPEARANCE_PARAMETER_SCHEMA_VERSION = 1 as const;

export const ATLAS_APPEARANCE_DIAGNOSTIC_CODES = Object.freeze({
  invalidSource: 'atlas-appearance.source.invalid',
  invalidOutput: 'atlas-appearance.output.invalid',
} as const);

export type AtlasAppearanceDiagnosticCode =
  (typeof ATLAS_APPEARANCE_DIAGNOSTIC_CODES)[keyof typeof ATLAS_APPEARANCE_DIAGNOSTIC_CODES];

export interface AtlasAppearanceDiagnostic {
  readonly code: AtlasAppearanceDiagnosticCode;
  readonly message: string;
  readonly suggestedAction: string;
}

export interface AtlasAppearanceVariantRevisions {
  readonly coastlineAppearance: VariantRevision;
  readonly waterDecoration: VariantRevision;
  readonly paperTreatment: VariantRevision;
}

export interface AtlasAppearanceGenerationInput {
  readonly worldSeed: WorldSeed;
  readonly worldMapId: MapId;
  readonly records: AtlasGeographyRecords;
  readonly variantRevisions: AtlasAppearanceVariantRevisions;
  readonly operationMode: 'initial-appearance' | 'appearance-reroll';
}

export interface AtlasAppearanceGenerationRuntime {
  readonly coastlineAppearanceRandom: DeterministicRandomStream;
  readonly waterDecorationRandom: DeterministicRandomStream;
  readonly paperTreatmentRandom: DeterministicRandomStream;
}

export interface AtlasAppearanceAspectProposal<Output> {
  readonly target: Readonly<{
    mapId: MapId;
    entityId: EntityId;
    aspectId: AspectId;
    aspectName: AspectName;
    variantRevision: VariantRevision;
  }>;
  readonly generatorId: GeneratorId;
  readonly generatorVersion: 1;
  readonly parameterSchemaVersion: typeof ATLAS_APPEARANCE_PARAMETER_SCHEMA_VERSION;
  readonly seedMetadata: MapEntitySeedInput;
  readonly dependencyAspectIds: readonly AspectId[];
  readonly output: Output;
}

export interface AtlasAppearanceProposedPatch {
  readonly patchKind: 'replace-atlas-appearance';
  readonly operationMode: AtlasAppearanceGenerationInput['operationMode'];
  readonly appearance: AtlasAppearanceRecords;
  readonly replacements: readonly AtlasAppearanceAspectProposal<unknown>[];
  readonly explicitlyIncrementedAspectIds: readonly AspectId[];
}

export type AtlasAppearanceGenerationResult =
  | { readonly status: 'proposed'; readonly patch: AtlasAppearanceProposedPatch }
  | { readonly status: 'invalid'; readonly diagnostics: readonly AtlasAppearanceDiagnostic[] };

export const ATLAS_APPEARANCE_GENERATOR_MANIFESTS = Object.freeze({
  coastlineAppearance: manifest('atlas.coastlineAppearance', ['worldCoastline.geometry']),
  waterDecoration: manifest('atlas.waterDecoration', [
    'worldSurface.landWaterClassification',
    'waterBody.classification',
    'worldCoastline.geometry',
  ]),
  paperTreatment: manifest('atlas.paperTreatment', []),
});

/** Build the three complete map/entity seed namespaces without sharing a sequential stream. */
export function createAtlasAppearanceSeedInputs(input: AtlasAppearanceGenerationInput): Readonly<{
  coastlineAppearance: MapEntitySeedInput;
  waterDecoration: MapEntitySeedInput;
  paperTreatment: MapEntitySeedInput;
}> {
  const presentationId = deriveAtlasSingletonEntityIds(input.worldMapId).atlasPresentationEntityId;
  return Object.freeze({
    coastlineAppearance: seedInput(
      input,
      presentationId,
      'atlas.coastlineAppearance',
      input.variantRevisions.coastlineAppearance,
    ),
    waterDecoration: seedInput(
      input,
      presentationId,
      'atlas.waterDecoration',
      input.variantRevisions.waterDecoration,
    ),
    paperTreatment: seedInput(
      input,
      presentationId,
      'atlas.paperTreatment',
      input.variantRevisions.paperTreatment,
    ),
  });
}

/** Generate a complete immutable appearance proposal from accepted geography and explicit streams. */
export function generateAtlasAppearance(
  input: AtlasAppearanceGenerationInput,
  runtime: AtlasAppearanceGenerationRuntime,
): AtlasAppearanceGenerationResult {
  const sourceDiagnostic = validateSource(input);
  if (sourceDiagnostic !== undefined) return invalid(sourceDiagnostic);

  const presentationId = deriveAtlasSingletonEntityIds(input.worldMapId).atlasPresentationEntityId;
  const seeds = createAtlasAppearanceSeedInputs(input);
  const style = styleProvenance();
  const coastlineAppearance = generateCoastlineAppearance(
    input.records,
    runtime.coastlineAppearanceRandom,
    style,
  );
  const waterDecoration: AtlasWaterDecoration = Object.freeze({
    decorationBehaviorVersion: ATLAS_WATER_DECORATION_BEHAVIOR_VERSION,
    style,
    paths: createAtlasWaterDecorationPaths(input.records, runtime.waterDecorationRandom),
  });
  const paperTreatment = generatePaperTreatment(runtime.paperTreatmentRandom, style);
  const appearance: AtlasAppearanceRecords = Object.freeze({
    atlasPresentationEntityId: presentationId,
    coastlineAppearance,
    waterDecoration,
    paperTreatment,
  });
  const outputDiagnostic = validateOutput(input.records, appearance);
  if (outputDiagnostic !== undefined) return invalid(outputDiagnostic);

  const replacements = Object.freeze(
    [
      proposal(
        input,
        presentationId,
        'atlas.coastlineAppearance',
        seeds.coastlineAppearance,
        coastlineDependencies(input.worldMapId),
        coastlineAppearance,
      ),
      proposal(
        input,
        presentationId,
        'atlas.paperTreatment',
        seeds.paperTreatment,
        Object.freeze([]),
        paperTreatment,
      ),
      proposal(
        input,
        presentationId,
        'atlas.waterDecoration',
        seeds.waterDecoration,
        waterDependencies(input.records, input.worldMapId),
        waterDecoration,
      ),
    ].sort((left, right) => compareText(left.target.aspectId, right.target.aspectId)),
  );
  const explicitlyIncrementedAspectIds =
    input.operationMode === 'appearance-reroll'
      ? Object.freeze(replacements.map(({ target }) => target.aspectId).sort(compareText))
      : Object.freeze([] as AspectId[]);

  return Object.freeze({
    status: 'proposed',
    patch: Object.freeze({
      patchKind: 'replace-atlas-appearance',
      operationMode: input.operationMode,
      appearance,
      replacements,
      explicitlyIncrementedAspectIds,
    }),
  });
}

/** Canonical revision zero for initial appearance generation. */
export function createInitialAtlasAppearanceRevisions(): AtlasAppearanceVariantRevisions {
  const revision = createVariantRevision(0);
  if (!revision.ok) throw new Error('Atlas appearance revision zero is invalid.');
  return Object.freeze({
    coastlineAppearance: revision.value,
    waterDecoration: revision.value,
    paperTreatment: revision.value,
  });
}

function generateCoastlineAppearance(
  records: AtlasGeographyRecords,
  random: DeterministicRandomStream,
  style: AtlasStyleProvenance,
): AtlasCoastlineAppearance {
  const ringDecisions: AtlasCoastlineInkDecision[] = [...records.coastline.rings]
    .sort((left, right) => compareText(left.ringId, right.ringId))
    .map((ring) =>
      Object.freeze({
        sourceRingId: ring.ringId,
        sourceBoundaryFingerprint: ring.sourceBoundaryFingerprint,
        wobblePhasePermille: random.nextInt(1_000),
        wobbleStrengthPermille: 680 + random.nextInt(321),
        secondaryPhasePermille: random.nextInt(1_000),
        pressurePhasePermille: random.nextInt(1_000),
        pressureStrengthPermille: 620 + random.nextInt(381),
      }),
    );
  return Object.freeze({
    appearanceBehaviorVersion: ATLAS_COASTLINE_APPEARANCE_BEHAVIOR_VERSION,
    style,
    ringDecisions: Object.freeze(ringDecisions),
  });
}

function generatePaperTreatment(
  random: DeterministicRandomStream,
  style: AtlasStyleProvenance,
): AtlasPaperTreatment {
  return Object.freeze({
    treatmentBehaviorVersion: ATLAS_PAPER_TREATMENT_BEHAVIOR_VERSION,
    style,
    grainPhaseXPermille: random.nextInt(1_000),
    grainPhaseYPermille: random.nextInt(1_000),
    grainAnglePermille: random.nextInt(1_000),
    grainDensityPermille: 760 + random.nextInt(181),
    grainLengthPermille: 820 + random.nextInt(181),
  });
}

function proposal<Output>(
  input: AtlasAppearanceGenerationInput,
  presentationId: EntityId,
  kind: 'atlas.coastlineAppearance' | 'atlas.paperTreatment' | 'atlas.waterDecoration',
  seedMetadata: MapEntitySeedInput,
  dependencyAspectIds: readonly AspectId[],
  output: Output,
): AtlasAppearanceAspectProposal<Output> {
  const definition = aspectDefinition(kind);
  return Object.freeze({
    target: Object.freeze({
      mapId: input.worldMapId,
      entityId: presentationId,
      aspectId: deriveAtlasAspectId(presentationId, kind),
      aspectName: definition.aspectName,
      variantRevision: seedMetadata.variantRevision,
    }),
    generatorId: definition.generatorId,
    generatorVersion: 1,
    parameterSchemaVersion: ATLAS_APPEARANCE_PARAMETER_SCHEMA_VERSION,
    seedMetadata,
    dependencyAspectIds,
    output,
  });
}

function coastlineDependencies(mapId: MapId): readonly AspectId[] {
  const coastlineId = deriveAtlasSingletonEntityIds(mapId).worldCoastlineEntityId;
  return Object.freeze([deriveAtlasAspectId(coastlineId, 'worldCoastline.geometry')]);
}

function waterDependencies(records: AtlasGeographyRecords, mapId: MapId): readonly AspectId[] {
  const singletonIds = deriveAtlasSingletonEntityIds(mapId);
  return Object.freeze(
    [
      records.landWaterClassificationAspectId,
      deriveAtlasAspectId(singletonIds.worldCoastlineEntityId, 'worldCoastline.geometry'),
      ...records.waterBodies.map(({ entityId }) =>
        deriveAtlasAspectId(entityId, 'waterBody.classification'),
      ),
    ].sort(compareText),
  );
}

function seedInput(
  input: AtlasAppearanceGenerationInput,
  presentationId: EntityId,
  kind: 'atlas.coastlineAppearance' | 'atlas.paperTreatment' | 'atlas.waterDecoration',
  variantRevision: VariantRevision,
): MapEntitySeedInput {
  const definition = aspectDefinition(kind);
  const parsed = parseSeedInput({
    seedDerivationVersion: SEED_DERIVATION_VERSION,
    deterministicStreamVersion: DETERMINISTIC_STREAM_VERSION,
    seedScope: 'map/entity',
    worldSeed: formatWorldSeed(input.worldSeed),
    generatorId: definition.generatorId,
    generatorVersion: 1,
    aspectName: definition.aspectName,
    variantRevision,
    mapId: input.worldMapId,
    entityId: presentationId,
  });
  if (!parsed.ok || parsed.value.seedScope !== 'map/entity') {
    throw new Error('Atlas appearance metadata did not produce a map/entity seed namespace.');
  }
  return parsed.value;
}

function validateSource(
  input: AtlasAppearanceGenerationInput,
): AtlasAppearanceDiagnostic | undefined {
  if (input.records.worldMapId !== input.worldMapId) {
    return diagnostic('Appearance input world-map identity does not match accepted geography.');
  }
  const singletonIds = deriveAtlasSingletonEntityIds(input.worldMapId);
  if (input.records.worldSurfaceEntityId !== singletonIds.worldSurfaceEntityId) {
    return diagnostic('Appearance input has an inconsistent world-surface owner.');
  }
  if (
    new Set(input.records.coastline.rings.map(({ ringId }) => ringId)).size !==
      input.records.coastline.rings.length ||
    new Set(input.records.waterBodies.map(({ entityId }) => entityId)).size !==
      input.records.waterBodies.length
  ) {
    return diagnostic('Appearance input source identities must be unique.');
  }
  return undefined;
}

function validateOutput(
  records: AtlasGeographyRecords,
  appearance: AtlasAppearanceRecords,
): AtlasAppearanceDiagnostic | undefined {
  const decisions = appearance.coastlineAppearance.ringDecisions;
  const decisionByRing = new Map(decisions.map((decision) => [decision.sourceRingId, decision]));
  if (
    decisionByRing.size !== decisions.length ||
    decisions.length !== records.coastline.rings.length
  ) {
    return outputDiagnostic('Coastline appearance must contain exactly one decision per ring.');
  }
  for (const ring of records.coastline.rings) {
    const decision = decisionByRing.get(ring.ringId);
    if (decision?.sourceBoundaryFingerprint !== ring.sourceBoundaryFingerprint) {
      return outputDiagnostic('Coastline appearance lost canonical ring provenance.');
    }
  }
  const paths = appearance.waterDecoration.paths;
  if (
    new Set(paths.map(({ decorationId }) => decorationId)).size !== paths.length ||
    !paths.some(({ kind }) => kind === 'coastal-echo') ||
    !paths.some(({ kind }) => kind === 'water-mark') ||
    paths.some(({ points }) => points.length < 2)
  ) {
    return outputDiagnostic('Water decoration must contain unique valid echoes and water marks.');
  }
  return undefined;
}

function styleProvenance(): AtlasStyleProvenance {
  return Object.freeze({
    styleId: RESTRAINED_INK_ATLAS_STYLE.styleId,
    styleBehaviorVersion: RESTRAINED_INK_ATLAS_STYLE.styleBehaviorVersion,
  });
}

function manifest(
  outputAspect: 'atlas.coastlineAppearance' | 'atlas.paperTreatment' | 'atlas.waterDecoration',
  inputAspects: readonly string[],
) {
  return Object.freeze({
    manifestVersion: ATLAS_APPEARANCE_GENERATOR_MANIFEST_VERSION,
    generatorId: outputAspect,
    generatorVersion: 1,
    parameterSchemaVersion: ATLAS_APPEARANCE_PARAMETER_SCHEMA_VERSION,
    inputAspects: Object.freeze(inputAspects),
    outputAspect,
    seedScope: 'map/entity',
    styleId: RESTRAINED_INK_ATLAS_STYLE.styleId,
    styleBehaviorVersion: RESTRAINED_INK_ATLAS_STYLE.styleBehaviorVersion,
  });
}

function aspectDefinition(
  kind: 'atlas.coastlineAppearance' | 'atlas.paperTreatment' | 'atlas.waterDecoration',
) {
  const definition = ATLAS_ASPECT_DEFINITIONS.find((candidate) => candidate.kind === kind);
  if (definition === undefined) throw new Error(`Missing ${kind} aspect definition.`);
  return definition;
}

function invalid(diagnosticValue: AtlasAppearanceDiagnostic): {
  readonly status: 'invalid';
  readonly diagnostics: readonly AtlasAppearanceDiagnostic[];
} {
  return Object.freeze({ status: 'invalid', diagnostics: Object.freeze([diagnosticValue]) });
}

function diagnostic(message: string): AtlasAppearanceDiagnostic {
  return Object.freeze({
    code: ATLAS_APPEARANCE_DIAGNOSTIC_CODES.invalidSource,
    message,
    suggestedAction: 'Restore or regenerate accepted atlas geography before styling it.',
  });
}

function outputDiagnostic(message: string): AtlasAppearanceDiagnostic {
  return Object.freeze({
    code: ATLAS_APPEARANCE_DIAGNOSTIC_CODES.invalidOutput,
    message,
    suggestedAction: 'Reject the appearance proposal and inspect its deterministic inputs.',
  });
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
