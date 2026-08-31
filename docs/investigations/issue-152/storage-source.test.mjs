import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createVariantRevision } from '../../../packages/core/src/index.js';
import {
  FIXED_ATLAS_LAND_WATER_ASPECT_ID,
  FIXED_ATLAS_MACRO_ELEVATION_ASPECT_ID,
  FIXED_ATLAS_WORLD_MAP_ID,
  FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
  fixedAtlasInput,
  fixedAtlasRuntime,
} from '../../../packages/generation/src/atlas-land-water-test-support.js';
import {
  createAtlasLandWaterGenerationInput,
  generateAtlasAtmosphere,
  generateAtlasEcology,
  generateAtlasHydrology,
  generateAtlasLandWaterFull,
  generateAtlasMountainSystems,
  generateAtlasSemanticGeography,
} from '../../../packages/generation/src/index.js';

const sourceDirectory = process.env.ISSUE_152_SOURCE_DIR;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const acceptedMapPath = resolve(
  repositoryRoot,
  'fixtures/saved-projects/v1/milestone-2-atlas-proof/appearance-rerolled.mapworld/maps/a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7.json',
);

describe.skipIf(sourceDirectory === undefined)('issue 152 storage source', () => {
  it('writes one deterministic full-profile physical-context source', async () => {
    const directory = requiredSourceDirectory();
    const generated = await generateAcceptedM2Source();
    assertMatchesAcceptedM2Fixture(generated);
    const semantic = generateAtlasSemanticGeography({
      worldSeed: fixedAtlasInput().worldSeed,
      worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
      worldSurfaceEntityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
      landWaterClassificationAspectId: FIXED_ATLAS_LAND_WATER_ASPECT_ID,
      records: generated.patch.records,
      previousAcceptedAspects: [],
    });
    if (semantic.status !== 'proposed') throw new Error(JSON.stringify(semantic.diagnostics));

    const mountain = generateAtlasMountainSystems({
      worldSeed: fixedAtlasInput().worldSeed,
      worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
      worldSurfaceEntityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
      macroElevationAspectId: FIXED_ATLAS_MACRO_ELEVATION_ASPECT_ID,
      landWaterClassificationAspectId: FIXED_ATLAS_LAND_WATER_ASPECT_ID,
      mountainSystemsVariantRevision: revision(0),
      mountainCharacter: 'varied',
      records: generated.patch.records,
    });
    if (mountain.status !== 'proposed') throw new Error(JSON.stringify(mountain.diagnostics));

    const atmosphere = generateAtlasAtmosphere({
      worldSeed: fixedAtlasInput().worldSeed,
      worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
      worldSurfaceEntityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
      macroElevationAspectId: FIXED_ATLAS_MACRO_ELEVATION_ASPECT_ID,
      landWaterClassificationAspectId: FIXED_ATLAS_LAND_WATER_ASPECT_ID,
      temperatureVariantRevision: revision(0),
      prevailingWindsVariantRevision: revision(0),
      climateCharacter: 'varied',
      records: semantic.patch.records,
      mountainSystems: mountain.proposal.output,
    });
    if (atmosphere.status !== 'proposed') throw new Error(JSON.stringify(atmosphere.diagnostics));

    const ecology = generateAtlasEcology({
      worldSeed: fixedAtlasInput().worldSeed,
      worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
      worldSurfaceEntityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
      macroElevationAspectId: FIXED_ATLAS_MACRO_ELEVATION_ASPECT_ID,
      landWaterClassificationAspectId: FIXED_ATLAS_LAND_WATER_ASPECT_ID,
      moistureVariantRevision: revision(0),
      climateZonesVariantRevision: revision(0),
      biomeBeltsVariantRevision: revision(0),
      records: semantic.patch.records,
      mountainSystems: mountain.proposal.output,
      atmosphere: atmosphere.patch,
    });
    if (ecology.status !== 'proposed') throw new Error(JSON.stringify(ecology.diagnostics));

    const hydrology = generateAtlasHydrology({
      worldSeed: fixedAtlasInput().worldSeed,
      worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
      worldSurfaceEntityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
      macroElevationAspectId: FIXED_ATLAS_MACRO_ELEVATION_ASPECT_ID,
      landWaterClassificationAspectId: FIXED_ATLAS_LAND_WATER_ASPECT_ID,
      watershedsVariantRevision: revision(0),
      majorRiversVariantRevision: revision(0),
      majorLakesVariantRevision: revision(0),
      records: semantic.patch.records,
      mountainSystems: mountain.proposal.output,
      ecology: ecology.patch,
    });
    if (hydrology.status !== 'proposed') throw new Error(JSON.stringify(hydrology.diagnostics));

    mkdirSync(resolve(directory, 'fields'), { recursive: true });
    const fields = [
      writeNumberField(directory, 'temperature', atmosphere.patch.temperature.output.values),
      writeNumberField(
        directory,
        'prevailing-winds-x',
        atmosphere.patch.prevailingWinds.output.xComponents.values,
      ),
      writeNumberField(
        directory,
        'prevailing-winds-y',
        atmosphere.patch.prevailingWinds.output.yComponents.values,
      ),
      writeNumberField(
        directory,
        'prevailing-winds-z',
        atmosphere.patch.prevailingWinds.output.zComponents.values,
      ),
      writeNumberField(
        directory,
        'prevailing-winds-speed',
        atmosphere.patch.prevailingWinds.output.speed.values,
      ),
      writeNumberField(directory, 'moisture', ecology.patch.moisture.output.values),
      writeStringField(directory, 'climate-zones', ecology.patch.climateZones.output.values),
      writeStringField(directory, 'biome-belts', ecology.patch.biomeBelts.output.values),
      writeStringField(directory, 'watersheds', hydrology.patch.watersheds.output.values),
    ];
    const aspects = [
      accepted(mountain.proposal, mountain.proposal.output),
      accepted(atmosphere.patch.temperature, {
        ...atmosphere.patch.temperature.output,
        values: sourceField('temperature'),
      }),
      accepted(atmosphere.patch.prevailingWinds, {
        ...atmosphere.patch.prevailingWinds.output,
        xComponents: replaceValues(
          atmosphere.patch.prevailingWinds.output.xComponents,
          'prevailing-winds-x',
        ),
        yComponents: replaceValues(
          atmosphere.patch.prevailingWinds.output.yComponents,
          'prevailing-winds-y',
        ),
        zComponents: replaceValues(
          atmosphere.patch.prevailingWinds.output.zComponents,
          'prevailing-winds-z',
        ),
        speed: replaceValues(
          atmosphere.patch.prevailingWinds.output.speed,
          'prevailing-winds-speed',
        ),
      }),
      accepted(ecology.patch.moisture, {
        ...ecology.patch.moisture.output,
        values: sourceField('moisture'),
      }),
      accepted(ecology.patch.climateZones, {
        ...ecology.patch.climateZones.output,
        values: sourceField('climate-zones'),
      }),
      accepted(ecology.patch.biomeBelts, {
        ...ecology.patch.biomeBelts.output,
        values: sourceField('biome-belts'),
      }),
      accepted(hydrology.patch.watersheds, {
        ...hydrology.patch.watersheds.output,
        values: sourceField('watersheds'),
      }),
      accepted(hydrology.patch.majorRivers, hydrology.patch.majorRivers.output),
      accepted(hydrology.patch.majorLakes, hydrology.patch.majorLakes.output),
    ].sort((left, right) =>
      left.aspectId < right.aspectId ? -1 : left.aspectId > right.aspectId ? 1 : 0,
    );

    const metadata = {
      sourceSchemaVersion: 1,
      fixtureId: 'milestone-2-atlas-proof',
      worldSeed: fixedAtlasInput().worldSeed.toString(),
      worldMapId: FIXED_ATLAS_WORLD_MAP_ID,
      worldSurfaceEntityId: FIXED_ATLAS_WORLD_SURFACE_ENTITY_ID,
      sampleCount: fields[0]?.sampleCount,
      fields,
      aspects,
    };
    writeFileSync(
      resolve(directory, 'metadata.json'),
      `${JSON.stringify(
        metadata,
        (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
        2,
      )}\n`,
    );

    expect(fields).toHaveLength(9);
    expect(new Set(fields.map(({ sampleCount }) => sampleCount))).toStrictEqual(
      new Set([2_095_106]),
    );
    expect(aspects).toHaveLength(9);
  }, 240_000);
});

function accepted(proposal, acceptedOutput) {
  return {
    acceptedAspectSchemaVersion: 2,
    acceptedOutput,
    aspectId: proposal.target.aspect.aspectId,
    aspectName: proposal.target.aspectName,
    dependencyAspects: proposal.dependencyAspects,
    diagnostics: proposal.diagnostics,
    entityId: proposal.target.entityId,
    generationStatus: 'accepted',
    generatorId: proposal.generatorId,
    generatorVersion: proposal.generatorVersion,
    mapId: proposal.target.mapId,
    parameterSchemaVersion: proposal.parameterSchemaVersion,
    parameters: proposal.parameters,
    seedMetadata: proposal.seedMetadata,
    seedScope: proposal.seedScope,
    variantRevision: proposal.target.variantRevision,
  };
}

function replaceValues(output, key) {
  return { ...output, values: sourceField(key) };
}

function sourceField(key) {
  return { sourceFieldSchemaVersion: 1, key };
}

function writeNumberField(directory, key, reader) {
  const bytes = Buffer.allocUnsafe(reader.length * 4);
  let minimum = Number.MAX_SAFE_INTEGER;
  let maximum = Number.MIN_SAFE_INTEGER;
  reader.forEach((value, index) => {
    bytes.writeInt32LE(value, index * 4);
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  });
  const path = `fields/${key}.i32le`;
  writeFileSync(resolve(directory, path), bytes);
  return {
    key,
    kind: 'number',
    sourceEncoding: 'i32le',
    path,
    sampleCount: reader.length,
    minimum,
    maximum,
  };
}

function writeStringField(directory, key, reader) {
  const values = new Array(reader.length);
  reader.forEach((value, index) => {
    values[index] = value;
  });
  const path = `fields/${key}.json`;
  writeFileSync(resolve(directory, path), JSON.stringify(values));
  return {
    key,
    kind: 'string',
    sourceEncoding: 'compact-json-array-v1',
    path,
    sampleCount: reader.length,
    minimum: values.reduce((left, right) => (left < right ? left : right)),
    maximum: values.reduce((left, right) => (left > right ? left : right)),
  };
}

function revision(value) {
  const parsed = createVariantRevision(value);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostic));
  return parsed.value;
}

async function generateAcceptedM2Source() {
  const baseline = fixedAtlasInput();
  const parsed = createAtlasLandWaterGenerationInput({
    worldSeed: baseline.worldSeed.toString(),
    worldMapId: baseline.worldMapId,
    worldSurfaceEntityId: baseline.worldSurfaceEntityId,
    macroElevationAspectId: baseline.macroElevationAspectId,
    landWaterClassificationAspectId: baseline.landWaterClassificationAspectId,
    macroElevationVariantRevision: 1,
    landWaterClassificationVariantRevision: 0,
    controls: baseline.controls,
  });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const generated = await generateAtlasLandWaterFull(parsed.value, fixedAtlasRuntime(parsed.value));
  if (generated.status !== 'proposed-full') throw new Error(JSON.stringify(generated.diagnostics));
  return generated;
}

function assertMatchesAcceptedM2Fixture(generated) {
  const map = JSON.parse(readFileSync(acceptedMapPath, 'utf8'));
  const [macroElevation, landWater] = generated.patch.replacements;
  const fixtureMacro = fixtureAspect(map, 'worldTerrain.macroElevation');
  const fixtureLandWater = fixtureAspect(map, 'worldSurface.landWaterClassification');

  assertProposalEnvelopeMatchesFixture(macroElevation, fixtureMacro);
  expect(persistable(macroElevation.output.provenance)).toStrictEqual(
    fixtureMacro.acceptedOutput.provenance,
  );
  expect(sequenceReceipt(macroElevation.output.values)).toStrictEqual(
    sequenceReceipt(fixtureMacro.acceptedOutput.values),
  );

  assertProposalEnvelopeMatchesFixture(landWater, fixtureLandWater);
  expect(landWater.output.classificationBehaviorVersion).toBe(
    fixtureLandWater.acceptedOutput.classificationBehaviorVersion,
  );
  expect(landWater.output.seaLevelContourDoubledTicks).toBe(
    fixtureLandWater.acceptedOutput.seaLevelContourDoubledTicks,
  );
  expect(sequenceReceipt(landWater.output.samples)).toStrictEqual(
    sequenceReceipt(fixtureLandWater.acceptedOutput.samples),
  );
}

function assertProposalEnvelopeMatchesFixture(proposal, fixture) {
  expect(proposal.target.mapId).toBe(fixture.mapId);
  expect(proposal.target.entityId).toBe(fixture.entityId);
  expect(proposal.target.aspect.aspectId).toBe(fixture.aspectId);
  expect(proposal.target.aspectName).toBe(fixture.aspectName);
  expect(proposal.target.variantRevision).toBe(fixture.variantRevision);
  expect(proposal.generatorId).toBe(fixture.generatorId);
  expect(proposal.generatorVersion).toBe(fixture.generatorVersion);
  expect(proposal.parameterSchemaVersion).toBe(fixture.parameterSchemaVersion);
  expect(proposal.parameters).toStrictEqual(fixture.parameters);
  expect(persistable(proposal.seedMetadata)).toStrictEqual(fixture.seedMetadata);
}

function fixtureAspect(map, aspectName) {
  const aspect = map.aspects.find((candidate) => candidate.aspectName === aspectName);
  if (aspect === undefined) throw new Error(`Accepted fixture is missing ${aspectName}.`);
  return aspect;
}

function sequenceReceipt(values) {
  const hash = createHash('sha256');
  let length = 0;
  values.forEach((value, index) => {
    if (index !== length) throw new Error('Accepted field traversal is not contiguous.');
    hash.update(`${JSON.stringify(value)}\n`);
    length += 1;
  });
  return { length, sha256: hash.digest('hex') };
}

function persistable(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item)),
  );
}

function requiredSourceDirectory() {
  if (sourceDirectory === undefined) throw new Error('ISSUE_152_SOURCE_DIR is required.');
  return sourceDirectory;
}
