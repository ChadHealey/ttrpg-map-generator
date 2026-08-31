import type {
  AspectId,
  EntityId,
  InheritedContextBoundaryPortal,
  InheritedContextFieldSample,
  InheritedContextGeometryAnchor,
  InheritedContextSnapshot,
  MapId,
  PlanetPoint,
  RegionalPoint,
  RenderPoint,
  RenderScene,
} from './index.js';
import { validateInheritedContextSnapshot } from './index.js';

declare const snapshot: InheritedContextSnapshot;
declare const mapId: MapId;
declare const entityId: EntityId;
declare const aspectId: AspectId;
declare const planetPoint: PlanetPoint;
declare const regionalPoint: RegionalPoint;
declare const renderPoint: RenderPoint;
declare const renderScene: RenderScene;

validateInheritedContextSnapshot(snapshot);

const fieldSample: InheritedContextFieldSample = {
  sampleIndex: 0,
  rootPoint: planetPoint,
  values: [1, 'land'],
};

const invalidFieldSample: InheritedContextFieldSample = {
  sampleIndex: 0,
  // @ts-expect-error Regional coordinates cannot satisfy a planet-native field anchor.
  rootPoint: regionalPoint,
  values: [1],
};

const invalidRenderedFieldSample: InheritedContextFieldSample = {
  sampleIndex: 0,
  rootPoint: planetPoint,
  // @ts-expect-error Renderer records are not semantic field values.
  values: [renderScene],
};

const geometryAnchor: InheritedContextGeometryAnchor = {
  sourceMapId: mapId,
  sourceEntityId: entityId,
  sourceAspectId: aspectId,
  sourceAnchorId: entityId,
  anchorKind: 'mountain-system',
  paths: [[planetPoint]],
};

const invalidGeometryAnchor: InheritedContextGeometryAnchor = {
  sourceMapId: mapId,
  sourceEntityId: entityId,
  sourceAspectId: aspectId,
  sourceAnchorId: entityId,
  anchorKind: 'mountain-system',
  // @ts-expect-error Render pixels cannot enter planet-native semantic anchor geometry.
  paths: [[renderPoint]],
};

const portal: InheritedContextBoundaryPortal = {
  portalId: '00000000-0000-4000-8000-000000000001' as InheritedContextBoundaryPortal['portalId'],
  portalKind: 'river',
  sourceMapId: mapId,
  sourceEntityId: entityId,
  sourceAspectId: aspectId,
  rootPoint: planetPoint,
  localPoint: regionalPoint,
};

const invalidPortal: InheritedContextBoundaryPortal = {
  ...portal,
  // @ts-expect-error Render pixels cannot satisfy the typed regional portal location.
  localPoint: renderPoint,
};

void [
  fieldSample,
  invalidFieldSample,
  invalidRenderedFieldSample,
  geometryAnchor,
  invalidGeometryAnchor,
  portal,
  invalidPortal,
];
