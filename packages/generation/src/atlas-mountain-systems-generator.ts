/** Deterministic broad mountain-system proposals from accepted M2 world fields. */

import {
  type AspectId,
  type AtlasLandWaterRecords,
  compareStableReferences,
  createBehaviorVersion,
  createDeterministicRandomStream,
  createElevationTicks,
  createParameterSchemaVersion,
  createPhysicalDistance,
  deriveAtlasAspectId,
  deriveWorldPhysicalContextAspectId,
  deriveWorldPhysicalFeatureEntityId,
  type DeterministicRandomStream,
  type EntityId,
  fingerprintWorldPhysicalRootSignature,
  formatWorldSeed,
  type GenerationDiagnostic,
  type MapEntitySeedInput,
  type MapId,
  type MountainCharacter,
  type MountainSystem,
  type MountainSystems,
  parseAspectName,
  parseGenerationDiagnosticCode,
  parseGeneratorId,
  parseSeedInput,
  roundTiesAwayFromZero,
  validateAtlasLandWaterRecords,
  type VariantRevision,
  WORLD_PHYSICAL_FEATURE_BEHAVIOR_VERSION,
  WORLD_PHYSICAL_GEOMETRY_VERSION,
  type WorldSeed,
} from '@ttrpg-map/core';

import {
  getAtlasGridVertex,
  getAtlasSampleStorageIndex,
  WORLD_ATLAS_FULL_PROFILE,
} from './atlas-sampling-profiles.js';
import type { GenerationProposal } from './generator-contracts.js';

export const ATLAS_MOUNTAIN_SYSTEMS_GENERATOR_MANIFEST_VERSION = 1 as const;
export const ATLAS_MOUNTAIN_SYSTEMS_PARAMETER_SCHEMA_VERSION = 1 as const;

export const ATLAS_MOUNTAIN_SYSTEMS_DIAGNOSTIC_CODES = Object.freeze({
  inputInvalid: 'atlas.mountain-systems.input-invalid',
  invariantInvalid: 'atlas.mountain-systems.invariant-invalid',
  sourceInvalid: 'atlas.mountain-systems.source-invalid',
} as const);

export interface AtlasMountainSystemsParameters {
  readonly parameterSchemaVersion: typeof ATLAS_MOUNTAIN_SYSTEMS_PARAMETER_SCHEMA_VERSION;
  readonly ridgeGeometryVersion: typeof WORLD_PHYSICAL_GEOMETRY_VERSION;
  readonly mountainCharacter: MountainCharacter;
}

export const ATLAS_MOUNTAIN_SYSTEMS_GENERATOR_MANIFEST = Object.freeze({
  manifestVersion: ATLAS_MOUNTAIN_SYSTEMS_GENERATOR_MANIFEST_VERSION,
  generatorId: 'worldTerrain.mountainSystems',
  generatorVersion: WORLD_PHYSICAL_FEATURE_BEHAVIOR_VERSION,
  parameterSchemaVersion: ATLAS_MOUNTAIN_SYSTEMS_PARAMETER_SCHEMA_VERSION,
  inputAspects: Object.freeze([
    'worldTerrain.macroElevation',
    'worldSurface.landWaterClassification',
  ] as const),
  outputAspect: 'worldTerrain.mountainSystems',
  seedScope: 'map/entity',
  diagnostics: ATLAS_MOUNTAIN_SYSTEMS_DIAGNOSTIC_CODES,
});

export interface AtlasMountainSystemsGenerationInput {
  readonly worldSeed: WorldSeed;
  readonly worldMapId: MapId;
  readonly worldSurfaceEntityId: EntityId;
  readonly macroElevationAspectId: AspectId;
  readonly landWaterClassificationAspectId: AspectId;
  readonly mountainSystemsVariantRevision: VariantRevision;
  readonly mountainCharacter: MountainCharacter;
  readonly records: AtlasLandWaterRecords;
}

export type AtlasMountainSystemsAspectProposal = GenerationProposal<
  AtlasMountainSystemsParameters,
  MountainSystems,
  MapEntitySeedInput
>;

export type AtlasMountainSystemsGenerationResult =
  | { readonly status: 'proposed'; readonly proposal: AtlasMountainSystemsAspectProposal }
  | { readonly status: 'invalid'; readonly diagnostics: readonly GenerationDiagnostic[] };

interface Candidate {
  readonly elevation: number;
  readonly longitudeIndex: number;
  readonly latitudeIndex: number;
}

const CANDIDATE_STEP = 16;
const RIDGE_HALF_LENGTH = 8;
const MINIMUM_SYSTEM_SEPARATION = 128;
const ASPECT_NAME = required(parseAspectName('worldTerrain.mountainSystems'));
const GENERATOR_ID = required(parseGeneratorId('worldTerrain.mountainSystems'));
const GENERATOR_VERSION = required(createBehaviorVersion(WORLD_PHYSICAL_FEATURE_BEHAVIOR_VERSION));
const PARAMETER_SCHEMA_VERSION = required(
  createParameterSchemaVersion(ATLAS_MOUNTAIN_SYSTEMS_PARAMETER_SCHEMA_VERSION),
);

/** Propose one uncommitted world-surface mountain-systems aspect; document integration is #138. */
export function generateAtlasMountainSystems(
  input: AtlasMountainSystemsGenerationInput,
): AtlasMountainSystemsGenerationResult {
  const sourceDiagnostics = validateInput(input);
  if (sourceDiagnostics.length > 0) return invalid(sourceDiagnostics);

  const mountainSystemsAspectId = deriveWorldPhysicalContextAspectId(
    input.worldSurfaceEntityId,
    'worldTerrain.mountainSystems',
  );
  const seedMetadata = createSeedMetadata(input, mountainSystemsAspectId);
  const stream = createDeterministicRandomStream(seedMetadata);
  if (!stream.ok) {
    return invalid([
      diagnostic(
        ATLAS_MOUNTAIN_SYSTEMS_DIAGNOSTIC_CODES.inputInvalid,
        input.macroElevationAspectId,
        'Mountain generation could not create its declared map/entity deterministic stream.',
        'Restore the declared version-1 world seed and aspect revision before retrying.',
      ),
    ]);
  }

  const systems = selectSystems(input, stream.value);
  const expectedCount = systemCount(input.mountainCharacter);
  if (systems.length !== expectedCount) {
    return invalid([
      diagnostic(
        ATLAS_MOUNTAIN_SYSTEMS_DIAGNOSTIC_CODES.invariantInvalid,
        mountainSystemsAspectId,
        'Accepted land samples do not contain enough separated ridge centerlines for the selected mountain character.',
        'Reject this proposal; do not repair or move ridge geometry outside accepted land samples.',
      ),
    ]);
  }
  const sourceAspectIds = [
    input.macroElevationAspectId,
    input.landWaterClassificationAspectId,
  ].sort(compareStableReferences);
  const output: MountainSystems = Object.freeze({
    ownerAspectId: mountainSystemsAspectId,
    sourceAspectIds: Object.freeze(sourceAspectIds),
    systems: Object.freeze(
      systems.sort((left, right) => compareStableReferences(left.entityId, right.entityId)),
    ),
  });
  const parameters: AtlasMountainSystemsParameters = Object.freeze({
    parameterSchemaVersion: ATLAS_MOUNTAIN_SYSTEMS_PARAMETER_SCHEMA_VERSION,
    ridgeGeometryVersion: WORLD_PHYSICAL_GEOMETRY_VERSION,
    mountainCharacter: input.mountainCharacter,
  });
  return Object.freeze({
    status: 'proposed',
    proposal: Object.freeze({
      status: 'proposed',
      target: Object.freeze({
        mapId: input.worldMapId,
        entityId: input.worldSurfaceEntityId,
        aspect: Object.freeze({ aspectId: mountainSystemsAspectId }),
        aspectName: ASPECT_NAME,
        variantRevision: input.mountainSystemsVariantRevision,
      }),
      generatorId: GENERATOR_ID,
      generatorVersion: GENERATOR_VERSION,
      parameterSchemaVersion: PARAMETER_SCHEMA_VERSION,
      parameters,
      seedScope: 'map/entity',
      seedMetadata,
      dependencyAspects: Object.freeze(
        sourceAspectIds.map((aspectId) => Object.freeze({ aspectId })),
      ),
      output,
      diagnostics: Object.freeze([]),
    }),
  });
}

function validateInput(
  input: AtlasMountainSystemsGenerationInput,
): readonly GenerationDiagnostic[] {
  const expectedMacro = deriveAtlasAspectId(
    input.worldSurfaceEntityId,
    'worldTerrain.macroElevation',
  );
  const expectedLandWater = deriveAtlasAspectId(
    input.worldSurfaceEntityId,
    'worldSurface.landWaterClassification',
  );
  if (
    input.macroElevationAspectId !== expectedMacro ||
    input.landWaterClassificationAspectId !== expectedLandWater ||
    !['low', 'varied', 'rugged'].includes(input.mountainCharacter)
  ) {
    return Object.freeze([
      diagnostic(
        ATLAS_MOUNTAIN_SYSTEMS_DIAGNOSTIC_CODES.inputInvalid,
        input.macroElevationAspectId,
        'Mountain generation requires canonical world-surface aspect IDs and a supported mountain character.',
        'Rebuild input from accepted map records and the validated physical-context controls.',
      ),
    ]);
  }
  const source = validateAtlasLandWaterRecords(input.records);
  if (source.length === 0) return Object.freeze([]);
  return Object.freeze([
    diagnostic(
      ATLAS_MOUNTAIN_SYSTEMS_DIAGNOSTIC_CODES.sourceInvalid,
      input.macroElevationAspectId,
      `Mountain generation requires valid accepted M2 field records (${source[0]?.code ?? 'unknown'}).`,
      'Restore or regenerate the upstream macro-elevation and land/water proposal before retrying.',
    ),
  ]);
}

function selectSystems(
  input: AtlasMountainSystemsGenerationInput,
  stream: DeterministicRandomStream,
): MountainSystem[] {
  const candidates = collectCandidates(input.records);
  const systems: MountainSystem[] = [];
  for (const candidate of candidates) {
    if (
      systems.some((system) => {
        const root = system.centerlines[0]?.[1];
        if (root === undefined) return false;
        const candidatePoint = getAtlasGridVertex(
          WORLD_ATLAS_FULL_PROFILE,
          candidate.longitudeIndex,
          candidate.latitudeIndex,
        );
        const longitudeDistance = Math.abs(root.longitudeTicks - candidatePoint.longitudeTicks);
        const wrappedLongitudeDistance = Math.min(longitudeDistance, 2 ** 32 - longitudeDistance);
        return (
          Math.abs(root.latitudeTicks - candidatePoint.latitudeTicks) <
            (MINIMUM_SYSTEM_SEPARATION * 2 ** 31) / WORLD_ATLAS_FULL_PROFILE.latitudeBandCount &&
          wrappedLongitudeDistance <
            (MINIMUM_SYSTEM_SEPARATION * 2 ** 32) / WORLD_ATLAS_FULL_PROFILE.longitudeCellCount
        );
      })
    ) {
      continue;
    }
    const centerline = ridgeAt(input.records, candidate, stream.nextInt(4));
    if (centerline === undefined) continue;
    const entityId = deriveWorldPhysicalFeatureEntityId(
      input.worldMapId,
      'mountain-system',
      fingerprintWorldPhysicalRootSignature(centerline),
    );
    const influenceWidth = required(createPhysicalDistance(influenceWidthMillimeters(input)));
    const prominence = createElevationTicks(
      controlledProminence(candidate.elevation, input.mountainCharacter),
    );
    if (prominence === undefined) continue;
    systems.push(
      Object.freeze({
        entityId,
        behaviorVersion: WORLD_PHYSICAL_FEATURE_BEHAVIOR_VERSION,
        geometryVersion: WORLD_PHYSICAL_GEOMETRY_VERSION,
        centerlines: Object.freeze([Object.freeze(centerline)]),
        influenceWidth,
        prominence,
        boundaryPortalIds: Object.freeze([]),
      }),
    );
    if (systems.length === systemCount(input.mountainCharacter)) break;
  }
  return systems;
}

function collectCandidates(records: AtlasLandWaterRecords): Candidate[] {
  const candidates: Candidate[] = [];
  for (
    let latitudeIndex = CANDIDATE_STEP;
    latitudeIndex < WORLD_ATLAS_FULL_PROFILE.latitudeBandCount;
    latitudeIndex += CANDIDATE_STEP
  ) {
    for (
      let longitudeIndex = 0;
      longitudeIndex < WORLD_ATLAS_FULL_PROFILE.longitudeCellCount;
      longitudeIndex += CANDIDATE_STEP
    ) {
      const index = getAtlasSampleStorageIndex(
        WORLD_ATLAS_FULL_PROFILE,
        longitudeIndex,
        latitudeIndex,
      );
      if (records.landWaterClassification.samples.at(index) !== 'land') continue;
      const elevation = records.macroElevation.values.at(index);
      if (elevation === undefined) continue;
      candidates.push(Object.freeze({ elevation, longitudeIndex, latitudeIndex }));
    }
  }
  return candidates.sort(
    (left, right) =>
      right.elevation - left.elevation ||
      left.longitudeIndex - right.longitudeIndex ||
      left.latitudeIndex - right.latitudeIndex,
  );
}

function ridgeAt(
  records: AtlasLandWaterRecords,
  candidate: Candidate,
  orientation: number,
): readonly ReturnType<typeof getAtlasGridVertex>[] | undefined {
  const direction =
    orientation === 0
      ? ([1, 0] as const)
      : orientation === 1
        ? ([0, 1] as const)
        : orientation === 2
          ? ([1, 1] as const)
          : ([1, -1] as const);
  const pointsByOffset = new Map<number, ReturnType<typeof getAtlasGridVertex>>();
  for (let offset = -RIDGE_HALF_LENGTH; offset <= RIDGE_HALF_LENGTH; offset += 1) {
    const longitudeIndex = wrapLongitude(candidate.longitudeIndex + offset * direction[0]);
    const latitudeIndex = candidate.latitudeIndex + offset * direction[1];
    if (latitudeIndex <= 0 || latitudeIndex >= WORLD_ATLAS_FULL_PROFILE.latitudeBandCount) {
      return undefined;
    }
    const index = getAtlasSampleStorageIndex(
      WORLD_ATLAS_FULL_PROFILE,
      longitudeIndex,
      latitudeIndex,
    );
    if (records.landWaterClassification.samples.at(index) !== 'land') return undefined;
    pointsByOffset.set(
      offset,
      getAtlasGridVertex(WORLD_ATLAS_FULL_PROFILE, longitudeIndex, latitudeIndex),
    );
  }
  const centerline = [-RIDGE_HALF_LENGTH, 0, RIDGE_HALF_LENGTH].map((offset) =>
    pointsByOffset.get(offset),
  );
  return centerline.some((point) => point === undefined)
    ? undefined
    : (centerline as readonly ReturnType<typeof getAtlasGridVertex>[]);
}

function createSeedMetadata(
  input: AtlasMountainSystemsGenerationInput,
  aspectId: AspectId,
): MapEntitySeedInput {
  const parsed = parseSeedInput({
    seedDerivationVersion: 1,
    deterministicStreamVersion: 1,
    seedScope: 'map/entity',
    worldSeed: formatWorldSeed(input.worldSeed),
    generatorId: GENERATOR_ID,
    generatorVersion: GENERATOR_VERSION,
    aspectName: ASPECT_NAME,
    variantRevision: input.mountainSystemsVariantRevision,
    mapId: input.worldMapId,
    entityId: input.worldSurfaceEntityId,
  });
  if (!parsed.ok || parsed.value.seedScope !== 'map/entity') {
    throw new Error(`Mountain seed metadata is invalid for aspect ${aspectId}.`);
  }
  return parsed.value;
}

function systemCount(character: MountainCharacter): number {
  return character === 'low' ? 1 : character === 'varied' ? 2 : 3;
}

function influenceWidthMillimeters(input: AtlasMountainSystemsGenerationInput): number {
  const kilometers =
    input.mountainCharacter === 'low' ? 180 : input.mountainCharacter === 'varied' ? 260 : 360;
  return kilometers * 1_000_000;
}

/** Mountain character changes accepted broad prominence, never the upstream macro-elevation field. */
function controlledProminence(elevation: number, character: MountainCharacter): number {
  const landElevation = Math.max(0, elevation);
  if (character === 'low') return roundTiesAwayFromZero((landElevation * 3) / 5);
  if (character === 'rugged') return roundTiesAwayFromZero((landElevation * 7) / 5);
  return landElevation;
}

function wrapLongitude(value: number): number {
  const count = WORLD_ATLAS_FULL_PROFILE.longitudeCellCount;
  return ((value % count) + count) % count;
}

function diagnostic(
  name: (typeof ATLAS_MOUNTAIN_SYSTEMS_DIAGNOSTIC_CODES)[keyof typeof ATLAS_MOUNTAIN_SYSTEMS_DIAGNOSTIC_CODES],
  aspectId: AspectId,
  message: string,
  suggestedAction: string,
): GenerationDiagnostic {
  return Object.freeze({
    code: required(parseGenerationDiagnosticCode(name)),
    severity: 'error',
    target: Object.freeze({ aspectId }),
    message,
    suggestedAction,
  });
}

function invalid(
  diagnostics: readonly GenerationDiagnostic[],
): AtlasMountainSystemsGenerationResult {
  return Object.freeze({ status: 'invalid', diagnostics: Object.freeze([...diagnostics]) });
}

function required<Value>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly diagnostic: unknown },
): Value {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostic));
  return result.value;
}
