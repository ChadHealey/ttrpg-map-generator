import {
  createAspectDependencyGraph,
  createPlanetRegionalTransform,
  type MapDocument,
  parseInheritedContextSnapshot,
  reconstructAcceptedAtlas,
  validateRoundTripSafeRegionalExtent,
  validateWorldDocumentOwnership,
  type WorldDocument,
} from '@ttrpg-map/core';

import { mapFilePath } from './domain-to-dto.js';
import { comparePersistenceDiagnostics, persistenceDiagnostic } from './persistence-diagnostics.js';
import { PERSISTENCE_DIAGNOSTIC_CODES, type PersistenceDiagnostic } from './persistence-model.js';
import { validateProofRecords } from './proof-validation.js';

export function validateDocumentForPersistence(
  document: WorldDocument,
): readonly PersistenceDiagnostic[] {
  const diagnostics: PersistenceDiagnostic[] = [];
  for (const finding of validateWorldDocumentOwnership(document)) {
    diagnostics.push(
      persistenceDiagnostic(
        PERSISTENCE_DIAGNOSTIC_CODES.ownershipInvalid,
        'world.json',
        '$.mapFiles',
        `${finding.code}: ${finding.message}`,
        'Restore a world document with exactly one root WorldMap and valid owned records.',
      ),
    );
  }

  const graph = createAspectDependencyGraph(document);
  if (!graph.ok) {
    for (const finding of graph.diagnostics) {
      diagnostics.push(
        persistenceDiagnostic(
          PERSISTENCE_DIAGNOSTIC_CODES.dependencyInvalid,
          'world.json',
          '$.mapFiles',
          `${finding.code}: ${finding.message}`,
          finding.suggestedAction,
        ),
      );
    }
  }

  const root = document.maps.find((map) => map.mapId === document.rootMapId);
  const documentAspectIds = new Set(
    document.maps.flatMap((map) => map.aspects.map(({ aspectId }) => aspectId)),
  );
  for (const map of document.maps) {
    diagnostics.push(...validateMapReferences(map, documentAspectIds));
    diagnostics.push(...validateSeedMetadata(document, map));
    if (map.mapKind === 'regional') {
      const transform = createPlanetRegionalTransform(
        map.coordinateSystem.origin,
        map.coordinateSystem.radius,
      );
      const extent = validateRoundTripSafeRegionalExtent(map.extent, transform);
      if (
        !extent.ok ||
        root?.mapKind !== 'world' ||
        root.coordinateSystem.rootSurfaceId !== map.coordinateSystem.rootSurfaceId ||
        root.coordinateSystem.radius.radiusMillimeters !==
          map.coordinateSystem.radius.radiusMillimeters
      ) {
        diagnostics.push(
          persistenceDiagnostic(
            PERSISTENCE_DIAGNOSTIC_CODES.referenceInvalid,
            mapFilePath(map.mapId),
            '$.coordinateSystem',
            'The regional transform must share the root surface and radius and contain a round-trip-safe extent.',
            'Restore the regional transform and extent from their accepted root-world contract.',
          ),
        );
      }
      diagnostics.push(...validateInheritedContextOwner(document, map));
    }
  }

  diagnostics.push(...validateProofRecords(document));
  const atlas = reconstructAcceptedAtlas(document);
  if (atlas.status === 'invalid') {
    diagnostics.push(
      ...atlas.diagnostics.map((finding) =>
        persistenceDiagnostic(
          PERSISTENCE_DIAGNOSTIC_CODES.atlasInvalid,
          'world.json',
          '$.mapFiles',
          `${finding.code}: ${finding.message}`,
          finding.suggestedAction,
        ),
      ),
    );
  }
  return Object.freeze(diagnostics.sort(comparePersistenceDiagnostics));
}

function validateInheritedContextOwner(
  document: WorldDocument,
  map: Extract<MapDocument, { readonly mapKind: 'regional' }>,
): readonly PersistenceDiagnostic[] {
  const snapshot = map.parent.inheritedContext;
  if (snapshot === undefined) return [];
  const parsed = parseInheritedContextSnapshot(snapshot);
  const path = mapFilePath(map.mapId);
  if (!parsed.ok) {
    return parsed.diagnostics.map((finding) =>
      persistenceDiagnostic(
        PERSISTENCE_DIAGNOSTIC_CODES.referenceInvalid,
        path,
        '$.parent.inheritedContext',
        `${finding.code}: ${finding.message}`,
        'Restore the exact supplied inherited-context snapshot without repair or defaulting.',
      ),
    );
  }
  const context = parsed.value;
  const footprint = context.footprint;
  const lineageKeys = context.sourceLineage.map(
    ({ sourceMapId, sourceEntityId }) => `${sourceMapId}\n${sourceEntityId}`,
  );
  const sourceOwnerKeys = context.sourceAspectVersions.map(
    ({ sourceMapId, sourceEntityId }) => `${sourceMapId}\n${sourceEntityId}`,
  );
  const lineageValid =
    sameUniqueStrings(lineageKeys, sourceOwnerKeys) &&
    context.sourceLineage.every((source) => {
      const sourceMap = document.maps.find(({ mapId }) => mapId === source.sourceMapId);
      return (
        sourceMap?.entities.some(({ entityId }) => entityId === source.sourceEntityId) === true
      );
    });
  const sourceAspectsValid = context.sourceAspectVersions.every((source) => {
    const sourceMap = document.maps.find(({ mapId }) => mapId === source.sourceMapId);
    const sourceAspect = sourceMap?.aspects.find(
      ({ aspectId }) => aspectId === source.sourceAspectId,
    );
    return (
      sourceMap !== undefined &&
      sourceMap.entities.some(({ entityId }) => entityId === source.sourceEntityId) &&
      sourceAspect?.entityId === source.sourceEntityId &&
      sourceAspect.aspectName === source.aspectName
    );
  });
  const contextStatus = map.aspects.find(
    ({ aspectId }) => aspectId === map.parent.contextStatusAspectId,
  );
  const contextDependenciesValid =
    contextStatus !== undefined &&
    sameStrings(
      contextStatus.dependencyAspects.map(({ aspectId }) => aspectId),
      context.sourceAspectVersions.map(({ sourceAspectId }) => sourceAspectId),
    ) &&
    contextStatus.dependencyAspects.every(
      ({ contextProvenance }) =>
        contextProvenance?.kind === 'inherited-context' &&
        contextProvenance.parentMapId === map.parent.parentMapId &&
        contextProvenance.childMapId === map.mapId,
    );
  const exactOwner =
    context.rootMapId === document.rootMapId &&
    context.parentMapId === map.parent.parentMapId &&
    map.parent.rootMapId === document.rootMapId &&
    footprint.rootSurfaceId === map.coordinateSystem.rootSurfaceId &&
    footprint.worldRadius.radiusMillimeters === map.coordinateSystem.radius.radiusMillimeters &&
    footprint.origin.longitudeTicks === map.coordinateSystem.origin.longitudeTicks &&
    footprint.origin.latitudeTicks === map.coordinateSystem.origin.latitudeTicks &&
    footprint.extent.minXMillimeters === map.extent.minXMillimeters &&
    footprint.extent.maxXMillimeters === map.extent.maxXMillimeters &&
    footprint.extent.minYMillimeters === map.extent.minYMillimeters &&
    footprint.extent.maxYMillimeters === map.extent.maxYMillimeters &&
    lineageValid &&
    sourceAspectsValid &&
    contextDependenciesValid;
  return exactOwner
    ? []
    : [
        persistenceDiagnostic(
          PERSISTENCE_DIAGNOSTIC_CODES.referenceInvalid,
          path,
          '$.parent.inheritedContext',
          'Inherited context ownership, footprint, lineage, or source-aspect identity does not match its regional map.',
          'Restore the exact snapshot supplied for this regional owner; parent version drift may remain stale.',
        ),
      ];
}

function sameUniqueStrings(left: readonly string[], right: readonly string[]): boolean {
  const leftSet = [...new Set(left)].sort();
  const rightSet = [...new Set(right)].sort();
  return (
    leftSet.length === left.length &&
    leftSet.length === rightSet.length &&
    leftSet.every((value, index) => value === rightSet[index])
  );
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  const leftSet = [...new Set(left)].sort();
  const rightSet = [...new Set(right)].sort();
  return (
    leftSet.length === left.length &&
    rightSet.length === right.length &&
    leftSet.length === rightSet.length &&
    leftSet.every((value, index) => value === rightSet[index])
  );
}

function validateMapReferences(
  map: MapDocument,
  documentAspectIds: ReadonlySet<string>,
): readonly PersistenceDiagnostic[] {
  const diagnostics: PersistenceDiagnostic[] = [];
  const aspectIds = new Set(map.aspects.map(({ aspectId }) => aspectId));
  const references = [
    ...map.constraints.map((record) => ({
      fieldPath: `$.constraints[${JSON.stringify(record.constraintId)}].target`,
      aspectId: record.target.aspectId,
    })),
    ...map.locks.map((record) => ({
      fieldPath: `$.locks[${JSON.stringify(record.lockId)}].target`,
      aspectId: record.target.aspectId,
    })),
    ...map.decoration.aspectReferences.map((record) => ({
      fieldPath: '$.decoration.aspectReferences',
      aspectId: record.aspectId,
    })),
    ...map.layout.aspectReferences.map((record) => ({
      fieldPath: '$.layout.aspectReferences',
      aspectId: record.aspectId,
    })),
  ];
  for (const reference of references) {
    if (!aspectIds.has(reference.aspectId)) {
      diagnostics.push(referenceDiagnostic(map, reference.fieldPath, reference.aspectId));
    }
  }

  for (const aspect of map.aspects) {
    for (const finding of aspect.diagnostics) {
      if (!documentAspectIds.has(finding.target.aspectId)) {
        diagnostics.push(
          referenceDiagnostic(
            map,
            `$.aspects[${JSON.stringify(aspect.aspectId)}].diagnostics[${JSON.stringify(finding.code)}].target`,
            finding.target.aspectId,
          ),
        );
      }
    }
  }

  const duplicateReferenceGroups: readonly (readonly [string, readonly string[]])[] = [
    [
      '$.decoration.aspectReferences',
      map.decoration.aspectReferences.map(({ aspectId }) => aspectId),
    ],
    ['$.layout.aspectReferences', map.layout.aspectReferences.map(({ aspectId }) => aspectId)],
    ...map.aspects.map(
      (aspect) =>
        [
          `$.aspects[${JSON.stringify(aspect.aspectId)}].dependencyAspects`,
          aspect.dependencyAspects.map(({ aspectId }) => aspectId),
        ] as const,
    ),
  ];
  for (const [fieldPath, ids] of duplicateReferenceGroups) {
    if (new Set(ids).size !== ids.length) {
      diagnostics.push(
        persistenceDiagnostic(
          PERSISTENCE_DIAGNOSTIC_CODES.referenceInvalid,
          mapFilePath(map.mapId),
          fieldPath,
          'Reference collections cannot contain duplicate stable aspect IDs.',
          'Remove the duplicate reference without changing the accepted target record.',
        ),
      );
    }
  }
  return diagnostics;
}

function validateSeedMetadata(
  document: WorldDocument,
  map: MapDocument,
): readonly PersistenceDiagnostic[] {
  const diagnostics: PersistenceDiagnostic[] = [];
  for (const aspect of map.aspects) {
    const seed = aspect.seedMetadata;
    const commonMatches =
      seed.worldSeed === document.worldSeed &&
      seed.seedScope === aspect.seedScope &&
      seed.generatorId === aspect.generatorId &&
      seed.generatorVersion === aspect.generatorVersion &&
      seed.aspectName === aspect.aspectName &&
      seed.variantRevision === aspect.variantRevision;
    const scopeMatches =
      seed.seedScope !== 'map/entity' ||
      (seed.mapId === aspect.mapId && seed.entityId === aspect.entityId);
    if (!commonMatches || !scopeMatches) {
      diagnostics.push(
        persistenceDiagnostic(
          PERSISTENCE_DIAGNOSTIC_CODES.seedInvalid,
          mapFilePath(map.mapId),
          `$.aspects[${JSON.stringify(aspect.aspectId)}].seedMetadata`,
          'Accepted seed metadata must exactly match its document, address, versions, scope, and revision.',
          'Restore the original accepted seed namespace without normalizing or reseeding it.',
        ),
      );
    }
  }
  return diagnostics;
}

function referenceDiagnostic(
  map: MapDocument,
  fieldPath: string,
  aspectId: string,
): PersistenceDiagnostic {
  return persistenceDiagnostic(
    PERSISTENCE_DIAGNOSTIC_CODES.referenceInvalid,
    mapFilePath(map.mapId),
    fieldPath,
    `Reference targets missing accepted aspect ${aspectId}.`,
    'Restore the referenced accepted aspect or remove the referencing record explicitly.',
  );
}
