/** Generator-free reconstruction and envelope validation for accepted M3 atlas physical state. */

import { deriveAtlasSingletonEntityIds } from './atlas-geography-aspects.js';
import type { AcceptedAspectRecord } from './generated-aspects.js';
import type { AspectId } from './identity.js';
import type { WorldMap } from './world-document.js';
import {
  WORLD_PHYSICAL_CONTEXT_ASPECT_DEFINITIONS,
  type WorldPhysicalContextAspectKind,
} from './world-physical-context-aspects.js';
import { deriveWorldPhysicalContextAspectId } from './world-physical-context-identity.js';
import {
  type BiomeBeltField,
  CLIMATE_CHARACTERS,
  type ClimateZoneField,
  type MajorLake,
  type MajorRiver,
  type MoistureField,
  MOUNTAIN_CHARACTERS,
  type MountainSystems,
  type PrevailingWindField,
  type TemperatureField,
  type WatershedRecords,
  WORLD_PHYSICAL_CLASSIFICATION_POLICY_VERSION,
  WORLD_PHYSICAL_FIELD_ENCODING_VERSION,
  WORLD_PHYSICAL_GEOMETRY_VERSION,
  WORLD_PHYSICAL_GRAPH_POLICY_VERSION,
  type WorldPhysicalContextControls,
  type WorldPhysicalContextRecords,
} from './world-physical-context-model.js';
import {
  validateWorldPhysicalContextControls,
  validateWorldPhysicalContextRecords,
} from './world-physical-context-validation.js';

export const WORLD_PHYSICAL_CONTEXT_ASPECT_NAMES: ReadonlySet<string> = new Set(
  WORLD_PHYSICAL_CONTEXT_ASPECT_DEFINITIONS.map(({ kind }) => kind),
);

export type ReconstructAcceptedWorldPhysicalContextResult =
  | { readonly status: 'absent' }
  | { readonly status: 'accepted'; readonly value: WorldPhysicalContextRecords }
  | { readonly status: 'invalid'; readonly message: string };

/** Reconstruct all nine records from accepted aspects without invoking any producer. */
export function reconstructAcceptedWorldPhysicalContext(
  map: WorldMap,
): ReconstructAcceptedWorldPhysicalContextResult {
  const aspects = map.aspects.filter(({ aspectName }) =>
    WORLD_PHYSICAL_CONTEXT_ASPECT_NAMES.has(aspectName),
  );
  if (aspects.length === 0) return Object.freeze({ status: 'absent' });
  if (aspects.length !== WORLD_PHYSICAL_CONTEXT_ASPECT_DEFINITIONS.length) {
    return invalid('The accepted atlas must contain either zero or all nine M3 physical aspects.');
  }
  const byName = new Map(aspects.map((aspect) => [aspect.aspectName, aspect] as const));
  if (byName.size !== WORLD_PHYSICAL_CONTEXT_ASPECT_DEFINITIONS.length) {
    return invalid('The accepted atlas contains duplicate M3 physical aspect names.');
  }
  const controls = controlsFrom(aspects);
  if (controls === undefined) {
    return invalid('Accepted M3 control provenance is missing or invalid.');
  }
  const records: WorldPhysicalContextRecords = {
    worldMapId: map.mapId,
    worldSurfaceEntityId: deriveAtlasSingletonEntityIds(map.mapId).worldSurfaceEntityId,
    controls,
    mountainSystems: output(byName, 'worldTerrain.mountainSystems') as MountainSystems,
    temperature: output(byName, 'worldClimate.temperature') as TemperatureField,
    prevailingWinds: output(byName, 'worldClimate.prevailingWinds') as PrevailingWindField,
    moisture: output(byName, 'worldClimate.moisture') as MoistureField,
    climateZones: output(byName, 'worldClimate.zones') as ClimateZoneField,
    biomeBelts: output(byName, 'worldEcology.biomeBelts') as BiomeBeltField,
    watersheds: output(byName, 'worldHydrology.watersheds') as WatershedRecords,
    majorRivers: output(byName, 'worldHydrology.majorRivers') as readonly MajorRiver[],
    majorLakes: output(byName, 'worldHydrology.majorLakes') as readonly MajorLake[],
  };
  const validation = validateWorldPhysicalContextRecords(records);
  if (!validation.ok) {
    return invalid(validation.diagnostics[0]?.message ?? 'Accepted M3 records are invalid.');
  }
  if (!hasExactPhysicalEnvelopes(map, aspects)) {
    return invalid(
      'Accepted M3 aspect ownership, identity, dependencies, or seed metadata is invalid.',
    );
  }
  return Object.freeze({ status: 'accepted', value: records });
}

export function isWorldPhysicalContextAspectName(
  value: string,
): value is WorldPhysicalContextAspectKind {
  return WORLD_PHYSICAL_CONTEXT_ASPECT_NAMES.has(value);
}

function hasExactPhysicalEnvelopes(
  map: WorldMap,
  aspects: readonly AcceptedAspectRecord[],
): boolean {
  const owner = deriveAtlasSingletonEntityIds(map.mapId).worldSurfaceEntityId;
  const allByName = new Map<string, readonly AspectId[]>();
  for (const aspect of map.aspects) {
    const current = allByName.get(aspect.aspectName) ?? [];
    allByName.set(aspect.aspectName, [...current, aspect.aspectId]);
  }
  return aspects.every((aspect) => {
    const definition = WORLD_PHYSICAL_CONTEXT_ASPECT_DEFINITIONS.find(
      ({ kind }) => kind === aspect.aspectName,
    );
    if (definition === undefined || aspect.seedMetadata.seedScope !== 'map/entity') return false;
    const expectedDependencies = definition.directDependencyKinds
      .flatMap((kind) => allByName.get(kind) ?? [])
      .sort();
    return (
      aspect.mapId === map.mapId &&
      aspect.entityId === owner &&
      aspect.aspectId === deriveWorldPhysicalContextAspectId(owner, definition.kind) &&
      String(aspect.generatorId) === definition.kind &&
      aspect.generatorVersion === definition.behaviorVersion &&
      aspect.parameterSchemaVersion === definition.parameterSchemaVersion &&
      aspect.seedScope === definition.seedScope &&
      aspect.seedMetadata.mapId === map.mapId &&
      aspect.seedMetadata.entityId === owner &&
      aspect.seedMetadata.aspectName === aspect.aspectName &&
      aspect.seedMetadata.generatorId === aspect.generatorId &&
      aspect.seedMetadata.generatorVersion === aspect.generatorVersion &&
      aspect.seedMetadata.variantRevision === aspect.variantRevision &&
      hasExactPhysicalParameters(aspect) &&
      aspect.diagnostics.every(
        ({ severity, target }) => severity !== 'error' && target.aspectId === aspect.aspectId,
      ) &&
      sameIds(
        aspect.dependencyAspects.map(({ aspectId }) => aspectId),
        expectedDependencies,
      )
    );
  });
}

function hasExactPhysicalParameters(aspect: AcceptedAspectRecord): boolean {
  const parameters = aspect.parameters;
  if (!isRecord(parameters)) return false;
  switch (aspect.aspectName) {
    case 'worldTerrain.mountainSystems':
      return (
        hasExactKeys(parameters, [
          'mountainCharacter',
          'parameterSchemaVersion',
          'ridgeGeometryVersion',
        ]) &&
        parameters.parameterSchemaVersion === 1 &&
        parameters.ridgeGeometryVersion === WORLD_PHYSICAL_GEOMETRY_VERSION &&
        Object.values(MOUNTAIN_CHARACTERS).some((value) => value === parameters.mountainCharacter)
      );
    case 'worldClimate.temperature':
    case 'worldClimate.prevailingWinds':
      return (
        hasExactKeys(parameters, [
          'climateCharacter',
          'fieldEncodingVersion',
          'parameterSchemaVersion',
        ]) &&
        parameters.parameterSchemaVersion === 1 &&
        parameters.fieldEncodingVersion === WORLD_PHYSICAL_FIELD_ENCODING_VERSION &&
        Object.values(CLIMATE_CHARACTERS).some((value) => value === parameters.climateCharacter)
      );
    case 'worldClimate.moisture':
    case 'worldClimate.zones':
    case 'worldEcology.biomeBelts':
      return (
        hasExactKeys(parameters, [
          'classificationPolicyVersion',
          'fieldEncodingVersion',
          'parameterSchemaVersion',
        ]) &&
        parameters.parameterSchemaVersion === 1 &&
        parameters.classificationPolicyVersion === WORLD_PHYSICAL_CLASSIFICATION_POLICY_VERSION &&
        parameters.fieldEncodingVersion === WORLD_PHYSICAL_FIELD_ENCODING_VERSION
      );
    case 'worldHydrology.watersheds':
    case 'worldHydrology.majorRivers':
    case 'worldHydrology.majorLakes':
      return (
        hasExactKeys(parameters, [
          'geometryVersion',
          'graphPolicyVersion',
          'parameterSchemaVersion',
        ]) &&
        parameters.parameterSchemaVersion === 1 &&
        parameters.graphPolicyVersion === WORLD_PHYSICAL_GRAPH_POLICY_VERSION &&
        parameters.geometryVersion === WORLD_PHYSICAL_GEOMETRY_VERSION
      );
    default:
      return false;
  }
}

function controlsFrom(
  aspects: readonly AcceptedAspectRecord[],
): WorldPhysicalContextControls | undefined {
  const mountain = aspects.find(({ aspectName }) => aspectName === 'worldTerrain.mountainSystems');
  const temperature = aspects.find(({ aspectName }) => aspectName === 'worldClimate.temperature');
  if (!isRecord(mountain?.parameters) || !isRecord(temperature?.parameters)) return undefined;
  const controls = {
    mountainCharacter: mountain.parameters.mountainCharacter,
    climateCharacter: temperature.parameters.climateCharacter,
  } as WorldPhysicalContextControls;
  return validateWorldPhysicalContextControls(controls).length === 0 ? controls : undefined;
}

function output(
  byName: ReadonlyMap<string, AcceptedAspectRecord>,
  name: WorldPhysicalContextAspectKind,
): unknown {
  return byName.get(name)?.acceptedOutput;
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  const orderedLeft = [...left].sort();
  const orderedRight = [...right].sort();
  return (
    orderedLeft.length === orderedRight.length &&
    orderedLeft.every((value, index) => value === orderedRight[index])
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): boolean {
  const keys = Object.keys(value).sort();
  const orderedExpected = [...expected].sort();
  return (
    keys.length === orderedExpected.length &&
    keys.every((key, index) => key === orderedExpected[index])
  );
}

function invalid(message: string): ReconstructAcceptedWorldPhysicalContextResult {
  return Object.freeze({ status: 'invalid', message });
}
