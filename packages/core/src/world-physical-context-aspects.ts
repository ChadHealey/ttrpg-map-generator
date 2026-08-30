/** Accepted Milestone 3 physical-context aspect catalogue and control invalidation metadata. */

import {
  CLIMATE_CHARACTERS,
  MOUNTAIN_CHARACTERS,
  type WorldPhysicalContextControls,
} from './world-physical-context-model.js';

export type WorldPhysicalContextAspectKind =
  | 'worldTerrain.mountainSystems'
  | 'worldClimate.temperature'
  | 'worldClimate.prevailingWinds'
  | 'worldClimate.moisture'
  | 'worldClimate.zones'
  | 'worldEcology.biomeBelts'
  | 'worldHydrology.watersheds'
  | 'worldHydrology.majorRivers'
  | 'worldHydrology.majorLakes';

export type WorldPhysicalContextDependencyKind =
  | WorldPhysicalContextAspectKind
  | 'worldTerrain.macroElevation'
  | 'worldSurface.landWaterClassification'
  | 'landmass.classification'
  | 'waterBody.classification';

export interface WorldPhysicalContextAspectDefinition {
  readonly kind: WorldPhysicalContextAspectKind;
  readonly directDependencyKinds: readonly WorldPhysicalContextDependencyKind[];
  readonly owner: 'world-surface';
  readonly seedScope: 'map/entity';
  readonly behaviorVersion: 1;
  readonly parameterSchemaVersion: 1;
}

export interface WorldPhysicalEnumControlDefinition<Value extends string> {
  readonly kind: 'enum';
  readonly defaultValue: Value;
  readonly values: readonly Value[];
  readonly firstInvalidatedAspect: WorldPhysicalContextAspectKind;
}

export const WORLD_PHYSICAL_CONTEXT_ASPECT_DEFINITIONS: readonly WorldPhysicalContextAspectDefinition[] =
  Object.freeze([
    definition('worldTerrain.mountainSystems', [
      'worldTerrain.macroElevation',
      'worldSurface.landWaterClassification',
    ]),
    definition('worldClimate.temperature', [
      'worldTerrain.macroElevation',
      'worldSurface.landWaterClassification',
      'waterBody.classification',
      'worldTerrain.mountainSystems',
    ]),
    definition('worldClimate.prevailingWinds', [
      'worldClimate.temperature',
      'waterBody.classification',
      'worldTerrain.mountainSystems',
    ]),
    definition('worldClimate.moisture', [
      'waterBody.classification',
      'worldClimate.prevailingWinds',
      'worldTerrain.mountainSystems',
      'worldClimate.temperature',
    ]),
    definition('worldClimate.zones', [
      'worldClimate.temperature',
      'worldClimate.moisture',
      'worldSurface.landWaterClassification',
    ]),
    definition('worldEcology.biomeBelts', [
      'worldClimate.zones',
      'worldClimate.moisture',
      'worldClimate.temperature',
      'worldTerrain.macroElevation',
      'landmass.classification',
    ]),
    definition('worldHydrology.watersheds', [
      'worldTerrain.macroElevation',
      'worldSurface.landWaterClassification',
      'worldTerrain.mountainSystems',
      'worldClimate.moisture',
    ]),
    definition('worldHydrology.majorRivers', [
      'worldHydrology.watersheds',
      'waterBody.classification',
      'worldTerrain.macroElevation',
      'worldClimate.moisture',
    ]),
    definition('worldHydrology.majorLakes', [
      'worldHydrology.watersheds',
      'worldTerrain.macroElevation',
      'worldSurface.landWaterClassification',
      'waterBody.classification',
      'worldHydrology.majorRivers',
    ]),
  ]);

export const WORLD_PHYSICAL_CONTEXT_CONTROL_DEFINITIONS = Object.freeze({
  mountainCharacter: enumControl(
    'worldTerrain.mountainSystems',
    MOUNTAIN_CHARACTERS.varied,
    Object.values(MOUNTAIN_CHARACTERS),
  ),
  climateCharacter: enumControl(
    'worldClimate.temperature',
    CLIMATE_CHARACTERS.varied,
    Object.values(CLIMATE_CHARACTERS),
  ),
});

export function getWorldPhysicalContextControlInvalidationRoots(
  previous: WorldPhysicalContextControls,
  next: WorldPhysicalContextControls,
): readonly WorldPhysicalContextAspectKind[] {
  const roots = new Set<WorldPhysicalContextAspectKind>();
  for (const key of Object.keys(
    WORLD_PHYSICAL_CONTEXT_CONTROL_DEFINITIONS,
  ) as (keyof WorldPhysicalContextControls)[]) {
    if (previous[key] !== next[key]) {
      roots.add(WORLD_PHYSICAL_CONTEXT_CONTROL_DEFINITIONS[key].firstInvalidatedAspect);
    }
  }
  return Object.freeze([...roots].sort());
}

function definition(
  kind: WorldPhysicalContextAspectKind,
  directDependencyKinds: readonly WorldPhysicalContextDependencyKind[],
): WorldPhysicalContextAspectDefinition {
  return Object.freeze({
    kind,
    directDependencyKinds: Object.freeze([...directDependencyKinds]),
    owner: 'world-surface',
    seedScope: 'map/entity',
    behaviorVersion: 1,
    parameterSchemaVersion: 1,
  });
}

function enumControl<Value extends string>(
  firstInvalidatedAspect: WorldPhysicalContextAspectKind,
  defaultValue: Value,
  values: readonly Value[],
): WorldPhysicalEnumControlDefinition<Value> {
  return Object.freeze({
    kind: 'enum',
    defaultValue,
    values: Object.freeze([...values]),
    firstInvalidatedAspect,
  });
}
