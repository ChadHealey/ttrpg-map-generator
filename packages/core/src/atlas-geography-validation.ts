/** Deterministic validation and ordering for accepted Milestone 2 atlas geography. */

import {
  ATLAS_CANONICAL_FIELD_TRAVERSAL,
  ATLAS_CONTINENT_DISTRIBUTIONS,
  ATLAS_FIELD_QUANTIZATION_SCALE,
  ATLAS_FULL_LATITUDE_BAND_COUNT,
  ATLAS_FULL_LONGITUDE_CELL_COUNT,
  ATLAS_FULL_PROFILE_ID,
  ATLAS_GEOGRAPHY_CONTRACT_VERSION,
  ATLAS_ISLAND_GROUP_KINDS,
  ATLAS_LANDMASS_KINDS,
  ATLAS_OCEAN_CONNECTIVITY,
  ATLAS_POLAR_CHARACTERS,
  ATLAS_WATER_BODY_KINDS,
  type AtlasControls,
  type AtlasGeographyRecords,
  type AtlasIslandGroupKind,
  type AtlasLandmassKind,
  type AtlasOceanConnectivity,
  type AtlasWaterBodyKind,
  type CanonicalWorldCoastlineRing,
  type IslandGroup,
  type Landmass,
  type WaterBody,
} from './atlas-geography-model.js';
import { parsePlanetPoint } from './coordinates.js';
import { type EntityId, type SurfaceComponentId } from './identity.js';

export const ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES = {
  brokenConnectivity: 'atlas-geography.connectivity.broken',
  brokenContainment: 'atlas-geography.containment.broken',
  impossibleControls: 'atlas-geography.controls.impossible',
  invalidClassification: 'atlas-geography.classification.invalid',
  invalidCoastlineReference: 'atlas-geography.coastline.reference.invalid',
  invalidControls: 'atlas-geography.controls.invalid',
  invalidFieldMetadata: 'atlas-geography.field.metadata.invalid',
  invalidFieldValue: 'atlas-geography.field.value.invalid',
  invalidOrdering: 'atlas-geography.ordering.invalid',
} as const;

export type AtlasGeographyDiagnosticCode =
  (typeof ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES)[keyof typeof ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES];

export interface AtlasGeographyDiagnostic {
  readonly code: AtlasGeographyDiagnosticCode;
  readonly message: string;
}

export type AtlasControlsParseResult =
  | { readonly ok: true; readonly value: AtlasControls }
  | { readonly ok: false; readonly diagnostics: readonly AtlasGeographyDiagnostic[] };

export type AtlasGeographyValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly diagnostics: readonly AtlasGeographyDiagnostic[] };

/** Parse all accepted controls without coercion, defaults, or UI-local state. */
export function parseAtlasControls(input: unknown): AtlasControlsParseResult {
  if (!isRecord(input) || !hasExactFields(input, ATLAS_CONTROL_FIELDS)) {
    return invalidControls(
      'Atlas controls must contain exactly the declared Milestone 2 control fields.',
    );
  }
  const controls = input as unknown as AtlasControls;
  const diagnostics = validateAtlasControls(controls);
  return diagnostics.length === 0
    ? { ok: true, value: Object.freeze({ ...controls }) }
    : { ok: false, diagnostics };
}

/** Validate one already-typed control record; valid controls are not silently normalized. */
export function validateAtlasControls(
  controls: AtlasControls,
): readonly AtlasGeographyDiagnostic[] {
  const diagnostics: AtlasGeographyDiagnostic[] = [];
  integerRange(
    diagnostics,
    controls.worldCircumferenceKm,
    'worldCircumferenceKm',
    10_000,
    80_000,
    1_000,
  );
  integerRange(
    diagnostics,
    controls.targetWaterCoveragePercent,
    'targetWaterCoveragePercent',
    45,
    80,
    1,
  );
  integerRange(diagnostics, controls.continentCountIntent, 'continentCountIntent', 1, 8, 1);
  integerRange(diagnostics, controls.fragmentationPercent, 'fragmentationPercent', 0, 100, 1);
  integerRange(diagnostics, controls.islandAbundancePercent, 'islandAbundancePercent', 0, 100, 1);
  integerRange(
    diagnostics,
    controls.archipelagoAbundancePercent,
    'archipelagoAbundancePercent',
    0,
    100,
    1,
  );
  if (!isEnumValue(controls.continentDistribution, ATLAS_CONTINENT_DISTRIBUTIONS)) {
    diagnostics.push(
      invalidControl('continentDistribution must be balanced, varied, or oneDominant.'),
    );
  }
  if (!isEnumValue(controls.oceanConnectivity, ATLAS_OCEAN_CONNECTIVITY)) {
    diagnostics.push(
      invalidControl(
        'oceanConnectivity must be singleGlobal, connectedMajority, or multipleBasins.',
      ),
    );
  }
  if (!isEnumValue(controls.polarCharacter, ATLAS_POLAR_CHARACTERS)) {
    diagnostics.push(invalidControl('polarCharacter must be oceanBiased, neutral, or landBiased.'));
  }
  return orderedDiagnostics(diagnostics);
}

/** Validate cross-record identity, classification, connectivity, and canonical order. */
export function validateAtlasGeographyRecords(
  records: AtlasGeographyRecords,
): AtlasGeographyValidationResult {
  const diagnostics = [
    ...validateAtlasControls(records.controls),
    ...validateField(records),
    ...validateOrdering(records),
    ...validateClassification(records),
    ...validateCoastline(records),
  ];
  const ordered = orderedDiagnostics(diagnostics);
  return ordered.length === 0 ? { ok: true } : { ok: false, diagnostics: ordered };
}

function validateField(records: AtlasGeographyRecords): readonly AtlasGeographyDiagnostic[] {
  const diagnostics: AtlasGeographyDiagnostic[] = [];
  const provenance = records.macroElevation.provenance as unknown as Readonly<
    Record<string, unknown>
  >;
  if (
    provenance.contractVersion !== ATLAS_GEOGRAPHY_CONTRACT_VERSION ||
    provenance.samplingProfileId !== ATLAS_FULL_PROFILE_ID ||
    provenance.samplingPolicyVersion !== 1 ||
    provenance.longitudeCellCount !== ATLAS_FULL_LONGITUDE_CELL_COUNT ||
    provenance.latitudeBandCount !== ATLAS_FULL_LATITUDE_BAND_COUNT ||
    provenance.canonicalTraversal !== ATLAS_CANONICAL_FIELD_TRAVERSAL ||
    provenance.fieldBehaviorVersion !== 1 ||
    provenance.quantizationScale !== ATLAS_FIELD_QUANTIZATION_SCALE
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidFieldMetadata,
        'Macro elevation provenance must use the accepted v1 full-profile, dimensions, traversal, sampling, field, and quantization metadata.',
      ),
    );
  }
  for (const value of records.macroElevation.values) {
    if (
      !Number.isSafeInteger(value) ||
      Object.is(value, -0) ||
      value < -ATLAS_FIELD_QUANTIZATION_SCALE ||
      value > ATLAS_FIELD_QUANTIZATION_SCALE
    ) {
      diagnostics.push(
        diagnostic(
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidFieldValue,
          'Macro elevation values must be canonical signed integer ticks in [-2^24, 2^24].',
        ),
      );
      break;
    }
  }
  const contour = records.landWaterClassification.seaLevelContourDoubledTicks;
  if (!Number.isSafeInteger(contour) || contour % 2 === 0) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidFieldMetadata,
        'The accepted land/water threshold must be a safe odd doubled macro-elevation tick.',
      ),
    );
  }
  return diagnostics;
}

function validateOrdering(records: AtlasGeographyRecords): readonly AtlasGeographyDiagnostic[] {
  const diagnostics: AtlasGeographyDiagnostic[] = [];
  orderedStableIds(
    diagnostics,
    records.landWaterClassification.landComponentIds,
    'Land components',
  );
  orderedStableIds(
    diagnostics,
    records.landWaterClassification.waterComponentIds,
    'Water components',
  );
  orderedStableIds(
    diagnostics,
    records.landmasses.map((landmass) => landmass.entityId),
    'Landmasses',
  );
  orderedStableIds(
    diagnostics,
    records.islandGroups.map((group) => group.entityId),
    'Island groups',
  );
  orderedStableIds(
    diagnostics,
    records.waterBodies.map((waterBody) => waterBody.entityId),
    'Water bodies',
  );
  orderedStableIds(
    diagnostics,
    records.coastline.rings.map((ring) => ring.ringId),
    'Coastline rings',
  );
  for (const landmass of records.landmasses) {
    orderedStableIds(
      diagnostics,
      landmass.adjacentWaterBodyIds,
      `Landmass ${landmass.entityId} water adjacency`,
    );
  }
  for (const group of records.islandGroups) {
    if (group.kind === ATLAS_ISLAND_GROUP_KINDS.archipelago) {
      orderedStableIds(
        diagnostics,
        group.memberLandmassIds,
        `Archipelago ${group.entityId} members`,
      );
    }
  }
  for (const waterBody of records.waterBodies) {
    orderedStableIds(
      diagnostics,
      waterBody.adjacentLandmassIds,
      `Water body ${waterBody.entityId} land adjacency`,
    );
    orderedStableIds(
      diagnostics,
      waterBody.connectivity.map((edge) => edge.connectedWaterBodyId),
      `Water body ${waterBody.entityId} connectivity`,
    );
  }
  return diagnostics;
}

function validateClassification(
  records: AtlasGeographyRecords,
): readonly AtlasGeographyDiagnostic[] {
  const diagnostics: AtlasGeographyDiagnostic[] = [];
  const semanticEntityIds = [
    ...records.landmasses.map((landmass) => landmass.entityId),
    ...records.islandGroups.map((group) => group.entityId),
    ...records.waterBodies.map((waterBody) => waterBody.entityId),
  ];
  if (new Set(semanticEntityIds).size !== semanticEntityIds.length) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassification,
        'Every semantic landmass, island group, and water body must have one globally unique entity ID.',
      ),
    );
  }
  const landComponents = new Set(records.landWaterClassification.landComponentIds);
  const waterComponents = new Set(records.landWaterClassification.waterComponentIds);
  if (
    landComponents.size !== records.landWaterClassification.landComponentIds.length ||
    waterComponents.size !== records.landWaterClassification.waterComponentIds.length ||
    [...landComponents].some((componentId) => waterComponents.has(componentId))
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassification,
        'Land and water component collections must be duplicate-free, sorted, and disjoint.',
      ),
    );
  }

  const landmassesById = new Map<EntityId, Landmass>();
  const landmassByComponent = new Map<SurfaceComponentId, Landmass>();
  for (const landmass of records.landmasses) {
    if (!isLandmassKind(landmass.kind) || !landComponents.has(landmass.componentId)) {
      diagnostics.push(
        diagnostic(
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassification,
          `Landmass ${landmass.entityId} must classify one declared land component with an accepted kind.`,
        ),
      );
    }
    if (landmassesById.has(landmass.entityId) || landmassByComponent.has(landmass.componentId)) {
      diagnostics.push(
        diagnostic(
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassification,
          'Every accepted land component must have exactly one stable landmass entity.',
        ),
      );
    }
    landmassesById.set(landmass.entityId, landmass);
    landmassByComponent.set(landmass.componentId, landmass);
  }
  if (landmassByComponent.size !== landComponents.size) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassification,
        'Every accepted land component must be represented by exactly one landmass entity.',
      ),
    );
  }

  const waterBodiesById = new Map<EntityId, WaterBody>();
  const waterBodyByComponent = new Map<SurfaceComponentId, WaterBody>();
  for (const waterBody of records.waterBodies) {
    if (!isWaterBodyKind(waterBody.kind) || !waterComponents.has(waterBody.componentId)) {
      diagnostics.push(
        diagnostic(
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassification,
          `Water body ${waterBody.entityId} must classify one declared water component with an accepted kind.`,
        ),
      );
    }
    if (
      waterBodiesById.has(waterBody.entityId) ||
      waterBodyByComponent.has(waterBody.componentId)
    ) {
      diagnostics.push(
        diagnostic(
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassification,
          'Every accepted water component must have exactly one stable water-body entity.',
        ),
      );
    }
    waterBodiesById.set(waterBody.entityId, waterBody);
    waterBodyByComponent.set(waterBody.componentId, waterBody);
  }
  if (waterBodyByComponent.size !== waterComponents.size) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassification,
        'Every accepted water component must be represented by exactly one water-body entity.',
      ),
    );
  }

  for (const landmass of records.landmasses) {
    validateLandmassRelationships(diagnostics, landmass, waterBodiesById);
  }
  const membership = new Set<EntityId>();
  for (const group of records.islandGroups) {
    validateIslandGroup(diagnostics, group, landmassesById, membership);
  }
  for (const waterBody of records.waterBodies) {
    validateWaterBodyRelationships(diagnostics, waterBody, landmassesById, waterBodiesById);
  }
  validateOceanControlRealization(
    diagnostics,
    records.controls.oceanConnectivity,
    records.waterBodies,
  );
  return diagnostics;
}

function validateLandmassRelationships(
  diagnostics: AtlasGeographyDiagnostic[],
  landmass: Landmass,
  waterBodiesById: ReadonlyMap<EntityId, WaterBody>,
): void {
  for (const waterBodyId of landmass.adjacentWaterBodyIds) {
    if (!waterBodiesById.has(waterBodyId)) {
      diagnostics.push(
        diagnostic(
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.brokenContainment,
          `Landmass ${landmass.entityId} references missing adjacent water body ${waterBodyId}.`,
        ),
      );
    }
  }
  if (
    landmass.containingWaterBodyId !== undefined &&
    !waterBodiesById.has(landmass.containingWaterBodyId)
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.brokenContainment,
        `Landmass ${landmass.entityId} references missing containing water body ${landmass.containingWaterBodyId}.`,
      ),
    );
  }
}

function validateIslandGroup(
  diagnostics: AtlasGeographyDiagnostic[],
  group: IslandGroup,
  landmassesById: ReadonlyMap<EntityId, Landmass>,
  membership: Set<EntityId>,
): void {
  if (!isIslandGroupKind(group.kind) || group.memberLandmassIds.length < 2) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassification,
        `Island group ${group.entityId} must have an accepted kind and at least two members.`,
      ),
    );
  }
  for (const memberId of group.memberLandmassIds) {
    const landmass = landmassesById.get(memberId);
    if (
      landmass === undefined ||
      landmass.kind === ATLAS_LANDMASS_KINDS.continent ||
      membership.has(memberId)
    ) {
      diagnostics.push(
        diagnostic(
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassification,
          `Island group ${group.entityId} must contain each non-continental island at most once across groups.`,
        ),
      );
    }
    membership.add(memberId);
  }
}

function validateWaterBodyRelationships(
  diagnostics: AtlasGeographyDiagnostic[],
  waterBody: WaterBody,
  landmassesById: ReadonlyMap<EntityId, Landmass>,
  waterBodiesById: ReadonlyMap<EntityId, WaterBody>,
): void {
  if (
    waterBody.containingWaterBodyId === waterBody.entityId ||
    waterBody.connectivity.some((edge) => edge.connectedWaterBodyId === waterBody.entityId)
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.brokenConnectivity,
        `Water body ${waterBody.entityId} cannot contain or connect to itself.`,
      ),
    );
  }
  if (
    waterBody.containingWaterBodyId !== undefined &&
    !waterBodiesById.has(waterBody.containingWaterBodyId)
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.brokenContainment,
        `Water body ${waterBody.entityId} references missing containing water body ${waterBody.containingWaterBodyId}.`,
      ),
    );
  }
  for (const landmassId of waterBody.adjacentLandmassIds) {
    if (!landmassesById.has(landmassId)) {
      diagnostics.push(
        diagnostic(
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.brokenContainment,
          `Water body ${waterBody.entityId} references missing adjacent landmass ${landmassId}.`,
        ),
      );
    }
  }
  for (const edge of waterBody.connectivity) {
    const other = waterBodiesById.get(edge.connectedWaterBodyId);
    if (
      !other?.connectivity.some(
        (candidate) => candidate.connectedWaterBodyId === waterBody.entityId,
      )
    ) {
      diagnostics.push(
        diagnostic(
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.brokenConnectivity,
          `Water body ${waterBody.entityId} has no reciprocal declared marine connection to ${edge.connectedWaterBodyId}.`,
        ),
      );
    }
  }
}

function validateOceanControlRealization(
  diagnostics: AtlasGeographyDiagnostic[],
  connectivity: AtlasOceanConnectivity,
  waterBodies: readonly WaterBody[],
): void {
  const openOceanBasins = waterBodies.filter(
    (waterBody) =>
      waterBody.kind === ATLAS_WATER_BODY_KINDS.oceanBasin && waterBody.enclosure === 'open-marine',
  );
  const required = connectivity === ATLAS_OCEAN_CONNECTIVITY.multipleBasins ? 2 : 1;
  if (
    openOceanBasins.length < required ||
    (connectivity === ATLAS_OCEAN_CONNECTIVITY.singleGlobal && openOceanBasins.length !== 1)
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.impossibleControls,
        `Accepted water bodies cannot realize ${connectivity} ocean-connectivity intent.`,
      ),
    );
  }
}

function validateCoastline(records: AtlasGeographyRecords): readonly AtlasGeographyDiagnostic[] {
  const diagnostics: AtlasGeographyDiagnostic[] = [];
  const landmasses = new Map(
    records.landmasses.map((landmass) => [landmass.entityId, landmass] as const),
  );
  const waterBodies = new Set(records.waterBodies.map((waterBody) => waterBody.entityId));
  for (const ring of records.coastline.rings)
    validateCoastlineRing(diagnostics, ring, landmasses, waterBodies);
  return diagnostics;
}

function validateCoastlineRing(
  diagnostics: AtlasGeographyDiagnostic[],
  ring: CanonicalWorldCoastlineRing,
  landmasses: ReadonlyMap<EntityId, Landmass>,
  waterBodies: ReadonlySet<EntityId>,
): void {
  const landmass = landmasses.get(ring.landmassId);
  if (
    landmass === undefined ||
    !waterBodies.has(ring.waterBodyId) ||
    !landmass.adjacentWaterBodyIds.includes(ring.waterBodyId)
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidCoastlineReference,
        `Coastline ring ${ring.ringId} must reference an adjacent accepted landmass and water body.`,
      ),
    );
  }
  if (ring.points.length < 3 || ring.points.some((point) => !parsePlanetPoint(point).ok)) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidCoastlineReference,
        `Coastline ring ${ring.ringId} must contain at least three canonical planet-native points.`,
      ),
    );
  }
}

function orderedStableIds(
  diagnostics: AtlasGeographyDiagnostic[],
  ids: readonly (EntityId | SurfaceComponentId | CanonicalWorldCoastlineRing['ringId'])[],
  label: string,
): void {
  for (let index = 1; index < ids.length; index += 1) {
    const previous = ids[index - 1];
    const current = ids[index];
    if (
      previous === undefined ||
      current === undefined ||
      compareStableIdTexts(previous, current) >= 0
    ) {
      diagnostics.push(
        diagnostic(
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidOrdering,
          `${label} must use ascending unique stable-ID order.`,
        ),
      );
      return;
    }
  }
}

function integerRange(
  diagnostics: AtlasGeographyDiagnostic[],
  value: number,
  name: string,
  minimum: number,
  maximum: number,
  step: number,
): void {
  if (
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum ||
    (value - minimum) % step !== 0
  ) {
    diagnostics.push(
      invalidControl(
        `${name} must be an integer from ${String(minimum)} to ${String(maximum)} in steps of ${String(step)}.`,
      ),
    );
  }
}

function isLandmassKind(value: unknown): value is AtlasLandmassKind {
  return isEnumValue(value, ATLAS_LANDMASS_KINDS);
}

function isIslandGroupKind(value: unknown): value is AtlasIslandGroupKind {
  return isEnumValue(value, ATLAS_ISLAND_GROUP_KINDS);
}

function isWaterBodyKind(value: unknown): value is AtlasWaterBodyKind {
  return isEnumValue(value, ATLAS_WATER_BODY_KINDS);
}

function isEnumValue<Value extends string>(
  value: unknown,
  values: Readonly<Record<string, Value>>,
): value is Value {
  return typeof value === 'string' && Object.values(values).includes(value as Value);
}

function invalidControls(message: string): AtlasControlsParseResult {
  return { ok: false, diagnostics: [invalidControl(message)] };
}

function invalidControl(message: string): AtlasGeographyDiagnostic {
  return diagnostic(ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidControls, message);
}

function diagnostic(code: AtlasGeographyDiagnosticCode, message: string): AtlasGeographyDiagnostic {
  return Object.freeze({ code, message });
}

function orderedDiagnostics(
  diagnostics: readonly AtlasGeographyDiagnostic[],
): readonly AtlasGeographyDiagnostic[] {
  return Object.freeze(
    [...diagnostics].sort(
      (left, right) =>
        compareAscii(left.code, right.code) || compareAscii(left.message, right.message),
    ),
  );
}

const ATLAS_CONTROL_FIELDS = [
  'archipelagoAbundancePercent',
  'continentCountIntent',
  'continentDistribution',
  'fragmentationPercent',
  'islandAbundancePercent',
  'oceanConnectivity',
  'polarCharacter',
  'targetWaterCoveragePercent',
  'worldCircumferenceKm',
] as const;

function isRecord(input: unknown): input is Readonly<Record<string, unknown>> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function hasExactFields(
  input: Readonly<Record<string, unknown>>,
  fields: readonly string[],
): boolean {
  const actual = Object.keys(input).sort();
  return actual.length === fields.length && actual.every((field, index) => field === fields[index]);
}

function compareAscii(left: string, right: string): -1 | 0 | 1 {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareStableIdTexts(
  left: EntityId | SurfaceComponentId | CanonicalWorldCoastlineRing['ringId'],
  right: EntityId | SurfaceComponentId | CanonicalWorldCoastlineRing['ringId'],
): -1 | 0 | 1 {
  return compareAscii(left, right);
}
