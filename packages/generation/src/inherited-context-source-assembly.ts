import {
  type AcceptedAspectRecord,
  type AspectId,
  type AtlasGeographyRecords,
  type EntityId,
  type InheritedContextBoundaryPortal,
  type InheritedContextField,
  type InheritedContextFieldSample,
  type InheritedContextGeometryAnchor,
  type InheritedContextNamedAnchor,
  type InheritedContextSourceAspectVersion,
  type InheritedContextSourceLineage,
  type PlanetPoint,
  type RegionalExtent,
  type RegionalRectangleFootprint,
  type WorldFeatureNameContent,
  type WorldFeatureNameParameters,
  type WorldMap,
  type WorldPhysicalContextRecords,
  type WorldSeed,
} from '@ttrpg-map/core';

import {
  clipInheritedContextGeometry,
  type InheritedContextPathSource,
} from './inherited-context-clipping.js';
import {
  toInheritedContextNamedAnchor,
  validateInheritedContextNameAspects,
} from './inherited-context-name-sources.js';
const CONTEXT_SOURCE_ASPECT_NAMES = new Set([
  'worldTerrain.macroElevation',
  'worldSurface.landWaterClassification',
  'worldCoastline.geometry',
  'worldEcology.biomeBelts',
  'worldClimate.zones',
  'worldClimate.moisture',
  'worldClimate.prevailingWinds',
  'worldClimate.temperature',
  'worldHydrology.watersheds',
  'worldTerrain.mountainSystems',
  'worldHydrology.majorRivers',
  'worldHydrology.majorLakes',
]);
export interface AcceptedBuildSource {
  readonly rootMap: WorldMap;
  readonly worldSeed: WorldSeed;
  readonly geography: AtlasGeographyRecords;
  readonly physical: WorldPhysicalContextRecords;
  readonly acceptedNameAspects: readonly AcceptedAspectRecord<
    WorldFeatureNameParameters,
    WorldFeatureNameContent
  >[];
}

export interface SelectedInheritedContextAnchor {
  readonly sampleIndex: number;
  readonly rootPoint: PlanetPoint;
}

export type AcceptedContextMemberAssembly =
  | {
      readonly ok: true;
      readonly fields: readonly InheritedContextField[];
      readonly geometryAnchors: readonly InheritedContextGeometryAnchor[];
      readonly boundaryPortals: readonly InheritedContextBoundaryPortal[];
      readonly namedAnchors: readonly InheritedContextNamedAnchor[];
      readonly sourceAspectVersions: readonly InheritedContextSourceAspectVersion[];
      readonly sourceLineage: readonly InheritedContextSourceLineage[];
    }
  | {
      readonly ok: false;
      readonly category: 'clipping' | 'name' | 'source';
      readonly subject: string;
      readonly message: string;
    };

export function assembleAcceptedContextMembers(
  source: AcceptedBuildSource,
  footprint: RegionalRectangleFootprint,
  collar: RegionalExtent,
  anchors: readonly SelectedInheritedContextAnchor[],
): AcceptedContextMemberAssembly {
  const names = validateInheritedContextNameAspects(source);
  if (!names.ok) return failure('name', 'acceptedNameAspects', names.message);
  const aspects = acceptedAspectByName(source.rootMap);
  if (aspects === undefined)
    return failure('source', 'rootMap.aspects', 'Accepted source aspect names must be unique.');
  const fields = buildFields(source, aspects, anchors);
  if (fields === undefined)
    return failure(
      'source',
      'fields',
      'Accepted field readers or source aspect envelopes are incomplete.',
    );
  const pathSources = geometrySources(source, aspects);
  if (pathSources === undefined)
    return failure(
      'source',
      'geometry',
      'Accepted geometry source aspect envelopes are incomplete.',
    );
  const clipped = clipInheritedContextGeometry(pathSources, footprint, collar);
  if (!clipped.ok) return failure('clipping', 'geometry', clipped.message);

  const intersecting = intersectingNamedEntities(source, anchors, clipped.intersectingAnchorIds);
  const namedAnchors = names.aspects
    .filter(({ acceptedOutput }) => intersecting.has(acceptedOutput.entityId))
    .map(toInheritedContextNamedAnchor)
    .sort((left, right) => compareAscii(left.sourceEntityId, right.sourceEntityId));
  const usedAspectIds = new Set<AspectId>([
    ...fields.map(({ sourceAspectId }) => sourceAspectId),
    ...clipped.anchors.map(({ sourceAspectId }) => sourceAspectId),
    ...clipped.portals.map(({ sourceAspectId }) => sourceAspectId),
    ...namedAnchors.map(({ sourceAspectId }) => sourceAspectId),
  ]);
  const versions = buildSourceVersions(
    [...source.rootMap.aspects, ...names.aspects],
    usedAspectIds,
  );
  if (versions === undefined)
    return failure(
      'source',
      'sourceAspectVersions',
      'Every emitted member must resolve to one accepted source aspect envelope.',
    );
  return {
    ok: true,
    fields,
    geometryAnchors: clipped.anchors,
    boundaryPortals: clipped.portals,
    namedAnchors: Object.freeze(namedAnchors),
    sourceAspectVersions: versions,
    sourceLineage: buildLineage(versions),
  };
}

function buildFields(
  source: AcceptedBuildSource,
  aspects: ReadonlyMap<string, AcceptedAspectRecord>,
  anchors: readonly SelectedInheritedContextAnchor[],
): readonly InheritedContextField[] | undefined {
  const physical = source.physical;
  const definitions = [
    [
      'biome-belts',
      'value',
      'semantic-key',
      physical.biomeBelts.values,
      physical.biomeBelts.provenance,
    ],
    [
      'climate-zones',
      'value',
      'semantic-key',
      physical.climateZones.values,
      physical.climateZones.provenance,
    ],
    [
      'land-water-classification',
      'value',
      'land-water-class',
      source.geography.landWaterClassification.samples,
      undefined,
    ],
    [
      'macro-elevation',
      'value',
      'integer-ticks',
      source.geography.macroElevation.values,
      undefined,
    ],
    ['moisture', 'value', 'integer-ticks', physical.moisture.values, physical.moisture.provenance],
    [
      'prevailing-winds-direction',
      'x',
      'integer-ticks',
      physical.prevailingWinds.xComponents.values,
      physical.prevailingWinds.xComponents.provenance,
    ],
    [
      'prevailing-winds-direction',
      'y',
      'integer-ticks',
      physical.prevailingWinds.yComponents.values,
      physical.prevailingWinds.yComponents.provenance,
    ],
    [
      'prevailing-winds-direction',
      'z',
      'integer-ticks',
      physical.prevailingWinds.zComponents.values,
      physical.prevailingWinds.zComponents.provenance,
    ],
    [
      'prevailing-winds-speed',
      'speed',
      'integer-ticks',
      physical.prevailingWinds.speed.values,
      physical.prevailingWinds.speed.provenance,
    ],
    [
      'temperature',
      'value',
      'integer-ticks',
      physical.temperature.values,
      physical.temperature.provenance,
    ],
    [
      'watershed-assignment',
      'value',
      'entity-id',
      physical.watersheds.values,
      physical.watersheds.provenance,
    ],
  ] as const;
  const result: InheritedContextField[] = [];
  for (const [fieldKind, component, valueEncoding, reader, provenance] of definitions) {
    const aspect = aspects.get(fieldAspectName(fieldKind));
    if (aspect === undefined) return undefined;
    const samples: InheritedContextFieldSample[] = [];
    for (const anchor of anchors) {
      const value = reader.at(anchor.sampleIndex);
      if (value === undefined) return undefined;
      samples.push(
        Object.freeze({
          sampleIndex: anchor.sampleIndex,
          rootPoint: anchor.rootPoint,
          values: Object.freeze([value]),
        }),
      );
    }
    result.push(
      Object.freeze({
        sourceMapId: source.rootMap.mapId,
        sourceEntityId: aspect.entityId,
        sourceAspectId: aspect.aspectId,
        fieldKind,
        component,
        valueEncoding,
        ...(provenance === undefined ? {} : { sourceFingerprint: provenance.fingerprint }),
        samples: Object.freeze(samples),
      }),
    );
  }
  return Object.freeze(result);
}

function geometrySources(
  source: AcceptedBuildSource,
  aspects: ReadonlyMap<string, AcceptedAspectRecord>,
): readonly InheritedContextPathSource[] | undefined {
  const definitions = [
    ...source.geography.coastline.rings.map((ring) => ({
      aspectName: 'worldCoastline.geometry',
      sourceAnchorId: ring.ringId,
      anchorKind: 'coastline' as const,
      portalKind: 'coastline' as const,
      paths: [{ points: ring.points, closed: true }],
    })),
    ...source.physical.biomeBelts.beltSummaries.map((belt) => ({
      aspectName: 'worldEcology.biomeBelts',
      sourceAnchorId: belt.entityId,
      anchorKind: 'biome-belt' as const,
      paths: [{ points: belt.boundaryPoints, closed: true }],
    })),
    ...source.physical.mountainSystems.systems.map((system) => ({
      aspectName: 'worldTerrain.mountainSystems',
      sourceAnchorId: system.entityId,
      anchorKind: 'mountain-system' as const,
      portalKind: 'mountain-ridge' as const,
      paths: system.centerlines.map((points) => ({ points, closed: isClosed(points) })),
    })),
    ...source.physical.watersheds.watersheds.map((watershed) => ({
      aspectName: 'worldHydrology.watersheds',
      sourceAnchorId: watershed.entityId,
      anchorKind: 'watershed-divide' as const,
      portalKind: 'watershed-divide' as const,
      paths: watershed.divideLines.map((points) => ({ points, closed: isClosed(points) })),
    })),
    ...source.physical.majorRivers.map((river) => ({
      aspectName: 'worldHydrology.majorRivers',
      sourceAnchorId: river.entityId,
      anchorKind: 'major-river' as const,
      portalKind: 'river' as const,
      paths: [{ points: river.centerline, closed: false }],
    })),
    ...source.physical.majorLakes.map((lake) => ({
      aspectName: 'worldHydrology.majorLakes',
      sourceAnchorId: lake.entityId,
      anchorKind: 'major-lake' as const,
      portalKind: 'lake' as const,
      paths: [{ points: lake.ring, closed: true }],
    })),
  ];
  const result: InheritedContextPathSource[] = [];
  for (const definition of definitions) {
    if (
      definition.paths.length === 0 ||
      definition.paths.every(({ points }) => points.length === 0)
    )
      continue;
    const aspect = aspects.get(definition.aspectName);
    if (aspect === undefined) return undefined;
    result.push({
      sourceMapId: source.rootMap.mapId,
      sourceEntityId: aspect.entityId,
      sourceAspectId: aspect.aspectId,
      sourceAnchorId: definition.sourceAnchorId,
      anchorKind: definition.anchorKind,
      ...('portalKind' in definition ? { portalKind: definition.portalKind } : {}),
      paths: definition.paths,
    });
  }
  return Object.freeze(result);
}

function intersectingNamedEntities(
  source: AcceptedBuildSource,
  anchors: readonly SelectedInheritedContextAnchor[],
  geometryIds: ReadonlySet<string>,
): ReadonlySet<EntityId> {
  const result = new Set<EntityId>();
  const samples = anchors.map(({ sampleIndex }) => sampleIndex);
  for (const landmass of source.geography.landmasses)
    if (membershipIntersects(landmass.membership.sampleRanges, samples))
      result.add(landmass.entityId);
  for (const water of source.geography.waterBodies)
    if (membershipIntersects(water.membership.sampleRanges, samples)) result.add(water.entityId);
  for (const sampleIndex of samples) {
    const watershedId = source.physical.watersheds.values.at(sampleIndex);
    if (watershedId !== undefined) result.add(watershedId);
  }
  for (const ring of source.geography.coastline.rings) {
    if (!geometryIds.has(ring.ringId)) continue;
    result.add(ring.landmassId);
    for (const waterId of ring.waterBodyIds) result.add(waterId);
  }
  for (const group of source.geography.islandGroups)
    if (group.memberLandmassIds.some((id) => result.has(id))) result.add(group.entityId);
  for (const id of geometryIds) result.add(id as EntityId);
  return result;
}

function buildSourceVersions(
  aspects: readonly AcceptedAspectRecord[],
  used: ReadonlySet<AspectId>,
) {
  const byId = new Map<AspectId, AcceptedAspectRecord>();
  for (const aspect of aspects) {
    if (byId.has(aspect.aspectId)) return undefined;
    byId.set(aspect.aspectId, aspect);
  }
  const result: InheritedContextSourceAspectVersion[] = [];
  for (const id of [...used].sort(compareAscii)) {
    const aspect = byId.get(id);
    if (aspect === undefined) return undefined;
    result.push(
      Object.freeze({
        sourceMapId: aspect.mapId,
        sourceEntityId: aspect.entityId,
        sourceAspectId: id,
        aspectName: aspect.aspectName,
        generatorVersion: aspect.generatorVersion,
        parameterSchemaVersion: aspect.parameterSchemaVersion,
        variantRevision: aspect.variantRevision,
      }),
    );
  }
  return Object.freeze(result);
}

function buildLineage(versions: readonly InheritedContextSourceAspectVersion[]) {
  const byKey = new Map<string, InheritedContextSourceLineage>();
  for (const value of versions) {
    const lineage = Object.freeze({
      sourceMapId: value.sourceMapId,
      sourceEntityId: value.sourceEntityId,
    });
    byKey.set(`${lineage.sourceMapId}\n${lineage.sourceEntityId}`, lineage);
  }
  return Object.freeze(
    [...byKey.entries()]
      .sort(([left], [right]) => compareAscii(left, right))
      .map(([, value]) => value),
  );
}

function acceptedAspectByName(map: WorldMap) {
  const result = new Map<string, AcceptedAspectRecord>();
  for (const aspect of map.aspects) {
    if (!CONTEXT_SOURCE_ASPECT_NAMES.has(aspect.aspectName)) continue;
    if (result.has(aspect.aspectName)) return undefined;
    result.set(aspect.aspectName, aspect);
  }
  return result;
}

function fieldAspectName(kind: InheritedContextField['fieldKind']): string {
  return {
    'biome-belts': 'worldEcology.biomeBelts',
    'climate-zones': 'worldClimate.zones',
    'land-water-classification': 'worldSurface.landWaterClassification',
    'macro-elevation': 'worldTerrain.macroElevation',
    moisture: 'worldClimate.moisture',
    'prevailing-winds-direction': 'worldClimate.prevailingWinds',
    'prevailing-winds-speed': 'worldClimate.prevailingWinds',
    temperature: 'worldClimate.temperature',
    'watershed-assignment': 'worldHydrology.watersheds',
  }[kind];
}

function membershipIntersects(
  ranges: readonly { readonly startIndex: number; readonly endIndexExclusive: number }[],
  selected: readonly number[],
) {
  return ranges.some(({ startIndex, endIndexExclusive }) =>
    selected.some((index) => index >= startIndex && index < endIndexExclusive),
  );
}

function isClosed(points: readonly PlanetPoint[]) {
  const first = points[0];
  const last = points[points.length - 1];
  return (
    first !== undefined &&
    first.longitudeTicks === last?.longitudeTicks &&
    first.latitudeTicks === last.latitudeTicks
  );
}

function failure(
  category: 'clipping' | 'name' | 'source',
  subject: string,
  message: string,
): AcceptedContextMemberAssembly {
  return { ok: false, category, subject, message };
}

function compareAscii(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}
