/** Deterministic validation and ordering for accepted Milestone 2 atlas geography. */

import { deriveAtlasSingletonEntityIds } from './atlas-geography-aspects.js';
import {
  ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES,
  type AtlasGeographyDiagnostic,
  type AtlasGeographyDiagnosticCode,
} from './atlas-geography-diagnostics.js';
import { deriveAtlasCoastlineRingIdFromFingerprint } from './atlas-geography-identity.js';
import {
  ATLAS_CANONICAL_FIELD_TRAVERSAL,
  ATLAS_COASTLINE_EXTRACTION_ALGORITHM_VERSION,
  ATLAS_COASTLINE_GEOMETRY_BEHAVIOR_VERSION,
  ATLAS_COASTLINE_REPAIR_POLICY,
  ATLAS_COASTLINE_SIMPLIFICATION_POLICY_VERSION,
  ATLAS_COASTLINE_SIMPLIFICATION_TOLERANCE_TICKS,
  ATLAS_COASTLINE_TOPOLOGY_VALIDATION_VERSION,
  ATLAS_COASTLINE_WINDING,
  ATLAS_CONNECTED_MAJORITY_MINIMUM_PERCENT,
  ATLAS_CONTINENT_DISTRIBUTIONS,
  ATLAS_FIELD_QUANTIZATION_SCALE,
  ATLAS_FULL_LATITUDE_BAND_COUNT,
  ATLAS_FULL_LONGITUDE_CELL_COUNT,
  ATLAS_FULL_PROFILE_ID,
  ATLAS_FULL_SAMPLE_COUNT,
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
  type AtlasLandWaterRecords,
  type AtlasOceanConnectivity,
  type AtlasSemanticGeographyRecords,
  type AtlasWaterBodyKind,
  type CanonicalWorldCoastlineRing,
  type IslandGroup,
  type Landmass,
  type WaterBody,
} from './atlas-geography-model.js';
import {
  type AtlasSemanticPolicyAnalysis,
  validateAtlasSemanticPolicyConformance,
} from './atlas-geography-semantic-policy-validation.js';
import { validateAtlasSemanticMembership } from './atlas-geography-semantic-validation.js';
import { parsePlanetPoint, PLANET_TICKS_PER_TURN, type PlanetPoint } from './coordinates.js';
import { type EntityId, type SurfaceComponentId } from './identity.js';
import { isImmutableDomainSnapshot } from './immutable-domain-snapshot.js';

export {
  ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES,
  type AtlasGeographyDiagnostic,
  type AtlasGeographyDiagnosticCode,
} from './atlas-geography-diagnostics.js';

export type AtlasControlsParseResult =
  | { readonly ok: true; readonly value: AtlasControls }
  | { readonly ok: false; readonly diagnostics: readonly AtlasGeographyDiagnostic[] };

export type AtlasGeographyValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly diagnostics: readonly AtlasGeographyDiagnostic[] };

interface SemanticValidationCacheEntry {
  readonly controls: AtlasControls;
  readonly macroElevation: AtlasSemanticGeographyRecords['macroElevation'];
  readonly semanticClassificationVersion: number;
  readonly worldMapId: AtlasSemanticGeographyRecords['worldMapId'];
  readonly worldSurfaceEntityId: AtlasSemanticGeographyRecords['worldSurfaceEntityId'];
  readonly landWaterClassificationAspectId: AtlasSemanticGeographyRecords['landWaterClassificationAspectId'];
  readonly landmasses: readonly Landmass[];
  readonly islandGroups: readonly IslandGroup[];
  readonly waterBodies: readonly WaterBody[];
}

const semanticValidationCache = new WeakMap<
  AtlasSemanticGeographyRecords['landWaterClassification'],
  readonly SemanticValidationCacheEntry[]
>();

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
  const coastlineDiagnostics = validateCoastline(records);
  const diagnostics = [
    ...semanticDiagnostics(records, coastlineDiagnostics.length === 0),
    ...coastlineDiagnostics,
  ];
  const ordered = orderedDiagnostics(diagnostics);
  return ordered.length === 0 ? { ok: true } : { ok: false, diagnostics: ordered };
}

/** Validate accepted #59 entities without requiring #60 coastline geometry. */
export function validateAtlasSemanticGeographyRecords(
  records: AtlasSemanticGeographyRecords,
): AtlasGeographyValidationResult {
  const diagnostics = orderedDiagnostics(semanticDiagnostics(records));
  return diagnostics.length === 0 ? { ok: true } : { ok: false, diagnostics };
}

/** Validate generated records while safely reusing analysis certified for their exact samples. */
export function validateAtlasSemanticGeographyRecordsWithAnalysis(
  records: AtlasSemanticGeographyRecords,
  analysis: AtlasSemanticPolicyAnalysis,
): AtlasGeographyValidationResult {
  const diagnostics = orderedDiagnostics(semanticDiagnostics(records, true, analysis));
  return diagnostics.length === 0 ? { ok: true } : { ok: false, diagnostics };
}

function semanticDiagnostics(
  records: AtlasSemanticGeographyRecords,
  validatePolicy = true,
  analysis?: AtlasSemanticPolicyAnalysis,
): readonly AtlasGeographyDiagnostic[] {
  if (validatePolicy && hasCachedSemanticValidation(records)) return Object.freeze([]);
  const upstreamDiagnostics = validateAtlasLandWaterRecords(records);
  const structuralDiagnostics = [
    ...upstreamDiagnostics,
    ...validateOrdering(records),
    ...validateClassification(records),
    ...validateAtlasSemanticMembership(records),
  ];
  const diagnostics =
    structuralDiagnostics.length === 0 && validatePolicy
      ? validateAtlasSemanticPolicyConformance(records, analysis)
      : structuralDiagnostics;
  if (validatePolicy && diagnostics.length === 0) rememberSemanticValidation(records);
  return diagnostics;
}

function hasCachedSemanticValidation(records: AtlasSemanticGeographyRecords): boolean {
  return (
    semanticValidationCache
      .get(records.landWaterClassification)
      ?.some(
        (entry) =>
          sameAtlasControls(entry.controls, records.controls) &&
          entry.macroElevation === records.macroElevation &&
          entry.semanticClassificationVersion === records.semanticClassificationVersion &&
          entry.worldMapId === records.worldMapId &&
          entry.worldSurfaceEntityId === records.worldSurfaceEntityId &&
          entry.landWaterClassificationAspectId === records.landWaterClassificationAspectId &&
          sameObjectReferences(entry.landmasses, records.landmasses) &&
          sameObjectReferences(entry.islandGroups, records.islandGroups) &&
          sameObjectReferences(entry.waterBodies, records.waterBodies),
      ) ?? false
  );
}

function rememberSemanticValidation(records: AtlasSemanticGeographyRecords): void {
  const immutableValues: readonly object[] = [
    records,
    records.controls,
    records.macroElevation,
    records.landWaterClassification,
    ...records.landmasses,
    ...records.islandGroups,
    ...records.waterBodies,
  ];
  if (!immutableValues.every(isImmutableDomainSnapshot)) return;
  const entry: SemanticValidationCacheEntry = Object.freeze({
    controls: records.controls,
    macroElevation: records.macroElevation,
    semanticClassificationVersion: records.semanticClassificationVersion,
    worldMapId: records.worldMapId,
    worldSurfaceEntityId: records.worldSurfaceEntityId,
    landWaterClassificationAspectId: records.landWaterClassificationAspectId,
    landmasses: records.landmasses,
    islandGroups: records.islandGroups,
    waterBodies: records.waterBodies,
  });
  const existing = semanticValidationCache.get(records.landWaterClassification) ?? [];
  semanticValidationCache.set(records.landWaterClassification, Object.freeze([...existing, entry]));
}

function sameObjectReferences(left: readonly object[], right: readonly object[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameAtlasControls(left: AtlasControls, right: AtlasControls): boolean {
  return ATLAS_CONTROL_FIELDS.every((field) => left[field] === right[field]);
}

/** Validate the complete upstream #58 field/partition output independently of #59 entities. */
export function validateAtlasLandWaterRecords(
  records: AtlasLandWaterRecords,
): readonly AtlasGeographyDiagnostic[] {
  return orderedDiagnostics([
    ...validateAtlasControls(records.controls),
    ...validateField(records),
  ]);
}

function validateField(records: AtlasLandWaterRecords): readonly AtlasGeographyDiagnostic[] {
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
  let invalidFieldValueFound = false;
  records.macroElevation.values.forEach((value) => {
    if (invalidFieldValueFound) return;
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
      invalidFieldValueFound = true;
    }
  });
  if (records.macroElevation.values.length !== ATLAS_FULL_SAMPLE_COUNT) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidFieldMetadata,
        `Macro elevation must contain exactly ${String(ATLAS_FULL_SAMPLE_COUNT)} full-profile values.`,
      ),
    );
  }
  const classification = records.landWaterClassification as unknown as Readonly<
    Record<string, unknown>
  >;
  if (classification.classificationBehaviorVersion !== 1) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassificationVersion,
        'Land/water classification must use behavior version 1.',
      ),
    );
  }
  if (records.landWaterClassification.samples.length !== ATLAS_FULL_SAMPLE_COUNT) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassification,
        `Land/water classification must contain exactly ${String(ATLAS_FULL_SAMPLE_COUNT)} full-profile samples.`,
      ),
    );
  }
  let invalidSampleFound = false;
  records.landWaterClassification.samples.forEach((sample, index) => {
    if (invalidSampleFound) return;
    const sampleValue = sample as unknown;
    if (sampleValue !== 'land' && sampleValue !== 'water') {
      diagnostics.push(
        diagnostic(
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassification,
          `Land/water sample ${String(index)} must be land or water.`,
        ),
      );
      invalidSampleFound = true;
      return;
    }
    const fieldValue = records.macroElevation.values.at(index);
    if (
      fieldValue !== undefined &&
      (sample === 'land') !==
        fieldValue * 2 > records.landWaterClassification.seaLevelContourDoubledTicks
    ) {
      diagnostics.push(
        diagnostic(
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassification,
          `Land/water sample ${String(index)} contradicts the quantized macro-elevation threshold.`,
        ),
      );
      invalidSampleFound = true;
    }
  });
  const contour = records.landWaterClassification.seaLevelContourDoubledTicks;
  if (
    !Number.isSafeInteger(contour) ||
    contour % 2 === 0 ||
    contour < -2 * ATLAS_FIELD_QUANTIZATION_SCALE + 1 ||
    contour > 2 * ATLAS_FIELD_QUANTIZATION_SCALE - 1
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidFieldMetadata,
        'The accepted land/water threshold must be an odd doubled macro-elevation tick within the quantized field range.',
      ),
    );
  }
  return diagnostics;
}

function validateOrdering(
  records: AtlasSemanticGeographyRecords,
): readonly AtlasGeographyDiagnostic[] {
  const diagnostics: AtlasGeographyDiagnostic[] = [];
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
  records: AtlasSemanticGeographyRecords,
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
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.identityCollision,
        'Every semantic landmass, island group, and water body must have one globally unique entity ID.',
      ),
    );
  }

  const landmassesById = new Map<EntityId, Landmass>();
  const landmassByComponent = new Map<SurfaceComponentId, Landmass>();
  for (const landmass of records.landmasses) {
    if (landmass.sourceClassificationAspectId !== records.landWaterClassificationAspectId) {
      diagnostics.push(
        diagnostic(
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassification,
          `Landmass ${landmass.entityId} must reference the accepted upstream land/water aspect.`,
        ),
      );
    }
    if (!isLandmassKind(landmass.kind)) {
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
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.ambiguousClassification,
          'Every accepted land component must have exactly one stable landmass entity.',
        ),
      );
    }
    landmassesById.set(landmass.entityId, landmass);
    landmassByComponent.set(landmass.componentId, landmass);
  }

  const waterBodiesById = new Map<EntityId, WaterBody>();
  const waterBodyByComponent = new Map<SurfaceComponentId, WaterBody>();
  for (const waterBody of records.waterBodies) {
    if (waterBody.sourceClassificationAspectId !== records.landWaterClassificationAspectId) {
      diagnostics.push(
        diagnostic(
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassification,
          `Water body ${waterBody.entityId} must reference the accepted upstream land/water aspect.`,
        ),
      );
    }
    if (!isWaterBodyKind(waterBody.kind)) {
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
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.ambiguousClassification,
          'Every accepted water component must have exactly one stable water-body entity.',
        ),
      );
    }
    waterBodiesById.set(waterBody.entityId, waterBody);
    waterBodyByComponent.set(waterBody.componentId, waterBody);
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
  const requiresContainment =
    landmass.kind === ATLAS_LANDMASS_KINDS.majorIsland ||
    landmass.kind === ATLAS_LANDMASS_KINDS.island;
  if (
    landmass.kind === ATLAS_LANDMASS_KINDS.continent &&
    landmass.containingWaterBodyId !== undefined
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.brokenContainment,
        `Continent ${landmass.entityId} cannot declare island containment.`,
      ),
    );
  }
  if (requiresContainment && landmass.containingWaterBodyId === undefined) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.brokenContainment,
        `Island landmass ${landmass.entityId} must declare a containing water body.`,
      ),
    );
  }
  if (landmass.containingWaterBodyId !== undefined) {
    const containing = waterBodiesById.get(landmass.containingWaterBodyId);
    if (
      containing === undefined ||
      !landmass.adjacentWaterBodyIds.includes(landmass.containingWaterBodyId) ||
      !containing.adjacentLandmassIds.includes(landmass.entityId)
    ) {
      diagnostics.push(
        diagnostic(
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.brokenContainment,
          `Landmass ${landmass.entityId} must be reciprocally adjacent to its containing water body.`,
        ),
      );
    }
  }
  for (const waterBodyId of landmass.adjacentWaterBodyIds) {
    const waterBody = waterBodiesById.get(waterBodyId);
    if (!waterBody?.adjacentLandmassIds.includes(landmass.entityId)) {
      diagnostics.push(
        diagnostic(
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.brokenContainment,
          `Landmass ${landmass.entityId} references missing adjacent water body ${waterBodyId}.`,
        ),
      );
    }
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
  const rawWaterBody = waterBody as unknown as Readonly<Record<string, unknown>>;
  if (rawWaterBody.enclosure !== 'enclosed' && rawWaterBody.enclosure !== 'open-marine') {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassification,
        `Water body ${waterBody.entityId} has an invalid enclosure.`,
      ),
    );
  }
  if (
    waterBody.connectivity.some(
      (edge) => (edge as unknown as { readonly kind: unknown }).kind !== 'open-marine-neck',
    )
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.brokenConnectivity,
        `Water body ${waterBody.entityId} has an invalid marine connectivity edge kind.`,
      ),
    );
  }
  if (waterBody.connectivity.some((edge) => edge.connectedWaterBodyId === waterBody.entityId)) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.brokenConnectivity,
        `Water body ${waterBody.entityId} cannot contain or connect to itself.`,
      ),
    );
  }
  const validOpenBasin =
    waterBody.kind === ATLAS_WATER_BODY_KINDS.oceanBasin && waterBody.enclosure === 'open-marine';
  const validSea = waterBody.kind === ATLAS_WATER_BODY_KINDS.sea;
  if (!validOpenBasin && !validSea)
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassification,
        `Only open-marine ocean basins and seas are accepted water-body classifications.`,
      ),
    );
  if (waterBody.enclosure === 'open-marine' && waterBody.enclosedByLandmassIds.length > 0)
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.brokenContainment,
        `Open-marine water body ${waterBody.entityId} cannot be enclosed by landmasses.`,
      ),
    );
  if (waterBody.enclosure === 'enclosed' && waterBody.kind !== ATLAS_WATER_BODY_KINDS.sea)
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidClassification,
        `Only a sea may be an enclosed water body.`,
      ),
    );
  if (waterBody.enclosure === 'enclosed' && waterBody.enclosedByLandmassIds.length === 0)
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.brokenContainment,
        `Enclosed sea ${waterBody.entityId} must declare enclosing landmasses.`,
      ),
    );
  if (waterBody.enclosure === 'enclosed' && waterBody.connectivity.length > 0)
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.brokenConnectivity,
        `Enclosed sea ${waterBody.entityId} cannot use open-marine connectivity.`,
      ),
    );
  for (const landmassId of waterBody.adjacentLandmassIds) {
    const landmass = landmassesById.get(landmassId);
    if (!landmass?.adjacentWaterBodyIds.includes(waterBody.entityId)) {
      diagnostics.push(
        diagnostic(
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.brokenContainment,
          `Water body ${waterBody.entityId} references missing adjacent landmass ${landmassId}.`,
        ),
      );
    }
  }
  for (const landmassId of waterBody.enclosedByLandmassIds) {
    const enclosing = landmassesById.get(landmassId);
    if (!enclosing?.adjacentWaterBodyIds.includes(waterBody.entityId))
      diagnostics.push(
        diagnostic(
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.brokenContainment,
          `Water body ${waterBody.entityId} references missing enclosing landmass ${landmassId}.`,
        ),
      );
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
  const open = waterBodies.filter((body) => body.enclosure === 'open-marine');
  const byId = new Map(open.map((body) => [body.entityId, body] as const));
  const seen = new Set<EntityId>();
  let openComponentCount = 0;
  let invalidRootComponent = false;
  let largestComponentArea = 0;
  let totalOpenArea = 0;
  for (const body of open) {
    if (seen.has(body.entityId)) continue;
    openComponentCount += 1;
    const queue = [body.entityId];
    let basinRootCount = 0;
    let componentArea = 0;
    seen.add(body.entityId);
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) continue;
      if (byId.get(current)?.kind === ATLAS_WATER_BODY_KINDS.oceanBasin) basinRootCount += 1;
      componentArea += byId.get(current)?.membership.sphericalAreaWeight ?? 0;
      for (const edge of byId.get(current)?.connectivity ?? [])
        if (byId.has(edge.connectedWaterBodyId) && !seen.has(edge.connectedWaterBodyId)) {
          seen.add(edge.connectedWaterBodyId);
          queue.push(edge.connectedWaterBodyId);
        }
    }
    if (basinRootCount !== 1) invalidRootComponent = true;
    totalOpenArea += componentArea;
    largestComponentArea = Math.max(largestComponentArea, componentArea);
  }
  const majorityPercent = totalOpenArea === 0 ? 0 : (largestComponentArea / totalOpenArea) * 100;
  const largestOpenRegion = [...open].sort(
    (left, right) =>
      right.membership.sphericalAreaWeight - left.membership.sphericalAreaWeight ||
      (left.membership.sampleRanges[0]?.startIndex ?? 0) -
        (right.membership.sampleRanges[0]?.startIndex ?? 0),
  )[0];
  if (
    invalidRootComponent ||
    (connectivity === ATLAS_OCEAN_CONNECTIVITY.singleGlobal && openComponentCount !== 1) ||
    (connectivity === ATLAS_OCEAN_CONNECTIVITY.connectedMajority &&
      (majorityPercent < ATLAS_CONNECTED_MAJORITY_MINIMUM_PERCENT ||
        largestOpenRegion?.kind !== ATLAS_WATER_BODY_KINDS.oceanBasin)) ||
    (connectivity === ATLAS_OCEAN_CONNECTIVITY.singleGlobal &&
      largestOpenRegion?.kind !== ATLAS_WATER_BODY_KINDS.oceanBasin) ||
    (connectivity === ATLAS_OCEAN_CONNECTIVITY.multipleBasins &&
      (openComponentCount < 2 ||
        open.some(({ kind }) => kind !== ATLAS_WATER_BODY_KINDS.oceanBasin)))
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.impossibleControls,
        `Accepted water bodies cannot realize ${connectivity} ocean-connectivity intent.`,
      ),
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.policyMisclassification,
        `Accepted water bodies violate version-1 ${connectivity} basin-root policy.`,
      ),
    );
  }
}

function validateCoastline(records: AtlasGeographyRecords): readonly AtlasGeographyDiagnostic[] {
  const diagnostics: AtlasGeographyDiagnostic[] = [];
  const metadata = records.coastline as unknown as Readonly<Record<string, unknown>>;
  orderedStableIds(
    diagnostics,
    records.coastline.rings.map((ring) => ring.ringId),
    'Coastline rings',
  );
  if (
    metadata.geometryBehaviorVersion !== ATLAS_COASTLINE_GEOMETRY_BEHAVIOR_VERSION ||
    metadata.extractionAlgorithmVersion !== ATLAS_COASTLINE_EXTRACTION_ALGORITHM_VERSION ||
    metadata.simplificationPolicyVersion !== ATLAS_COASTLINE_SIMPLIFICATION_POLICY_VERSION ||
    metadata.simplificationToleranceTicks !== ATLAS_COASTLINE_SIMPLIFICATION_TOLERANCE_TICKS ||
    metadata.topologyValidationVersion !== ATLAS_COASTLINE_TOPOLOGY_VALIDATION_VERSION ||
    metadata.winding !== ATLAS_COASTLINE_WINDING ||
    metadata.repairPolicy !== ATLAS_COASTLINE_REPAIR_POLICY
  ) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidCoastlineVersion,
        'Canonical coastline geometry must use behavior version 1.',
      ),
    );
  }
  const landmasses = new Map(
    records.landmasses.map((landmass) => [landmass.entityId, landmass] as const),
  );
  const waterBodies = new Map(
    records.waterBodies.map((waterBody) => [waterBody.entityId, waterBody] as const),
  );
  for (const ring of records.coastline.rings)
    validateCoastlineRing(diagnostics, ring, landmasses, waterBodies);
  const worldCoastlineEntityId = deriveAtlasSingletonEntityIds(
    records.worldMapId,
  ).worldCoastlineEntityId;
  for (const ring of records.coastline.rings) {
    if (
      /^[0-9a-f]{64}$/.test(ring.sourceBoundaryFingerprint) &&
      ring.ringId !==
        deriveAtlasCoastlineRingIdFromFingerprint(
          worldCoastlineEntityId,
          ring.sourceBoundaryFingerprint,
        )
    ) {
      diagnostics.push(
        diagnostic(
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidCoastlineReference,
          `Coastline ring ${ring.ringId} does not match its source-boundary fingerprint.`,
        ),
      );
    }
  }
  validateCoastlineTopology(diagnostics, records.coastline.rings);
  return diagnostics;
}

function validateCoastlineRing(
  diagnostics: AtlasGeographyDiagnostic[],
  ring: CanonicalWorldCoastlineRing,
  landmasses: ReadonlyMap<EntityId, Landmass>,
  waterBodies: ReadonlyMap<EntityId, WaterBody>,
): void {
  const landmass = landmasses.get(ring.landmassId);
  const hasInvalidWaterReference =
    ring.waterBodyIds.length === 0 ||
    ring.waterBodyIds.some(
      (waterBodyId) =>
        !waterBodies.has(waterBodyId) ||
        landmass?.adjacentWaterBodyIds.includes(waterBodyId) !== true ||
        waterBodies.get(waterBodyId)?.adjacentLandmassIds.includes(ring.landmassId) !== true,
    );
  if (landmass === undefined || hasInvalidWaterReference) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidCoastlineReference,
        `Coastline ring ${ring.ringId} must reference an adjacent accepted landmass and water body.`,
      ),
    );
  }
  orderedStableIds(diagnostics, ring.waterBodyIds, `Coastline ring ${ring.ringId} water bodies`);
  if (!/^[0-9a-f]{64}$/.test(ring.sourceBoundaryFingerprint)) {
    diagnostics.push(
      diagnostic(
        ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidCoastlineReference,
        `Coastline ring ${ring.ringId} must retain a canonical source-boundary fingerprint.`,
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

interface CoastlineTickPoint {
  readonly longitudeTicks: number;
  readonly latitudeTicks: number;
}

function validateCoastlineTopology(
  diagnostics: AtlasGeographyDiagnostic[],
  rings: readonly CanonicalWorldCoastlineRing[],
): void {
  const unwrapped = rings.map((ring) => unwrapCoastlinePoints(ring.points));
  for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
    const ring = rings[ringIndex];
    const points = unwrapped[ringIndex] ?? [];
    if (ring === undefined) continue;
    const unique = new Set(
      ring.points.map((point) => `${String(point.longitudeTicks)}:${String(point.latitudeTicks)}`),
    );
    if (unique.size !== ring.points.length || coastlineSelfIntersects(points)) {
      diagnostics.push(
        diagnostic(
          ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidCoastlineReference,
          `Coastline ring ${ring.ringId} must be unique and non-self-intersecting after quantization.`,
        ),
      );
    }
  }
  for (let firstIndex = 0; firstIndex < rings.length; firstIndex += 1) {
    const first = unwrapped[firstIndex] ?? [];
    const firstBounds = coastlineBounds(first);
    for (let secondIndex = firstIndex + 1; secondIndex < rings.length; secondIndex += 1) {
      const secondRing = rings[secondIndex];
      const second = alignCoastlineRing(firstBounds, unwrapped[secondIndex] ?? []);
      if (
        secondRing !== undefined &&
        coastlineBoundsOverlap(firstBounds, coastlineBounds(second)) &&
        coastlineRingsIntersect(first, second)
      ) {
        diagnostics.push(
          diagnostic(
            ATLAS_GEOGRAPHY_DIAGNOSTIC_CODES.invalidCoastlineReference,
            `Coastline ring ${secondRing.ringId} intersects another accepted ring after quantization.`,
          ),
        );
      }
    }
  }
}

function unwrapCoastlinePoints(points: readonly PlanetPoint[]): readonly CoastlineTickPoint[] {
  const first = points[0];
  if (first === undefined) return [];
  const output: CoastlineTickPoint[] = [first];
  let priorLongitude = first.longitudeTicks;
  for (let index = 1; index <= points.length; index += 1) {
    const point = points[index % points.length];
    if (point === undefined) continue;
    let longitudeTicks = point.longitudeTicks;
    while (longitudeTicks - priorLongitude > PLANET_TICKS_PER_TURN / 2) {
      longitudeTicks -= PLANET_TICKS_PER_TURN;
    }
    while (longitudeTicks - priorLongitude < -PLANET_TICKS_PER_TURN / 2) {
      longitudeTicks += PLANET_TICKS_PER_TURN;
    }
    output.push(Object.freeze({ longitudeTicks, latitudeTicks: point.latitudeTicks }));
    priorLongitude = longitudeTicks;
  }
  return Object.freeze(output);
}

function coastlineSelfIntersects(points: readonly CoastlineTickPoint[]): boolean {
  const segmentBounds = points
    .slice(0, -1)
    .map((start, index) => coastlineSegmentBounds(start, points[index + 1] ?? start));
  for (let firstIndex = 0; firstIndex < points.length - 1; firstIndex += 1) {
    const firstStart = points[firstIndex];
    const firstEnd = points[firstIndex + 1];
    if (firstStart === undefined || firstEnd === undefined) continue;
    for (let secondIndex = firstIndex + 2; secondIndex < points.length - 1; secondIndex += 1) {
      if (firstIndex === 0 && secondIndex === points.length - 2) continue;
      const secondStart = points[secondIndex];
      const secondEnd = points[secondIndex + 1];
      if (
        secondStart !== undefined &&
        secondEnd !== undefined &&
        coastlineBoundsOverlap(
          segmentBounds[firstIndex] ?? coastlineSegmentBounds(firstStart, firstEnd),
          segmentBounds[secondIndex] ?? coastlineSegmentBounds(secondStart, secondEnd),
        ) &&
        coastlineSegmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)
      ) {
        return true;
      }
    }
  }
  return false;
}

function coastlineRingsIntersect(
  first: readonly CoastlineTickPoint[],
  second: readonly CoastlineTickPoint[],
): boolean {
  const firstBounds = first
    .slice(0, -1)
    .map((start, index) => coastlineSegmentBounds(start, first[index + 1] ?? start));
  const secondBounds = second
    .slice(0, -1)
    .map((start, index) => coastlineSegmentBounds(start, second[index + 1] ?? start));
  for (let firstIndex = 0; firstIndex < first.length - 1; firstIndex += 1) {
    const firstStart = first[firstIndex];
    const firstEnd = first[firstIndex + 1];
    if (firstStart === undefined || firstEnd === undefined) continue;
    for (let secondIndex = 0; secondIndex < second.length - 1; secondIndex += 1) {
      const secondStart = second[secondIndex];
      const secondEnd = second[secondIndex + 1];
      if (
        secondStart !== undefined &&
        secondEnd !== undefined &&
        coastlineBoundsOverlap(
          firstBounds[firstIndex] ?? coastlineSegmentBounds(firstStart, firstEnd),
          secondBounds[secondIndex] ?? coastlineSegmentBounds(secondStart, secondEnd),
        ) &&
        coastlineSegmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)
      ) {
        return true;
      }
    }
  }
  return false;
}

function coastlineSegmentsIntersect(
  firstStart: CoastlineTickPoint,
  firstEnd: CoastlineTickPoint,
  secondStart: CoastlineTickPoint,
  secondEnd: CoastlineTickPoint,
): boolean {
  const firstA = coastlineOrientation(firstStart, firstEnd, secondStart);
  const firstB = coastlineOrientation(firstStart, firstEnd, secondEnd);
  const secondA = coastlineOrientation(secondStart, secondEnd, firstStart);
  const secondB = coastlineOrientation(secondStart, secondEnd, firstEnd);
  if (firstA === 0n && coastlinePointOnSegment(secondStart, firstStart, firstEnd)) return true;
  if (firstB === 0n && coastlinePointOnSegment(secondEnd, firstStart, firstEnd)) return true;
  if (secondA === 0n && coastlinePointOnSegment(firstStart, secondStart, secondEnd)) return true;
  if (secondB === 0n && coastlinePointOnSegment(firstEnd, secondStart, secondEnd)) return true;
  return (
    ((firstA < 0n && firstB > 0n) || (firstA > 0n && firstB < 0n)) &&
    ((secondA < 0n && secondB > 0n) || (secondA > 0n && secondB < 0n))
  );
}

function coastlineOrientation(
  start: CoastlineTickPoint,
  end: CoastlineTickPoint,
  point: CoastlineTickPoint,
): bigint {
  return (
    BigInt(end.longitudeTicks - start.longitudeTicks) *
      BigInt(point.latitudeTicks - start.latitudeTicks) -
    BigInt(end.latitudeTicks - start.latitudeTicks) *
      BigInt(point.longitudeTicks - start.longitudeTicks)
  );
}

function coastlinePointOnSegment(
  point: CoastlineTickPoint,
  start: CoastlineTickPoint,
  end: CoastlineTickPoint,
): boolean {
  return (
    point.longitudeTicks >= Math.min(start.longitudeTicks, end.longitudeTicks) &&
    point.longitudeTicks <= Math.max(start.longitudeTicks, end.longitudeTicks) &&
    point.latitudeTicks >= Math.min(start.latitudeTicks, end.latitudeTicks) &&
    point.latitudeTicks <= Math.max(start.latitudeTicks, end.latitudeTicks)
  );
}

interface CoastlineBounds {
  readonly minLongitude: number;
  readonly maxLongitude: number;
  readonly minLatitude: number;
  readonly maxLatitude: number;
}

function coastlineSegmentBounds(
  first: CoastlineTickPoint,
  second: CoastlineTickPoint,
): CoastlineBounds {
  return Object.freeze({
    minLongitude: Math.min(first.longitudeTicks, second.longitudeTicks),
    maxLongitude: Math.max(first.longitudeTicks, second.longitudeTicks),
    minLatitude: Math.min(first.latitudeTicks, second.latitudeTicks),
    maxLatitude: Math.max(first.latitudeTicks, second.latitudeTicks),
  });
}

function coastlineBounds(points: readonly CoastlineTickPoint[]): CoastlineBounds {
  let minLongitude = Number.POSITIVE_INFINITY;
  let maxLongitude = Number.NEGATIVE_INFINITY;
  let minLatitude = Number.POSITIVE_INFINITY;
  let maxLatitude = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minLongitude = Math.min(minLongitude, point.longitudeTicks);
    maxLongitude = Math.max(maxLongitude, point.longitudeTicks);
    minLatitude = Math.min(minLatitude, point.latitudeTicks);
    maxLatitude = Math.max(maxLatitude, point.latitudeTicks);
  }
  return Object.freeze({ minLongitude, maxLongitude, minLatitude, maxLatitude });
}

function alignCoastlineRing(
  target: CoastlineBounds,
  points: readonly CoastlineTickPoint[],
): readonly CoastlineTickPoint[] {
  const source = coastlineBounds(points);
  const targetCenter = (target.minLongitude + target.maxLongitude) / 2;
  const sourceCenter = (source.minLongitude + source.maxLongitude) / 2;
  const shift =
    Math.round((targetCenter - sourceCenter) / PLANET_TICKS_PER_TURN) * PLANET_TICKS_PER_TURN;
  if (shift === 0) return points;
  return Object.freeze(
    points.map(({ longitudeTicks, latitudeTicks }) =>
      Object.freeze({ longitudeTicks: longitudeTicks + shift, latitudeTicks }),
    ),
  );
}

function coastlineBoundsOverlap(first: CoastlineBounds, second: CoastlineBounds): boolean {
  return !(
    first.maxLongitude < second.minLongitude ||
    second.maxLongitude < first.minLongitude ||
    first.maxLatitude < second.minLatitude ||
    second.maxLatitude < first.minLatitude
  );
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
