/** Accepted Milestone 2 atlas aspect, control, identity, and invalidation metadata. */

import {
  ATLAS_CONTINENT_DISTRIBUTIONS,
  ATLAS_OCEAN_CONNECTIVITY,
  ATLAS_POLAR_CHARACTERS,
  type AtlasControls,
} from './atlas-geography-model.js';
import {
  type BehaviorVersion,
  createBehaviorVersion,
  createParameterSchemaVersion,
  createVariantRevision,
  type ParameterSchemaVersion,
  type VariantRevision,
} from './compatibility.js';
import { createWorldRadius, type WorldRadius } from './coordinates.js';
import { type AspectName, parseAspectName } from './generated-aspects.js';
import {
  type AspectId,
  type CoastlineRingId,
  compareStableReferences,
  deriveStableId,
  type EntityId,
  type GeneratorId,
  type MapId,
  parseGeneratorId,
  parseSemanticKey,
  type SemanticKey,
  type SurfaceComponentId,
} from './identity.js';

export type AtlasAspectKind =
  | 'worldTerrain.macroElevation'
  | 'worldSurface.landWaterClassification'
  | 'landmass.classification'
  | 'islandGroup.classification'
  | 'waterBody.classification'
  | 'worldCoastline.geometry'
  | 'atlas.coastlineAppearance'
  | 'atlas.waterDecoration'
  | 'atlas.paperTreatment';

export interface AtlasAspectDefinition {
  readonly kind: AtlasAspectKind;
  readonly aspectName: AspectName;
  readonly generatorId: GeneratorId;
  readonly owner:
    | 'atlas-presentation'
    | 'island-group'
    | 'landmass'
    | 'water-body'
    | 'world-coastline'
    | 'world-surface';
  readonly directDependencyKinds: readonly AtlasAspectKind[];
  readonly seedScope: 'map/entity';
  readonly generatorVersion: BehaviorVersion;
  readonly parameterSchemaVersion: ParameterSchemaVersion;
  readonly initialVariantRevision: VariantRevision;
  readonly additionalBehaviorVersion: 1;
}

export interface AtlasNumericControlDefinition {
  readonly kind: 'integer';
  readonly unit: 'count' | 'kilometers' | 'percentage-points';
  readonly defaultValue: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly step: number;
  readonly firstInvalidatedAspect: AtlasAspectKind;
}

export interface AtlasEnumControlDefinition<Value extends string> {
  readonly kind: 'enum';
  readonly defaultValue: Value;
  readonly values: readonly Value[];
  readonly firstInvalidatedAspect: AtlasAspectKind;
}

const VERSION_ONE = required(createBehaviorVersion(1));
const PARAMETER_SCHEMA_ONE = required(createParameterSchemaVersion(1));
const INITIAL_REVISION = required(createVariantRevision(0));

const ATLAS_ASPECT_SEMANTIC_KEYS: Readonly<Record<AtlasAspectKind, string>> = Object.freeze({
  'worldTerrain.macroElevation': 'atlas-aspect.world-terrain.macro-elevation',
  'worldSurface.landWaterClassification': 'atlas-aspect.world-surface.land-water-classification',
  'landmass.classification': 'atlas-aspect.landmass.classification',
  'islandGroup.classification': 'atlas-aspect.island-group.classification',
  'waterBody.classification': 'atlas-aspect.water-body.classification',
  'worldCoastline.geometry': 'atlas-aspect.world-coastline.geometry',
  'atlas.coastlineAppearance': 'atlas-aspect.atlas.coastline-appearance',
  'atlas.waterDecoration': 'atlas-aspect.atlas.water-decoration',
  'atlas.paperTreatment': 'atlas-aspect.atlas.paper-treatment',
});

/** The complete proof-owned aspect topology, expressed by names only for catalogue use. */
export const ATLAS_ASPECT_DEFINITIONS: readonly AtlasAspectDefinition[] = Object.freeze([
  definition('worldTerrain.macroElevation', 'world-surface', []),
  definition('worldSurface.landWaterClassification', 'world-surface', [
    'worldTerrain.macroElevation',
  ]),
  definition('landmass.classification', 'landmass', ['worldSurface.landWaterClassification']),
  definition('islandGroup.classification', 'island-group', [
    'worldSurface.landWaterClassification',
    'landmass.classification',
  ]),
  definition('waterBody.classification', 'water-body', [
    'worldSurface.landWaterClassification',
    'landmass.classification',
  ]),
  definition('worldCoastline.geometry', 'world-coastline', [
    'worldSurface.landWaterClassification',
    'landmass.classification',
    'waterBody.classification',
  ]),
  definition('atlas.coastlineAppearance', 'atlas-presentation', ['worldCoastline.geometry']),
  definition('atlas.waterDecoration', 'atlas-presentation', [
    'worldSurface.landWaterClassification',
    'waterBody.classification',
    'worldCoastline.geometry',
  ]),
  definition('atlas.paperTreatment', 'atlas-presentation', []),
]);

/** Control changes begin invalidation only at these proof-contract root aspects. */
export const ATLAS_CONTROL_INVALIDATION_ROOTS: Readonly<
  Record<keyof AtlasControls, AtlasAspectKind>
> = Object.freeze({
  worldCircumferenceKm: 'worldTerrain.macroElevation',
  targetWaterCoveragePercent: 'worldSurface.landWaterClassification',
  continentCountIntent: 'worldTerrain.macroElevation',
  continentDistribution: 'worldTerrain.macroElevation',
  fragmentationPercent: 'worldTerrain.macroElevation',
  islandAbundancePercent: 'worldTerrain.macroElevation',
  archipelagoAbundancePercent: 'worldTerrain.macroElevation',
  oceanConnectivity: 'worldSurface.landWaterClassification',
  polarCharacter: 'worldTerrain.macroElevation',
});

/** User-facing accepted control definitions; no raw field/noise controls are exposed. */
export const ATLAS_CONTROL_DEFINITIONS = Object.freeze({
  worldCircumferenceKm: numericControl(
    'worldTerrain.macroElevation',
    'kilometers',
    40_000,
    10_000,
    80_000,
    1_000,
  ),
  targetWaterCoveragePercent: numericControl(
    'worldSurface.landWaterClassification',
    'percentage-points',
    65,
    45,
    80,
    1,
  ),
  continentCountIntent: numericControl('worldTerrain.macroElevation', 'count', 4, 1, 8, 1),
  continentDistribution: enumControl(
    'worldTerrain.macroElevation',
    ATLAS_CONTINENT_DISTRIBUTIONS.varied,
    Object.values(ATLAS_CONTINENT_DISTRIBUTIONS),
  ),
  fragmentationPercent: numericControl(
    'worldTerrain.macroElevation',
    'percentage-points',
    35,
    0,
    100,
    1,
  ),
  islandAbundancePercent: numericControl(
    'worldTerrain.macroElevation',
    'percentage-points',
    35,
    0,
    100,
    1,
  ),
  archipelagoAbundancePercent: numericControl(
    'worldTerrain.macroElevation',
    'percentage-points',
    25,
    0,
    100,
    1,
  ),
  oceanConnectivity: enumControl(
    'worldSurface.landWaterClassification',
    ATLAS_OCEAN_CONNECTIVITY.singleGlobal,
    Object.values(ATLAS_OCEAN_CONNECTIVITY),
  ),
  polarCharacter: enumControl(
    'worldTerrain.macroElevation',
    ATLAS_POLAR_CHARACTERS.neutral,
    Object.values(ATLAS_POLAR_CHARACTERS),
  ),
});

export interface AtlasStyleProvenance {
  readonly styleId: SemanticKey;
  readonly styleBehaviorVersion: 1;
}

export function deriveAtlasSingletonEntityIds(worldMapId: MapId): Readonly<{
  worldSurfaceEntityId: EntityId;
  worldCoastlineEntityId: EntityId;
  atlasPresentationEntityId: EntityId;
}> {
  return Object.freeze({
    worldSurfaceEntityId: deriveStableId('entity', worldMapId, semanticKey('world-surface')),
    worldCoastlineEntityId: deriveStableId('entity', worldMapId, semanticKey('world-coastline')),
    atlasPresentationEntityId: deriveStableId(
      'entity',
      worldMapId,
      semanticKey('atlas-presentation'),
    ),
  });
}

export function deriveAtlasFeatureEntityId(worldMapId: MapId, key: SemanticKey): EntityId {
  return deriveStableId('entity', worldMapId, key);
}

export function deriveAtlasSurfaceComponentId(
  worldSurfaceEntityId: EntityId,
  key: SemanticKey,
): SurfaceComponentId {
  return deriveStableId('surface-component', worldSurfaceEntityId, key);
}

export function deriveAtlasCoastlineRingId(
  worldCoastlineEntityId: EntityId,
  key: SemanticKey,
): CoastlineRingId {
  return deriveStableId('coastline-ring', worldCoastlineEntityId, key);
}

export function deriveAtlasAspectId(ownerEntityId: EntityId, kind: AtlasAspectKind): AspectId {
  return deriveStableId('aspect', ownerEntityId, semanticKey(ATLAS_ASPECT_SEMANTIC_KEYS[kind]));
}

export function getAtlasControlInvalidationRoots(
  previous: AtlasControls,
  next: AtlasControls,
): readonly AtlasAspectKind[] {
  const roots = new Set<AtlasAspectKind>();
  for (const key of Object.keys(ATLAS_CONTROL_INVALIDATION_ROOTS) as (keyof AtlasControls)[]) {
    if (previous[key] !== next[key]) roots.add(ATLAS_CONTROL_INVALIDATION_ROOTS[key]);
  }
  return Object.freeze([...roots].sort());
}

export function deriveAtlasWorldRadius(
  circumferenceKm: number,
): ReturnType<typeof createWorldRadius> {
  return createWorldRadius(circumferenceKm / (2 * Math.PI));
}

export function atlasControlsMatchWorldRadius(
  controls: AtlasControls,
  radius: WorldRadius,
): boolean {
  const derived = deriveAtlasWorldRadius(controls.worldCircumferenceKm);
  return derived.ok && derived.value.radiusMillimeters === radius.radiusMillimeters;
}

export function compareAtlasEntityIds(left: EntityId, right: EntityId): -1 | 0 | 1 {
  return compareStableReferences(left, right);
}

function definition(
  kind: AtlasAspectKind,
  owner: AtlasAspectDefinition['owner'],
  directDependencyKinds: readonly AtlasAspectKind[],
): AtlasAspectDefinition {
  return Object.freeze({
    kind,
    aspectName: required(parseAspectName(kind)),
    generatorId: required(parseGeneratorId(kind)),
    owner,
    directDependencyKinds: Object.freeze([...directDependencyKinds]),
    seedScope: 'map/entity',
    generatorVersion: VERSION_ONE,
    parameterSchemaVersion: PARAMETER_SCHEMA_ONE,
    initialVariantRevision: INITIAL_REVISION,
    additionalBehaviorVersion: 1,
  });
}

function numericControl(
  firstInvalidatedAspect: AtlasAspectKind,
  unit: AtlasNumericControlDefinition['unit'],
  defaultValue: number,
  minimum: number,
  maximum: number,
  step: number,
): AtlasNumericControlDefinition {
  return Object.freeze({
    kind: 'integer',
    unit,
    defaultValue,
    minimum,
    maximum,
    step,
    firstInvalidatedAspect,
  });
}

function enumControl<Value extends string>(
  firstInvalidatedAspect: AtlasAspectKind,
  defaultValue: Value,
  values: readonly Value[],
): AtlasEnumControlDefinition<Value> {
  return Object.freeze({
    kind: 'enum',
    defaultValue,
    values: Object.freeze([...values]),
    firstInvalidatedAspect,
  });
}

function semanticKey(value: string): SemanticKey {
  return required(parseSemanticKey(value));
}

function required<Value>(
  result: { readonly ok: true; readonly value: Value } | { readonly ok: false },
): Value {
  if (!result.ok) throw new Error('Internal atlas geography contract metadata is invalid.');
  return result.value;
}
