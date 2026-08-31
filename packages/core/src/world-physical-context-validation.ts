/** Structural validation for accepted Milestone 3 physical-context records. */

import { parsePlanetPoint } from './coordinates.js';
import { type EntityId, type MapId, parseStableId } from './identity.js';
import {
  WORLD_PHYSICAL_CONTEXT_ASPECT_DEFINITIONS,
  type WorldPhysicalContextAspectKind,
} from './world-physical-context-aspects.js';
import {
  deriveWorldPhysicalContextAspectId,
  deriveWorldPhysicalFeatureEntityId,
  fingerprintWorldPhysicalField,
  fingerprintWorldPhysicalRootSignature,
  isWorldPhysicalFieldFingerprint,
} from './world-physical-context-identity.js';
import {
  type BiomeBeltField,
  CLIMATE_CHARACTERS,
  type ClimateZoneField,
  type MajorLake,
  type MajorRiver,
  type MoistureField,
  MOUNTAIN_CHARACTERS,
  type MountainSystems,
  type NormalizedFieldTicks,
  type PrevailingWindField,
  type QuantizedScalarField,
  type WatershedRecords,
  WORLD_PHYSICAL_CONTEXT_CONTRACT_VERSION,
  WORLD_PHYSICAL_FIELD_BEHAVIOR_VERSION,
  WORLD_PHYSICAL_FIELD_ENCODING_VERSION,
  WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE,
  WORLD_PHYSICAL_WIND_SPEED_QUANTUM_METERS_PER_SECOND,
  type WorldPhysicalContextControls,
  type WorldPhysicalContextRecords,
  type WorldPhysicalFieldKind,
} from './world-physical-context-model.js';
import { isWorldPhysicalFieldReader } from './world-physical-context-readers.js';

export const WORLD_PHYSICAL_CONTEXT_DIAGNOSTIC_CODES = {
  invalidAspectTopology: 'world-physical-context.aspect-topology.invalid',
  invalidControls: 'world-physical-context.controls.invalid',
  invalidFieldMetadata: 'world-physical-context.field.metadata.invalid',
  invalidFieldValue: 'world-physical-context.field.value.invalid',
  invalidGeometry: 'world-physical-context.geometry.invalid',
  invalidOrdering: 'world-physical-context.ordering.invalid',
  invalidReference: 'world-physical-context.reference.invalid',
  invalidVersion: 'world-physical-context.version.invalid',
} as const;

export type WorldPhysicalContextDiagnosticCode =
  (typeof WORLD_PHYSICAL_CONTEXT_DIAGNOSTIC_CODES)[keyof typeof WORLD_PHYSICAL_CONTEXT_DIAGNOSTIC_CODES];

export interface WorldPhysicalContextDiagnostic {
  readonly code: WorldPhysicalContextDiagnosticCode;
  readonly message: string;
}

export type WorldPhysicalContextValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly diagnostics: readonly WorldPhysicalContextDiagnostic[] };

/** Validate the two accepted M3 controls without supplying defaults or silently repairing input. */
export function validateWorldPhysicalContextControls(
  controls: WorldPhysicalContextControls,
): readonly WorldPhysicalContextDiagnostic[] {
  const diagnostics: WorldPhysicalContextDiagnostic[] = [];
  if (!Object.values(MOUNTAIN_CHARACTERS).includes(controls.mountainCharacter)) {
    diagnostics.push(
      invalid('invalidControls', 'mountainCharacter must be low, varied, or rugged.'),
    );
  }
  if (!Object.values(CLIMATE_CHARACTERS).includes(controls.climateCharacter)) {
    diagnostics.push(
      invalid('invalidControls', 'climateCharacter must be temperate, varied, or extreme.'),
    );
  }
  return orderDiagnostics(diagnostics);
}

/** Return a stable topological traversal of only the M3 aspect catalogue. */
export function getCanonicalWorldPhysicalContextAspectTraversal(): readonly WorldPhysicalContextAspectKind[] {
  const definitions = WORLD_PHYSICAL_CONTEXT_ASPECT_DEFINITIONS;
  const definedKinds = new Set<string>(definitions.map((definition) => definition.kind));
  const remaining = new Map(
    definitions.map((definition) => [
      definition.kind,
      new Set(
        definition.directDependencyKinds.filter((kind): kind is WorldPhysicalContextAspectKind =>
          definedKinds.has(kind),
        ),
      ),
    ]),
  );
  const traversal: WorldPhysicalContextAspectKind[] = [];
  while (remaining.size > 0) {
    const next = [...remaining]
      .filter(([, dependencies]) => dependencies.size === 0)
      .map(([kind]) => kind)
      .sort()[0];
    if (next === undefined) return Object.freeze([]);
    traversal.push(next);
    remaining.delete(next);
    for (const dependencies of remaining.values()) dependencies.delete(next);
  }
  return Object.freeze(traversal);
}

/** Validate catalogue identity and acyclicity independently of generated record values. */
export function validateWorldPhysicalContextAspectDefinitions(): readonly WorldPhysicalContextDiagnostic[] {
  const diagnostics: WorldPhysicalContextDiagnostic[] = [];
  const definitions = WORLD_PHYSICAL_CONTEXT_ASPECT_DEFINITIONS;
  if (new Set(definitions.map((definition) => definition.kind)).size !== definitions.length) {
    diagnostics.push(invalid('invalidAspectTopology', 'M3 aspect kinds must be unique.'));
  }
  if (getCanonicalWorldPhysicalContextAspectTraversal().length !== definitions.length) {
    diagnostics.push(
      invalid('invalidAspectTopology', 'M3 physical-context aspect dependencies must be acyclic.'),
    );
  }
  return orderDiagnostics(diagnostics);
}

/** Validate checkable core-record invariants without running a physical generator or clipping data. */
export function validateWorldPhysicalContextRecords(
  records: WorldPhysicalContextRecords,
): WorldPhysicalContextValidationResult {
  const diagnostics = [
    ...validateWorldPhysicalContextControls(records.controls),
    ...validateField(
      records.temperature,
      'temperature',
      isCanonicalInteger,
      records.worldSurfaceEntityId,
    ),
    ...validateWindField(records.prevailingWinds, records.worldSurfaceEntityId),
    ...validateMoistureField(records.moisture, records.worldSurfaceEntityId),
    ...validateClimateZoneField(records.climateZones, records.worldSurfaceEntityId),
    ...validateBiomeBeltField(records.biomeBelts, records.worldSurfaceEntityId),
    ...validateWatersheds(records.watersheds, records.worldSurfaceEntityId, records.worldMapId),
    ...validateWorldPhysicalMountainSystems(
      records.mountainSystems,
      records.worldSurfaceEntityId,
      records.worldMapId,
    ),
    ...validateRivers(records.majorRivers, records.watersheds.watersheds, records.worldMapId),
    ...validateLakes(
      records.majorLakes,
      records.watersheds.watersheds,
      records.majorRivers,
      records.worldMapId,
    ),
  ];
  const ordered = orderDiagnostics(diagnostics);
  return ordered.length === 0 ? { ok: true } : { ok: false, diagnostics: ordered };
}

function validateField<Kind extends WorldPhysicalFieldKind, Value>(
  field: QuantizedScalarField<Kind, Value>,
  expectedKind: Kind,
  isValueValid: (value: Value) => boolean,
  worldSurfaceEntityId: EntityId,
): readonly WorldPhysicalContextDiagnostic[] {
  const diagnostics: WorldPhysicalContextDiagnostic[] = [];
  const provenance = field.provenance as unknown;
  if (!hasExpectedFieldVersions(provenance)) {
    diagnostics.push(
      invalid('invalidVersion', `${expectedKind} field has an unsupported version.`),
    );
  }
  if (!hasCanonicalFieldMetadata(provenance, expectedKind, worldSurfaceEntityId)) {
    diagnostics.push(
      invalid('invalidFieldMetadata', `${expectedKind} field metadata is not canonical.`),
    );
  }
  if (!isWorldPhysicalFieldReader<Value>(field.values) || field.values.length !== 2_095_106) {
    diagnostics.push(
      invalid(
        'invalidFieldMetadata',
        `${expectedKind} field requires a project-owned full-profile reader.`,
      ),
    );
    return diagnostics;
  }
  if (
    !isValueValid(field.minimumValue) ||
    !isValueValid(field.maximumValue) ||
    field.minimumValue > field.maximumValue
  ) {
    diagnostics.push(invalid('invalidFieldValue', `${expectedKind} field range is not canonical.`));
    return diagnostics;
  }
  let invalidValueCount = 0;
  field.values.forEach((value) => {
    if (!isValueValid(value) || value < field.minimumValue || value > field.maximumValue) {
      invalidValueCount += 1;
    }
  });
  if (invalidValueCount > 0) {
    diagnostics.push(
      invalid(
        'invalidFieldValue',
        `${expectedKind} field contains a value outside its declared range.`,
      ),
    );
  }
  if (
    field.provenance.fingerprint !==
    fingerprintWorldPhysicalField({
      provenance: field.provenance,
      minimumValue: field.minimumValue,
      maximumValue: field.maximumValue,
      values: field.values,
    })
  ) {
    diagnostics.push(
      invalid(
        'invalidFieldMetadata',
        `${expectedKind} field fingerprint does not match its values.`,
      ),
    );
  }
  return diagnostics;
}

function validateWindField(
  field: PrevailingWindField,
  worldSurfaceEntityId: EntityId,
): readonly WorldPhysicalContextDiagnostic[] {
  const directionValid = (value: NormalizedFieldTicks): boolean =>
    isCanonicalInteger(value) && Math.abs(value) <= WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE;
  const speedValid = (value: number): boolean => isCanonicalInteger(value) && value >= 0;
  const diagnostics = [
    ...validateField(
      field.xComponents,
      'prevailing-winds-direction',
      directionValid,
      worldSurfaceEntityId,
    ),
    ...validateField(
      field.yComponents,
      'prevailing-winds-direction',
      directionValid,
      worldSurfaceEntityId,
    ),
    ...validateField(
      field.zComponents,
      'prevailing-winds-direction',
      directionValid,
      worldSurfaceEntityId,
    ),
    ...validateField(field.speed, 'prevailing-winds-speed', speedValid, worldSurfaceEntityId),
  ];
  if (
    !hasExactNumber(
      field.speedQuantumMetersPerSecond,
      WORLD_PHYSICAL_WIND_SPEED_QUANTUM_METERS_PER_SECOND,
    )
  ) {
    diagnostics.push(invalid('invalidFieldMetadata', 'Wind speed quantum must be 0.1 m/s.'));
  }
  return diagnostics;
}

function validateMoistureField(
  field: MoistureField,
  worldSurfaceEntityId: EntityId,
): readonly WorldPhysicalContextDiagnostic[] {
  const diagnostics = [
    ...validateField(
      field,
      'moisture',
      (value) =>
        isCanonicalInteger(value) &&
        value >= 0 &&
        value <= WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE,
      worldSurfaceEntityId,
    ),
  ];
  const expected = ['coastal', 'rain-shadow', 'windward'];
  if (!sameOrderedValues(field.influenceKinds, expected)) {
    diagnostics.push(
      invalid('invalidOrdering', 'Moisture influence kinds must use canonical order.'),
    );
  }
  return diagnostics;
}

function validateClimateZoneField(
  field: ClimateZoneField,
  worldSurfaceEntityId: EntityId,
): readonly WorldPhysicalContextDiagnostic[] {
  const definitions = new Set(field.definitions.map((definition) => definition.key));
  const diagnostics = [
    ...validateField(
      field,
      'climate-zones',
      (value) => definitions.has(value),
      worldSurfaceEntityId,
    ),
  ];
  if (
    !isVersionOne(field.classificationPolicyVersion) ||
    !isOrderedUnique(field.definitions.map((definition) => definition.key)) ||
    field.definitions.some(
      (definition) =>
        !isCanonicalInteger(definition.minimumTemperature) ||
        !isCanonicalInteger(definition.maximumTemperature) ||
        definition.minimumTemperature > definition.maximumTemperature ||
        !isNormalizedRange(definition.minimumMoisture, definition.maximumMoisture),
    )
  ) {
    diagnostics.push(
      invalid('invalidFieldMetadata', 'Climate-zone definitions are not canonical.'),
    );
  }
  return diagnostics;
}

function validateBiomeBeltField(
  field: BiomeBeltField,
  worldSurfaceEntityId: EntityId,
): readonly WorldPhysicalContextDiagnostic[] {
  const definitions = new Set(field.definitions.map((definition) => definition.key));
  const diagnostics = [
    ...validateField(field, 'biome-belts', (value) => definitions.has(value), worldSurfaceEntityId),
  ];
  if (
    !isVersionOne(field.classificationPolicyVersion) ||
    !isOrderedUnique(field.definitions.map((definition) => definition.key)) ||
    field.definitions.some(
      (definition) => !isOrderedUnique(definition.compatibleClimateZoneKeys),
    ) ||
    !isOrderedUnique(field.beltSummaries.map((summary) => summary.entityId)) ||
    field.beltSummaries.some(
      (summary) =>
        !definitions.has(summary.biomeKey) ||
        !isVersionOne(summary.geometryVersion) ||
        summary.boundaryPoints.length < 3 ||
        summary.boundaryPoints.some((point) => !parsePlanetPoint(point).ok),
    )
  ) {
    diagnostics.push(
      invalid('invalidGeometry', 'Biome-belt summaries or definitions are invalid.'),
    );
  }
  return diagnostics;
}

/** Validate structural invariants of a mountain-systems aspect without mutating or repairing it. */
export function validateWorldPhysicalMountainSystems(
  records: MountainSystems,
  worldSurfaceEntityId: EntityId,
  worldMapId: MapId,
): readonly WorldPhysicalContextDiagnostic[] {
  const diagnostics: WorldPhysicalContextDiagnostic[] = [];
  if (
    !hasCanonicalAspectReferences(
      records.ownerAspectId,
      records.sourceAspectIds,
      worldSurfaceEntityId,
      'worldTerrain.mountainSystems',
    ) ||
    !isOrderedUnique(records.sourceAspectIds) ||
    !isOrderedUnique(records.systems.map((system) => system.entityId))
  ) {
    diagnostics.push(
      invalid('invalidOrdering', 'Mountain systems and source aspects must be stable-ID ordered.'),
    );
  }
  if (
    records.systems.some(
      (system) =>
        !isVersionOne(system.behaviorVersion) ||
        !isVersionOne(system.geometryVersion) ||
        !isCanonicalInteger(system.prominence) ||
        !isOrderedUnique(system.boundaryPortalIds) ||
        system.centerlines.length === 0 ||
        system.centerlines.some(
          (line) => line.length < 2 || line.some((point) => !parsePlanetPoint(point).ok),
        ) ||
        !hasExpectedFeatureIdentity(
          worldMapId,
          'mountain-system',
          system.entityId,
          system.centerlines.flat(),
        ),
    )
  ) {
    diagnostics.push(
      invalid('invalidGeometry', 'Mountain-system geometry or metadata is invalid.'),
    );
  }
  return diagnostics;
}

function validateWatersheds(
  records: WatershedRecords,
  worldSurfaceEntityId: EntityId,
  worldMapId: MapId,
): readonly WorldPhysicalContextDiagnostic[] {
  const watersheds = records.watersheds;
  const diagnostics = [
    ...validateField(
      records,
      'watershed-assignment',
      (value) => watersheds.some((watershed) => watershed.entityId === value),
      worldSurfaceEntityId,
    ),
  ];
  if (
    !isVersionOne(records.graphPolicyVersion) ||
    !isOrderedUnique(watersheds.map((watershed) => watershed.entityId)) ||
    watersheds.some(
      (watershed) =>
        !isVersionOne(watershed.behaviorVersion) ||
        !isVersionOne(watershed.geometryVersion) ||
        !isOrderedUnique(watershed.boundaryPortalIds) ||
        watershed.divideLines.length === 0 ||
        watershed.divideLines.some(
          (line) => line.length < 2 || line.some((point) => !parsePlanetPoint(point).ok),
        ) ||
        !hasExpectedFeatureIdentity(
          worldMapId,
          'watershed',
          watershed.entityId,
          watershed.divideLines.flat(),
        ),
    )
  ) {
    diagnostics.push(invalid('invalidGeometry', 'Watershed graph records are invalid.'));
  }
  return diagnostics;
}

function validateRivers(
  rivers: readonly MajorRiver[],
  watersheds: readonly { readonly entityId: string }[],
  worldMapId: MapId,
): readonly WorldPhysicalContextDiagnostic[] {
  const watershedIds = new Set(watersheds.map((watershed) => watershed.entityId));
  if (
    !isOrderedUnique(rivers.map((river) => river.entityId)) ||
    rivers.some(
      (river) =>
        !isVersionOne(river.behaviorVersion) ||
        !isVersionOne(river.geometryVersion) ||
        !watershedIds.has(river.watershedId) ||
        river.centerline.length < 2 ||
        river.centerline.some((point) => !parsePlanetPoint(point).ok) ||
        !hasExpectedFeatureIdentity(worldMapId, 'river', river.entityId, river.centerline) ||
        river.dischargeSamples.length !== river.widthSamples.length ||
        river.dischargeSamples.some((sample) => !isCanonicalInteger(sample) || sample < 0) ||
        river.widthSamples.some((sample) => sample.distanceMillimeters < 0) ||
        !isOrderedUnique(river.joinsRiverIds) ||
        !isOrderedUnique(river.boundaryPortalIds),
    )
  ) {
    return [
      invalid(
        'invalidReference',
        'Major-river records have invalid geometry, widths, or references.',
      ),
    ];
  }
  return [];
}

function validateLakes(
  lakes: readonly MajorLake[],
  watersheds: readonly { readonly entityId: string }[],
  rivers: readonly MajorRiver[],
  worldMapId: MapId,
): readonly WorldPhysicalContextDiagnostic[] {
  const watershedIds = new Set(watersheds.map((watershed) => watershed.entityId));
  const riverIds = new Set(rivers.map((river) => river.entityId));
  if (
    !isOrderedUnique(lakes.map((lake) => lake.entityId)) ||
    lakes.some(
      (lake) =>
        !isVersionOne(lake.behaviorVersion) ||
        !isVersionOne(lake.geometryVersion) ||
        !watershedIds.has(lake.watershedId) ||
        (lake.outletRiverId !== undefined && !riverIds.has(lake.outletRiverId)) ||
        lake.ring.length < 3 ||
        lake.ring.some((point) => !parsePlanetPoint(point).ok) ||
        !hasExpectedFeatureIdentity(worldMapId, 'lake', lake.entityId, lake.ring) ||
        !isCanonicalInteger(lake.depth) ||
        !isCanonicalInteger(lake.surfaceElevation) ||
        !isOrderedUnique(lake.boundaryPortalIds),
    )
  ) {
    return [invalid('invalidReference', 'Major-lake records have invalid geometry or references.')];
  }
  return [];
}

function hasExpectedFieldVersions(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    value.contractVersion === WORLD_PHYSICAL_CONTEXT_CONTRACT_VERSION &&
    value.fieldBehaviorVersion === WORLD_PHYSICAL_FIELD_BEHAVIOR_VERSION &&
    value.fieldEncodingVersion === WORLD_PHYSICAL_FIELD_ENCODING_VERSION
  );
}

function hasCanonicalFieldMetadata(
  value: unknown,
  expectedKind: WorldPhysicalFieldKind,
  worldSurfaceEntityId: EntityId,
): boolean {
  if (!isRecord(value)) return false;
  return (
    value.fieldKind === expectedKind &&
    value.samplingProfileId === 'world-atlas-full-v1' &&
    value.samplingPolicyVersion === 1 &&
    value.longitudeCellCount === 2_048 &&
    value.latitudeBandCount === 1_024 &&
    value.canonicalTraversal === 'south-pole-then-rows-then-north-pole' &&
    hasExpectedFieldEncoding(value, expectedKind) &&
    hasCanonicalAspectReferences(
      value.ownerAspectId,
      value.sourceAspectIds,
      worldSurfaceEntityId,
      ownerAspectKindForField(expectedKind),
    ) &&
    isWorldPhysicalFieldFingerprint(value.fingerprint)
  );
}

function hasExpectedFieldEncoding(
  value: Readonly<Record<string, unknown>>,
  kind: WorldPhysicalFieldKind,
): boolean {
  const expected = {
    temperature: ['signed-integer-ticks', 10],
    'prevailing-winds-direction': [
      'normalized-integer-ticks',
      WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE,
    ],
    'prevailing-winds-speed': ['unsigned-integer-ticks', 10],
    moisture: ['normalized-integer-ticks', WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE],
    'climate-zones': ['semantic-key', 1],
    'biome-belts': ['semantic-key', 1],
    'watershed-assignment': ['entity-id', 1],
  } as const;
  const [encoding, scale] = expected[kind];
  return value.valueEncoding === encoding && value.quantizationScale === scale;
}

function hasCanonicalAspectReferences(
  ownerAspectId: unknown,
  sourceAspectIds: unknown,
  worldSurfaceEntityId: EntityId,
  expectedOwnerKind: WorldPhysicalContextAspectKind,
): boolean {
  return (
    parseStableId('aspect', ownerAspectId).ok &&
    ownerAspectId === deriveWorldPhysicalContextAspectId(worldSurfaceEntityId, expectedOwnerKind) &&
    Array.isArray(sourceAspectIds) &&
    sourceAspectIds.length > 0 &&
    sourceAspectIds.every((source) => parseStableId('aspect', source).ok) &&
    isOrderedUnique(sourceAspectIds)
  );
}

function ownerAspectKindForField(kind: WorldPhysicalFieldKind): WorldPhysicalContextAspectKind {
  const owners: Readonly<Record<WorldPhysicalFieldKind, WorldPhysicalContextAspectKind>> = {
    temperature: 'worldClimate.temperature',
    'prevailing-winds-direction': 'worldClimate.prevailingWinds',
    'prevailing-winds-speed': 'worldClimate.prevailingWinds',
    moisture: 'worldClimate.moisture',
    'climate-zones': 'worldClimate.zones',
    'biome-belts': 'worldEcology.biomeBelts',
    'watershed-assignment': 'worldHydrology.watersheds',
  };
  return owners[kind];
}

function hasExpectedFeatureIdentity(
  worldMapId: MapId,
  kind: 'lake' | 'mountain-system' | 'river' | 'watershed',
  entityId: EntityId,
  points: readonly unknown[],
): boolean {
  const parsed = points.map((point) => parsePlanetPoint(point));
  if (parsed.length === 0 || parsed.some((point) => !point.ok)) return false;
  const canonicalPoints = parsed.flatMap((point) => (point.ok ? [point.value] : []));
  return (
    entityId ===
    deriveWorldPhysicalFeatureEntityId(
      worldMapId,
      kind,
      fingerprintWorldPhysicalRootSignature(canonicalPoints),
    )
  );
}

function isVersionOne(value: unknown): boolean {
  return value === 1;
}

function hasExactNumber(value: unknown, expected: number): boolean {
  return typeof value === 'number' && value === expected;
}

function isCanonicalInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNormalizedRange(minimum: number, maximum: number): boolean {
  return (
    isCanonicalInteger(minimum) &&
    isCanonicalInteger(maximum) &&
    minimum >= 0 &&
    maximum <= WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE &&
    minimum <= maximum
  );
}

function isOrderedUnique(values: readonly string[]): boolean {
  return values.every((value, index) => index === 0 || (values[index - 1] ?? '') < value);
}

function sameOrderedValues<Value>(actual: readonly Value[], expected: readonly Value[]): boolean {
  return (
    actual.length === expected.length && actual.every((value, index) => value === expected[index])
  );
}

function invalid(
  code: keyof typeof WORLD_PHYSICAL_CONTEXT_DIAGNOSTIC_CODES,
  message: string,
): WorldPhysicalContextDiagnostic {
  return { code: WORLD_PHYSICAL_CONTEXT_DIAGNOSTIC_CODES[code], message };
}

function orderDiagnostics(
  diagnostics: readonly WorldPhysicalContextDiagnostic[],
): readonly WorldPhysicalContextDiagnostic[] {
  return Object.freeze([...diagnostics].sort((left, right) => left.code.localeCompare(right.code)));
}
