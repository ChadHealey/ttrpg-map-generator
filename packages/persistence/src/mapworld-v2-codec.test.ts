import {
  type AcceptedAspectRecord,
  ATLAS_FULL_SAMPLE_COUNT,
  createBehaviorVersion,
  createDictionaryWorldPhysicalFieldReader,
  createNumericWorldPhysicalFieldReader,
  createParameterSchemaVersion,
  createVariantRevision,
  deriveWorldPhysicalContextAspectId,
  fingerprintWorldPhysicalField,
  getWorldPhysicalFieldReaderValueFingerprint,
  parseAspectName,
  parseClimateZoneKey,
  parseGeneratorId,
  parseSeedInput,
  type WorldDocument,
  type WorldPhysicalFieldReader,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import { sha256Hex } from './canonical-json.js';
import { decodeMapworld, decodeMapworldV1 } from './mapworld-decode.js';
import { canonicalAspectBytes, canonicalAspectOutputBytes } from './mapworld-encode.js';
import { MAPWORLD_NATIVE_LIMITS } from './mapworld-recovery-model.js';
import { createProofDocument } from './mapworld-test-support.js';
import { encodeMapworldV2, validatePackageLimits } from './mapworld-v2-codec.js';
import { type MapworldPackage, PERSISTENCE_DIAGNOSTIC_CODES } from './persistence-model.js';

describe('mapworld v2 external-aspect codec', { timeout: 60_000 }, () => {
  it('encodes deterministic canonical owners and generator-free reconstructs private readers', () => {
    const document = createProofDocument();
    const temperature = physicalAspect(document, 'worldClimate.temperature', [-12, 0, 37, 37]);
    const zones = physicalAspect(document, 'worldClimate.zones', [
      'temperate',
      'arid',
      'temperate',
      'polar',
    ]);
    const baseline = encodedV2(document, [temperature, zones]);
    const repeated = encodedV2(document, [temperature, zones]);
    const reordered = encodedV2(document, [zones, temperature]);

    expect(packageEvidence(repeated)).toStrictEqual(packageEvidence(baseline));
    expect(packageEvidence(reordered)).toStrictEqual(packageEvidence(baseline));
    expect(baseline.files.map(({ path }) => path)).toStrictEqual([
      'manifest.json',
      'world.json',
      'maps/a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7.json',
      `data/a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7/aspects/${temperature.aspectId}.json`,
      `data/a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7/aspects/${zones.aspectId}.json`,
      `data/a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7/fields/${temperature.aspectId}.temperature.mwf`,
      `data/a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7/fields/${zones.aspectId}.climate-zones.mwf`,
    ]);

    const temperatureChunk = requiredFile(baseline, `.temperature.mwf`);
    expect(new TextDecoder().decode(temperatureChunk.bytes.subarray(0, 8))).toBe('MWFIELD2');
    const header = new DataView(
      temperatureChunk.bytes.buffer,
      temperatureChunk.bytes.byteOffset,
      32,
    );
    expect(header.getUint16(8, true)).toBe(1);
    expect(header.getUint8(10)).toBe(1);
    expect(header.getUint32(12, true)).toBe(ATLAS_FULL_SAMPLE_COUNT);
    expect(header.getUint32(20, true)).toBe(ATLAS_FULL_SAMPLE_COUNT * 2);
    expect([...temperatureChunk.bytes.subarray(24, 32)]).toStrictEqual(new Array(8).fill(0));
    const zoneChunk = requiredFile(baseline, `.climate-zones.mwf`);
    expect(zoneChunk.bytes[10]).toBe(5);

    const reopened = decoded(baseline);
    for (const source of [temperature, zones]) {
      const decodedAspect = requiredAspect(reopened, source.aspectId);
      const sourceReader = fieldReader(source);
      const decodedReader = fieldReader(decodedAspect);
      expect(decodedReader).not.toBe(sourceReader);
      expect(getWorldPhysicalFieldReaderValueFingerprint(decodedReader)).toBe(
        getWorldPhysicalFieldReaderValueFingerprint(sourceReader),
      );
      expect(readerValues(decodedReader)).toStrictEqual(readerValues(sourceReader));
      expect(Object.keys(decodedReader).sort()).toStrictEqual(['at', 'forEach', 'length']);
      expect(Symbol.iterator in decodedReader).toBe(false);
    }
  }, 60_000);

  it('dispatches at the manifest and preserves the v1 compatibility boundary', () => {
    const document = createProofDocument();
    const pkg = encodedV2(document, [
      physicalAspect(document, 'worldClimate.temperature', [-1, 1]),
    ]);
    expect(codes(decodeMapworldV1(pkg))).toStrictEqual([
      PERSISTENCE_DIAGNOSTIC_CODES.versionIncompatible,
    ]);

    const manifest = jsonFile(pkg, 'manifest.json');
    manifest.packageVersion = 3;
    const unknown = replaceFile(pkg, 'manifest.json', canonicalBytes(manifest));
    expect(codes(decodeMapworld(unknown))).toStrictEqual([
      PERSISTENCE_DIAGNOSTIC_CODES.versionIncompatible,
    ]);
  });

  it('frames v2 aspect and output evidence with owned paths and exact lengths', () => {
    const aspect = physicalAspect(createProofDocument(), 'worldClimate.temperature', [-1, 2]);
    const complete = resultBytes(canonicalAspectBytes(aspect));
    const output = resultBytes(canonicalAspectOutputBytes(aspect));
    expect(new TextDecoder().decode(complete.subarray(0, 8))).toBe('MWASPCT2');
    expect(new TextDecoder().decode(output.subarray(0, 8))).toBe('MWASOUT2');
    expect(new DataView(complete.buffer, complete.byteOffset).getUint32(8, true)).toBe(2);
    expect(new DataView(output.buffer, output.byteOffset).getUint32(8, true)).toBe(2);
    expect(complete).toStrictEqual(resultBytes(canonicalAspectBytes(aspect)));
  });

  it('rejects checksum-valid reserved bytes, noncanonical dictionaries, and undeclared data', () => {
    const document = createProofDocument();
    const pkg = encodedV2(document, [
      physicalAspect(document, 'worldClimate.zones', ['arid', 'polar', 'arid']),
    ]);
    const field = requiredFile(pkg, '.climate-zones.mwf');
    const corruptBytes = field.bytes.slice();
    corruptBytes[24] = 1;
    const corrupt = replaceAuthoritative(pkg, field.path, corruptBytes);
    expect(codes(decodeMapworld(corrupt))).toContain(PERSISTENCE_DIAGNOSTIC_CODES.fieldInvalid);

    const aspectPath = requiredFile(pkg, '/aspects/').path;
    const aspect = jsonFile(pkg, aspectPath);
    const output = aspect.acceptedOutput as { values: { dictionary: string[] } };
    output.values.dictionary.reverse();
    const noncanonicalDictionary = replaceAuthoritative(pkg, aspectPath, canonicalBytes(aspect));
    expect(codes(decodeMapworld(noncanonicalDictionary))).toContain(
      PERSISTENCE_DIAGNOSTIC_CODES.fieldInvalid,
    );

    const undeclared = {
      files: [
        ...pkg.files,
        {
          path: `data/a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7/aspects/00000000-0000-4000-8000-000000000099.json`,
          bytes: canonicalBytes({}),
        },
      ],
    };
    expect(codes(decodeMapworld(undeclared))).toContain(
      PERSISTENCE_DIAGNOSTIC_CODES.fileUnexpected,
    );
  });

  it('persists exact rational quantums and rejects malformed literals and fingerprints', () => {
    const document = createProofDocument();
    const temperature = physicalAspect(document, 'worldClimate.temperature', [-4, 8]);
    const winds = prevailingWindAspect(document, temperature);
    const pkg = encodedV2(document, [temperature, winds]);
    const aspectPath = `data/${temperature.mapId}/aspects/${temperature.aspectId}.json`;
    const aspect = jsonFile(pkg, aspectPath);
    expect((aspect.acceptedOutput as Record<string, unknown>).quantumCelsius).toStrictEqual({
      denominator: 10,
      numerator: 1,
    });
    const reopened = requiredAspect(decoded(pkg), temperature.aspectId);
    expect((reopened.acceptedOutput as { quantumCelsius: unknown }).quantumCelsius).toBe(0.1);
    const windAspect = jsonFile(pkg, `data/${winds.mapId}/aspects/${winds.aspectId}.json`);
    expect(
      (windAspect.acceptedOutput as Record<string, unknown>).speedQuantumMetersPerSecond,
    ).toStrictEqual({ denominator: 10, numerator: 1 });
    expect(
      (
        requiredAspect(decoded(pkg), winds.aspectId).acceptedOutput as {
          speedQuantumMetersPerSecond: unknown;
        }
      ).speedQuantumMetersPerSecond,
    ).toBe(0.1);

    const malformed = structuredClone(aspect);
    (malformed.acceptedOutput as Record<string, unknown>).quantumCelsius = {
      denominator: 20,
      numerator: 2,
    };
    expect(
      codes(decodeMapworld(replaceAuthoritative(pkg, aspectPath, canonicalBytes(malformed)))),
    ).toContain(PERSISTENCE_DIAGNOSTIC_CODES.schemaInvalid);

    const wrongFingerprint = structuredClone(aspect);
    const output = wrongFingerprint.acceptedOutput as {
      provenance: { fingerprint: string };
    };
    output.provenance.fingerprint = '0'.repeat(64);
    expect(
      codes(
        decodeMapworld(replaceAuthoritative(pkg, aspectPath, canonicalBytes(wrongFingerprint))),
      ),
    ).toContain(PERSISTENCE_DIAGNOSTIC_CODES.fieldInvalid);
  }, 60_000);

  it('mirrors native count, path, per-file, and aggregate constants before copying bytes', () => {
    expect(MAPWORLD_NATIVE_LIMITS).toMatchObject({
      maximumBasenameBytes: 255,
      maximumDirectoryDepth: 8,
      maximumFileBytes: 134_217_728,
      maximumPackageBytes: 201_326_592,
      maximumPackageFiles: 256,
      maximumRelativePathBytes: 1_024,
    });
    class SyntheticBytes extends Uint8Array {
      public override get byteLength(): number {
        return MAPWORLD_NATIVE_LIMITS.maximumFileBytes + 1;
      }
    }
    const diagnostics = validatePackageLimits([
      { path: 'manifest.json', bytes: new SyntheticBytes(0) },
    ]);
    expect(diagnostics.map(({ code }) => code)).toContain(
      PERSISTENCE_DIAGNOSTIC_CODES.limitExceeded,
    );

    let copyCount = 0;
    class AggregateBytes extends Uint8Array {
      public override get byteLength(): number {
        return Math.floor(MAPWORLD_NATIVE_LIMITS.maximumPackageBytes / 2) + 1;
      }

      public override slice(start?: number, end?: number): Uint8Array<ArrayBuffer> {
        copyCount += 1;
        return super.slice(start, end);
      }
    }
    expect(
      codes(
        decodeMapworld({
          files: [
            { path: 'manifest.json', bytes: new AggregateBytes(0) },
            { path: 'world.json', bytes: new AggregateBytes(0) },
          ],
        }),
      ),
    ).toContain(PERSISTENCE_DIAGNOSTIC_CODES.limitExceeded);
    expect(copyCount).toBe(0);
  });
});

function physicalAspect(
  document: WorldDocument,
  aspectNameText: 'worldClimate.temperature' | 'worldClimate.zones',
  values: readonly number[] | readonly string[],
): AcceptedAspectRecord {
  const map = document.maps[0];
  const entity = map?.entities[0];
  if (map === undefined || entity === undefined) throw new Error('Missing synthetic owner.');
  const aspectId = deriveWorldPhysicalContextAspectId(entity.entityId, aspectNameText);
  const aspectName = parsed(parseAspectName(aspectNameText));
  const generatorId = parsed(parseGeneratorId(aspectNameText));
  const generatorVersion = parsed(createBehaviorVersion(1));
  const parameterSchemaVersion = parsed(createParameterSchemaVersion(1));
  const variantRevision = parsed(createVariantRevision(0));
  const seedMetadata = parsed(
    parseSeedInput({
      seedDerivationVersion: 1,
      deterministicStreamVersion: 1,
      seedScope: 'map/entity',
      worldSeed: document.worldSeed.toString(),
      generatorId,
      generatorVersion,
      aspectName,
      variantRevision,
      mapId: map.mapId,
      entityId: entity.entityId,
    }),
  );
  const numeric = values.every((value) => typeof value === 'number');
  const numericValues = values.filter((value): value is number => typeof value === 'number');
  const textValues = values.filter((value): value is string => typeof value === 'string');
  const reader = numeric ? numericReader(numericValues) : dictionaryReader(textValues);
  const fieldKind = aspectNameText === 'worldClimate.temperature' ? 'temperature' : 'climate-zones';
  const minimumValue = numeric ? Math.min(...numericValues) : [...textValues].sort()[0];
  const maximumValue = numeric ? Math.max(...numericValues) : [...textValues].sort().at(-1);
  if (minimumValue === undefined || maximumValue === undefined)
    throw new Error('Synthetic field values cannot be empty.');
  const provenanceWithoutFingerprint = {
    contractVersion: 1,
    fieldKind,
    ownerAspectId: aspectId,
    sourceAspectIds: [map.aspects[0]?.aspectId ?? aspectId].sort(),
    fieldBehaviorVersion: 1,
    fieldEncodingVersion: 1,
    valueEncoding: numeric ? 'signed-integer-ticks' : 'semantic-key',
    quantizationScale: numeric ? 10 : 1,
    samplingProfileId: 'world-atlas-full-v1',
    samplingPolicyVersion: 1,
    longitudeCellCount: 2_048,
    latitudeBandCount: 1_024,
    canonicalTraversal: 'south-pole-then-rows-then-north-pole',
  } as const;
  const provenance = {
    ...provenanceWithoutFingerprint,
    fingerprint: fingerprintWorldPhysicalField({
      provenance: provenanceWithoutFingerprint,
      minimumValue,
      maximumValue,
      values: reader,
    }),
  };
  const acceptedOutput =
    aspectNameText === 'worldClimate.temperature'
      ? { provenance, minimumValue, maximumValue, values: reader, quantumCelsius: 0.1 as const }
      : {
          provenance,
          minimumValue,
          maximumValue,
          values: reader,
          classificationPolicyVersion: 1,
          definitions: [...new Set(textValues)].sort().map((key) => ({
            key: requiredClimateZoneKey(key),
            minimumTemperature: -1_000,
            maximumTemperature: 1_000,
            minimumMoisture: 0,
            maximumMoisture: 16_777_216,
          })),
        };
  const parameters =
    aspectNameText === 'worldClimate.temperature'
      ? { parameterSchemaVersion: 1, fieldEncodingVersion: 1, climateCharacter: 'varied' }
      : { parameterSchemaVersion: 1, classificationPolicyVersion: 1, fieldEncodingVersion: 1 };
  return {
    mapId: map.mapId,
    entityId: entity.entityId,
    aspectId,
    aspectName,
    generatorId,
    generatorVersion,
    parameterSchemaVersion,
    parameters,
    seedScope: 'map/entity',
    seedMetadata,
    variantRevision,
    dependencyAspects: [],
    generationStatus: 'accepted',
    diagnostics: [],
    acceptedOutput,
  };
}

function numericReader(pattern: readonly number[]): WorldPhysicalFieldReader<number> {
  const storage = new Int16Array(ATLAS_FULL_SAMPLE_COUNT);
  for (let index = 0; index < storage.length; index += 1) {
    storage[index] = pattern[index % pattern.length] ?? 0;
  }
  return createNumericWorldPhysicalFieldReader(storage);
}

function prevailingWindAspect(
  document: WorldDocument,
  temperature: AcceptedAspectRecord,
): AcceptedAspectRecord {
  const map = document.maps[0];
  const entity = map?.entities[0];
  if (map === undefined || entity === undefined) throw new Error('Missing synthetic owner.');
  const aspectName = parsed(parseAspectName('worldClimate.prevailingWinds'));
  const generatorId = parsed(parseGeneratorId('worldClimate.prevailingWinds'));
  const aspectId = deriveWorldPhysicalContextAspectId(
    entity.entityId,
    'worldClimate.prevailingWinds',
  );
  const generatorVersion = parsed(createBehaviorVersion(1));
  const parameterSchemaVersion = parsed(createParameterSchemaVersion(1));
  const variantRevision = parsed(createVariantRevision(0));
  const sourceAspectIds = [temperature.aspectId];
  const field = (
    fieldKind: 'prevailing-winds-direction' | 'prevailing-winds-speed',
    value: number,
  ) => {
    const storage =
      fieldKind === 'prevailing-winds-speed'
        ? new Uint16Array(ATLAS_FULL_SAMPLE_COUNT)
        : new Int32Array(ATLAS_FULL_SAMPLE_COUNT);
    storage.fill(value);
    const values = createNumericWorldPhysicalFieldReader(storage);
    const provenanceWithoutFingerprint = {
      contractVersion: 1 as const,
      fieldKind,
      ownerAspectId: aspectId,
      sourceAspectIds,
      fieldBehaviorVersion: 1 as const,
      fieldEncodingVersion: 1 as const,
      valueEncoding:
        fieldKind === 'prevailing-winds-speed'
          ? ('unsigned-integer-ticks' as const)
          : ('normalized-integer-ticks' as const),
      quantizationScale:
        fieldKind === 'prevailing-winds-speed' ? (10 as const) : (16_777_216 as const),
      samplingProfileId: 'world-atlas-full-v1' as const,
      samplingPolicyVersion: 1 as const,
      longitudeCellCount: 2_048 as const,
      latitudeBandCount: 1_024 as const,
      canonicalTraversal: 'south-pole-then-rows-then-north-pole' as const,
    };
    return {
      provenance: {
        ...provenanceWithoutFingerprint,
        fingerprint: fingerprintWorldPhysicalField({
          provenance: provenanceWithoutFingerprint,
          minimumValue: value,
          maximumValue: value,
          values,
        }),
      },
      minimumValue: value,
      maximumValue: value,
      values,
    };
  };
  return {
    mapId: map.mapId,
    entityId: entity.entityId,
    aspectId,
    aspectName,
    generatorId,
    generatorVersion,
    parameterSchemaVersion,
    parameters: { parameterSchemaVersion: 1, fieldEncodingVersion: 1, climateCharacter: 'varied' },
    seedScope: 'map/entity',
    seedMetadata: parsed(
      parseSeedInput({
        seedDerivationVersion: 1,
        deterministicStreamVersion: 1,
        seedScope: 'map/entity',
        worldSeed: document.worldSeed.toString(),
        generatorId,
        generatorVersion,
        aspectName,
        variantRevision,
        mapId: map.mapId,
        entityId: entity.entityId,
      }),
    ),
    variantRevision,
    dependencyAspects: [{ aspectId: temperature.aspectId }],
    generationStatus: 'accepted',
    diagnostics: [],
    acceptedOutput: {
      xComponents: field('prevailing-winds-direction', 0),
      yComponents: field('prevailing-winds-direction', 0),
      zComponents: field('prevailing-winds-direction', 0),
      speed: field('prevailing-winds-speed', 5),
      speedQuantumMetersPerSecond: 0.1,
    },
  };
}

function dictionaryReader(pattern: readonly string[]): WorldPhysicalFieldReader<string> {
  const dictionary = [...new Set(pattern)].sort();
  const indices = new Uint8Array(ATLAS_FULL_SAMPLE_COUNT);
  for (let index = 0; index < indices.length; index += 1) {
    indices[index] = dictionary.indexOf(pattern[index % pattern.length] ?? '');
  }
  return createDictionaryWorldPhysicalFieldReader(indices, dictionary);
}

function requiredClimateZoneKey(value: string) {
  const parsedValue = parseClimateZoneKey(value);
  if (parsedValue === undefined) throw new Error(`Invalid synthetic climate-zone key ${value}.`);
  return parsedValue;
}

function fieldReader(aspect: AcceptedAspectRecord): WorldPhysicalFieldReader<number | string> {
  const output = aspect.acceptedOutput as {
    readonly values: WorldPhysicalFieldReader<number | string>;
  };
  return output.values;
}

function readerValues(
  reader: WorldPhysicalFieldReader<number | string>,
): readonly (number | string)[] {
  const values: (number | string)[] = [];
  reader.forEach((value) => values.push(value));
  return values;
}

function encodedV2(
  document: WorldDocument,
  aspects: readonly AcceptedAspectRecord[],
): MapworldPackage {
  const result = encodeMapworldV2(document, aspects);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function decoded(pkg: MapworldPackage): WorldDocument {
  const result = decodeMapworld(pkg);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function requiredAspect(document: WorldDocument, aspectId: string): AcceptedAspectRecord {
  const aspect = document.maps
    .flatMap(({ aspects }) => aspects)
    .find((item) => item.aspectId === aspectId);
  if (aspect === undefined) throw new Error(`Missing aspect ${aspectId}.`);
  return aspect;
}

function requiredFile(pkg: MapworldPackage, suffix: string) {
  const file = pkg.files.find(({ path }) => path.includes(suffix));
  if (file === undefined) throw new Error(`Missing package file matching ${suffix}.`);
  return file;
}

function packageEvidence(pkg: MapworldPackage) {
  return pkg.files.map(({ path, bytes }) => ({ path, bytes }));
}

function jsonFile(pkg: MapworldPackage, path: string): Record<string, unknown> {
  const file = pkg.files.find((item) => item.path === path);
  if (file === undefined) throw new Error(`Missing JSON file ${path}.`);
  return JSON.parse(new TextDecoder().decode(file.bytes)) as Record<string, unknown>;
}

function replaceFile(pkg: MapworldPackage, path: string, bytes: Uint8Array): MapworldPackage {
  return { files: pkg.files.map((file) => (file.path === path ? { path, bytes } : file)) };
}

function replaceAuthoritative(
  pkg: MapworldPackage,
  path: string,
  bytes: Uint8Array,
): MapworldPackage {
  const manifest = jsonFile(pkg, 'manifest.json') as {
    authoritativeFiles: { path: string; sha256: string }[];
  };
  const entry = manifest.authoritativeFiles.find((item) => item.path === path);
  if (entry === undefined) throw new Error(`Missing manifest entry ${path}.`);
  entry.sha256 = sha256Hex(bytes);
  return {
    files: pkg.files.map((file) =>
      file.path === path
        ? { path, bytes }
        : file.path === 'manifest.json'
          ? { path: file.path, bytes: canonicalBytes(manifest) }
          : file,
    ),
  };
}

function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(orderValue(value), null, 2)}\n`);
}

function orderValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(orderValue);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => [key, orderValue(item)]),
  );
}

function codes(result: ReturnType<typeof decodeMapworld>): readonly string[] {
  return result.ok ? [] : result.diagnostics.map(({ code }) => code);
}

function resultBytes(result: ReturnType<typeof canonicalAspectBytes>): Uint8Array {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function parsed<Value>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly diagnostic: unknown },
): Value {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostic));
  return result.value;
}
