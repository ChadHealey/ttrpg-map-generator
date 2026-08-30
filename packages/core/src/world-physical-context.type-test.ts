import type {
  ClimateZoneKey,
  fingerprintWorldPhysicalRootSignature,
  NormalizedFieldTicks,
  PlanetPoint,
  RegionalPoint,
  TemperatureTicks,
  WorldPhysicalFieldReader,
} from './index.js';

declare const planetPoint: PlanetPoint;
declare const regionalPoint: RegionalPoint;
declare const temperature: TemperatureTicks;
declare const normalized: NormalizedFieldTicks;
declare const climateZone: ClimateZoneKey;

// @ts-expect-error M3 physical geometry accepts planet-native points, never regional coordinates.
const invalidPlanetLine: readonly PlanetPoint[] = [regionalPoint];
// @ts-expect-error Quantized M3 values cannot cross the public boundary as raw numbers.
const invalidTemperature: TemperatureTicks = 1;
// @ts-expect-error Climate classes require a validated semantic class key.
const invalidClimateZone: ClimateZoneKey = 'temperate';
// @ts-expect-error A structural reader substitute cannot satisfy the nominal project-owned reader boundary.
const invalidReader: WorldPhysicalFieldReader<NormalizedFieldTicks> = {
  length: 1,
  at: () => normalized,
  forEach: () => undefined,
};
// @ts-expect-error Feature root signatures require canonical planet coordinates, not raw text.
const invalidFeatureRoot = fingerprintWorldPhysicalRootSignature('12:3,13:3');

void [
  planetPoint,
  temperature,
  climateZone,
  invalidPlanetLine,
  invalidTemperature,
  invalidClimateZone,
  invalidReader,
  invalidFeatureRoot,
];
