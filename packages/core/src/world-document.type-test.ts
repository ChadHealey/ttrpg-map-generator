import type { EntityId, MapId } from './identity.js';
import type { RegionalMap, WorldDocument, WorldMap } from './world-document.js';

declare const document: WorldDocument;
declare const worldMap: WorldMap;
declare const regionalMap: RegionalMap;
declare const entityId: EntityId;
declare const mapId: MapId;

// @ts-expect-error The authoritative document map collection is readonly.
document.maps = [worldMap];
// @ts-expect-error The declared root identity cannot be mutated.
document.rootMapId = mapId;
// @ts-expect-error Map identity cannot be replaced by entity identity.
worldMap.mapId = entityId;
// @ts-expect-error The root map cannot claim a future map kind.
worldMap.mapKind = 'settlement';
// @ts-expect-error A regional map always retains exactly one parent record.
regionalMap.parent = undefined;
// @ts-expect-error Milestone 1 accepts only the world-to-regional relationship kind.
regionalMap.parent.relationshipKind = 'regional-to-settlement';
// @ts-expect-error Accepted ownership records do not expose a dependency graph collection.
document.dependencyAspects = [];

void [document, worldMap, regionalMap];
