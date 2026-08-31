/** Deterministic atlas-scale hydrology proposals from accepted M2 and M3 source records. */

import {
  type AspectId,
  type AspectName,
  type AtlasSemanticGeographyRecords,
  compareStableReferences,
  createBehaviorVersion,
  createDischargeTicks,
  createElevationTicks,
  createParameterSchemaVersion,
  createPhysicalDistance,
  createWorldPhysicalFieldReader,
  type DeepReadonly,
  deriveAtlasAspectId,
  deriveWorldPhysicalContextAspectId,
  deriveWorldPhysicalFeatureEntityId,
  type EntityId,
  fingerprintWorldPhysicalField,
  fingerprintWorldPhysicalRootSignature,
  formatWorldSeed,
  type GenerationDiagnostic,
  type GeneratorId,
  isWorldPhysicalFieldReader,
  type MajorLake,
  type MajorRiver,
  type MapEntitySeedInput,
  type MapId,
  type MoistureField,
  type MountainSystems,
  parseAspectName,
  parseGenerationDiagnosticCode,
  parseGeneratorId,
  parseSeedInput,
  validateAtlasSemanticGeographyRecords,
  validateWorldPhysicalMountainSystems,
  type VariantRevision,
  type Watershed,
  type WatershedRecords,
  WORLD_PHYSICAL_CONTEXT_CONTRACT_VERSION,
  WORLD_PHYSICAL_FEATURE_BEHAVIOR_VERSION,
  WORLD_PHYSICAL_FIELD_BEHAVIOR_VERSION,
  WORLD_PHYSICAL_FIELD_ENCODING_VERSION,
  WORLD_PHYSICAL_GEOMETRY_VERSION,
  WORLD_PHYSICAL_GRAPH_POLICY_VERSION,
  WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE,
  type WorldPhysicalFieldProvenance,
  type WorldSeed,
} from '@ttrpg-map/core';

import {
  ATLAS_ECOLOGY_PARAMETER_SCHEMA_VERSION,
  type AtlasEcologyProposedPatch,
} from './atlas-ecology-generator.js';
import {
  getAtlasGridVertex,
  getAtlasSampleStorageIndex,
  WORLD_ATLAS_FULL_PROFILE,
} from './atlas-sampling-profiles.js';
import type { GenerationProposal } from './generator-contracts.js';

export const ATLAS_HYDROLOGY_GENERATOR_MANIFEST_VERSION = 1 as const;
export const ATLAS_HYDROLOGY_PARAMETER_SCHEMA_VERSION = 1 as const;

export const ATLAS_HYDROLOGY_DIAGNOSTIC_CODES = Object.freeze({
  inputInvalid: 'atlas.hydrology.input-invalid',
  invariantInvalid: 'atlas.hydrology.invariant-invalid',
  sourceInvalid: 'atlas.hydrology.source-invalid',
} as const);

export interface AtlasHydrologyParameters {
  readonly parameterSchemaVersion: typeof ATLAS_HYDROLOGY_PARAMETER_SCHEMA_VERSION;
  readonly graphPolicyVersion: typeof WORLD_PHYSICAL_GRAPH_POLICY_VERSION;
  readonly geometryVersion: typeof WORLD_PHYSICAL_GEOMETRY_VERSION;
}

export const ATLAS_HYDROLOGY_GENERATOR_MANIFEST = Object.freeze({
  manifestVersion: ATLAS_HYDROLOGY_GENERATOR_MANIFEST_VERSION,
  generatorIds: Object.freeze([
    'worldHydrology.watersheds',
    'worldHydrology.majorRivers',
    'worldHydrology.majorLakes',
  ] as const),
  generatorVersion: WORLD_PHYSICAL_FEATURE_BEHAVIOR_VERSION,
  parameterSchemaVersion: ATLAS_HYDROLOGY_PARAMETER_SCHEMA_VERSION,
  inputAspects: Object.freeze([
    'worldTerrain.macroElevation',
    'worldSurface.landWaterClassification',
    'waterBody.classification',
    'worldTerrain.mountainSystems',
    'worldClimate.moisture',
  ] as const),
  outputAspects: Object.freeze([
    'worldHydrology.watersheds',
    'worldHydrology.majorRivers',
    'worldHydrology.majorLakes',
  ] as const),
  seedScope: 'map/entity',
  diagnostics: ATLAS_HYDROLOGY_DIAGNOSTIC_CODES,
});

export interface AtlasHydrologyGenerationInput {
  readonly worldSeed: WorldSeed;
  readonly worldMapId: MapId;
  readonly worldSurfaceEntityId: EntityId;
  readonly macroElevationAspectId: AspectId;
  readonly landWaterClassificationAspectId: AspectId;
  readonly watershedsVariantRevision: VariantRevision;
  readonly majorRiversVariantRevision: VariantRevision;
  readonly majorLakesVariantRevision: VariantRevision;
  readonly records: AtlasSemanticGeographyRecords;
  readonly mountainSystems: MountainSystems;
  readonly ecology: AtlasEcologyProposedPatch;
}

export type AtlasWatershedsAspectProposal = GenerationProposal<
  AtlasHydrologyParameters,
  WatershedRecords,
  MapEntitySeedInput
>;
export type AtlasMajorRiversAspectProposal = GenerationProposal<
  AtlasHydrologyParameters,
  readonly MajorRiver[],
  MapEntitySeedInput
>;
export type AtlasMajorLakesAspectProposal = GenerationProposal<
  AtlasHydrologyParameters,
  readonly MajorLake[],
  MapEntitySeedInput
>;

export interface AtlasHydrologyProposedPatch {
  readonly watersheds: AtlasWatershedsAspectProposal;
  readonly majorRivers: AtlasMajorRiversAspectProposal;
  readonly majorLakes: AtlasMajorLakesAspectProposal;
}

export type AtlasHydrologyGenerationResult =
  | { readonly status: 'proposed'; readonly patch: AtlasHydrologyProposedPatch }
  | { readonly status: 'invalid'; readonly diagnostics: readonly GenerationDiagnostic[] };

const SAMPLE_COUNT =
  WORLD_ATLAS_FULL_PROFILE.longitudeCellCount * (WORLD_ATLAS_FULL_PROFILE.latitudeBandCount - 1) +
  2;
const WATERSHEDS_ASPECT_NAME = required(parseAspectName('worldHydrology.watersheds'));
const RIVERS_ASPECT_NAME = required(parseAspectName('worldHydrology.majorRivers'));
const LAKES_ASPECT_NAME = required(parseAspectName('worldHydrology.majorLakes'));
const WATERSHEDS_GENERATOR_ID = required(parseGeneratorId('worldHydrology.watersheds'));
const RIVERS_GENERATOR_ID = required(parseGeneratorId('worldHydrology.majorRivers'));
const LAKES_GENERATOR_ID = required(parseGeneratorId('worldHydrology.majorLakes'));
const GENERATOR_VERSION = required(createBehaviorVersion(WORLD_PHYSICAL_FEATURE_BEHAVIOR_VERSION));
const PARAMETER_SCHEMA_VERSION = required(
  createParameterSchemaVersion(ATLAS_HYDROLOGY_PARAMETER_SCHEMA_VERSION),
);

/** Propose the complete atlas-scale hydrology graph without attaching it to document state. */
export function generateAtlasHydrology(
  input: AtlasHydrologyGenerationInput,
): AtlasHydrologyGenerationResult {
  const diagnostics = validateInput(input);
  if (diagnostics.length > 0) return invalid(diagnostics);

  const watershedsAspectId = deriveWorldPhysicalContextAspectId(
    input.worldSurfaceEntityId,
    'worldHydrology.watersheds',
  );
  const riversAspectId = deriveWorldPhysicalContextAspectId(
    input.worldSurfaceEntityId,
    'worldHydrology.majorRivers',
  );
  const lakesAspectId = deriveWorldPhysicalContextAspectId(
    input.worldSurfaceEntityId,
    'worldHydrology.majorLakes',
  );
  const drainage = findLandWaterEdge(input.records);
  const outletByLandmass = drainageOutletByLandmass(input.records, drainage);
  const watershedBuild = buildWatersheds(input, watershedsAspectId, outletByLandmass);
  if (!watershedBuild.ok) {
    return invalid([
      diagnostic(
        ATLAS_HYDROLOGY_DIAGNOSTIC_CODES.invariantInvalid,
        watershedsAspectId,
        'Hydrology generation could not derive canonical watershed divides from accepted land.',
        'Reject this proposal; do not repair or invent source geography.',
      ),
    ]);
  }
  const watershedSources = watershedSourceAspectIds(input);
  const riverSources = riverSourceAspectIds(input, watershedsAspectId);
  const lakeSources = lakeSourceAspectIds(input, watershedsAspectId, riversAspectId);
  const rivers = buildMajorRivers(input, watershedBuild.records, drainage);
  const lakes = buildMajorLakes(input, watershedBuild.records);
  const parameters: AtlasHydrologyParameters = Object.freeze({
    parameterSchemaVersion: ATLAS_HYDROLOGY_PARAMETER_SCHEMA_VERSION,
    graphPolicyVersion: WORLD_PHYSICAL_GRAPH_POLICY_VERSION,
    geometryVersion: WORLD_PHYSICAL_GEOMETRY_VERSION,
  });
  return Object.freeze({
    status: 'proposed',
    patch: Object.freeze({
      watersheds: proposal(
        input,
        watershedsAspectId,
        WATERSHEDS_ASPECT_NAME,
        WATERSHEDS_GENERATOR_ID,
        input.watershedsVariantRevision,
        watershedSources,
        parameters,
        buildSeedMetadata(
          input,
          WATERSHEDS_GENERATOR_ID,
          WATERSHEDS_ASPECT_NAME,
          input.watershedsVariantRevision,
          watershedsAspectId,
        ),
        watershedBuild.records,
      ),
      majorRivers: proposal(
        input,
        riversAspectId,
        RIVERS_ASPECT_NAME,
        RIVERS_GENERATOR_ID,
        input.majorRiversVariantRevision,
        riverSources,
        parameters,
        buildSeedMetadata(
          input,
          RIVERS_GENERATOR_ID,
          RIVERS_ASPECT_NAME,
          input.majorRiversVariantRevision,
          riversAspectId,
        ),
        rivers,
      ),
      majorLakes: proposal(
        input,
        lakesAspectId,
        LAKES_ASPECT_NAME,
        LAKES_GENERATOR_ID,
        input.majorLakesVariantRevision,
        lakeSources,
        parameters,
        buildSeedMetadata(
          input,
          LAKES_GENERATOR_ID,
          LAKES_ASPECT_NAME,
          input.majorLakesVariantRevision,
          lakesAspectId,
        ),
        lakes,
      ),
    }),
  });
}

function validateInput(input: AtlasHydrologyGenerationInput): readonly GenerationDiagnostic[] {
  const expectedMacro = deriveAtlasAspectId(
    input.worldSurfaceEntityId,
    'worldTerrain.macroElevation',
  );
  const expectedLandWater = deriveAtlasAspectId(
    input.worldSurfaceEntityId,
    'worldSurface.landWaterClassification',
  );
  const expectedMountains = deriveWorldPhysicalContextAspectId(
    input.worldSurfaceEntityId,
    'worldTerrain.mountainSystems',
  );
  const expectedMoisture = deriveWorldPhysicalContextAspectId(
    input.worldSurfaceEntityId,
    'worldClimate.moisture',
  );
  const geography = validateAtlasSemanticGeographyRecords(input.records);
  const mountains = validateWorldPhysicalMountainSystems(
    input.mountainSystems,
    input.worldSurfaceEntityId,
    input.worldMapId,
  );
  const moisture = input.ecology.moisture;
  if (
    input.records.worldMapId !== input.worldMapId ||
    input.records.worldSurfaceEntityId !== input.worldSurfaceEntityId ||
    input.macroElevationAspectId !== expectedMacro ||
    input.landWaterClassificationAspectId !== expectedLandWater ||
    input.records.landWaterClassificationAspectId !== expectedLandWater
  ) {
    return Object.freeze([
      diagnostic(
        ATLAS_HYDROLOGY_DIAGNOSTIC_CODES.inputInvalid,
        input.macroElevationAspectId,
        'Hydrology generation requires canonical world-surface aspect IDs.',
        'Rebuild input from accepted semantic geography and physical-context proposals.',
      ),
    ]);
  }
  if (
    !geography.ok ||
    mountains.length > 0 ||
    input.mountainSystems.ownerAspectId !== expectedMountains ||
    input.mountainSystems.systems.length === 0 ||
    moisture.target.mapId !== input.worldMapId ||
    moisture.target.entityId !== input.worldSurfaceEntityId ||
    moisture.target.aspect.aspectId !== expectedMoisture ||
    moisture.target.aspectName !== 'worldClimate.moisture' ||
    moisture.generatorId !== 'worldClimate.moisture' ||
    moisture.seedScope !== 'map/entity' ||
    !hasCanonicalMoistureProposal(input, expectedMoisture)
  ) {
    return Object.freeze([
      diagnostic(
        ATLAS_HYDROLOGY_DIAGNOSTIC_CODES.sourceInvalid,
        expectedMoisture,
        'Hydrology generation requires canonical accepted geography, mountain, and moisture proposals.',
        'Restore or regenerate the upstream M2, mountain, and ecology proposals before retrying.',
      ),
    ]);
  }
  return Object.freeze([]);
}

function hasCanonicalMoistureProposal(
  input: AtlasHydrologyGenerationInput,
  expectedOwnerAspectId: AspectId,
): boolean {
  const proposal = input.ecology.moisture;
  const field: unknown = proposal.output;
  if (!isMoistureField(field)) return false;
  const expectedSources = ecologyMoistureSourceAspectIds(input);
  const { provenance } = field;
  if (
    proposal.generatorVersion !== GENERATOR_VERSION ||
    proposal.parameterSchemaVersion !== ATLAS_ECOLOGY_PARAMETER_SCHEMA_VERSION ||
    !sameOrderedAspectIds(
      proposal.dependencyAspects.map(({ aspectId }) => aspectId),
      expectedSources,
    ) ||
    provenance.ownerAspectId !== expectedOwnerAspectId ||
    !sameOrderedAspectIds(provenance.sourceAspectIds, expectedSources) ||
    field.minimumValue < 0 ||
    field.maximumValue > WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE ||
    field.minimumValue > field.maximumValue ||
    field.influenceKinds.length !== 3 ||
    field.influenceKinds[0] !== 'coastal' ||
    field.influenceKinds[1] !== 'rain-shadow' ||
    field.influenceKinds[2] !== 'windward'
  ) {
    return false;
  }
  const range = normalizedFieldRange(asUnknown(field.values));
  if (range === undefined) return false;
  if (
    range.length !== SAMPLE_COUNT ||
    field.minimumValue !== range.minimum ||
    field.maximumValue !== range.maximum
  ) {
    return false;
  }
  const { fingerprint: _fingerprint, ...fingerprintProvenance } = provenance;
  return (
    provenance.fingerprint ===
    fingerprintWorldPhysicalField({
      provenance: fingerprintProvenance,
      minimumValue: field.minimumValue,
      maximumValue: field.maximumValue,
      values: field.values,
    })
  );
}

function isMoistureField(value: unknown): value is MoistureField {
  if (!isRecord(value) || !isRecord(value.provenance)) return false;
  return (
    value.provenance.fieldKind === 'moisture' &&
    Array.isArray(value.provenance.sourceAspectIds) &&
    typeof value.minimumValue === 'number' &&
    typeof value.maximumValue === 'number' &&
    'values' in value &&
    Array.isArray(value.influenceKinds)
  );
}

function normalizedSample(value: unknown): number | undefined {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    !Object.is(value, -0) &&
    value >= 0 &&
    value <= WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE
    ? value
    : undefined;
}

function normalizedFieldRange(
  value: unknown,
): Readonly<{ length: number; minimum: number; maximum: number }> | undefined {
  if (!isWorldPhysicalFieldReader<unknown>(value)) return undefined;
  let minimum = Math.max(0, WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE);
  let maximum = Math.min(0, WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE);
  const invalidSamples = new Set<number>();
  value.forEach((sample) => {
    const normalized = normalizedSample(sample);
    if (normalized === undefined) {
      invalidSamples.add(0);
      return;
    }
    minimum = Math.min(minimum, normalized);
    maximum = Math.max(maximum, normalized);
  });
  return invalidSamples.size === 0
    ? Object.freeze({ length: value.length, minimum, maximum })
    : undefined;
}

function asUnknown(value: unknown): unknown {
  return value;
}

function buildWatersheds(
  input: AtlasHydrologyGenerationInput,
  ownerAspectId: AspectId,
  outletByLandmass: ReadonlyMap<EntityId, EntityId>,
): { readonly ok: true; readonly records: WatershedRecords } | { readonly ok: false } {
  const definitions = input.records.landmasses
    .map((landmass) => {
      const rootIndex = firstInteriorSampleIndex(landmass.membership.sampleRanges);
      if (rootIndex === undefined) return undefined;
      return Object.freeze({ entityId: landmass.entityId, rootIndex });
    })
    .filter(
      (value): value is { readonly entityId: EntityId; readonly rootIndex: number } =>
        value !== undefined,
    );
  if (definitions.length === 0) return { ok: false };

  const roots = new Map<
    number,
    { readonly longitudeIndex: number; readonly latitudeIndex: number }
  >();
  forEachAtlasSample((longitudeIndex, latitudeIndex, sampleIndex) => {
    if (definitions.some(({ rootIndex }) => rootIndex === sampleIndex)) {
      roots.set(sampleIndex, Object.freeze({ longitudeIndex, latitudeIndex }));
    }
  });
  if (roots.size !== definitions.length) return { ok: false };
  const divideSignatures = new Set<string>();
  const watersheds = definitions
    .map(({ entityId, rootIndex }) => {
      const root = roots.get(rootIndex);
      if (root === undefined || root.latitudeIndex === 0 || root.latitudeIndex === 1024)
        return undefined;
      const moisture = input.ecology.moisture.output.values.at(rootIndex);
      if (moisture === undefined) return undefined;
      const points = landDivideEdge(input.records, root, moisture);
      if (points === undefined) return undefined;
      const signature = fingerprintWorldPhysicalRootSignature(points);
      if (divideSignatures.has(signature)) return undefined;
      divideSignatures.add(signature);
      const outletEntityId = outletByLandmass.get(entityId);
      const watershed: Watershed = Object.freeze({
        entityId: deriveWorldPhysicalFeatureEntityId(input.worldMapId, 'watershed', signature),
        behaviorVersion: WORLD_PHYSICAL_FEATURE_BEHAVIOR_VERSION,
        geometryVersion: WORLD_PHYSICAL_GEOMETRY_VERSION,
        ...(outletEntityId === undefined ? {} : { outletEntityId }),
        divideLines: Object.freeze([points]),
        boundaryPortalIds: Object.freeze([]),
      });
      return Object.freeze({ landmassId: entityId, watershed });
    })
    .filter(
      (value): value is { readonly landmassId: EntityId; readonly watershed: Watershed } =>
        value !== undefined,
    );
  if (watersheds.length !== definitions.length) return { ok: false };
  const watershedByLandmass = new Map(
    watersheds.map(({ landmassId, watershed }) => [landmassId, watershed]),
  );
  const orderedWatersheds = Object.freeze(
    watersheds
      .map(({ watershed }) => watershed)
      .sort((left, right) => compareStableReferences(left.entityId, right.entityId)),
  );
  const fallback = orderedWatersheds.at(0)?.entityId;
  if (fallback === undefined) return { ok: false };
  const assignments = new Array<EntityId>(SAMPLE_COUNT).fill(fallback);
  for (const landmass of input.records.landmasses) {
    const watershed = watershedByLandmass.get(landmass.entityId);
    if (watershed === undefined) return { ok: false };
    for (const range of landmass.membership.sampleRanges) {
      assignments.fill(watershed.entityId, range.startIndex, range.endIndexExclusive);
    }
  }
  const reader = createWorldPhysicalFieldReader(Object.freeze(assignments));
  const provenance: Omit<
    WorldPhysicalFieldProvenance<'watershed-assignment'>,
    'fingerprint'
  > = Object.freeze({
    contractVersion: WORLD_PHYSICAL_CONTEXT_CONTRACT_VERSION,
    fieldKind: 'watershed-assignment',
    ownerAspectId,
    sourceAspectIds: watershedSourceAspectIds(input),
    fieldBehaviorVersion: WORLD_PHYSICAL_FIELD_BEHAVIOR_VERSION,
    fieldEncodingVersion: WORLD_PHYSICAL_FIELD_ENCODING_VERSION,
    valueEncoding: 'semantic-key',
    quantizationScale: 1,
    samplingProfileId: 'world-atlas-full-v1',
    samplingPolicyVersion: 1,
    longitudeCellCount: 2_048,
    latitudeBandCount: 1_024,
    canonicalTraversal: 'south-pole-then-rows-then-north-pole',
  });
  const orderedIds = orderedWatersheds.map(({ entityId }) => entityId);
  const minimumValue = requiredDefined(orderedIds.at(0));
  const maximumValue = requiredDefined(orderedIds.at(-1));
  return {
    ok: true,
    records: Object.freeze({
      provenance: Object.freeze({
        ...provenance,
        fingerprint: fingerprintWorldPhysicalField({
          provenance,
          minimumValue,
          maximumValue,
          values: reader,
        }),
      }),
      minimumValue,
      maximumValue,
      values: reader,
      graphPolicyVersion: WORLD_PHYSICAL_GRAPH_POLICY_VERSION,
      watersheds: orderedWatersheds,
    }),
  };
}

function firstInteriorSampleIndex(
  ranges: readonly { readonly startIndex: number; readonly endIndexExclusive: number }[],
): number | undefined {
  for (const range of ranges) {
    const start = Math.max(1, range.startIndex);
    const end = Math.min(SAMPLE_COUNT - 1, range.endIndexExclusive);
    if (start < end) return start;
  }
  return undefined;
}

function buildMajorRivers(
  input: AtlasHydrologyGenerationInput,
  watersheds: WatershedRecords,
  edge: ReturnType<typeof findLandWaterEdge>,
): readonly MajorRiver[] {
  if (edge === undefined) return Object.freeze([]);
  const watershedId = watersheds.values.at(edge.landIndex);
  const outlet = waterBodyAt(input.records, edge.waterIndex);
  const watershed = watersheds.watersheds.find(({ entityId }) => entityId === watershedId);
  if (
    watershedId === undefined ||
    outlet === undefined ||
    watershed?.outletEntityId !== outlet.entityId
  ) {
    return Object.freeze([]);
  }
  const centerline = Object.freeze([edge.landPoint, edge.waterPoint]);
  const river: MajorRiver = Object.freeze({
    entityId: deriveWorldPhysicalFeatureEntityId(
      input.worldMapId,
      'river',
      fingerprintWorldPhysicalRootSignature(centerline),
    ),
    behaviorVersion: WORLD_PHYSICAL_FEATURE_BEHAVIOR_VERSION,
    geometryVersion: WORLD_PHYSICAL_GEOMETRY_VERSION,
    watershedId,
    centerline,
    sourceEntityId: watershedId,
    outletEntityId: outlet.entityId,
    joinsRiverIds: Object.freeze([]),
    dischargeSamples: Object.freeze([
      requiredDefined(createDischargeTicks(1_000)),
      requiredDefined(createDischargeTicks(2_000)),
    ]),
    widthSamples: Object.freeze([
      required(createPhysicalDistance(0.1)),
      required(createPhysicalDistance(0.2)),
    ]),
    boundaryPortalIds: Object.freeze([]),
  });
  return Object.freeze([river]);
}

function buildMajorLakes(
  input: AtlasHydrologyGenerationInput,
  watersheds: WatershedRecords,
): readonly MajorLake[] {
  const square = findLandSquare(input.records);
  if (square === undefined) return Object.freeze([]);
  const watershedId = watersheds.values.at(square.rootIndex);
  if (watershedId === undefined) return Object.freeze([]);
  const lake: MajorLake = Object.freeze({
    entityId: deriveWorldPhysicalFeatureEntityId(
      input.worldMapId,
      'lake',
      fingerprintWorldPhysicalRootSignature(square.ring),
    ),
    behaviorVersion: WORLD_PHYSICAL_FEATURE_BEHAVIOR_VERSION,
    geometryVersion: WORLD_PHYSICAL_GEOMETRY_VERSION,
    watershedId,
    ring: square.ring,
    depth: requiredDefined(createElevationTicks(1)),
    surfaceElevation: requiredDefined(createElevationTicks(0)),
    boundaryPortalIds: Object.freeze([]),
  });
  return Object.freeze([lake]);
}

function findLandWaterEdge(records: AtlasSemanticGeographyRecords):
  | Readonly<{
      landIndex: number;
      waterIndex: number;
      landPoint: ReturnType<typeof getAtlasGridVertex>;
      waterPoint: ReturnType<typeof getAtlasGridVertex>;
    }>
  | undefined {
  for (
    let latitudeIndex = 1;
    latitudeIndex < WORLD_ATLAS_FULL_PROFILE.latitudeBandCount;
    latitudeIndex += 1
  ) {
    for (
      let longitudeIndex = 0;
      longitudeIndex < WORLD_ATLAS_FULL_PROFILE.longitudeCellCount;
      longitudeIndex += 1
    ) {
      const landIndex = getAtlasSampleStorageIndex(
        WORLD_ATLAS_FULL_PROFILE,
        longitudeIndex,
        latitudeIndex,
      );
      if (records.landWaterClassification.samples.at(landIndex) !== 'land') continue;
      for (const neighbor of neighboringAddresses(longitudeIndex, latitudeIndex)) {
        const waterIndex = getAtlasSampleStorageIndex(
          WORLD_ATLAS_FULL_PROFILE,
          neighbor.longitudeIndex,
          neighbor.latitudeIndex,
        );
        if (records.landWaterClassification.samples.at(waterIndex) === 'water') {
          return Object.freeze({
            landIndex,
            waterIndex,
            landPoint: getAtlasGridVertex(WORLD_ATLAS_FULL_PROFILE, longitudeIndex, latitudeIndex),
            waterPoint: getAtlasGridVertex(
              WORLD_ATLAS_FULL_PROFILE,
              neighbor.longitudeIndex,
              neighbor.latitudeIndex,
            ),
          });
        }
      }
    }
  }
  return undefined;
}

function drainageOutletByLandmass(
  records: AtlasSemanticGeographyRecords,
  edge: ReturnType<typeof findLandWaterEdge>,
): ReadonlyMap<EntityId, EntityId> {
  if (edge === undefined) return new Map();
  const landmass = landmassAt(records, edge.landIndex);
  const waterBody = waterBodyAt(records, edge.waterIndex);
  if (landmass === undefined || waterBody === undefined) return new Map();
  return new Map([[landmass.entityId, waterBody.entityId]]);
}

function landmassAt(
  records: AtlasSemanticGeographyRecords,
  sampleIndex: number,
): AtlasSemanticGeographyRecords['landmasses'][number] | undefined {
  return records.landmasses.find(({ membership }) =>
    membership.sampleRanges.some(
      ({ startIndex, endIndexExclusive }) =>
        sampleIndex >= startIndex && sampleIndex < endIndexExclusive,
    ),
  );
}

function landDivideEdge(
  records: AtlasSemanticGeographyRecords,
  root: Readonly<{ longitudeIndex: number; latitudeIndex: number }>,
  moisture: number,
): readonly ReturnType<typeof getAtlasGridVertex>[] | undefined {
  const neighbors = neighboringAddresses(root.longitudeIndex, root.latitudeIndex);
  const offset = moisture % neighbors.length;
  for (let index = 0; index < neighbors.length; index += 1) {
    const neighbor = neighbors[(index + offset) % neighbors.length];
    if (neighbor === undefined) continue;
    const sampleIndex = getAtlasSampleStorageIndex(
      WORLD_ATLAS_FULL_PROFILE,
      neighbor.longitudeIndex,
      neighbor.latitudeIndex,
    );
    if (records.landWaterClassification.samples.at(sampleIndex) !== 'land') continue;
    return Object.freeze([
      getAtlasGridVertex(WORLD_ATLAS_FULL_PROFILE, root.longitudeIndex, root.latitudeIndex),
      getAtlasGridVertex(WORLD_ATLAS_FULL_PROFILE, neighbor.longitudeIndex, neighbor.latitudeIndex),
    ]);
  }
  return undefined;
}

function neighboringAddresses(
  longitudeIndex: number,
  latitudeIndex: number,
): readonly Readonly<{ longitudeIndex: number; latitudeIndex: number }>[] {
  const longitudeCount = WORLD_ATLAS_FULL_PROFILE.longitudeCellCount;
  const addresses = [
    { longitudeIndex: (longitudeIndex + 1) % longitudeCount, latitudeIndex },
    { longitudeIndex: (longitudeIndex + longitudeCount - 1) % longitudeCount, latitudeIndex },
  ];
  if (latitudeIndex > 0) {
    addresses.push({
      longitudeIndex: latitudeIndex === 1 ? 0 : longitudeIndex,
      latitudeIndex: latitudeIndex - 1,
    });
  }
  if (latitudeIndex < WORLD_ATLAS_FULL_PROFILE.latitudeBandCount) {
    addresses.push({
      longitudeIndex:
        latitudeIndex + 1 === WORLD_ATLAS_FULL_PROFILE.latitudeBandCount ? 0 : longitudeIndex,
      latitudeIndex: latitudeIndex + 1,
    });
  }
  return Object.freeze(addresses.map((address) => Object.freeze(address)));
}

function findLandSquare(
  records: AtlasSemanticGeographyRecords,
):
  | Readonly<{ rootIndex: number; ring: readonly ReturnType<typeof getAtlasGridVertex>[] }>
  | undefined {
  for (
    let latitudeIndex = 1;
    latitudeIndex < WORLD_ATLAS_FULL_PROFILE.latitudeBandCount - 1;
    latitudeIndex += 1
  ) {
    for (
      let longitudeIndex = 0;
      longitudeIndex < WORLD_ATLAS_FULL_PROFILE.longitudeCellCount;
      longitudeIndex += 1
    ) {
      const east = (longitudeIndex + 1) % WORLD_ATLAS_FULL_PROFILE.longitudeCellCount;
      const addresses: readonly (readonly [number, number])[] = [
        [longitudeIndex, latitudeIndex],
        [east, latitudeIndex],
        [east, latitudeIndex + 1],
        [longitudeIndex, latitudeIndex + 1],
      ];
      if (
        addresses.every(
          ([longitude, latitude]) =>
            records.landWaterClassification.samples.at(
              getAtlasSampleStorageIndex(WORLD_ATLAS_FULL_PROFILE, longitude, latitude),
            ) === 'land',
        )
      ) {
        return Object.freeze({
          rootIndex: getAtlasSampleStorageIndex(
            WORLD_ATLAS_FULL_PROFILE,
            longitudeIndex,
            latitudeIndex,
          ),
          ring: Object.freeze(
            addresses.map(([longitude, latitude]) =>
              getAtlasGridVertex(WORLD_ATLAS_FULL_PROFILE, longitude, latitude),
            ),
          ),
        });
      }
    }
  }
  return undefined;
}

function waterBodyAt(
  records: AtlasSemanticGeographyRecords,
  sampleIndex: number,
): AtlasSemanticGeographyRecords['waterBodies'][number] | undefined {
  return records.waterBodies.find(({ membership }) =>
    membership.sampleRanges.some(
      ({ startIndex, endIndexExclusive }) =>
        sampleIndex >= startIndex && sampleIndex < endIndexExclusive,
    ),
  );
}

function watershedSourceAspectIds(input: AtlasHydrologyGenerationInput): readonly AspectId[] {
  return Object.freeze(
    [
      input.macroElevationAspectId,
      input.landWaterClassificationAspectId,
      deriveWorldPhysicalContextAspectId(
        input.worldSurfaceEntityId,
        'worldTerrain.mountainSystems',
      ),
      deriveWorldPhysicalContextAspectId(input.worldSurfaceEntityId, 'worldClimate.moisture'),
    ].sort(compareStableReferences),
  );
}

function ecologyMoistureSourceAspectIds(input: AtlasHydrologyGenerationInput): readonly AspectId[] {
  return Object.freeze(
    [
      deriveWorldPhysicalContextAspectId(
        input.worldSurfaceEntityId,
        'worldClimate.prevailingWinds',
      ),
      deriveWorldPhysicalContextAspectId(input.worldSurfaceEntityId, 'worldClimate.temperature'),
      deriveWorldPhysicalContextAspectId(
        input.worldSurfaceEntityId,
        'worldTerrain.mountainSystems',
      ),
      ...input.records.waterBodies.map(({ entityId }) =>
        deriveAtlasAspectId(entityId, 'waterBody.classification'),
      ),
    ].sort(compareStableReferences),
  );
}

function riverSourceAspectIds(
  input: AtlasHydrologyGenerationInput,
  watershedsAspectId: AspectId,
): readonly AspectId[] {
  return Object.freeze(
    [
      input.macroElevationAspectId,
      watershedsAspectId,
      deriveWorldPhysicalContextAspectId(input.worldSurfaceEntityId, 'worldClimate.moisture'),
      ...input.records.waterBodies.map(({ entityId }) =>
        deriveAtlasAspectId(entityId, 'waterBody.classification'),
      ),
    ].sort(compareStableReferences),
  );
}

function lakeSourceAspectIds(
  input: AtlasHydrologyGenerationInput,
  watershedsAspectId: AspectId,
  riversAspectId: AspectId,
): readonly AspectId[] {
  return Object.freeze(
    [
      input.macroElevationAspectId,
      input.landWaterClassificationAspectId,
      watershedsAspectId,
      riversAspectId,
      ...input.records.waterBodies.map(({ entityId }) =>
        deriveAtlasAspectId(entityId, 'waterBody.classification'),
      ),
    ].sort(compareStableReferences),
  );
}

function forEachAtlasSample(
  visit: (longitudeIndex: number, latitudeIndex: number, sampleIndex: number) => void,
): void {
  for (
    let latitudeIndex = 0;
    latitudeIndex <= WORLD_ATLAS_FULL_PROFILE.latitudeBandCount;
    latitudeIndex += 1
  ) {
    const longitudeCount =
      latitudeIndex === 0 || latitudeIndex === WORLD_ATLAS_FULL_PROFILE.latitudeBandCount
        ? 1
        : WORLD_ATLAS_FULL_PROFILE.longitudeCellCount;
    for (let longitudeIndex = 0; longitudeIndex < longitudeCount; longitudeIndex += 1) {
      visit(
        longitudeIndex,
        latitudeIndex,
        getAtlasSampleStorageIndex(WORLD_ATLAS_FULL_PROFILE, longitudeIndex, latitudeIndex),
      );
    }
  }
}

function proposal<Output>(
  input: AtlasHydrologyGenerationInput,
  aspectId: AspectId,
  aspectName: AspectName,
  generatorId: GeneratorId,
  variantRevision: VariantRevision,
  sourceAspectIds: readonly AspectId[],
  parameters: AtlasHydrologyParameters,
  seedMetadata: MapEntitySeedInput,
  output: DeepReadonly<Output>,
): GenerationProposal<AtlasHydrologyParameters, Output, MapEntitySeedInput> {
  return Object.freeze({
    status: 'proposed',
    target: Object.freeze({
      mapId: input.worldMapId,
      entityId: input.worldSurfaceEntityId,
      aspect: Object.freeze({ aspectId }),
      aspectName,
      variantRevision,
    }),
    generatorId,
    generatorVersion: GENERATOR_VERSION,
    parameterSchemaVersion: PARAMETER_SCHEMA_VERSION,
    parameters,
    seedScope: 'map/entity',
    seedMetadata,
    dependencyAspects: Object.freeze(
      sourceAspectIds.map((dependencyAspectId) => Object.freeze({ aspectId: dependencyAspectId })),
    ),
    output,
    diagnostics: Object.freeze([]),
  });
}

function buildSeedMetadata(
  input: AtlasHydrologyGenerationInput,
  generatorId: GeneratorId,
  aspectName: AspectName,
  variantRevision: VariantRevision,
  aspectId: AspectId,
): MapEntitySeedInput {
  const parsed = parseSeedInput({
    seedDerivationVersion: 1,
    deterministicStreamVersion: 1,
    seedScope: 'map/entity',
    worldSeed: formatWorldSeed(input.worldSeed),
    generatorId,
    generatorVersion: GENERATOR_VERSION,
    aspectName,
    variantRevision,
    mapId: input.worldMapId,
    entityId: input.worldSurfaceEntityId,
  });
  if (!parsed.ok || parsed.value.seedScope !== 'map/entity') {
    throw new Error(`Hydrology seed metadata is invalid for aspect ${aspectId}.`);
  }
  return parsed.value;
}

function diagnostic(
  name: (typeof ATLAS_HYDROLOGY_DIAGNOSTIC_CODES)[keyof typeof ATLAS_HYDROLOGY_DIAGNOSTIC_CODES],
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

function invalid(diagnostics: readonly GenerationDiagnostic[]): AtlasHydrologyGenerationResult {
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

function requiredDefined<Value>(value: Value | undefined): Value {
  if (value === undefined) throw new Error('Expected a canonical physical value.');
  return value;
}

function sameOrderedAspectIds(left: readonly AspectId[], right: readonly AspectId[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}
