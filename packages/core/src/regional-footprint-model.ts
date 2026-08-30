/** Version-1 ADR-0023 footprint records, independent of selector, persistence, and clipping. */

import {
  type COORDINATE_TRANSFORM_VERSION,
  type PLANET_REGIONAL_TRANSFORM_ID,
} from './coordinate-transforms.js';
import type { PlanetPoint, RegionalExtent, WorldRadius } from './coordinates.js';
import type { RootSurfaceId } from './identity.js';

export const REGIONAL_RECTANGLE_FOOTPRINT_SHAPE_VERSION = 'regional-rectangle-v1' as const;

/** The sole accepted version-1 regional footprint shape. */
export interface RegionalRectangleFootprint {
  readonly shapeVersion: typeof REGIONAL_RECTANGLE_FOOTPRINT_SHAPE_VERSION;
  readonly rootSurfaceId: RootSurfaceId;
  readonly worldRadius: WorldRadius;
  readonly origin: PlanetPoint;
  readonly extent: RegionalExtent;
  readonly transformId: typeof PLANET_REGIONAL_TRANSFORM_ID;
  readonly transformVersion: typeof COORDINATE_TRANSFORM_VERSION;
}

export const REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES = {
  unsupportedShape: 'footprint.shape.unsupported',
  degenerateExtent: 'footprint.extent.degenerate',
  extentLimit: 'footprint.extent.limit',
  transformDomain: 'footprint.transform.domain',
  transformRoundTrip: 'footprint.transform.round-trip',
  invalidCoordinate: 'footprint.coordinate.invalid',
  invalidContext: 'footprint.context.invalid',
} as const;

export type RegionalFootprintDiagnosticCode =
  (typeof REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES)[keyof typeof REGIONAL_FOOTPRINT_DIAGNOSTIC_CODES];

/** Stable diagnostic for an unaccepted footprint at a core trust boundary. */
export interface RegionalFootprintDiagnostic {
  readonly code: RegionalFootprintDiagnosticCode;
  readonly subject: string;
  readonly message: string;
}

export type RegionalFootprintParseResult =
  | { readonly ok: true; readonly value: RegionalRectangleFootprint }
  | { readonly ok: false; readonly diagnostic: RegionalFootprintDiagnostic };
