/**
 * Deterministic ownership validation and traversal for authoritative world documents.
 *
 * Aspect dependency references are intentionally ignored here. They belong to the independent
 * dependency DAG and never change which map or entity owns an accepted record.
 */

import type { AcceptedAspectRecord } from './generated-aspects.js';
import type { MapId } from './identity.js';
import {
  MAP_KINDS,
  MAP_RELATIONSHIP_KINDS,
  type MapDocument,
  type OwnershipRecordId,
  type RegionalMap,
  type WorldDocument,
  type WorldMap,
} from './world-document.js';

export const OWNERSHIP_DIAGNOSTIC_CODES = {
  duplicateOwnership: 'ownership.record.duplicate-owner',
  missingParent: 'ownership.parent.missing',
  missingRoot: 'ownership.root.missing',
  multipleRoots: 'ownership.root.multiple',
  ownerMismatch: 'ownership.record.owner-mismatch',
  ownershipCycle: 'ownership.cycle.detected',
  rootReferenceMismatch: 'ownership.root-reference.mismatch',
  unsupportedMapKind: 'ownership.map-kind.unsupported',
  unsupportedRelationship: 'ownership.relationship.unsupported',
} as const;

export type OwnershipDiagnosticCode =
  (typeof OWNERSHIP_DIAGNOSTIC_CODES)[keyof typeof OWNERSHIP_DIAGNOSTIC_CODES];

export type OwnershipRecordKind =
  'aspect' | 'constraint' | 'entity' | 'lock' | 'map' | 'world-document';

/** A deterministic ownership finding with stable code and opaque record identities. */
export interface OwnershipDiagnostic {
  readonly code: OwnershipDiagnosticCode;
  readonly recordKind: OwnershipRecordKind;
  readonly recordIds: readonly OwnershipRecordId[];
  readonly message: string;
}

export type OwnershipTraversalNode =
  | {
      readonly kind: 'world-document';
      readonly worldDocumentId: WorldDocument['worldDocumentId'];
    }
  | {
      readonly kind: 'world-map';
      readonly mapId: MapId;
      readonly ownerWorldDocumentId: WorldDocument['worldDocumentId'];
    }
  | {
      readonly kind: 'regional-map';
      readonly mapId: MapId;
      readonly ownerMapId: MapId;
    }
  | {
      readonly kind: 'entity';
      readonly entityId: WorldMap['entities'][number]['entityId'];
      readonly ownerMapId: MapId;
    }
  | {
      readonly kind: 'aspect';
      readonly aspectId: AcceptedAspectRecord['aspectId'];
      readonly ownerEntityId: AcceptedAspectRecord['entityId'];
    }
  | {
      readonly kind: 'constraint';
      readonly constraintId: WorldMap['constraints'][number]['constraintId'];
      readonly ownerMapId: MapId;
    }
  | {
      readonly kind: 'lock';
      readonly lockId: WorldMap['locks'][number]['lockId'];
      readonly ownerMapId: MapId;
    };

export type OwnershipTraversalResult =
  | { readonly ok: true; readonly nodes: readonly OwnershipTraversalNode[] }
  | { readonly ok: false; readonly diagnostics: readonly OwnershipDiagnostic[] };

interface OwnershipOccurrence {
  readonly recordKind: OwnershipRecordKind;
  readonly recordId: OwnershipRecordId;
  readonly ownerId: OwnershipRecordId;
}

interface OwnershipAnalysis {
  readonly diagnostics: readonly OwnershipDiagnostic[];
  readonly mapsById: ReadonlyMap<MapId, MapDocument>;
  readonly rootMap?: WorldMap;
}

/** Validate the complete ownership tree and return findings in canonical order. */
export function validateWorldDocumentOwnership(
  document: WorldDocument,
): readonly OwnershipDiagnostic[] {
  return analyzeOwnership(document).diagnostics;
}

/**
 * Return root-first, owner-before-child traversal with siblings ordered by opaque stable ID.
 * Invalid ownership returns the same canonical diagnostics as validation and no partial tree.
 */
export function getCanonicalOwnershipTraversal(document: WorldDocument): OwnershipTraversalResult {
  const analysis = analyzeOwnership(document);
  if (analysis.diagnostics.length > 0 || analysis.rootMap === undefined) {
    return Object.freeze({ ok: false, diagnostics: analysis.diagnostics });
  }

  const nodes: OwnershipTraversalNode[] = [
    Object.freeze({ kind: 'world-document', worldDocumentId: document.worldDocumentId }),
  ];
  visitMap(document, analysis.rootMap, analysis.mapsById, nodes);
  return Object.freeze({ ok: true, nodes: Object.freeze(nodes) });
}

function analyzeOwnership(document: WorldDocument): OwnershipAnalysis {
  const diagnostics: OwnershipDiagnostic[] = [];
  const occurrences: OwnershipOccurrence[] = [];
  const mapsByTextId = new Map<string, MapDocument[]>();
  const worldMaps: WorldMap[] = [];

  for (const map of document.maps) {
    appendMap(mapsByTextId, map);
    const ownerId =
      map.mapKind === MAP_KINDS.regional ? map.parent.parentMapId : document.worldDocumentId;
    occurrences.push({
      recordKind: 'map',
      recordId: map.mapId,
      ownerId,
    });

    if (map.mapKind === MAP_KINDS.world) {
      worldMaps.push(map);
    } else {
      const mapKind: string = map.mapKind;
      if (mapKind !== MAP_KINDS.regional) {
        diagnostics.push(
          diagnostic(
            OWNERSHIP_DIAGNOSTIC_CODES.unsupportedMapKind,
            'map',
            [map.mapId],
            `Map ${map.mapId} uses unsupported map kind ${mapKind}.`,
          ),
        );
      }
    }

    collectContainedOccurrences(map, occurrences, diagnostics);
  }

  const onlyRoot = worldMaps.length === 1 ? worldMaps[0] : undefined;
  if (worldMaps.length === 0) {
    diagnostics.push(
      diagnostic(
        OWNERSHIP_DIAGNOSTIC_CODES.missingRoot,
        'map',
        [document.rootMapId],
        `World document ${document.worldDocumentId} has no root WorldMap.`,
      ),
    );
  } else if (worldMaps.length > 1) {
    diagnostics.push(
      diagnostic(
        OWNERSHIP_DIAGNOSTIC_CODES.multipleRoots,
        'map',
        worldMaps.map((map) => map.mapId),
        `World document ${document.worldDocumentId} contains multiple root WorldMap records.`,
      ),
    );
  } else if (onlyRoot !== undefined && onlyRoot.mapId !== document.rootMapId) {
    diagnostics.push(
      diagnostic(
        OWNERSHIP_DIAGNOSTIC_CODES.rootReferenceMismatch,
        'map',
        [document.rootMapId, onlyRoot.mapId],
        `Declared root map ${document.rootMapId} does not identify the document's WorldMap.`,
      ),
    );
  }

  diagnostics.push(...duplicateOwnershipDiagnostics(occurrences));
  const uniqueMaps = uniqueMapsById(mapsByTextId);
  validateRegionalParents(
    document,
    uniqueMaps,
    new Set(document.maps.map((map) => map.mapId)),
    diagnostics,
  );
  diagnostics.push(...ownershipCycleDiagnostics(uniqueMaps));

  return Object.freeze({
    diagnostics: Object.freeze(diagnostics.sort(compareDiagnostics)),
    mapsById: uniqueMaps,
    ...(onlyRoot?.mapId === document.rootMapId ? { rootMap: onlyRoot } : {}),
  });
}

function appendMap(mapsByTextId: Map<string, MapDocument[]>, map: MapDocument): void {
  const records = mapsByTextId.get(map.mapId);
  if (records === undefined) {
    mapsByTextId.set(map.mapId, [map]);
  } else {
    records.push(map);
  }
}

function collectContainedOccurrences(
  map: MapDocument,
  occurrences: OwnershipOccurrence[],
  diagnostics: OwnershipDiagnostic[],
): void {
  const containedEntityIds = new Set(map.entities.map((entity) => entity.entityId));
  for (const entity of map.entities) {
    occurrences.push({ recordKind: 'entity', recordId: entity.entityId, ownerId: map.mapId });
  }
  for (const aspect of map.aspects) {
    occurrences.push({
      recordKind: 'aspect',
      recordId: aspect.aspectId,
      ownerId: aspect.entityId,
    });
    if (aspect.mapId !== map.mapId || !containedEntityIds.has(aspect.entityId)) {
      diagnostics.push(
        diagnostic(
          OWNERSHIP_DIAGNOSTIC_CODES.ownerMismatch,
          'aspect',
          [aspect.aspectId, map.mapId, aspect.mapId, aspect.entityId],
          `Aspect ${aspect.aspectId} does not name its containing map and entity as its owner.`,
        ),
      );
    }
  }
  for (const constraint of map.constraints) {
    occurrences.push({
      recordKind: 'constraint',
      recordId: constraint.constraintId,
      ownerId: map.mapId,
    });
  }
  for (const lock of map.locks) {
    occurrences.push({ recordKind: 'lock', recordId: lock.lockId, ownerId: map.mapId });
  }
}

function duplicateOwnershipDiagnostics(
  occurrences: readonly OwnershipOccurrence[],
): readonly OwnershipDiagnostic[] {
  const grouped = new Map<string, OwnershipOccurrence[]>();
  for (const occurrence of occurrences) {
    const key = `${occurrence.recordKind}\0${occurrence.recordId}`;
    const group = grouped.get(key);
    if (group === undefined) {
      grouped.set(key, [occurrence]);
    } else {
      group.push(occurrence);
    }
  }

  const diagnostics: OwnershipDiagnostic[] = [];
  for (const group of grouped.values()) {
    if (group.length < 2) continue;
    const first = group[0];
    if (first === undefined) continue;
    const owners = uniqueSortedIds(group.map((occurrence) => occurrence.ownerId));
    diagnostics.push(
      diagnostic(
        OWNERSHIP_DIAGNOSTIC_CODES.duplicateOwnership,
        first.recordKind,
        [first.recordId, ...owners],
        `${capitalize(first.recordKind)} ${first.recordId} appears ${String(group.length)} times in the ownership tree.`,
      ),
    );
  }
  return diagnostics;
}

function uniqueMapsById(
  mapsByTextId: ReadonlyMap<string, readonly MapDocument[]>,
): ReadonlyMap<MapId, MapDocument> {
  const unique = new Map<MapId, MapDocument>();
  for (const records of mapsByTextId.values()) {
    if (records.length === 1 && records[0] !== undefined) {
      unique.set(records[0].mapId, records[0]);
    }
  }
  return unique;
}

function validateRegionalParents(
  document: WorldDocument,
  mapsById: ReadonlyMap<MapId, MapDocument>,
  existingMapIds: ReadonlySet<MapId>,
  diagnostics: OwnershipDiagnostic[],
): void {
  for (const map of mapsById.values()) {
    if (map.mapKind !== MAP_KINDS.regional) continue;
    const regionalMap = map;
    const parent = mapsById.get(regionalMap.parent.parentMapId);
    const relationshipKind: string = regionalMap.parent.relationshipKind;
    if (!existingMapIds.has(regionalMap.parent.parentMapId)) {
      diagnostics.push(
        diagnostic(
          OWNERSHIP_DIAGNOSTIC_CODES.missingParent,
          'map',
          [regionalMap.mapId, regionalMap.parent.parentMapId],
          `RegionalMap ${regionalMap.mapId} references missing parent ${regionalMap.parent.parentMapId}.`,
        ),
      );
    }

    if (regionalMap.parent.rootMapId !== document.rootMapId) {
      diagnostics.push(
        diagnostic(
          OWNERSHIP_DIAGNOSTIC_CODES.rootReferenceMismatch,
          'map',
          [regionalMap.mapId, regionalMap.parent.rootMapId, document.rootMapId],
          `RegionalMap ${regionalMap.mapId} does not retain the document root-map reference.`,
        ),
      );
    }

    if (
      relationshipKind !== MAP_RELATIONSHIP_KINDS.worldToRegional ||
      parent?.mapKind !== MAP_KINDS.world ||
      regionalMap.parent.parentMapId !== document.rootMapId
    ) {
      diagnostics.push(
        diagnostic(
          OWNERSHIP_DIAGNOSTIC_CODES.unsupportedRelationship,
          'map',
          [regionalMap.mapId, regionalMap.parent.parentMapId],
          `RegionalMap ${regionalMap.mapId} does not use the supported WorldMap-to-RegionalMap relationship.`,
        ),
      );
    }
  }
}

function ownershipCycleDiagnostics(
  mapsById: ReadonlyMap<MapId, MapDocument>,
): readonly OwnershipDiagnostic[] {
  const state = new Map<MapId, 'done' | 'visiting'>();
  const stack: MapId[] = [];
  const stackIndexes = new Map<MapId, number>();
  const cycles = new Map<string, readonly MapId[]>();

  function visit(mapId: MapId): void {
    if (state.get(mapId) === 'done') return;
    const existingIndex = stackIndexes.get(mapId);
    if (existingIndex !== undefined) {
      const cycleIds = uniqueSortedIds(stack.slice(existingIndex)) as readonly MapId[];
      cycles.set(cycleIds.join('\0'), cycleIds);
      return;
    }

    state.set(mapId, 'visiting');
    stackIndexes.set(mapId, stack.length);
    stack.push(mapId);
    const map = mapsById.get(mapId);
    if (map?.mapKind === MAP_KINDS.regional && mapsById.has(map.parent.parentMapId)) {
      visit(map.parent.parentMapId);
    }
    stack.pop();
    stackIndexes.delete(mapId);
    state.set(mapId, 'done');
  }

  for (const mapId of [...mapsById.keys()].sort(compareAscii)) {
    visit(mapId);
  }

  return [...cycles.values()].map((cycleIds) =>
    diagnostic(
      OWNERSHIP_DIAGNOSTIC_CODES.ownershipCycle,
      'map',
      cycleIds,
      `Map ownership contains a cycle among ${cycleIds.join(', ')}.`,
    ),
  );
}

function visitMap(
  document: WorldDocument,
  map: MapDocument,
  mapsById: ReadonlyMap<MapId, MapDocument>,
  nodes: OwnershipTraversalNode[],
): void {
  if (map.mapKind === MAP_KINDS.world) {
    nodes.push(
      Object.freeze({
        kind: 'world-map',
        mapId: map.mapId,
        ownerWorldDocumentId: document.worldDocumentId,
      }),
    );
  } else {
    nodes.push(
      Object.freeze({
        kind: 'regional-map',
        mapId: map.mapId,
        ownerMapId: map.parent.parentMapId,
      }),
    );
  }

  for (const entity of [...map.entities].sort((left, right) =>
    compareAscii(left.entityId, right.entityId),
  )) {
    nodes.push(Object.freeze({ kind: 'entity', entityId: entity.entityId, ownerMapId: map.mapId }));
    for (const aspect of map.aspects
      .filter((candidate) => candidate.entityId === entity.entityId)
      .sort((left, right) => compareAscii(left.aspectId, right.aspectId))) {
      nodes.push(
        Object.freeze({
          kind: 'aspect',
          aspectId: aspect.aspectId,
          ownerEntityId: entity.entityId,
        }),
      );
    }
  }

  for (const constraint of [...map.constraints].sort((left, right) =>
    compareAscii(left.constraintId, right.constraintId),
  )) {
    nodes.push(
      Object.freeze({
        kind: 'constraint',
        constraintId: constraint.constraintId,
        ownerMapId: map.mapId,
      }),
    );
  }
  for (const lock of [...map.locks].sort((left, right) =>
    compareAscii(left.lockId, right.lockId),
  )) {
    nodes.push(Object.freeze({ kind: 'lock', lockId: lock.lockId, ownerMapId: map.mapId }));
  }

  const children = [...mapsById.values()]
    .filter(
      (candidate): candidate is RegionalMap =>
        candidate.mapKind === MAP_KINDS.regional && candidate.parent.parentMapId === map.mapId,
    )
    .sort((left, right) => compareAscii(left.mapId, right.mapId));
  for (const child of children) {
    visitMap(document, child, mapsById, nodes);
  }
}

function diagnostic(
  code: OwnershipDiagnosticCode,
  recordKind: OwnershipRecordKind,
  recordIds: readonly OwnershipRecordId[],
  message: string,
): OwnershipDiagnostic {
  return Object.freeze({ code, recordKind, recordIds: uniqueSortedIds(recordIds), message });
}

function uniqueSortedIds(ids: readonly OwnershipRecordId[]): readonly OwnershipRecordId[] {
  return Object.freeze([...new Set(ids)].sort(compareAscii));
}

function compareDiagnostics(left: OwnershipDiagnostic, right: OwnershipDiagnostic): number {
  return (
    compareAscii(left.code, right.code) ||
    compareAscii(left.recordKind, right.recordKind) ||
    compareAscii(left.recordIds.join('\0'), right.recordIds.join('\0')) ||
    compareAscii(left.message, right.message)
  );
}

function compareAscii(left: string, right: string): -1 | 0 | 1 {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
