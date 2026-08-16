/** Shared fixed inputs and explicit runtime capabilities for focused generator tests. */

import {
  createDeterministicRandomStream,
  DEFAULT_ATLAS_CONTROLS,
  deriveAtlasAspectId,
  deriveAtlasSingletonEntityIds,
  type DeterministicRandomStream,
  type MapId,
  parseStableId,
} from '@ttrpg-map/core';

import { generateAtlasLandWaterFull } from './atlas-land-water-generator.js';
import {
  type AtlasGenerationProgress,
  type AtlasLandWaterFullGenerationResult,
  type AtlasLandWaterGenerationInput,
  type AtlasLandWaterGenerationRuntime,
  createAtlasLandWaterGenerationInput,
} from './atlas-land-water-generator-contract.js';

export interface FixedAtlasGeneratorCase {
  readonly fixtureId:
    | 'milestone-2-atlas-connected-majority'
    | 'milestone-2-atlas-control-max'
    | 'milestone-2-atlas-control-min'
    | 'milestone-2-atlas-fragmented-islands'
    | 'milestone-2-atlas-proof'
    | 'milestone-2-atlas-seam-crossing';
  readonly worldSeed: string;
  readonly controls: typeof DEFAULT_ATLAS_CONTROLS;
}

export interface MutableCancellationController {
  readonly signal: AtlasLandWaterGenerationRuntime['cancellation'];
  readonly request: () => void;
}

export const FIXED_ATLAS_WORLD_MAP_ID: MapId = required(
  parseStableId('map', 'a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7'),
);
export const FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID =
  deriveAtlasSingletonEntityIds(FIXED_ATLAS_WORLD_MAP_ID).worldSurfaceEntityId;
export const FIXED_ATLAS_MACRO_ELEVATION_ASPECT_ID = deriveAtlasAspectId(
  FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
  'worldTerrain.macroElevation',
);
export const FIXED_ATLAS_LAND_WATER_ASPECT_ID = deriveAtlasAspectId(
  FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
  'worldSurface.landWaterClassification',
);

export const FIXED_ATLAS_GENERATOR_CASES: readonly FixedAtlasGeneratorCase[] = Object.freeze([
  fixedCase('milestone-2-atlas-proof', '81985529216486895', {}),
  fixedCase('milestone-2-atlas-fragmented-islands', '18364758544493064720', {
    targetWaterCoveragePercent: 70,
    continentCountIntent: 5,
    fragmentationPercent: 90,
    islandAbundancePercent: 95,
    archipelagoAbundancePercent: 95,
  }),
  fixedCase('milestone-2-atlas-connected-majority', '1085102592571150095', {
    targetWaterCoveragePercent: 60,
    continentCountIntent: 6,
    continentDistribution: 'balanced',
    fragmentationPercent: 55,
    islandAbundancePercent: 55,
    archipelagoAbundancePercent: 50,
    oceanConnectivity: 'connectedMajority',
  }),
  fixedCase('milestone-2-atlas-seam-crossing', '12297829382473034410', {}),
  fixedCase('milestone-2-atlas-control-min', '6148914691236517205', {
    worldCircumferenceKm: 10_000,
    targetWaterCoveragePercent: 45,
    continentCountIntent: 1,
    continentDistribution: 'balanced',
    fragmentationPercent: 0,
    islandAbundancePercent: 0,
    archipelagoAbundancePercent: 0,
    polarCharacter: 'landBiased',
  }),
  fixedCase('milestone-2-atlas-control-max', '16045690984503098046', {
    worldCircumferenceKm: 80_000,
    targetWaterCoveragePercent: 80,
    continentCountIntent: 8,
    continentDistribution: 'oneDominant',
    fragmentationPercent: 100,
    islandAbundancePercent: 100,
    archipelagoAbundancePercent: 100,
    oceanConnectivity: 'multipleBasins',
    polarCharacter: 'oceanBiased',
  }),
]);

export function fixedAtlasInput(
  fixed: FixedAtlasGeneratorCase = requiredCase('milestone-2-atlas-proof'),
  controls: FixedAtlasGeneratorCase['controls'] = fixed.controls,
): AtlasLandWaterGenerationInput {
  const parsed = createAtlasLandWaterGenerationInput({
    worldSeed: fixed.worldSeed,
    worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
    worldSurfaceEntityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
    macroElevationAspectId: FIXED_ATLAS_MACRO_ELEVATION_ASPECT_ID,
    landWaterClassificationAspectId: FIXED_ATLAS_LAND_WATER_ASPECT_ID,
    macroElevationVariantRevision: 0,
    landWaterClassificationVariantRevision: 0,
    controls,
  });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  return parsed.value;
}

export function fixedAtlasRuntime(
  input: AtlasLandWaterGenerationInput,
  options: Readonly<{
    operationId?: string;
    cancellation?: MutableCancellationController;
    progress?: AtlasGenerationProgress[];
    observeProgress?: (progress: AtlasGenerationProgress) => void;
    yieldControl?: () => Promise<void>;
    macroElevationRandom?: DeterministicRandomStream;
    landWaterClassificationRandom?: DeterministicRandomStream;
  }> = {},
): AtlasLandWaterGenerationRuntime {
  const cancellation = options.cancellation ?? cancellationController();
  return Object.freeze({
    operationId: options.operationId ?? 'atlas-test-operation',
    macroElevationRandom: options.macroElevationRandom ?? stream(input.macroElevationSeedMetadata),
    landWaterClassificationRandom:
      options.landWaterClassificationRandom ?? stream(input.landWaterClassificationSeedMetadata),
    cancellation: cancellation.signal,
    reportProgress(progress: AtlasGenerationProgress) {
      options.progress?.push(progress);
      options.observeProgress?.(progress);
    },
    yieldControl: options.yieldControl ?? (() => Promise.resolve()),
  });
}

export function cancellationController(): MutableCancellationController {
  let isRequested = false;
  return Object.freeze({
    signal: Object.freeze({
      cancellationVersion: 1,
      isCancellationRequested: () => isRequested,
    }),
    request() {
      isRequested = true;
    },
  });
}

export async function generateFixedAtlasFull(
  fixed: FixedAtlasGeneratorCase = requiredCase('milestone-2-atlas-proof'),
): Promise<Extract<AtlasLandWaterFullGenerationResult, { readonly status: 'proposed-full' }>> {
  const input = fixedAtlasInput(fixed);
  const result = await generateAtlasLandWaterFull(input, fixedAtlasRuntime(input));
  if (result.status !== 'proposed-full') {
    throw new Error(JSON.stringify(result.diagnostics));
  }
  return result;
}

export function requiredCase(
  fixtureId: FixedAtlasGeneratorCase['fixtureId'],
): FixedAtlasGeneratorCase {
  const fixed = FIXED_ATLAS_GENERATOR_CASES.find((candidate) => candidate.fixtureId === fixtureId);
  if (fixed === undefined) throw new Error(`Missing fixed atlas case ${fixtureId}.`);
  return fixed;
}

function fixedCase(
  fixtureId: FixedAtlasGeneratorCase['fixtureId'],
  worldSeed: string,
  overrides: Partial<FixedAtlasGeneratorCase['controls']>,
): FixedAtlasGeneratorCase {
  return Object.freeze({
    fixtureId,
    worldSeed,
    controls: Object.freeze({ ...DEFAULT_ATLAS_CONTROLS, ...overrides }),
  });
}

function stream(
  input: AtlasLandWaterGenerationInput['macroElevationSeedMetadata'],
): DeterministicRandomStream {
  return required(createDeterministicRandomStream(input));
}

function required<Value>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly diagnostic: unknown },
): Value {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostic));
  return result.value;
}
