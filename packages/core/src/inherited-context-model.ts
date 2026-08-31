/** Version-1 world-to-region inherited-context records from ADR-0022 through ADR-0026. */

import type { BehaviorVersion, ParameterSchemaVersion, VariantRevision } from './compatibility.js';
import type { PlanetPoint, RegionalExtent, RegionalPoint } from './coordinates.js';
import type { AspectName } from './generated-aspects.js';
import type {
  AspectId,
  BoundaryPortalId,
  CoastlineRingId,
  EntityId,
  MapId,
  RootSurfaceId,
  SemanticKey,
} from './identity.js';
import type { RegionalRectangleFootprint } from './regional-footprint-model.js';
import type { WorldPhysicalFieldKind } from './world-physical-context-model.js';

declare const INHERITED_CONTEXT_SEMANTIC_CHECKSUM_BRAND: unique symbol;

export const INHERITED_CONTEXT_CONTRACT_VERSION = 1 as const;
export const INHERITED_CONTEXT_COLLAR_VERSION = 1 as const;
export const INHERITED_CONTEXT_ROOT_REFINEMENT_NAMESPACE_VERSION = 1 as const;
export const INHERITED_CONTEXT_SEMANTIC_CHECKSUM_VERSION = 1 as const;
export const INHERITED_CONTEXT_SEMANTIC_CHECKSUM_ALGORITHM = 'sha256' as const;
export const INHERITED_CONTEXT_PORTAL_ORDER = 'counterclockwise-from-southwest-v1' as const;

export type InheritedContextSemanticChecksum = string & {
  readonly [INHERITED_CONTEXT_SEMANTIC_CHECKSUM_BRAND]: 'inherited-context-semantic-checksum';
};

/** One map/entity source in the ownership chain that contributed accepted context. */
export interface InheritedContextSourceLineage {
  readonly sourceMapId: MapId;
  readonly sourceEntityId: EntityId;
}

/** Exact accepted-aspect compatibility state used to assemble the snapshot. */
export interface InheritedContextSourceAspectVersion extends InheritedContextSourceLineage {
  readonly sourceAspectId: AspectId;
  readonly aspectName: AspectName;
  readonly generatorVersion: BehaviorVersion;
  readonly parameterSchemaVersion: ParameterSchemaVersion;
  readonly variantRevision: VariantRevision;
}

/** Shared root-coordinate seed namespace used by this child and adjacent surface children. */
export interface InheritedContextRootRefinementNamespace {
  readonly namespaceVersion: typeof INHERITED_CONTEXT_ROOT_REFINEMENT_NAMESPACE_VERSION;
  readonly rootSurfaceId: RootSurfaceId;
  readonly seedScope: 'root-coordinate';
}

/** The local physical domain whose accepted source values surround the selected footprint. */
export interface InheritedContextCollar {
  readonly collarVersion: typeof INHERITED_CONTEXT_COLLAR_VERSION;
  readonly extent: RegionalExtent;
}

export type InheritedContextFieldKind =
  'macro-elevation' | 'land-water-classification' | WorldPhysicalFieldKind;

export type InheritedContextFieldComponent = 'value' | 'x' | 'y' | 'z' | 'speed';

export type InheritedContextFieldValueEncoding =
  'entity-id' | 'integer-ticks' | 'land-water-class' | 'semantic-key';

/** Canonical class values embedded by a clipped land/water field sample. */
export type InheritedContextLandWaterClass = 'land' | 'water';

export type InheritedContextFieldSampleValue =
  number | EntityId | SemanticKey | InheritedContextLandWaterClass;

/** One accepted full-profile anchor selected without resampling it into a child-owned field. */
export interface InheritedContextFieldSample {
  readonly sampleIndex: number;
  readonly rootPoint: PlanetPoint;
  readonly values: readonly InheritedContextFieldSampleValue[];
}

/** One clipped component from an accepted scalar, categorical, or vector field. */
export interface InheritedContextField {
  readonly sourceMapId: MapId;
  readonly sourceEntityId: EntityId;
  readonly sourceAspectId: AspectId;
  readonly fieldKind: InheritedContextFieldKind;
  readonly component: InheritedContextFieldComponent;
  readonly valueEncoding: InheritedContextFieldValueEncoding;
  readonly sourceFingerprint?: string;
  readonly samples: readonly InheritedContextFieldSample[];
}

export type InheritedContextGeometryAnchorKind =
  | 'biome-belt'
  | 'coastline'
  | 'major-lake'
  | 'major-river'
  | 'mountain-system'
  | 'watershed-divide';

/** Planet-native accepted geometry retained as a regional refinement constraint. */
export interface InheritedContextGeometryAnchor {
  readonly sourceMapId: MapId;
  readonly sourceEntityId: EntityId;
  readonly sourceAspectId: AspectId;
  readonly sourceAnchorId: EntityId | CoastlineRingId;
  readonly anchorKind: InheritedContextGeometryAnchorKind;
  readonly paths: readonly (readonly PlanetPoint[])[];
}

export type InheritedContextBoundaryPortalKind =
  'coastline' | 'lake' | 'mountain-ridge' | 'river' | 'route' | 'watershed-divide';

/** One stable continuation crossing the authoritative local footprint boundary. */
export interface InheritedContextBoundaryPortal {
  readonly portalId: BoundaryPortalId;
  readonly portalKind: InheritedContextBoundaryPortalKind;
  readonly sourceMapId: MapId;
  readonly sourceEntityId: EntityId;
  readonly sourceAspectId: AspectId;
  readonly rootPoint: PlanetPoint;
  readonly localPoint: RegionalPoint;
}

export type InheritedContextNameKind =
  'island-group' | 'lake' | 'landmass' | 'mountain-system' | 'river' | 'water-body' | 'watershed';

/** Accepted world name provenance carried as a source reference, never as child identity. */
export interface InheritedContextNamedAnchor {
  readonly sourceMapId: MapId;
  readonly sourceEntityId: EntityId;
  readonly sourceAspectId: AspectId;
  readonly nameKind: InheritedContextNameKind;
  readonly displayName: string;
  readonly nameContentBehaviorVersion: BehaviorVersion;
  readonly lexiconVersion: BehaviorVersion;
  readonly variantRevision: VariantRevision;
  readonly origin: 'generated' | 'manual-override';
}

/** Complete semantic content covered by the inherited-context checksum. */
export interface InheritedContextSnapshotContent {
  readonly contractVersion: typeof INHERITED_CONTEXT_CONTRACT_VERSION;
  readonly rootMapId: MapId;
  readonly parentMapId: MapId;
  readonly footprintId: EntityId;
  readonly footprint: RegionalRectangleFootprint;
  readonly rootRefinementNamespace: InheritedContextRootRefinementNamespace;
  readonly collar: InheritedContextCollar;
  readonly sourceLineage: readonly InheritedContextSourceLineage[];
  readonly sourceAspectVersions: readonly InheritedContextSourceAspectVersion[];
  readonly fields: readonly InheritedContextField[];
  readonly geometryAnchors: readonly InheritedContextGeometryAnchor[];
  readonly boundaryPortals: readonly InheritedContextBoundaryPortal[];
  readonly namedAnchors: readonly InheritedContextNamedAnchor[];
}

export interface InheritedContextSemanticChecksumRecord {
  readonly algorithm: typeof INHERITED_CONTEXT_SEMANTIC_CHECKSUM_ALGORITHM;
  readonly checksumVersion: typeof INHERITED_CONTEXT_SEMANTIC_CHECKSUM_VERSION;
  readonly value: InheritedContextSemanticChecksum;
}

/** The immutable domain snapshot later owned by a v2 regional parent record. */
export interface InheritedContextSnapshot extends InheritedContextSnapshotContent {
  readonly semanticChecksum: InheritedContextSemanticChecksumRecord;
}

export const INHERITED_CONTEXT_DIAGNOSTIC_CODES = {
  invalidRecord: 'inherited-context.record.invalid',
  invalidVersion: 'inherited-context.version.invalid',
  invalidReference: 'inherited-context.reference.invalid',
  invalidOrdering: 'inherited-context.ordering.invalid',
  invalidCoordinate: 'inherited-context.coordinate.invalid',
  outsideCollar: 'inherited-context.collar.outside',
  invalidPortal: 'inherited-context.portal.invalid',
  checksumMismatch: 'inherited-context.semantic-checksum.mismatch',
} as const;

export type InheritedContextDiagnosticCode =
  (typeof INHERITED_CONTEXT_DIAGNOSTIC_CODES)[keyof typeof INHERITED_CONTEXT_DIAGNOSTIC_CODES];

export interface InheritedContextDiagnostic {
  readonly code: InheritedContextDiagnosticCode;
  readonly subject: string;
  readonly message: string;
}

export type InheritedContextParseResult =
  | { readonly ok: true; readonly value: InheritedContextSnapshot }
  | { readonly ok: false; readonly diagnostics: readonly InheritedContextDiagnostic[] };
