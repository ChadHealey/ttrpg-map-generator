/**
 * Minimal authoritative records for the Milestone 1 world-document ownership model.
 *
 * These records contain accepted domain state only. They deliberately contain no inherited
 * context, generator implementation, persistence DTO, render scene, or mutation capability.
 */

import {
  type COORDINATE_TRANSFORM_VERSION,
  type PLANET_REGIONAL_TRANSFORM_ID,
} from './coordinate-transforms.js';
import type { PlanetPoint, RegionalExtent, WorldRadius } from './coordinates.js';
import type { AcceptedAspectRecord, AspectReference, DeepReadonly } from './generated-aspects.js';
import type {
  AspectId,
  ConstraintId,
  EntityId,
  LockId,
  MapId,
  RootSurfaceId,
  WorldDocumentId,
} from './identity.js';
import type { WorldSeed } from './seed-input.js';

export const MAP_KINDS = {
  regional: 'regional',
  world: 'world',
} as const;

export const MAP_SCALE_CLASSES = {
  regional: 'regional',
  world: 'world',
} as const;

export const MAP_RELATIONSHIP_KINDS = {
  worldToRegional: 'world-to-regional',
} as const;

export const MAP_COORDINATE_SYSTEM_KINDS = {
  planetSphere: 'planet-sphere',
  regionalAzimuthalEquidistant: 'regional-azimuthal-equidistant',
} as const;

export const WORLD_MAP_EXTENT_KIND = 'whole-surface' as const;

export const CONSTRAINT_KINDS = {
  proofKeepWithinExtent: 'proof.keep-within-extent',
} as const;

export type MapKind = (typeof MAP_KINDS)[keyof typeof MAP_KINDS];
export type MapScaleClass = (typeof MAP_SCALE_CLASSES)[keyof typeof MAP_SCALE_CLASSES];
export type MapRelationshipKind =
  (typeof MAP_RELATIONSHIP_KINDS)[keyof typeof MAP_RELATIONSHIP_KINDS];
export type ConstraintKind = (typeof CONSTRAINT_KINDS)[keyof typeof CONSTRAINT_KINDS];

/** A meaningful semantic entity owned by exactly one map. */
export interface MapEntity {
  readonly entityId: EntityId;
  readonly displayName: string;
}

/** Minimal accepted user intent targeting one stable aspect. */
export interface AspectConstraint<Parameters = unknown> {
  readonly constraintId: ConstraintId;
  readonly constraintKind: ConstraintKind;
  readonly target: AspectReference;
  readonly parameters: DeepReadonly<Parameters>;
}

/** Accepted protection from regeneration for one stable aspect. */
export interface AspectLock {
  readonly lockId: LockId;
  readonly target: AspectReference;
}

/** Stable references to accepted aspect records whose outputs are map decoration. */
export interface AcceptedDecoration {
  readonly aspectReferences: readonly AspectReference[];
}

/** Stable references to accepted aspect records whose outputs define map layout. */
export interface MapLayoutState {
  readonly aspectReferences: readonly AspectReference[];
}

/** Accepted records shared by both currently supported map kinds. */
export interface MapAcceptedState {
  readonly entities: readonly MapEntity[];
  readonly aspects: readonly AcceptedAspectRecord[];
  readonly constraints: readonly AspectConstraint[];
  readonly locks: readonly AspectLock[];
  readonly decoration: AcceptedDecoration;
  readonly layout: MapLayoutState;
}

/** The authoritative spherical coordinate system owned by the root map. */
export interface WorldMapCoordinateSystem {
  readonly kind: typeof MAP_COORDINATE_SYSTEM_KINDS.planetSphere;
  readonly rootSurfaceId: RootSurfaceId;
  readonly radius: WorldRadius;
}

/** The root world map covers its complete oriented spherical surface. */
export interface WorldMapExtent {
  readonly kind: typeof WORLD_MAP_EXTENT_KIND;
}

/** Persistable parameters for the accepted planet-to-regional coordinate contract. */
export interface RegionalMapCoordinateSystem {
  readonly kind: typeof MAP_COORDINATE_SYSTEM_KINDS.regionalAzimuthalEquidistant;
  readonly rootSurfaceId: RootSurfaceId;
  readonly transformId: typeof PLANET_REGIONAL_TRANSFORM_ID;
  readonly transformVersion: typeof COORDINATE_TRANSFORM_VERSION;
  readonly origin: PlanetPoint;
  readonly radius: WorldRadius;
}

/** The only child relationship supported during Milestone 1. */
export interface RegionalMapParent {
  readonly parentMapId: MapId;
  readonly rootMapId: MapId;
  readonly relationshipKind: typeof MAP_RELATIONSHIP_KINDS.worldToRegional;
  /** Stable aspect whose query-time metadata reports whether inherited context is stale. */
  readonly contextStatusAspectId: AspectId;
}

/** The exactly-one root map kind in a valid world document. */
export interface WorldMap extends MapAcceptedState {
  readonly mapId: MapId;
  readonly mapKind: typeof MAP_KINDS.world;
  readonly scaleClass: typeof MAP_SCALE_CLASSES.world;
  readonly displayName: string;
  readonly coordinateSystem: WorldMapCoordinateSystem;
  readonly extent: WorldMapExtent;
}

/** A local physical child map owned by the root world map in Milestone 1. */
export interface RegionalMap extends MapAcceptedState {
  readonly mapId: MapId;
  readonly mapKind: typeof MAP_KINDS.regional;
  readonly scaleClass: typeof MAP_SCALE_CLASSES.regional;
  readonly displayName: string;
  readonly parent: RegionalMapParent;
  readonly coordinateSystem: RegionalMapCoordinateSystem;
  readonly extent: RegionalExtent;
}

export type MapDocument = WorldMap | RegionalMap;

/**
 * The readonly authoritative save unit. Valid documents contain one root `WorldMap` whose ID
 * equals `rootMapId`, plus zero or more owned `RegionalMap` records.
 */
export interface WorldDocument {
  readonly worldDocumentId: WorldDocumentId;
  readonly displayName: string;
  readonly worldSeed: WorldSeed;
  readonly rootMapId: MapId;
  readonly maps: readonly MapDocument[];
}

/** Opaque identity domains that participate directly in ownership traversal. */
export type OwnershipRecordId =
  WorldDocumentId | MapId | EntityId | AspectId | ConstraintId | LockId;
