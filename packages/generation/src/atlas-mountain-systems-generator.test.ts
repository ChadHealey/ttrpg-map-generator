import {
  createVariantRevision,
  deriveWorldPhysicalContextAspectId,
  type MountainCharacter,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import {
  FIXED_ATLAS_GENERATOR_CASES,
  type FixedAtlasGeneratorCase,
  fixedAtlasInput,
  generateFixedAtlasFull,
} from './atlas-land-water-test-support.js';
import {
  type AtlasMountainSystemsGenerationInput,
  generateAtlasMountainSystems,
} from './atlas-mountain-systems-generator.js';
import { getAtlasSampleStorageIndex, WORLD_ATLAS_FULL_PROFILE } from './atlas-sampling-profiles.js';

describe('whole-world mountain-system generation', () => {
  it('repeats one canonical world-surface proposal with only the two declared dependencies', async () => {
    const generated = await generateFixedAtlasFull();
    const baseline = input(generated.patch.records, 'varied', 0);
    const first = proposed(baseline);
    const repeated = proposed({ ...baseline, records: generated.patch.records });

    expect(repeated).toStrictEqual(first);
    expect(first.target.aspect.aspectId).toBe(
      deriveWorldPhysicalContextAspectId(
        baseline.worldSurfaceEntityId,
        'worldTerrain.mountainSystems',
      ),
    );
    expect(first.dependencyAspects.map(({ aspectId }) => aspectId)).toStrictEqual(
      [baseline.macroElevationAspectId, baseline.landWaterClassificationAspectId].sort(),
    );
    expect(first.seedScope).toBe('map/entity');
    expect(first.output.systems.map(({ entityId }) => entityId)).toStrictEqual(
      [...first.output.systems.map(({ entityId }) => entityId)].sort(),
    );
  }, 60_000);

  it('isolates the mountain proposal from accepted M2 input records across control and revision changes', async () => {
    const generated = await generateFixedAtlasFull();
    const recordsBefore = JSON.stringify(generated.patch.records);
    const low = proposed(input(generated.patch.records, 'low', 0));
    const rugged = proposed(input(generated.patch.records, 'rugged', 0));
    const rerolled = proposed(input(generated.patch.records, 'varied', 1));

    expect(low.output.systems).toHaveLength(1);
    expect(rugged.output.systems).toHaveLength(3);
    const varied = proposed(input(generated.patch.records, 'varied', 0));
    const lowRoot = low.output.systems[0];
    if (lowRoot === undefined)
      throw new Error('Expected the low mountain proposal to contain one system.');
    const variedRoot = varied.output.systems.find(({ entityId }) => entityId === lowRoot.entityId);
    const ruggedRoot = rugged.output.systems.find(({ entityId }) => entityId === lowRoot.entityId);
    if (variedRoot === undefined || ruggedRoot === undefined) {
      throw new Error('Expected character variants to preserve the highest ridge root.');
    }
    expect(lowRoot.prominence).toBeLessThan(variedRoot.prominence);
    expect(variedRoot.prominence).toBeLessThan(ruggedRoot.prominence);
    expect(JSON.stringify(rerolled.output)).not.toBe(
      JSON.stringify(proposed(input(generated.patch.records, 'varied', 0)).output),
    );
    expect(JSON.stringify(generated.patch.records)).toBe(recordsBefore);
  }, 60_000);

  it('keeps every fixed-seed ridge centerline canonical, land-constrained, and non-degenerate', async () => {
    for (const fixed of FIXED_ATLAS_GENERATOR_CASES) {
      const generated = await generateFixedAtlasFull(fixed);
      const proposal = proposed(input(generated.patch.records, 'varied', 0, fixed));
      for (const system of proposal.output.systems) {
        expect(system.centerlines).toHaveLength(1);
        for (const centerline of system.centerlines) {
          expect(centerline).toHaveLength(3);
          expect(
            new Set(
              centerline.map(
                (point) => `${String(point.longitudeTicks)}:${String(point.latitudeTicks)}`,
              ),
            ).size,
          ).toBe(3);
          expect(centerline.every((point) => Number.isSafeInteger(point.longitudeTicks))).toBe(
            true,
          );
          expect(centerline.every((point) => Number.isSafeInteger(point.latitudeTicks))).toBe(true);
          for (const point of centerline) {
            const longitudeIndex = (point.longitudeTicks + 2 ** 31) / 2 ** 21;
            const latitudeIndex = (point.latitudeTicks + 2 ** 30) / 2 ** 21;
            expect(Number.isSafeInteger(longitudeIndex)).toBe(true);
            expect(Number.isSafeInteger(latitudeIndex)).toBe(true);
            expect(
              generated.patch.records.landWaterClassification.samples.at(
                getAtlasSampleStorageIndex(WORLD_ATLAS_FULL_PROFILE, longitudeIndex, latitudeIndex),
              ),
            ).toBe('land');
          }
          expectTraversedSamplesAreLand(centerline, generated.patch.records);
        }
      }
    }
  }, 180_000);

  it('rejects an invalid accepted M2 source without proposing output', async () => {
    const generated = await generateFixedAtlasFull();
    const broken = {
      ...generated.patch.records,
      landWaterClassification: {
        ...generated.patch.records.landWaterClassification,
        classificationBehaviorVersion: 2 as 1,
      },
    };
    const result = generateAtlasMountainSystems(input(broken, 'varied', 0));

    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') return;
    expect(result.diagnostics.map(({ code }) => code)).toStrictEqual([
      'atlas.mountain-systems.source-invalid',
    ]);
  }, 60_000);
});

function input(
  records: AtlasMountainSystemsGenerationInput['records'],
  mountainCharacter: MountainCharacter,
  revision: number,
  fixed: FixedAtlasGeneratorCase = requiredFixedCase(),
): AtlasMountainSystemsGenerationInput {
  const source = fixedAtlasInput(fixed);
  return Object.freeze({
    worldSeed: source.worldSeed,
    worldMapId: source.worldMapId,
    worldSurfaceEntityId: source.worldSurfaceEntityId,
    macroElevationAspectId: source.macroElevationAspectId,
    landWaterClassificationAspectId: source.landWaterClassificationAspectId,
    mountainSystemsVariantRevision: required(createVariantRevision(revision)),
    mountainCharacter,
    records,
  });
}

function expectTraversedSamplesAreLand(
  centerline: readonly { readonly longitudeTicks: number; readonly latitudeTicks: number }[],
  records: AtlasMountainSystemsGenerationInput['records'],
): void {
  for (let segmentIndex = 1; segmentIndex < centerline.length; segmentIndex += 1) {
    const start = centerline[segmentIndex - 1];
    const end = centerline[segmentIndex];
    if (start === undefined || end === undefined)
      throw new Error('Expected a complete centerline.');
    const startLongitudeIndex = (start.longitudeTicks + 2 ** 31) / 2 ** 21;
    const startLatitudeIndex = (start.latitudeTicks + 2 ** 30) / 2 ** 21;
    const endLongitudeIndex = (end.longitudeTicks + 2 ** 31) / 2 ** 21;
    const endLatitudeIndex = (end.latitudeTicks + 2 ** 30) / 2 ** 21;
    const longitudeDelta = wrappedLongitudeDelta(startLongitudeIndex, endLongitudeIndex);
    const latitudeDelta = endLatitudeIndex - startLatitudeIndex;
    const stepCount = Math.max(Math.abs(longitudeDelta), Math.abs(latitudeDelta));
    for (let step = 0; step <= stepCount; step += 1) {
      const longitudeIndex = wrapLongitudeIndex(
        startLongitudeIndex + (step * longitudeDelta) / stepCount,
      );
      const latitudeIndex = startLatitudeIndex + (step * latitudeDelta) / stepCount;
      expect(
        records.landWaterClassification.samples.at(
          getAtlasSampleStorageIndex(WORLD_ATLAS_FULL_PROFILE, longitudeIndex, latitudeIndex),
        ),
      ).toBe('land');
    }
  }
}

function wrappedLongitudeDelta(start: number, end: number): number {
  const count = WORLD_ATLAS_FULL_PROFILE.longitudeCellCount;
  const direct = end - start;
  return direct > count / 2 ? direct - count : direct < -count / 2 ? direct + count : direct;
}

function wrapLongitudeIndex(value: number): number {
  const count = WORLD_ATLAS_FULL_PROFILE.longitudeCellCount;
  return ((value % count) + count) % count;
}

function proposed(input: AtlasMountainSystemsGenerationInput) {
  const result = generateAtlasMountainSystems(input);
  if (result.status !== 'proposed') throw new Error(JSON.stringify(result.diagnostics));
  return result.proposal;
}

function requiredFixedCase(): FixedAtlasGeneratorCase {
  const fixed = FIXED_ATLAS_GENERATOR_CASES[0];
  if (fixed === undefined) throw new Error('Expected one fixed M2 atlas case.');
  return fixed;
}

function required<Value>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly diagnostic: unknown },
): Value {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostic));
  return result.value;
}
