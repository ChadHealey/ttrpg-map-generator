import {
  type AcceptedAspectRecord,
  atlasSampleReaderToArray,
  formatWorldSeed,
  isAtlasSampleReader,
  type MapDocument,
  type SeedInput,
  type WorldDocument,
} from '@ttrpg-map/core';

import { type AcceptedAspectDto, acceptedAspectDtoSchema } from './accepted-aspect-dto-schema.js';
import { orderAcceptedAspectDto, orderMapDocumentDto } from './dto-ordering.js';
import { type MapDocumentDto, mapDocumentDtoSchema } from './map-document-dto-schema.js';
import {
  ACCEPTED_ASPECT_SCHEMA_VERSION,
  MAP_DOCUMENT_SCHEMA_VERSION,
  type PersistenceResult,
  WORLD_INDEX_SCHEMA_VERSION,
} from './persistence-model.js';
import { validateDto } from './schema-validation.js';

export function acceptedAspectToDto(
  aspect: AcceptedAspectRecord,
  filePath: string,
): PersistenceResult<AcceptedAspectDto> {
  const raw = {
    acceptedAspectSchemaVersion: ACCEPTED_ASPECT_SCHEMA_VERSION,
    mapId: aspect.mapId,
    entityId: aspect.entityId,
    aspectId: aspect.aspectId,
    aspectName: aspect.aspectName,
    generatorId: aspect.generatorId,
    generatorVersion: aspect.generatorVersion,
    parameterSchemaVersion: aspect.parameterSchemaVersion,
    parameters: aspect.parameters,
    seedScope: aspect.seedScope,
    seedMetadata: seedInputToDto(aspect.seedMetadata),
    variantRevision: aspect.variantRevision,
    dependencyAspects: aspect.dependencyAspects.map((reference) => ({
      aspectId: reference.aspectId,
      ...(reference.contextProvenance === undefined
        ? {}
        : { contextProvenance: { ...reference.contextProvenance } }),
    })),
    generationStatus: aspect.generationStatus,
    diagnostics: aspect.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      severity: diagnostic.severity,
      target: { aspectId: diagnostic.target.aspectId },
      message: diagnostic.message,
      suggestedAction: diagnostic.suggestedAction,
    })),
    acceptedOutput: acceptedOutputToDto(aspect),
  };
  const validated = validateDto(acceptedAspectDtoSchema, raw, filePath);
  return validated.ok ? { ok: true, value: orderAcceptedAspectDto(validated.value) } : validated;
}

function acceptedOutputToDto(aspect: AcceptedAspectRecord): unknown {
  if (aspect.aspectName === 'worldTerrain.macroElevation') {
    const output = asRecord(aspect.acceptedOutput);
    if (output === undefined || !isAtlasSampleReader(output.values)) return aspect.acceptedOutput;
    return { ...output, values: atlasSampleReaderToArray(output.values) };
  }
  if (aspect.aspectName === 'worldSurface.landWaterClassification') {
    const output = asRecord(aspect.acceptedOutput);
    if (output === undefined || !isAtlasSampleReader(output.samples)) return aspect.acceptedOutput;
    return { ...output, samples: atlasSampleReaderToArray(output.samples) };
  }
  return aspect.acceptedOutput;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
}

export function mapDocumentToDto(map: MapDocument): PersistenceResult<MapDocumentDto> {
  const filePath = mapFilePath(map.mapId);
  const aspects: AcceptedAspectDto[] = [];
  for (const aspect of map.aspects) {
    const converted = acceptedAspectToDto(aspect, filePath);
    if (!converted.ok) return converted;
    aspects.push(converted.value);
  }
  const acceptedState = {
    entities: map.entities.map((entity) => ({ ...entity })),
    aspects,
    constraints: map.constraints.map((constraint) => ({
      constraintId: constraint.constraintId,
      constraintKind: constraint.constraintKind,
      target: { aspectId: constraint.target.aspectId },
      parameters: constraint.parameters,
    })),
    locks: map.locks.map((lock) => ({
      lockId: lock.lockId,
      target: { aspectId: lock.target.aspectId },
    })),
    decoration: {
      aspectReferences: map.decoration.aspectReferences.map((reference) => ({ ...reference })),
    },
    layout: {
      aspectReferences: map.layout.aspectReferences.map((reference) => ({ ...reference })),
    },
  };
  const regionalParent =
    map.mapKind === 'regional'
      ? {
          parentMapId: map.parent.parentMapId,
          rootMapId: map.parent.rootMapId,
          relationshipKind: map.parent.relationshipKind,
          contextStatusAspectId: map.parent.contextStatusAspectId,
        }
      : undefined;
  const raw =
    map.mapKind === 'world'
      ? {
          mapDocumentSchemaVersion: MAP_DOCUMENT_SCHEMA_VERSION,
          mapId: map.mapId,
          mapKind: map.mapKind,
          scaleClass: map.scaleClass,
          displayName: map.displayName,
          coordinateSystem: {
            kind: map.coordinateSystem.kind,
            rootSurfaceId: map.coordinateSystem.rootSurfaceId,
            radius: { radiusMillimeters: map.coordinateSystem.radius.radiusMillimeters },
          },
          extent: { ...map.extent },
          ...acceptedState,
        }
      : {
          mapDocumentSchemaVersion: MAP_DOCUMENT_SCHEMA_VERSION,
          mapId: map.mapId,
          mapKind: map.mapKind,
          scaleClass: map.scaleClass,
          displayName: map.displayName,
          parent: regionalParent,
          coordinateSystem: {
            ...map.coordinateSystem,
            origin: { ...map.coordinateSystem.origin },
            radius: { radiusMillimeters: map.coordinateSystem.radius.radiusMillimeters },
          },
          extent: { ...map.extent },
          ...acceptedState,
        };
  const validated = validateDto(mapDocumentDtoSchema, raw, filePath);
  return validated.ok ? { ok: true, value: orderMapDocumentDto(validated.value) } : validated;
}

export function orderedMaps(document: WorldDocument): readonly MapDocument[] {
  return [...document.maps].sort((left, right) => {
    if (left.mapKind !== right.mapKind) return left.mapKind === 'world' ? -1 : 1;
    return left.mapId < right.mapId ? -1 : left.mapId > right.mapId ? 1 : 0;
  });
}

export function mapFilePath(mapId: string): string {
  return `maps/${mapId}.json`;
}

export function worldIndexRaw(document: WorldDocument) {
  return {
    worldIndexSchemaVersion: WORLD_INDEX_SCHEMA_VERSION,
    worldDocumentId: document.worldDocumentId,
    displayName: document.displayName,
    worldSeed: formatWorldSeed(document.worldSeed),
    rootMapId: document.rootMapId,
    mapFiles: orderedMaps(document).map((map) =>
      map.mapKind === 'world'
        ? { mapId: map.mapId, mapKind: map.mapKind, path: mapFilePath(map.mapId) }
        : {
            mapId: map.mapId,
            mapKind: map.mapKind,
            parentMapId: map.parent.parentMapId,
            path: mapFilePath(map.mapId),
          },
    ),
  };
}

function seedInputToDto(seed: SeedInput): Readonly<Record<string, unknown>> {
  const common = {
    seedDerivationVersion: seed.seedDerivationVersion,
    deterministicStreamVersion: seed.deterministicStreamVersion,
    seedScope: seed.seedScope,
    worldSeed: formatWorldSeed(seed.worldSeed),
    generatorId: seed.generatorId,
    generatorVersion: seed.generatorVersion,
    aspectName: seed.aspectName,
    variantRevision: seed.variantRevision,
  };
  switch (seed.seedScope) {
    case 'map/entity':
      return { ...common, mapId: seed.mapId, entityId: seed.entityId };
    case 'root-coordinate':
      return { ...common, rootSurfaceId: seed.rootSurfaceId, point: { ...seed.point } };
    case 'shared-boundary':
      return { ...common, boundaryPortalId: seed.boundaryPortalId };
  }
}
