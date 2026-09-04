import { readFileSync } from 'node:fs';

import { sha256, type WorldDocument } from '@ttrpg-map/core';
import {
  decodeMapworld,
  encodeMapworld,
  type MapworldPackage,
  PERSISTENCE_DIAGNOSTIC_CODES,
} from '@ttrpg-map/persistence';
import { describe, expect, it, vi } from 'vitest';

import { reopenAcceptedAtlas } from './atlas-workflow-reopen.js';

const generatorTripwire = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('Macro-elevation compatibility attempted to invoke generation.');
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

const FIXTURE_ROOT = new URL(
  '../../../fixtures/saved-projects/v1/milestone-2-atlas-proof/appearance-rerolled.mapworld/',
  import.meta.url,
);
const FIXTURE_MAP_PATH = 'maps/a6f99996-09e8-4f5f-bf5f-80b6bb38bdb7.json';

describe('macro-elevation v1/v2 persistence compatibility', { timeout: 120_000 }, () => {
  it('reopens the representative v1 atlas without generation or byte drift', () => {
    const fixture = fixturePackage();
    const reopened = decoded(fixture);
    const reencoded = encoded(reopened);
    const reopenedAtlas = reopenAcceptedAtlas(reopened);

    expect(packagesEqual(reencoded, fixture)).toBe(true);
    expect(reopenedAtlas.ok).toBe(true);
    expect(macroVersions(reopened)).toStrictEqual({
      generatorVersion: 1,
      parameterFieldBehaviorVersion: 1,
      outputFieldBehaviorVersion: 1,
      seedGeneratorVersion: 1,
    });
    expect(generatorTripwire).not.toHaveBeenCalled();
  });

  it('round trips a synthetic accepted v2 record through the existing package schema', () => {
    const firstPackage = syntheticV2Package();
    const reopened = decoded(firstPackage);
    const secondPackage = encoded(reopened);
    const reopenedAtlas = reopenAcceptedAtlas(reopened);

    expect(reopenedAtlas.ok).toBe(true);
    expect(macroVersions(reopened)).toStrictEqual({
      generatorVersion: 2,
      parameterFieldBehaviorVersion: 2,
      outputFieldBehaviorVersion: 2,
      seedGeneratorVersion: 2,
    });
    expect(packagesEqual(secondPackage, firstPackage)).toBe(true);
    expect(generatorTripwire).not.toHaveBeenCalled();
  });

  it('fails closed while decoding unknown and mismatched macro-elevation versions', () => {
    const mismatched = rewriteMapAndChecksum(syntheticV2Package(), (mapText) =>
      replaceExactly(
        mapText,
        '          "fieldBehaviorVersion": 2',
        '          "fieldBehaviorVersion": 1',
        1,
      ),
    );
    expectSchemaFailure(mismatched);

    const unknownGenerator = rewriteMapAndChecksum(syntheticV2Package(), (mapText) =>
      replaceMacroGeneratorVersion(mapText, 2, 3),
    );
    expectVersionIncompatible(unknownGenerator);

    const unknownField = rewriteMapAndChecksum(syntheticV2Package(), (mapText) =>
      replaceExactly(mapText, '"fieldBehaviorVersion": 2', '"fieldBehaviorVersion": 3', 2),
    );
    expectVersionIncompatible(unknownField);
    expect(generatorTripwire).not.toHaveBeenCalled();
  });
});

function fixturePackage(): MapworldPackage {
  return {
    files: ['manifest.json', 'world.json', FIXTURE_MAP_PATH].map((path) => ({
      path,
      bytes: new Uint8Array(readFileSync(new URL(path, FIXTURE_ROOT))),
    })),
  };
}

function syntheticV2Package(): MapworldPackage {
  return rewriteMapAndChecksum(fixturePackage(), (mapText) => {
    const withFieldVersion = replaceExactly(
      mapText,
      '"fieldBehaviorVersion": 1',
      '"fieldBehaviorVersion": 2',
      2,
    );
    return replaceMacroGeneratorVersion(withFieldVersion, 1, 2);
  });
}

function replaceMacroGeneratorVersion(source: string, from: number, to: number): string {
  const withAspectVersion = replaceExactly(
    source,
    `"generatorId": "worldTerrain.macroElevation",\n      "generatorVersion": ${String(from)}`,
    `"generatorId": "worldTerrain.macroElevation",\n      "generatorVersion": ${String(to)}`,
    1,
  );
  return replaceExactly(
    withAspectVersion,
    `"generatorId": "worldTerrain.macroElevation",\n        "generatorVersion": ${String(from)}`,
    `"generatorId": "worldTerrain.macroElevation",\n        "generatorVersion": ${String(to)}`,
    1,
  );
}

function rewriteMapAndChecksum(
  pkg: MapworldPackage,
  rewrite: (mapText: string) => string,
): MapworldPackage {
  const mapFile = pkg.files.find(({ path }) => path === FIXTURE_MAP_PATH);
  const manifestFile = pkg.files.find(({ path }) => path === 'manifest.json');
  if (mapFile === undefined || manifestFile === undefined) {
    throw new Error('Expected manifest and root map package files.');
  }
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const changedMapBytes = encoder.encode(rewrite(decoder.decode(mapFile.bytes)));
  const priorDigest = hex(sha256(mapFile.bytes));
  const changedDigest = hex(sha256(changedMapBytes));
  const changedManifestBytes = encoder.encode(
    replaceExactly(decoder.decode(manifestFile.bytes), priorDigest, changedDigest, 1),
  );
  return {
    files: pkg.files.map((file) => {
      if (file.path === FIXTURE_MAP_PATH) return { ...file, bytes: changedMapBytes };
      if (file.path === 'manifest.json') return { ...file, bytes: changedManifestBytes };
      return file;
    }),
  };
}

function replaceExactly(
  source: string,
  target: string,
  replacement: string,
  expectedCount: number,
): string {
  const count = source.split(target).length - 1;
  if (count !== expectedCount) {
    throw new Error(
      `Expected ${String(expectedCount)} occurrences of ${target}; found ${String(count)}.`,
    );
  }
  return source.replaceAll(target, replacement);
}

function macroVersions(document: WorldDocument) {
  const aspect = macroAspect(document);
  const parameters = record(aspect.parameters);
  const output = record(aspect.acceptedOutput);
  const provenance = record(output.provenance);
  return {
    generatorVersion: aspect.generatorVersion,
    parameterFieldBehaviorVersion: parameters.fieldBehaviorVersion,
    outputFieldBehaviorVersion: provenance.fieldBehaviorVersion,
    seedGeneratorVersion: aspect.seedMetadata.generatorVersion,
  };
}

function macroAspect(document: WorldDocument) {
  const aspect = document.maps[0]?.aspects.find(
    ({ aspectName }) => aspectName === 'worldTerrain.macroElevation',
  );
  if (aspect === undefined) throw new Error('Expected macro-elevation accepted aspect.');
  return aspect;
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected a persisted record.');
  }
  return value as Readonly<Record<string, unknown>>;
}

function decoded(pkg: MapworldPackage): WorldDocument {
  const result = decodeMapworld(pkg);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function encoded(document: WorldDocument): MapworldPackage {
  const result = encodeMapworld(document);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function packagesEqual(left: MapworldPackage, right: MapworldPackage): boolean {
  return (
    left.files.length === right.files.length &&
    left.files.every((file, index) => {
      const other = right.files[index];
      return file.path === other?.path && byteArraysEqual(file.bytes, other.bytes);
    })
  );
}

function byteArraysEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function hex(value: Uint8Array): string {
  return [...value].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function expectSchemaFailure(pkg: MapworldPackage): void {
  const result = decodeMapworld(pkg);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('Expected unsupported macro-elevation versions to fail.');
  expect(result.diagnostics.map(({ code }) => code)).toContain(
    PERSISTENCE_DIAGNOSTIC_CODES.schemaInvalid,
  );
}

function expectVersionIncompatible(pkg: MapworldPackage): void {
  const result = decodeMapworld(pkg);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('Expected unsupported macro-elevation versions to fail.');
  expect(result.diagnostics.map(({ code }) => code)).toContain(
    PERSISTENCE_DIAGNOSTIC_CODES.versionIncompatible,
  );
}
