import {
  type AcceptedAspectRecord,
  ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_ASSET_ID,
  ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_ASSET_SCHEMA_VERSION,
  ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_BEHAVIOR_VERSION,
  ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_PACK_SHA256,
  ATLAS_LABEL_MAX_CODE_POINTS,
  ATLAS_LABEL_PLACEMENT_ASPECT_NAME,
  ATLAS_LABEL_PLACEMENT_BEHAVIOR_VERSION,
  ATLAS_LABEL_PLACEMENT_GENERATOR_ID,
  ATLAS_LABEL_PLACEMENT_PARAMETER_SCHEMA_VERSION,
  createVariantRevision,
  deriveAtlasLabelPlacementAspectId,
  deriveWorldFeatureNameAspectId,
  parseSeedInput,
  WORLD_FEATURE_NAME_ASPECT_NAME,
  WORLD_FEATURE_NAME_BEHAVIOR_VERSION,
  WORLD_FEATURE_NAME_GENERATOR_ID,
  WORLD_FEATURE_NAME_PARAMETER_SCHEMA_VERSION,
  type WorldDocument,
} from '@ttrpg-map/core';
import { describe, expect, it } from 'vitest';

import { sha256Hex } from './canonical-json.js';
import { decodeMapworld } from './mapworld-decode.js';
import {
  canonicalAspectBytes,
  canonicalAspectOutputBytes,
  encodeMapworld,
} from './mapworld-encode.js';
import { createProofDocument } from './mapworld-test-support.js';
import { encodeMapworldV2 } from './mapworld-v2-codec.js';
import { type MapworldPackage, PERSISTENCE_DIAGNOSTIC_CODES } from './persistence-model.js';

describe('mapworld v2 accepted atlas-label owners', () => {
  it('stores exact name and placement records as canonical external JSON without field chunks', () => {
    const source = labelDocument();
    const baseline = encoded(source);
    const repeated = encoded(source);
    const reversed = encoded(reverseAcceptedState(source));
    expect(packageEvidence(repeated)).toStrictEqual(packageEvidence(baseline));
    expect(packageEvidence(reversed)).toStrictEqual(packageEvidence(baseline));

    const dataFiles = baseline.files.filter(({ path }) => path.startsWith('data/'));
    expect(dataFiles).toHaveLength(2);
    expect(
      dataFiles.every(({ path }) => path.includes('/aspects/') && path.endsWith('.json')),
    ).toBe(true);
    expect(baseline.files.some(({ path }) => path.endsWith('.mwf'))).toBe(false);

    const map = jsonFile(baseline, requiredFile(baseline, 'maps/').path);
    const references = map.externalAcceptedAspects as Record<string, unknown>[];
    expect(references.map(({ aspectName }) => aspectName).sort()).toStrictEqual([
      'label.placement',
      'worldFeature.nameContent',
    ]);
    expect(
      references.every(({ acceptedAspectSchemaVersion }) => acceptedAspectSchemaVersion === 2),
    ).toBe(true);

    const reopened = decoded(baseline);
    const expected = labelAspects(source);
    expect(labelAspects(reopened)).toStrictEqual(expected);
    expect(reopened.maps[0]?.decoration).toStrictEqual(source.maps[0]?.decoration);

    for (const acceptedEdgeCase of [longUnplacedNameDocument(), atypicalPlacementDocument()]) {
      expect(labelAspects(decoded(encoded(acceptedEdgeCase)))).toStrictEqual(
        labelAspects(acceptedEdgeCase),
      );
    }
    for (const aspect of expected) {
      const complete = resultBytes(canonicalAspectBytes(aspect));
      const output = resultBytes(canonicalAspectOutputBytes(aspect));
      expect(new TextDecoder().decode(complete.subarray(0, 8))).toBe('MWASPCT2');
      expect(new TextDecoder().decode(output.subarray(0, 8))).toBe('MWASOUT2');
      expect(new DataView(complete.buffer, complete.byteOffset).getUint32(8, true)).toBe(1);
      expect(new DataView(output.buffer, output.byteOffset).getUint32(8, true)).toBe(1);
    }

    const v1 = encodeMapworld(source);
    expect(v1.ok).toBe(false);
    if (!v1.ok) {
      expect(v1.diagnostics.map(({ code }) => code)).toContain(
        PERSISTENCE_DIAGNOSTIC_CODES.versionIncompatible,
      );
    }
  });

  it('rejects malformed, generic, inline, noncanonical, and corrupt label owners', () => {
    const baseline = encoded(labelDocument());
    const nameFile = aspectFile(baseline, 'worldFeature.nameContent');
    const placementFile = aspectFile(baseline, 'label.placement');

    const missingField = jsonFile(baseline, nameFile.path);
    delete (missingField.acceptedOutput as Record<string, unknown>).displayName;
    expectCode(
      replaceAuthoritative(baseline, nameFile.path, canonicalBytes(missingField)),
      PERSISTENCE_DIAGNOSTIC_CODES.schemaInvalid,
    );

    const extraField = jsonFile(baseline, nameFile.path);
    (extraField.acceptedOutput as Record<string, unknown>).normalizedName = 'forbidden';
    expectCode(
      replaceAuthoritative(baseline, nameFile.path, canonicalBytes(extraField)),
      PERSISTENCE_DIAGNOSTIC_CODES.schemaInvalid,
    );

    const unsafeInteger = jsonFile(baseline, placementFile.path);
    (unsafeInteger.acceptedOutput as Record<string, unknown>).priority =
      Number.MAX_SAFE_INTEGER + 1;
    expectCode(
      replaceAuthoritative(baseline, placementFile.path, canonicalBytes(unsafeInteger)),
      PERSISTENCE_DIAGNOSTIC_CODES.schemaInvalid,
    );

    const overlongWordCount = Math.floor(ATLAS_LABEL_MAX_CODE_POINTS / 2) + 2;
    const overlongText = Array.from({ length: overlongWordCount }, () => 'A').join(' ');
    const overlongName = jsonFile(baseline, nameFile.path);
    const overlongNameOutput = overlongName.acceptedOutput as Record<string, unknown>;
    overlongNameOutput.displayName = overlongText;
    overlongNameOutput.comparisonKey = overlongText.toLowerCase();
    const overlongPlacement = jsonFile(baseline, placementFile.path);
    const overlongPlacementOutput = overlongPlacement.acceptedOutput as Record<string, unknown>;
    overlongPlacementOutput.displayText = overlongText;
    overlongPlacementOutput.glyphOrigins = Array.from(
      { length: overlongWordCount },
      (_, index) => ({ glyphKey: 'A', codePoint: 65, xTicks: index, yTicks: 0 }),
    );
    const overlongPackage = replaceAuthoritative(
      replaceAuthoritative(baseline, nameFile.path, canonicalBytes(overlongName)),
      placementFile.path,
      canonicalBytes(overlongPlacement),
    );
    expectCode(overlongPackage, PERSISTENCE_DIAGNOSTIC_CODES.schemaInvalid);

    const unsupportedVersion = jsonFile(baseline, nameFile.path);
    unsupportedVersion.acceptedAspectSchemaVersion = 3;
    expectCode(
      replaceAuthoritative(baseline, nameFile.path, canonicalBytes(unsupportedVersion)),
      PERSISTENCE_DIAGNOSTIC_CODES.versionIncompatible,
    );

    const mapFile = requiredFile(baseline, 'maps/');
    const unsupportedReferenceVersion = jsonFile(baseline, mapFile.path);
    const unsupportedReference = (
      unsupportedReferenceVersion.externalAcceptedAspects as Record<string, unknown>[]
    )[0];
    if (unsupportedReference === undefined) throw new Error('Missing external reference.');
    unsupportedReference.acceptedAspectSchemaVersion = 3;
    expectCode(
      replaceAuthoritative(baseline, mapFile.path, canonicalBytes(unsupportedReferenceVersion)),
      PERSISTENCE_DIAGNOSTIC_CODES.versionIncompatible,
    );

    const genericOwner = jsonFile(baseline, nameFile.path);
    genericOwner.aspectName = 'custom.name';
    const genericPackage = replaceAuthoritative(
      baseline,
      nameFile.path,
      canonicalBytes(genericOwner),
    );
    const genericMapFile = requiredFile(genericPackage, 'maps/');
    const genericMap = jsonFile(genericPackage, genericMapFile.path);
    const genericReference = (genericMap.externalAcceptedAspects as Record<string, unknown>[]).find(
      ({ aspectId }) => aspectId === genericOwner.aspectId,
    );
    if (genericReference === undefined) throw new Error('Missing generic-bypass reference.');
    genericReference.aspectName = 'custom.name';
    expectCode(
      replaceAuthoritative(genericPackage, genericMapFile.path, canonicalBytes(genericMap)),
      PERSISTENCE_DIAGNOSTIC_CODES.schemaInvalid,
    );

    const inlineMapFile = requiredFile(baseline, 'maps/');
    const inlineMap = jsonFile(baseline, inlineMapFile.path);
    (inlineMap.aspects as unknown[]).push(jsonFile(baseline, nameFile.path));
    expectCode(
      replaceAuthoritative(baseline, inlineMapFile.path, canonicalBytes(inlineMap)),
      PERSISTENCE_DIAGNOSTIC_CODES.referenceInvalid,
    );

    const reordered = jsonFile(baseline, placementFile.path);
    const reorderedOutput = reordered.acceptedOutput as {
      glyphOrigins: Record<string, unknown>[];
    };
    reorderedOutput.glyphOrigins.reverse();
    expectCode(
      replaceAuthoritative(baseline, placementFile.path, canonicalBytes(reordered)),
      PERSISTENCE_DIAGNOSTIC_CODES.schemaInvalid,
    );

    const noncanonical = new TextEncoder().encode(
      JSON.stringify(jsonFile(baseline, nameFile.path)),
    );
    expectCode(
      replaceAuthoritative(baseline, nameFile.path, noncanonical),
      PERSISTENCE_DIAGNOSTIC_CODES.jsonNoncanonical,
    );

    const corruptBytes = nameFile.bytes.slice();
    corruptBytes[corruptBytes.length - 2] = (corruptBytes.at(-2) ?? 0) ^ 1;
    expectCode(
      replaceFile(baseline, nameFile.path, corruptBytes),
      PERSISTENCE_DIAGNOSTIC_CODES.checksumMismatch,
    );
  });

  it('classifies every unsupported nested label version as incompatible', () => {
    const baseline = encoded(labelDocument());
    const cases = [
      ...versionCases(aspectFile(baseline, 'worldFeature.nameContent').path, [
        ['generatorVersion'],
        ['parameterSchemaVersion'],
        ['seedMetadata', 'seedDerivationVersion'],
        ['seedMetadata', 'deterministicStreamVersion'],
        ['seedMetadata', 'generatorVersion'],
        ['parameters', 'parameterSchemaVersion'],
        ['parameters', 'lexiconVersion'],
        ['parameters', 'nameContentBehaviorVersion'],
        ['acceptedOutput', 'nameContentBehaviorVersion'],
        ['acceptedOutput', 'lexiconVersion'],
      ]),
      ...versionCases(aspectFile(baseline, 'label.placement').path, [
        ['generatorVersion'],
        ['parameterSchemaVersion'],
        ['seedMetadata', 'seedDerivationVersion'],
        ['seedMetadata', 'deterministicStreamVersion'],
        ['seedMetadata', 'generatorVersion'],
        ['parameters', 'parameterSchemaVersion'],
        ['parameters', 'placementBehaviorVersion'],
        ['acceptedOutput', 'glyphAssetSchemaVersion'],
        ['acceptedOutput', 'glyphBehaviorVersion'],
        ['acceptedOutput', 'placementBehaviorVersion'],
      ]),
    ];

    for (const testCase of cases) {
      const incompatibleOwner = jsonFile(baseline, testCase.filePath);
      setNestedValue(incompatibleOwner, testCase.fieldPath, 2);
      expectCode(
        replaceAuthoritative(baseline, testCase.filePath, canonicalBytes(incompatibleOwner)),
        PERSISTENCE_DIAGNOSTIC_CODES.versionIncompatible,
      );
    }

    const unsupportedEncodeDocument = labelDocument();
    const unsupportedEncodeOwner = unsupportedEncodeDocument.maps
      .flatMap(({ aspects }) => aspects)
      .find(({ aspectName }) => aspectName === WORLD_FEATURE_NAME_ASPECT_NAME);
    if (unsupportedEncodeOwner === undefined) throw new Error('Missing encoded name owner.');
    setNestedValue(
      unsupportedEncodeOwner as unknown as Record<string, unknown>,
      ['acceptedOutput', 'lexiconVersion'],
      2,
    );
    const encodeResult = encodeMapworldV2(unsupportedEncodeDocument);
    expect(encodeResult.ok).toBe(false);
    if (!encodeResult.ok) {
      expect(encodeResult.diagnostics.map(({ code }) => code)).toContain(
        PERSISTENCE_DIAGNOSTIC_CODES.versionIncompatible,
      );
    }
  });

  it('rejects duplicate, missing, wrong-map, wrong-name, stale, and mixed-pack references', () => {
    const baseline = encoded(labelDocument());
    const nameFile = aspectFile(baseline, 'worldFeature.nameContent');
    const placementFile = aspectFile(baseline, 'label.placement');
    const mapFile = requiredFile(baseline, 'maps/');

    const duplicate = jsonFile(baseline, mapFile.path);
    const duplicateReferences = duplicate.externalAcceptedAspects as Record<string, unknown>[];
    const duplicatedReference = duplicateReferences[0];
    if (duplicatedReference === undefined) throw new Error('Missing external reference.');
    duplicateReferences.push(structuredClone(duplicatedReference));
    expectCode(
      replaceAuthoritative(baseline, mapFile.path, canonicalBytes(duplicate)),
      PERSISTENCE_DIAGNOSTIC_CODES.referenceInvalid,
    );

    expectCode(
      {
        files: baseline.files.filter(({ path }) => path !== nameFile.path),
      },
      PERSISTENCE_DIAGNOSTIC_CODES.fileMissing,
    );

    const wrongMap = jsonFile(baseline, nameFile.path);
    wrongMap.mapId = '00000000-0000-4000-8000-000000000099';
    expectCode(
      replaceAuthoritative(baseline, nameFile.path, canonicalBytes(wrongMap)),
      PERSISTENCE_DIAGNOSTIC_CODES.referenceInvalid,
    );

    const wrongNameMap = jsonFile(baseline, mapFile.path);
    const wrongNameReference = (
      wrongNameMap.externalAcceptedAspects as Record<string, unknown>[]
    ).find(({ aspectId }) => aspectId === jsonFile(baseline, nameFile.path).aspectId);
    if (wrongNameReference === undefined) throw new Error('Missing name reference.');
    wrongNameReference.aspectName = 'label.placement';
    expectCode(
      replaceAuthoritative(baseline, mapFile.path, canonicalBytes(wrongNameMap)),
      PERSISTENCE_DIAGNOSTIC_CODES.referenceInvalid,
    );

    const stale = jsonFile(baseline, placementFile.path);
    (stale.acceptedOutput as Record<string, unknown>).sourceNameVariantRevision = 1;
    expectCode(
      replaceAuthoritative(baseline, placementFile.path, canonicalBytes(stale)),
      PERSISTENCE_DIAGNOSTIC_CODES.referenceInvalid,
    );

    const mixedPack = jsonFile(baseline, placementFile.path);
    (mixedPack.parameters as Record<string, unknown>).glyphPackSha256 = 'b'.repeat(64);
    (mixedPack.acceptedOutput as Record<string, unknown>).glyphPackSha256 = 'b'.repeat(64);
    expectCode(
      replaceAuthoritative(baseline, placementFile.path, canonicalBytes(mixedPack)),
      PERSISTENCE_DIAGNOSTIC_CODES.schemaInvalid,
    );
  });
});

function labelDocument(): WorldDocument {
  const document = createProofDocument();
  const map = document.maps[0];
  const entity = map?.entities[0];
  if (map === undefined || entity === undefined) throw new Error('Missing label owner.');
  const nameAspectId = deriveWorldFeatureNameAspectId(entity.entityId);
  const placementAspectId = deriveAtlasLabelPlacementAspectId(entity.entityId);
  const revision = requiredCore(createVariantRevision(0));
  const name: AcceptedAspectRecord = {
    mapId: map.mapId,
    entityId: entity.entityId,
    aspectId: nameAspectId,
    aspectName: WORLD_FEATURE_NAME_ASPECT_NAME,
    generatorId: WORLD_FEATURE_NAME_GENERATOR_ID,
    generatorVersion: WORLD_FEATURE_NAME_BEHAVIOR_VERSION,
    parameterSchemaVersion: WORLD_FEATURE_NAME_PARAMETER_SCHEMA_VERSION,
    parameters: {
      parameterSchemaVersion: WORLD_FEATURE_NAME_PARAMETER_SCHEMA_VERSION,
      lexiconVersion: WORLD_FEATURE_NAME_BEHAVIOR_VERSION,
      nameContentBehaviorVersion: WORLD_FEATURE_NAME_BEHAVIOR_VERSION,
    },
    seedScope: 'map/entity',
    seedMetadata: seed(
      document,
      entity.entityId,
      WORLD_FEATURE_NAME_ASPECT_NAME,
      WORLD_FEATURE_NAME_GENERATOR_ID,
    ),
    variantRevision: revision,
    dependencyAspects: [],
    generationStatus: 'accepted',
    diagnostics: [],
    acceptedOutput: {
      entityId: entity.entityId,
      nameKind: 'landmass',
      nameContentBehaviorVersion: WORLD_FEATURE_NAME_BEHAVIOR_VERSION,
      lexiconVersion: WORLD_FEATURE_NAME_BEHAVIOR_VERSION,
      variantRevision: revision,
      origin: 'manual-override',
      displayName: 'Codex Vale',
      comparisonKey: 'codex vale',
    },
  };
  const baseline = { xTicks: 1_000, yTicks: 2_000 };
  const characters = Array.from('Codex Vale').filter((character) => character !== ' ');
  const placement: AcceptedAspectRecord = {
    mapId: map.mapId,
    entityId: entity.entityId,
    aspectId: placementAspectId,
    aspectName: ATLAS_LABEL_PLACEMENT_ASPECT_NAME,
    generatorId: ATLAS_LABEL_PLACEMENT_GENERATOR_ID,
    generatorVersion: ATLAS_LABEL_PLACEMENT_BEHAVIOR_VERSION,
    parameterSchemaVersion: ATLAS_LABEL_PLACEMENT_PARAMETER_SCHEMA_VERSION,
    parameters: {
      parameterSchemaVersion: ATLAS_LABEL_PLACEMENT_PARAMETER_SCHEMA_VERSION,
      placementBehaviorVersion: ATLAS_LABEL_PLACEMENT_BEHAVIOR_VERSION,
      glyphPackSha256: ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_PACK_SHA256,
    },
    seedScope: 'map/entity',
    seedMetadata: seed(
      document,
      entity.entityId,
      ATLAS_LABEL_PLACEMENT_ASPECT_NAME,
      ATLAS_LABEL_PLACEMENT_GENERATOR_ID,
    ),
    variantRevision: revision,
    dependencyAspects: [{ aspectId: nameAspectId }],
    generationStatus: 'accepted',
    diagnostics: [],
    acceptedOutput: {
      placementId: placementAspectId,
      sourceEntityId: entity.entityId,
      sourceNameAspectId: nameAspectId,
      sourceNameVariantRevision: revision,
      displayText: 'Codex Vale',
      glyphAssetId: ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_ASSET_ID,
      glyphAssetSchemaVersion: ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_ASSET_SCHEMA_VERSION,
      glyphBehaviorVersion: ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_BEHAVIOR_VERSION,
      glyphPackSha256: ATLAS_ALEGREYA_MEDIUM_ASCII_GLYPH_PACK_SHA256,
      placementBehaviorVersion: ATLAS_LABEL_PLACEMENT_BEHAVIOR_VERSION,
      variantRevision: revision,
      priority: 10,
      fontSizeTicks: 1_024,
      baseline,
      bounds: { minXTicks: 900, minYTicks: 1_900, maxXTicks: 1_900, maxYTicks: 2_100 },
      glyphOrigins: characters.map((glyphKey, index) => ({
        glyphKey,
        codePoint: glyphKey.codePointAt(0),
        xTicks: baseline.xTicks + index * 100,
        yTicks: baseline.yTicks,
      })),
      selectedVariantKey: 'center',
    },
  };
  return {
    ...document,
    maps: document.maps.map((candidate) =>
      candidate.mapId === map.mapId
        ? {
            ...candidate,
            aspects: [...candidate.aspects, name, placement],
            decoration: { aspectReferences: [{ aspectId: placementAspectId }] },
          }
        : candidate,
    ),
  };
}

function longUnplacedNameDocument(): WorldDocument {
  const document = labelDocument();
  const displayName = `A${'a'.repeat(300)}`;
  return {
    ...document,
    maps: document.maps.map((map) => ({
      ...map,
      aspects: map.aspects
        .filter(({ aspectName }) => aspectName !== ATLAS_LABEL_PLACEMENT_ASPECT_NAME)
        .map((aspect) =>
          aspect.aspectName === WORLD_FEATURE_NAME_ASPECT_NAME
            ? {
                ...aspect,
                acceptedOutput: {
                  ...(aspect.acceptedOutput as Record<string, unknown>),
                  displayName,
                  comparisonKey: displayName.toLowerCase(),
                },
              }
            : aspect,
        ),
      decoration: { aspectReferences: [] },
    })),
  };
}

function atypicalPlacementDocument(): WorldDocument {
  const document = labelDocument();
  return {
    ...document,
    maps: document.maps.map((map) => ({
      ...map,
      aspects: map.aspects.map((aspect) => {
        if (aspect.aspectName !== ATLAS_LABEL_PLACEMENT_ASPECT_NAME) return aspect;
        const output = aspect.acceptedOutput as {
          readonly baseline: { readonly xTicks: number; readonly yTicks: number };
          readonly glyphOrigins: readonly Record<string, unknown>[];
        };
        return {
          ...aspect,
          acceptedOutput: {
            ...output,
            glyphOrigins: output.glyphOrigins.map((origin, index) => ({
              ...origin,
              xTicks: output.baseline.xTicks - index,
              yTicks: output.baseline.yTicks + index + 1,
            })),
          },
        };
      }),
    })),
  };
}

function seed(
  document: WorldDocument,
  entityId: AcceptedAspectRecord['entityId'],
  aspectName: AcceptedAspectRecord['aspectName'],
  generatorId: AcceptedAspectRecord['generatorId'],
) {
  const parsed = parseSeedInput({
    seedDerivationVersion: 1,
    deterministicStreamVersion: 1,
    seedScope: 'map/entity',
    worldSeed: document.worldSeed.toString(),
    generatorId,
    generatorVersion: 1,
    aspectName,
    variantRevision: 0,
    mapId: document.rootMapId,
    entityId,
  });
  if (!parsed.ok) throw new Error(parsed.diagnostic.message);
  return parsed.value;
}

function reverseAcceptedState(document: WorldDocument): WorldDocument {
  return {
    ...document,
    maps: document.maps.map((map) => ({
      ...map,
      aspects: [...map.aspects].reverse(),
      decoration: { aspectReferences: [...map.decoration.aspectReferences].reverse() },
    })),
  };
}

function labelAspects(document: WorldDocument): readonly AcceptedAspectRecord[] {
  return document.maps
    .flatMap(({ aspects }) => aspects)
    .filter(
      ({ aspectName }) =>
        aspectName === WORLD_FEATURE_NAME_ASPECT_NAME ||
        aspectName === ATLAS_LABEL_PLACEMENT_ASPECT_NAME,
    )
    .sort((left, right) =>
      left.aspectId < right.aspectId ? -1 : left.aspectId > right.aspectId ? 1 : 0,
    );
}

function encoded(document: WorldDocument): MapworldPackage {
  const result = encodeMapworldV2(document);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function decoded(pkg: MapworldPackage): WorldDocument {
  const result = decodeMapworld(pkg);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function expectCode(pkg: MapworldPackage, code: string): void {
  const result = decodeMapworld(pkg);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(code);
}

function versionCases(filePath: string, fieldPaths: readonly (readonly string[])[]) {
  return fieldPaths.map((fieldPath) => ({ filePath, fieldPath }));
}

function setNestedValue(
  owner: Record<string, unknown>,
  fieldPath: readonly string[],
  value: unknown,
): void {
  let current = owner;
  for (const segment of fieldPath.slice(0, -1)) {
    const nested = current[segment];
    if (typeof nested !== 'object' || nested === null || Array.isArray(nested)) {
      throw new Error(`Missing nested owner at ${fieldPath.join('.')}.`);
    }
    current = nested as Record<string, unknown>;
  }
  const finalSegment = fieldPath.at(-1);
  if (finalSegment === undefined) throw new Error('Version field path cannot be empty.');
  current[finalSegment] = value;
}

function aspectFile(pkg: MapworldPackage, aspectName: string) {
  const file = pkg.files.find(
    ({ path }) => path.includes('/aspects/') && jsonFile(pkg, path).aspectName === aspectName,
  );
  if (file === undefined) throw new Error(`Missing aspect file ${aspectName}.`);
  return file;
}

function requiredFile(pkg: MapworldPackage, pathPart: string) {
  const file = pkg.files.find(({ path }) => path.includes(pathPart));
  if (file === undefined) throw new Error(`Missing file containing ${pathPart}.`);
  return file;
}

function jsonFile(pkg: MapworldPackage, path: string): Record<string, unknown> {
  const file = pkg.files.find((candidate) => candidate.path === path);
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
  const entry = manifest.authoritativeFiles.find((candidate) => candidate.path === path);
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

function packageEvidence(pkg: MapworldPackage) {
  return pkg.files.map(({ path, bytes }) => ({ path, bytes }));
}

function resultBytes(result: ReturnType<typeof canonicalAspectBytes>): Uint8Array {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function requiredCore<Value>(
  result:
    | { readonly ok: true; readonly value: Value }
    | { readonly ok: false; readonly diagnostic: unknown },
): Value {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostic));
  return result.value;
}
