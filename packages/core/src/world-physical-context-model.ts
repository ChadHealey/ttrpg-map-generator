/**
 * Version-1 accepted Milestone 3 physical-context records.
 *
 * The records describe planet-native world facts and their provenance only. They deliberately do
 * not select a regional footprint, clip data, serialize a package, or implement a generator.
 */

import type { PhysicalDistance, PlanetPoint } from './coordinates.js';
import type { AspectId, BoundaryPortalId, EntityId, MapId, SemanticKey } from './identity.js';
import type { WorldPhysicalFieldReader } from './world-physical-context-readers.js';

declare const TEMPERATURE_TICKS_BRAND: unique symbol;
declare const NORMALIZED_TICKS_BRAND: unique symbol;
declare const WIND_SPEED_TICKS_BRAND: unique symbol;
declare const ELEVATION_TICKS_BRAND: unique symbol;
declare const DISCHARGE_TICKS_BRAND: unique symbol;
declare const WORLD_PHYSICAL_FINGERPRINT_BRAND: unique symbol;
declare const WORLD_PHYSICAL_ROOT_SIGNATURE_BRAND: unique symbol;

export const WORLD_PHYSICAL_CONTEXT_CONTRACT_VERSION = 1 as const;
export const WORLD_PHYSICAL_FIELD_BEHAVIOR_VERSION = 1 as const;
export const WORLD_PHYSICAL_FEATURE_BEHAVIOR_VERSION = 1 as const;
export const WORLD_PHYSICAL_CLASSIFICATION_POLICY_VERSION = 1 as const;
export const WORLD_PHYSICAL_GRAPH_POLICY_VERSION = 1 as const;
export const WORLD_PHYSICAL_GEOMETRY_VERSION = 1 as const;
export const WORLD_PHYSICAL_FIELD_ENCODING_VERSION = 1 as const;
export const WORLD_PHYSICAL_TEMPERATURE_QUANTUM_CELSIUS = 0.1 as const;
export const WORLD_PHYSICAL_WIND_SPEED_QUANTUM_METERS_PER_SECOND = 0.1 as const;
export const WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE = 16_777_216 as const;

export const MOUNTAIN_CHARACTERS = {
  low: 'low',
  varied: 'varied',
  rugged: 'rugged',
} as const;

export const CLIMATE_CHARACTERS = {
  temperate: 'temperate',
  varied: 'varied',
  extreme: 'extreme',
} as const;

export type MountainCharacter = (typeof MOUNTAIN_CHARACTERS)[keyof typeof MOUNTAIN_CHARACTERS];
export type ClimateCharacter = (typeof CLIMATE_CHARACTERS)[keyof typeof CLIMATE_CHARACTERS];

export interface WorldPhysicalContextControls {
  readonly mountainCharacter: MountainCharacter;
  readonly climateCharacter: ClimateCharacter;
}

export const DEFAULT_WORLD_PHYSICAL_CONTEXT_CONTROLS: WorldPhysicalContextControls = Object.freeze({
  mountainCharacter: MOUNTAIN_CHARACTERS.varied,
  climateCharacter: CLIMATE_CHARACTERS.varied,
});

export type TemperatureTicks = number & { readonly [TEMPERATURE_TICKS_BRAND]: 'temperature' };
export type NormalizedFieldTicks = number & { readonly [NORMALIZED_TICKS_BRAND]: 'normalized' };
export type WindSpeedTicks = number & { readonly [WIND_SPEED_TICKS_BRAND]: 'wind-speed' };
export type ElevationTicks = number & { readonly [ELEVATION_TICKS_BRAND]: 'elevation' };
export type DischargeTicks = number & { readonly [DISCHARGE_TICKS_BRAND]: 'discharge' };
export type WorldPhysicalFieldFingerprint = string & {
  readonly [WORLD_PHYSICAL_FINGERPRINT_BRAND]: 'world-physical-field-fingerprint';
};
export type WorldPhysicalRootSignature = string & {
  readonly [WORLD_PHYSICAL_ROOT_SIGNATURE_BRAND]: 'world-physical-root-signature';
};

export function createTemperatureTicks(value: number): TemperatureTicks | undefined {
  return isCanonicalInteger(value) ? (value as TemperatureTicks) : undefined;
}

/** Construct a normalized component in the ADR-0022 signed `2^24` domain. */
export function createNormalizedFieldTicks(value: number): NormalizedFieldTicks | undefined {
  return isCanonicalInteger(value) &&
    Math.abs(value) <= WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE
    ? (value as NormalizedFieldTicks)
    : undefined;
}

export function createWindSpeedTicks(value: number): WindSpeedTicks | undefined {
  return isCanonicalInteger(value) && value >= 0 ? (value as WindSpeedTicks) : undefined;
}

export function createElevationTicks(value: number): ElevationTicks | undefined {
  return isCanonicalInteger(value) ? (value as ElevationTicks) : undefined;
}

export function createDischargeTicks(value: number): DischargeTicks | undefined {
  return isCanonicalInteger(value) && value >= 0 ? (value as DischargeTicks) : undefined;
}

/** Calm is derived exclusively from the canonical quantized speed; it is not a second field. */
export function isCalmWindSpeed(value: WindSpeedTicks): boolean {
  return value === 0;
}

export type WorldPhysicalFieldKind =
  | 'temperature'
  | 'prevailing-winds-direction'
  | 'prevailing-winds-speed'
  | 'moisture'
  | 'climate-zones'
  | 'biome-belts'
  | 'watershed-assignment';

/** Canonical representation of one field's logical sample values. */
export type WorldPhysicalFieldValueEncoding =
  | 'entity-id'
  | 'normalized-integer-ticks'
  | 'semantic-key'
  | 'signed-integer-ticks'
  | 'unsigned-integer-ticks';

/** Quantization scale for one encoded value: ticks per declared physical unit, or one for keys. */
export type WorldPhysicalFieldQuantizationScale =
  1 | 10 | typeof WORLD_PHYSICAL_NORMALIZED_QUANTIZATION_SCALE;

export interface WorldPhysicalFieldProvenance<Kind extends WorldPhysicalFieldKind> {
  readonly contractVersion: typeof WORLD_PHYSICAL_CONTEXT_CONTRACT_VERSION;
  readonly fieldKind: Kind;
  readonly ownerAspectId: AspectId;
  readonly sourceAspectIds: readonly AspectId[];
  readonly fieldBehaviorVersion: typeof WORLD_PHYSICAL_FIELD_BEHAVIOR_VERSION;
  readonly fieldEncodingVersion: typeof WORLD_PHYSICAL_FIELD_ENCODING_VERSION;
  readonly valueEncoding: WorldPhysicalFieldValueEncoding;
  readonly quantizationScale: WorldPhysicalFieldQuantizationScale;
  readonly samplingProfileId: 'world-atlas-full-v1';
  readonly samplingPolicyVersion: 1;
  readonly longitudeCellCount: 2_048;
  readonly latitudeBandCount: 1_024;
  readonly canonicalTraversal: 'south-pole-then-rows-then-north-pole';
  readonly fingerprint: WorldPhysicalFieldFingerprint;
}

export interface QuantizedScalarField<Kind extends WorldPhysicalFieldKind, Value> {
  readonly provenance: WorldPhysicalFieldProvenance<Kind>;
  readonly minimumValue: Value;
  readonly maximumValue: Value;
  readonly values: WorldPhysicalFieldReader<Value>;
}

export interface TemperatureField extends QuantizedScalarField<'temperature', TemperatureTicks> {
  readonly quantumCelsius: typeof WORLD_PHYSICAL_TEMPERATURE_QUANTUM_CELSIUS;
}

/** Cartesian direction avoids an undefined east/north basis at either pole. */
export interface PrevailingWindField {
  readonly xComponents: QuantizedScalarField<'prevailing-winds-direction', NormalizedFieldTicks>;
  readonly yComponents: QuantizedScalarField<'prevailing-winds-direction', NormalizedFieldTicks>;
  readonly zComponents: QuantizedScalarField<'prevailing-winds-direction', NormalizedFieldTicks>;
  readonly speed: QuantizedScalarField<'prevailing-winds-speed', WindSpeedTicks>;
  readonly speedQuantumMetersPerSecond: typeof WORLD_PHYSICAL_WIND_SPEED_QUANTUM_METERS_PER_SECOND;
}

export interface MoistureField extends QuantizedScalarField<'moisture', NormalizedFieldTicks> {
  readonly influenceKinds: readonly ('coastal' | 'rain-shadow' | 'windward')[];
}

export type ClimateZoneKey = SemanticKey & { readonly __climateZoneKey: unique symbol };
export type BiomeKey = SemanticKey & { readonly __biomeKey: unique symbol };

export interface ClimateZoneDefinition {
  readonly key: ClimateZoneKey;
  readonly minimumTemperature: TemperatureTicks;
  readonly maximumTemperature: TemperatureTicks;
  readonly minimumMoisture: NormalizedFieldTicks;
  readonly maximumMoisture: NormalizedFieldTicks;
}

export interface ClimateZoneField extends QuantizedScalarField<'climate-zones', ClimateZoneKey> {
  readonly classificationPolicyVersion: typeof WORLD_PHYSICAL_CLASSIFICATION_POLICY_VERSION;
  readonly definitions: readonly ClimateZoneDefinition[];
}

export interface BiomeDefinition {
  readonly key: BiomeKey;
  readonly compatibleClimateZoneKeys: readonly ClimateZoneKey[];
}

export interface BiomeBeltSummary {
  readonly entityId: EntityId;
  readonly biomeKey: BiomeKey;
  readonly geometryVersion: typeof WORLD_PHYSICAL_GEOMETRY_VERSION;
  readonly boundaryPoints: readonly PlanetPoint[];
}

export interface BiomeBeltField extends QuantizedScalarField<'biome-belts', BiomeKey> {
  readonly classificationPolicyVersion: typeof WORLD_PHYSICAL_CLASSIFICATION_POLICY_VERSION;
  readonly definitions: readonly BiomeDefinition[];
  readonly beltSummaries: readonly BiomeBeltSummary[];
}

export interface MountainSystem {
  readonly entityId: EntityId;
  readonly behaviorVersion: typeof WORLD_PHYSICAL_FEATURE_BEHAVIOR_VERSION;
  readonly geometryVersion: typeof WORLD_PHYSICAL_GEOMETRY_VERSION;
  readonly centerlines: readonly (readonly PlanetPoint[])[];
  readonly influenceWidth: PhysicalDistance;
  readonly prominence: ElevationTicks;
  readonly boundaryPortalIds: readonly BoundaryPortalId[];
}

export interface MountainSystems {
  readonly ownerAspectId: AspectId;
  readonly sourceAspectIds: readonly AspectId[];
  readonly systems: readonly MountainSystem[];
}

export interface Watershed {
  readonly entityId: EntityId;
  readonly behaviorVersion: typeof WORLD_PHYSICAL_FEATURE_BEHAVIOR_VERSION;
  readonly geometryVersion: typeof WORLD_PHYSICAL_GEOMETRY_VERSION;
  readonly outletEntityId?: EntityId;
  readonly divideLines: readonly (readonly PlanetPoint[])[];
  readonly boundaryPortalIds: readonly BoundaryPortalId[];
}

export interface WatershedRecords extends QuantizedScalarField<'watershed-assignment', EntityId> {
  readonly graphPolicyVersion: typeof WORLD_PHYSICAL_GRAPH_POLICY_VERSION;
  readonly watersheds: readonly Watershed[];
}

export interface MajorRiver {
  readonly entityId: EntityId;
  readonly behaviorVersion: typeof WORLD_PHYSICAL_FEATURE_BEHAVIOR_VERSION;
  readonly geometryVersion: typeof WORLD_PHYSICAL_GEOMETRY_VERSION;
  readonly watershedId: EntityId;
  readonly centerline: readonly PlanetPoint[];
  readonly sourceEntityId: EntityId;
  readonly outletEntityId?: EntityId;
  readonly joinsRiverIds: readonly EntityId[];
  readonly dischargeSamples: readonly DischargeTicks[];
  readonly widthSamples: readonly PhysicalDistance[];
  readonly boundaryPortalIds: readonly BoundaryPortalId[];
}

export interface MajorLake {
  readonly entityId: EntityId;
  readonly behaviorVersion: typeof WORLD_PHYSICAL_FEATURE_BEHAVIOR_VERSION;
  readonly geometryVersion: typeof WORLD_PHYSICAL_GEOMETRY_VERSION;
  readonly watershedId: EntityId;
  readonly ring: readonly PlanetPoint[];
  readonly outletRiverId?: EntityId;
  readonly depth: ElevationTicks;
  readonly surfaceElevation: ElevationTicks;
  readonly boundaryPortalIds: readonly BoundaryPortalId[];
}

/** Complete physical-world contract, without document integration or footprint/context geometry. */
export interface WorldPhysicalContextRecords {
  readonly worldMapId: MapId;
  readonly worldSurfaceEntityId: EntityId;
  readonly controls: WorldPhysicalContextControls;
  readonly mountainSystems: MountainSystems;
  readonly temperature: TemperatureField;
  readonly prevailingWinds: PrevailingWindField;
  readonly moisture: MoistureField;
  readonly climateZones: ClimateZoneField;
  readonly biomeBelts: BiomeBeltField;
  readonly watersheds: WatershedRecords;
  readonly majorRivers: readonly MajorRiver[];
  readonly majorLakes: readonly MajorLake[];
}

function isCanonicalInteger(value: number): boolean {
  return Number.isSafeInteger(value) && !Object.is(value, -0);
}
