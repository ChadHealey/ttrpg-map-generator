import { sha256 } from '@ttrpg-map/core';
import { describe, expect, it, vi } from 'vitest';

import { decodeMapworld } from './mapworld-decode.js';
import { canonicalAspectBytes, encodeMapworld } from './mapworld-encode.js';
import {
  createProofDocument,
  proofAspect,
  TEST_MARKER_ASPECT_ID,
  TEST_OUTLINE_ASPECT_ID,
} from './mapworld-test-support.js';
import { type MapworldPackage, PERSISTENCE_DIAGNOSTIC_CODES } from './persistence-model.js';
import {
  createWorldWithGenericPayload,
  createWorldWithRegionalMap,
} from './regional-mapworld-test-support.js';

const generatorTripwire = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('Persistence decode attempted to access a generator export.');
  }),
);

vi.mock(
  '@ttrpg-map/generation',
  () =>
    new Proxy(
      {},
      {
        get: () => generatorTripwire(),
      },
    ),
);

describe('mapworld v1 decoding', () => {
  it('round trips accepted records into new deeply readonly values without generation', () => {
    const source = createProofDocument(1);
    const pkg = encoded(source);
    const reopened = decoded(pkg);

    expect(generatorTripwire).not.toHaveBeenCalled();
    expect(reopened).not.toBe(source);
    expect(reopened.worldDocumentId).toBe(source.worldDocumentId);
    expect(reopened.rootMapId).toBe(source.rootMapId);
    expect(reopened.worldSeed).toBe(source.worldSeed);
    expect(packageBytes(encoded(reopened))).toStrictEqual(packageBytes(pkg));
    expect(Object.isFrozen(reopened)).toBe(true);
    expect(Object.isFrozen(reopened.maps)).toBe(true);
    expect(Object.isFrozen(reopened.maps[0]?.aspects[0]?.acceptedOutput)).toBe(true);
    for (const aspectId of [TEST_OUTLINE_ASPECT_ID, TEST_MARKER_ASPECT_ID]) {
      expect(bytes(canonicalAspectBytes(proofAspect(reopened, aspectId)))).toStrictEqual(
        bytes(canonicalAspectBytes(proofAspect(source, aspectId))),
      );
    }
  });

  it('rejects checksum-invalid authoritative bytes with a stable file path', () => {
    const pkg = encoded(createProofDocument());
    const corrupted = replaceFileBytes(pkg, 'world.json', Uint8Array.of(0x7b, 0x7d, 0x0a));
    const result = decodeMapworld(corrupted);

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: PERSISTENCE_DIAGNOSTIC_CODES.checksumMismatch,
          filePath: 'world.json',
        },
      ],
    });
  });

  it('restores one root WorldMap and a RegionalMap with transform and dependency provenance', () => {
    const source = createWorldWithRegionalMap();
    const pkg = encodeMapworld(source);
    if (!pkg.ok) throw new Error(JSON.stringify(pkg.diagnostics));
    const reopened = decoded(pkg.value);
    const region = reopened.maps.find(({ mapKind }) => mapKind === 'regional');
    if (region === undefined) throw new Error('Expected the regional map to reopen.');

    expect(region).toMatchObject({
      mapKind: 'regional',
      parent: {
        parentMapId: reopened.rootMapId,
        rootMapId: reopened.rootMapId,
        relationshipKind: 'world-to-regional',
      },
      coordinateSystem: {
        kind: 'regional-azimuthal-equidistant',
        transformId: 'planet-regional-azimuthal-equidistant',
        transformVersion: 1,
      },
    });
    expect(region.aspects[0]?.dependencyAspects[0]?.contextProvenance).toMatchObject({
      kind: 'inherited-context',
      parentMapId: reopened.rootMapId,
      childMapId: region.mapId,
    });
  });

  it('classifies an incompatible regional transform version before domain reconstruction', () => {
    const source = encodedPackage(createWorldWithRegionalMap());
    const regionalPath = source.files.find(({ path }) => path.startsWith('maps/b6f99996'))?.path;
    if (regionalPath === undefined) throw new Error('Missing the regional map test file.');
    const changed = rewriteAuthoritativeJson(source, regionalPath, (map) => {
      const coordinateSystem = map.coordinateSystem as Record<string, unknown>;
      coordinateSystem.transformVersion = 2;
    });

    expect(codes(decodeMapworld(changed))).toContain(
      PERSISTENCE_DIAGNOSTIC_CODES.versionIncompatible,
    );
  });

  it('rejects a generic aspect whose declared and metadata seed scopes conflict', () => {
    const source = encodedPackage(createWorldWithRegionalMap());
    const rootPath = source.files.find(({ path }) => path.startsWith('maps/a6f99996'))?.path;
    if (rootPath === undefined) throw new Error('Missing the root map test file.');
    const changed = rewriteAuthoritativeJson(source, rootPath, (map) => {
      const aspects = map.aspects as { seedScope: string }[];
      const aspect = aspects[0];
      if (aspect !== undefined) aspect.seedScope = 'shared-boundary';
    });

    expect(codes(decodeMapworld(changed))).toContain(PERSISTENCE_DIAGNOSTIC_CODES.seedInvalid);
  });

  it('preserves nested own __proto__ keys through canonical bytes and decode', () => {
    const parameters = JSON.parse(
      '{"nested":{"__proto__":{"polluted":"parameters"},"constructor":2}}',
    ) as Record<string, unknown>;
    const output = JSON.parse(
      '{"nested":{"__proto__":{"polluted":"output"},"constructor":3}}',
    ) as Record<string, unknown>;
    const pkg = encodedPackage(createWorldWithGenericPayload(parameters, output));
    const mapBytes = pkg.files.find(({ path }) => path.startsWith('maps/a6f99996'))?.bytes;
    if (mapBytes === undefined) throw new Error('Missing the generic payload map file.');
    expect(new TextDecoder().decode(mapBytes).match(/"__proto__"/gu)).toHaveLength(2);

    const reopened = decoded(pkg);
    expect(packageBytes(encodedPackage(reopened))).toStrictEqual(packageBytes(pkg));
    const aspect = reopened.maps
      .flatMap(({ aspects }) => aspects)
      .find(({ aspectName }) => aspectName === 'regional.source');
    if (aspect === undefined) throw new Error('Missing the reopened generic source aspect.');
    for (const value of [aspect.parameters, aspect.acceptedOutput]) {
      const nested = (value as { nested: Record<string, unknown> }).nested;
      expect(Object.hasOwn(nested, '__proto__')).toBe(true);
      expect(Object.hasOwn(nested, 'constructor')).toBe(true);
      expect(Object.keys(nested)).toStrictEqual(['__proto__', 'constructor']);
      expect(Object.getPrototypeOf(nested)).toBe(Object.prototype);
    }
    expect(({} as { polluted?: string }).polluted).toBeUndefined();
  });

  it('rejects a checksum-valid diagnostic reference to a missing accepted aspect', () => {
    const path = 'maps/a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7.json';
    const changed = rewriteAuthoritativeJson(encoded(createProofDocument()), path, (map) => {
      const aspects = map.aspects as { diagnostics: unknown[] }[];
      const aspect = aspects[0];
      if (aspect !== undefined) {
        aspect.diagnostics = [
          {
            code: 'proof.markers.review-warning',
            severity: 'warning',
            target: { aspectId: '00000000-0000-4000-8000-000000000099' },
            message: 'Review the accepted markers.',
            suggestedAction: 'Inspect the referenced accepted aspect.',
          },
        ];
      }
    });
    const result = decodeMapworld(changed);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected the missing diagnostic target to be rejected.');
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: PERSISTENCE_DIAGNOSTIC_CODES.referenceInvalid,
        filePath: path,
        fieldPath:
          '$.aspects["42928679-db9b-4de2-a8d4-0baecd709cc9"].diagnostics["proof.markers.review-warning"].target',
      }),
    );
  });

  it.each([
    {
      name: 'unknown map field',
      mutate: (map: Record<string, unknown>) => {
        map.unknownRequiredField = true;
      },
      code: PERSISTENCE_DIAGNOSTIC_CODES.schemaInvalid,
    },
    {
      name: 'incompatible map schema',
      mutate: (map: Record<string, unknown>) => {
        map.mapDocumentSchemaVersion = 2;
      },
      code: PERSISTENCE_DIAGNOSTIC_CODES.versionIncompatible,
    },
    {
      name: 'invalid lock reference',
      mutate: (map: Record<string, unknown>) => {
        const locks = map.locks as { target: { aspectId: string } }[];
        const lock = locks[0];
        if (lock !== undefined) lock.target.aspectId = '00000000-0000-4000-8000-000000000099';
      },
      code: PERSISTENCE_DIAGNOSTIC_CODES.referenceInvalid,
    },
    {
      name: 'noncanonical aspect insertion order',
      mutate: (map: Record<string, unknown>) => {
        const aspects = map.aspects as unknown[];
        map.aspects = [...aspects].reverse();
      },
      code: PERSISTENCE_DIAGNOSTIC_CODES.jsonNoncanonical,
    },
  ])('rejects $name without silently stripping or repairing it', ({ mutate, code }) => {
    const path = 'maps/a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7.json';
    const changed = rewriteAuthoritativeJson(encoded(createProofDocument()), path, mutate);
    const result = decodeMapworld(changed);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected invalid persisted data to be rejected.');
    expect(result.diagnostics.map(({ code: candidate }) => candidate)).toContain(code);
    expect(
      result.diagnostics.every(({ filePath, fieldPath }) => filePath !== '' && fieldPath !== ''),
    ).toBe(true);
  });

  it('rejects malformed JSON, missing required data, and undeclared files with distinct codes', () => {
    const pkg = encoded(createProofDocument());
    const malformedManifest = replaceFileBytes(pkg, 'manifest.json', Uint8Array.of(0x7b));
    expect(codes(decodeMapworld(malformedManifest))).toContain(
      PERSISTENCE_DIAGNOSTIC_CODES.jsonMalformed,
    );

    const missingWorld = { files: pkg.files.filter(({ path }) => path !== 'world.json') };
    expect(codes(decodeMapworld(missingWorld))).toContain(PERSISTENCE_DIAGNOSTIC_CODES.fileMissing);

    const extraFile = {
      files: [
        ...pkg.files,
        {
          path: 'maps/00000000-0000-4000-8000-000000000001.json',
          bytes: Uint8Array.of(0x7b, 0x7d, 0x0a),
        },
      ],
    };
    expect(codes(decodeMapworld(extraFile))).toContain(PERSISTENCE_DIAGNOSTIC_CODES.fileUnexpected);
  });
});

function encoded(document: ReturnType<typeof createProofDocument>): MapworldPackage {
  const result = encodeMapworld(document);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function encodedPackage(document: Parameters<typeof encodeMapworld>[0]): MapworldPackage {
  const result = encodeMapworld(document);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function decoded(pkg: MapworldPackage) {
  const result = decodeMapworld(pkg);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function bytes(result: ReturnType<typeof canonicalAspectBytes>): Uint8Array {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function codes(result: ReturnType<typeof decodeMapworld>) {
  return result.ok ? [] : result.diagnostics.map(({ code }) => code);
}

function packageBytes(pkg: MapworldPackage) {
  return pkg.files.map(({ path, bytes }) => ({ path, bytes }));
}

function replaceFileBytes(pkg: MapworldPackage, path: string, bytes: Uint8Array): MapworldPackage {
  return {
    files: pkg.files.map((file) => (file.path === path ? { path, bytes } : file)),
  };
}

function rewriteAuthoritativeJson(
  pkg: MapworldPackage,
  path: string,
  mutate: (value: Record<string, unknown>) => void,
): MapworldPackage {
  const source = pkg.files.find((file) => file.path === path);
  if (source === undefined) throw new Error(`Missing test package file ${path}.`);
  const value = JSON.parse(new TextDecoder().decode(source.bytes)) as Record<string, unknown>;
  mutate(value);
  const changedBytes = testCanonicalBytes(value);
  const manifestFile = pkg.files.find((file) => file.path === 'manifest.json');
  if (manifestFile === undefined) throw new Error('Missing test manifest.');
  const manifest = JSON.parse(new TextDecoder().decode(manifestFile.bytes)) as {
    authoritativeFiles: { path: string; sha256: string }[];
  };
  const entry = manifest.authoritativeFiles.find((candidate) => candidate.path === path);
  if (entry === undefined) throw new Error('Missing authoritative test entry.');
  entry.sha256 = hex(sha256(changedBytes));
  return {
    files: pkg.files.map((file) =>
      file.path === path
        ? { path, bytes: changedBytes }
        : file.path === 'manifest.json'
          ? { path: 'manifest.json', bytes: testCanonicalBytes(manifest) }
          : file,
    ),
  };
}

function testCanonicalBytes(value: unknown): Uint8Array {
  const canonical = canonicalTestValue(value);
  return new TextEncoder().encode(`${JSON.stringify(canonical, null, 2)}\n`);
}

function canonicalTestValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalTestValue);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => [key, canonicalTestValue(item)]),
  );
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
