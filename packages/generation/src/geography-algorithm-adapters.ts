/**
 * Project-owned seams around output-sensitive geography algorithms.
 *
 * A future library implementation must translate at this boundary. Package-specific noise,
 * GeoJSON, polygon, coordinate, collection, or diagnostic types cannot cross it and cannot
 * appear in an accepted domain record or public generator contract.
 */

import type { PlanetPoint } from '@ttrpg-map/core';

import type {
  AtlasContourLevel,
  AtlasFieldValueTicks,
  AtlasSamplingProfile,
} from './atlas-sampling-profiles.js';

/** Pointwise, planet-native scalar evaluation after canonical fixed-point quantization. */
export interface QuantizedPlanetFieldAdapter {
  readonly algorithmId: 'spherical-basis-field';
  readonly algorithmVersion: 1;
  readonly sample: (point: PlanetPoint) => AtlasFieldValueTicks;
}

/** Read-only sampled field; storage layout and any third-party array are private. */
export interface QuantizedSphericalField {
  readonly profile: AtlasSamplingProfile;
  readonly sampleCount: number;
  readonly valueAt: (longitudeIndex: number, latitudeIndex: number) => AtlasFieldValueTicks;
}

/** Disposable proposed ring in authoritative planet-native coordinates with implicit closure. */
export interface ProposedPlanetRing {
  readonly points: readonly PlanetPoint[];
  /** One source land/water sample transition for each point, in the same oriented cycle. */
  readonly sourceTransitions?: readonly ProposedCoastlineBoundaryTransition[];
  /** Classified land anchor proving the left side of each outgoing raw contour segment. */
  readonly leftLandSampleIndices?: readonly number[];
}

export interface ProposedCoastlineBoundaryTransition {
  readonly landSampleIndex: number;
  readonly waterSampleIndex: number;
}

export const GEOGRAPHY_ADAPTER_DIAGNOSTIC_CODES = {
  openContour: 'geography.contour.open',
  duplicateContourEdge: 'geography.contour.duplicate-edge',
  contourDegreeMismatch: 'geography.contour.degree-mismatch',
  contourDuplicateVertex: 'geography.contour.duplicate-vertex',
  contourSelfIntersection: 'geography.contour.self-intersection',
  contourRingIntersection: 'geography.contour.ring-intersection',
  contourTooShort: 'geography.contour.too-short',
  contourSourceMissing: 'geography.contour.source-missing',
} as const;

export type GeographyAdapterDiagnosticCode =
  (typeof GEOGRAPHY_ADAPTER_DIAGNOSTIC_CODES)[keyof typeof GEOGRAPHY_ADAPTER_DIAGNOSTIC_CODES];

/** Stable project diagnostic returned instead of a dependency-specific exception. */
export interface GeographyAdapterDiagnostic {
  readonly code: GeographyAdapterDiagnosticCode;
  readonly message: string;
  readonly ringIndex?: number;
}

export interface PlanetContourExtraction {
  readonly rings: readonly ProposedPlanetRing[];
  readonly segmentCount: number;
  readonly diagnostics: readonly GeographyAdapterDiagnostic[];
}

/** Grid-topology contour extraction contained behind project coordinates and diagnostics. */
export interface PlanetContourExtractionAdapter {
  readonly algorithmId: 'spherical-marching-cells';
  readonly algorithmVersion: 1;
  readonly extract: (
    field: QuantizedSphericalField,
    contourLevel: AtlasContourLevel,
  ) => PlanetContourExtraction;
}

/** Quantized topology validation never mutates or repairs a proposed ring. */
export interface PlanetTopologyValidationAdapter {
  readonly algorithmId: 'quantized-planet-ring-validation';
  readonly algorithmVersion: 1;
  readonly validate: (
    rings: readonly ProposedPlanetRing[],
  ) => readonly GeographyAdapterDiagnostic[];
}
