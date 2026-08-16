/** Desktop adaptation from the accepted synthetic proof outputs to a disposable RenderScene. */

import {
  compareStableReferences,
  type EntityId,
  type PlanetPoint,
  type RenderPoint,
  type RenderPolygon,
  type RenderScene,
  type RenderSourceId,
} from '@ttrpg-map/core';

export interface MilestoneOneProofRenderMarker {
  readonly markerId: EntityId;
  readonly position: PlanetPoint;
}

export interface MilestoneOneProofRenderInput {
  readonly sourceEntityId: EntityId;
  readonly outline: readonly PlanetPoint[];
  readonly markers: readonly MilestoneOneProofRenderMarker[];
}

export const MILESTONE_ONE_PROOF_SCENE_WIDTH_PX = 960;
export const MILESTONE_ONE_PROOF_SCENE_HEIGHT_PX = 600;

const PLANET_WINDOW_HALF_EXTENT_TICKS = 327_680_000;
const MAP_LEFT_PX = 120;
const MAP_TOP_PX = 60;
const MAP_WIDTH_PX = 720;
const MAP_HEIGHT_PX = 480;
const MARKER_RADIUS_PX = 10;

/**
 * Map only accepted, quantized planet-native geometry into fixed render pixels. Generator-only
 * proof-input coordinates and their transform are deliberately absent from this boundary.
 */
export function createMilestoneOneProofScene(input: MilestoneOneProofRenderInput): RenderScene {
  const sourceId: RenderSourceId = input.sourceEntityId;
  const outline: RenderPolygon = Object.freeze({
    id: 'milestone-one-proof-outline',
    kind: 'polygon',
    sourceId,
    points: Object.freeze(input.outline.map(planetPointToRenderPoint)),
    paint: Object.freeze({
      fillColor: '#d7dfb3',
      strokeColor: '#27261f',
      strokeWidthPx: 5,
    }),
  });
  const markers = [...input.markers]
    .sort((left, right) => compareStableReferences(left.markerId, right.markerId))
    .map((marker): RenderPolygon => {
      const center = planetPointToRenderPoint(marker.position);
      return Object.freeze({
        id: `milestone-one-proof-marker-${marker.markerId}`,
        kind: 'polygon',
        sourceId,
        points: Object.freeze([
          Object.freeze({ xPx: center.xPx, yPx: center.yPx - MARKER_RADIUS_PX }),
          Object.freeze({ xPx: center.xPx + MARKER_RADIUS_PX, yPx: center.yPx }),
          Object.freeze({ xPx: center.xPx, yPx: center.yPx + MARKER_RADIUS_PX }),
          Object.freeze({ xPx: center.xPx - MARKER_RADIUS_PX, yPx: center.yPx }),
        ]),
        paint: Object.freeze({
          fillColor: '#b44b3f',
          strokeColor: '#27261f',
          strokeWidthPx: 2,
        }),
      });
    });

  return Object.freeze({
    widthPx: MILESTONE_ONE_PROOF_SCENE_WIDTH_PX,
    heightPx: MILESTONE_ONE_PROOF_SCENE_HEIGHT_PX,
    nodes: Object.freeze([
      Object.freeze({
        id: 'milestone-one-proof-paper',
        kind: 'rectangle' as const,
        sourceId,
        xPx: 0,
        yPx: 0,
        widthPx: MILESTONE_ONE_PROOF_SCENE_WIDTH_PX,
        heightPx: MILESTONE_ONE_PROOF_SCENE_HEIGHT_PX,
        fillColor: '#f3e7c6',
      }),
      outline,
      ...markers,
    ]),
  });
}

function planetPointToRenderPoint(point: PlanetPoint): RenderPoint {
  const longitudeRatio =
    (point.longitudeTicks + PLANET_WINDOW_HALF_EXTENT_TICKS) /
    (PLANET_WINDOW_HALF_EXTENT_TICKS * 2);
  const latitudeRatio =
    (point.latitudeTicks + PLANET_WINDOW_HALF_EXTENT_TICKS) / (PLANET_WINDOW_HALF_EXTENT_TICKS * 2);
  return Object.freeze({
    xPx: MAP_LEFT_PX + longitudeRatio * MAP_WIDTH_PX,
    yPx: MAP_TOP_PX + (1 - latitudeRatio) * MAP_HEIGHT_PX,
  });
}
