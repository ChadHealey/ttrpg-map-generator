import {
  CONSTRAINT_KINDS,
  COORDINATE_TRANSFORM_VERSION,
  createImmutableDomainSnapshot,
  type MapDocument,
  parsePlanetPoint,
  parseRegionalExtent,
  parseStableId,
  parseWorldRadius,
  PLANET_REGIONAL_TRANSFORM_ID,
  type WorldMap,
} from '@ttrpg-map/core';

import { acceptedAspectFromDto } from './accepted-aspect-from-dto.js';
import { parseCoreValue } from './core-parsing.js';
import { type MapDocumentDto } from './map-document-dto-schema.js';
import {
  persistenceDiagnostic,
  persistenceFailure,
  persistenceSuccess,
} from './persistence-diagnostics.js';
import { PERSISTENCE_DIAGNOSTIC_CODES, type PersistenceResult } from './persistence-model.js';

export function mapDocumentFromDto(
  dto: MapDocumentDto,
  filePath: string,
): PersistenceResult<MapDocument> {
  const mapId = parseCoreValue(parseStableId('map', dto.mapId), filePath, '$.mapId');
  if (!mapId.ok) return mapId;
  const entities = [];
  for (const [index, entity] of dto.entities.entries()) {
    const entityId = parseCoreValue(
      parseStableId('entity', entity.entityId),
      filePath,
      `$.entities[${String(index)}].entityId`,
    );
    if (!entityId.ok) return entityId;
    entities.push({ entityId: entityId.value, displayName: entity.displayName });
  }
  const aspects = [];
  for (const [index, aspect] of dto.aspects.entries()) {
    const converted = acceptedAspectFromDto(aspect, filePath, index);
    if (!converted.ok) return converted;
    aspects.push(converted.value);
  }
  const constraints = [];
  for (const [index, constraint] of dto.constraints.entries()) {
    const constraintId = parseCoreValue(
      parseStableId('constraint', constraint.constraintId),
      filePath,
      `$.constraints[${String(index)}].constraintId`,
    );
    if (!constraintId.ok) return constraintId;
    const targetId = parseCoreValue(
      parseStableId('aspect', constraint.target.aspectId),
      filePath,
      `$.constraints[${String(index)}].target.aspectId`,
    );
    if (!targetId.ok) return targetId;
    constraints.push({
      constraintId: constraintId.value,
      constraintKind: CONSTRAINT_KINDS.proofKeepWithinExtent,
      target: { aspectId: targetId.value },
      parameters: constraint.parameters,
    });
  }
  const locks = [];
  for (const [index, lock] of dto.locks.entries()) {
    const lockId = parseCoreValue(
      parseStableId('lock', lock.lockId),
      filePath,
      `$.locks[${String(index)}].lockId`,
    );
    if (!lockId.ok) return lockId;
    const targetId = parseCoreValue(
      parseStableId('aspect', lock.target.aspectId),
      filePath,
      `$.locks[${String(index)}].target.aspectId`,
    );
    if (!targetId.ok) return targetId;
    locks.push({ lockId: lockId.value, target: { aspectId: targetId.value } });
  }
  const decoration = referencesFromDto(dto.decoration.aspectReferences, filePath, '$.decoration');
  if (!decoration.ok) return decoration;
  const layout = referencesFromDto(dto.layout.aspectReferences, filePath, '$.layout');
  if (!layout.ok) return layout;
  const acceptedState = {
    entities,
    aspects,
    constraints,
    locks,
    decoration: { aspectReferences: decoration.value },
    layout: { aspectReferences: layout.value },
  };

  const converted =
    dto.mapKind === 'world'
      ? worldMapFromDto(dto, mapId.value, acceptedState, filePath)
      : regionalMapFromDto(dto, mapId.value, acceptedState, filePath);
  if (!converted.ok) return converted;
  const snapshot = createImmutableDomainSnapshot(converted.value);
  if (!snapshot.ok) {
    return persistenceFailure(
      persistenceDiagnostic(
        PERSISTENCE_DIAGNOSTIC_CODES.immutableSnapshotInvalid,
        filePath,
        '$',
        'The validated map could not be reconstructed as a deeply readonly domain record.',
        'Restore plain canonical JSON values without aliases or executable properties.',
      ),
    );
  }
  return persistenceSuccess(snapshot.value);
}

function worldMapFromDto(
  dto: Extract<MapDocumentDto, { readonly mapKind: 'world' }>,
  mapId: MapDocument['mapId'],
  acceptedState: AcceptedState,
  filePath: string,
): PersistenceResult<WorldMap> {
  const rootSurfaceId = parseCoreValue(
    parseStableId('root-surface', dto.coordinateSystem.rootSurfaceId),
    filePath,
    '$.coordinateSystem.rootSurfaceId',
  );
  if (!rootSurfaceId.ok) return rootSurfaceId;
  const radius = parseCoreValue(
    parseWorldRadius(dto.coordinateSystem.radius),
    filePath,
    '$.coordinateSystem.radius',
  );
  if (!radius.ok) return radius;
  const map: WorldMap = {
    mapId,
    mapKind: 'world',
    scaleClass: 'world',
    displayName: dto.displayName,
    coordinateSystem: {
      kind: 'planet-sphere',
      rootSurfaceId: rootSurfaceId.value,
      radius: radius.value,
    },
    extent: { kind: 'whole-surface' },
    ...acceptedState,
  };
  return persistenceSuccess(map);
}

function regionalMapFromDto(
  dto: Extract<MapDocumentDto, { readonly mapKind: 'regional' }>,
  mapId: MapDocument['mapId'],
  acceptedState: AcceptedState,
  filePath: string,
): PersistenceResult<MapDocument> {
  const parentMapId = parseCoreValue(
    parseStableId('map', dto.parent.parentMapId),
    filePath,
    '$.parent.parentMapId',
  );
  if (!parentMapId.ok) return parentMapId;
  const rootMapId = parseCoreValue(
    parseStableId('map', dto.parent.rootMapId),
    filePath,
    '$.parent.rootMapId',
  );
  if (!rootMapId.ok) return rootMapId;
  const contextStatusAspectId = parseCoreValue(
    parseStableId('aspect', dto.parent.contextStatusAspectId),
    filePath,
    '$.parent.contextStatusAspectId',
  );
  if (!contextStatusAspectId.ok) return contextStatusAspectId;
  const rootSurfaceId = parseCoreValue(
    parseStableId('root-surface', dto.coordinateSystem.rootSurfaceId),
    filePath,
    '$.coordinateSystem.rootSurfaceId',
  );
  if (!rootSurfaceId.ok) return rootSurfaceId;
  const origin = parseCoreValue(
    parsePlanetPoint(dto.coordinateSystem.origin),
    filePath,
    '$.coordinateSystem.origin',
  );
  if (!origin.ok) return origin;
  const radius = parseCoreValue(
    parseWorldRadius(dto.coordinateSystem.radius),
    filePath,
    '$.coordinateSystem.radius',
  );
  if (!radius.ok) return radius;
  const extent = parseCoreValue(parseRegionalExtent(dto.extent), filePath, '$.extent');
  if (!extent.ok) return extent;
  return persistenceSuccess({
    mapId,
    mapKind: 'regional',
    scaleClass: 'regional',
    displayName: dto.displayName,
    parent: {
      parentMapId: parentMapId.value,
      rootMapId: rootMapId.value,
      relationshipKind: 'world-to-regional',
      contextStatusAspectId: contextStatusAspectId.value,
    },
    coordinateSystem: {
      kind: 'regional-azimuthal-equidistant',
      rootSurfaceId: rootSurfaceId.value,
      transformId: PLANET_REGIONAL_TRANSFORM_ID,
      transformVersion: COORDINATE_TRANSFORM_VERSION,
      origin: origin.value,
      radius: radius.value,
    },
    extent: extent.value,
    ...acceptedState,
  });
}

function referencesFromDto(
  references: readonly { readonly aspectId: string }[],
  filePath: string,
  fieldPath: string,
) {
  const parsedReferences = [];
  for (const [index, reference] of references.entries()) {
    const aspectId = parseCoreValue(
      parseStableId('aspect', reference.aspectId),
      filePath,
      `${fieldPath}.aspectReferences[${String(index)}].aspectId`,
    );
    if (!aspectId.ok) return aspectId;
    parsedReferences.push({ aspectId: aspectId.value });
  }
  return persistenceSuccess(parsedReferences);
}

interface AcceptedState {
  readonly entities: MapDocument['entities'];
  readonly aspects: MapDocument['aspects'];
  readonly constraints: MapDocument['constraints'];
  readonly locks: MapDocument['locks'];
  readonly decoration: MapDocument['decoration'];
  readonly layout: MapDocument['layout'];
}
